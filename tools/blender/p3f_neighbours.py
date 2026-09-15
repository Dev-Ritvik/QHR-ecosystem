"""
P3F stage 2 - re-bake the AO the Phase 3 architecture actually changes.

    blender --background mansion_exterior_P3F.blend --python p3f_neighbours.py -- <report.json> <name> [<name> ...]

WHICH OBJECTS, AND WHY THOSE. p3f_integrate.py measured every surface within
MAXDIST of the new pieces, baking each exposed sample with the P3 pieces hidden
and then present. The rule applied to that measurement: re-bake an object if the
new architecture moves ANY of its exposed samples by more than 0.05 of the AO
multiply, and leave it alone otherwise. That selects

    lion_frieze     2,619 samples > 0.05, worst -0.45 where the bed mould now
                    closes the frieze-to-cornice step
    mansion_walls     307 samples > 0.05, worst -0.34 at the column foot the
                    base torus now wraps
    entry_cheek_-1/1  5 / 6 samples > 0.05, at the ends of the third tread
    entry_step_0        1 sample  > 0.05, the tread the new one tucks under

and leaves the portico architrave, cornice and cymatium (worst 0.035), both urns
(0.019) and the terraces (0.007) exactly as shipped.

WHY A FULL RE-BAKE OF THOSE OBJECTS IS SAFE. The same measurement baked each
of them WITHOUT the P3 pieces and compared that with the StoneAO production
already ships: lion_frieze and mansion_walls reproduce to a mean of 0.0000 /
0.0001, the cheeks to 0.0034, entry_step_0 to 0.0004. So the shipped AO came
from this tool and these settings, and re-running it with the new geometry
present changes what the new geometry changes and nothing else. This script
does not take that on trust: it records every loop that moves by more than
0.01 and how far it is from the nearest P3 piece.

AND IT PUTS BACK WHAT PHASE 3 DID NOT CAUSE. The first run moved 6 loops of
mansion_walls more than 5 m from any P3 piece, by at most 0.019, all at z 0.0
on the east wall base - which is where P5C's ground-level hardscape edging now
sits as an ARCH occluder that did not exist when the walls were baked. That is
real staleness, but it is Phase 5's, and a re-bake here would ship it under a
Phase 3 label for the same reason entry_step_1 is left alone. Any loop that
moves by more than 0.01 beyond MAXDIST of every P3 piece is restored to its
shipped value, and the count is reported.

AND WHAT THE NEW PIECES BURY. AO lives on vertices, so a vertex the new geometry
covers still shades every visible face it belongs to. The column shaft is the
case that proved it: its bottom ring sits inside the new base torus, re-bakes to
the floor, and - with no ring between the foot and the capital - darkens the
WHOLE visible shaft on a straight gradient, measured on screen at 0.74 of its
old luminance at the foot and 0.90 at mid-height. A covered vertex is not seen,
so its only honest value is the one it shipped with: any loop that moves by more
than 0.01 and whose vertex is buried by a Phase 3 piece - its own outward ray
hits one within EXPOSED, the test the stage 1 measurement skipped buried samples
with - is restored too.

entry_step_1 is deliberately NOT on the list even though it is a neighbour: its
shipped AO does not reproduce (mean 0.020, p95 0.078 - the P5H urns were added
beside it without a re-bake), and the Phase 3 pieces move it by at most 0.001.
Re-baking it would ship an urn correction under a Phase 3 label.

Saves in place. The input is P3F.blend, which p3f_integrate.py created; the
production source P5K.blend is never opened here.
"""
import bpy, sys, os, json, importlib.util
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:]
REPORT, NAMES = args[0], args[1:]
if 'P5K' in os.path.basename(bpy.data.filepath):
    raise SystemExit('refusing to modify the production source')

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('bake_ao_raycast', os.path.join(HERE, 'bake_ao_raycast.py'))
ao = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ao)

p3 = [o for o in bpy.data.objects if o.name.startswith('P3_')]
quoins = [o for o in bpy.data.objects if o.name.startswith('quoin_')]
if (len(p3), len(quoins)) != (8, 48):
    raise SystemExit('this is not a P3F file: %d P3_ / %d quoin_' % (len(p3), len(quoins)))


def world_aabb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


P3_BOX = [world_aabb(o) for o in p3]


def tree_of(objs_):
    dg = bpy.context.evaluated_depsgraph_get()
    verts, faces = [], []
    for o in objs_:
        ev = o.evaluated_get(dg); me = ev.to_mesh(); off = len(verts); mw = o.matrix_world
        verts.extend([mw @ v.co for v in me.vertices])
        for poly in me.polygons:
            vs = [i + off for i in poly.vertices]
            for k in range(1, len(vs) - 1):
                faces.append((vs[0], vs[k], vs[k + 1]))
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, faces, all_triangles=True, epsilon=0.0)


NEW_GEOMETRY = tree_of(p3 + quoins)


def gap_to_p3(p):
    best = 1e9
    for lo, hi in P3_BOX:
        d = [max(0.0, lo[i] - p[i], p[i] - hi[i]) for i in range(3)]
        best = min(best, (d[0] ** 2 + d[1] ** 2 + d[2] ** 2) ** 0.5)
    return best


def p3_snapshot():
    out = {}
    for o in p3:
        a = o.data.color_attributes['StoneAO']
        buf = np.empty(len(a.data) * 4, np.float32)
        a.data.foreach_get('color', buf)
        out[o.name] = buf.copy()
    return out


manifest = ao.build()
p3_before = p3_snapshot()
report = {"blender": bpy.app.version_string, "file": bpy.data.filepath,
          "arch_occluders": {k: manifest['arch'][k] for k in ('occluders', 'tris')}, "objects": {}}

for name in NAMES:
    o = bpy.data.objects.get(name)
    if o is None or o.type != 'MESH' or o.data.color_attributes.get('StoneAO') is None:
        raise SystemExit('%r is not a mesh carrying StoneAO' % name)
    me, mw = o.data, o.matrix_world
    a = me.color_attributes['StoneAO']
    old = np.empty(len(a.data) * 4, np.float32)
    a.data.foreach_get('color', old)
    stats = ao.run([name])[name]
    new = np.empty(len(a.data) * 4, np.float32)
    a.data.foreach_get('color', new)
    d = (new - old).reshape(-1, 4)[:, 1]

    moved = np.nonzero(np.abs(d) > 0.01)[0]
    far = []
    loop_vert = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', loop_vert)
    loop_poly = np.empty(len(me.loops), np.int32)
    for poly in me.polygons:
        loop_poly[poly.loop_start:poly.loop_start + poly.loop_total] = poly.index
    m3 = mw.to_3x3()
    buried = []
    for li in moved:
        p = mw @ me.vertices[int(loop_vert[li])].co
        g = gap_to_p3(p)
        if g > ao.MAXDIST:
            far.append({"loop": int(li), "delta": round(float(d[li]), 4), "gap_m": round(g, 3),
                        "at": [round(c, 3) for c in p]})
            continue
        n = (m3 @ me.polygons[int(loop_poly[li])].normal).normalized()
        if NEW_GEOMETRY.ray_cast(p + n * 1e-4, n, ao.EXPOSED)[0] is not None:
            buried.append({"loop": int(li), "delta": round(float(d[li]), 4),
                           "at": [round(c, 3) for c in p]})
    if far or buried:
        buf = new.reshape(-1, 4)
        idx = [r["loop"] for r in far] + [r["loop"] for r in buried]
        buf[idx] = old.reshape(-1, 4)[idx]
        a.data.foreach_set('color', buf.ravel())
        me.update()
        new = buf.ravel().copy()
        d = (new - old).reshape(-1, 4)[:, 1]
    report["objects"][name] = {
        "bake": stats,
        "loops": int(len(d)),
        "moved_over_0.01": int(len(moved)),
        "moved_over_0.05": int((np.abs(d) > 0.05).sum()),
        "moved_over_0.10": int((np.abs(d) > 0.10).sum()),
        "max_darker": round(float(d.min()), 4),
        "max_lighter": round(float(d.max()), 4),
        "restored_buried_by_p3": len(buried),
        "restored_buried_worst": sorted(buried, key=lambda r: -abs(r["delta"]))[:5],
        "restored_beyond_maxdist": len(far),
        "restored_worst": sorted(far, key=lambda r: -abs(r["delta"]))[:5],
        "max_abs_change_beyond_maxdist_after_restore": (
            round(float(max(abs(d[r["loop"]]) for r in far)), 6) if far else 0.0),
    }

# the Phase 3 pieces were baked by stage 1 against the same occluders; they
# must not have moved
p3_after = p3_snapshot()
report["p3_pieces_unchanged"] = all(np.array_equal(p3_before[k], p3_after[k]) for k in p3_before)

bpy.ops.wm.save_mainfile()
report["saved"] = bpy.data.filepath
with open(REPORT, 'w', encoding='utf-8') as fh:
    json.dump(report, fh, indent=1)
print('###P3F2### wrote', REPORT)
