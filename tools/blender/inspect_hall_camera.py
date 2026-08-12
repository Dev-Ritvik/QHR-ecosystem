"""
Render the web scene's camera pose from Blender, to see what the browser sees.

    blender --background --python tools/blender/inspect_hall_camera.py -- \
        <glb> <out.png> <camX> <camY> <camZ> <tgtX> <tgtY> <tgtZ> [fov]

Coordinates are given in THREE space, exactly as they appear in poses.ts, and
converted here. Debugging the framing through a phone screen costs a rebuild and
a reload per guess and still never says *why* a frame is wrong; the same camera
placed in Blender answers it in one pass and can be moved freely.

The glTF importer turns the file's Y-up into Blender's Z-up, so
    blender (x, y, z)  ==  three (x, -z, y)
    three  (x, y, z)   ==  blender (x, -z, y)
which is the same swap poses.ts documents, applied in reverse.
"""

import sys
import math

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
glb, out = argv[0], argv[1]
cam_t = tuple(float(v) for v in argv[2:5])
tgt_t = tuple(float(v) for v in argv[5:8])
fov = float(argv[8]) if len(argv) > 8 else 45.0


def to_blender(p):
    """three (x, y, z) -> blender (x, -z, y)"""
    return mathutils.Vector((p[0], -p[2], p[1]))


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)

# ---------------------------------------------------------------------------
# Measure
# ---------------------------------------------------------------------------
mins = [1e9] * 3
maxs = [-1e9] * 3
meshes = 0
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    meshes += 1
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        for i in range(3):
            mins[i] = min(mins[i], w[i])
            maxs[i] = max(maxs[i], w[i])

print("MEASURE|objects=%d meshes=%d" % (len(bpy.data.objects), meshes))
print("MEASURE|blender bbox  x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f"
      % (mins[0], maxs[0], mins[1], maxs[1], mins[2], maxs[2]))
# three-space: x unchanged, y = blender z, z = -blender y
print("MEASURE|three   bbox  x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f"
      % (mins[0], maxs[0], mins[2], maxs[2], -maxs[1], -mins[1]))
print("MEASURE|floor(three y)=%.2f ceiling=%.2f height=%.2f"
      % (mins[2], maxs[2], maxs[2] - mins[2]))

# ---------------------------------------------------------------------------
# Camera at the requested pose
# ---------------------------------------------------------------------------
cam_data = bpy.data.cameras.new("web_cam")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(fov)
cam = bpy.data.objects.new("web_cam", cam_data)
bpy.context.scene.collection.objects.link(cam)

cam.location = to_blender(cam_t)
direction = to_blender(tgt_t) - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam

print("MEASURE|camera three=(%.2f,%.2f,%.2f) blender=(%.2f,%.2f,%.2f)"
      % (cam_t + tuple(cam.location)))

# Is the camera even inside the room?
inside = all(mins[i] <= cam.location[i] <= maxs[i] for i in range(3))
print("MEASURE|camera inside bbox: %s" % inside)
print("MEASURE|camera height above floor = %.2f m" % (cam.location[2] - mins[2]))

# ---------------------------------------------------------------------------
# Flat, fast render — geometry legibility is the question, not shading
# ---------------------------------------------------------------------------
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 900
scene.render.resolution_y = 1600      # portrait, like the phone
scene.render.resolution_percentage = 100
scene.render.filepath = out
shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "SINGLE"
shading.single_color = (0.62, 0.62, 0.60)
shading.show_cavity = True

bpy.ops.render.render(write_still=True)
print("RENDER|%s" % out)
