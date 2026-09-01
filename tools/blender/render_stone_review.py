"""
Review renders for the stone material pass - swatches and the real cameras.

Camera beats are taken from the web build, not invented:
  hero     cameraPath.ts beat 0  three(-20, 15.5, 27) -> (0, 4.1, 0)  fov 41
  arrival  poses.ts arrival.to   three(0, 1.65, 18) -> (-3.2, 3.4, 0)
           the home page frame, ~12m off the facade - the hardest test
  approach poses.ts approach.to  three(7.0, 1.7, 20) -> (0, 3.6, 0)

Blender is Z-up and the exporter writes blender(x,y,z) -> three(x, z, -y), so
three(x,y,z) comes back as blender(x, -z, y).

Everything temporary lives in COL_REVIEW_TEMP, which is excluded from export.

    blender --background mansion_exterior.blend --python render_stone_review.py -- <outdir>
"""
import bpy, os, sys, math, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
os.makedirs(OUT, exist_ok=True)

D = bpy.data
scn = bpy.context.scene
vl = bpy.context.view_layer

rev = D.collections.get("COL_REVIEW_TEMP")
if rev is None:
    rev = D.collections.new("COL_REVIEW_TEMP")
    scn.collection.children.link(rev)


def lc(name, root=None):
    root = root or vl.layer_collection
    if root.name == name:
        return root
    for ch in root.children:
        r = lc(name, ch)
        if r:
            return r


def three_to_blender(p):
    return Vector((p[0], -p[2], p[1]))


def fov_to_lens(cam_data, fov_deg):
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.sensor_height = 24.0
    cam_data.lens = (cam_data.sensor_height / 2.0) / math.tan(math.radians(fov_deg) / 2.0)


# ------------------------------------------------------------------ rig ----
cam_d = D.cameras.get("REV_CAM") or D.cameras.new("REV_CAM")
cam = D.objects.get("REV_CAM")
if cam is None:
    cam = D.objects.new("REV_CAM", cam_d)
    rev.objects.link(cam)
cam.data = cam_d
scn.camera = cam

sun = D.objects.get("REV_SUN")
if sun is None:
    sd = D.lights.new("REV_SUN", 'SUN')
    sun = D.objects.new("REV_SUN", sd)
    rev.objects.link(sun)
sun.data.energy = 3.1
sun.data.angle = math.radians(1.4)      # soft-ish shadow edge, real sun disc
sun.data.color = (1.0, 0.96, 0.90)
sun.rotation_euler = (math.radians(52), 0.0, math.radians(41))

scn.render.engine = 'BLENDER_EEVEE'
try:
    scn.eevee.taa_render_samples = 64
    scn.eevee.use_raytracing = True
    scn.eevee.use_shadows = True
except Exception:
    pass
scn.render.image_settings.file_format = 'PNG'


def aim(camobj, pos, tgt):
    camobj.location = pos
    d = Vector(tgt) - Vector(pos)
    camobj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def shoot(name, w, h):
    scn.render.resolution_x, scn.render.resolution_y = w, h
    p = os.path.join(OUT, name + ".png")
    scn.render.filepath = p
    bpy.ops.render.render(write_still=True)
    return os.path.exists(p)


# ------------------------------------------------------------- swatches ----
# Vertical 3x3m panels, UV at 1 unit per metre so each material shows at the
# exact scale it has on the building.
MATS = ["MAT_Stone_Wall", "MAT_Stone_Rustic", "MAT_Stone_Trim",
        "MAT_Stone_Paving", "MAT_Stone_Steps"]
SW = 3.0
GAP = 0.35
panels = []
for i, mn in enumerate(MATS):
    nm = "REV_SW_%d" % i
    old = D.objects.get(nm)
    if old:
        D.objects.remove(old, do_unlink=True)
    me = D.meshes.new(nm)
    x0 = (i - (len(MATS) - 1) / 2.0) * (SW + GAP)
    verts = [(x0 - SW / 2, 0, 0), (x0 + SW / 2, 0, 0),
             (x0 + SW / 2, 0, SW), (x0 - SW / 2, 0, SW)]
    me.from_pydata(verts, [], [(0, 1, 2, 3)])
    me.update()
    uvl = me.uv_layers.new(name="UVMap")
    for li, (u, v) in enumerate([(verts[k][0], verts[k][2]) for k in (0, 1, 2, 3)]):
        uvl.data[li].uv = (u, v)          # 1 unit per metre, V on world Z
    ob = D.objects.new(nm, me)
    ob.location = (0, 400.0, 0)           # far from the mansion, own little set
    rev.objects.link(ob)
    ob.data.materials.append(D.materials[mn])
    # swatches have no baked vertex colour; give them a neutral one
    ca = me.color_attributes.new('StoneAO', 'FLOAT_COLOR', 'CORNER')
    for d in ca.data:
        d.color = (1, 1, 1, 1)
    panels.append(ob)

results = {}

# isolate the swatch set
for name in ("COL_Exterior", "COL_Interior"):
    l = lc(name)
    if l:
        l.exclude = True
vl.update()
fov_to_lens(cam_d, 38)
aim(cam, Vector((0, 400.0 - 9.2, 1.5)), Vector((0, 400.0, 1.5)))
results["swatches"] = shoot("stone_swatches", 1600, 420)

# ------------------------------------------------------------ mansion -----
for name in ("COL_Exterior",):
    l = lc(name)
    if l:
        l.exclude = False
vl.update()

SHOTS = [
    ("hero",     (-20.0, 15.5, 27.0), (0.0, 4.1, 0.0), 41, 1500, 900),
    ("arrival",  (0.0, 1.65, 18.0),   (-3.2, 3.4, 0.0), 45, 1500, 900),
    ("approach", (7.0, 1.7, 20.0),    (0.0, 3.6, 0.0), 45, 1500, 900),
    # a tight look at the entrance, where the brief says the camera points
    ("entrance", (2.4, 2.0, 11.0),    (0.0, 2.6, 5.2), 40, 1300, 900),
]
for nm, p, t, fov, w, h in SHOTS:
    fov_to_lens(cam_d, fov)
    aim(cam, three_to_blender(p), three_to_blender(t))
    results[nm] = shoot("stone_" + nm, w, h)

l = lc("COL_Interior")
if l:
    l.exclude = False
vl.update()
print("###RENDER###")
print(json.dumps(results))
