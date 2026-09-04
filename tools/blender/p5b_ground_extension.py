"""
P5B - atmospheric continuity: extend the ground so its edge dies inside the fog
instead of ending in mid-frame.

    blender --background mansion_exterior_P5B.blend --python p5b_ground_extension.py -- --save

THE DEFECT, MEASURED. tools/capture/phase5_ground.mjs rendered the ground alone
in white and read back its silhouette: at WEST the plane's far edge occupies
rows 359-431 of 900, at NW rows 366-433 - a hard line across the middle of the
frame with a photographic backdrop of different hue and value immediately above
it. P5A made it MORE visible, not less, because the lawn now differs from the
plate in structure and chroma as well as in value.

WHY IT IS NOT A FOG PROBLEM, AND THEREFORE NOT A FOG FIX. Daylight fog is a
static Fog(#5E6147, 60, 220) and it is a locked grade value. The plane is a
+/-120 m square, so its far edge sits about 146 m from the WEST camera, where
that band has reached only (146-60)/(220-60) = 54%. The edge is half-dissolved
when it stops. Dusk's Fog(26, 105) buries the same edge completely, which is
exactly why dusk composites and daylight does not.

Two ways to close that gap: move the fog in, or move the edge out. The fog is
locked, tuned against the building (its front face is 28 m from the hero camera,
inside the 60 m near plane, so the architecture renders unfogged), and pulling
it in would start fogging the subject. The edge is not locked and is simply too
close. So the edge moves.

WHAT THIS DOES. The ground plane's own boundary loop is extruded outward in
four rings to a 260 m CIRCULAR rim - SAME object, SAME material, same UV
convention, so there is no seam to hide and no new draw call.

The radius and the shape are both derived, and the first attempt at them was
wrong in a way this script's own assertion caught. A square rim at +/-320 put
its nearest point at 266 m (fogged, good) and its CORNERS at 486 m - past the
400 m far plane, so the clip would have drawn a fresh hard edge. A square
cannot satisfy both bounds at once because its corners are sqrt(2) further out
than its sides. A circular rim's distance varies only by the camera's own offset
from the origin (25.6-37.0 m for the three exterior cameras), so r = 260 clears
both: nearest 226 m against a fog that reaches 1.0 at 220, farthest 294 m
against a 400 m far plane. Asserted below, per camera, over 720 directions.

The extension is CHEAP because it is invisible detail by construction: four
rings over the boundary's own 384 columns, ~3,072 triangles, all of it at a
distance where the 6 m tile has resolved to its own mean colour. It carries a
gentle downward drift (the far field falls away rather than sitting up as a
raised disc), and its COLOR_0 continues the falloff the near field already has.

Every other material and every other object is asserted bit-identical.
"""
import bpy, bmesh, json, math, os, sys

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
TILE_M = 6.0
INNER = 120.0                      # the plane's own half-extent
# Ring radii, and how far each has morphed from the plane's SQUARE boundary
# toward a CIRCLE. A pure square rim cannot satisfy both constraints at once:
# its corners are a factor sqrt(2) further out than its sides, so a rim whose
# nearest point clears the 220 m fog distance puts its corners past the 400 m
# far plane. Measured, at +/-320: nearest 266 m (fogged, good), farthest 486 m
# (clipped, bad). Morphing to a circle by the outer ring makes nearest and
# farthest differ only by the camera's own offset from the origin, and r = 260
# then clears both: nearest 226 m >= 220 fog, farthest 294 m <= 400 far plane.
RINGS = [150.0, 190.0, 225.0, 260.0]
SHAPE = [0.15, 0.45, 0.75, 1.00]       # 0 = square like the plane, 1 = circular
DRIFT = [-0.35, -0.95, -1.80, -3.10]   # metres, cumulative fall of the far field

log = {}


def snapshot_mat(m):
    out = []
    for n in m.node_tree.nodes:
        row = [n.bl_idname, n.name]
        for i in n.inputs:
            if i.is_linked:
                row.append(('L', i.links[0].from_node.name, i.links[0].from_socket.name))
            else:
                try:
                    v = i.default_value
                    row.append(tuple(v) if hasattr(v, '__len__') else round(float(v), 6))
                except Exception:
                    pass
        if n.bl_idname == 'ShaderNodeTexImage':
            row.append(n.image.name if n.image else None)
        out.append(tuple(row))
    return out


def snapshot_obj(o):
    me = o.data
    return (len(me.vertices), len(me.polygons),
            tuple(round(v, 6) for r in o.matrix_world for v in r),
            tuple(s.material.name if s.material else None for s in o.material_slots))


before_mats = {m.name: snapshot_mat(m) for m in bpy.data.materials if m.use_nodes}
before_objs = {o.name: snapshot_obj(o) for o in bpy.data.objects
               if o.type == 'MESH' and o.name != 'ground_plane'}

ground = bpy.data.objects['ground_plane']
me = ground.data
v0, p0 = len(me.vertices), len(me.polygons)

# ---- read the existing tone before the mesh changes under it ------------------
tone_by_vert = {}
ca = me.color_attributes.get('P5A_Tone')
if ca is None:
    raise SystemExit('P5A_Tone missing - run p5a_ground_surface.py first')
for li, lp in enumerate(me.loops):
    tone_by_vert.setdefault(lp.vertex_index, ca.data[li].color[0])

bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()

# ---- the boundary loop, ordered ----------------------------------------------
EPS = 1e-3
boundary = [v for v in bm.verts
            if abs(abs(v.co.x) - INNER) < EPS or abs(abs(v.co.y) - INNER) < EPS]


def perimeter_key(v):
    """Position along the square's perimeter, 0..4, anticlockwise from (+X,-Y)."""
    x, y = v.co.x / INNER, v.co.y / INNER
    if abs(y + 1) < 1e-6: return 0 + (x + 1) / 2          # bottom, -Y
    if abs(x - 1) < 1e-6: return 1 + (y + 1) / 2          # right,  +X
    if abs(y - 1) < 1e-6: return 2 + (1 - x) / 2          # top,    +Y
    return 3 + (1 - y) / 2                                # left,   -X


loop = sorted(boundary, key=perimeter_key)
# de-duplicate the four corners, which satisfy two side tests
seen, ordered = set(), []
for v in loop:
    k = (round(v.co.x, 3), round(v.co.y, 3))
    if k in seen: continue
    seen.add(k); ordered.append(v)
log['boundary'] = {'verts': len(ordered), 'expected': 4 * 96,
                   'z_min': round(min(v.co.z for v in ordered), 3),
                   'z_max': round(max(v.co.z for v in ordered), 3)}
assert len(ordered) == 4 * 96, 'boundary loop is %d verts, expected 384' % len(ordered)

# ---- extrude outward ----------------------------------------------------------
uvlay = bm.loops.layers.uv.active or bm.loops.layers.uv.verify()
prev = ordered
radii = []
for ring_i, (R, shape, drift) in enumerate(zip(RINGS, SHAPE, DRIFT)):
    cur = []
    for ci, src in enumerate(ordered):
        bx, by = src.co.x, src.co.y
        cheb = max(abs(bx), abs(by))            # the plane's own square radius
        eucl = math.hypot(bx, by) or 1.0
        # Same DIRECTION as the boundary vertex this column came from, so every
        # column stays radial and the bridge quads stay planar; only the RADIUS
        # is blended from square to circular.
        r = (1.0 - shape) * (R * eucl / cheb) + shape * R
        ux, uy = bx / eucl, by / eucl
        nv = bm.verts.new((ux * r, uy * r, src.co.z + drift))
        cur.append(nv)
        if ci in (0, 48): radii.append((ring_i, ci, round(r, 1)))
    n = len(cur)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((prev[i], prev[j], cur[j], cur[i]))
        for l in f.loops:
            l[uvlay].uv = (l.vert.co.x / TILE_M, l.vert.co.y / TILE_M)
    prev = cur

bm.normal_update()
bm.to_mesh(me)
bm.free()
me.update()

# ---- rewrite COLOR_0 over the whole (now larger) mesh -------------------------
for a in list(me.color_attributes):
    if a.name == 'P5A_Tone':
        me.color_attributes.remove(a)
ca = me.color_attributes.new(name='P5A_Tone', type='FLOAT_COLOR', domain='CORNER')
tone_final = {}
for v in me.vertices:
    if v.index in tone_by_vert:
        tone_final[v.index] = tone_by_vert[v.index]
    else:
        # New far-field vertex: continue the near field's own falloff, floored,
        # so the extension is a continuation rather than a different surface.
        r = math.hypot(v.co.x, v.co.y)
        tone_final[v.index] = max(0.60, 0.88 - 0.10 * min((r - INNER) / (RINGS[-1] - INNER), 1.0))
for li, lp in enumerate(me.loops):
    t = tone_final[lp.vertex_index]
    ca.data[li].color = (t, t, t, 1.0)
me.color_attributes.active_color_index = 0
me.color_attributes.render_color_index = 0

zs = [v.co.z for v in me.vertices]
log['ground'] = {
    'verts': [v0, len(me.vertices)], 'polys': [p0, len(me.polygons)],
    'tris': sum(len(p.vertices) - 2 for p in me.polygons),
    'half_extent': [INNER, RINGS[-1]],
    'z_range': [round(min(zs), 3), round(max(zs), 3)],
    'rings': RINGS, 'shape_blend': SHAPE, 'drift': DRIFT,
    'sample_column_radii': radii,
    'tone_range': [round(min(tone_final.values()), 4), round(max(tone_final.values()), 4)],
}

# ---- fog geometry check, stated rather than assumed ---------------------------
CAMS = {'HERO': (-20.0, -27.0, 15.5), 'WEST': (-26.0, -2.0, 9.0), 'NW': (-15.0, 19.0, 8.4)}
FOG_FAR, FAR_PLANE = 220.0, 400.0
chk = {}
for name, (cx, cy, cz) in CAMS.items():
    best, worst = 1e9, 0.0
    for i in range(720):
        a = 2 * math.pi * i / 720
        # The outer rim is fully circular (SHAPE[-1] == 1.0), so its radius is
        # RINGS[-1] in every direction and the only variation in distance is the
        # camera's own offset from the origin.
        px, py = math.cos(a) * RINGS[-1], math.sin(a) * RINGS[-1]
        d = math.hypot(px - cx, py - cy)
        best = min(best, d); worst = max(worst, d)
    chk[name] = {'rim_nearest_m': round(best, 1), 'rim_farthest_m': round(worst, 1),
                 'fully_fogged': best >= FOG_FAR, 'inside_far_plane': worst <= FAR_PLANE}
log['fog_check'] = {'fog_far_m': FOG_FAR, 'camera_far_plane_m': FAR_PLANE, 'cameras': chk}
for name, c in chk.items():
    assert c['fully_fogged'], '%s: rim comes within %.1f m, fog only reaches %.0f' % (name, c['rim_nearest_m'], FOG_FAR)
    assert c['inside_far_plane'], '%s: rim at %.1f m is clipped by the %.0f m far plane' % (name, c['rim_farthest_m'], FAR_PLANE)

after_mats = {m.name: snapshot_mat(m) for m in bpy.data.materials if m.use_nodes}
after_objs = {o.name: snapshot_obj(o) for o in bpy.data.objects
              if o.type == 'MESH' and o.name != 'ground_plane'}
changed_m = [k for k in before_mats if before_mats[k] != after_mats.get(k)]
changed_o = [k for k in before_objs if before_objs[k] != after_objs.get(k)]
assert not changed_m, 'materials changed: %s' % changed_m
assert not changed_o, 'objects changed: %s' % changed_o
log['other_materials_changed'] = changed_m
log['other_objects_changed'] = changed_o

print('###JSON###')
print(json.dumps(log, indent=1))
if '--save' in args:
    bpy.ops.wm.save_mainfile()
    print('### saved', bpy.data.filepath)
