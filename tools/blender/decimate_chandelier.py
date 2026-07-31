"""
Background decimator for the Osgona chandelier GLBs.

These source files are 43-56 MB with millions of polygons and ~6k mesh objects
buried under ~12k empty transform nodes. Importing them into the live Blender
session locks the MCP bridge, so this runs headless:

    blender --background --python decimate_chandelier.py -- <in.glb> <out.glb> <target_tris>

It joins every mesh into one object, decimates to the target, recentres the
result on its own origin, and writes a compact Draco-compressed GLB.
"""
import bpy, sys, os, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST, TARGET = argv[0], argv[1], int(argv[2])

# empty the default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

bpy.ops.import_scene.gltf(filepath=SRC)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if not meshes:
    print("RESULT|error|no meshes imported")
    sys.exit(1)

raw_tris = sum(len(p.vertices) - 2 for m in meshes for p in m.data.polygons)

# flatten the hierarchy so joining does not drag parent transforms around
for m in meshes:
    m.matrix_world = m.matrix_world.copy()
    m.parent = None

bpy.ops.object.select_all(action='DESELECT')
for m in meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.active_object
obj.name = "chandelier_src"

joined_tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)

# decimate
if joined_tris > TARGET:
    mod = obj.modifiers.new("dec", 'DECIMATE')
    mod.ratio = max(0.0005, TARGET / joined_tris)
    dg = bpy.context.evaluated_depsgraph_get()
    newmesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.remove(mod)
    old = obj.data
    obj.data = newmesh
    bpy.data.meshes.remove(old)

final_tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)

# normalise: stand upright if needed, centre on origin, hang from z=0 downward
me = obj.data
def ext():
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)

x0, x1, y0, y1, z0, z1 = ext()
if (y1 - y0) > (z1 - z0) * 1.2:          # authored Y-up
    me.transform(mathutils.Matrix.Rotation(math.radians(90), 4, 'X'))
    me.update()
    x0, x1, y0, y1, z0, z1 = ext()

# scale to a 1.55 m tall fixture
s = 1.55 / max(z1 - z0, 1e-6)
me.transform(mathutils.Matrix.Scale(s, 4))
me.update()
x0, x1, y0, y1, z0, z1 = ext()

# origin at the TOP centre so it can be hung from a ceiling point
me.transform(mathutils.Matrix.Translation((-(x0 + x1) / 2, -(y0 + y1) / 2, -z1)))
me.update()
x0, x1, y0, y1, z0, z1 = ext()

obj.location = (0, 0, 0)

os.makedirs(os.path.dirname(DST), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(
    filepath=DST, export_format='GLB', use_selection=True, export_apply=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_image_format='JPEG', export_jpeg_quality=85, export_yup=True,
)

print("RESULT|ok|raw=%d|joined=%d|final=%d|dims=%.3f,%.3f,%.3f|out=%s|mb=%.2f" % (
    raw_tris, joined_tris, final_tris,
    x1 - x0, y1 - y0, z1 - z0, DST,
    os.path.getsize(DST) / 1048576.0))
