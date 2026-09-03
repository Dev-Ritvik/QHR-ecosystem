"""
P4D - restraint on the accents: gold and water. Factors only, no textures.

    blender --background mansion_exterior_P4D.blend --python p4d_accents_material.py -- --save

MAT_Gold. gilt_aged/roughness has mean 0.28, and the graph multiplies it by
0.55, so the shipped brass sat at an effective ~0.15 - a mirror. Under the
daylight rig it was the brightest surface in the frame (138.7 against
Blender's 83.5, +55). Two changes, both exporter-visible:
  * the roughness scalar 0.55 -> 0.90 (effective mean ~0.25, range up to ~0.85
    where the map is worn): brass that catches light rather than the sky.
  * a Mix(MULTIPLY, Fac 1) tint (0.85, 0.80, 0.70) on the base colour - the
    modern Mix node, which the exporter reads as baseColorFactor. Aged gilt,
    slightly less yellow, not a colour change of kind.
MAT_Water. Roughness 0.02 -> 0.07: the fountain read as a mirror; a little
surface roughness breaks the sky reflection into water without touching the
ior 1.333 / transmission that make it read as water at all.

Glass is deliberately untouched (audit: exports faithfully, small screen
weight); the hedge, cypress and ground are Phase 5's.
Every other material is asserted bit-identical.
"""
import bpy, sys, json

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
TARGETS = ('MAT_Gold', 'MAT_Water')
GOLD_ROUGH, GOLD_TINT, WATER_ROUGH = 0.90, (0.85, 0.80, 0.70, 1.0), 0.07


def snapshot(m):
    out = []
    for n in m.node_tree.nodes:
        row = [n.bl_idname, n.name]
        for i in n.inputs:
            if i.is_linked: row.append(('L', i.links[0].from_node.name, i.links[0].from_socket.name))
            else:
                try: v = i.default_value; row.append(tuple(v) if hasattr(v, '__len__') else v)
                except Exception: pass
        out.append(tuple(row))
    return out


others = {m.name: snapshot(m) for m in bpy.data.materials if m.use_nodes and m.name not in TARGETS}
log = {}

m = bpy.data.materials['MAT_Gold']; nt = m.node_tree
bsdf = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
math = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeMath')
vals = [i for i in math.inputs if not i.is_linked]
old_r = vals[0].default_value; vals[0].default_value = GOLD_ROUGH
src = bsdf.inputs['Base Color'].links[0]; from_node, from_sock = src.from_node, src.from_socket
nt.links.remove(src)
mix = nt.nodes.new('ShaderNodeMix'); mix.name = 'P4D Tint'; mix.label = 'P4D Tint'
mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.location = (bsdf.location.x - 220, bsdf.location.y + 120)
mix.inputs['Factor'].default_value = 1.0
a = [i for i in mix.inputs if i.name == 'A' and i.type == 'RGBA'][0]
b = [i for i in mix.inputs if i.name == 'B' and i.type == 'RGBA'][0]
res = [o for o in mix.outputs if o.name == 'Result' and o.type == 'RGBA'][0]
nt.links.new(from_sock, a); b.default_value = GOLD_TINT; nt.links.new(res, bsdf.inputs['Base Color'])
log['MAT_Gold'] = {'roughness_scalar': [round(old_r, 3), GOLD_ROUGH], 'tint': list(GOLD_TINT[:3]), 'base_from': from_node.name}

m = bpy.data.materials['MAT_Water']; nt = m.node_tree
bsdf = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
old_w = bsdf.inputs['Roughness'].default_value; bsdf.inputs['Roughness'].default_value = WATER_ROUGH
log['MAT_Water'] = {'roughness': [round(old_w, 3), WATER_ROUGH]}

after = {m2.name: snapshot(m2) for m2 in bpy.data.materials if m2.use_nodes and m2.name not in TARGETS}
changed = [k for k in others if others[k] != after.get(k)]
assert not changed, changed
log['other_materials_changed'] = changed
print(json.dumps(log, indent=1))
if '--save' in args:
    bpy.ops.wm.save_mainfile(); print('### saved', bpy.data.filepath)
