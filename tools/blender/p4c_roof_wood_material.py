"""
P4C - rebind MAT_Roof_Slate and MAT_Wood_Dark to the p4c derived sets.

    blender --background mansion_exterior_P4C.blend --python p4c_roof_wood_material.py -- --save

MAT_Roof_Slate. The base-colour chain (Image -> MixRGB tint -> MixRGB half-AO)
and the roughness chain (Image -> MapRange 0.42..0.82) are replaced by ONE
image each: roof_slate/p4c_basecolor.png (tint, AO at 0.72, per-slate tone,
graphite shift all resolved) and roof_slate/p4c_roughness.png (ABSOLUTE,
remap applied). Blender and glTF now read identical maps with no node the
exporter cannot see; the material ships roughnessFactor 1.0. The normal map,
UV Map and everything else stay.

MAT_Wood_Dark. The object-space Mapping and the legacy MIX are replaced by a
UV Map -> Image chain for base, roughness and normal (wood_dark/p4c_*), so
Blender samples what the runtime samples. Roughness comes straight from the
map (the old Math x1.0 identity is dropped); Normal Map strength 0.60.

Both graphs keep their original nodes in the tree but unlinked from the BSDF,
so the authored intent is still inspectable. Every other material is asserted
bit-identical.
"""
import bpy, os, sys, json

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MATS = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'materials'))
TARGETS = ('MAT_Roof_Slate', 'MAT_Wood_Dark')


def snapshot(m):
    out = []
    for n in m.node_tree.nodes:
        row = [n.bl_idname, n.name]
        for i in n.inputs:
            if i.is_linked: row.append(('L', i.links[0].from_node.name, i.links[0].from_socket.name))
            else:
                try: v = i.default_value; row.append(tuple(v) if hasattr(v, '__len__') else v)
                except Exception: pass
        if n.bl_idname == 'ShaderNodeTexImage': row.append(n.image.name if n.image else None)
        out.append(tuple(row))
    return out


others = {m.name: snapshot(m) for m in bpy.data.materials if m.use_nodes and m.name not in TARGETS}


def load(rel, cs):
    p = os.path.join(MATS, rel); key = rel.replace('/', '_').replace('\\', '_').rsplit('.', 1)[0]
    im = bpy.data.images.get(key)
    if im is None:
        im = bpy.data.images.load(p); im.name = key
    im.filepath = p; im.source = 'FILE'; im.colorspace_settings.name = cs; im.reload()
    return im


def unlink(sock):
    for l in list(sock.links): sock.id_data.links.remove(l)


def tex_node(nt, image, uvnode, name, loc):
    n = nt.nodes.new('ShaderNodeTexImage'); n.name = name; n.label = name; n.image = image
    n.extension = 'REPEAT'; n.interpolation = 'Linear'; n.location = loc
    nt.links.new(uvnode.outputs['UV'], n.inputs['Vector']); return n


log = {}
# ---- roof ---------------------------------------------------------------
m = bpy.data.materials['MAT_Roof_Slate']; nt = m.node_tree
bsdf = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
uv = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeUVMap')
before = {'base': bsdf.inputs['Base Color'].links[0].from_node.name, 'rough': bsdf.inputs['Roughness'].links[0].from_node.name}
unlink(bsdf.inputs['Base Color']); unlink(bsdf.inputs['Roughness'])
b = tex_node(nt, load('roof_slate/p4c_basecolor.png', 'sRGB'), uv, 'P4C Base', (-300, 500))
r = tex_node(nt, load('roof_slate/p4c_roughness.png', 'Non-Color'), uv, 'P4C Rough', (-300, 200))
nt.links.new(b.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(r.outputs['Color'], bsdf.inputs['Roughness'])
log['MAT_Roof_Slate'] = {'before': before, 'after': {'base': b.image.name, 'rough': r.image.name}}

# ---- wood ---------------------------------------------------------------
m = bpy.data.materials['MAT_Wood_Dark']; nt = m.node_tree
bsdf = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
nmap = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeNormalMap')
before = {'base': bsdf.inputs['Base Color'].links[0].from_node.name, 'rough': bsdf.inputs['Roughness'].links[0].from_node.name,
          'normal_src': nmap.inputs['Color'].links[0].from_node.name, 'normal_strength': round(nmap.inputs['Strength'].default_value, 3)}
uvw = next((n for n in nt.nodes if n.bl_idname == 'ShaderNodeUVMap'), None)
if uvw is None:
    uvw = nt.nodes.new('ShaderNodeUVMap'); uvw.uv_map = 'UVMap'; uvw.name = 'P4C UV'; uvw.location = (-900, 0)
unlink(bsdf.inputs['Base Color']); unlink(bsdf.inputs['Roughness']); unlink(nmap.inputs['Color'])
wb = tex_node(nt, load('wood_dark/p4c_basecolor.png', 'sRGB'), uvw, 'P4C Base', (-300, 500))
wr = tex_node(nt, load('wood_dark/p4c_roughness.png', 'Non-Color'), uvw, 'P4C Rough', (-300, 200))
wn = tex_node(nt, load('wood_dark/p4c_normal.png', 'Non-Color'), uvw, 'P4C Normal', (-300, -100))
nt.links.new(wb.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(wr.outputs['Color'], bsdf.inputs['Roughness'])
nt.links.new(wn.outputs['Color'], nmap.inputs['Color']); nmap.inputs['Strength'].default_value = 0.60
log['MAT_Wood_Dark'] = {'before': before, 'after': {'base': wb.image.name, 'rough': wr.image.name, 'normal_src': wn.image.name, 'normal_strength': 0.60}}

after = {m2.name: snapshot(m2) for m2 in bpy.data.materials if m2.use_nodes and m2.name not in TARGETS}
changed = [k for k in others if others[k] != after.get(k)]
assert not changed, changed
log['other_materials_changed'] = changed
print(json.dumps(log, indent=1))
if '--save' in args:
    bpy.ops.wm.save_mainfile(); print('### saved', bpy.data.filepath)
