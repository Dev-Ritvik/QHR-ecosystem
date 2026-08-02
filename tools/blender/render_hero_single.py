"""
ONE photorealistic hero frame of the main hall.

Deliberately expensive: this frame is the sign-off gate for the hybrid delivery
pipeline, so it is rendered offline with no regard for real-time budget.

    blender --background <file.blend> --python render_hero_single.py -- <outdir> [seconds]
"""
import bpy, sys, os, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TLIMIT = float(argv[1]) if len(argv) > 1 else 1200.0
os.makedirs(OUT, exist_ok=True)

sc = bpy.context.scene
vl = bpy.context.view_layer
sc.render.engine = 'CYCLES'
cy = sc.cycles

prefs = bpy.context.preferences.addons.get('cycles')
device = "CPU"
if prefs:
    cp = prefs.preferences
    for backend in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
        try:
            cp.compute_device_type = backend
            cp.get_devices()
            if any(d.type == backend for d in cp.devices):
                for d in cp.devices:
                    d.use = (d.type == backend)
                sc.cycles.device = 'GPU'
                device = backend
                break
        except Exception:
            continue
print("DEVICE|%s" % device)

cy.samples = 6000
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.004
cy.time_limit = TLIMIT
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_use_gpu = True
except Exception:
    pass
cy.max_bounces = 24
cy.diffuse_bounces = 2
cy.glossy_bounces = 8
cy.transmission_bounces = 16
cy.transparent_max_bounces = 16
cy.caustics_reflective = True
cy.caustics_refractive = True
cy.blur_glossy = 0.6
if hasattr(cy, "volume_bounces"):
    cy.volume_bounces = 4
if hasattr(cy, "volume_step_rate"):
    cy.volume_step_rate = 0.4

sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - High Contrast'
sc.view_settings.exposure = 0.35

# no compositor: Blender 5 does not feed a compositing node group the render
# result, and a half-wired group renders pure white. Glow ships in three.js.
if hasattr(sc, "compositing_node_group"):
    sc.compositing_node_group = None
elif hasattr(sc, "use_nodes"):
    sc.use_nodes = False

lc = {c.name: c for c in vl.layer_collection.children}
lc["COL_Exterior"].exclude = True
lc["COL_Interior"].exclude = False
sc.world = bpy.data.worlds["W_Interior"]
vl.update()

sc.render.resolution_x, sc.render.resolution_y = 2000, 1250
sc.render.resolution_percentage = 100
for _attr in ("filter_size", "filter_width"):      # renamed across versions
    if hasattr(sc.render, _attr):
        setattr(sc.render, _attr, 1.6)
        break

cam = bpy.data.objects["SHOTCAM"]
sc.camera = cam
POS  = mathutils.Vector((5.35, -4.35, 1.52))     # eye level, off-axis
LOOK = mathutils.Vector((-3.10,  1.30, 2.35))
cam.data.lens = 24.0
cam.data.sensor_width = 36.0
cam.data.dof.use_dof = True
cam.data.dof.aperture_fstop = 2.5
cam.data.dof.focus_distance = (LOOK - POS).length
cam.location = POS
cam.rotation_mode = 'QUATERNION'
cam.rotation_quaternion = (LOOK - POS).to_track_quat('-Z', 'Y')

sc.render.filepath = os.path.join(OUT, "HERO_hall.png")
vl.update()
bpy.ops.render.render(write_still=True)
print("HERO|done|focus=%.2fm" % cam.data.dof.focus_distance)
