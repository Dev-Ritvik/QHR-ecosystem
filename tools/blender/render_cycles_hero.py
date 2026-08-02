"""
Cycles hero renders of the hall.

The EEVEE previews were lit by a flat dark world, which is why metal read as
paint and the ceiling above the chandelier stayed black: mirror-finish materials
can only show what there is to reflect, and EEVEE's screen-space raytracing
cannot bounce light from geometry that is off-camera. Cycles resolves both.

    blender --background <file.blend> --python render_cycles_hero.py -- <outdir> [time_limit_s]
"""
import bpy, sys, os, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TLIMIT = float(argv[1]) if len(argv) > 1 else 300.0
os.makedirs(OUT, exist_ok=True)

sc = bpy.context.scene
vl = bpy.context.view_layer
sc.render.engine = 'CYCLES'
cy = sc.cycles

# GPU if this box has one, otherwise CPU - either way the time limit bounds it
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
print("CYCLES_DEVICE|%s" % device)

cy.samples = 512
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.01
cy.time_limit = TLIMIT
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
cy.max_bounces = 12
cy.diffuse_bounces = 4
cy.glossy_bounces = 4
cy.transmission_bounces = 8
cy.transparent_max_bounces = 8
cy.caustics_reflective = True
cy.caustics_refractive = True

sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Base Contrast'

# Bloom via the compositor. Blender 5 replaced scene.node_tree with a
# compositing node group, so probe for whichever API this build exposes and
# skip the glow rather than fail the render if neither is present.
def add_bloom():
    # Build the tree FIRST and only attach it to the scene once it is complete.
    # A half-built group left assigned gives the compositor no output path, and
    # the render then silently writes no file at all.
    nt, ng = None, None
    if hasattr(sc, "compositing_node_group"):
        ng = bpy.data.node_groups.new("HeroComp", "CompositorNodeTree")
        nt = ng
    elif hasattr(sc, "node_tree"):
        sc.use_nodes = True
        nt = sc.node_tree
    if nt is None:
        return "unavailable"
    nt.nodes.clear()
    gl = nt.nodes.new("CompositorNodeGlare"); gl.location = (0, 0)
    # Blender 5 turned every Glare setting into an input socket; older builds
    # keep them as node properties. Drive whichever this build exposes.
    want = (("Type", 'BLOOM'), ("Quality", 'HIGH'), ("Threshold", 0.85),
            ("Strength", 0.42), ("Size", 8), ("Smoothness", 0.6))
    for name, val in want:
        if name in gl.inputs:
            try: gl.inputs[name].default_value = val
            except Exception: pass
        else:
            attr = {"Type": "glare_type", "Quality": "quality"}.get(name, name.lower())
            try: setattr(gl, attr, val)
            except Exception: pass
    if ng is not None:
        gi = nt.nodes.new("NodeGroupInput");  gi.location = (-300, 0)
        go = nt.nodes.new("NodeGroupOutput"); go.location = (320, 0)
        nt.interface.new_socket("Image", in_out='INPUT',  socket_type='NodeSocketColor')
        nt.interface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')
        nt.links.new(gi.outputs[0], gl.inputs["Image"])
        nt.links.new(gl.outputs["Image"], go.inputs[0])
        sc.compositing_node_group = ng          # attach only now that it is wired
    else:
        rl = nt.nodes.new("CompositorNodeRLayers"); rl.location = (-300, 0)
        cm = nt.nodes.new("CompositorNodeComposite"); cm.location = (320, 0)
        nt.links.new(rl.outputs["Image"], gl.inputs["Image"])
        nt.links.new(gl.outputs["Image"], cm.inputs["Image"])
    return "ok"

# Bloom is DISABLED here on purpose. In Blender 5 a compositing node group's
# Group Input is not fed the render result, so Glare processes an unconnected
# white socket and every frame comes out pure white. Glow belongs in the
# three.js post stack for this project anyway - that is where it ships.
# Pass "bloom" as the 3rd arg to re-enable and experiment.
WANT_BLOOM = len(argv) > 2 and argv[2] == "bloom"
if WANT_BLOOM:
    try:
        print("BLOOM|%s" % add_bloom())
    except Exception as e:
        if hasattr(sc, "compositing_node_group"): sc.compositing_node_group = None
        elif hasattr(sc, "use_nodes"): sc.use_nodes = False
        print("BLOOM|failed: %s" % e)
else:
    if hasattr(sc, "compositing_node_group"): sc.compositing_node_group = None
    elif hasattr(sc, "use_nodes"): sc.use_nodes = False
    print("BLOOM|off (three.js post handles glow)")

# interior set only
lc = {c.name: c for c in vl.layer_collection.children}
lc["COL_Exterior"].exclude = True
lc["COL_Interior"].exclude = False
sc.world = bpy.data.worlds["W_Interior"]
vl.update()

cam = bpy.data.objects["SHOTCAM"]
sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = 1500, 845
sc.render.film_transparent = False

SHOTS = [
    ("cy_hall",       (5.6, -4.6, 3.2), (-2.6, 2.4, 2.6), 24.0, 9.0,  0.40),
    ("cy_chandelier", (0.0, -3.2, 1.6), (0.0, -0.6, 5.6), 35.0, 4.6,  0.30),
    ("cy_stair",      (0.0, -5.0, 1.8), (0.0,  3.2, 2.5), 30.0, 8.0,  0.35),
]
for name, pos, look, lens, focus, exp in SHOTS:
    cam.data.lens = lens
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 2.8
    cam.data.dof.focus_distance = focus
    cam.location = mathutils.Vector(pos)
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (mathutils.Vector(look) - cam.location).to_track_quat('-Z', 'Y')
    old = sc.view_settings.exposure
    sc.view_settings.exposure = old + exp
    sc.render.filepath = os.path.join(OUT, name + ".png")
    vl.update()
    bpy.ops.render.render(write_still=True)
    sc.view_settings.exposure = old
    print("RENDERED|%s" % name)

print("DONE")
