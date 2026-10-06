r"""
Re-bake the hall's light ON ITS EXISTING LAYOUT, one family of light a colour
channel.

STATUS, 2026-10-06: NOT WHAT SHIPS. The pooled evening this was written to
make was built, shown to the client and sent back the next day ("make the
rooms brighter like before the client disliked darkness"): the hall ships
the lightmap of rebake_hall_lightmap_v7.py again, at its old intensity. The
script is kept because the separation is sound and a re-balance costs two
minutes with it; do not ship a darker room from it on anyone's word but
the client's.

    blender --background mansion_web_V7REF.blend --python rebake_hall_split_v7.py \
        -- <outdir> <A|B> [samples] [atlas_px] [texture_limit_px]

WHY IT EXISTS (the audit of 2026-10-05, P0: "the hall and gallery feel like one
room on one evening, with rich darks and warm light pools ... each board is lit
so it stands out from a quieter wall"). The room was baked as two families of
light (rebake_hall_lightmap_v7.py: the lamps; the windows), and "the lamps" is
three lights of very different character under one weight: a chandelier and an
area key by the entry of 2,189 and 1,470 W, which between them lay an even
cream wash on every wall, and twelve sconces of 16 W each, whose pools the
wash drowns. No balance of TWO passes makes pools: the wash and the pools are
in the same pass.

So each family is its own image — but an image is three channels, and a bake
is the better part of an hour whatever it carries (284 objects each pay a
scene sync). Light does not change colour channel on a bounce: red stays red.
So three families go into ONE bake, each lit in a pure primary, and the bake's
red, green and blue ARE the three families' irradiance, apart:

    A   red    the chandelier (and its glass)
        green  the area key by the entry
        blue   the sconces (and their flames)
    B   red    the portrait's spot and its picture light
        green  the stair's wash
        blue   the sky: the oculus, the windows, their panes, the world

Each is finished alone and given its own light's colour back in the mix
(tools/gltf/mix_hall_groups.py). What is given up is the tint a bounce takes
from the surface it leaves, which now comes from one channel of that surface's
colour for all three: in a room of ivory plaster and grey stone, under a per
cent of hue.

AND THE WALNUT SLABS ARE OUT OF IT. The wall panels (wallpanel_*) are boxes
0.4 m deep standing in front of the pilasters, wider than their bays; the
audit: "some read as flat boards leaned against the wall". The film builds the
panelling it should have been at runtime (hallBoiserie.ts), thin, between the
pilasters, and lights each panel with THE WALL'S OWN TEXELS BEHIND IT — which
therefore have to be lit as open wall, not baked black behind a slab, and the
shafts beside them not shadowed by one. The holograms are out too: the
stations are site models, and their projectors' glow is not part of the room.

Writes <outdir>/lightmap_raw.npy (float16, top-down). The room's normals do
not change: the finish takes them from the reference pass
(C:/dev/Blender/_v7ref_lamps/normal_raw.npy).

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
SPLIT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 384
PX = int(argv[3]) if len(argv) > 3 else 4096
TEXTURE_LIMIT = argv[4] if len(argv) > 4 else "2048"
os.makedirs(OUT, exist_ok=True)

RED, GREEN, BLUE = (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)
# family: (channel, light name prefixes, emitter material names, world?)
SPLITS = {
    "A": {
        "chandelier": (RED, ("LGT_chandelier",), ("Glass_Clear_Fog.001",), False),
        "entry": (GREEN, ("LGT_entry_key",), (), False),
        "sconces": (BLUE, ("LGT_sconce_",), ("MAT_SconceFlame",), False),
    },
    "B": {
        "portrait": (RED, ("LGT_portrait",), ("MAT_PicLight",), False),
        "stair": (GREEN, ("LGT_stair_wash",), (), False),
        "sky": (BLUE, ("LGT_win_", "LGT_oculus"), ("MAT_Clerestory", "MAT_OculusSky", "MAT_Window_Interior"), True),
    },
}
FAMILIES = SPLITS[SPLIT]

sc = bpy.context.scene
vl = bpy.context.view_layer

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
print("SHELL|objects=%d" % len(shell), flush=True)

# ── out of the room: the slabs and the holograms ────────────────────────────
OUT_OF_ROOM = ("wallpanel", "holo3d_", "holobeam_", "projector_", "projlens_")
gone = 0
for o in bpy.data.objects:
    if o.name.startswith(OUT_OF_ROOM) and not o.hide_render:
        o.hide_render = True
        gone += 1
print("PREP|%d slabs and hologram parts out of the room" % gone, flush=True)


def emission(material, colour):
    """Set a material's emission to `colour` (a pure primary), or put it out
    (None). Strength is kept; a texture feeding the colour is unplugged."""
    nt = material.node_tree
    if not nt:
        return
    for n in nt.nodes:
        if n.type == "BSDF_PRINCIPLED":
            if colour is None:
                n.inputs["Emission Strength"].default_value = 0.0
            else:
                sock = n.inputs["Emission Color"]
                for l in list(sock.links):
                    nt.links.remove(l)
                sock.default_value = (*colour, 1.0)
        elif n.type == "EMISSION":
            if colour is None:
                n.inputs["Strength"].default_value = 0.0
            else:
                sock = n.inputs["Color"]
                for l in list(sock.links):
                    nt.links.remove(l)
                sock.default_value = (*colour, 1.0)


lit, off = [], 0
for o in bpy.data.objects:
    if o.type != "LIGHT":
        continue
    family = next((k for k, f in FAMILIES.items() if o.name.startswith(f[1])), None)
    if family is None or o.data.type == "SUN" or o.hide_render:
        if not o.hide_render:
            off += 1
        o.hide_render = True
        continue
    # Each light is its own datablock or shares one: either way the colour is
    # the datablock's, and every user of it is in the same family.
    o.data.color = FAMILIES[family][0]
    lit.append("%s>%s" % (o.name, family))
print("LIGHTS|%d lit, %d put out: %s" % (len(lit), off, ", ".join(lit)), flush=True)

emitters = {m: f[0] for f in FAMILIES.values() for m in f[2]}
on_m, off_m = 0, 0
for m in bpy.data.materials:
    if m.name in emitters:
        emission(m, emitters[m.name])
        on_m += 1
    else:
        emission(m, None)
        off_m += 1
print("EMITTERS|%d lit, %d put out" % (on_m, off_m), flush=True)

world_family = next((f for f in FAMILIES.values() if f[3]), None)
bg = sc.world.node_tree.nodes.get("Background") if sc.world and sc.world.node_tree else None
if bg:
    c = bg.inputs["Color"].default_value
    luma = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    for l in list(bg.inputs["Color"].links):
        sc.world.node_tree.links.remove(l)
    if world_family:
        bg.inputs["Color"].default_value = (*(luma * v for v in world_family[0]), 1.0)
    else:
        bg.inputs["Strength"].default_value = 0.0
    print("WORLD|%s" % ("in " + SPLIT if world_family else "out"), flush=True)

for o in shell:
    me = o.data
    me.uv_layers.active = me.uv_layers["UVLightmap"]
    for l in me.uv_layers:
        l.active_render = (l.name != "UVLightmap")   # UV0 keeps the PBR maps


def target(name):
    img = bpy.data.images.get(name)
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, PX, PX, alpha=False, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    return img


mats = []
for o in shell:
    for m in o.data.materials:
        if m and m not in mats:
            mats.append(m)


def arm(img):
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
                print("DEVICE|%s" % be, flush=True)
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

if os.environ.get("DRY"):
    print("DRY|ready to bake %d materials" % len(mats), flush=True)
    sys.exit(0)

lm = target("LIGHTMAP_SPLIT")
arm(lm)
t0 = time.time()
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=16, use_clear=True)
t_lm = time.time() - t0
flat = np.empty(len(lm.pixels), dtype=np.float32)
lm.pixels.foreach_get(flat)
arr = flat.reshape(PX, PX, 4)[::-1, :, :3].astype(np.float16)
np.save(os.path.join(OUT, "lightmap_raw.npy"), arr)
print("BAKE|irradiance|%.0fs" % t_lm, flush=True)

rgb = arr.astype(np.float32)
report = {
    "atlas_px": PX, "samples": SAMPLES, "bake_seconds": round(t_lm, 1), "shell_objects": len(shell),
    "split": SPLIT,
    "families": {k: "RGB"[f[0].index(1.0)] for k, f in FAMILIES.items()},
    "p99_5_raw": [float(np.percentile(rgb[..., c][rgb[..., c] > 1e-4], 99.5)) if (rgb[..., c] > 1e-4).any() else 0.0 for c in range(3)],
}
json.dump(report, open(os.path.join(OUT, "rebake_manifest.json"), "w"), indent=1)
print("REPORT|%s" % json.dumps(report), flush=True)
print("DONE", flush=True)
