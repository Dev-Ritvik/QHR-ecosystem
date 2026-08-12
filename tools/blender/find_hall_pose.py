"""
Find a camera pose for the hall that actually frames the three tables.

    blender --background --python tools/blender/find_hall_pose.py -- <glb> <outdir>

The pose in poses.ts was a Blender coordinate converted by hand and never looked
through. Rendered, it stands beside the staircase with the treads filling the
frame - which is exactly what the phone showed. Guessing at replacements through
a device costs a rebuild per attempt, so this measures where the stations are,
derives candidate cameras from that geometry, and renders each one.

Blender is Z-up and the glTF importer converted the file's Y-up, so
    three (x, y, z) == blender (x, -z, y)
"""

import sys
import math

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
glb, outdir = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)


def world_bounds(objs):
    mins = [1e9] * 3
    maxs = [-1e9] * 3
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            for i in range(3):
                mins[i] = min(mins[i], w[i])
                maxs[i] = max(maxs[i], w[i])
    return mins, maxs


# ---------------------------------------------------------------------------
# Where are the three tables?
# ---------------------------------------------------------------------------
stations = {}
for tag in ("S1", "S2", "S3"):
    objs = [o for o in bpy.data.objects if ("holo3d_%s" % tag) in o.name]
    if not objs:
        continue
    mn, mx = world_bounds(objs)
    centre = [(mn[i] + mx[i]) / 2 for i in range(3)]
    stations[tag] = {"n": len(objs), "min": mn, "max": mx, "centre": centre}
    print("STATION|%s objects=%d centre blender=(%.2f,%.2f,%.2f) three=(%.2f,%.2f,%.2f) top_y=%.2f"
          % (tag, len(objs), centre[0], centre[1], centre[2],
             centre[0], centre[2], -centre[1], mx[2]))

if not stations:
    print("STATION|none found — listing a sample of object names")
    for o in list(bpy.data.objects)[:40]:
        print("   ", o.name)

# Everything, for the room extents
rmin, rmax = world_bounds(bpy.data.objects)
print("ROOM|blender x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f"
      % (rmin[0], rmax[0], rmin[1], rmax[1], rmin[2], rmax[2]))

# ---------------------------------------------------------------------------
# Candidate cameras, in THREE coordinates
# ---------------------------------------------------------------------------
EYE = 1.65

if stations:
    cx = sum(s["centre"][0] for s in stations.values()) / len(stations)
    cy = sum(s["centre"][1] for s in stations.values()) / len(stations)
    top = max(s["max"][2] for s in stations.values())
else:
    cx, cy, top = 0.0, 0.0, 1.0

# blender centre -> three
look_three = (cx, max(1.1, top - 0.15), -cy)

span_x = rmax[0] - rmin[0]
cands = []
# Stand back along +three-Z (= -blender-Y) at a few distances and heights.
for back in (5.2, 6.6, 7.8):
    for h in (EYE, EYE + 0.55):
        cands.append((round(cx, 2), round(h, 2), round(-cy + back, 2)))
# And one from each end of the long axis, for a raking view down the room.
cands.append((round(rmin[0] + 1.4, 2), EYE, round(-cy + 1.2, 2)))
cands.append((round(rmax[0] - 1.4, 2), EYE, round(-cy + 1.2, 2)))


def to_blender(p):
    return mathutils.Vector((p[0], -p[2], p[1]))


scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 760
scene.render.resolution_y = 1350
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

for i, p in enumerate(cands):
    cam.location = to_blender(p)
    d = to_blender(look_three) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    path = "%s/cand_%d.png" % (outdir, i)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("CAND|%d position=[%.2f, %.2f, %.2f] target=[%.2f, %.2f, %.2f] -> %s"
          % (i, p[0], p[1], p[2], look_three[0], look_three[1], look_three[2], path))
