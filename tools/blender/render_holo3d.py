"""
Prove the raked hologram tables from the angles the client says fail.

Every shot is at standing eye height (1.55-1.68 m). Two of them are deliberate
side/profile views, because the whole point of the extrusion is that the
display must still read when you are not standing square to it.

    blender --background <file.blend> --python render_holo3d.py -- <outdir> [sec] [scale]
"""
import bpy, sys, os, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TL = float(argv[1]) if len(argv) > 1 else 200.0
SCALE = float(argv[2]) if len(argv) > 2 else 1.0
os.makedirs(OUT, exist_ok=True)

sc = bpy.context.scene
vl = bpy.context.view_layer
sc.render.engine = 'CYCLES'
cy = sc.cycles

prefs = bpy.context.preferences.addons.get('cycles')
dev = "CPU"
if prefs:
    cp = prefs.preferences
    for be in ('OPTIX', 'CUDA', 'HIP'):
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

cy.samples = 4000
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.005
cy.time_limit = TL
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'; cy.denoising_use_gpu = True
except Exception:
    pass
cy.max_bounces = 20
cy.diffuse_bounces = 2
cy.glossy_bounces = 8
cy.transmission_bounces = 16
cy.transparent_max_bounces = 32       # stacked emissive-on-transparent prisms
cy.caustics_reflective = True
cy.caustics_refractive = True

sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - High Contrast'
if hasattr(sc, "compositing_node_group"):
    sc.compositing_node_group = None

lc = {c.name: c for c in vl.layer_collection.children}
lc["COL_Exterior"].exclude = True
lc["COL_Interior"].exclude = False
sc.world = bpy.data.worlds["W_Interior"]
vl.update()

cam = bpy.data.objects["SHOTCAM"]
sc.camera = cam
sc.render.resolution_percentage = 100

# name, eye, target, lens, f-stop, exposure, resolution
SHOTS = [
    # --- S1 Kartikeya, approached from +X. Framed low and wide enough to keep
    #     the pedestal in shot, so the table reads as a display and not as a
    #     drawing hanging in mid air.
    ("h1_S1_eye",     (-3.40, -1.90, 1.60), (-5.95, -1.90, 1.45),  40.0, 5.6, -0.05, (1800, 1300)),
    ("h1_S1_oblique", (-3.80, -3.55, 1.64), (-5.98, -2.00, 1.50),  40.0, 5.0, -0.05, (1800, 1300)),
    ("h1_S1_profile", (-5.05, -3.95, 1.55), (-6.05, -1.98, 1.68),  85.0, 4.0, -0.90, (1800, 1150)),
    # --- S2 Lucky Garden, approached from -Y
    ("h1_S2_eye",     (-4.60,  1.50, 1.58), (-4.60,  3.80, 1.42),  40.0, 5.6, -0.05, (1800, 1300)),
    ("h1_S2_oblique", (-3.00,  1.95, 1.62), (-4.62,  3.80, 1.48),  40.0, 5.0, -0.05, (1800, 1300)),
    # --- S3 VSR Gayatri Township, on the opposite wall, approached from -X
    ("h1_S3_eye",     ( 3.40,  0.90, 1.60), ( 5.95,  0.90, 1.42),  40.0, 5.6, -0.05, (1800, 1300)),
    ("h1_S3_oblique", ( 3.75,  2.55, 1.64), ( 5.98,  1.00, 1.50),  40.0, 5.0, -0.05, (1800, 1300)),
    # --- both in the room, to check they still sit inside the architecture
    ("h1_wide",       ( 0.90, -0.60, 1.66), (-5.30,  1.10, 1.72),  28.0, 4.5, -0.10, (2000, 1250)),
]
ONLY = argv[3] if len(argv) > 3 else None
for name, pos, look, lens, fstop, exp, res in SHOTS:
    if ONLY and ONLY not in name:
        continue
    sc.render.resolution_x = int(res[0] * SCALE)
    sc.render.resolution_y = int(res[1] * SCALE)
    cam.data.lens = lens
    cam.data.sensor_width = 36.0
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = fstop
    P = mathutils.Vector(pos); L = mathutils.Vector(look)
    cam.data.dof.focus_distance = (L - P).length
    cam.location = P
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (L - P).to_track_quat('-Z', 'Y')
    sc.view_settings.exposure = exp
    sc.render.filepath = os.path.join(OUT, name + ".png")
    vl.update()
    bpy.ops.render.render(write_still=True)
    print("SHOT|%s" % name)
print("DONE")
