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

_args = sys.argv[sys.argv.index("--") + 1:]
OUT = _args[0]
ONLY = set(_args[1:])          # optional: export only these set tags
RAW = os.environ.get("GLTF_RAW") == "1"
os.makedirs(OUT, exist_ok=True)

# A SET IS A LIST OF COLLECTIONS, not one collection.
#
# The 267 ashlar blocks live in COL_Ashlar_<FACADE>, which are SIBLINGS of
# COL_Exterior at scene level - that is how the generator builds and rebuilds
# them, and how survey_facades.py hides them without touching the exterior. The
# previous single-name form gathered COL_Exterior.objects only, so the export
# shipped the mansion with every block missing and nobody would have seen it
# until the GLB was in the browser.
#
# COL_Ashlar_<FACADE>_KIT is a CHILD of each of those and holds the 78 shared
# master meshes parked at z -50. all_objects would sweep them in, so they are
# filtered out below by name and by depth.
SETS = {
    "exterior_mansion_v4": ["COL_Exterior", "COL_Ashlar_West", "COL_Ashlar_East",
                            "COL_Ashlar_North", "COL_Ashlar_South"],
    "interior_hall_v6":    ["COL_Interior"],
}

vl = bpy.context.view_layer
lc = {c.name: c for c in vl.layer_collection.children}

# The station rig (STATION_* / TURNTABLE_* / HOLO_*) is empties, not meshes.
# The web binds stations by those node names and rotates TURNTABLE_*, so they
# have to survive the export or the hierarchy flattens and the turntable is
# gone. Selecting them alongside the meshes keeps the parent chain intact.
RIG_PREFIXES = ("STATION_", "TURNTABLE_", "HOLO_")


def visible_meshes(colnames):
    seen = set()
    objs = []
    for cn in colnames:
        for o in bpy.data.collections[cn].all_objects:
            if o.name not in seen:
                seen.add(o.name)
                objs.append(o)
    out = []
    for o in objs:
        if o.type == 'EMPTY':
            if o.name.startswith(RIG_PREFIXES):
                out.append(o)
            continue
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

for tag, colnames in SETS.items():
    if ONLY and tag not in ONLY:
        continue
    keep = set(colnames)
    for n, c in lc.items():
        c.exclude = (n not in keep)
    vl.update()

    objs = visible_meshes(colnames)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in objs if o.type == 'MESH')
    meshes = len({o.data.name for o in objs if o.type == 'MESH'})
    dst = os.path.join(OUT, tag + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=dst,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        # GLTF_RAW=1 hands off to the KTX2 chain instead: Draco and the JPEG
        # recompress both have to stay off so gltf-transform/ktx can own the
        # geometry and texture passes (same contract as export_web_interior).
        export_draco_mesh_compression_enable=not RAW,
        export_draco_mesh_compression_level=6,
        export_image_format=('AUTO' if RAW else 'JPEG'),
        export_jpeg_quality=82,
    )
    print("EXPORT|%s|objs=%d|meshes=%d|tris=%d|mb=%.2f" % (
        tag, len(objs), meshes, tris, os.path.getsize(dst) / 1048576.0))

for n, c in lc.items():
    c.exclude = False
print("DONE")
