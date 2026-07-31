"""Pull ONE loose part out of a kit sheet.

cornice.fbx turned out to be a 7234-tile grid of flat carved ornaments rather
than a moulding profile, so the useful unit is a single tile that can be
repeated along a band.

    blender --background --python extract_part.py -- <src.glb> <dst.glb> <rank> <size> <mode>

rank: 0 = most detailed part, 1 = next, ...
mode: flat  - lay in XY, origin at centre, scaled so max horizontal extent = size
      up    - stand in XZ, origin at bottom centre, scaled so height = size
"""
import bpy, sys, os, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST, RANK, SIZE, MODE = argv[0], argv[1], int(argv[2]), float(argv[3]), argv[4]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
mw = obj.matrix_world.copy()
obj.parent = None
obj.matrix_world = mw
obj.data.transform(obj.matrix_world)
obj.matrix_world = mathutils.Matrix.Identity(4)

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.mesh.separate(type='LOOSE')

parts = [(sum(len(f.vertices) - 2 for f in o.data.polygons), o.name, o)
         for o in bpy.data.objects if o.type == 'MESH' and o.data.vertices]
parts.sort(reverse=True)
print("PARTS|%d|top=%s" % (len(parts), ",".join(str(p[0]) for p in parts[:5])))

keep = parts[RANK][2]
for _, _, o in parts:
    if o is not keep:
        bpy.data.objects.remove(o, do_unlink=True)

obj = keep
obj.name = "part"
me = obj.data
def e():
    xs=[v.co.x for v in me.vertices]; ys=[v.co.y for v in me.vertices]; zs=[v.co.z for v in me.vertices]
    return min(xs),max(xs),min(ys),max(ys),min(zs),max(zs)

x0,x1,y0,y1,z0,z1 = e()
if MODE == "flat":
    s = SIZE/max(x1-x0, y1-y0, 1e-6)
else:
    s = SIZE/max(z1-z0, 1e-6)
me.transform(mathutils.Matrix.Scale(s, 4)); me.update()
x0,x1,y0,y1,z0,z1 = e()
zref = (z0+z1)/2 if MODE == "flat" else z0
me.transform(mathutils.Matrix.Translation((-(x0+x1)/2, -(y0+y1)/2, -zref))); me.update()
x0,x1,y0,y1,z0,z1 = e()
obj.location = (0,0,0)

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
            l[uv].uv = (u*0.5, v*0.5)
    bm.to_mesh(me); bm.free(); me.update()

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=DST, export_format='GLB', use_selection=True,
    export_apply=True, export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6, export_image_format='JPEG',
    export_jpeg_quality=85, export_yup=True)
print("RESULT|ok|%s|tris=%d|dims=%.3f,%.3f,%.3f|mb=%.2f" % (
    os.path.basename(DST), sum(len(f.vertices)-2 for f in me.polygons),
    x1-x0, y1-y0, z1-z0, os.path.getsize(DST)/1048576.0))
