"""
P4B - synthetic contact occlusion for the rusticated base, in COLOR_0.

    blender --background mansion_exterior_P4B.blend --python rustic_contact_ao.py -- --save

The 96 rustic_* blocks share TWO mesh datablocks (KIT_quoin_x_M and .001), so
a raycast bake from any one instance's world position would be written into
every other instance's geometry - wrong for 95 of them. Their StoneAO shipped
as 1.0 flat for exactly that reason (P4 audit §1.4).

What every block DOES share is its own shape: a 0.72 x 0.24 x 0.34 m stone
whose local +Z is world up on every instance (checked: rotation 0, scale 1),
sitting on the plinth with neighbours to either side. So the occlusion that is
a property of the BLOCK - contact darkening along its bed, a little at the
top joint, and where it meets the next block - can be authored from local
geometry alone and is correct for all 96. It is written into the same
StoneAO / COLOR_0 channel the other stone already uses, so it exports with no
new data and no runtime code.

Values, linear, applied to RGB (alpha untouched):
    bed        0.58 at the underside rising to 1.0 by 90 mm up the face
    top joint  0.90 in the top 20 mm
    side joint 0.88 within 25 mm of the +/-X and +/-Y extents
Floor 0.40 is the same floor bake_ao_raycast.py uses. --reset restores 1.0.
"""
import bpy, sys, numpy as np
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RESET = '--reset' in args
MESHES = ('KIT_quoin_x_M', 'KIT_quoin_x_M.001')
for name in MESHES:
    me = bpy.data.meshes[name]
    ca = me.color_attributes.get('StoneAO') or me.color_attributes.new('StoneAO', 'FLOAT_COLOR', 'CORNER')
    buf = np.empty(len(ca.data) * 4, np.float32); ca.data.foreach_get('color', buf); buf = buf.reshape(-1, 4)
    if RESET:
        buf[:, :3] = 1.0
    else:
        co = np.array([v.co[:] for v in me.vertices], np.float32)
        vi = np.array([me.loops[i].vertex_index for i in range(len(me.loops))])
        p = co[vi]; mn, mx = co.min(0), co.max(0)
        z = p[:, 2]
        bed = 0.58 + 0.42 * np.clip((z - mn[2]) / 0.09, 0, 1)
        top = np.where(z > mx[2] - 0.02, 0.90, 1.0)
        dx = np.minimum(p[:, 0] - mn[0], mx[0] - p[:, 0]); dy = np.minimum(p[:, 1] - mn[1], mx[1] - p[:, 1])
        side = np.where(np.minimum(dx, dy) < 0.025, 0.88, 1.0)
        v = np.clip(bed * top * side, 0.40, 1.0).astype(np.float32)
        buf[:, :3] = v[:, None]
    ca.data.foreach_set('color', buf.ravel()); me.update()
    v = buf[:, 0]
    print(f"### {name}: StoneAO mean {v.mean():.3f} min {v.min():.3f} p50 {np.percentile(v,50):.3f} max {v.max():.3f} ({'RESET' if RESET else 'APPLIED'})")
if '--save' in args:
    bpy.ops.wm.save_mainfile(); print('### saved', bpy.data.filepath)
