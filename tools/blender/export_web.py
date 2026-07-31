"""
Export the interior and exterior sets as separate web GLBs.

The two sets overlap in Y (the interior hall is deeper than the exterior shell),
so they are exported one collection at a time - which is also how the front end
consumes them: exterior for the approach, interior for the hall.

Runs headless against the saved .blend so a long Draco pass cannot lock the
live MCP bridge:

    blender --background <file.blend> --python export_web.py -- <outdir>
"""
import bpy, sys, os

OUT = sys.argv[sys.argv.index("--") + 1:][0]
os.makedirs(OUT, exist_ok=True)

SETS = {
    "exterior_mansion_v4": "COL_Exterior",
    "interior_hall_v6":    "COL_Interior",
}

vl = bpy.context.view_layer
lc = {c.name: c for c in vl.layer_collection.children}

def visible_meshes(colname):
    col = bpy.data.collections[colname]
    out = []
    for o in col.objects:
        if o.type != 'MESH' or not o.data.vertices:
            continue
        if o.hide_render:
            continue
        # masters are parked far below the scene - never ship them
        if o.location.z < -40:
            continue
        if o.name.startswith(("KIT_", "SHOTCAM")):
            continue
        out.append(o)
    return out

for tag, colname in SETS.items():
    for n, c in lc.items():
        c.exclude = (n != colname)
    vl.update()

    objs = visible_meshes(colname)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
    dst = os.path.join(OUT, tag + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=dst,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_image_format='JPEG',
        export_jpeg_quality=82,
    )
    print("EXPORT|%s|objs=%d|tris=%d|mb=%.2f" % (
        tag, len(objs), tris, os.path.getsize(dst) / 1048576.0))

for n, c in lc.items():
    c.exclude = False
print("DONE")
