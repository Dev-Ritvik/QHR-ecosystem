"""
Web-optimised GLB export.

The full-quality export lands at ~1.85M tris for the hall, which will not hold
60fps in a browser. Ornament meshes are instanced, so the budget is spent per
DATABLOCK, weighted by how many objects use it: a baluster used 54 times gets a
small budget, a one-off hero piece gets a large one.

Decimation is applied once per shared mesh, so every instance benefits.
Pieces built from many small disconnected parts (crystal chandeliers) shatter
under aggressive decimation, so they are floored much higher.

    blender --background <file.blend> --python export_web_lod.py -- <outdir>
"""
import bpy, sys, os

OUT = sys.argv[sys.argv.index("--") + 1:][0]
os.makedirs(OUT, exist_ok=True)

SETS = {
    "exterior_mansion_web": "COL_Exterior",
    "interior_hall_web":    "COL_Interior",
}
BUDGET   = 60000        # tris allotted to a mesh used exactly once
FLOOR    = 380          # never go below this, however many instances
FRAGILE  = ("chandelier", "crystal")   # many-small-islands: decimate gently
FRAGILE_MIN = 90000

vl = bpy.context.view_layer
lc = {c.name: c for c in vl.layer_collection.children}

def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

def shippable(col):
    out = []
    for o in bpy.data.collections[col].objects:
        if o.type != 'MESH' or not o.data.vertices: continue
        if o.hide_render: continue
        if o.location.z < -40: continue          # parked masters
        if o.name.startswith(("KIT_", "SHOTCAM")): continue
        out.append(o)
    return out

# Geometry is only half the payload - 2K PBR maps dominate the GLB. Halving
# them to 1K is invisible at the distances this scene is ever viewed from.
MAXTEX = 1024
scaled = []
for im in bpy.data.images:
    w, h = im.size
    if w > MAXTEX or h > MAXTEX:
        f = MAXTEX / float(max(w, h))
        try:
            im.scale(max(1, int(w * f)), max(1, int(h * f)))
            scaled.append("%s %dx%d->%dx%d" % (im.name, w, h, im.size[0], im.size[1]))
        except Exception:
            pass
print("TEXSCALE|%d images" % len(scaled))

report = []
for tag, colname in SETS.items():
    for n, c in lc.items():
        c.exclude = (n != colname)
    vl.update()

    objs = shippable(colname)
    before = sum(tris(o.data) for o in objs)

    users = {}
    for o in objs:
        users.setdefault(o.data.name, []).append(o)

    for mname, holders in users.items():
        me = bpy.data.meshes[mname]
        cur = tris(me)
        fragile = any(k in mname.lower() or any(k in h.name.lower() for h in holders)
                      for k in FRAGILE)
        target = max(FLOOR, int(BUDGET / len(holders)))
        if fragile:
            target = max(target, FRAGILE_MIN)
        if cur <= target:
            continue
        ob = holders[0]
        mod = ob.modifiers.new("weblod", 'DECIMATE')
        mod.ratio = max(0.002, target / cur)
        dg = bpy.context.evaluated_depsgraph_get()
        newmesh = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        ob.modifiers.remove(mod)
        for h in holders:
            h.data = newmesh

    objs = shippable(colname)
    after = sum(tris(o.data) for o in objs)

    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

    dst = os.path.join(OUT, tag + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=dst, export_format='GLB', use_selection=True, export_apply=True,
        export_yup=True, export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6, export_image_format='JPEG',
        export_jpeg_quality=80)
    print("WEBLOD|%s|objs=%d|tris %d -> %d|mb=%.2f" % (
        tag, len(objs), before, after, os.path.getsize(dst) / 1048576.0))

for n, c in lc.items():
    c.exclude = False
print("DONE")
