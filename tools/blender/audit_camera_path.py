"""
Render the camera SPLINE, not just its keyframes.

    blender --background --python tools/blender/audit_camera_path.py \
        -- <exterior.glb> <outdir> [samples]

Keyframe auditing is not enough once the camera follows a curve. Every beat in
cameraPath.ts can be a good vantage and the path between two of them can still
fly through the fountain bowl or bulge out through a hedge - Catmull-Rom
overshoots on unevenly spaced control points, which is exactly what these are.

So this samples the whole path the way the browser will and checks three things
per sample:

  DETAIL    standard deviation of the rendered frame. Near-zero means the
            camera is looking at nothing - a flat wall, or open sky.
  SOLID     is the camera inside the mansion shell or inside the fountain
            cylinder. Either is a frame from inside solid geometry.
  GROUND    is the camera above the ground plane at all.

The Catmull-Rom below is three.js's centripetal implementation transcribed, not
an approximation of it. A different spline here would audit a path the browser
never takes, which is worse than not auditing at all.
"""

import sys
import math

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
glb, outdir = argv[0], argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 22

# Mirrors BEATS in apps/public/src/components/experience/cameraPath.ts
BEATS = [
    (0.00, (2.5, 12.5, 22.0), (0.0, 3.6, 0.0)),
    (0.22, (12.0, 14.0, 26.0), (0.0, 4.0, 0.0)),
    (0.48, (17.0, 7.5, 15.0), (0.0, 4.5, 0.0)),
    (0.74, (7.0, 2.2, 16.5), (0.0, 4.5, 4.0)),
    (1.00, (15.5, 5.2, 6.4), (0.0, 4.0, 0.0)),
]

# The fountain, as a solid cylinder the path must not enter.
FOUNTAIN = {"x": 0.0, "z": 13.2, "r": 3.1, "top": 2.7}


# ------------------------------------------------------- three.js CatmullRom

class CubicPoly:
    """three/src/extras/curves/CatmullRomCurve3.js"""

    def __init__(self):
        self.c0 = self.c1 = self.c2 = self.c3 = 0.0

    def init(self, x0, x1, t0, t1):
        self.c0 = x0
        self.c1 = t0
        self.c2 = -3 * x0 + 3 * x1 - 2 * t0 - t1
        self.c3 = 2 * x0 - 2 * x1 + t0 + t1

    def init_nonuniform(self, x0, x1, x2, x3, dt0, dt1, dt2):
        t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1
        t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2
        self.init(x1, x2, t1 * dt1, t2 * dt1)

    def calc(self, t):
        t2 = t * t
        return self.c0 + self.c1 * t + self.c2 * t2 + self.c3 * t2 * t


def catmullrom(points, t):
    """Centripetal Catmull-Rom, matching three's default curveType."""
    n = len(points)
    p = (n - 1) * t
    i = int(math.floor(p))
    weight = p - i
    if weight == 0 and i == n - 1:
        i = n - 2
        weight = 1.0

    p0 = points[i - 1] if i > 0 else [2 * points[0][k] - points[1][k] for k in range(3)]
    p1 = points[i]
    p2 = points[i + 1]
    p3 = points[i + 2] if i + 2 < n else [2 * points[n - 1][k] - points[n - 2][k] for k in range(3)]

    pow_ = 0.25  # centripetal
    out = []
    poly = CubicPoly()
    for k in range(3):
        def d(a, b):
            return math.sqrt(sum((a[j] - b[j]) ** 2 for j in range(3)))

        dt0 = d(p0, p1) ** pow_
        dt1 = d(p1, p2) ** pow_
        dt2 = d(p2, p3) ** pow_
        if dt1 < 1e-4:
            dt1 = 1.0
        if dt0 < 1e-4:
            dt0 = dt1
        if dt2 < 1e-4:
            dt2 = dt1
        poly.init_nonuniform(p0[k], p1[k], p2[k], p3[k], dt0, dt1, dt2)
        out.append(poly.calc(weight))
    return out


def curve_t(scroll):
    """Mirrors curveT() - remaps uneven beat positions onto curve parameter."""
    n = len(BEATS) - 1
    for i in range(n):
        a, b = BEATS[i][0], BEATS[i + 1][0]
        if scroll <= b:
            local = 0 if b == a else (scroll - a) / (b - a)
            return (i + local) / n
    return 1.0


def to_blender(p):
    """three (x, y, z) -> blender (x, -z, y)"""
    return mathutils.Vector((p[0], -p[2], p[1]))


# ---------------------------------------------------------------- scene setup

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)

# Shell bounds EXCLUDING the ground plane, which is 450m across and would make
# every possible camera position read as "inside the model".
mins = [1e9] * 3
maxs = [-1e9] * 3
for o in bpy.data.objects:
    if o.type != "MESH" or not o.data.vertices:
        continue
    if o.name.startswith("ground_plane"):
        continue
    if not o.name.startswith("mansion_"):
        continue
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        for i in range(3):
            mins[i] = min(mins[i], w[i])
            maxs[i] = max(maxs[i], w[i])

print("SHELL|blender x %.2f..%.2f y %.2f..%.2f z %.2f..%.2f"
      % (mins[0], maxs[0], mins[1], maxs[1], mins[2], maxs[2]))

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 1024
scene.render.resolution_y = 576
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

positions = [b[1] for b in BEATS]
targets = [b[2] for b in BEATS]

worst = []
for s in range(SAMPLES + 1):
    scroll = s / SAMPLES
    t = curve_t(scroll)
    pos = catmullrom(positions, t)
    tgt = catmullrom(targets, t)

    # Solid checks, in three space.
    in_shell = (mins[0] <= pos[0] <= maxs[0]
                and mins[2] <= pos[1] <= maxs[2]
                and -maxs[1] <= pos[2] <= -mins[1])
    dx = pos[0] - FOUNTAIN["x"]
    dz = pos[2] - FOUNTAIN["z"]
    in_fountain = (math.sqrt(dx * dx + dz * dz) < FOUNTAIN["r"]
                   and pos[1] < FOUNTAIN["top"])
    below_ground = pos[1] < 0.35

    loc = to_blender(pos)
    cam.location = loc
    cam.rotation_euler = (to_blender(tgt) - loc).to_track_quat("-Z", "Y").to_euler()

    path = "%s/path_%02d.png" % (outdir, s)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

    img = bpy.data.images.load(path)
    lum = list(img.pixels)[0::4]
    n = len(lum)
    mean = sum(lum) / n
    sd = math.sqrt(sum((v - mean) ** 2 for v in lum) / n)
    bpy.data.images.remove(img)

    flags = []
    if in_shell:
        flags.append("INSIDE-SHELL")
    if in_fountain:
        flags.append("IN-FOUNTAIN")
    if below_ground:
        flags.append("BELOW-GROUND")
    if sd < 0.06:
        flags.append("SEES-NOTHING")
    verdict = ",".join(flags) if flags else "ok"
    if flags:
        worst.append((scroll, verdict))

    print("PATH|s=%.3f detail=%.4f pos(%7.2f %5.2f %6.2f) tgt(%6.2f %5.2f %5.2f)  %s"
          % (scroll, sd, pos[0], pos[1], pos[2], tgt[0], tgt[1], tgt[2], verdict))

print("\nFAILURES: %d" % len(worst))
for s, v in worst:
    print("  s=%.3f  %s" % (s, v))
