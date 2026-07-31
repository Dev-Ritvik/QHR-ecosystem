"""Render a prepared kit piece so it can be eyeballed before placement.

    blender --background --python preview_asset.py -- <file.glb> <out.png> [angle]
"""
import bpy, sys, os, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
ANG = math.radians(float(argv[2])) if len(argv) > 2 else math.radians(35)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

objs = [o for o in bpy.data.objects if o.type == 'MESH']
for o in objs:                     # bake the importer's axis conversion so the
    mw = o.matrix_world.copy()     # preview camera sees the piece the same way
    o.parent = None                # the live scene will
    o.matrix_world = mw
for o in objs:
    o.data.transform(o.matrix_world)
    o.matrix_world = mathutils.Matrix.Identity(4)
pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
ctr = mathutils.Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))
rad = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs)) * 0.5 + 1e-3

# neutral clay so shape reads, not the source textures
clay = bpy.data.materials.new("clay")
clay.use_nodes = True
b = clay.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.82, 0.79, 0.73, 1)
b.inputs["Roughness"].default_value = 0.55
for o in objs:
    o.data.materials.clear()
    o.data.materials.append(clay)

d = rad * 3.4
cam_d = bpy.data.cameras.new("c"); cam_d.lens = 85
cam = bpy.data.objects.new("cam", cam_d)
bpy.context.scene.collection.objects.link(cam)
cam.location = ctr + mathutils.Vector((math.sin(ANG)*d, -math.cos(ANG)*d, d*0.45))
cam.rotation_mode = 'QUATERNION'
cam.rotation_quaternion = (ctr - cam.location).to_track_quat('-Z', 'Y')
bpy.context.scene.camera = cam

world = bpy.data.worlds.new("w"); bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.055, 0.07, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6

for pos, e in (((3, -4, 5), 1.0), ((-5, -2, 2), 0.35), ((0, 5, 3), 0.5)):
    ld = bpy.data.lights.new("l", 'AREA'); ld.size = rad * 4
    ld.energy = e * 900 * rad * rad
    lo = bpy.data.objects.new("l", ld)
    bpy.context.scene.collection.objects.link(lo)
    lo.location = ctr + mathutils.Vector(pos).normalized() * d
    lo.rotation_mode = 'QUATERNION'
    lo.rotation_quaternion = (ctr - lo.location).to_track_quat('-Z', 'Y')

sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x = sc.render.resolution_y = 460
sc.render.film_transparent = False
sc.render.filepath = OUT
sc.view_settings.view_transform = 'AgX'
bpy.ops.render.render(write_still=True)
print("PREVIEW|%s|extent=%.3f,%.3f,%.3f" % (
    os.path.basename(SRC), max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs)))
