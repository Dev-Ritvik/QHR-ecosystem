"""
Put the placed masonry on the same world-scale UVs as the wall it sits on.

THE DEFECT. build_stone_material_system.py states the rule the whole stone
system depends on:

    "Every stone object is re-projected as a world-axis box at exactly 1 UV
     unit per metre, with V on world Z - which is also what keeps courses
     horizontal and continuous around all four facades."

mansion_walls obeys it: its UVs run u -8.05..8.05, v -6.10..6.80, which is its
world extent in metres. The 267 ashlar blocks and 96 rustic blocks do not. They
were generated with LOCAL UVs centred on each block, so ashlar_WEST_028 runs
u -0.53..0.53, v -0.18..0.18. Measured across all 267 blocks there are only 30
distinct UV origins, and any two blocks sharing a kit mesh are texturally
identical.

Two things follow, and both are visible:

  * At the locked 3.33 m tile, u +/-0.53 is +/-16% of one tile. Every block on
    the building samples the same small central window of Marble026, so the
    masonry has no per-block tonal variation - the one cue that reads as cut
    stone rather than as a pattern.

  * The wall samples the whole texture and the blocks sample its centre, so
    the two read as different stone. That is the pale panel visible around
    every window at REV_WEST6 and at the south-west corner: not a stray
    object, not a material mismatch, just two different windows onto the same
    2048px marble.

WHY THIS UN-SHARES THE KIT MESHES. World UVs are a function of world position,
so two blocks in different places need different UVs, and UVs live on mesh
data. Shared kit meshes and world-scale UVs are mutually exclusive. The blocks
keep their shared GEOMETRY origin - the kit masters are untouched and every
block's vertices are unchanged - but each placed block now owns its mesh.

The cost is bounded: 267 + 96 mesh datablocks of ~24 vertices, roughly 4.5k
extra vertices on a 173k-triangle model, and no change at all to draw calls,
which were already one per block because a glTF node is a draw call whether or
not its mesh is shared.

    blender --background <file.blend> --python fix_masonry_uvs.py
"""
import bpy
import json

UV_PER_M = 1.0
PARKED_Z = -40.0


def box_uv(o, scale=UV_PER_M):
    """World-axis box projection, V on world Z. Same rule as the stone system."""
    me = o.data
    uvl = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    mw = o.matrix_world
    m3 = mw.to_3x3()
    for poly in me.polygons:
        n = m3 @ poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            w = mw @ me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                u, v = w.y, w.z          # +-X faces: V is world Z
            elif ax == 1:
                u, v = w.x, w.z          # +-Y faces: V is world Z
            else:
                u, v = w.x, w.y          # horizontal: plan projection
            uvl.data[li].uv = (u / scale, v / scale)


def placed_masonry():
    out = []
    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.data.vertices:
            continue
        if not (o.name.startswith("ashlar_") or o.name.startswith("rustic_")):
            continue
        if o.matrix_world.translation.z < PARKED_Z:      # kit masters stay put
            continue
        out.append(o)
    return out


targets = placed_masonry()
before_meshes = len(bpy.data.meshes)
shared_before = len({o.data.name for o in targets})

for o in targets:
    o.data = o.data.copy()               # world UVs cannot live on shared data
    box_uv(o)

# how much of the texture the masonry now covers, in tiles
def span(objs):
    us, vs = [], []
    for o in objs:
        uvl = o.data.uv_layers.get("UVMap")
        for d in uvl.data:
            us.append(d.uv[0])
            vs.append(d.uv[1])
    return [round(min(us), 2), round(max(us), 2), round(min(vs), 2), round(max(vs), 2)]


ash = [o for o in targets if o.name.startswith("ashlar_")]
rus = [o for o in targets if o.name.startswith("rustic_")]
origins = len({(round(min(d.uv[0] for d in o.data.uv_layers["UVMap"].data), 2),
                round(min(d.uv[1] for d in o.data.uv_layers["UVMap"].data), 2))
               for o in ash})

print("###UV###")
print(json.dumps({
    "retextured": len(targets), "ashlar": len(ash), "rustic": len(rus),
    "shared_meshes_before": shared_before,
    "unique_meshes_after": len({o.data.name for o in targets}),
    "mesh_datablocks": [before_meshes, len(bpy.data.meshes)],
    "distinct_ashlar_uv_origins": [30, origins],
    "ashlar_uv_span_u_v": span(ash),
    "rustic_uv_span_u_v": span(rus),
    "vertices_added": 0,
}))
