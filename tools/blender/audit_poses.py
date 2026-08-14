"""
Render every pose in poses.ts and report which ones see nothing.

    blender --background --python tools/blender/audit_poses.py -- <glb> <outdir>

Two poses have now shipped pointing at a blank wall and one standing outside
the building, each found only when somebody looked at the running site. Both
were hand-converted Blender coordinates that nobody had ever looked through.

This checks the whole file at once, so a bad pose is caught in the file rather
than on a client's screen. It reports two things per pose:

  INSIDE   is the camera within the model's bounds at all
  DETAIL   standard deviation of the rendered frame

The second is the useful one. A camera aimed at a flat wall renders an almost
uniform image, so near-zero variance means "this pose sees nothing" without
anybody having to open the file. A real interior vantage has columns, shadow
and edges, and scores an order of magnitude higher.
"""

import sys
import math

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
glb, outdir = argv[0], argv[1]

# Mirrors POSES in apps/public/src/components/experience/poses.ts (three space).
POSES = {
    "hall":          ((6.4, 1.65, 0.25),   (-5.27, 2.04, -0.95)),
    "hall.to":       ((1.95, 1.72, -0.2),  (-5.27, 1.85, -0.95)),
    "table":         ((-3.4, 1.6, 1.9),    (-5.95, 1.45, 1.9)),
    "approach":      ((0.9, 1.66, 0.6),    (-5.3, 1.72, -1.1)),
    "arrival":       ((6.9, 1.68, 3.1),    (-4.6, 1.90, -1.4)),
    "arrival.to":    ((3.4, 1.68, 1.9),    (-4.2, 1.78, -1.0)),
    "window":        ((-4.6, 1.58, -1.5),  (-4.6, 1.42, -3.8)),
    "study":         ((3.4, 1.6, -0.9),    (5.95, 1.42, -0.9)),
    "desk":          ((1.6, 1.6, 1.2),     (-1.0, 1.5, -1.4)),
}


def to_blender(p):
    """three (x, y, z) -> blender (x, -z, y)"""
    return mathutils.Vector((p[0], -p[2], p[1]))


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)

mins = [1e9] * 3
maxs = [-1e9] * 3
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        for i in range(3):
            mins[i] = min(mins[i], w[i])
            maxs[i] = max(maxs[i], w[i])

print("ROOM|three x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f"
      % (mins[0], maxs[0], mins[2], maxs[2], -maxs[1], -mins[1]))

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 320
scene.render.resolution_y = 560
scene.render.resolution_percentage = 100
sh = scene.display.shading
sh.light = "STUDIO"
sh.color_type = "SINGLE"
sh.single_color = (0.62, 0.62, 0.60)
sh.show_cavity = True

cam_data = bpy.data.cameras.new("c")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(45)
cam = bpy.data.objects.new("c", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

for name, (pos, tgt) in POSES.items():
    loc = to_blender(pos)
    cam.location = loc
    d = to_blender(tgt) - loc
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

    inside = all(mins[i] <= loc[i] <= maxs[i] for i in range(3))
    path = "%s/pose_%s.png" % (outdir, name.replace(".", "_"))
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

    img = bpy.data.images.load(path)
    px = list(img.pixels)
    lum = px[0::4]
    n = len(lum)
    mean = sum(lum) / n
    var = sum((v - mean) ** 2 for v in lum) / n
    sd = math.sqrt(var)
    bpy.data.images.remove(img)

    verdict = "OK" if (inside and sd > 0.04) else ("OUTSIDE ROOM" if not inside else "SEES NOTHING")
    print("POSE|%-10s inside=%-5s detail=%.4f  %s" % (name, inside, sd, verdict))
