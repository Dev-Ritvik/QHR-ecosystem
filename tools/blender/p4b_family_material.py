"""
P4B - rebind the four stone-family materials to the p4b_* sets.

    blender --background mansion_exterior_P4B.blend --python p4b_family_material.py -- --save

For each of MAT_Stone_Trim / Paving / Steps / Rustic: the three image nodes
are repointed at _stone/p4b_<key>_{basecolor,roughness,normal}.png (colour
spaces re-asserted), and the Normal Map strength is set to the value the
generator authored the height field for. Nothing else in the graph moves: the
Mapping scale (tile) is the same as v5 for every set, so the shipped
KHR_texture_transform stays valid; the COLOR_0 (StoneAO) multiply and the UV
projection are untouched. Every other material is asserted bit-identical.
"""
import bpy, os, sys, json

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
STONE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                     '..', '..', 'assets', 'materials', '_stone'))
SETS = {'MAT_Stone_Trim': ('trim', 0.65), 'MAT_Stone_Paving': ('paving', 0.80),
        'MAT_Stone_Steps': ('steps', 0.70), 'MAT_Stone_Rustic': ('rustic', 1.10)}


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


others = {m.name: snapshot(m) for m in bpy.data.materials if m.use_nodes and m.name not in SETS}


def feeder(sock):
    n = sock.links[0].from_node if sock.is_linked else None
    while n is not None and n.bl_idname != 'ShaderNodeTexImage':
        lk = [i for i in n.inputs if i.is_linked]
        n = lk[0].links[0].from_node if lk else None
    return n


def load(fn, cs):
    p = os.path.join(STONE, fn); key = os.path.splitext(fn)[0]
    im = bpy.data.images.get(key)
    if im is None:
        im = bpy.data.images.load(p); im.name = key
    im.filepath = p; im.source = 'FILE'; im.colorspace_settings.name = cs; im.reload()
    return im


log = {}
for mname, (key, nstr) in SETS.items():
    m = bpy.data.materials[mname]; nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    nmap = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeNormalMap')
    mix = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeMix' and n.name == 'Mix (Legacy)')
    a = [i for i in mix.inputs if i.name == 'A' and i.type == 'RGBA'][0]
    base_node, rough_node, nrm_node = feeder(a), feeder(bsdf.inputs['Roughness']), feeder(nmap.inputs['Color'])
    assert base_node and rough_node and nrm_node, mname
    before = [base_node.image.name, rough_node.image.name, nrm_node.image.name, round(nmap.inputs['Strength'].default_value, 3)]
    base_node.image = load('p4b_%s_basecolor.png' % key, 'sRGB')
    rough_node.image = load('p4b_%s_roughness.png' % key, 'Non-Color')
    nrm_node.image = load('p4b_%s_normal.png' % key, 'Non-Color')
    nmap.inputs['Strength'].default_value = nstr
    mp = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeMapping')
    log[mname] = {'before': before, 'after': [base_node.image.name, rough_node.image.name, nrm_node.image.name, nstr],
                  'tile_m': round(1.0 / mp.inputs['Scale'].default_value[0], 3)}

after = {m.name: snapshot(m) for m in bpy.data.materials if m.use_nodes and m.name not in SETS}
changed = [k for k in others if others[k] != after.get(k)]
assert not changed, changed
log['other_materials_changed'] = changed
print(json.dumps(log, indent=1))
if '--save' in args:
    bpy.ops.wm.save_mainfile(); print('### saved', bpy.data.filepath)
