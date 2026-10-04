r"""
Re-bake the extended hall's lightmap ON ITS EXISTING LAYOUT.

    blender --background mansion_web_V7HALL.blend --python rebake_hall_lightmap_v7.py \
        -- <outdir> [samples] [atlas_px] [texture_limit_px]

A drop-in replacement for the atlas inside interior_hall.glb (image 3, the
occlusion slot): the UVLightmap layer that bake_lightmap.py packed and saved
into this blend is the one the GLB's TEXCOORD_1 was exported from, so baking
onto it again changes the light and nothing else. No re-unwrap, no re-export.

WHY IT EXISTS. The shipped atlas was baked at 512 samples under a 1500 s time
limit and never denoised (Cycles does not denoise bakes; the `use_denoising`
flag in bake_lightmap.py only applies to renders). Measured on a flat wall of
the shipped atlas: 4.7% per-texel Monte Carlo grain, which ETC1S then
quantised into 4x4 blocks with pink and green chroma shifts. In the room it
read as damp, dirty plaster on every wall.

This bakes the same lighting with more samples and no time limit, and writes
the RAW float irradiance plus an object-space normal pass as .npy. Denoising
(OIDN, with the normals as its guide), dilation, normalisation and encoding
happen outside Blender in tools/gltf/finish_hall_lightmap.py, so they can be
re-run and tuned without paying for the bake again.

Never saves the blend.
"""
import json
import os
import sys
import time

import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
SAMPLES = int(argv[1]) if len(argv) > 1 else 1024
PX = int(argv[2]) if len(argv) > 2 else 4096
TEXTURE_LIMIT = argv[3] if len(argv) > 3 else "2048"
# WHICH LIGHT (the refinement brief, 2026-10-03). 'all' is the room as it is
# lit. 'lamps' and 'sky' bake its two families apart — the chandelier, the
# sconces and the room's washes; and the windows and the oculus — so their
# balance can be set afterwards, in the sum, without baking again: each is
# finished on its own (tools/gltf/finish_hall_lightmap.py --save-float) and the
# two are mixed by tools/gltf/mix_hall_passes.py. Light adds: the two passes
# summed are the one pass, to the noise. 'normals' bakes the denoiser's guide
# alone.
GROUP = argv[4] if len(argv) > 4 else "all"
SKY_LIGHTS = ("LGT_win_", "LGT_oculus")
SKY_EMITTERS = ("MAT_Clerestory", "MAT_OculusSky")
os.makedirs(OUT, exist_ok=True)

sc = bpy.context.scene
vl = bpy.context.view_layer

# The shell, selected exactly as bake_lightmap.py selected it, so the set of
# objects sharing the atlas is the set that was unwrapped into it.
PROP = ("KIT_capital", "KIT_cornice", "KIT_panel", "KIT_tympanum", "INT_HAZE",
        "chandelier_", "sconce_", "piclight_", "holo3d_", "holobeam_",
        "projector_", "projlens_", "portrait_", "dress_", "table_client")
INSTANCED = {"KIT_baluster_hi_M", "KIT_newel_hi_M", "KIT_column_M.001",
             "KIT_anth_M", "Box001", "dress_urn_master_M"}

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
    if o.data.name in INSTANCED or not o.data.polygons:
        continue
    shell.append(o)
missing = [o.name for o in shell if not o.data.uv_layers.get("UVLightmap")]
if missing:
    raise RuntimeError("no UVLightmap on %d shell objects (e.g. %s): this blend is not the baked one"
                       % (len(missing), ", ".join(missing[:5])))
print("SHELL|objects=%d" % len(shell))


def emission_off(material):
    nt = material.node_tree
    if not nt:
        return
    for n in nt.nodes:
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Emission Strength"].default_value = 0.0
        elif n.type == "EMISSION":
            n.inputs["Strength"].default_value = 0.0


# 'normals' is the room without its light pass: the denoiser's guide alone, for a
# bake whose light was saved and whose normals were not (the two do not depend
# on each other, and each is the better part of an hour).
if GROUP not in ("all", "normals"):
    off_lights = 0
    for o in bpy.data.objects:
        if o.type != "LIGHT":
            continue
        sky = o.name.startswith(SKY_LIGHTS)
        # The exterior's sun is no part of the room's light in either pass.
        if o.data.type == "SUN" or (GROUP == "lamps" and sky) or (GROUP == "sky" and not sky):
            o.hide_render = True
            off_lights += 1
    off_mats = 0
    # Every emitter that is not the sky is a lamp: the chandelier's glass, the
    # sconces' flames, the picture light, the holograms.
    for m in bpy.data.materials:
        if m.name.startswith(SKY_EMITTERS) == (GROUP == "lamps"):
            emission_off(m)
            off_mats += 1
    print("GROUP|%s: %d lights and %d emitters put out" % (GROUP, off_lights, off_mats))

for o in shell:
    me = o.data
    me.uv_layers.active = me.uv_layers["UVLightmap"]
    for l in me.uv_layers:
        l.active_render = (l.name != "UVLightmap")   # UV0 keeps the PBR maps


def target(name, float_buffer=True):
    img = bpy.data.images.get(name)
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, PX, PX, alpha=False, float_buffer=float_buffer)
    img.colorspace_settings.name = 'Non-Color'
    return img


mats = []
for o in shell:
    for m in o.data.materials:
        if m and m not in mats:
            mats.append(m)


def arm(img):
    """Point every shell material's BAKE_TARGET node at `img`, selected and
    active by NAME (see bake_lightmap.py for why identity does not work)."""
    bad = []
    for m in mats:
        nt = m.node_tree
        n = nt.nodes.get("BAKE_TARGET") or nt.nodes.new('ShaderNodeTexImage')
        n.name = "BAKE_TARGET"
        n.label = "BAKE_TARGET"
        n.image = img
        n.location = (-900, 600)
        nt.nodes.active = n
        for nd in nt.nodes:
            nd.select = (nd.name == "BAKE_TARGET")
        a = nt.nodes.active
        if not (a and a.name == "BAKE_TARGET" and nt.nodes["BAKE_TARGET"].select):
            bad.append(m.name)
    if bad:
        raise RuntimeError("bake target not armed on: %s" % ", ".join(bad[:10]))


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

if TEXTURE_LIMIT and TEXTURE_LIMIT != "0":
    sc.render.use_simplify = True
    cy.texture_limit_render = TEXTURE_LIMIT

cy.samples = SAMPLES
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.004
cy.time_limit = 0.0
cy.max_bounces = 12
cy.diffuse_bounces = 4
cy.glossy_bounces = 4
cy.transmission_bounces = 8
cy.transparent_max_bounces = 16
# Fireflies from the sconce flames and the chandelier's glass are the one
# noise the denoiser cannot tell from detail; clamp indirect only, so direct
# light and its falloff stay exact.
cy.sample_clamp_direct = 0.0
cy.sample_clamp_indirect = 8.0

haze = bpy.data.objects.get("INT_HAZE")
if haze:
    haze.hide_render = True

bpy.ops.object.select_all(action='DESELECT')
for o in shell:
    o.hide_set(False)
    o.select_set(True)
vl.objects.active = shell[0]

bk = sc.render.bake
bk.use_selected_to_active = False
bk.margin = 16
bk.use_clear = True


def dump(img, name):
    flat = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(flat)
    # Blender's image rows run bottom-up; store top-down like every image file.
    arr = flat.reshape(PX, PX, 4)[::-1, :, :3].astype(np.float16)
    path = os.path.join(OUT, name)
    np.save(path, arr)
    return path, arr


# 1. Irradiance: direct + indirect diffuse, no colour (albedo stays in the maps).
lm_arr = None
t_lm = 0.0
if GROUP == "normals":
    print("BAKE|irradiance|skipped: normals only")
else:
    lm = target("LIGHTMAP_REBAKE")
    arm(lm)
    t0 = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=16, use_clear=True)
    t_lm = time.time() - t0
    lm_path, lm_arr = dump(lm, "lightmap_raw.npy")
    print("BAKE|irradiance|%.0fs|%s" % (t_lm, lm_path), flush=True)

# 2. Object-space normals, the denoiser's guide. No light transport involved,
#    so a handful of samples is exact.
#
#    NOT FOR THE SKY PASS. The normals are the room's, not the light's, and the
#    sky pass is finished with the lamps' set (finish_hall_lightmap.py
#    --normals <lamps_dir>/normal_raw.npy). The pass is not cheap either: 284
#    objects each pay for their own scene sync, MEASURED 36 minutes for eight
#    samples.
if GROUP == "sky":
    print("BAKE|normal|skipped: the lamps pass carries the room's normals")
else:
    nm = target("NORMAL_REBAKE")
    arm(nm)
    cy.samples = 8
    cy.use_adaptive_sampling = False
    t0 = time.time()
    bpy.ops.object.bake(type='NORMAL', normal_space='OBJECT', margin=16, use_clear=True)
    nm_path, _ = dump(nm, "normal_raw.npy")
    print("BAKE|normal|%.0fs|%s" % (time.time() - t0, nm_path))

for m in mats:
    n = m.node_tree.nodes.get("BAKE_TARGET")
    if n:
        m.node_tree.nodes.remove(n)
if haze:
    haze.hide_render = False

if lm_arr is None:
    print("DONE")
    sys.exit(0)
rgb = lm_arr.astype(np.float32)
lit = rgb[rgb.max(axis=2) > 1e-4]
report = {
    "atlas_px": PX,
    "samples": SAMPLES,
    "adaptive_threshold": 0.004,
    "clamp_indirect": 8.0,
    "bake_seconds": round(t_lm, 1),
    "shell_objects": len(shell),
    "group": GROUP,
    "p99_5_raw": float(np.percentile(lit, 99.5)) if lit.size else None,
}
json.dump(report, open(os.path.join(OUT, "rebake_manifest.json"), "w"), indent=1)
print("REPORT|%s" % json.dumps(report))
print("DONE")
