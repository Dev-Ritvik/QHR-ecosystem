"""
Dedicated hologram-plane shots.

The plans lie flat at z=1.445, so an eye-level camera sees them edge-on and a
shallow f-stop dissolves them. These look down from above with enough depth of
field to hold the whole plate sharp.

    blender --background <file.blend> --python render_holo_shots.py -- <outdir> [sec]
"""
import bpy, sys, os, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TL = float(argv[1]) if len(argv) > 1 else 220.0
os.makedirs(OUT, exist_ok=True)

sc = bpy.context.scene
vl = bpy.context.view_layer
sc.render.engine = 'CYCLES'
cy = sc.cycles
prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    cp = prefs.preferences
    for be in ('OPTIX', 'CUDA', 'HIP'):
        try:
            cp.compute_device_type = be; cp.get_devices()
            if any(d.type == be for d in cp.devices):
                for d in cp.devices: d.use = (d.type == be)
                sc.cycles.device = 'GPU'; break
        except Exception: pass

cy.samples = 4000
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.004
cy.time_limit = TL
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'; cy.denoising_use_gpu = True
except Exception: pass
cy.max_bounces = 20
cy.diffuse_bounces = 2
cy.glossy_bounces = 8
cy.transmission_bounces = 16
cy.transparent_max_bounces = 24      # emissive-on-transparent needs headroom
cy.caustics_reflective = True
cy.caustics_refractive = True

sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - High Contrast'
if hasattr(sc, "compositing_node_group"): sc.compositing_node_group = None

lc = {c.name: c for c in vl.layer_collection.children}
lc["COL_Exterior"].exclude = True
lc["COL_Interior"].exclude = False
sc.world = bpy.data.worlds["W_Interior"]
vl.update()

cam = bpy.data.objects["SHOTCAM"]; sc.camera = cam
SHOTS = [
    ("holo_S1_kartikeya", (-4.28, -3.05, 2.62), (-5.95, -1.90, 1.44), 58.0, 9.0, 0.10, (1900, 1250)),
    ("holo_S2_luckygarden", (-3.28,  2.66, 2.62), (-4.60,  3.80, 1.44), 58.0, 9.0, 0.10, (1900, 1250)),
    ("holo_S1_wide",      (-3.10, -3.60, 2.05), (-5.95, -1.90, 1.30), 42.0, 6.0, 0.05, (1900, 1250)),
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
    sc.view_settings.exposure = exp
    sc.render.filepath = os.path.join(OUT, name + ".png")
    vl.update()
    bpy.ops.render.render(write_still=True)
    print("SHOT|%s" % name)
print("DONE")
