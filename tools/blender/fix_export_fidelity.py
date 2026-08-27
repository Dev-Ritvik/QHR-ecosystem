"""
Two export-fidelity defects found by reading the shipped GLB, not the viewport.

1. THE CARPET DYE WAS NOT SURVIVING EXPORT.
   MAT_Runner drove base colour through RGBToBW -> MapRange -> Mix(multiply).
   glTF has no node graph, and the Blender exporter cannot represent that chain,
   so it emitted the raw Carpet013 texture with a default white factor. Both
   runner materials then exported identically and dedup merged them, taking the
   contrasting binding tape with it. The runner would have shipped pale beige.

   Rebuilt in the one shape the exporter does understand:
       Image Texture -> Mix(MULTIPLY, constant) -> Base Color
   which becomes baseColorTexture x baseColorFactor. The constants are solved
   from the measured Carpet013 linear average so the exported colour matches
   the reviewed oxblood rather than approximating it.

2. STATION S4 WAS RENDERING WHITE.
   MAT_Holo3D_Top_S4 exported as pbrMetallicRoughness:{}, and glTF's default
   baseColorFactor is [1,1,1,1] - opaque white. Both the S4 plate and blocks
   bound to it, so the "data-disabled" station would have shipped as a white
   slab. Authored explicitly dark instead, and kept plate and top distinct so
   both station binding names survive dedup.

    blender --background mansion_web.blend --python fix_export_fidelity.py
"""
import bpy, json

D = bpy.data
CDIR = r"C:\dev\estate\assets\New assets\_x\Carpet013_2K-PNG"
import os

# Solved from the measured Carpet013 linear average [0.3998, 0.1245, 0.1177]
# against the reviewed targets, so texture x factor lands on the same colour.
DYE = {
    "MAT_Runner":         (0.2551, 0.1855, 0.1453),   # deep oxblood wool
    "MAT_Runner_Binding": (0.0725, 0.1004, 0.0833),   # near-black bound edge
}

def img(fn, nc=False):
    p = os.path.join(CDIR, fn)
    if not os.path.exists(p):
        return None
    key = "Carpet013_" + fn.split("_")[-1]
    i = D.images.get(key) or D.images.load(p)
    i.name = key
    if nc:
        i.colorspace_settings.name = 'Non-Color'
    return i

report = {"carpet": {}, "s4": {}}

for name, factor in DYE.items():
    m = D.materials.get(name)
    if m is None:
        continue
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (620, 0)
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); bs.location = (360, 0)
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.location = (-820, 0)
    uvn.uv_map = 'UVMap'

    def tex(fn, nc, y):
        im = img(fn, nc)
        if not im:
            return None
        n = nt.nodes.new('ShaderNodeTexImage'); n.location = (-580, y)
        n.image = im; n.extension = 'REPEAT'
        nt.links.new(uvn.outputs['UV'], n.inputs['Vector'])
        return n

    col = tex('Carpet013_2K-PNG_Color.png', False, 260)
    rgh = tex('Carpet013_2K-PNG_Roughness.png', True, 0)
    nrm = tex('Carpet013_2K-PNG_NormalGL.png', True, -260)

    if col:
        mix = nt.nodes.new('ShaderNodeMixRGB'); mix.location = (-260, 260)
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Fac'].default_value = 1.0
        mix.inputs['Color2'].default_value = (*factor, 1.0)
        nt.links.new(col.outputs['Color'], mix.inputs['Color1'])
        nt.links.new(mix.outputs['Color'], bs.inputs['Base Color'])
    if rgh:
        nt.links.new(rgh.outputs['Color'], bs.inputs['Roughness'])
    else:
        bs.inputs['Roughness'].default_value = 0.88
    if nrm:
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.location = (-260, -260)
        nt.links.new(nrm.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    bs.inputs['Metallic'].default_value = 0.0
    m.use_backface_culling = True
    report["carpet"][name] = {"baseColorFactor": [round(c, 4) for c in factor],
                              "maps": {"color": bool(col), "rough": bool(rgh), "normal": bool(nrm)}}

# ---- S4: authored dark, and plate distinct from top -----------------------
def flat(name, rgb, alpha, blend):
    m = D.materials.get(name)
    if m is None:
        m = D.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (300, 0)
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); bs.location = (60, 0)
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    bs.inputs['Base Color'].default_value = (*rgb, 1.0)
    bs.inputs['Metallic'].default_value = 0.0
    bs.inputs['Roughness'].default_value = 1.0
    if 'Alpha' in bs.inputs:
        bs.inputs['Alpha'].default_value = alpha
    if 'Emission Strength' in bs.inputs:
        bs.inputs['Emission Strength'].default_value = 0.0
    if 'Emission Color' in bs.inputs:
        bs.inputs['Emission Color'].default_value = (0.0, 0.0, 0.0, 1.0)
    try:
        m.blend_method = blend
    except Exception:
        pass
    m.use_backface_culling = False
    return m

# no fourth project is published: the plate shows nothing, the block tops read
# as unlit dark geometry. Distinct so both binding names survive dedup.
flat("MAT_Holo3D_Plate_S4", (0.0, 0.0, 0.0), 0.0, 'BLEND')
flat("MAT_Holo3D_Top_S4",   (0.0, 0.0, 0.0), 1.0, 'OPAQUE')
for s in ("Plate", "Top"):
    n = "MAT_Holo3D_%s_S4" % s
    m = D.materials.get(n)
    b = next((x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED'), None)
    report["s4"][n] = {"baseColor": [round(c, 3) for c in b.inputs['Base Color'].default_value[:3]],
                       "alpha": round(b.inputs['Alpha'].default_value, 3) if 'Alpha' in b.inputs else None,
                       "blend": getattr(m, 'blend_method', None)}

bpy.ops.wm.save_mainfile()
print("###FIDELITY###")
print(json.dumps(report, indent=1))
