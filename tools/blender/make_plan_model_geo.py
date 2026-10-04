r"""
THE STATIONS' SITE MODELS: their geometry.

    blender --background --python tools/blender/make_plan_model_geo.py [-- <out_dir>]

The hall's own file carries each layout as plot volumes, cut for a drawing in
light: every plot has a hole where the sanctioned sheet prints its number, so
the plate's ink showed through (tools/blender/build_holo3d.py). In a physical
model those are a pit in every block. So the models of the refinement brief
(tools/gltf/make_plan_models.py draws their faces) are built here from the
same cells (assets/floorplans/<name>_cells.json), solid:

  plots       a block each, its top carrying the model's printed face;
  open land   a low inlay (its holes kept: the plots and roads inside it);
  land held   a low slab;
  the board   one quad under all of it.

Written on the unit square - x and z in -0.5..0.5, as the sheet lies, y up in
METRES - so the film lays it over each station's own plate at that plate's
size. UVs run 0..1 across the sheet with v down (the KTX2 face uploads
unflipped). One file a layout: three meshes (board, tops, sides), a few
thousand triangles, no textures.

Run in Blender for mathutils' tessellator (concave rings, and rings with
holes), which is what built the hall's own.
"""
import json
import os
import struct
import sys

import numpy as np
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FLOOR = os.path.join(ROOT, 'assets', 'floorplans')
OUT = os.path.join(ROOT, 'apps', 'public', 'public', 'models', 'plans')

PLANS = ('kartikeya', 'lucky', 'gayatri')
# Metres. A plot stands a card's thickness and a half over the board; land the
# sheet marks out (sold, or reserved) a little prouder; open land and land
# held back are inlays.
HEIGHT = {'plot': 0.020, 'plot_hot': 0.026, 'green': 0.004, 'pad': 0.007}
# The colour of each kind's edge (sRGB 0..1): a block's sides are its own
# material sawn through. Matches make_plan_models.py.
EDGE = {
    'plot': (0.80, 0.77, 0.70),
    'plot_hot': (0.80, 0.77, 0.70),
    'green': (0.30, 0.35, 0.27),
    'pad': (0.58, 0.56, 0.51),
}


def hull(ring):
    """Andrew's monotone chain: the convex hull of a ring, counter-clockwise."""
    pts = sorted(set((float(x), float(y)) for x, y in ring))
    if len(pts) < 3:
        return [tuple(p) for p in ring]

    def half(points):
        out = []
        for p in points:
            while len(out) >= 2 and (out[-1][0] - out[-2][0]) * (p[1] - out[-2][1]) - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0]) <= 0:
                out.pop()
            out.append(p)
        return out

    lower, upper = half(pts), half(pts[::-1])
    return lower[:-1] + upper[:-1]


def ring_area(ring):
    s = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % len(ring)]
        s += x0 * y1 - x1 * y0
    return abs(s) / 2.0


def plot_ring(cell):
    """A plot's outline, without the notches the sheet's lettering cut in it.

    The cells were traced from the sheet, and where a dimension is printed
    across the line between two plots ("30' X 56'") the tracing went round the
    letters: a bite out of each plot's edge, which in a model is a slot sawn
    in the block. A plot is a convex lot but for those bites, so its hull is
    its true outline - unless the hull adds more than an eighth to its area,
    which is a lot that really is L-shaped, and is kept as traced. (The same
    function draws the face: tools/gltf/make_plan_models.py.)
    """
    ring = [tuple(p) for p in cell['rings'][0]]
    if cell['cat'] not in ('plot', 'plot_hot') or len(ring) < 4:
        return ring
    h = hull(ring)
    a = ring_area(ring)
    return h if a > 0 and ring_area(h) / a < 1.125 else ring


def area(ring):
    s = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % len(ring)]
        s += x0 * y1 - x1 * y0
    return s / 2.0


def lin(c):
    """sRGB to linear, for COLOR_0."""
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def build(name):
    cells = json.load(open(os.path.join(FLOOR, f'{name}_cells.json')))['cells']
    top_p, top_uv, top_i = [], [], []
    side_p, side_n, side_c, side_i = [], [], [], []
    for c in cells:
        cat = c['cat']
        h = HEIGHT.get(cat, 0.006)
        # On the sheet: a cell traced a pixel past its edge is brought back to it.
        clamp = lambda ring: [(min(max(x, 0.0), 1.0), min(max(y, 0.0), 1.0)) for x, y in ring]
        outer = clamp(plot_ring(c))
        if len(outer) < 3:
            continue
        # A plot is solid: the holes its number was cut out by are filled.
        holes = [] if cat in ('plot', 'plot_hot') else [clamp(r) for r in (c.get('holes') or []) if len(r) >= 3]
        if area(outer) < 0:
            outer.reverse()
        for r in holes:
            if area(r) > 0:
                r.reverse()
        loops = [outer] + holes
        # The top.
        base = len(top_p)
        flat = [p for loop in loops for p in loop]
        for x, y in flat:
            top_p.append((x - 0.5, h, -(y - 0.5)))
            top_uv.append((x, 1.0 - y))
        for a, b, cc in tessellate_polygon([[Vector((x, y, 0.0)) for x, y in loop] for loop in loops]):
            pa, pb, pc = flat[a], flat[b], flat[cc]
            # facing up: counter-clockwise in the sheet's plan is +y here
            cross = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0])
            top_i.extend((base + a, base + b, base + cc) if cross > 0 else (base + a, base + cc, base + b))
        # The sides: outer ring counter-clockwise and holes clockwise, so the
        # material is always on the left of travel and the face looks right.
        col = lin(EDGE.get(cat, EDGE['pad']))
        for loop in loops:
            n = len(loop)
            for k in range(n):
                x0, y0 = loop[k]
                x1, y1 = loop[(k + 1) % n]
                dx, dy = x1 - x0, y1 - y0
                ln = (dx * dx + dy * dy) ** 0.5
                if ln < 1e-9:
                    continue
                nx, ny = dy / ln, -dx / ln
                b0 = len(side_p)
                side_p.extend([
                    (x0 - 0.5, 0.0, -(y0 - 0.5)), (x1 - 0.5, 0.0, -(y1 - 0.5)),
                    (x1 - 0.5, h, -(y1 - 0.5)), (x0 - 0.5, h, -(y0 - 0.5)),
                ])
                side_n.extend([(nx, 0.0, -ny)] * 4)
                side_c.extend([col] * 4)
                side_i.extend((b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3))
    board_p = [(-0.5, 0.0, -0.5), (0.5, 0.0, -0.5), (0.5, 0.0, 0.5), (-0.5, 0.0, 0.5)]
    board_uv = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    board_i = [0, 2, 1, 0, 3, 2]
    return {
        'board': (board_p, [(0.0, 1.0, 0.0)] * 4, board_uv, None, board_i),
        'tops': (top_p, [(0.0, 1.0, 0.0)] * len(top_p), top_uv, None, top_i),
        'sides': (side_p, side_n, None, side_c, side_i),
    }


def write_glb(path, parts):
    """One node and one mesh a part; float32 attributes, uint32 indices."""
    blob = bytearray()
    views, accessors, meshes, nodes, materials = [], [], [], [], []

    def push(arr, target, kind, comp, minmax=False):
        while len(blob) % 4:
            blob.append(0)
        off = len(blob)
        blob.extend(arr.tobytes())
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes, 'target': target})
        acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': int(arr.shape[0]), 'type': kind}
        if minmax:
            acc['min'] = [float(v) for v in arr.min(axis=0)]
            acc['max'] = [float(v) for v in arr.max(axis=0)]
        accessors.append(acc)
        return len(accessors) - 1

    for name, (p, n, uv, col, idx) in parts.items():
        attrs = {
            'POSITION': push(np.asarray(p, np.float32), 34962, 'VEC3', 5126, True),
            'NORMAL': push(np.asarray(n, np.float32), 34962, 'VEC3', 5126),
        }
        if uv is not None:
            attrs['TEXCOORD_0'] = push(np.asarray(uv, np.float32), 34962, 'VEC2', 5126)
        if col is not None:
            attrs['COLOR_0'] = push(np.asarray(col, np.float32), 34962, 'VEC3', 5126)
        indices = push(np.asarray(idx, np.uint32), 34963, 'SCALAR', 5125)
        materials.append({'name': f'MAT_PlanModel_{name.capitalize()}', 'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': 0.9}})
        meshes.append({'name': f'plan_{name}', 'primitives': [{'attributes': attrs, 'indices': indices, 'material': len(materials) - 1}]})
        nodes.append({'name': f'plan_{name}', 'mesh': len(meshes) - 1})
    while len(blob) % 4:
        blob.append(0)
    doc = {
        'asset': {'version': '2.0', 'generator': 'make_plan_model_geo.py'},
        'scene': 0,
        'scenes': [{'nodes': list(range(len(nodes)))}],
        'nodes': nodes,
        'meshes': meshes,
        'materials': materials,
        'accessors': accessors,
        'bufferViews': views,
        'buffers': [{'byteLength': len(blob)}],
    }
    js = json.dumps(doc, separators=(',', ':')).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack('<I4s', len(js), b'JSON'))
        f.write(js)
        f.write(struct.pack('<I4s', len(blob), b'BIN\x00'))
        f.write(blob)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = argv[0] if argv else OUT
    os.makedirs(out, exist_ok=True)
    for name in PLANS:
        parts = build(name)
        path = os.path.join(out, f'{name}_model.glb')
        write_glb(path, parts)
        tris = {k: len(v[4]) // 3 for k, v in parts.items()}
        print('PLAN', name, tris, os.path.getsize(path), path)


main()
