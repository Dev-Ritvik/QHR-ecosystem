"""
P3F - finish Phase 3: bring the P3.4 architecture into the production lineage.

    blender --background mansion_exterior_P5K.blend --python p3f_integrate.py -- \
        <mansion_exterior_P3.4-CORRECTION.blend> <out.blend> <report.json>

WHY THIS EXISTS. Phase 3 (P3.1-P3.4, 2026-09-01) was authored on the 27 August
locked source and committed as the p34 candidate with production left on v5.
Phase 2.5B, Phase 4 and Phase 5 then all branched from that same 27 August
source, so the promoted p5m carries none of Phase 3: zero P3_ nodes, and the
ashlar wall still runs 5.07 m to the cornice with bare wall at every corner.

WHY p34's NODES CANNOT SIMPLY BE GRAFTED. Inspected in this Blender, appended
from P3.4 into the production source, against what production carries:

  1. TONE. P4A gave every ashlar block its own tone in COLOR_0 (0.90..1.08,
     blocktone_stoneao.py). The 48 quoins carry StoneAO flat 1.0 and no
     p4_blocktone, so every corner would be the one untoned stone on the
     building.
  2. AO. Every production trim and step surface carries a per-vertex raycast AO
     (fount_wall 0.40..0.71, fountain_cap 0.56..0.98). The seven P3 trim pieces
     and the third tread carry ONE hand-set constant each, 0.451..0.823 - values
     matched by eye to neighbours in P3.1/P3.2, never baked.
  3. WINDING. 52 of the 56 pieces are INSIDE OUT: the architrave fillet, both
     door jambs, the third tread and all 48 quoins are closed boxes with a
     NEGATIVE signed volume, every face pointing into the solid. three culls
     back faces, so from outside each one draws its own far inner walls - the
     quoins read as recessed and the tread as a dark slab - and the AO bake
     sends every ray into the piece itself, which is why the first bake put the
     tread, the jambs and the fillet at the 0.40 floor. Fixed by reversing the
     faces of every CLOSED piece whose volume is negative, and asserted after.
     The column bases and the crown are already outward. The bed mould is an
     open profile strip; its only reversed triangles are the far fan triangle
     of each 5 cm2 end cap over its S-curved (cyma) section - a triangulation
     of a non-convex cap, not an export error - and are left.
  4. ENCODING. p34's layer is BYTE_COLOR; production's is FLOAT_COLOR. That is
     fixed here. What is NOT fixable here: the 267 ashlar blocks in the shipped
     p5m carry COLOR_0 as UNSIGNED_SHORT normalised VEC4 (they arrived through
     P4A's transplant), while export_web.py - the donor path for everything else,
     P5K's own ashlar included - writes FLOAT VEC3. The runtime batches
     MAT_Stone_Wall by material and attribute NAME, and three's mergeGeometries
     refuses inconsistent array types, so any grafted quoin would fail the WHOLE
     wall batch and put 267 blocks back on their own draw calls, silently. That
     is answered in ExteriorModel.tsx's merge key, not in the asset.

WHAT THIS DOES, in the production source and nowhere else:
  * appends the 56 Phase 3 objects (8 P3_ pieces, 48 quoin_ blocks) from P3.4,
    links them into COL_Exterior so a future full export_web.py run ships them,
    and folds the appended MAT_Stone_*.001 copies onto the production Phase 4
    materials - then removes only what the append itself introduced;
  * turns the 52 inside-out closed pieces the right way out (see 3);
  * asserts the world-box UV rule (1 UV per metre, V on world Z) still holds;
  * rebuilds StoneAO as one FLOAT_COLOR corner layer, the production encoding;
  * tones the quoins with blocktone_stoneao.py's own distribution;
  * bakes the P3 pieces with bake_ao_raycast.py's ARCH occluder set, in the
    production scene, so their AO is measured rather than matched;
  * MEASURES what the new architecture does to the AO of the surfaces around it
    (with the P3 pieces hidden vs present), and reports it - see NEIGHBOURS;
  * saves to a NEW file. The Draco donor for graft_draco_nodes.py is then made
    by export_web.py against that file, exactly as every Phase 5 donor was.

WHY NOT EXPORT THE DONOR FROM HERE. The first version did, with the same
geometry flags as export_web.py but export_image_format='NONE' - and the exporter
wrote TWO colour layers for every object, a UNSIGNED_BYTE COLOR_0 and a
UNSIGNED_SHORT COLOR_1, off meshes carrying exactly one FLOAT_COLOR attribute.
That is the failure p5_fix_color_attrs.py records for P5A. export_web.py on the
saved file writes one FLOAT VEC3 COLOR_0 for the same objects, the same as it
writes for the 267 ashlar blocks, so the donor comes from there.

NEIGHBOURS. Adding a cornice or a column base changes the occlusion of what is
next to it. Whether that is worth replacing shipped primitives for is a
measurement, not a policy: the report gives, per neighbouring object, the AO
delta at every exposed sample within MAXDIST of the new pieces, skipping samples
the new geometry itself covers. It also checks that a bake WITHOUT the P3
pieces reproduces the AO production already ships, which is what says the
comparison is against the right baseline.

Never writes to the input .blend.
"""
import bpy, bmesh, sys, os, json, re, zlib, importlib.util
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:]
P34, OUT_BLEND, REPORT = args[0], args[1], args[2]
if os.path.abspath(OUT_BLEND) == os.path.abspath(bpy.data.filepath):
    raise SystemExit('refusing to overwrite the input blend')

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('bake_ao_raycast', os.path.join(HERE, 'bake_ao_raycast.py'))
ao = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ao)

PAT = re.compile(r'^(P3_|quoin_)')
REMAP = {'MAT_Stone_Trim.001': 'MAT_Stone_Trim',
         'MAT_Stone_Steps.001': 'MAT_Stone_Steps',
         'MAT_Stone_Wall.001': 'MAT_Stone_Wall'}
ATTR = 'StoneAO'
# blocktone_stoneao.py's distribution, verbatim
SIGMA, LO, HI, HUE = 0.045, 0.90, 1.08, 0.015

report = {"blender": bpy.app.version_string, "source": bpy.data.filepath, "p34": P34}

# ── 0. is blocktone's seed reproducible in this interpreter? ─────────────────
# blocktone_stoneao.py seeds with abs(hash(name)). str hashes are randomised per
# process unless PYTHONHASHSEED is fixed, so check it against the tones the
# ashlar actually carries before deciding which seed the quoins get.
def tone_from_seed(seed):
    rg = np.random.default_rng(seed)
    t = float(np.clip(1.0 + rg.normal(0.0, SIGMA), LO, HI))
    d = (t - 1.0) / (HI - 1.0) if t > 1.0 else (t - 1.0) / (1.0 - LO)
    return [t * (1.0 - HUE * d), t, t * (1.0 + HUE * d)]

ash = [o for o in bpy.data.objects if re.match(r'^ashlar_(WEST|EAST|NORTH|SOUTH)_\d+$', o.name)
       and 'p4_blocktone' in o]
match = sum(1 for o in ash
            if np.allclose(tone_from_seed(abs(hash(o.name)) % (2**32)), list(o['p4_blocktone']), atol=1e-6))
report["blocktone_hash_reproducible"] = {"ashlar_with_tone": len(ash), "reproduced_by_hash": match}
USE_HASH = len(ash) > 0 and match == len(ash)

# ── 1. append ────────────────────────────────────────────────────────────────
before = {k: set(getattr(bpy.data, k).keys()) for k in ('materials', 'images', 'node_groups', 'meshes', 'objects')}
with bpy.data.libraries.load(P34, link=False) as (src, dst):
    names = sorted(n for n in src.objects if PAT.match(n))
    clash = [n for n in names if n in before['objects']]
    if clash:
        raise SystemExit('production already has objects named %r' % clash[:5])
    dst.objects = names
objs = sorted([o for o in dst.objects if o is not None], key=lambda o: o.name)
p3 = [o for o in objs if o.name.startswith('P3_')]
quoins = [o for o in objs if o.name.startswith('quoin_')]
if (len(p3), len(quoins)) != (8, 48):
    raise SystemExit('expected 8 P3_ and 48 quoin_, got %d / %d' % (len(p3), len(quoins)))

ext = bpy.data.collections['COL_Exterior']
for o in objs:
    ext.objects.link(o)
bpy.context.view_layer.update()

remapped = 0
for o in objs:
    for i, m in enumerate(o.data.materials):
        if m is None:
            raise SystemExit('%s has an empty material slot' % o.name)
        if m.name in REMAP:
            o.data.materials[i] = bpy.data.materials[REMAP[m.name]]
            remapped += 1
        elif m.name not in before['materials']:
            raise SystemExit('%s uses an unexpected new material %r' % (o.name, m.name))

removed = {"materials": [], "images": [], "node_groups": []}
for kind in ('materials', 'node_groups', 'images'):
    coll = getattr(bpy.data, kind)
    for d in [d for d in coll if d.name not in before[kind]]:
        if d.users == 0 or (d.users == 1 and d.use_fake_user):
            removed[kind].append(d.name)
            coll.remove(d)
leftover = {k: sorted(n for n in getattr(bpy.data, k).keys() if n not in before[k])
            for k in ('materials', 'images', 'node_groups')}
if any(leftover.values()):
    raise SystemExit('append left new datablocks behind: %r' % leftover)
report["append"] = {"objects": len(objs), "slots_remapped": remapped, "removed": removed,
                    "new_meshes": len(set(bpy.data.meshes.keys()) - before['meshes'])}

# ── 1b. winding: turn the inside-out closed pieces the right way out ─────────
def orientation(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(o.matrix_world)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    closed = all(len(e.link_faces) == 2 for e in bm.edges)
    vol = 0.0
    for f in bm.faces:
        a, b, c = (v.co for v in f.verts)
        vol += a.dot(b.cross(c)) / 6.0
    bm.free()
    return closed, vol

flipped, open_left = [], []
for o in objs:
    closed, vol = orientation(o)
    if not closed:
        open_left.append({"name": o.name, "signed_volume": round(vol, 6)})
        continue
    if vol < 0:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(o.data)
        bm.free()
        o.data.update()
        flipped.append(o.name)
still_inverted = [o.name for o in objs if orientation(o)[0] and orientation(o)[1] < 0]
if still_inverted:
    raise SystemExit('still inside out after the fix: %r' % still_inverted[:5])
report["winding"] = {"flipped": len(flipped),
                     "flipped_P3": sorted(n for n in flipped if n.startswith('P3_')),
                     "flipped_quoins": sum(1 for n in flipped if n.startswith('quoin_')),
                     "open_left_as_is": open_left}

# ── 2. the stone system's UV rule ────────────────────────────────────────────
def box_uv_error(o):
    me = o.data
    uvl = me.uv_layers.active or me.uv_layers[0]
    mw, m3, err = o.matrix_world, o.matrix_world.to_3x3(), 0.0
    for poly in me.polygons:
        n = m3 @ poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            w = mw @ me.vertices[me.loops[li].vertex_index].co
            u, v = (w.y, w.z) if ax == 0 else ((w.x, w.z) if ax == 1 else (w.x, w.y))
            err = max(err, abs(uvl.data[li].uv[0] - u), abs(uvl.data[li].uv[1] - v))
    return err

uv_err = max(box_uv_error(o) for o in objs)
if uv_err > 1e-4:
    raise SystemExit('world-box UV rule broken, max error %.5f' % uv_err)
report["uv_box_max_error"] = uv_err

# ── 3. one FLOAT_COLOR StoneAO layer, the production encoding ────────────────
for o in objs:
    me = o.data
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    a = me.color_attributes.new(ATTR, 'FLOAT_COLOR', 'CORNER')
    me.color_attributes.active_color = a
    me.color_attributes.render_color_index = 0
    me.color_attributes.active_color_index = 0

# ── 4. quoin tone ────────────────────────────────────────────────────────────
tones = []
for o in quoins:
    seed = abs(hash(o.name)) % (2**32) if USE_HASH else zlib.crc32(o.name.encode('utf-8'))
    f = tone_from_seed(seed)
    a = o.data.color_attributes[ATTR]
    buf = np.tile(np.array([f[0], f[1], f[2], 1.0], np.float32), len(a.data))
    a.data.foreach_set('color', buf)
    o['p4_blocktone'] = [float(x) for x in f]
    o.data.update()
    tones.append(f[1])
report["quoin_tone"] = {"seed": "hash (as blocktone_stoneao.py)" if USE_HASH else "crc32(name)",
                        "n": len(tones), "min": round(min(tones), 4), "max": round(max(tones), 4),
                        "mean": round(float(np.mean(tones)), 4), "sd": round(float(np.std(tones)), 4),
                        "ashlar_reference": {
                            "min": round(min(o['p4_blocktone'][1] for o in ash), 4) if ash else None,
                            "max": round(max(o['p4_blocktone'][1] for o in ash), 4) if ash else None,
                            "mean": round(float(np.mean([o['p4_blocktone'][1] for o in ash])), 4) if ash else None,
                            "sd": round(float(np.std([o['p4_blocktone'][1] for o in ash])), 4) if ash else None}}

# ── 5. bake the P3 pieces with the ARCH occluder set ─────────────────────────
if not all(ao.is_masonry(q) for q in quoins):
    raise SystemExit('bake_ao_raycast does not classify quoin_ as masonry')
manifest = ao.build()
missing = [o.name for o in p3 if o.name not in manifest['arch_names']]
if missing:
    raise SystemExit('P3 pieces missing from the ARCH occluder set: %r' % missing)
report["arch_occluders"] = {k: manifest['arch'][k] for k in ('occluders', 'tris')}
report["p3_bake"] = ao.run([o.name for o in p3])

# ── 6. NEIGHBOURS: what the new architecture does to the AO around it ────────
def world_aabb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))

def aabb_gap(a, b):
    d = [max(0.0, a[0][i] - b[1][i], b[0][i] - a[1][i]) for i in range(3)]
    return (d[0] ** 2 + d[1] ** 2 + d[2] ** 2) ** 0.5

p3_boxes = [world_aabb(o) for o in p3]

def near_p3(box):
    return min(aabb_gap(box, b) for b in p3_boxes) <= ao.MAXDIST

def tree_of(objs_):
    dg = bpy.context.evaluated_depsgraph_get()
    verts, faces = [], []
    for o in objs_:
        ev = o.evaluated_get(dg); me = ev.to_mesh(); off = len(verts); mw = o.matrix_world
        verts.extend([mw @ v.co for v in me.vertices])
        for p in me.polygons:
            vs = [i + off for i in p.vertices]
            for k in range(1, len(vs) - 1):
                faces.append((vs[0], vs[k], vs[k + 1]))
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, faces, all_triangles=True, epsilon=0.0)

tree_with = ao._ARCH
for o in p3:
    o.hide_render = True
bpy.context.view_layer.update()
tree_without, _m = ao._bvh(False)
for o in p3:
    o.hide_render = False
bpy.context.view_layer.update()
tree_p3 = tree_of(p3)

neighbours = [o for o in bpy.data.objects
              if o.name in manifest['arch_names'] and not o.name.startswith('P3_')
              and o.type == 'MESH' and o.data.color_attributes.get(ATTR) is not None
              and near_p3(world_aabb(o))]

K = 1.0 - ao.FLOOR
nb_report = {}
for o in sorted(neighbours, key=lambda x: x.name):
    me, mw = o.data, o.matrix_world
    m3 = mw.to_3x3()
    stored = me.color_attributes[ATTR]
    deltas, base_err, buried, worst = [], [], 0, (0.0, None)
    cache = {}
    for poly in me.polygons:
        vs = [mw @ me.vertices[i].co for i in poly.vertices]
        box = (Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))),
               Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs))))
        if not near_p3(box):
            continue
        n = (m3 @ poly.normal).normalized()
        if poly.area > ao.BIG_POLY:
            ao._ARCH = ao._BVH = tree_without
            a_, _e, _n = ao._big_face_ao(me, poly, mw, n)
            ao._ARCH = ao._BVH = tree_with
            b_, _e2, _n2 = ao._big_face_ao(me, poly, mw, n)
            d = (b_ - a_) * K
            deltas.append(d)
            base_err.append(abs(stored.data[poly.loop_indices[0]].color[1] - (ao.FLOOR + K * a_)))
            if abs(d) > abs(worst[0]):
                worst = (d, [round(c, 3) for c in (sum(vs, Vector()) / len(vs))])
            continue
        key_n = (round(n.x * ao.NORMAL_BUCKET), round(n.y * ao.NORMAL_BUCKET), round(n.z * ao.NORMAL_BUCKET))
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            key = (vi, key_n)
            if key in cache:
                continue
            p = mw @ me.vertices[vi].co
            if tree_p3.ray_cast(p + n * 1e-4, n, ao.EXPOSED)[0] is not None:
                cache[key] = None
                buried += 1
                continue
            ao._BVH = tree_without
            a_ = ao.openness(p, n)
            ao._BVH = tree_with
            b_ = ao.openness(p, n)
            d = (b_ - a_) * K
            cache[key] = d
            deltas.append(d)
            base_err.append(abs(stored.data[li].color[1] - (ao.FLOOR + K * a_)))
            if abs(d) > abs(worst[0]):
                worst = (d, [round(c, 3) for c in p])
    if not deltas:
        continue
    ad = np.abs(np.array(deltas))
    be = np.array(base_err)
    nb_report[o.name] = {
        "samples": len(deltas), "buried_by_p3": buried,
        "max_abs_delta": round(float(ad.max()), 4),
        "p99_abs_delta": round(float(np.percentile(ad, 99)), 4),
        "mean_delta": round(float(np.mean(deltas)), 5),
        "n_over_0.02": int((ad > 0.02).sum()), "n_over_0.05": int((ad > 0.05).sum()),
        "n_over_0.10": int((ad > 0.10).sum()),
        "worst": {"delta": round(worst[0], 4), "at": worst[1]},
        "baseline_reproduces_shipped": {"mean_abs": round(float(be.mean()), 4),
                                         "p95_abs": round(float(np.percentile(be, 95)), 4)},
    }
ao._ARCH = ao._BVH = tree_with
report["neighbours"] = nb_report

# ── 7. save as a NEW file ────────────────────────────────────────────────────
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, copy=False)
report["saved"] = OUT_BLEND

with open(REPORT, 'w', encoding='utf-8') as fh:
    json.dump(report, fh, indent=1)
print('###P3F### wrote', REPORT)
