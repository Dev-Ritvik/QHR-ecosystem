"""
Headless ornament preparer.

Source ornament files run 5-57 MB with up to 2M polygons. Importing them into
the live session locks the MCP bridge (learned the hard way with the chandeliers),
so this joins + decimates + normalises each asset offline and writes a small GLB.

    blender --background --python prep_ornament.py -- <src> <dst.glb> <target_tris> <target_height> [standup]

standup: 1 = rotate so the long axis becomes Z (default), 0 = leave orientation.
Origin is placed at the BOTTOM centre so pieces sit on a surface.
"""
import bpy, sys, os, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST = argv[0], argv[1]
TARGET = int(argv[2])
HEIGHT = float(argv[3])
STANDUP = (len(argv) < 5) or (argv[4] == "1")
# Explicit X rotation in degrees, applied instead of the standup heuristic.
# Furniture defeats that heuristic: a console lying on its back is taller than
# it is deep, so the rule "rotate if Y > Z" fires the wrong way round.
ROTX = float(argv[5]) if len(argv) > 5 else 0.0

bpy.ops.wm.read_factory_settings(use_empty=True)

ext = os.path.splitext(SRC)[1].lower()
if ext == ".glb" or ext == ".gltf":
    bpy.ops.import_scene.gltf(filepath=SRC)
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=SRC)
elif ext == ".obj":
    bpy.ops.wm.obj_import(filepath=SRC)
elif ext == ".stl":
    try:
        bpy.ops.wm.stl_import(filepath=SRC)
    except AttributeError:
        bpy.ops.import_mesh.stl(filepath=SRC)
elif ext == ".blend":
    # pull every mesh object out of the library
    with bpy.data.libraries.load(SRC, link=False) as (src_data, dst_data):
        dst_data.objects = list(src_data.objects)
    for ob in dst_data.objects:
        if ob is not None:
            bpy.context.scene.collection.objects.link(ob)
else:
    print("RESULT|error|unsupported extension %s" % ext)
    sys.exit(1)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if not meshes:
    print("RESULT|error|no meshes")
    sys.exit(1)

raw = sum(len(p.vertices) - 2 for m in meshes for p in m.data.polygons)

# Bake each object's world transform into its mesh data BEFORE measuring.
# The OBJ/FBX importers express their Y-up->Z-up conversion as an object
# rotation; export_apply=True bakes it at export time, so a script that
# measures local me.vertices would otherwise write a file 90 degrees off
# from every number it just printed.
for m in meshes:
    mw = m.matrix_world.copy()
    m.parent = None
    m.matrix_world = mw
for m in meshes:
    m.data.transform(m.matrix_world)
    m.matrix_world = mathutils.Matrix.Identity(4)

bpy.ops.object.select_all(action='DESELECT')
for m in meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.active_object
obj.name = "asset"

joined = sum(len(p.vertices) - 2 for p in obj.data.polygons)
if joined > TARGET:
    mod = obj.modifiers.new("dec", 'DECIMATE')
    mod.ratio = max(0.0005, TARGET / joined)
    dg = bpy.context.evaluated_depsgraph_get()
    nm = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.remove(mod)
    old = obj.data
    obj.data = nm
    bpy.data.meshes.remove(old)
final = sum(len(p.vertices) - 2 for p in obj.data.polygons)

me = obj.data
def ext3():
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)

x0, x1, y0, y1, z0, z1 = ext3()
if ROTX:
    me.transform(mathutils.Matrix.Rotation(math.radians(ROTX), 4, 'X'))
    me.update()
    x0, x1, y0, y1, z0, z1 = ext3()
elif STANDUP and (y1 - y0) > (z1 - z0) * 1.2:
    me.transform(mathutils.Matrix.Rotation(math.radians(90), 4, 'X'))
    me.update()
    x0, x1, y0, y1, z0, z1 = ext3()

s = HEIGHT / max(z1 - z0, 1e-6)
me.transform(mathutils.Matrix.Scale(s, 4))
me.update()
x0, x1, y0, y1, z0, z1 = ext3()

# origin at BOTTOM centre so the piece sits on whatever it is placed on
me.transform(mathutils.Matrix.Translation((-(x0 + x1) / 2, -(y0 + y1) / 2, -z0)))
me.update()
x0, x1, y0, y1, z0, z1 = ext3()
obj.location = (0, 0, 0)

# guarantee UVs so textures/materials can land later
if not me.uv_layers:
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            c = l.vert.co
            if abs(n.z) >= abs(n.x) and abs(n.z) >= abs(n.y): u, v = c.x, c.y
            elif abs(n.x) >= abs(n.y): u, v = c.y, c.z
            else: u, v = c.x, c.z
            l[uv].uv = (u * 0.5, v * 0.5)
    bm.to_mesh(me); bm.free(); me.update()

os.makedirs(os.path.dirname(DST), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(
    filepath=DST, export_format='GLB', use_selection=True, export_apply=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_image_format='JPEG', export_jpeg_quality=85, export_yup=True)

print("RESULT|ok|%s|raw=%d|final=%d|dims=%.3f,%.3f,%.3f|mb=%.2f" % (
    os.path.basename(DST), raw, final, x1 - x0, y1 - y0, z1 - z0,
    os.path.getsize(DST) / 1048576.0))
