"""
Phase 5 forensic inventory of a shipped GLB, from the ENVIRONMENT's point of view.

    python tools/gltf/phase5_inventory.py <shipped.glb> [--json out.json]

inspect_shipped_glb.py answers "is this file structurally sound". This one
answers the questions Phase 5 has to answer before authoring anything:

  * what environment objects exist at all (terrain, lawn, hedge, tree, drive,
    fountain, paving, wall), with their WORLD bounding boxes and footprints, so
    "the property" can be described in metres rather than adjectives;
  * how many triangles each costs. Draco keeps the index accessor count in the
    extension's own attribute table, so triangle counts survive compression;
  * how many DRAW CALLS the file implies - one per primitive per node instance,
    which is what the renderer actually issues - and how that splits between
    architecture and environment;
  * which materials and textures are environment-only, so a budget can be
    attributed rather than guessed;
  * texture payload per image and per material, decoded from the KTX2 header
    (dimensions, levels, supercompression) rather than from the file size.

Nothing is modified. Output is a JSON document plus a readable summary.
"""
import json, os, struct, sys, re
from collections import defaultdict

SRC = sys.argv[1]
OUT = None
if '--json' in sys.argv:
    OUT = sys.argv[sys.argv.index('--json') + 1]


def load(path):
    d = open(path, 'rb').read()
    off, g, binb = 12, None, b''
    while off < len(d):
        ln, ty = struct.unpack_from('<II', d, off)
        ch = d[off + 8:off + 8 + ln]
        if ty == 0x4E4F534A: g = json.loads(ch.decode('utf-8'))
        elif ty == 0x004E4942: binb = ch
        off += 8 + ln
    return g, binb, len(d)


g, binb, total = load(SRC)
nodes = g.get('nodes', [])
meshes = g.get('meshes', [])
mats = g.get('materials', [])
texs = g.get('textures', [])
imgs = g.get('images', [])
bvs = g.get('bufferViews', [])
accs = g.get('accessors', [])

# ---- classify by name -------------------------------------------------------
CLASS = [
    ('terrain',   r'terrain|ground|topo|grade'),
    ('lawn',      r'lawn|grass|parterre|turf'),
    ('hedge',     r'hedge|box(wood)?|topiar'),
    ('tree',      r'tree|cypress|conifer|foliage|canopy|trunk|shrub|planting'),
    ('drive',     r'drive|forecourt|gravel|road|path|walk'),
    ('fountain',  r'fountain|basin|water|jet|plinth'),
    ('paving',    r'pav(e|ing)|terrace|patio|slab|apron'),
    ('steps',     r'step|stair|riser|tread'),
    ('wall_env',  r'(garden|boundary|retaining|balustrade|parapet|urn|planter|bollard|lamp|bench|gate|pier)'),
    ('roof',      r'roof|slate|ridge|chimney|dormer|finial|spire'),
    ('building',  r'mansion|facade|wall|column|portico|window|door|block|ashlar|rustic|cornice|band|sill|lintel|arch|pediment|quoin|keystone'),
]


def classify(name):
    n = (name or '').lower()
    for k, pat in CLASS:
        if re.search(pat, n): return k
    return 'other'


# ---- world transforms -------------------------------------------------------
def mat_of(node):
    import math
    if 'matrix' in node:
        m = node['matrix']
        return [[m[0], m[4], m[8], m[12]], [m[1], m[5], m[9], m[13]],
                [m[2], m[6], m[10], m[14]], [m[3], m[7], m[11], m[15]]]
    t = node.get('translation', [0, 0, 0])
    r = node.get('rotation', [0, 0, 0, 1])
    s = node.get('scale', [1, 1, 1])
    x, y, z, w = r
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[i][j] * s[j] for j in range(3)] + [t[i]] for i in range(3)] + [[0, 0, 0, 1]]


def mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def apply(m, p):
    return [sum(m[i][j] * p[j] for j in range(3)) + m[i][3] for i in range(3)]


records = []
scene = g['scenes'][g.get('scene', 0)]


def walk(idx, parent):
    n = nodes[idx]
    world = mul(parent, mat_of(n))
    if 'mesh' in n:
        records.append((idx, n.get('name', ''), n['mesh'], world))
    for c in n.get('children', []): walk(c, world)


I4 = [[1 if i == j else 0 for j in range(4)] for i in range(4)]
for r in scene.get('nodes', []): walk(r, I4)

# ---- per-record geometry ----------------------------------------------------
def tri_count(prim):
    ext = prim.get('extensions', {}).get('KHR_draco_mesh_compression')
    if 'indices' in prim: return accs[prim['indices']]['count'] // 3
    if ext:
        # uncompressed fallback indices are required by spec alongside draco
        return 0
    a = prim['attributes'].get('POSITION')
    return accs[a]['count'] // 3 if a is not None else 0


def verts(prim):
    a = prim['attributes'].get('POSITION')
    return accs[a]['count'] if a is not None else 0


def bbox(prim, world):
    a = prim['attributes'].get('POSITION')
    if a is None: return None
    ac = accs[a]
    if 'min' not in ac: return None
    lo, hi = ac['min'], ac['max']
    pts = [[lo[0] if i & 1 else hi[0], lo[1] if i & 2 else hi[1], lo[2] if i & 4 else hi[2]] for i in range(8)]
    w = [apply(world, p) for p in pts]
    return [[min(p[i] for p in w) for i in range(3)], [max(p[i] for p in w) for i in range(3)]]


groups = defaultdict(lambda: {'nodes': 0, 'prims': 0, 'tris': 0, 'verts': 0,
                              'materials': set(), 'names': [],
                              'min': [1e9] * 3, 'max': [-1e9] * 3})
per_node = []
mat_tris = defaultdict(int)
for idx, name, mi, world in records:
    cls = classify(name)
    gr = groups[cls]
    gr['nodes'] += 1
    if len(gr['names']) < 14: gr['names'].append(name)
    nt = nv = 0
    for p in meshes[mi]['primitives']:
        gr['prims'] += 1
        t = tri_count(p); v = verts(p)
        nt += t; nv += v
        gr['tris'] += t; gr['verts'] += v
        if 'material' in p:
            gr['materials'].add(mats[p['material']].get('name', str(p['material'])))
            mat_tris[mats[p['material']].get('name', str(p['material']))] += t
        bb = bbox(p, world)
        if bb:
            for i in range(3):
                gr['min'][i] = min(gr['min'][i], bb[0][i])
                gr['max'][i] = max(gr['max'][i], bb[1][i])
    bb_all = None
    for p in meshes[mi]['primitives']:
        bb = bbox(p, world)
        if bb:
            bb_all = bb if bb_all is None else [[min(bb_all[0][i], bb[0][i]) for i in range(3)],
                                                [max(bb_all[1][i], bb[1][i]) for i in range(3)]]
    per_node.append({'node': name, 'class': cls, 'tris': nt, 'verts': nv,
                     'prims': len(meshes[mi]['primitives']), 'bbox': bb_all})

# ---- textures ---------------------------------------------------------------
def ktx_info(bv_i):
    bv = bvs[bv_i]
    o = bv.get('byteOffset', 0)
    d = binb[o:o + bv['byteLength']]
    if d[:12] != b'\xabKTX 20\xbb\r\n\x1a\n':
        return {'bytes': bv['byteLength'], 'fmt': 'non-ktx2'}
    vk, ts, w, h, dep, layers, faces, levels, scheme = struct.unpack_from('<IIIIIIIII', d, 12)
    return {'bytes': bv['byteLength'], 'w': w, 'h': h, 'levels': levels,
            'supercompression': {0: 'none', 1: 'basislz', 2: 'zstd', 3: 'zlib'}.get(scheme, scheme),
            'vkFormat': vk}


SLOTS = ('baseColorTexture', 'metallicRoughnessTexture')
MSLOTS = ('normalTexture', 'occlusionTexture', 'emissiveTexture')
mat_tex = defaultdict(list)
img_users = defaultdict(set)
for m in mats:
    pbr = m.get('pbrMetallicRoughness', {})
    for s in SLOTS:
        if s in pbr: mat_tex[m['name']].append((s, pbr[s]['index']))
    for s in MSLOTS:
        if s in m: mat_tex[m['name']].append((s, m[s]['index']))
for mn, lst in mat_tex.items():
    for s, ti in lst:
        t = texs[ti]
        src = (t.get('extensions', {}).get('KHR_texture_basisu', {}) or {}).get('source', t.get('source'))
        img_users[src].add(mn)

img_rows = []
for i, im in enumerate(imgs):
    info = ktx_info(im['bufferView'])
    img_rows.append({'i': i, 'name': im.get('name'), **info, 'used_by': sorted(img_users.get(i, []))})

# ---- report -----------------------------------------------------------------
order = ['building', 'roof', 'terrain', 'lawn', 'hedge', 'tree', 'drive', 'paving',
         'steps', 'fountain', 'wall_env', 'other']
tot_t = sum(v['tris'] for v in groups.values())
tot_p = sum(v['prims'] for v in groups.values())
print('FILE %s  %.2f MB  nodes=%d meshNodes=%d meshes=%d materials=%d textures=%d images=%d'
      % (os.path.basename(SRC), total / 1048576, len(nodes), len(records), len(meshes), len(mats), len(texs), len(imgs)))
print('%-10s %5s %5s %9s %7s  %-34s %s' % ('CLASS', 'NODES', 'PRIMS', 'TRIS', '%TRI', 'WORLD BBOX (x,y,z min->max)', 'MATERIALS'))
for k in order:
    if k not in groups: continue
    v = groups[k]
    bb = ('%.1f,%.1f,%.1f -> %.1f,%.1f,%.1f' % tuple(v['min'] + v['max'])) if v['min'][0] < 1e8 else '-'
    print('%-10s %5d %5d %9d %6.1f%%  %-34s %s'
          % (k, v['nodes'], v['prims'], v['tris'], 100.0 * v['tris'] / max(tot_t, 1), bb, ','.join(sorted(v['materials']))))
print('%-10s %5d %5d %9d' % ('TOTAL', len(records), tot_p, tot_t))
print()
print('TRIANGLES BY MATERIAL')
for mn, t in sorted(mat_tris.items(), key=lambda x: -x[1]):
    print('  %-26s %8d  %5.1f%%' % (mn, t, 100.0 * t / max(tot_t, 1)))
print()
print('IMAGES  (%d, %.2f MB payload)' % (len(imgs), sum(r['bytes'] for r in img_rows) / 1048576))
for r in sorted(img_rows, key=lambda x: -x['bytes']):
    print('  %-40s %5sx%-5s L%-2s %-8s %7.2f KB  %s'
          % (r['name'], r.get('w', '?'), r.get('h', '?'), r.get('levels', '?'),
             r.get('supercompression', '?'), r['bytes'] / 1024, ','.join(r['used_by'])))
print()
print('CLASS NAMES')
for k in order:
    if k in groups: print('  %-10s %s' % (k, ', '.join(groups[k]['names'])))

if OUT:
    json.dump({'file': SRC, 'bytes': total,
               'groups': {k: {**v, 'materials': sorted(v['materials'])} for k, v in groups.items()},
               'per_node': per_node, 'images': img_rows, 'mat_tris': dict(mat_tris)},
              open(OUT, 'w'), indent=1)
    print('\nWROTE', OUT)
