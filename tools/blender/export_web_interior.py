"""
Export the baked interior to GLB with the lightmap UV intact.

The awkward part is getting TEXCOORD_1 into the file at all. Blender's glTF
exporter only writes UV layers that some material actually samples, so an
unreferenced "UVLightmap" is silently dropped and the GLB arrives with nothing
to look the lightmap up with.

glTF has no lightmap slot, so the lightmap rides in the occlusion slot: sample
it through a UV Map node pinned to UVLightmap and feed the "glTF Material
Output" group, which the exporter turns into occlusionTexture with the right
texCoord index. GLTFLoader brings that in as material.aoMap on uv1, and one
line in three.js promotes it:

    mat.lightMap = mat.aoMap; mat.lightMapIntensity = <manifest scale>;

Shell materials are DUPLICATED before the lightmap is attached. Several of them
(MAT_Trim_Cream, MAT_Gold, MAT_MarbleFloor) are shared with props that have no
lightmap UV, and those props would otherwise sample a meaningless corner of the
atlas.

    blender --background mansion_web.blend --python export_web_interior.py \
        -- <manifest.json> <out.glb>
"""
import bpy, sys, os, json

argv = sys.argv[sys.argv.index("--") + 1:]
MANIFEST = argv[0]
DST = argv[1]
os.makedirs(os.path.dirname(DST), exist_ok=True)

man = json.load(open(MANIFEST))
SHELL = set(man["shell_objects"])
LM_PNG = os.path.join(os.path.dirname(MANIFEST), "lightmap.png")

sc = bpy.context.scene
vl = bpy.context.view_layer

lc = {c.name: c for c in vl.layer_collection.children}
if "COL_Exterior" in lc:
    lc["COL_Exterior"].exclude = True
vl.update()

# Drop everything that must not ship: the hidden KIT_ masters that exist only
# as instancing sources, and the volumetric haze proxy which is a render-time
# device with no meaning in a real-time scene.
drop = [o for o in bpy.data.objects
        if o.name == "INT_HAZE" or (o.type == 'MESH' and o.hide_render)]
for o in drop:
    bpy.data.objects.remove(o, do_unlink=True)
print("DROP|%d" % len(drop))

lm = bpy.data.images.load(LM_PNG, check_existing=True)
lm.colorspace_settings.name = 'sRGB'


def gltf_output_group():
    """The exporter looks for a group with this exact name and reads its
    'Occlusion' input. Build it if the scene has never had one."""
    name = "glTF Material Output"
    g = bpy.data.node_groups.get(name)
    if g:
        return g
    g = bpy.data.node_groups.new(name, 'ShaderNodeTree')
    for sock in ("Occlusion", "Thickness"):
        try:
            g.interface.new_socket(sock, in_out='INPUT', socket_type='NodeSocketFloat')
        except AttributeError:                      # pre-4.0 interface API
            g.inputs.new('NodeSocketFloat', sock)
    g.nodes.new('NodeGroupInput')
    return g


grp = gltf_output_group()

pairs = {}
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name not in SHELL:
        continue
    if "UVLightmap" not in o.data.uv_layers:
        continue
    for i, m in enumerate(o.data.materials):
        if m is None:
            continue
        if m.name.endswith("_LM"):
            continue
        lmat = pairs.get(m.name)
        if lmat is None:
            lmat = m.copy()
            lmat.name = m.name + "_LM"
            nt = lmat.node_tree
            uvn = nt.nodes.new('ShaderNodeUVMap')
            uvn.uv_map = "UVLightmap"
            uvn.location = (-1200, 700)
            tex = nt.nodes.new('ShaderNodeTexImage')
            tex.image = lm
            tex.location = (-1000, 700)
            tex.interpolation = 'Linear'
            tex.extension = 'CLIP'
            gn = nt.nodes.new('ShaderNodeGroup')
            gn.node_tree = grp
            gn.location = (-700, 700)
            nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
            nt.links.new(tex.outputs['Color'], gn.inputs['Occlusion'])
            pairs[m.name] = lmat
        o.data.materials[i] = lmat
print("LMMAT|%d" % len(pairs))

# glTF has no bump node. Where a Principled Normal is driven by BUMP, the
# exporter falls back to writing the bump's HEIGHT texture into normalTexture -
# so the rug shipped its 16-bit greyscale displacement map as a normal map,
# which is both wrong for shading and unreadable to the texture toolchain.
# Both rug materials already feed a proper NormalGL map into the bump's Normal
# input, so bypass the bump and wire that straight through.
bypassed = []
for m in bpy.data.materials:
    nt = getattr(m, "node_tree", None)
    if not nt:
        continue
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not b or not b.inputs['Normal'].is_linked:
        continue
    src = b.inputs['Normal'].links[0].from_node
    if src.type != 'BUMP' or not src.inputs['Normal'].is_linked:
        continue
    nt.links.new(src.inputs['Normal'].links[0].from_socket, b.inputs['Normal'])
    bypassed.append(m.name)
print("BUMP|bypassed=%s" % ",".join(bypassed) if bypassed else "BUMP|none")

# The lightmap UV must not become the render UV for the PBR maps.
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    for l in o.data.uv_layers:
        l.active_render = (l.name != "UVLightmap")

# Select an explicit interior set rather than "everything visible". Two traps
# caught this export the first time round:
#   * EXT_HAZE is a 480m volumetric box that lives in the Scene Collection, so
#     excluding COL_Exterior does not remove it - it shipped and blew the scene
#     bounds out to +/-240m.
#   * The KIT_ masters are instancing SOURCES parked at z=-50. They are not
#     hidden, so they exported as real geometry sitting under the floor.
interior = bpy.data.collections["COL_Interior"]
vis = []
for o in interior.all_objects:
    if o.type not in {'MESH', 'LIGHT'}:
        continue
    if o.hide_render or not o.visible_get():
        continue
    if o.name.startswith("KIT_") or o.name.endswith("_master") or "HAZE" in o.name:
        continue
    if o.matrix_world.translation.z < -20.0:
        continue
    vis.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in vis:
    o.select_set(True)
if vis:
    vl.objects.active = vis[0]
print("EXPORT|objects=%d" % len(vis))

kw = dict(
    filepath=DST, export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True,
    export_texcoords=True, export_normals=True,
    export_materials='EXPORT', export_image_format='AUTO',
    export_cameras=False, export_lights=True,
    export_extras=False, export_animations=False,
    # Draco is applied later by gltf-transform together with KTX2, so that the
    # texture pass does not have to decode and re-encode the geometry.
    export_draco_mesh_compression_enable=False,
)
try:
    bpy.ops.export_scene.gltf(**kw)
except TypeError as e:
    print("EXPORT|retry-without:%s" % e)
    for k in ("export_image_format", "export_extras", "export_lights"):
        kw.pop(k, None)
    bpy.ops.export_scene.gltf(**kw)

print("WROTE|%s|%.2fMB" % (DST, os.path.getsize(DST) / 1048576.0))
print("DONE")
