"""
v8 hero set - five angles of the dressed hall.

    blender --background <file.blend> --python render_hero_set.py -- <outdir> [sec_per_frame]
"""
import bpy, sys, os, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TL = float(argv[1]) if len(argv) > 1 else 260.0
os.makedirs(OUT, exist_ok=True)

sc = bpy.context.scene
vl = bpy.context.view_layer
sc.render.engine = 'CYCLES'
cy = sc.cycles

prefs = bpy.context.preferences.addons.get('cycles')
dev = "CPU"
if prefs:
    cp = prefs.preferences
    for be in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
        try:
            cp.compute_device_type = be
            cp.get_devices()
            if any(d.type == be for d in cp.devices):
                for d in cp.devices:
                    d.use = (d.type == be)
                sc.cycles.device = 'GPU'; dev = be; break
        except Exception:
            continue
print("DEVICE|%s" % dev)

cy.samples = 5000
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.005
cy.time_limit = TL
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'; cy.denoising_use_gpu = True
except Exception:
    pass
cy.max_bounces = 20
cy.diffuse_bounces = 2          # limited bounce is what keeps shadows deep in a light room
cy.glossy_bounces = 8
cy.transmission_bounces = 16
cy.transparent_max_bounces = 16
cy.caustics_reflective = True
cy.caustics_refractive = True
cy.blur_glossy = 0.6
if hasattr(cy, "volume_bounces"): cy.volume_bounces = 3

sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - High Contrast'
for a in ("filter_size", "filter_width"):
    if hasattr(sc.render, a):
        setattr(sc.render, a, 1.5); break

if hasattr(sc, "compositing_node_group"): sc.compositing_node_group = None
elif hasattr(sc, "use_nodes"): sc.use_nodes = False

lc = {c.name: c for c in vl.layer_collection.children}
lc["COL_Exterior"].exclude = True
lc["COL_Interior"].exclude = False
sc.world = bpy.data.worlds["W_Interior"]
vl.update()

cam = bpy.data.objects["SHOTCAM"]
sc.camera = cam
sc.render.resolution_percentage = 100

# name, position, target, lens, f-stop, exposure, resolution
SHOTS = [
    ("v8_1_hero",      (4.30, -4.60, 1.58), (-2.60,  1.70, 2.45), 26.0, 3.2, -0.15, (2000, 1250)),
    ("v8_2_leftwall",  (1.60, -1.05, 1.62), (-7.05,  1.35, 1.35), 35.0, 2.5, -0.10, (1800, 1200)),
    ("v8_3_stair",     (0.00, -5.10, 1.70), ( 0.00,  3.20, 3.20), 30.0, 4.0, -0.20, (1600, 1500)),
    ("v8_4_lookup",    (1.40, -3.30, 1.15), (-0.40, -0.30, 6.10), 24.0, 3.5, -0.65, (1600, 1500)),
    ("v8_5_station",   (2.60, -1.90, 1.45), (-5.95, -1.90, 1.25),135.0, 2.8, -0.05, (1900, 1050)),
    ("v8_6_holo_S1",   (-3.90, -1.90, 1.86), (-5.95, -1.90, 1.42), 85.0, 3.5, -0.05, (1800, 1200)),
    ("v8_7_holo_S2",   (-4.60,  1.55, 1.90), (-4.60,  3.80, 1.42), 85.0, 3.5, -0.05, (1800, 1200)),
]
for name, pos, look, lens, fstop, exp, res in SHOTS:
    sc.render.resolution_x, sc.render.resolution_y = res
    cam.data.lens = lens
    cam.data.sensor_width = 36.0
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = fstop
    P = mathutils.Vector(pos); L = mathutils.Vector(look)
    cam.data.dof.focus_distance = (L - P).length
    cam.location = P
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (L - P).to_track_quat('-Z', 'Y')
    old = sc.view_settings.exposure
    sc.view_settings.exposure = exp
    sc.render.filepath = os.path.join(OUT, name + ".png")
    vl.update()
    bpy.ops.render.render(write_still=True)
    sc.view_settings.exposure = old
    print("SHOT|%s" % name)
print("DONE")
