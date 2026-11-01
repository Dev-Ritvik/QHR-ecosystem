r"""
Bake the estate's bounced light, run after bake_estate_ao_v7.py on the same file.

    blender --background mansion_estate_V7.blend --python bake_estate_gi_v7.py \
        -- <workdir> [px] [samples] [vertex_samples]

THE BRIEF (2026-11-01): "switch from real-time lighting to baked global illumination
... so every balustrade, window arch, cornice and tree base has soft, photorealistic
shadow depth", and a lighting toggle "using blended lightmaps". The site's sun stays
real-time: its shadow is sharp, it follows the film's hour, and a 4 cm atlas would
cost more than the map it replaced. What no real-time light here knows is everything
the sun does NOT reach: the warm glow a lit lawn throws up a shaded wall, the sky lost
to a tree thirty metres away, the lamps on the stone at night. That is baked, as three
quantities the runtime mixes by the hour (exteriorGI.ts), so that one map serves every
hour and every hour between:

  R  BOUNCE: the sun's light after its first hit (Cycles' indirect diffuse under a sun
     of 1 W/m2 along DAY_SUN and a black world), as a share of the sun's own irradiance,
     stored over GI_BOUNCE_RANGE. The runtime multiplies it by the key light as it is
     now, so it goes down with the sun.
  G  LAMPS: what the windows, lanterns, bollards and lamps put on the estate with
     everything else off, over a measured scale. The runtime multiplies it by lampsOn.
  B  THE REST OF THE SKY: what the occlusion map (6 m, the ground not an occluder) does
     not know: the sky lost to anything further off, and what comes back from the stone
     round a corner. A ratio, E / (E_open * occlusion), stored over 1.25. On the ground
     map, whose occlusion is already the whole sky, it is 1.

Two atlases, on the UV2 the occlusion bake laid: gi_arch.png, gi_ground.png. The third
kind of surface has no UV2, and is the one the brief names first: balusters, window
trim, dentils, the portico's mouldings, thousands of tiny faces (bake_estate_ao_v7.py,
"the atlas is for surfaces, not ornament"). Those are baked PER CORNER, into the colour
attribute the exporter writes as COLOR_0, as (1 - occlusion, sqrt(bounce), sqrt(lamps)):
zero means open and unlit, so a mesh that has none reads as it always did. A vertex is
as fine as ornament needs: nothing on a baluster is smaller than its own mouldings.

Cycles never denoises a bake: each channel is smoothed by a normalised Gaussian that
stays inside the baked islands, which is enough for light this low in frequency.
"""
import json
import math
import os
import sys
import time

import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
WORK = argv[0]
PX = int(argv[1]) if len(argv) > 1 else 2048
SAMPLES = int(argv[2]) if len(argv) > 2 else 256
V_SAMPLES = int(argv[3]) if len(argv) > 3 else 192
os.makedirs(WORK, exist_ok=True)
T0 = time.time()


def log(*a):
    print("GI|%6.1fs|" % (time.time() - T0) + " ".join(str(x) for x in a), flush=True)


UVN = "UVLightmap"
ARCH = [
    "mansion_walls", "mansion_bands", "mansion_quoins", "mansion_pediments",
    "mansion_roof", "portico_steps", "podium_walls",
    "garden_steps", "fountain_stone", "canal_stone", "pool_coping", "pool_terrace",
]
GROUND = [
    "ground_plane", "drive_forecourt", "terrace_upper", "parterre_gravel",
    "garden_beds", "podium_beds", "helipad_deck", "hardscape_kerbs", "parterre_kerb", "drive_setts",
]
GX0, GX1, GY0, GY1 = -108.0, 108.0, -124.0, 92.0
# The ornament, by the mesh. Everything of the stone that has no UV2 and is near enough
# to read; the far wall is here too, for its piers.
ORNAMENT = [
    "mansion_parapet", "mansion_window_trim", "mansion_dentils", "mansion_acroteria", "mansion_roof_kerb",
    "portico_trim", "podium_balustrade", "lion_frieze", "garden_planters", "parterre_urn", "pergola_stone", "estate_wall",
]
# DAY_SUN (softSunShadows.ts), three's (86, 25, 50) in Blender's axes.
SUN_DIR = np.array([86.0, -50.0, 25.0])
SUN_DIR = SUN_DIR / np.linalg.norm(SUN_DIR)
GI_BOUNCE_RANGE = 0.25
GROUND_ALBEDO = 0.2
ARCH_REACH = 6.0
EMITTERS = ("estate_lamps", "pool_lights", "helipad_lights", "mansion_window_back")

sc = bpy.context.scene
vl = bpy.context.view_layer
objs = {o.name: o for o in bpy.data.objects if o.type == "MESH"}
arch = [objs[n] for n in ARCH if n in objs]
ground = [objs[n] for n in GROUND if n in objs]
ornament = [objs[n] for n in ORNAMENT if n in objs and objs[n].data.users == 1]
log("sets arch=%d ground=%d ornament=%d" % (len(arch), len(ground), len(ornament)),
    "missing", [n for n in ARCH + GROUND + ORNAMENT if n not in objs])

# ---------------------------------------------------------------- renderer
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
bk.margin = 8
bk.use_clear = True

# ---------------------------------------------------------------- the lights
lights_were = {o: o.hide_render for o in bpy.data.objects if o.type == "LIGHT" or o.name in EMITTERS}
world_was = sc.world


def all_lights_off():
    for o in lights_were:
        o.hide_render = True


def world_of(strength):
    w = bpy.data.worlds.new("GI_WORLD")
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    bg.inputs["Strength"].default_value = strength
    return w


sun_data = bpy.data.lights.new("GI_SUN", "SUN")
sun_data.energy = 1.0
sun_data.angle = math.radians(1.5)
sun_ob = bpy.data.objects.new("GI_SUN", sun_data)
sc.collection.objects.link(sun_ob)
sun_ob.rotation_mode = "QUATERNION"
from mathutils import Vector  # noqa: E402
sun_ob.rotation_quaternion = Vector(tuple(-SUN_DIR)).to_track_quat("-Z", "Y")
sun_ob.hide_render = True

# The lamps, with their strengths: arbitrary together, the scale is measured below.
lamp_lights = []


def lamp(name, at, watts, colour=(1.0, 0.66, 0.36), radius=0.06):
    d = bpy.data.lights.new("GI_LAMP_" + name, "POINT")
    d.energy = watts
    d.color = colour
    d.shadow_soft_size = radius
    o = bpy.data.objects.new("GI_LAMP_" + name, d)
    sc.collection.objects.link(o)
    o.location = at
    o.hide_render = True
    lamp_lights.append(o)


lamp("portico", (0.0, -9.62, 3.5), 90.0, radius=0.12)
for i, (x, mid, _wall, front) in enumerate(((-1.95, 7.15, 7.8, 8.15), (1.95, 7.15, 7.8, 8.15), (-1.45, 3.35, 8.4, 8.65), (1.45, 3.35, 8.4, 8.65))):
    lamp("wall%d" % i, (x, -front, mid), 26.0)
for sx in (-1, 1):
    lamp("die%d" % sx, (sx * 7.6, -12.2, 1.96), 22.0)
    for deg in (-20, 0, 20, 40, 60):
        t = math.radians(deg)
        lamp("ring%d%d" % (sx, deg), (sx * 14.45 * math.cos(t), -30.0 - 14.45 * math.sin(t), 0.67), 7.0, radius=0.05)
for y in (-32.0, -18.0, 15.0, 29.0, 43.0, 57.0, 71.0):
    lamp("walk%d" % int(y), (-36.88, y, 0.67), 7.0, radius=0.05)
for y in (-10.4, -7.4, 7.4, 10.4):
    for x in (-34.4, -18.4):
        lamp("deck%d%d" % (int(x), int(y)), (x, y, 1.15), 5.0, radius=0.05)
for k in range(9):
    for sx in (-1, 1):
        lamp("ave%d%d" % (k, sx), (sx * 10.2, -44.0 - k * 17.0, 1.25), 14.0, radius=0.1)

# The rooms: lit panes, whatever the file gives them. A warm emission in place of the
# material while the lamps are baked.
pane = bpy.data.materials.new("GI_PANE")
pane.use_nodes = True
pn = pane.node_tree
pn.nodes.clear()
pe = pn.nodes.new("ShaderNodeEmission")
pe.inputs["Color"].default_value = (1.0, 0.62, 0.3, 1.0)
pe.inputs["Strength"].default_value = 9.0
po = pn.nodes.new("ShaderNodeOutputMaterial")
pn.links.new(pe.outputs[0], po.inputs[0])
back = objs.get("mansion_window_back")
back_mats = list(back.data.materials) if back else []


def lamps_on():
    for o in lamp_lights:
        o.hide_render = False
    if back:
        back.hide_render = False
        for i in range(len(back.data.materials)):
            back.data.materials[i] = pane


def lamps_off():
    for o in lamp_lights:
        o.hide_render = True
    if back:
        for i, m in enumerate(back_mats):
            back.data.materials[i] = m


# ---------------------------------------------------------------- helpers
def pixels(img):
    a = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def arm(mats, img):
    for m in mats:
        nt = m.node_tree
        n = nt.nodes.get("GI_BAKE_TARGET") or nt.nodes.new("ShaderNodeTexImage")
        n.name = n.label = "GI_BAKE_TARGET"
        n.image = img
        for nd in nt.nodes:
            nd.select = (nd.name == "GI_BAKE_TARGET")
        nt.nodes.active = nt.nodes["GI_BAKE_TARGET"]


def disarm(mats):
    for m in mats:
        n = m.node_tree.nodes.get("GI_BAKE_TARGET")
        if n is not None:
            m.node_tree.nodes.remove(n)


def mats_of(objs_):
    out = []
    for o in objs_:
        for m in o.data.materials:
            if m is not None and m not in out:
                out.append(m)
    return out


def use_uv2(objs_):
    for o in objs_:
        uv = o.data.uv_layers.get(UVN)
        if uv is None:
            raise SystemExit("no %s on %s: run the occlusion bake first" % (UVN, o.name))
        o.data.uv_layers.active = uv


def select_only(objs_, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs_:
        o.hide_set(False)
        o.select_set(True)
    vl.objects.active = active or objs_[0]


def bake_arch(kind, passes):
    raw = bpy.data.images.new("GI_RAW", PX, PX, alpha=True, float_buffer=True)
    raw.colorspace_settings.name = "Non-Color"
    mats = mats_of(arch)
    arm(mats, raw)
    cy.samples = SAMPLES
    bk.use_selected_to_active = False
    use_uv2(arch)
    select_only(arch)
    if kind == "NORMAL":
        bk.normal_space = "OBJECT"
        bpy.ops.object.bake(type="NORMAL", margin=8, use_clear=True, target="IMAGE_TEXTURES")
    else:
        bpy.ops.object.bake(type=kind, pass_filter=passes, margin=8, use_clear=True, target="IMAGE_TEXTURES")
    disarm(mats)
    p = pixels(raw).copy()
    bpy.data.images.remove(raw)
    return p


def bake_ground(passes):
    pm = bpy.data.meshes.new("GI_PROBE")
    z = -3.0
    pm.from_pydata([(GX0, GY0, z), (GX1, GY0, z), (GX1, GY1, z), (GX0, GY1, z)], [], [(0, 1, 2, 3)])
    puv = pm.uv_layers.new(name="UVMap")
    for li, uv in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        puv.data[li].uv = uv
    probe = bpy.data.objects.new("GI_PROBE", pm)
    sc.collection.objects.link(probe)
    mat = bpy.data.materials.new("GI_PROBE")
    mat.use_nodes = True
    pm.materials.append(mat)
    for flag in ("visible_camera", "visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter", "visible_shadow"):
        setattr(probe, flag, False)
    raw = bpy.data.images.new("GI_RAW_G", PX, PX, alpha=True, float_buffer=True)
    raw.colorspace_settings.name = "Non-Color"
    arm([mat], raw)
    cy.samples = SAMPLES
    bk.use_selected_to_active = True
    bk.use_cage = False
    bk.cage_extrusion = 40.0
    bk.max_ray_distance = 0.0
    bpy.ops.object.select_all(action="DESELECT")
    for o in ground:
        o.hide_set(False)
        o.select_set(True)
    probe.select_set(True)
    vl.objects.active = probe
    bpy.ops.object.bake(type="DIFFUSE", pass_filter=passes, use_selected_to_active=True, cage_extrusion=40.0,
                        margin=4, use_clear=True, target="IMAGE_TEXTURES")
    bk.use_selected_to_active = False
    p = pixels(raw).copy()
    bpy.data.images.remove(raw)
    bpy.data.objects.remove(probe, do_unlink=True)
    bpy.data.meshes.remove(pm)
    bpy.data.materials.remove(mat)
    return p


def lum(p):
    return 0.2126 * p[..., 0] + 0.7152 * p[..., 1] + 0.0722 * p[..., 2]


def gauss(v, sigma):
    r = max(1, int(math.ceil(sigma * 3)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    out = v
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for i, kv in enumerate(k):
            acc += kv * np.roll(out, i - r, axis=axis)
        out = acc
    return out


def smooth(v, mask, sigma):
    """A Gaussian that does not take from outside the baked texels, then the empty
    atlas filled from them, so a coarse mip never reads black."""
    w = mask.astype(np.float32)
    num = gauss(v * w, sigma)
    den = gauss(w, sigma)
    out = np.where(den > 1e-3, num / np.maximum(den, 1e-3), 0.0)
    filled = den > 1e-3
    for s in (sigma * 3, sigma * 9, sigma * 27):
        if filled.all():
            break
        n2 = gauss(out * filled, s)
        d2 = gauss(filled.astype(np.float32), s)
        grow = (~filled) & (d2 > 1e-3)
        out = np.where(grow, n2 / np.maximum(d2, 1e-3), out)
        filled = filled | grow
    return out


def oetf(v):
    v = np.clip(v, 0.0, 1.0)
    return np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(np.maximum(v, 1e-8), 1 / 2.4) - 0.055)


def save_rgb(name, r, g, b):
    img = bpy.data.images.new(name, PX, PX, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    rgba = np.empty((PX, PX, 4), dtype=np.float32)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = oetf(r), oetf(g), oetf(b)
    rgba[..., 3] = 1.0
    img.pixels.foreach_set(rgba.reshape(-1))
    path = os.path.join(WORK, name + ".png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return path


# ----------------------------------------------------------------- 1. sun's bounce
all_lights_off()
black = world_of(0.0)
sc.world = black
sun_ob.hide_render = False
log("bounce: atlas")
p_b_a = bake_arch("DIFFUSE", {"INDIRECT"})
log("bounce: ground")
p_b_g = bake_ground({"INDIRECT"})
log("bounce done")
sun_ob.hide_render = True

# --------------------------------------------------------------------- 2. the lamps
lamps_on()
log("lamps: atlas")
p_l_a = bake_arch("DIFFUSE", {"DIRECT", "INDIRECT"})
log("lamps: ground")
p_l_g = bake_ground({"DIRECT", "INDIRECT"})
log("lamps done")
lamps_off()

# ---------------------------------------------------------------- 3. the rest of the sky
white = world_of(1.0)
sc.world = white
log("sky: atlas")
p_s_a = bake_arch("DIFFUSE", {"DIRECT", "INDIRECT"})
p_n_a = bake_arch("NORMAL", None)
log("sky done")

mask_a = p_b_a[..., 3] > 0.5
mask_g = p_b_g[..., 3] > 0.5
# Cycles' diffuse pass with the colour left out is E/pi: a sun of 1 W/m2 facing a surface
# reads 1/pi. As a share of the sun's own irradiance:
bounce_a = lum(p_b_a) * math.pi
bounce_g = lum(p_b_g) * math.pi
lamps_a = lum(p_l_a) * math.pi
lamps_g = lum(p_l_g) * math.pi
# The lamps' scale, from the ground and the stone together: what a lit patch of terrace has.
LAMP_SCALE = float(max(np.percentile(lamps_a[mask_a], 99.7), np.percentile(lamps_g[mask_g], 99.7), 1e-4))
log("bounce atlas p50 %.4f p95 %.4f p99.5 %.4f | ground p50 %.4f p95 %.4f p99.5 %.4f | lamp scale %.3f" % (
    np.percentile(bounce_a[mask_a], 50), np.percentile(bounce_a[mask_a], 95), np.percentile(bounce_a[mask_a], 99.5),
    np.percentile(bounce_g[mask_g], 50), np.percentile(bounce_g[mask_g], 95), np.percentile(bounce_g[mask_g], 99.5), LAMP_SCALE))

# The sky's ratio. The open world for a face of this normal (the object space is the
# world: the estate's meshes are built in place): half the sky and half the lit ground,
# by the way it faces.
nz = p_n_a[..., 2] * 2.0 - 1.0
e_open = 0.5 * (1.0 + nz) + GROUND_ALBEDO * 0.5 * (1.0 - nz)
sky_a = lum(p_s_a) / np.maximum(e_open, 0.05)
# What the occlusion map already holds, at this size.
ao_img = bpy.data.images.get("AO_ARCH")
if ao_img is None:
    raise SystemExit("AO_ARCH is not in the file: run the occlusion bake first")
ao = pixels(ao_img)[..., 0].astype(np.float32)
ao = np.where(ao <= 0.04045, ao / 12.92, ((ao + 0.055) / 1.055) ** 2.4)
if ao.shape[0] != PX:
    step = ao.shape[0] // PX
    ao = ao[: PX * step, : PX * step].reshape(PX, step, PX, step).mean(axis=(1, 3))
rest_a = np.clip(sky_a / np.maximum(ao, 0.12), 0.45, 1.25)
log("rest of the sky p5 %.3f p50 %.3f p95 %.3f" % (np.percentile(rest_a[mask_a], 5), np.percentile(rest_a[mask_a], 50), np.percentile(rest_a[mask_a], 95)))

sig_a, sig_g = 1.6 * PX / 2048.0, 1.2 * PX / 2048.0
# (the ground's window is 216 m: a texel is 10 cm, and its bounce is soft by nature)
arch_path = save_rgb("gi_arch",
                     smooth(bounce_a, mask_a, sig_a) / GI_BOUNCE_RANGE,
                     smooth(lamps_a, mask_a, sig_a) / LAMP_SCALE,
                     smooth(rest_a, mask_a, sig_a * 1.5) / 1.25)
ground_path = save_rgb("gi_ground",
                       smooth(bounce_g, mask_g, sig_g) / GI_BOUNCE_RANGE,
                       smooth(lamps_g, mask_g, sig_g) / LAMP_SCALE,
                       np.full((PX, PX), 0.8, dtype=np.float32))
log("saved", arch_path, ground_path)
del p_b_a, p_b_g, p_l_a, p_l_g, p_s_a, p_n_a

# ---------------------------------------------------------------- 4. the ornament
cy.samples = V_SAMPLES


def bake_corners(kind, passes):
    select_only(ornament)
    bpy.ops.object.bake(type=kind, pass_filter=passes, margin=0, use_clear=True, target="VERTEX_COLORS")
    out = {}
    for o in ornament:
        a = o.data.color_attributes["GI"]
        arr = np.empty(len(a.data) * 4, dtype=np.float32)
        a.data.foreach_get("color", arr)
        out[o.name] = arr.reshape(-1, 4).copy()
    return out


for o in ornament:
    me = o.data
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    me.color_attributes.new("GI", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color_name = "GI"
    me.color_attributes.render_color_index = 0

sc.world = black
sun_ob.hide_render = False
log("ornament: bounce")
v_bounce = bake_corners("DIFFUSE", {"INDIRECT"})
sun_ob.hide_render = True
lamps_on()
log("ornament: lamps")
v_lamps = bake_corners("DIFFUSE", {"DIRECT", "INDIRECT"})
lamps_off()
# Its occlusion as the atlas's: a 6 m reach, the ground no occluder.
ao_world = bpy.data.worlds.new("GI_AO_WORLD")
ao_world.light_settings.distance = ARCH_REACH
sc.world = ao_world
ground_shadow = [(o, o.visible_shadow) for o in ground]
for o in ground:
    o.visible_shadow = False
log("ornament: occlusion")
v_ao = bake_corners("AO", None) if False else None
select_only(ornament)
bpy.ops.object.bake(type="AO", margin=0, use_clear=True, target="VERTEX_COLORS")
v_ao = {}
for o in ornament:
    a = o.data.color_attributes["GI"]
    arr = np.empty(len(a.data) * 4, dtype=np.float32)
    a.data.foreach_get("color", arr)
    v_ao[o.name] = arr.reshape(-1, 4).copy()
for o, v in ground_shadow:
    o.visible_shadow = v
sc.world = world_was

for o in ornament:
    a = o.data.color_attributes["GI"]
    occ = np.clip(v_ao[o.name][:, 0], 0.22, 1.0)
    b = np.clip(lum(v_bounce[o.name]) * math.pi / GI_BOUNCE_RANGE, 0.0, 1.0)
    l = np.clip(lum(v_lamps[o.name]) * math.pi / LAMP_SCALE, 0.0, 1.0)
    out = np.stack([1.0 - occ, np.sqrt(b), np.sqrt(l), np.ones_like(occ)], axis=1)
    a.data.foreach_set("color", out.reshape(-1))
    o.data.update()
    log("ornament %-22s corners %7d occ p50 %.2f bounce p50 %.3f lamps p95 %.3f" % (
        o.name, len(occ), np.percentile(occ, 50), np.percentile(b, 50), np.percentile(l, 95)))

# ---------------------------------------------------------------- 5. leave it as found
for o, was in lights_were.items():
    o.hide_render = was
bpy.data.objects.remove(sun_ob, do_unlink=True)
bpy.data.lights.remove(sun_data)
for o in lamp_lights:
    d = o.data
    bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.lights.remove(d)
bpy.data.materials.remove(pane)
for w in (black, white, ao_world):
    bpy.data.worlds.remove(w)
json.dump({"GI_BOUNCE_RANGE": GI_BOUNCE_RANGE, "LAMP_SCALE": LAMP_SCALE, "PX": PX, "SAMPLES": SAMPLES},
          open(os.path.join(WORK, "gi.json"), "w"), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, copy=False)
log("SAVED", bpy.data.filepath)
print("DONE")
