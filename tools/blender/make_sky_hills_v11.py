"""
The v11 sky: misty forested hills round the estate, rendered as the panorama
the site draws behind everything (the concept the user asked to be built 1:1,
2026-10-27: "a lush misty tropical jungle valley", forested hills layered into
a golden haze above the house).

    blender --background --factory-startup --python make_sky_hills_v11.py -- <out_dir> [W] [samples]

Renders two equirectangular EXRs into <out_dir>, in three's own layout (the
camera's turn below was found by a test render: u = atan2(z, x)/2pi + 0.5 with
Blender's +x at the middle, its +y a quarter in, the zenith at the top):

  beauty.exr   the hills under the estate's sun (DAY_SUN, 14 degrees up on the
               front-right bearing) and a hazy sky, no air yet
  data.exr     R = distance from the eye (m), G = height of what is seen (m),
               both times the alpha (the land's cover of the pixel), as the
               beauty's colour is

The air - distance haze and the valley's mist - is laid on afterwards from
data.exr (tools/gltf/grade_sky_hills_v11.py), so it can be judged and moved
without rendering again.

THE LAND. A valley about the estate: flat to 1.3 km (the estate's own land
covers it, out to 900 m), forested foothills from about 1.5 km, a main range
from 4 km whose highest ground stands behind the house as the cover sees it
(Blender azimuth 15..100 degrees), and a far range from 9 km. Ridged noise,
so it has spurs and saddles rather than bumps. Crowns (low icospheres, 11 m
and more) are scattered over everything from 1.25 km to 8 km, so the ridges'
skylines are forest and not a smooth line.
"""
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "C:/dev/Blender/_hills/out"
W = int(argv[1]) if len(argv) > 1 else 4096
SAMPLES = int(argv[2]) if len(argv) > 2 else 96
EYE = 20.0

# The estate's sun (WorldCanvas / softSunShadows DAY_SUN, three's axes) in
# Blender's: (x, y, z) three -> (x, -z, y) Blender.
SUN3 = np.array([86.0, 25.0, 50.0])
SUN = Vector((SUN3[0], -SUN3[2], SUN3[1])).normalized()

scn = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- the land
rng = np.random.default_rng(11)


def fade(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


def perlin(x, y, seed):
    xi = np.floor(x).astype(np.int64)
    yi = np.floor(y).astype(np.int64)
    xf = x - xi
    yf = y - yi

    def g(ix, iy, dx, dy):
        n = (ix.astype(np.uint64) * np.uint64(374761393) + iy.astype(np.uint64) * np.uint64(668265263)
             + np.uint64(seed) * np.uint64(2654435761))
        n = (n ^ (n >> np.uint64(13))) * np.uint64(1274126177)
        n = n ^ (n >> np.uint64(16))
        a = (n & np.uint64(0xFFFF)).astype(np.float64) / 65536.0 * 2 * np.pi
        return np.cos(a) * dx + np.sin(a) * dy

    u = fade(xf)
    v = fade(yf)
    n00 = g(xi, yi, xf, yf)
    n10 = g(xi + 1, yi, xf - 1, yf)
    n01 = g(xi, yi + 1, xf, yf - 1)
    n11 = g(xi + 1, yi + 1, xf - 1, yf - 1)
    a = n00 + (n10 - n00) * u
    b = n01 + (n11 - n01) * u
    return a + (b - a) * v


def ridged(x, y, seed, octaves=6):
    """0..~1: sharp crests, soft valleys; each octave weighted by the last."""
    total = np.zeros_like(x)
    amp = 0.55
    freq = 1.0
    weight = np.ones_like(x)
    norm = 0.0
    for o in range(octaves):
        n = 1.0 - np.abs(perlin(x * freq, y * freq, seed + o * 31))
        n = n * n
        n = n * weight
        weight = np.clip(n * 1.6, 0, 1)
        total += n * amp
        norm += amp
        freq *= 2.03
        amp *= 0.5
    return total / norm


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def az_bump(az, centre, width):
    d = np.angle(np.exp(1j * (az - math.radians(centre))))
    return np.exp(-(d / math.radians(width)) ** 2)


def dome(x, y, az_deg, r_m, radius, top):
    cx = r_m * math.cos(math.radians(az_deg))
    cy = r_m * math.sin(math.radians(az_deg))
    d2 = ((x - cx) ** 2 + (y - cy) ** 2) / radius**2
    return top * np.exp(-d2 * 1.6)


def height(x, y):
    r = np.hypot(x, y)
    az = np.arctan2(y, x)
    # THE COVER'S HILLS (it looks along Blender azimuth 55, its left edge at
    # 77 and its right at 33): a big forested hill rising out of the frame's
    # left, a lower one on the right, and between them, behind the house, the
    # valley running back to a pale far range - the concept's composition.
    rough = 0.35 + 0.65 * ridged(x / 1300, y / 1300, 3)
    hills = (dome(x, y, 84, 2700, 1500, 300) + dome(x, y, 71, 2200, 800, 130)
             + dome(x, y, 36, 3000, 1500, 210) + dome(x, y, 22, 2600, 1000, 160))
    # foothills all round, low in the valley's mouth behind the house
    mouth = 1 - 0.75 * az_bump(az, 54, 16)
    low = (95 + 120 * (1 - az_bump(az, 54, 60))) * mouth
    h1 = (hills + low) * smooth(1300, 2600, r) * rough
    main = 380 + 300 * az_bump(az, 52, 30) + 140 * az_bump(az, 200, 60)
    h2 = main * smooth(3600, 7000, r) * (0.25 + 0.75 * ridged(x / 2600, y / 2600, 17))
    h3 = 1150 * smooth(9000, 13500, r) * (0.3 + 0.7 * ridged(x / 5200, y / 5200, 41))
    return h1 + h2 + h3


RINGS = np.concatenate([[0.0], np.geomspace(1200.0, 26000.0, 300)])
SEGS = 2304
th = np.linspace(-np.pi, np.pi, SEGS, endpoint=False)
R, T = np.meshgrid(RINGS, th, indexing="ij")
X = R * np.cos(T)
Y = R * np.sin(T)
Z = height(X, Y)
Z[0, :] = 0.0
verts = np.stack([X, Y, Z], -1).reshape(-1, 3)
faces = []
nr = len(RINGS)
for i in range(nr - 1):
    for j in range(SEGS):
        a = i * SEGS + j
        b = i * SEGS + (j + 1) % SEGS
        c = (i + 1) * SEGS + (j + 1) % SEGS
        d = (i + 1) * SEGS + j
        faces.append((a, b, c, d))
me = bpy.data.meshes.new("hills")
me.from_pydata(verts.tolist(), [], faces)
me.update()
for p in me.polygons:
    p.use_smooth = True
land = bpy.data.objects.new("hills", me)
scn.collection.objects.link(land)

# where the crowns stand, and how large: everything from 1.25 km to 8 km
rv = np.hypot(verts[:, 0], verts[:, 1])
dens = np.where(rv < 1250, 0.0, np.where(rv < 3200, 1.0, 0.24 * (1 - smooth(6500, 8200, rv))))
cs = np.where(rv < 3200, 1.0, 2.1)
for name, val in (("dens", dens), ("cs", cs)):
    at = me.attributes.new(name, "FLOAT", "POINT")
    at.data.foreach_set("value", val.astype(np.float32))

# ---------------------------------------------------------------- materials
def mat(name, base, rough=0.8, trans=0.0, rand=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = rough
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    col_out = None
    if rand:
        info = nt.nodes.new("ShaderNodeObjectInfo")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*rand[0], 1)
        ramp.color_ramp.elements[1].color = (*rand[1], 1)
        nt.links.new(info.outputs["Random"], ramp.inputs[0])
        col_out = ramp.outputs[0]
        nt.links.new(col_out, bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*base, 1)
    if trans > 0:
        tr = nt.nodes.new("ShaderNodeBsdfTranslucent")
        if col_out:
            nt.links.new(col_out, tr.inputs[0])
        else:
            tr.inputs[0].default_value = (*base, 1)
        mix = nt.nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = trans
        nt.links.new(bsdf.outputs[0], mix.inputs[1])
        nt.links.new(tr.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


ground = mat("hill_ground", (0.028, 0.034, 0.018), 0.95)
canopy = mat("hill_canopy", None, 0.7, 0.22, rand=((0.016, 0.04, 0.01), (0.085, 0.105, 0.028)))
land.data.materials.append(ground)

# a crown: a lumpy, flattened icosphere
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
for v in bm.verts:
    n = v.co.normalized()
    lump = 1.0 + 0.16 * math.sin(n.x * 7.1 + 1.3) * math.sin(n.y * 6.3 + 0.4) * math.sin(n.z * 5.7 + 2.1)
    v.co = Vector((n.x * lump, n.y * lump, max(n.z, -0.35) * 0.8 * lump))
crown_me = bpy.data.meshes.new("crown")
bm.to_mesh(crown_me)
bm.free()
for p in crown_me.polygons:
    p.use_smooth = True
crown = bpy.data.objects.new("crown", crown_me)
scn.collection.objects.link(crown)
crown.data.materials.append(canopy)
crown.location = (0, 0, -5000)
crown.hide_render = True

# ---------------------------------------------------------------- the forest (geometry nodes)
gn = bpy.data.node_groups.new("forest", "GeometryNodeTree")
gn.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
gn.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N = gn.nodes
L = gn.links
gi = N.new("NodeGroupInput")
go = N.new("NodeGroupOutput")
dist = N.new("GeometryNodeDistributePointsOnFaces")
dist.distribute_method = "RANDOM"
na_d = N.new("GeometryNodeInputNamedAttribute")
na_d.data_type = "FLOAT"
na_d.inputs["Name"].default_value = "dens"
# (in Random mode the density is itself a field: Density Factor is Poisson's)
per_m2 = N.new("ShaderNodeMath")
per_m2.operation = "MULTIPLY"
per_m2.inputs[1].default_value = 1.0 / 95.0
L.new(na_d.outputs["Attribute"], per_m2.inputs[0])
L.new(gi.outputs[0], dist.inputs["Mesh"])
L.new(per_m2.outputs[0], dist.inputs["Density"])
oi = N.new("GeometryNodeObjectInfo")
oi.inputs["Object"].default_value = crown
inst = N.new("GeometryNodeInstanceOnPoints")
L.new(dist.outputs["Points"], inst.inputs["Points"])
L.new(oi.outputs["Geometry"], inst.inputs["Instance"])
# scale: crown radius 5.5 m x random x the band's own size
rnd = N.new("FunctionNodeRandomValue")
rnd.data_type = "FLOAT"
rnd.inputs["Min"].default_value = 4.2
rnd.inputs["Max"].default_value = 7.6
na_s = N.new("GeometryNodeInputNamedAttribute")
na_s.data_type = "FLOAT"
na_s.inputs["Name"].default_value = "cs"
mul = N.new("ShaderNodeMath")
mul.operation = "MULTIPLY"
L.new(rnd.outputs["Value"], mul.inputs[0])
L.new(na_s.outputs["Attribute"], mul.inputs[1])
L.new(mul.outputs[0], inst.inputs["Scale"])
rot = N.new("FunctionNodeRandomValue")
rot.data_type = "FLOAT_VECTOR"
rot.inputs["Min"].default_value = (0, 0, 0)
rot.inputs["Max"].default_value = (0, 0, 6.283)
L.new(rot.outputs["Value"], inst.inputs["Rotation"])
join = N.new("GeometryNodeJoinGeometry")
L.new(gi.outputs[0], join.inputs[0])
L.new(inst.outputs[0], join.inputs[0])
L.new(join.outputs[0], go.inputs[0])
mod = land.modifiers.new("forest", "NODES")
mod.node_group = gn

# ---------------------------------------------------------------- sky and sun
# The sky that LIGHTS the hills: the painted sky's own warm haze, even (the
# sky that is SEEN is painted by the grade). A blue physical sky here lit the
# forest cyan.
world = bpy.data.worlds.new("sky")
scn.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.74, 0.66, 0.52, 1)
bg.inputs[1].default_value = 0.55

sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy = 4.2
sun_data.angle = math.radians(1.2)
sun_data.color = (1.0, 0.86, 0.68)
sun = bpy.data.objects.new("sun", sun_data)
scn.collection.objects.link(sun)
sun.rotation_euler = (-SUN).to_track_quat("-Z", "Y").to_euler()

# ---------------------------------------------------------------- the eye
cam = bpy.data.cameras.new("pano")
cam.type = "PANO"
try:
    cam.panorama_type = "EQUIRECTANGULAR"
except Exception:  # noqa: BLE001
    cam.cycles.panorama_type = "EQUIRECTANGULAR"
cam.clip_start = 1.0
cam.clip_end = 60000.0
co = bpy.data.objects.new("pano", cam)
scn.collection.objects.link(co)
scn.camera = co
co.location = (0, 0, EYE)
# (found by a test render: this turn lays Blender's world out as three reads an
# equirect, +x at the middle, +y a quarter in)
co.rotation_euler = (math.radians(90), 0, math.radians(-90))

scn.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for t in ("OPTIX", "CUDA", "HIP"):
    try:
        prefs.compute_device_type = t
        prefs.get_devices()
        if any(d.type == t for d in prefs.devices):
            break
    except Exception:  # noqa: BLE001
        pass
for d in prefs.devices:
    d.use = d.type != "CPU"
scn.cycles.device = "GPU"
scn.cycles.samples = SAMPLES
scn.cycles.use_denoising = True
scn.cycles.max_bounces = 4
scn.render.resolution_x = W
scn.render.resolution_y = W // 2
scn.render.resolution_percentage = 100
scn.view_settings.view_transform = "Standard"
scn.render.image_settings.file_format = "OPEN_EXR"
scn.render.image_settings.color_mode = "RGBA"
scn.render.image_settings.color_depth = "32"
# The sky is painted afterwards: the land is rendered over nothing, its edge
# against the sky in the alpha, so a ridge's crown blends into whatever sky the
# grade paints (the world still lights it).
scn.render.film_transparent = True
scn.render.image_settings.exr_codec = "ZIP"

scn.render.filepath = f"{OUT}/beauty.exr"
bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- the data pass
data = bpy.data.materials.new("data")
data.use_nodes = True
nt = data.node_tree
for n in list(nt.nodes):
    if n.type != "OUTPUT_MATERIAL":
        nt.nodes.remove(n)
out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
camd = nt.nodes.new("ShaderNodeCameraData")
geo = nt.nodes.new("ShaderNodeNewGeometry")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
comb = nt.nodes.new("ShaderNodeCombineXYZ")
em = nt.nodes.new("ShaderNodeEmission")
nt.links.new(geo.outputs["Position"], sep.inputs[0])
nt.links.new(camd.outputs["View Distance"], comb.inputs[0])
nt.links.new(sep.outputs[2], comb.inputs[1])
nt.links.new(comb.outputs[0], em.inputs[0])
em.inputs[1].default_value = 1.0
nt.links.new(em.outputs[0], out.inputs["Surface"])
scn.view_layers[0].material_override = data
bg.inputs[1].default_value = 0.0
bg.inputs[0].default_value = (0, 0, 0, 1)
sun.hide_render = True
scn.cycles.samples = 24
scn.cycles.use_denoising = False
scn.render.filepath = f"{OUT}/data.exr"
bpy.ops.render.render(write_still=True)
print("DONE", OUT)
