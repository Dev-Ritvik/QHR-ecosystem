"""
Decimate to a web budget, build a lightmap UV set, and bake interior GI.

Reads mansion_exterior.blend and writes mansion_web.blend plus a lightmap
atlas. It NEVER saves over the source file.

Three things worth knowing before changing any of this:

  * The heavy repeats are already instanced - 153 anthemions, 54 balusters and
    11 capitals each share ONE mesh datablock. Unique geometry is ~519k tris
    even though 2.01M get drawn. So decimation is applied to the DATABLOCK and
    multiplies through every instance; decimating per object would do the same
    work dozens of times and break the sharing.

  * Instanced geometry cannot carry a lightmap, because a lightmap needs UVs
    unique to each placement. So the shell (floor, walls, ceiling, coffers,
    cornice, stairs - all unique datablocks, only ~48k tris) gets baked GI, and
    the repeated ornament keeps its instancing and is lit at runtime. Trying to
    lightmap the ornament would cost the instancing and inflate the file.

  * GI routinely exceeds 1.0 and PNG cannot store that. The atlas is normalised
    by its own high percentile and the divisor is written to the manifest, to be
    fed back as lightMapIntensity. Clipping instead would flatten every hotspot.

    blender --background mansion_exterior.blend --python bake_lightmap.py \
        -- <outdir> [atlas_px] [samples] [seconds]
"""
import bpy, bmesh, sys, os, json, math

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
PX = int(argv[1]) if len(argv) > 1 else 4096
SAMPLES = int(argv[2]) if len(argv) > 2 else 512
TL = float(argv[3]) if len(argv) > 3 else 1800.0
os.makedirs(OUT, exist_ok=True)

sc = bpy.context.scene
vl = bpy.context.view_layer

# Props and fixtures: excluded from the lightmap. Emitters must not receive a
# baked diffuse pass, and the hidden KIT_ masters must not be exported at all.
PROP = ("KIT_capital", "KIT_cornice", "KIT_panel", "KIT_tympanum", "INT_HAZE",
        "chandelier_", "sconce_", "piclight_", "holo3d_", "holobeam_",
        "projector_", "projlens_", "portrait_", "dress_", "table_client")
# Shared datablocks - instanced, therefore never lightmapped.
INSTANCED = {"KIT_baluster_hi_M", "KIT_newel_hi_M", "KIT_column_M.001",
             "KIT_anth_M", "Box001", "dress_urn_master_M"}

# datablock -> target triangle count. Ratios are deliberately conservative on
# carved organic geometry, which shatters below roughly 20 percent, and on the
# chandelier, whose thousands of small glass islands need a much higher floor
# than a solid surface would.
BUDGET = {
    "KIT_column_M.001": 10000,          # capital, drawn 11x
    "KIT_newel_hi_M": 6000,             # newel, drawn 6x
    "KIT_baluster_hi_M": 1200,          # drawn 54x
    "KIT_anth_M": 800,                  # drawn 153x
    "ceiling_rosette_M.001": 9000,
    "786242_Ampollo_Osgona_Glass_Clear_Fog_0.002": 62000,   # chandelier
    "dress_urn_master_M": 7000,
    "dress_bench_M": 7000,
    "Object_0.001": 6000,               # client table
}


def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def decimate_data(name, target):
    """Decimate a mesh datablock in place, keeping every instance pointing at
    it. Applying the modifier per object would unshare the data."""
    me = bpy.data.meshes.get(name)
    if me is None:
        return None
    cur = tris(me)
    if cur <= target:
        return (name, cur, cur, 1.0)
    users = [o for o in bpy.data.objects if o.type == 'MESH' and o.data is me]
    if not users:
        return None
    # The depsgraph only evaluates modifiers on objects it actually visits, so
    # a hidden object silently returns its ORIGINAL mesh and the decimation is
    # a no-op that still reports success. Unhide for the evaluation.
    ob = users[0]
    was = (ob.hide_viewport, ob.hide_render)
    ob.hide_viewport = False
    ob.hide_render = False
    bpy.context.view_layer.update()
    ratio = max(0.02, float(target) / cur)
    mod = ob.modifiers.new("dec_tmp", 'DECIMATE')
    mod.ratio = ratio
    dg = bpy.context.evaluated_depsgraph_get()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.remove(mod)
    new.name = name + "_dec"
    for o in users:
        o.data = new
    bpy.data.meshes.remove(me)
    new.name = name
    ob.hide_viewport, ob.hide_render = was
    return (name, cur, tris(new), ratio)


# ------------------------------------------------------------------ 1. budget
report = {"decimated": []}
for name, target in BUDGET.items():
    r = decimate_data(name, target)
    if r:
        report["decimated"].append(r)
        print("DEC|%s|%d->%d|ratio=%.3f" % r)

lc = {c.name: c for c in vl.layer_collection.children}
if "COL_Exterior" in lc:
    lc["COL_Exterior"].exclude = True
if "W_Interior" in bpy.data.worlds:
    sc.world = bpy.data.worlds["W_Interior"]
vl.update()

interior = bpy.data.collections["COL_Interior"]
shell = []
for o in interior.all_objects:
    if o.type != 'MESH' or o.hide_render:
        continue
    if any(o.name.startswith(p) for p in PROP):
        continue
    if o.data.name in INSTANCED:
        continue
    if not o.data.polygons:
        continue
    shell.append(o)
print("SHELL|objects=%d|tris=%d" % (len(shell), sum(tris(o.data) for o in shell)))

# ------------------------------------------------------- 2. lightmap UV layer
for o in shell:
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.get("UVLightmap") or me.uv_layers.new(name="UVLightmap")
    me.uv_layers.active = uv
    for i, l in enumerate(me.uv_layers):
        l.active_render = (l.name != "UVLightmap")   # keep UV0 for the PBR maps

bpy.ops.object.select_all(action='DESELECT')
for o in shell:
    o.hide_set(False)
    o.select_set(True)
vl.objects.active = shell[0]

# Multi-object edit mode makes smart_project pack every selected object into
# ONE shared 0-1 space, which is what an atlas needs. Per-object unwrapping
# would give each mesh the whole square and they would all overlap.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
try:
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.0,
                             area_weight=1.0, correct_aspect=True,
                             scale_to_bounds=False)
except TypeError:
    bpy.ops.uv.smart_project(island_margin=0.0)

# smart_project's own packer leaves a lot of the square empty on a set like
# this - 147 objects of cornice and moulding produce mostly thin slivers.
# Repacking with the concave shape method nests them properly and buys back a
# large fraction of the atlas.
try:
    bpy.ops.uv.pack_islands(rotate=True, scale=True, merge_overlap=False,
                            margin_method='SCALED', margin=0.0025,
                            shape_method='CONCAVE')
except TypeError:
    bpy.ops.uv.pack_islands(rotate=True, margin=0.0025)
bpy.ops.object.mode_set(mode='OBJECT')
print("UV|packed")

# --------------------------------------------------------------- 3. bake target
img = bpy.data.images.get("LIGHTMAP")
if img:
    bpy.data.images.remove(img)
img = bpy.data.images.new("LIGHTMAP", PX, PX, alpha=False, float_buffer=True)
img.colorspace_settings.name = 'Non-Color'

mats = []
for o in shell:
    for m in o.data.materials:
        if m and m not in mats:
            mats.append(m)
bad = []
for m in mats:
    nt = m.node_tree
    n = nt.nodes.get("BAKE_TARGET") or nt.nodes.new('ShaderNodeTexImage')
    n.name = "BAKE_TARGET"
    n.label = "BAKE_TARGET"
    n.image = img
    n.location = (-900, 600)
    nt.nodes.active = n
    # Select by NAME, not by identity. Creating a node and touching the tree
    # invalidates the Python pointer returned by nodes.new(), so `nd is n`
    # matches nothing and the bake target ends up unselected - which Cycles
    # reports only as "no active and selected image texture node", after the
    # whole bake has run and produced a black atlas.
    for nd in nt.nodes:
        nd.select = (nd.name == "BAKE_TARGET")
    a = nt.nodes.active
    if not (a and a.name == "BAKE_TARGET" and nt.nodes["BAKE_TARGET"].select):
        bad.append(m.name)
print("BAKE|materials=%d|unarmed=%d" % (len(mats), len(bad)))
if bad:
    raise RuntimeError("bake target not armed on: %s" % ", ".join(bad[:10]))

# ------------------------------------------------------------------- 4. bake
sc.render.engine = 'CYCLES'
cy = sc.cycles
prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    cp = prefs.preferences
    for be in ('OPTIX', 'CUDA', 'HIP'):
        try:
            cp.compute_device_type = be
            cp.get_devices()
            if any(d.type == be for d in cp.devices):
                for d in cp.devices:
                    d.use = (d.type == be)
                cy.device = 'GPU'
                print("DEVICE|%s" % be)
                break
        except Exception:
            continue

cy.samples = SAMPLES
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.01
cy.time_limit = TL
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_use_gpu = True
except Exception:
    pass
cy.max_bounces = 12
cy.diffuse_bounces = 4        # a lightmap wants the bounce light the beauty
cy.glossy_bounces = 4         # render deliberately clips for contrast
cy.transmission_bounces = 8
cy.transparent_max_bounces = 16

bk = sc.render.bake
bk.use_selected_to_active = False
bk.margin = 8
bk.use_clear = True
bk.use_pass_direct = True
bk.use_pass_indirect = True
bk.use_pass_color = False      # lighting only - albedo stays in the base map

haze = bpy.data.objects.get("INT_HAZE")
if haze:
    haze.hide_render = True    # volumetrics do not belong in a surface bake

bpy.ops.object.select_all(action='DESELECT')
for o in shell:
    o.select_set(True)
vl.objects.active = shell[0]
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'},
                    margin=8, use_clear=True)
print("BAKE|done")
if haze:
    haze.hide_render = False

# --------------------------------------------------------- 5. normalise + save
import numpy as np
px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
rgb = px[:, :3]
lit = rgb[rgb.max(axis=1) > 1e-4]
scale = float(np.percentile(lit, 99.5)) if lit.size else 1.0
scale = max(scale, 1e-3)
v = np.clip(rgb / scale, 0.0, 1.0)

# Encode sRGB by hand and leave the image Non-Color, so Blender writes these
# numbers verbatim. Two reasons:
#   * Precision. A hall with sconces has a wide range; normalised against the
#     99.5th percentile the ROOM sits near 0.05, which in LINEAR 8-bit is about
#     value 13 and bands badly. The sRGB curve puts it near 60.
#   * Assigning colorspace_settings.name after writing img.pixels invalidates
#     the buffer and saves a black file. Doing the transfer function here
#     avoids depending on when Blender decides to re-evaluate the image.
# three.js reads it back with SRGBColorSpace and linearises for free.
px[:, :3] = np.where(v <= 0.0031308, v * 12.92,
                     1.055 * np.power(np.maximum(v, 1e-8), 1.0 / 2.4) - 0.055)
img.pixels = px.reshape(-1).tolist()

img.filepath_raw = os.path.join(OUT, "lightmap.png")
img.file_format = 'PNG'
img.save()
print("LIGHTMAP|%s|scale=%.4f" % (img.filepath_raw, scale))

for m in mats:
    n = m.node_tree.nodes.get("BAKE_TARGET")
    if n:
        m.node_tree.nodes.remove(n)

report.update({
    "atlas_px": PX,
    "lightmap_scale": round(scale, 5),
    "shell_objects": [o.name for o in shell],
    "shell_tris": sum(tris(o.data) for o in shell),
    "drawn_tris": sum(tris(o.data) for o in interior.all_objects
                      if o.type == 'MESH' and not o.hide_render),
})
json.dump(report, open(os.path.join(OUT, "lightmap_manifest.json"), "w"), indent=1)

bpy.ops.wm.save_as_mainfile(filepath=r"C:\dev\Blender\mansion_web.blend",
                            copy=False)
print("SAVED|mansion_web.blend|drawn_tris=%d" % report["drawn_tris"])
print("DONE")
