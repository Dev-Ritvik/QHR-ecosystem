"""
P5D / P5E - give the hedge and the cypresses a surface. Material only.

    blender --background <blend> --python p5de_foliage_materials.py -- --only hedge   --save
    blender --background <blend> --python p5de_foliage_materials.py -- --only cypress --save

THE DEFECT. Both materials are a single baseColorFactor and nothing else:
MAT_Hedge (0.026, 0.052, 0.018), MAT_Cypress (0.019, 0.038, 0.015), no map of
any kind. Together they hold 3.8% of the HERO frame, 5.5% at WEST and 5.8% at
NW - the second-largest soft-landscape mass after the ground - and the
emissive-id mask measures the hedge at L 52.3 sd 20.3 and the cypress at L 44.2
sd 15.8, where essentially all of that deviation is the cast shadow rather than
surface. They render as near-black paper cutouts.

WHY THIS IS MATERIAL ONLY, AND NOT GEOMETRY. The obvious next move is to give
the hedge a clipped profile - a slight batter on the sides, a softened top
arris - because that is what separates a real clipped hedge from an extruded
rectangle. Measured, it is not worth doing: the hedge stands 13 m from the HERO
camera at 0.010 m per pixel, so a 40 mm batter is FOUR PIXELS across the whole
1.0 m height, and the top arris radius that would read is smaller still. Buying
that costs a geometry change, a bounds waiver in the graft, and a re-ship of
three meshes - for detail below what any camera in the sequence resolves. The
brief is explicit that nothing gets added because it could be improved. So the
hedge keeps its 0.82 x 0.96 m section, which is a correct clipped-hedge form,
and gains the surface it never had.

The same argument settles the FRONT of the property, which has no hedge between
the two runs' ends at y -19. That gap is not an omission - it is the arrival,
and P5A's forecourt now runs through it. Closing it would wall off the drive.

WHAT CHANGES. Each material moves from a bare factor to a UV Map -> Image chain
for base colour, roughness and normal, on the 1.5 m tiling sets from
tools/gltf/make_foliage_p5.py, with box-projected world-scale UVs written onto
the meshes so the tile is 1.5 m on every face regardless of which way it points.
The factor is dropped to (1,1,1): the colour now lives in the texture, where it
can carry structure, rather than in a constant.

Every other material and every other object is asserted bit-identical.
"""
import bpy, json, os, sys

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = args[args.index('--only') + 1] if '--only' in args else 'hedge'
MATS = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                    '..', '..', 'assets', 'materials'))
TILE_M = 1.5

SPEC = {
    'hedge':   {'mat': 'MAT_Hedge',   'prefix': '_foliage/p5_hedge_',   'nrm': 0.85,
                'objects': ('hedge_b', 'hedge_l', 'hedge_r')},
    'cypress': {'mat': 'MAT_Cypress', 'prefix': '_foliage/p5_cypress_', 'nrm': 1.00,
                'objects': tuple(o.name for o in bpy.data.objects
                                 if o.type == 'MESH' and o.name.startswith('cyp_'))},
}[ONLY]

log = {'pass': ONLY}


def snap_mat(m):
    out = []
    for n in m.node_tree.nodes:
        row = [n.bl_idname, n.name]
        for i in n.inputs:
            if i.is_linked: row.append(('L', i.links[0].from_node.name, i.links[0].from_socket.name))
            else:
                try:
                    v = i.default_value
                    row.append(tuple(v) if hasattr(v, '__len__') else round(float(v), 6))
                except Exception: pass
        if n.bl_idname == 'ShaderNodeTexImage': row.append(n.image.name if n.image else None)
        out.append(tuple(row))
    return out


def snap_obj(o):
    return (len(o.data.vertices), len(o.data.polygons),
            tuple(round(v, 6) for r in o.matrix_world for v in r),
            tuple(s.material.name if s.material else None for s in o.material_slots))


TOUCH_OBJ = set(SPEC['objects'])
before_mats = {m.name: snap_mat(m) for m in bpy.data.materials
               if m.use_nodes and m.name != SPEC['mat']}
before_objs = {o.name: snap_obj(o) for o in bpy.data.objects
               if o.type == 'MESH' and o.name not in TOUCH_OBJ}


def load(rel, cs):
    p = os.path.join(MATS, rel)
    key = os.path.basename(rel).rsplit('.', 1)[0]
    im = bpy.data.images.get(key) or bpy.data.images.load(p)
    im.name = key; im.filepath = p; im.source = 'FILE'
    im.colorspace_settings.name = cs; im.reload()
    return im


# ---- 1. box-projected world-scale UVs ----------------------------------------
# A hedge run is 30 m long, 0.8 m wide and 1 m tall, so ONE planar projection
# would stretch the tile by 37:1 on the end caps. Projecting each face along its
# own dominant axis keeps the tile 1.5 m square everywhere, which is the whole
# point of authoring it at a world scale.
touched = []
for name in SPEC['objects']:
    o = bpy.data.objects.get(name)
    if not o: continue
    me = o.data
    uv = me.uv_layers.active or me.uv_layers.new(name='UVMap')
    mw = o.matrix_world
    for p in me.polygons:
        n = (mw.to_3x3() @ p.normal)
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            co = mw @ me.vertices[me.loops[li].vertex_index].co
            u, v = (co.y, co.z) if ax == 0 else ((co.x, co.z) if ax == 1 else (co.x, co.y))
            uv.data[li].uv = (u / TILE_M, v / TILE_M)
    touched.append(name)
log['uv_objects'] = touched
log['uv_convention'] = 'box-projected world coords / %.1f m' % TILE_M

# ---- 2. the material ----------------------------------------------------------
m = bpy.data.materials[SPEC['mat']]
nt = m.node_tree
bsdf = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
before = {'base': list(round(float(x), 4) for x in bsdf.inputs['Base Color'].default_value),
          'rough': round(float(bsdf.inputs['Roughness'].default_value), 4)}
uvn = next((n for n in nt.nodes if n.bl_idname == 'ShaderNodeUVMap'), None)
if uvn is None:
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'
    uvn.name = uvn.label = 'P5 UV'; uvn.location = (-900, 0)


def tex(rel, cs, y, label):
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = load(rel, cs); n.name = n.label = label
    n.extension = 'REPEAT'; n.interpolation = 'Linear'; n.location = (-600, y)
    nt.links.new(uvn.outputs['UV'], n.inputs['Vector'])
    return n


b = tex(SPEC['prefix'] + 'basecolor.png', 'sRGB', 300, 'P5 Base')
r = tex(SPEC['prefix'] + 'roughness.png', 'Non-Color', 0, 'P5 Rough')
nn = tex(SPEC['prefix'] + 'normal.png', 'Non-Color', -300, 'P5 Normal')
nm = nt.nodes.new('ShaderNodeNormalMap'); nm.location = (-280, -300)
nm.inputs['Strength'].default_value = SPEC['nrm']
nt.links.new(nn.outputs['Color'], nm.inputs['Color'])
for sock in ('Base Color', 'Roughness', 'Normal'):
    for l in list(bsdf.inputs[sock].links): nt.links.remove(l)
nt.links.new(b.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(r.outputs['Color'], bsdf.inputs['Roughness'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
log['material'] = {'name': m.name, 'before': before,
                   'after': {'base': b.image.name, 'rough': r.image.name,
                             'normal': nn.image.name, 'normal_strength': SPEC['nrm']},
                   'doubleSided_kept': not m.use_backface_culling}

after_mats = {m2.name: snap_mat(m2) for m2 in bpy.data.materials
              if m2.use_nodes and m2.name != SPEC['mat']}
after_objs = {o.name: snap_obj(o) for o in bpy.data.objects
              if o.type == 'MESH' and o.name not in TOUCH_OBJ}
cm = [k for k in before_mats if before_mats[k] != after_mats.get(k)]
co = [k for k in before_objs if before_objs[k] != after_objs.get(k)]
assert not cm, 'materials changed: %s' % cm
assert not co, 'objects changed: %s' % co
log['other_materials_changed'] = cm
log['other_objects_changed'] = co

print('###JSON###')
print(json.dumps(log, indent=1))
if '--save' in args:
    bpy.ops.wm.save_mainfile(); print('### saved', bpy.data.filepath)
