"""
Export the v7 estate to a raw GLB for the web chain.

    blender --background mansion_estate_V7.blend --python export_estate_v7.py -- <out_raw.glb>

Raw means: no Draco and PNG textures, so gltf-transform and the KTX2 encoder own
the geometry and texture passes (the same contract as export_web_interior.py).

GPU INSTANCING. Every tree and palm is a linked duplicate parented to one empty
per species (veg_*). With export_gpu_instances the exporter writes each empty as
ONE node carrying EXT_mesh_gpu_instancing, which three's GLTFLoader turns into an
InstancedMesh: 400 trees cost a handful of draw calls and one copy of each mesh
in the file.
"""
import os
import sys

import bpy

DST = sys.argv[sys.argv.index("--") + 1]
os.makedirs(os.path.dirname(DST), exist_ok=True)

col = bpy.data.collections["COL_Estate_V7"]
keep = set()
for ob in col.all_objects:
    if ob.type in {"MESH", "EMPTY"}:
        keep.add(ob.name)

bpy.ops.object.select_all(action="DESELECT")
for ob in bpy.data.objects:
    if ob.name in keep:
        ob.hide_set(False)
        ob.select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects[next(iter(keep))]

bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_gpu_instances=True,
    export_draco_mesh_compression_enable=False,
    export_image_format="AUTO",
    export_texcoords=True,
    export_normals=True,
    # The trees' baked crown occlusion (build_estate_v7.card_tree_mesh) rides
    # as COLOR_0; nothing else in the estate carries a colour attribute.
    export_vertex_color="ACTIVE",
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_extras=False,
)
tris = 0
for ob in bpy.data.objects:
    if ob.name in keep and ob.type == "MESH":
        tris += sum(len(p.vertices) - 2 for p in ob.data.polygons)
print("EXPORT_RAW|%s|objects=%d|tris_incl_instances=%d|mb=%.2f" % (DST, len(keep), tris, os.path.getsize(DST) / 1048576.0))
