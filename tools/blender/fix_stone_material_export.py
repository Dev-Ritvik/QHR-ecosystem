"""
Make the stone materials legible to the glTF exporter.

THE DEFECT. Blender 5.2's exporter reads base colour by walking back from the
Base Color socket looking for the pattern

    base colour = constant factor * colour attribute * texture

and it recognises that pattern ONLY through the modern Mix node. From
search_node_tree.get_multiply_factors:

    prev.node.type == 'MIX' and prev.node.data_type == 'RGBA'
    and prev.node.blend_type == 'MULTIPLY' and factor == 1

The five stone materials were built with ShaderNodeMixRGB, whose type is
'MIX_RGB', which has no data_type and whose sockets are Color1/Color2 rather
than #A_Color/#B_Color. Every one of those tests fails, so the exporter cannot
see past the node at all. Measured on the export it produces:

    MAT_Stone_Wall baseColorFactor = [1, 1, 1, 1]
        the locked #E7E3DA tint (linear 0.799/0.768/0.701) is simply gone.

    COLOR_0 = 255 on all 85,144 vertices of mansion_walls, with the real
        StoneAO landing in COLOR_1 (ushort, min 26214/65535 = 0.400 - the AO
        floor exactly). three.js binds COLOR_0 and ignores COLOR_1, so the AO
        ships in the file and does nothing.

Both are invisible in Blender, which renders the node tree directly.

THE FIX. Same arithmetic, a node the exporter can read. A Mix node in RGBA
MULTIPLY mode at factor 1 is bit-for-bit the same operation as MixRGB
MULTIPLY at factor 1, so nothing about the Blender render changes.

    blender --background <file.blend> --python fix_stone_material_export.py
"""
import bpy
import json

STONE = ("MAT_Stone_Wall", "MAT_Stone_Rustic", "MAT_Stone_Trim",
         "MAT_Stone_Paving", "MAT_Stone_Steps")


def rgba_sockets(node):
    """(A, B, Result) for a Mix node in RGBA mode - by type, not by index.

    ShaderNodeMix carries a socket pair for every data type it supports and
    they all share the names A / B / Result, so an index or a name lookup is
    a guess. The RGBA pair is the one whose type is 'RGBA'.
    """
    ins = [s for s in node.inputs if s.type == 'RGBA']
    outs = [s for s in node.outputs if s.type == 'RGBA']
    return ins[0], ins[1], outs[0]


def convert(mat):
    nt = mat.node_tree
    legacy = [n for n in nt.nodes if n.bl_idname == "ShaderNodeMixRGB"]
    done = []
    for old in legacy:
        name, label, loc = old.name, old.label, old.location.copy()
        blend = old.blend_type
        c1, c2 = old.inputs["Color1"], old.inputs["Color2"]
        out = old.outputs["Color"]

        new = nt.nodes.new("ShaderNodeMix")
        new.data_type = 'RGBA'
        new.blend_type = blend
        new.clamp_factor = True
        A, B, R = rgba_sockets(new)
        new.inputs[0].default_value = 1.0          # Factor (Float)

        for src, dst in ((c1, A), (c2, B)):
            if src.is_linked:
                nt.links.new(src.links[0].from_socket, dst)
            else:
                dst.default_value = tuple(src.default_value)
        targets = [l.to_socket for l in out.links]
        nt.nodes.remove(old)
        for t in targets:
            nt.links.new(R, t)

        new.location = loc
        new.name = name
        new.label = label
        done.append({"node": name, "blend": blend})
    return done


report = {}
for mn in STONE:
    m = bpy.data.materials.get(mn)
    if m is None or not m.use_nodes:
        continue
    report[mn] = {"converted": convert(m)}
    # what the exporter will now be able to read
    kinds = [(n.bl_idname, getattr(n, "blend_type", None),
              round(n.inputs[0].default_value, 3) if n.bl_idname == "ShaderNodeMix" else None)
             for n in m.node_tree.nodes if n.bl_idname in ("ShaderNodeMix", "ShaderNodeMixRGB")]
    report[mn]["now"] = kinds

# MAT_Gold shipped KHR_materials_anisotropy on geometry with no TANGENT, which
# makes the anisotropic lobe evaluate to NaN and the bloom pass smear it across
# the frame. It was being stripped downstream in apply_ktx2_safe_textures.py;
# the material never wanted it, so it comes out at source instead.
gold = bpy.data.materials.get("MAT_Gold")
aniso = None
if gold and gold.use_nodes:
    for n in gold.node_tree.nodes:
        if n.bl_idname == "ShaderNodeBsdfPrincipled":
            s = n.inputs.get("Anisotropic")
            if s is not None and not s.is_linked:
                aniso = round(s.default_value, 3)
                s.default_value = 0.0
            r = n.inputs.get("Anisotropic Rotation")
            if r is not None and not r.is_linked:
                r.default_value = 0.0
report["MAT_Gold"] = {"anisotropic_was": aniso, "anisotropic_now": 0.0}

print("###FIX###")
print(json.dumps(report))
