"""Report the loose-part layout of a prepared GLB so packed multi-piece files
can be spotted (and one piece picked) instead of being placed as a blob.

    blender --background --python inspect_parts.py -- <file.glb>
"""
import bpy, sys, os

SRC = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.mesh.separate(type='LOOSE')

parts = [o for o in bpy.data.objects if o.type == 'MESH']
print("PARTS|%s|%d" % (os.path.basename(SRC), len(parts)))
rows = []
for p in parts:
    vs = p.data.vertices
    if not vs:
        continue
    xs = [v.co.x for v in vs]; ys = [v.co.y for v in vs]; zs = [v.co.z for v in vs]
    tris = sum(len(f.vertices) - 2 for f in p.data.polygons)
    rows.append((tris, max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs),
                 (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
rows.sort(reverse=True)
for r in rows[:14]:
    print("P|tris=%6d|size=%.3f,%.3f,%.3f|centre=%.3f,%.3f,%.3f" % r)
