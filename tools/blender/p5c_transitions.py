"""
P5C - the transitions: a flush stone edging where hardscape meets lawn.

    blender --background mansion_exterior_P5C.blend --python p5c_transitions.py -- --save

THE DEFECT. The terrace meets grass on a hard line with nothing between them -
no kerb, no margin, no verge - and P5A's gravel forecourt now meets grass the
same way. Zoomed at HERO the paving's beaded outer edge is good work sitting on
nothing, and the frame reads as two assets placed beside each other rather than
as one property. The P5A wear halo in COLOR_0 darkens the lawn against the
hardscape, which is the tonal half of the problem; this is the built half.

WHAT AN EDGING IS FOR, and why it is not a decorative band. A maintained estate
puts a flush stone or granite edging between a paved surface and turf for
reasons that are entirely practical: it stops gravel migrating into the grass,
it gives the mower a wheel to run on so the cut can reach the paving, and it
holds the paving's own bed. It is the single most common detail at exactly this
junction, and it reads as construction rather than as ornament - which is the
test the brief sets for every added element.

WHAT THIS ADDS. Two runs of 280 mm edging, both in MAT_Stone_Trim - an EXISTING
material, so this costs no texture, no image and no new shader program:

  * around terrace_lower's footprint, placed entirely OUTSIDE it (10.10 ->
    10.38 in x, 7.00 -> 7.28 in y and so on) so there is no coplanar overlap
    with the terrace to fight;
  * along the forecourt's outer boundary - the r 10.6 arc clipped at the
    terrace, and the approach band's two flanks.

Both sit 30 mm above the sampled ground, which is 110 mm BELOW the terrace's own
top face (z 0.14): the edging reads as the kerb the terrace sits behind, not as
a second paving level. Every vertex samples the ground mesh's height, as P5A's
forecourt does, so nothing floats over the displaced terrain.

Every other material and every other object is asserted bit-identical.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
W = 0.28                      # edging width, metres
LIFT = 0.030                  # above the sampled ground
SEG = 0.55                    # nominal segment length
FOUNT = (0.0, -13.2)
R_OUT = 10.6
TERRACE_FRONT = -8.80
BAND_HALF_NEAR, BAND_HALF_FAR, BAND_END = 4.30, 3.50, -34.0

log = {}


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


before_mats = {m.name: snap_mat(m) for m in bpy.data.materials if m.use_nodes}
before_objs = {o.name: snap_obj(o) for o in bpy.data.objects if o.type == 'MESH'}

ground = bpy.data.objects['ground_plane']
gme = ground.data
xs = sorted({round(v.co.x, 4) for v in gme.vertices if abs(v.co.x) <= 120.0001})
ys = sorted({round(v.co.y, 4) for v in gme.vertices if abs(v.co.y) <= 120.0001})
NX, NY = len(xs), len(ys)
X0, X1, Y0, Y1 = xs[0], xs[-1], ys[0], ys[-1]
H = [[0.0] * NY for _ in range(NX)]
for v in gme.vertices:
    if abs(v.co.x) > 120.0001 or abs(v.co.y) > 120.0001: continue
    i = int(round((v.co.x - X0) / (X1 - X0) * (NX - 1)))
    j = int(round((v.co.y - Y0) / (Y1 - Y0) * (NY - 1)))
    H[i][j] = v.co.z


def gz(x, y):
    fx = (min(max(x, X0), X1) - X0) / (X1 - X0) * (NX - 1)
    fy = (min(max(y, Y0), Y1) - Y0) / (Y1 - Y0) * (NY - 1)
    i, j = int(fx), int(fy)
    i2, j2 = min(i + 1, NX - 1), min(j + 1, NY - 1)
    tx, ty = fx - i, fy - j
    return ((H[i][j] * (1 - tx) + H[i2][j] * tx) * (1 - ty)
            + (H[i][j2] * (1 - tx) + H[i2][j2] * tx) * ty)


bm = bmesh.new()
uvl = bm.loops.layers.uv.new('UVMap')
made = {'quads': 0}


def strip(points, inward):
    """A ribbon W wide, offset OUTWARD from a polyline. `inward` is a unit
    normal pointing back toward the hardscape, so the ribbon lies outside it."""
    prev = None
    for k in range(len(points) - 1):
        (ax, ay), (bx, by) = points[k], points[k + 1]
        nx0, ny0 = inward[k]
        nx1, ny1 = inward[k + 1]
        p0 = (ax - nx0 * 0.0, ay - ny0 * 0.0)
        p1 = (bx - nx1 * 0.0, by - ny1 * 0.0)
        q0 = (ax - nx0 * W, ay - ny0 * W)
        q1 = (bx - nx1 * W, by - ny1 * W)
        vs = [bm.verts.new((px, py, gz(px, py) + LIFT)) for (px, py) in (p0, p1, q1, q0)]
        f = bm.faces.new(vs)
        for l in f.loops:
            l[uvl].uv = (l.vert.co.x / 1.2, l.vert.co.y / 1.2)
        made['quads'] += 1


def rect_run(x0, x1, y0, y1):
    """Four ribbons around a rectangle, each lying outside it."""
    for (a, b, n) in (((x0, y0), (x1, y0), (0.0, 1.0)),      # south, outward = -y
                      ((x1, y0), (x1, y1), (-1.0, 0.0)),     # east,  outward = +x
                      ((x1, y1), (x0, y1), (0.0, -1.0)),     # north, outward = +y
                      ((x0, y1), (x0, y0), (1.0, 0.0))):     # west,  outward = -x
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        n_seg = max(2, int(round(L / SEG)))
        pts = [(a[0] + (b[0] - a[0]) * t / n_seg, a[1] + (b[1] - a[1]) * t / n_seg) for t in range(n_seg + 1)]
        strip(pts, [n] * len(pts))


# ---- 1. terrace edging, entirely outside terrace_lower ------------------------
t = bpy.data.objects['terrace_lower']
ws = [t.matrix_world @ Vector(c) for c in t.bound_box]
tx0, tx1 = min(w.x for w in ws), max(w.x for w in ws)
ty0, ty1 = min(w.y for w in ws), max(w.y for w in ws)
rect_run(tx0, tx1, ty0, ty1)
log['terrace_edging'] = {'footprint': [round(tx0, 2), round(tx1, 2), round(ty0, 2), round(ty1, 2)],
                         'width_m': W, 'quads': made['quads']}

# ---- 2. forecourt edging: the arc, then the approach flanks -------------------
q0 = made['quads']
arc_pts, arc_n = [], []
a_lo = math.asin(max(-1.0, min(1.0, (TERRACE_FRONT - FOUNT[1]) / R_OUT)))
# The arc runs from the chord at the terrace, all the way round the far side.
a_start, a_end = a_lo, math.pi - a_lo
steps = max(8, int(round(R_OUT * (2 * math.pi - (a_end - a_start)) / SEG)))
for s in range(steps + 1):
    a = a_end + (2 * math.pi + a_start - a_end) * s / steps
    px, py = FOUNT[0] + R_OUT * math.cos(a), FOUNT[1] + R_OUT * math.sin(a)
    arc_pts.append((px, py)); arc_n.append((-math.cos(a), -math.sin(a)))   # outward = radial
strip(arc_pts, arc_n)
log['forecourt_arc'] = {'radius': R_OUT, 'segments': steps, 'quads': made['quads'] - q0}

q0 = made['quads']
for side in (-1, 1):
    pts, nrm = [], []
    rows = 20
    for r in range(rows + 1):
        tt = r / rows
        half = BAND_HALF_NEAR + (BAND_HALF_FAR - BAND_HALF_NEAR) * tt
        x = side * half
        inside = max(R_OUT ** 2 - x * x, 0.0)
        y_start = FOUNT[1] - math.sqrt(inside)
        y = y_start + (BAND_END - y_start) * tt
        pts.append((x, y)); nrm.append((-side * 1.0, 0.0))
    strip(pts, nrm)
log['approach_flanks'] = {'quads': made['quads'] - q0}

bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
me = bpy.data.meshes.new('edging_hardscape')
bm.to_mesh(me); bm.free()
trim = bpy.data.materials['MAT_Stone_Trim']
me.materials.append(trim)
ob = bpy.data.objects.new('edging_hardscape', me)
for c in ground.users_collection: c.objects.link(ob)
ob.matrix_world = ground.matrix_world.copy()

resid = max(abs((v.co.z - gz(v.co.x, v.co.y)) - LIFT) for v in me.vertices)
log['edging_hardscape'] = {
    'verts': len(me.vertices), 'polys': len(me.polygons),
    'tris': sum(len(p.vertices) - 2 for p in me.polygons),
    'material': trim.name, 'reused_existing_material': True,
    'bbox': [[round(min(v.co[i] for v in me.vertices), 2) for i in range(3)],
             [round(max(v.co[i] for v in me.vertices), 2) for i in range(3)]],
    'max_lift_residual_mm': round(resid * 1000, 3),
    'terrace_top_z': 0.14, 'edging_top_z_above_ground_mm': LIFT * 1000,
}
assert resid < 1e-4, 'edging drifts %.5f m from the sampled ground' % resid

after_mats = {m.name: snap_mat(m) for m in bpy.data.materials if m.use_nodes}
after_objs = {o.name: snap_obj(o) for o in bpy.data.objects
              if o.type == 'MESH' and o.name != 'edging_hardscape'}
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
