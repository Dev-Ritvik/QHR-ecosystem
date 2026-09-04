"""
Read-only inspection of the ground and its neighbours, before P5A authors anything.

    blender --background mansion_exterior_P4D.blend --python p5_inspect_ground.py

The runtime probe measured what the ground LOOKS like. This measures what it IS
in the source: its UV layout and world-space texel mapping, its height field,
its material graph as the exporter will read it, and the exact world footprint
of every hardscape object the ground has to meet. P5A cannot choose a tile size
without the first, cannot place a zone without the last, and cannot keep the
export safe without the middle.
"""
import bpy, json, math
from mathutils import Vector

OUT = {}


def bbox_world(ob):
    ws = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return {'min': [round(min(w[i] for w in ws), 3) for i in range(3)],
            'max': [round(max(w[i] for w in ws), 3) for i in range(3)]}


g = bpy.data.objects.get('ground_plane')
OUT['found'] = g is not None
if g:
    me = g.data
    OUT['ground'] = {
        'verts': len(me.vertices), 'polys': len(me.polygons), 'tris': sum(len(p.vertices) - 2 for p in me.polygons),
        'uv_layers': [l.name for l in me.uv_layers],
        'color_attrs': [(a.name, a.domain, a.data_type) for a in me.color_attributes],
        'materials': [m.name if m else None for m in me.materials],
        'matrix_world': [list(r) for r in g.matrix_world],
        'bbox_world': bbox_world(g),
        'modifiers': [(m.name, m.type) for m in g.modifiers],
    }
    # height field, in world space, sampled on a coarse grid
    zs = [(g.matrix_world @ v.co).z for v in me.vertices]
    xs = [(g.matrix_world @ v.co).x for v in me.vertices]
    ys = [(g.matrix_world @ v.co).y for v in me.vertices]
    OUT['ground']['height_world_z'] = {'min': round(min(zs), 4), 'max': round(max(zs), 4),
                                       'mean': round(sum(zs) / len(zs), 4)}
    OUT['ground']['extent_xy'] = {'x': [round(min(xs), 2), round(max(xs), 2)],
                                  'y': [round(min(ys), 2), round(max(ys), 2)]}
    # UV -> world scale. For each triangle, ratio of world edge length to uv edge length.
    if me.uv_layers:
        uv = me.uv_layers[0].data
        ratios = []
        for p in me.polygons[:4000]:
            li = list(p.loop_indices)
            if len(li) < 3: continue
            a, b = li[0], li[1]
            va = g.matrix_world @ me.vertices[me.loops[a].vertex_index].co
            vb = g.matrix_world @ me.vertices[me.loops[b].vertex_index].co
            ua, ub = uv[a].uv, uv[b].uv
            dw = (vb - va).length
            du = (ub - ua).length
            if du > 1e-9: ratios.append(dw / du)
        ratios.sort()
        OUT['ground']['metres_per_uv_unit'] = {
            'p05': round(ratios[int(0.05 * len(ratios))], 2),
            'median': round(ratios[len(ratios) // 2], 2),
            'p95': round(ratios[int(0.95 * len(ratios))], 2),
            'samples': len(ratios),
        }
        us = [uv[i].uv[0] for i in range(len(uv))]
        vs = [uv[i].uv[1] for i in range(len(uv))]
        OUT['ground']['uv_range'] = {'u': [round(min(us), 4), round(max(us), 4)],
                                     'v': [round(min(vs), 4), round(max(vs), 4)]}

# material graph as the exporter reads it
for name in ('MAT_Ground', 'MAT_Hedge', 'MAT_Cypress', 'MAT_Water', 'MAT_Stone_Paving'):
    m = bpy.data.materials.get(name)
    if not m: continue
    row = {'use_nodes': m.use_nodes, 'blend_method': getattr(m, 'blend_method', None),
           'backface_culling': m.use_backface_culling}
    if m.use_nodes:
        nodes = []
        for n in m.node_tree.nodes:
            e = {'id': n.bl_idname, 'name': n.name}
            if n.bl_idname == 'ShaderNodeTexImage':
                e['image'] = n.image.name if n.image else None
                e['filepath'] = n.image.filepath if n.image else None
                e['colorspace'] = n.image.colorspace_settings.name if n.image else None
                e['size'] = list(n.image.size) if n.image else None
                e['extension'] = n.extension
            if n.bl_idname == 'ShaderNodeMapping':
                e['scale'] = [round(x, 4) for x in n.inputs['Scale'].default_value]
                e['location'] = [round(x, 4) for x in n.inputs['Location'].default_value]
            if n.bl_idname == 'ShaderNodeUVMap': e['uv_map'] = n.uv_map
            if n.bl_idname == 'ShaderNodeBsdfPrincipled':
                e['inputs'] = {}
                for i in n.inputs:
                    if i.is_linked:
                        e['inputs'][i.name] = ['LINK', i.links[0].from_node.name, i.links[0].from_socket.name]
                    else:
                        try:
                            v = i.default_value
                            e['inputs'][i.name] = [round(x, 4) for x in v] if hasattr(v, '__len__') else round(float(v), 4)
                        except Exception: pass
            nodes.append(e)
        row['nodes'] = nodes
    row['users'] = [o.name for o in bpy.data.objects if o.type == 'MESH'
                    and any(s.material == m for s in o.material_slots)][:8]
    OUT.setdefault('materials', {})[name] = row

# every object the ground has to meet, in world space
NEIGH = ('terrace_upper', 'terrace_lower', 'fount_apron', 'fount_wall', 'fount_cope',
         'fount_floor', 'fount_water', 'entry_step_0', 'entry_step_1', 'entry_cheek',
         'hedge_b', 'hedge_l', 'hedge_r', 'fountain_bowl', 'mansion_walls')
for n in NEIGH:
    o = bpy.data.objects.get(n)
    if o: OUT.setdefault('neighbours', {})[n] = bbox_world(o)
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith('cyp_'):
        OUT.setdefault('cypress', {})[o.name] = [round(v, 2) for v in o.matrix_world.translation]

OUT['collections'] = {c.name: len(c.objects) for c in bpy.data.collections}
OUT['scene_objects'] = len([o for o in bpy.data.objects if o.type == 'MESH'])
print('###JSON###')
print(json.dumps(OUT, indent=1))
