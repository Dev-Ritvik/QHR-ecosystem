"""
Several of the ornament downloads are kit SHEETS - a row of separate medallions
or parallel moulding strips authored in one file. Placing the whole sheet gives
a smear of geometry, so this isolates one piece.

Loose parts are binned along an axis; contiguous runs (separated by a gap larger
than GAP) form groups, and the group carrying the most triangles wins.

    blender --background --python isolate_band.py -- <src.glb> <dst.glb> <axis> <gap> <mode> <size>

mode:
  disc  - flat medallion. Scaled so its largest horizontal extent = size.
          Origin at TOP centre so it mounts flush under a ceiling.
  strip - moulding run. Scaled so its Z (profile height) = size, kept running
          along Y. Origin at centre of the profile, y-start at 0.
"""
import bpy, sys, os, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST, AXIS, GAP, MODE, SIZE = argv[0], argv[1], argv[2], float(argv[3]), argv[4], float(argv[5])
AI = "xyz".index(AXIS)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
# the glTF importer parks its axis conversion on a parent empty - bake it in,
# otherwise export_apply re-applies it and the piece lands on its side
mw = obj.matrix_world.copy()
obj.parent = None
obj.matrix_world = mw
obj.data.transform(obj.matrix_world)
obj.matrix_world = mathutils.Matrix.Identity(4)

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.mesh.separate(type='LOOSE')

parts = []
for p in [o for o in bpy.data.objects if o.type == 'MESH']:
    vs = p.data.vertices
    if not vs:
        continue
    co = [v.co[AI] for v in vs]
    tris = sum(len(f.vertices) - 2 for f in p.data.polygons)
    parts.append([(min(co) + max(co)) / 2, tris, p])
parts.sort(key=lambda r: r[0])

groups, cur = [], [parts[0]]
for prev, nxt in zip(parts, parts[1:]):
    if nxt[0] - prev[0] > GAP:
        groups.append(cur); cur = []
    cur.append(nxt)
groups.append(cur)

scored = sorted(((sum(r[1] for r in g), i, g) for i, g in enumerate(groups)), reverse=True)
print("GROUPS|%d|%s" % (len(groups), ",".join(str(s) for s, _, _ in scored[:8])))
keep = scored[0][2]
keep_set = {id(r[2]) for r in keep}

for _, _, p in parts:
    if id(p) not in keep_set:
        bpy.data.objects.remove(p, do_unlink=True)

survivors = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for s in survivors:
    s.select_set(True)
bpy.context.view_layer.objects.active = survivors[0]
if len(survivors) > 1:
    bpy.ops.object.join()
obj = bpy.context.active_object
obj.name = "piece"
me = obj.data

def ext3():
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)

x0, x1, y0, y1, z0, z1 = ext3()
if MODE == "disc":
    s = SIZE / max(x1 - x0, y1 - y0, 1e-6)
else:
    s = SIZE / max(z1 - z0, 1e-6)
me.transform(mathutils.Matrix.Scale(s, 4)); me.update()
x0, x1, y0, y1, z0, z1 = ext3()

if MODE == "disc":
    # origin at top centre - hangs flush against a ceiling plane
    me.transform(mathutils.Matrix.Translation((-(x0 + x1) / 2, -(y0 + y1) / 2, -z1)))
else:
    # origin at the profile centre, run starting at y=0
    me.transform(mathutils.Matrix.Translation((-(x0 + x1) / 2, -y0, -(z0 + z1) / 2)))
me.update()
x0, x1, y0, y1, z0, z1 = ext3()
obj.location = (0, 0, 0)

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

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(
    filepath=DST, export_format='GLB', use_selection=True, export_apply=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_image_format='JPEG', export_jpeg_quality=85, export_yup=True)

print("RESULT|ok|%s|tris=%d|dims=%.3f,%.3f,%.3f|mb=%.2f" % (
    os.path.basename(DST), sum(len(f.vertices) - 2 for f in me.polygons),
    x1 - x0, y1 - y0, z1 - z0, os.path.getsize(DST) / 1048576.0))
