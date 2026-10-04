"""
Measure the v7 estate GLB into the solid volumes the camera must avoid, and write
them as a TypeScript module the camera-path and doorway tests import.

    python estate_bounds_v7.py <estate.glb (pre-Draco)> <out.ts>

Every box is MEASURED from the file: POSITION accessor min/max carried through
each node's world matrix, and for EXT_mesh_gpu_instancing nodes through every
instance's TRS, so each palm and tree gets its own conservative box. If the
estate is re-exported, re-run this; the tests read nothing else.
"""
import json
import struct
import sys

import numpy as np

src, out = sys.argv[1], sys.argv[2]
with open(src, 'rb') as f:
    f.read(12)
    clen, _ = struct.unpack('<II', f.read(8))
    g = json.loads(f.read(clen))
    blen, _ = struct.unpack('<II', f.read(8))
    binary = f.read(blen)
acc, views, nodes = g['accessors'], g['bufferViews'], g['nodes']


def read_acc(i):
    """Float accessor as an (n, k) array, honouring byteStride: gltf-transform
    interleaves vertex attributes, so positions are every 32nd byte, not a run."""
    a = acc[i]
    v = views[a['bufferView']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    comp = {'VEC3': 3, 'VEC4': 4}[a['type']]
    stride = v.get('byteStride', comp * 4)
    raw = np.frombuffer(binary, dtype=np.uint8, count=(a['count'] - 1) * stride + comp * 4, offset=off)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], comp * 4), strides=(stride, 1))
    return np.frombuffer(np.ascontiguousarray(rows).tobytes(), dtype=np.float32).reshape(a['count'], comp)


def trs(t=(0, 0, 0), r=(0, 0, 0, 1), s=(1, 1, 1)):
    x, y, z, w = r
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4)
    m[:3, :3] = R * np.array(s)[None, :]
    m[:3, 3] = t
    return m


def node_m(n):
    return trs(n.get('translation', (0, 0, 0)), n.get('rotation', (0, 0, 0, 1)), n.get('scale', (1, 1, 1)))


parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}


def world(i):
    m = node_m(nodes[i])
    while i in parent:
        i = parent[i]
        m = node_m(nodes[i]) @ m
    return m


def local_box(mesh):
    mn, mx = np.full(3, np.inf), np.full(3, -np.inf)
    for p in mesh['primitives']:
        a = acc[p['attributes']['POSITION']]
        mn, mx = np.minimum(mn, a['min']), np.maximum(mx, a['max'])
    return np.array([[mx[0] if k & 1 else mn[0], mx[1] if k & 2 else mn[1], mx[2] if k & 4 else mn[2], 1.0] for k in range(8)])


def aabb(M, corners):
    p = (M @ corners.T).T[:, :3]
    return p.min(0), p.max(0)


named, trees = {}, []
for i, n in enumerate(nodes):
    if 'mesh' not in n:
        continue
    corners = local_box(g['meshes'][n['mesh']])
    W = world(i)
    inst = n.get('extensions', {}).get('EXT_mesh_gpu_instancing')
    if inst:
        at = inst['attributes']
        T = read_acc(at['TRANSLATION'])
        R = read_acc(at['ROTATION']) if 'ROTATION' in at else None
        S = read_acc(at['SCALE']) if 'SCALE' in at else None
        for k in range(len(T)):
            M = W @ trs(T[k], R[k] if R is not None else (0, 0, 0, 1), S[k] if S is not None else (1, 1, 1))
            mn, mx = aabb(M, corners)
            mn[1] = max(mn[1], 0.0)
            trees.append((n.get('name', 'veg'), mn, mx))
    else:
        named[n.get('name', '')] = aabb(W, corners)


def hull(names):
    mns = [named[x][0] for x in names if x in named]
    mxs = [named[x][1] for x in names if x in named]
    return np.min(mns, 0), np.max(mxs, 0)


def fmt(v):
    return '[' + ', '.join('%.2f' % float(x) for x in v) + ']'


arch = []
# The house: podium, walls, parapet and its urns, pediments, portico and steps.
mn, mx = hull(['podium_walls', 'mansion_walls', 'mansion_bands', 'mansion_parapet', 'mansion_pediments',
               'portico_trim', 'portico_steps', 'mansion_window_trim', 'mansion_quoins', 'mansion_roof', 'garden_planters'])
# The roof is flat (2026-10-01: the hip, the cupola and the spire were taken
# off at the client's word), so the house ends at the gilt finials on its
# corner urns, which live in mansion_gold.
ROOF_TOP = float(named['mansion_gold'][1][1])
mx[1] = max(mx[1], ROOF_TOP)
arch.append(('mansion', mn, mx))
arch.append(('fountain', *hull(['fountain_stone', 'fountain_water'])))
arch.append(('canal', *hull(['canal_stone'])))


def cells(name, size=12.0):
    """A ring wall or a scatter of hedges is not a box: its hull would make the
    whole garden solid. Boxed per 12 m cell of its own vertices instead."""
    i = next(k for k, n in enumerate(nodes) if n.get('name') == name)
    W = world(i)
    pts = []
    for prim in g['meshes'][nodes[i]['mesh']]['primitives']:
        P = read_acc(prim['attributes']['POSITION'])
        P = (W @ np.c_[P, np.ones(len(P))].T).T[:, :3]
        pts.append(P)
    P = np.concatenate(pts)
    keys = np.floor(P[:, [0, 2]] / size).astype(int)
    boxes = {}
    for k, p in zip(map(tuple, keys), P):
        b = boxes.get(k)
        boxes[k] = (np.minimum(b[0], p), np.maximum(b[1], p)) if b else (p.copy(), p.copy())
    return [(name, b[0], b[1]) for b in boxes.values()]


arch += cells('estate_wall')
arch += cells('garden_hedges')
portico = hull(['portico_trim'])
door = hull(['mansion_doors', 'door_relief'])

lines = [
    '// apps/public/src/components/experience/estateBounds.ts',
    '//',
    '// GENERATED by tools/gltf/estate_bounds_v7.py from exterior_estate_v7.glb.',
    '// Do not edit by hand: re-run the script when the estate is re-exported.',
    '//',
    '// World-space, axis-aligned, metres, three.js axes. Every box is measured from',
    '// the file, and every instanced palm and tree has its own.',
    '',
    'export type SolidBox = { name: string; min: [number, number, number]; max: [number, number, number] };',
    '',
    'export const ESTATE_ARCHITECTURE: readonly SolidBox[] = [',
]
for name, a, b in arch:
    lines.append("  { name: '%s', min: %s, max: %s }," % (name, fmt(a), fmt(b)))
lines.append('];')
lines.append('')
lines.append('/** The front door leaves with their carved relief. */')
lines.append("export const ESTATE_DOOR: SolidBox = { name: 'door', min: %s, max: %s };" % (fmt(door[0]), fmt(door[1])))
lines.append('/** The portico: platform, columns, entablature, balcony and cheek walls. */')
lines.append("export const ESTATE_PORTICO: SolidBox = { name: 'portico', min: %s, max: %s };" % (fmt(portico[0]), fmt(portico[1])))
lines.append("/** The highest point of the house: the gilt finials on the parapet's corner urns. */")
lines.append('export const ESTATE_ROOF_TOP = %.2f;' % ROOF_TOP)
lines.append('')
lines.append('export const ESTATE_PLANTING: readonly SolidBox[] = [')
for name, a, b in trees:
    lines.append("  { name: '%s', min: %s, max: %s }," % (name, fmt(a), fmt(b)))
lines.append('];')
open(out, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('BOUNDS', out, 'architecture', len(arch), 'planting', len(trees), 'roof top', ROOF_TOP)
