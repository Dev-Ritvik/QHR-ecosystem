"""
Isolate the ceiling gradient artifact.

Flat shading is already in force, so normal interpolation is ruled out. The
remaining suspects are (a) OpenImageDenoise smearing under-sampled indirect
light across a large low-variance surface, and (b) the volumetric haze.
Render the same frame three ways and compare.

    blender --background <file.blend> --python diag_ceiling.py -- <outdir>
"""
import bpy, sys, os, mathutils

OUT = sys.argv[sys.argv.index("--") + 1:][0]
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

cy.max_bounces = 20
cy.glossy_bounces = 8
cy.transmission_bounces = 16
cy.caustics_reflective = True
cy.caustics_refractive = True
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - High Contrast'
sc.view_settings.exposure = -0.65
if hasattr(sc, "compositing_node_group"): sc.compositing_node_group = None

lc = {c.name: c for c in vl.layer_collection.children}
lc["COL_Exterior"].exclude = True
sc.world = bpy.data.worlds["W_Interior"]
vl.update()

cam = bpy.data.objects["SHOTCAM"]; sc.camera = cam
P = mathutils.Vector((1.40, -3.30, 1.15)); L = mathutils.Vector((-0.40, -0.30, 6.10))
cam.data.lens = 24.0
cam.data.dof.use_dof = False
cam.location = P
cam.rotation_mode = 'QUATERNION'
cam.rotation_quaternion = (L - P).to_track_quat('-Z', 'Y')
sc.render.resolution_x = sc.render.resolution_y = 900

haze = bpy.data.objects.get("INT_HAZE")

def go(tag, samples, denoise, tlimit, haze_on=True):
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.002
    cy.time_limit = tlimit
    cy.use_denoising = denoise
    cy.diffuse_bounces = 2
    if haze: haze.hide_render = not haze_on
    sc.render.filepath = os.path.join(OUT, tag + ".png")
    vl.update(); bpy.ops.render.render(write_still=True)
    print("DIAG|%s|samples=%d|denoise=%s|haze=%s" % (tag, samples, denoise, haze_on))

go("A_current_denoised", 800, True,  150, True)
go("B_nodenoise_highsample", 4000, False, 300, True)
go("C_nodenoise_nohaze", 4000, False, 300, False)
if haze: haze.hide_render = False
print("DONE")
