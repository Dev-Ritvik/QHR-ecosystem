r"""
Bake ambient occlusion into the v7 estate, and wire it for the glTF exporter.

    blender --background mansion_estate_V7.blend --python bake_estate_ao_v7.py \
        -- <workdir> [arch_px] [ground_px] [arch_samples] [ground_samples] [save_as.blend]

WHY. The client's art-direction review named flat lighting as the first thing
that makes the estate read as a render: "the building looks like it is floating
or composed of plastic ... move from standard ambient lighting to environment
maps and baked ambient occlusion." A sun and a sky do not know where a cornice
shades a frieze, where a window reveal turns away from the sky, or that the
lawn under a rain tree sees almost none of it. Real-time shadows answer the sun;
nothing in the runtime answers the sky. This does, once, offline.

TWO BAKES, BECAUSE THE ESTATE IS TWO KINDS OF SURFACE.

  ARCHITECTURE (AO_ARCH, a packed atlas on UV2)
    Every unique architectural mesh shares one smart-projected atlas. Cycles'
    AO bake at a 6 m reach: long enough that the wall behind the portico knows
    the portico roof is over it, short enough that the far side of the estate
    does not. The GROUND IS HIDDEN from these rays, deliberately. three's
    hemisphere light already models "the lower half of a wall sees the ground",
    and counting the ground again as an occluder is what gives naive AO its
    dirty grey band round the base of every building. Physically the base of a
    wall loses very little sky to the lawn; the LAWN loses half its sky to the
    wall. That half is the second bake.

  GROUND (AO_GROUND, a planar projection on UV2)
    Lawn, paving, gravel, beds, the podium top and the helipad, as one top-down
    map over a 216 m square centred on the house. Baked as sky irradiance under
    a uniform white world - a full path-traced DIFFUSE bake, not an AO pass -
    for two reasons: leaf cards are alpha-cut, and only the path tracer sees
    through them, so a tree leaves dappled shade rather than an opaque disc;
    and there is no reach to choose, so the lawn by a 9.4 m wall darkens the
    way it does in a photograph, over metres, not over a fixed radius.

    It is baked SELECTED-TO-ACTIVE from a single probe quad under the estate,
    casting straight down: each texel takes the top-most ground surface at that
    point, whatever else stands over it. That is what makes a planar map
    possible at all - the lawn runs under the podium, the drive lies on the
    lawn, and a plain bake would let whichever surface baked last win.

WHAT THE WEB GETS. glTF has an occlusion slot and three maps it to aoMap, which
darkens indirect light only - the hemisphere, the sky's irradiance and its
reflections - and leaves the sun to the shadow map. That is exactly the split
above: the sun has its shadows, the sky now has its occlusion.

Each baked material is duplicated before the map goes on (<name>_AO for the
atlas, <name>_AOG for the ground), because the same material is used by meshes
with no UV2 - the compound wall, the kerbs of a different atlas - and those
would otherwise sample a meaningless corner of someone else's map. The runtime
strips the suffix when it looks materials up by name (ExteriorModel POLISH).

WHAT IS NOT BAKED, AND WHY (the forensic audit of 2026-10-09, #8 "a jet-black
jagged line runs along the pediment's sloping edge ... darker than any shadow
in the frame", #25 "streaky horizontal bands run across the entablature and the
steps ... a zipper of jagged steps"). Two kinds of face were in the atlas that
should not have been:

  BURIED FACES. The back of a quoin inside the wall, the foot of a pediment
  inside the roof, a step's end inside the podium: a third of the atlas was
  faces no one can see, every texel of them black, and a black island bleeds.
  Its margin runs into the islands packed beside it, and from the film's
  distances the GPU reads mips in which a seven-pixel gap is no gap at all.
  Two things are done about them. Those that can be PROVED buried are parked
  on the white strip with the undersides: standing just outside the face and
  looking away from it, every way ends on the inside of a solid. (That proof
  is strict, and a quoin's back with its neighbour's corner in view fails
  it.) And in the baked image a texel of PURE black is not a value but a
  hole: no point a camera can reach has lost every ray of a 6 m sky, so
  nothing is taken from what can be seen, and the holes are filled from the
  texels beside them like any other unbaked ground. What a visible face
  blends with at its border is then its neighbour's shade, and a joint ends
  in a soft contact shadow instead of an ink line.

  ARRISES. Every block has its edges eased by a centimetre (build_estate_v7.py
  ease_arrises), and at this atlas's four centimetres a texel a face one
  centimetre wide has no texel of its own: it was given whatever the packer
  had put beside it, which for 742 of them was the black of a buried face next
  to stone in full light. Those were the black lines: along the pediments'
  rakes, under the entablature, along every step's nosing and every quoin. An
  arris is not an island. It is the edge of the faces it was cut from, and it
  reads its occlusion on the more open of them, two texels in from
  that face's own border.

STORAGE. The maps are written sRGB-ENCODED, like the hall's lightmap, and the
KTX2 step tags occlusion sRGB (encode_ktx2.py), so the GPU hands the shader
linear occlusion back while 8 bits spend their precision in the darks, where AO
lives.
"""
import math
import os
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
WORK = argv[0]
ARCH_PX = int(argv[1]) if len(argv) > 1 else 4096
GROUND_PX = int(argv[2]) if len(argv) > 2 else 4096
ARCH_SAMPLES = int(argv[3]) if len(argv) > 3 else 512
GROUND_SAMPLES = int(argv[4]) if len(argv) > 4 else 192
SAVE_AS = argv[5] if len(argv) > 5 else bpy.data.filepath
os.makedirs(WORK, exist_ok=True)
T0 = time.time()


def log(*a):
    print("AO|%6.1fs|" % (time.time() - T0) + " ".join(str(x) for x in a), flush=True)


UVN = "UVLightmap"
# THE ATLAS IS FOR SURFACES, NOT ORNAMENT. The first bake put all 105k faces of
# the house in one atlas and the islands ended up filling 4.8% of it: 25k faces
# of parapet balusters, 33k of podium balustrade, 10k of cupola trim and 8k of
# carved frieze smart-project into tens of thousands of slivers, the packer
# spends the square on the margins between them, and the walls came out at
# 18 cm a texel. The walls, roof, bands, quoins, pediments, steps and terraces
# are where sky occlusion is actually read - the reveals, the soffits, the
# shelter of the portico - and they are a few thousand faces between them.
ARCH = [
    "mansion_walls", "mansion_bands", "mansion_quoins", "mansion_pediments",
    "mansion_roof", "portico_steps", "podium_walls",
    "garden_steps", "fountain_stone", "canal_stone", "pool_coping", "pool_terrace",
]
GROUND = [
    "ground_plane", "drive_forecourt", "terrace_upper", "parterre_gravel",
    "garden_beds", "podium_beds", "helipad_deck", "hardscape_kerbs", "parterre_kerb", "drive_setts",
]
# Blender XY metres the ground map covers: the compound's lived-in middle, with
# the house at the centre. Outside it the map clamps to its border, which is
# ramped to white - open lawn, no occlusion.
GX0, GX1, GY0, GY1 = -108.0, 108.0, -124.0, 92.0
ARCH_REACH = 6.0
# Atlas u beyond this is kept free of islands and painted white; faces that can
# never be seen (the undersides of things standing on the ground) are parked
# there rather than spending atlas on them.
RESERVE = 0.985
PARK_UV = (0.9925, 0.5)
# Emitters, which must not light a sky-only bake.
EMITTERS = ("estate_lamps", "pool_lights", "helipad_lights", "mansion_window_back")

sc = bpy.context.scene
vl = bpy.context.view_layer


# --------------------------------------------------------------- 0. idempotent
# A BAKE OF A BAKED FILE STARTS FROM THE AUTHORED MATERIALS, WHETHER OR NOT THEY
# ARE STILL IN IT. Each baked material is a copy named <name>_AO or <name>_AOG
# (wire(), below), and a second bake put the authored one back by looking it
# up. But Blender does not save a material nothing uses, and once the wall's
# copy stood in for it nothing used MAT_Stone_Wall: after one save and reload
# there was nothing to look up, the copy stayed on the mesh, and the second
# bake copied the copy. Seen on 2026-10-11, the first time the ship script's
# own SKIP_BUILD=1 was run on a file that had been baked and saved: materials
# named MAT_Stone_Wall_AO_AO and MAT_Lawn_AOG_AOG, which the site knows by
# neither name (ExteriorModel authoredName strips one suffix), so the stone
# lost its dressing and the lawn its mowing, and carrying two sets of
# occlusion nodes, the first pointing at an image this script had just
# removed. Where the authored material is gone, the copy IS it: it is given
# its name back and what wire() put on it is taken off.
def base_name(n):
    while True:
        for suf in ("_AOG", "_AO"):
            if n.endswith(suf):
                n = n[: -len(suf)]
                break
        else:
            return n


def unwire(m):
    """Take off a material what wire() put on it: the node that reads UV2,
    the map it feeds and the glTF output that map feeds."""
    nt = m.node_tree
    if nt is None:
        return
    for n in [n for n in nt.nodes if n.type == "UVMAP" and n.uv_map == UVN]:
        for tex in {l.to_node for l in n.outputs["UV"].links}:
            for out in {l.to_node for l in tex.outputs["Color"].links if l.to_node.type == "GROUP"}:
                nt.nodes.remove(out)
            nt.nodes.remove(tex)
        nt.nodes.remove(n)
    for n in [n for n in nt.nodes if n.type == "GROUP" and n.node_tree is not None
              and n.node_tree.name == "glTF Material Output" and not any(i.is_linked for i in n.inputs)]:
        nt.nodes.remove(n)


for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    for i, m in enumerate(o.data.materials):
        if m is not None and base_name(m.name) != m.name:
            b = bpy.data.materials.get(base_name(m.name))
            if b is not None:
                o.data.materials[i] = b
            else:
                unwire(m)
                m.name = base_name(m.name)
    uv = o.data.uv_layers.get(UVN)
    if uv is not None:
        o.data.uv_layers.remove(uv)
for m in list(bpy.data.materials):
    if base_name(m.name) != m.name and m.users == 0:
        bpy.data.materials.remove(m)
for n in ("AO_ARCH", "AO_GROUND", "AO_ARCH_RAW", "AO_GROUND_RAW"):
    if n in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[n])
for n in ("AO_GROUND_PROBE",):
    if n in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)

if os.environ.get("AO_RESET_ONLY"):
    # (A dry run of the step above, for checking it: nothing is baked or saved.)
    for m in sorted(bpy.data.materials, key=lambda m: m.name):
        if m.users and m.node_tree is not None and (
                "Stone" in m.name or "Lawn" in m.name or "Gravel" in m.name or "Roof" in m.name or "_AO" in m.name):
            log("material %-26s users %3d  uv2 nodes %d  glTF outputs %d" % (
                m.name, m.users,
                sum(1 for n in m.node_tree.nodes if n.type == "UVMAP" and n.uv_map == UVN),
                sum(1 for n in m.node_tree.nodes if n.type == "GROUP" and n.node_tree is not None
                    and n.node_tree.name == "glTF Material Output")))
    raise SystemExit(0)

objs = {o.name: o for o in bpy.data.objects if o.type == "MESH"}
arch = [objs[n] for n in ARCH if n in objs]
ground = [objs[n] for n in GROUND if n in objs]
missing = [n for n in ARCH + GROUND if n not in objs]
log("sets arch=%d ground=%d missing=%s" % (len(arch), len(ground), missing))
for o in arch + ground:
    if o.data.users > 1:
        raise SystemExit("shared mesh cannot carry a unique UV2: %s" % o.name)


def world_arrays(o):
    me = o.data
    n = len(me.polygons)
    nor = np.empty(n * 3, dtype=np.float64)
    cen = np.empty(n * 3, dtype=np.float64)
    me.polygons.foreach_get("normal", nor)
    me.polygons.foreach_get("center", cen)
    mw = np.array(o.matrix_world, dtype=np.float64)
    cen = cen.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
    nor = nor.reshape(-1, 3) @ np.linalg.inv(mw[:3, :3])
    nor /= np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-9)
    return nor, cen


# The house's inner wall faces: the main block is 26.2 x 15.6 m on the outside
# with 0.6 m walls, so its inside faces stand at |x| 12.5 and |y| 7.2.
INNER_X, INNER_Y = 13.1 - 0.6 + 0.05, 7.8 - 0.6 + 0.05


def parked_mask(o):
    """Faces nobody can see, which would otherwise take atlas from the ones
    everybody does: undersides resting on the ground, the top of the podium
    box (the terrace plate lies on it), the inside of the house's walls (the
    windows are backed, so the rooms are never seen), the underside of the
    roof."""
    nor, cen = world_arrays(o)
    m = (nor[:, 2] < -0.9) & (cen[:, 2] < 0.06)
    if o.name == "podium_walls":
        m |= nor[:, 2] > 0.9
    elif o.name == "mansion_walls":
        inward = (nor[:, 0] * cen[:, 0] + nor[:, 1] * cen[:, 1]) < 0
        inside = (np.abs(cen[:, 0]) < INNER_X) & (np.abs(cen[:, 1]) < INNER_Y)
        m |= inward & inside & (np.abs(nor[:, 2]) < 0.3)
    elif o.name == "mansion_roof":
        m |= nor[:, 2] < -0.5
    return m


# Everything that is a solid of stone, for the question "is this face inside
# one". Not the ground (an open sheet: what rests on it is parked by its own
# rule above), not the planting.
SOLIDS = ("mansion_", "portico_", "podium_", "garden_steps", "garden_planters", "fountain_stone", "canal_stone",
          "pool_coping", "pool_terrace", "pool_shell", "lion_frieze", "hardscape_kerbs", "terrace_upper")
# An arris, a fillet: narrower than this (metres) and a face is the edge of
# its neighbours, not a surface of its own.
# (0.02 until 2026-10-12, and the pool's coping stands exactly 0.02 proud of
# the terrace: its outer face missed the rule by a rounding, baked black in
# the corner it makes with the paving, and from the film's 30% printed as a
# row of single black pixels along two sides of the pool. Anything that
# stands a finger proud of its neighbour is that neighbour's edge.)
SLIVER = 0.03
# How far inside the face it is cut on an arris reads that face's occlusion.
#
# AS FAR IN AS THE FACE ALLOWS, UP TO INSET_DEEP_PX. It was two texels, which
# is inside the face at the atlas's full size and no further: from the film's
# distances the GPU reads the atlas two and three mips down, where a texel is
# four and eight of these, and an arris two texels from the border read
# whatever was packed on the border's other side. Along the pool's coping
# that was a buried face at 14 of 255: its edge, a finger high, printed half
# as bright as the stone above and below it, one dark pixel at every step of
# the edge (found by a ray through them, 2026-10-12; with the baked occlusion
# off they were gone). So an arris lies half way to the middle of the face it
# is cut on, to a cap of INSET_DEEP_PX, and never nearer its border than
# INSET_PX.
INSET_PX = 2.0
INSET_DEEP_PX = 10.0


def solid_bvh():
    verts, polys = [], []
    for o in bpy.data.objects:
        if o.type != "MESH" or o.hide_render or not o.name.startswith(SOLIDS):
            continue
        mw = o.matrix_world
        first = len(verts)
        verts.extend(mw @ v.co for v in o.data.vertices)
        polys.extend([first + i for i in p.vertices] for p in o.data.polygons)
    return BVHTree.FromPolygons(verts, polys, all_triangles=False, epsilon=0.0)


def sphere_dirs(n):
    out = []
    golden = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(n):
        z = 1.0 - 2.0 * (i + 0.5) / n
        r = math.sqrt(max(0.0, 1.0 - z * z))
        out.append(Vector((r * math.cos(golden * i + 0.37), r * math.sin(golden * i + 0.37), z)))
    return out


DIRS = sphere_dirs(72)


def buried_mask(o, bvh):
    """Faces whose whole outside is inside a solid. From three millimetres off
    the face, rays AWAY from it (toward it they would only find the face
    itself): one that ends on the BACK of a surface started inside what that
    surface encloses. A face is buried when nine in ten do, from every one of
    its points: its centre, and half way and nearly all the way out to each
    corner and each edge. A face that is part out (a quoin's bed, a wall
    behind a band, the roof's walk round its raised middle) is not."""
    me = o.data
    mw = o.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    out = np.zeros(len(me.polygons), dtype=bool)
    for p in me.polygons:
        n = (nm @ p.normal).normalized()
        away = [d for d in DIRS if d.dot(n) > 0.15]
        allow = len(away) - int(0.9 * len(away))
        c = mw @ p.center
        vs = [mw @ me.vertices[i].co for i in p.vertices]
        pts = [c]
        for k, v in enumerate(vs):
            pts += [c.lerp(v, 0.5), c.lerp(v, 0.95), c.lerp((v + vs[(k + 1) % len(vs)]) * 0.5, 0.95)]
        buried = True
        for q in pts:
            q = q + n * 0.003
            miss = 0
            for d in away:
                loc, hn, _i, _d = bvh.ray_cast(q, d)
                if loc is None or hn.dot(d) <= 0.0:
                    miss += 1
                    if miss > allow:
                        break
            if miss > allow:
                buried = False
                break
        out[p.index] = buried
    return out


def sliver_mask(o):
    me = o.data
    out = np.zeros(len(me.polygons), dtype=bool)
    for p in me.polygons:
        longest = max((me.vertices[a].co - me.vertices[b].co).length for a, b in p.edge_keys)
        out[p.index] = p.area / max(longest, 1e-9) < SLIVER
    return out


# ------------------------------------------------------------ 1. arch UV atlas
for o in arch + ground:
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    me.uv_layers.new(name=UVN)
    for l in me.uv_layers:
        l.active_render = (l.name != UVN)       # UV0 stays the PBR maps' UV
    me.uv_layers.active = me.uv_layers[UVN]

parked = {}
sliver = {}
bvh = solid_bvh()
n_rule = n_buried = 0
for o in arch:
    m = parked_mask(o)
    n_rule += int(m.sum())
    b = buried_mask(o, bvh) & ~m
    n_buried += int(b.sum())
    m = m | b
    parked[o.name] = m
    sliver[o.name] = sliver_mask(o) & ~m
    o.data.polygons.foreach_set("select", (~(m | sliver[o.name])).astype(bool))
del bvh
log("parked faces %d by rule, %d buried, %d arrises set aside, of %d" % (
    n_rule, n_buried, sum(int(m.sum()) for m in sliver.values()), sum(len(o.data.polygons) for o in arch)))

# SEAMS, THEN UNWRAP - not smart_project. Smart projection groups faces by
# normal, so the upward faces of a string course become ONE island in the shape
# of the building's plan: a hollow rectangle 26 m across and 30 cm wide, whose
# empty middle the packer cannot use. Every band, cornice, soffit and slab did
# that, and the islands of the first working bake filled 17% of the square.
# Cutting every horizontal face free and every edge sharper than 40 degrees
# leaves the elevations as whole planar islands (holes for the windows, which
# the concave packer fills) and the rings as their straight runs.
for o in arch:
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.faces.ensure_lookup_table()
    horiz = {f.index for f in bm.faces if abs(f.normal.z) > 0.7}
    for e in bm.edges:
        lf = e.link_faces
        e.seam = (len(lf) != 2 or any(f.index in horiz for f in lf)
                  or lf[0].normal.angle(lf[1].normal, 0.0) > math.radians(40.0))
    bm.to_mesh(o.data)
    bm.free()
    o.data.polygons.foreach_set("select", (~(parked[o.name] | sliver[o.name])).astype(bool))
    o.data.update()

bpy.ops.object.select_all(action="DESELECT")
for o in arch:
    o.hide_set(False)
    o.select_set(True)
vl.objects.active = arch[0]
bpy.ops.object.mode_set(mode="EDIT")
bpy.context.tool_settings.mesh_select_mode = (False, False, True)
bpy.ops.uv.unwrap(method="CONFORMAL", margin=0.0)
bpy.ops.uv.average_islands_scale()
log("unwrap done")
bpy.ops.uv.pack_islands(rotate=True, rotate_method="CARDINAL", scale=True, merge_overlap=False,
                        margin_method="FRACTION", margin=0.0024, shape_method="CONCAVE")
bpy.ops.object.mode_set(mode="OBJECT")
log("pack_islands done")

for o in arch:
    me = o.data
    uv = me.uv_layers[UVN]
    n = len(me.loops)
    a = np.empty(n * 2, dtype=np.float32)
    uv.data.foreach_get("uv", a)
    a = a.reshape(-1, 2)
    a[:, 0] *= RESERVE
    # loops of parked faces go to the white strip (and the arrises with them,
    # until the bake is done and they can be laid on the faces they edge)
    m = parked[o.name] | sliver[o.name]
    if m.any():
        starts = np.empty(len(me.polygons), dtype=np.int32)
        totals = np.empty(len(me.polygons), dtype=np.int32)
        me.polygons.foreach_get("loop_start", starts)
        me.polygons.foreach_get("loop_total", totals)
        idx = np.concatenate([np.arange(s, s + t) for s, t in zip(starts[m], totals[m])])
        a[idx] = PARK_UV
    uv.data.foreach_set("uv", a.reshape(-1))
    me.polygons.foreach_set("select", np.zeros(len(me.polygons), dtype=bool))

# ------------------------------------------------------- 2. ground planar UV2
for o in ground:
    me = o.data
    nv = len(me.vertices)
    co = np.empty(nv * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    mw = np.array(o.matrix_world, dtype=np.float64)
    co = co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
    vi = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get("vertex_index", vi)
    uvs = np.stack([(co[vi, 0] - GX0) / (GX1 - GX0), (co[vi, 1] - GY0) / (GY1 - GY0)], axis=1)
    me.uv_layers[UVN].data.foreach_set("uv", uvs.astype(np.float32).reshape(-1))
log("ground planar UV2 on %d meshes" % len(ground))

# ---------------------------------------------------------------- 3. renderer
sc.render.engine = "CYCLES"
cy = sc.cycles
prefs = bpy.context.preferences.addons.get("cycles")
device = "CPU"
if prefs:
    cp = prefs.preferences
    for be in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            cp.compute_device_type = be
            cp.get_devices()
            if any(d.type == be for d in cp.devices):
                for d in cp.devices:
                    d.use = (d.type == be)
                cy.device = "GPU"
                device = be
                break
        except Exception:
            continue
log("device", device)
sc.render.use_simplify = True
cy.texture_limit_render = "1024"
cy.use_denoising = False
cy.use_adaptive_sampling = False
cy.max_bounces = 6
cy.diffuse_bounces = 3
cy.glossy_bounces = 1
cy.transmission_bounces = 4
cy.transparent_max_bounces = 32
bk = sc.render.bake
bk.margin = 16
bk.use_clear = True
bk.target = "IMAGE_TEXTURES"

hidden = []
for o in bpy.data.objects:
    if o.type == "LIGHT" or o.name in EMITTERS:
        if not o.hide_render:
            o.hide_render = True
            hidden.append(o)


def arm(mats, img):
    for m in mats:
        nt = m.node_tree
        n = nt.nodes.get("AO_BAKE_TARGET") or nt.nodes.new("ShaderNodeTexImage")
        n.name = n.label = "AO_BAKE_TARGET"
        n.image = img
        n.location = (-1400, 900)
        for nd in nt.nodes:
            nd.select = (nd.name == "AO_BAKE_TARGET")
        nt.nodes.active = nt.nodes["AO_BAKE_TARGET"]


def disarm(mats):
    for m in mats:
        n = m.node_tree.nodes.get("AO_BAKE_TARGET")
        if n is not None:
            m.node_tree.nodes.remove(n)


def pixels(img):
    a = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


# --------------------------------------------------------------- 4. arch bake
# The estate ships with no World at all (the web brings its own sky), and with
# no World Cycles gives AO an unbounded reach: every ray that ends in the tree
# belt a hundred metres away counts as occluded, and the whole atlas bakes to a
# grey that means nothing. The reach lives on the World, so a bake-only one is
# made and removed again.
world = sc.world
ao_world = bpy.data.worlds.new("AO_ARCH_WORLD")
ao_world.light_settings.distance = ARCH_REACH
sc.world = ao_world
log("ao reach", sc.world.light_settings.distance)

ground_shadow = [(o, o.visible_shadow) for o in ground]
for o in ground:
    o.visible_shadow = False

raw_a = bpy.data.images.new("AO_ARCH_RAW", ARCH_PX, ARCH_PX, alpha=True, float_buffer=True)
raw_a.colorspace_settings.name = "Non-Color"
arch_mats = []
for o in arch:
    for m in o.data.materials:
        if m is not None and m not in arch_mats:
            arch_mats.append(m)
arm(arch_mats, raw_a)
cy.samples = ARCH_SAMPLES
bk.use_selected_to_active = False
bpy.ops.object.select_all(action="DESELECT")
for o in arch:
    o.select_set(True)
vl.objects.active = arch[0]
bpy.ops.object.bake(type="AO", margin=16, use_clear=True)
disarm(arch_mats)
for o, v in ground_shadow:
    o.visible_shadow = v
sc.world = world
bpy.data.worlds.remove(ao_world)
log("arch bake done")

# ------------------------------------------------------------- 5. ground bake
white = bpy.data.worlds.new("AO_WHITE")
white.use_nodes = True
bgn = next(n for n in white.node_tree.nodes if n.type == "BACKGROUND")
bgn.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
bgn.inputs["Strength"].default_value = 1.0
sc.world = white

pm = bpy.data.meshes.new("AO_GROUND_PROBE")
z = -3.0
pm.from_pydata([(GX0, GY0, z), (GX1, GY0, z), (GX1, GY1, z), (GX0, GY1, z)], [], [(0, 1, 2, 3)])
puv = pm.uv_layers.new(name="UVMap")
for li, uv in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
    puv.data[li].uv = uv
probe = bpy.data.objects.new("AO_GROUND_PROBE", pm)
sc.collection.objects.link(probe)
pmat = bpy.data.materials.new("AO_GROUND_PROBE")
pmat.use_nodes = True
pm.materials.append(pmat)
for flag in ("visible_camera", "visible_diffuse", "visible_glossy",
             "visible_transmission", "visible_volume_scatter", "visible_shadow"):
    setattr(probe, flag, False)

raw_g = bpy.data.images.new("AO_GROUND_RAW", GROUND_PX, GROUND_PX, alpha=True, float_buffer=True)
raw_g.colorspace_settings.name = "Non-Color"
arm([pmat], raw_g)
cy.samples = GROUND_SAMPLES
bk.use_selected_to_active = True
bk.use_cage = False
bk.cage_extrusion = 40.0
bk.max_ray_distance = 0.0
bpy.ops.object.select_all(action="DESELECT")
for o in ground:
    o.select_set(True)
probe.select_set(True)
vl.objects.active = probe
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"},
                    use_selected_to_active=True, cage_extrusion=40.0,
                    margin=4, use_clear=True)
bk.use_selected_to_active = False
log("ground bake done")

px_g = pixels(raw_g)
bpy.data.objects.remove(probe, do_unlink=True)
bpy.data.meshes.remove(pm)
bpy.data.materials.remove(pmat)
sc.world = world
bpy.data.worlds.remove(white)
for o in hidden:
    o.hide_render = False


# ----------------------------------------------------------- 6. post-process
def oetf(v):
    v = np.clip(v, 0.0, 1.0)
    return np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(np.maximum(v, 1e-8), 1 / 2.4) - 0.055)


def fill_holes(v, hit, iters):
    """Grow valid texels into unbaked ones, so filtering at a boundary never
    reaches a cleared (black) texel."""
    v = np.where(hit, v, 0.0)
    w = hit.astype(np.float32)
    for _ in range(iters):
        if w.min() > 0:
            break
        s = np.zeros_like(v)
        c = np.zeros_like(w)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                s += np.roll(np.roll(v * w, dy, 0), dx, 1)
                c += np.roll(np.roll(w, dy, 0), dx, 1)
        grow = (w == 0) & (c > 0)
        v = np.where(grow, s / np.maximum(c, 1e-6), v)
        w = np.where(grow, 1.0, w)
    return np.where(w > 0, v, 1.0)


def blur(v, sigma):
    r = max(1, int(math.ceil(sigma * 3)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    out = np.zeros_like(v)
    for i, kv in enumerate(k):
        out += kv * np.roll(v, i - r, axis=1)
    v2 = np.zeros_like(v)
    for i, kv in enumerate(k):
        v2 += kv * np.roll(out, i - r, axis=0)
    return v2


def save(name, v, px):
    img = bpy.data.images.new(name, px, px, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    enc = oetf(v).astype(np.float32)
    rgba = np.empty((px, px, 4), dtype=np.float32)
    rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = enc
    rgba[..., 3] = 1.0
    img.pixels.foreach_set(rgba.reshape(-1))
    img.filepath_raw = os.path.join(WORK, name.lower() + ".png")
    img.file_format = "PNG"
    img.save()
    img.pack()
    return img


# arch: Cycles AO is already 0..1 visibility.
pa = pixels(raw_a)
ao_a = pa[..., 0].astype(np.float64)
# As baked, black and all: what an arris chooses its face by (place_arrises).
ao_baked = ao_a.copy()
# Pure black is a hole (see the header).
#
# AND SO IS ALL BUT BLACK. The threshold was 0.004, "under what 8 bits can
# hold", and a face that lies against another's (a coping block against the
# slab it is set in) bakes a hair over it: a ray or two in five hundred finds
# the crack. Those faces stood in the atlas at 14 of 255 beside stone in full
# light, and bled into it at every mip. A texel that has kept under a
# fiftieth of its sky is not a surface any camera reads: it is a hole, and is
# filled from beside like the rest.
BLACK = 0.02
hit_a = (pa[..., 3] > 0.5) & (ao_a > BLACK)
log("arch texels baked %.1f%%, of them pure black and filled from beside %.1f%%" % (
    100 * float((pa[..., 3] > 0.5).mean()),
    100 * float(((pa[..., 3] > 0.5) & (ao_a <= BLACK)).sum()) / max(1.0, float((pa[..., 3] > 0.5).sum()))))
ao_a = fill_holes(ao_a, hit_a, 24)
ao_a[:, int(ARCH_PX * (RESERVE + 0.003)):] = 1.0
cover = float(hit_a.mean())
lit = ao_a[hit_a]
log("arch coverage %.1f%%  ao p5 %.3f p50 %.3f p95 %.3f" % (
    100 * cover, np.percentile(lit, 5), np.percentile(lit, 50), np.percentile(lit, 95)))
img_a = save("AO_ARCH", ao_a, ARCH_PX)


def place_arrises(o, ao, px):
    """Give every arris the occlusion of the face it is cut on: its UVs are
    laid along the edge it shares with a baked face, INSET_PX inside that
    face's border (so it reads baked texels, not a margin), on whichever of
    its faces is the more open - a convex edge sees at least what its better
    face sees. The corner patches where three arrises meet take the corner of
    a neighbour. Returns (arrises, those with no face to lie on)."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    uvl = bm.loops.layers.uv[UVN]
    is_sliver, is_parked = sliver[o.name], parked[o.name]
    inset = INSET_PX / px
    deep = INSET_DEEP_PX / px
    todo = [f for f in bm.faces if is_sliver[f.index]]
    if not todo:
        bm.free()
        return 0, 0

    def baked(f):
        return not is_sliver[f.index] and not is_parked[f.index]

    def sample(uv):
        return float(ao[min(px - 1, max(0, int(uv.y * px))), min(px - 1, max(0, int(uv.x * px)))])

    cache = {}

    def uv_of(f):
        got = cache.get(f.index)
        if got is None:
            uvs = {l.vert.index: l[uvl].uv.copy() for l in f.loops}
            c = Vector((0.0, 0.0))
            for u in uvs.values():
                c += u
            got = cache[f.index] = (uvs, c / len(uvs))
        return got

    def along(f, a, b):
        uvs, c = uv_of(f)
        ua, ub = uvs[a.index], uvs[b.index]
        t = ub - ua
        length = t.length
        if length < 1e-9:
            return ua.copy(), ub.copy()
        t /= length
        nrm = Vector((-t.y, t.x))
        depth = nrm.dot(c - (ua + ub) * 0.5)
        if depth < 0:
            nrm, depth = -nrm, -depth
        off = nrm * min(max(inset, min(deep, 0.5 * depth)), 0.7 * depth)
        end = t * min(inset, 0.2 * length)
        return ua + off + end, ub + off - end

    placed = {}
    for f in todo:
        best = None
        for e in f.edges:
            for g in e.link_faces:
                if g is f or not baked(g):
                    continue
                a, b = e.verts
                ua, ub = along(g, a, b)
                val = (sample(ua) + sample((ua + ub) * 0.5) + sample(ub)) / 3.0
                if best is None or val > best[0]:
                    best = (val, a, b, ua, ub)
        if best is None:
            continue
        _val, a, b, ua, ub = best
        at = {}
        for l in f.loops:
            v = l.vert
            near_a = (v.co - a.co).length <= (v.co - b.co).length
            at[v.index] = ua if (v is a or (v is not b and near_a)) else ub
        placed[f.index] = at
    for _round in range(6):
        more = 0
        for f in todo:
            if f.index in placed:
                continue
            best = None
            for l in f.loops:
                v = l.vert
                for g in v.link_faces:
                    if g is f:
                        continue
                    if baked(g):
                        uvs, c = uv_of(g)
                        uv = uvs[v.index]
                        d = c - uv
                        if d.length > 1e-9:
                            uv = uv + d * (min(inset, 0.35 * d.length) / d.length)
                    elif g.index in placed:
                        uv = placed[g.index][v.index]
                    else:
                        continue
                    val = sample(uv)
                    if best is None or val > best[0]:
                        best = (val, uv)
            if best is not None:
                placed[f.index] = {l.vert.index: best[1] for l in f.loops}
                more += 1
        if not more:
            break
    lost = 0
    for f in todo:
        at = placed.get(f.index)
        if at is None:
            lost += 1
        for l in f.loops:
            l[uvl].uv = at[l.vert.index] if at else PARK_UV
    bm.to_mesh(me)
    bm.free()
    me.update()
    return len(todo), lost


n_arris = n_lost = 0
for o in arch:
    a_, l_ = place_arrises(o, ao_baked, ARCH_PX)
    n_arris += a_
    n_lost += l_
log("arrises laid on their faces %d, with none to lie on (parked white) %d" % (n_arris - n_lost, n_lost))

# ground: irradiance under a uniform sky, as a fraction of what open ground gets.
E = 0.2126 * px_g[..., 0] + 0.7152 * px_g[..., 1] + 0.0722 * px_g[..., 2]
hit_g = px_g[..., 3] > 0.5
# Normalised against the most open ground in the window, so a lawn that loses a
# tenth of its sky to the tree belt a hundred metres off reads 0.9, not 1.0 -
# the runtime's sky model assumes an open horizon, and this is the correction.
open_e = float(np.percentile(E[hit_g], 99))
ao_g = np.clip(E / max(open_e, 1e-6), 0.0, 1.0)
ao_g = fill_holes(ao_g, hit_g, 64)
ao_g = blur(ao_g, 1.1)
# The border ramps to white: outside the window the map clamps to its edge,
# and that edge must mean "open lawn".
edge = 24
ramp = np.clip(np.minimum.reduce([
    np.arange(GROUND_PX)[None, :].repeat(GROUND_PX, 0),
    np.arange(GROUND_PX)[::-1][None, :].repeat(GROUND_PX, 0),
    np.arange(GROUND_PX)[:, None].repeat(GROUND_PX, 1),
    np.arange(GROUND_PX)[::-1][:, None].repeat(GROUND_PX, 1),
]) / edge, 0.0, 1.0)
ao_g = 1.0 - (1.0 - ao_g) * ramp
log("ground coverage %.1f%%  open E %.4f  ao p5 %.3f p50 %.3f p95 %.3f" % (
    100 * hit_g.mean(), open_e, np.percentile(ao_g, 5), np.percentile(ao_g, 50), np.percentile(ao_g, 95)))
img_g = save("AO_GROUND", ao_g, GROUND_PX)
bpy.data.images.remove(raw_a)
bpy.data.images.remove(raw_g)


# ----------------------------------------------------------- 7. wire for glTF
def gltf_output_group():
    """The exporter reads the 'Occlusion' input of a group with this exact name
    (export_web_interior.py builds the same one for the hall)."""
    name = "glTF Material Output"
    g = bpy.data.node_groups.get(name)
    if g:
        return g
    g = bpy.data.node_groups.new(name, "ShaderNodeTree")
    for sock in ("Occlusion", "Thickness"):
        try:
            g.interface.new_socket(sock, in_out="INPUT", socket_type="NodeSocketFloat")
        except AttributeError:
            g.inputs.new("NodeSocketFloat", sock)
    g.nodes.new("NodeGroupInput")
    return g


grp = gltf_output_group()


def wire(objs_, img, suffix):
    made = {}
    for o in objs_:
        for i, m in enumerate(o.data.materials):
            if m is None:
                continue
            c = made.get(m.name)
            if c is None:
                c = m.copy()
                c.name = m.name + suffix
                nt = c.node_tree
                uvn = nt.nodes.new("ShaderNodeUVMap")
                uvn.uv_map = UVN
                uvn.location = (-1500, 700)
                tex = nt.nodes.new("ShaderNodeTexImage")
                tex.image = img
                tex.interpolation = "Linear"
                tex.extension = "EXTEND"
                tex.location = (-1300, 700)
                gn = nt.nodes.new("ShaderNodeGroup")
                gn.node_tree = grp
                gn.location = (-1000, 700)
                nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
                nt.links.new(tex.outputs["Color"], gn.inputs["Occlusion"])
                made[m.name] = c
            o.data.materials[i] = c
    return made


ma = wire(arch, img_a, "_AO")
mg = wire(ground, img_g, "_AOG")
log("materials arch=%s" % sorted(ma))
log("materials ground=%s" % sorted(mg))

bpy.ops.wm.save_as_mainfile(filepath=SAVE_AS, copy=False)
log("SAVED", SAVE_AS)
print("DONE")
