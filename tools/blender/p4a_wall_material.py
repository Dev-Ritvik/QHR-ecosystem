"""
P4A - rebind MAT_Stone_Wall from the marble026 scan to the limestone surface set.

    blender --background mansion_exterior_P4A.blend --python p4a_wall_material.py -- --save

Changes exactly three things on MAT_Stone_Wall and nothing else in the file:
  * the three image nodes point at _stone/limestone_{basecolor,roughness,normal}.png
    (colour spaces re-asserted: sRGB / Non-Color / Non-Color)
  * Mapping scale 0.3003 (3.33 m marble tile) -> 1/1.20 (the limestone tile)
  * Normal Map strength 1.2 -> 0.85. The marble normal needed 1.2 to read at
    all; the limestone map carries pores authored for the 6 m camera and the
    block relief is geometry, so the map is turned DOWN, not up.

Preserved deliberately, because the audit classified them A/D:
  * the Tint Mix (#E7E3DA, linear 0.7991/0.7682/0.7011) - the exporter's
    baseColorFactor. The texture is authored pale so tint x texture lands on
    the limestone target (0.54, 0.51, 0.44).
  * the COLOR_0 (StoneAO) multiply, which now also carries per-block tone.
  * the UV Map / world-box projection at 1 UV per metre.
  * roughness wired straight from the roughness image (no remap - nothing for
    the exporter to lose).
Asserts every other material's node values are bit-identical afterwards.
"""
import bpy, os, sys, json

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
STONE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                     '..', '..', 'assets', 'materials', '_stone'))
TILE = 1.20
NRM = 0.85


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


others = {m.name: snapshot(m) for m in bpy.data.materials
          if m.use_nodes and m.name != 'MAT_Stone_Wall'}

m = bpy.data.materials['MAT_Stone_Wall']; nt = m.node_tree
tex = {n.name: n for n in nt.nodes if n.bl_idname == 'ShaderNodeTexImage'}
bsdf = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
mapping = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeMapping')
nmap = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeNormalMap')

# identify which image node feeds which slot by following links, not by name
def feeder(sock):
    n = sock.links[0].from_node if sock.is_linked else None
    while n is not None and n.bl_idname != 'ShaderNodeTexImage':
        lk = [i for i in n.inputs if i.is_linked]
        n = lk[0].links[0].from_node if lk else None
    return n
base_node = None
for n in nt.nodes:
    if n.bl_idname == 'ShaderNodeMix' and n.name == 'Mix (Legacy)':
        a = [i for i in n.inputs if i.name == 'A' and i.type == 'RGBA'][0]
        base_node = feeder(a)
rough_node = feeder(bsdf.inputs['Roughness'])
nrm_node = feeder(nmap.inputs['Color'])
assert base_node and rough_node and nrm_node, (base_node, rough_node, nrm_node)
before = {k: v.image.name for k, v in (('base', base_node), ('rough', rough_node), ('nrm', nrm_node))}


def load(fn, cs):
    p = os.path.join(STONE, fn); key = os.path.splitext(fn)[0]
    im = bpy.data.images.get(key)
    if im is None:
        im = bpy.data.images.load(p); im.name = key
    im.filepath = p; im.source = 'FILE'; im.colorspace_settings.name = cs; im.reload()
    return im

base_node.image = load('limestone_basecolor.png', 'sRGB')
rough_node.image = load('limestone_roughness.png', 'Non-Color')
nrm_node.image = load('limestone_normal.png', 'Non-Color')
for n in (base_node, rough_node, nrm_node): n.extension = 'REPEAT'; n.interpolation = 'Linear'
old_scale = tuple(mapping.inputs['Scale'].default_value)
mapping.inputs['Scale'].default_value = (1.0 / TILE, 1.0 / TILE, 1.0)
old_nrm = nmap.inputs['Strength'].default_value
nmap.inputs['Strength'].default_value = NRM

after = {m2.name: snapshot(m2) for m2 in bpy.data.materials if m2.use_nodes and m2.name != 'MAT_Stone_Wall'}
changed = [k for k in others if others[k] != after.get(k)]
assert not changed, changed
tint = next(n for n in nt.nodes if n.name == 'Tint')
tint_b = [i for i in tint.inputs if i.name == 'B' and i.type == 'RGBA'][0].default_value
print(json.dumps({'images_before': before,
                  'images_after': {'base': base_node.image.name, 'rough': rough_node.image.name, 'nrm': nrm_node.image.name},
                  'mapping_scale': [round(x, 4) for x in old_scale], 'mapping_scale_after': round(1 / TILE, 4),
                  'normal_strength': [round(old_nrm, 3), NRM],
                  'tint_kept': [round(x, 4) for x in tint_b][:3],
                  'other_materials_changed': changed}, indent=1))
if '--save' in args:
    bpy.ops.wm.save_mainfile(); print('### saved', bpy.data.filepath)
