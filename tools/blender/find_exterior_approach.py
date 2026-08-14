"""
Find the approach pose: outside the mansion, looking at the facade.

    blender --background --python tools/blender/find_exterior_approach.py \
        -- <exterior.glb> <outdir>

The homepage has been opening inside the hall since it was built, which was
never what the brief asked for. The exterior set exists in COL_Exterior and has
been exported this whole time; nothing was ever pointed at it.

Two jobs here, in order:

  1. DISCOVER. Report world bounds and per-prefix centroids so the facade is
     identified from geometry rather than from the guess that "F" means front.
     Every camera mistake on this project came from a hand-converted coordinate
     nobody rendered.

  2. SCORE. Render a ring of candidate approach vantages and report the
     standard deviation of each frame. A camera aimed at sky or at a blank
     wall renders near-uniform; a facade with columns, shadow and a roofline
     scores an order of magnitude higher. Same test as audit_poses.py.
"""

import sys
import math
from collections import defaultdict

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
glb, outdir = argv[0], argv[1]


def to_three(v):
    """blender (x, y, z) -> three (x, z, -y)"""
    return (v[0], v[2], -v[1])


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)

mins = [1e9] * 3
maxs = [-1e9] * 3
groups = defaultdict(lambda: [mathutils.Vector((0, 0, 0)), 0, [1e9] * 3, [-1e9] * 3])

for o in bpy.data.objects:
    if o.type != "MESH" or not o.data.vertices:
        continue
    # Prefix up to the first digit: archglass_F0 -> archglass_F
    stem = o.name.rstrip("0123456789").rstrip(".")
    g = groups[stem]
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        g[0] += w
        g[1] += 1
        for i in range(3):
            mins[i] = min(mins[i], w[i])
            maxs[i] = max(maxs[i], w[i])
            g[2][i] = min(g[2][i], w[i])
            g[3][i] = max(g[3][i], w[i])

print("BOUNDS|blender x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f"
      % (mins[0], maxs[0], mins[1], maxs[1], mins[2], maxs[2]))
tlo, thi = to_three(mins), to_three(maxs)
print("BOUNDS|three   x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f"
      % (min(tlo[0], thi[0]), max(tlo[0], thi[0]),
         min(tlo[1], thi[1]), max(tlo[1], thi[1]),
         min(tlo[2], thi[2]), max(tlo[2], thi[2])))

for stem in sorted(groups):
    c, n, lo, hi = groups[stem]
    c = c / n
    print("PART|%-22s centroid b(%7.2f %7.2f %7.2f)  y %7.2f..%7.2f  z %6.2f..%6.2f"
          % (stem, c[0], c[1], c[2], lo[1], hi[1], lo[2], hi[2]))

# ---------------------------------------------------------------- render rig

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
# 16:9. The client reviews on a desktop browser, and a portrait render of a
# landscape frame hides exactly the thing being judged — how much clear space
# the headline has on the left. sensor_fit VERTICAL with angle_y 45 matches
# three.js fov=45, so the vertical extent is right and the width follows aspect.
scene.render.resolution_x = 1024
scene.render.resolution_y = 576
scene.render.resolution_percentage = 100
sh = scene.display.shading
sh.light = "STUDIO"
sh.color_type = "SINGLE"
sh.single_color = (0.62, 0.62, 0.60)
sh.show_cavity = True
scene.render.film_transparent = False

cam_data = bpy.data.cameras.new("c")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(45)
cam = bpy.data.objects.new("c", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

# Candidates in THREE space, written from the discovery pass above.
#
# The facade faces +Z: door_handle sits at blender y -5.22 and the fountain at
# -13.2, both of which map to positive three z. So the approach runs down the
# +Z axis toward the origin, with the fountain as the foreground object it
# passes. Ground is three y = 0; eye height 1.65.
#
# Candidates are not swept round a ring, because the mansion has one front and
# a ring wastes twelve renders on the back of it. These sample the corridor:
# distance along the axis, a three-quarter offset, and one elevated vantage.
CANDIDATES = {
    #                    position                target
    "axis_far":      ((0.0, 1.65, 30.0),   (0.0, 4.20, 0.0)),
    "axis_mid":      ((0.0, 1.65, 24.0),   (0.0, 4.00, 0.0)),
    "axis_fountain": ((0.0, 1.65, 19.0),   (0.0, 3.60, 0.0)),
    "axis_near":     ((0.0, 1.65, 13.0),   (0.0, 3.00, 0.0)),
    "axis_steps":    ((0.0, 1.65, 9.0),    (0.0, 2.40, 0.0)),
    "quarter_far":   ((8.5, 1.65, 26.0),   (0.0, 4.00, 0.0)),
    "quarter_mid":   ((7.0, 1.70, 20.0),   (0.0, 3.60, 0.0)),
    "quarter_near":  ((5.0, 1.68, 14.0),   (0.0, 2.90, 0.0)),
    "high_far":      ((0.0, 6.50, 27.0),   (0.0, 3.80, 0.0)),
    "high_quarter":  ((9.0, 5.50, 22.0),   (0.0, 3.60, 0.0)),

    # The pair actually shipped as POSES.arrival. Rendered explicitly rather
    # than interpolated from neighbours, because "close to a pose that scored
    # well" is how the last three broken cameras got through.
    "SHIP_from":     ((0.0, 1.65, 30.0),   (-7.0, 4.20, 0.0)),
    "SHIP_to":       ((0.0, 1.65, 18.0),   (-3.2, 3.40, 0.0)),
}


def to_blender(p):
    """three (x, y, z) -> blender (x, -z, y)"""
    return mathutils.Vector((p[0], -p[2], p[1]))


results = []
for name, (pos, tgt) in CANDIDATES.items():
    loc = to_blender(pos)
    cam.location = loc
    cam.rotation_euler = (to_blender(tgt) - loc).to_track_quat("-Z", "Y").to_euler()

    path = "%s/ext_%s.png" % (outdir, name)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

    img = bpy.data.images.load(path)
    lum = list(img.pixels)[0::4]
    n = len(lum)
    mean = sum(lum) / n
    sd = math.sqrt(sum((v - mean) ** 2 for v in lum) / n)
    bpy.data.images.remove(img)

    results.append((sd, name, pos, tgt))
    print("CAND|%-15s detail=%.4f  pos(%6.2f %5.2f %6.2f) target(%5.2f %5.2f %5.2f)"
          % (name, sd, pos[0], pos[1], pos[2], tgt[0], tgt[1], tgt[2]))

print("\nBEST (highest detail first):")
for sd, name, p, t in sorted(results, reverse=True):
    print("  %.4f  %-15s position: [%.2f, %.2f, %.2f]  target: [%.2f, %.2f, %.2f]"
          % (sd, name, p[0], p[1], p[2], t[0], t[1], t[2]))
