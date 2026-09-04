"""
Report every colour attribute on the ground, and drop all but P5A_Tone.

Blender's glTF exporter writes EVERY colour attribute a mesh carries, in the
mesh's own order, so a stray second layer becomes COLOR_1 - dead payload at
best, and at worst it takes the COLOR_0 slot and three multiplies the base
colour by the wrong layer. The P5A export shipped both a UNSIGNED_BYTE COLOR_0
and a UNSIGNED_SHORT COLOR_1 off a mesh that was inspected as having none, so
this checks rather than assumes which layer is which.
"""
import bpy, json, sys
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
me = bpy.data.objects['ground_plane'].data
rep = {'before': [(a.name, a.domain, a.data_type) for a in me.color_attributes],
       'active_color_index': me.color_attributes.active_color_index,
       'render_color_index': me.color_attributes.render_color_index}
sample = {}
for a in me.color_attributes:
    vals = [tuple(round(c, 4) for c in a.data[i].color) for i in (0, 500, 5000, 9000)]
    sample[a.name] = vals
rep['samples'] = sample
for a in list(me.color_attributes):
    if a.name != 'P5A_Tone':
        me.color_attributes.remove(a)
rep['after'] = [(a.name, a.domain, a.data_type) for a in me.color_attributes]
me.color_attributes.active_color_index = 0
me.color_attributes.render_color_index = 0
print('###JSON###'); print(json.dumps(rep, indent=1))
if '--save' in args:
    bpy.ops.wm.save_mainfile(); print('### saved')
