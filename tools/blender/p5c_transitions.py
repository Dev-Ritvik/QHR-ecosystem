"""
P5C - the transitions: a flush stone edging where hardscape meets lawn.

    blender --background mansion_exterior_P5C.blend --python p5c_transitions.py -- --save

CORRECTED AFTER SHIPPING, AND THE ORIGINAL DEFECT IS ON THE RECORD BECAUSE THE
CANDIDATES THAT CARRY IT ARE IMMUTABLE.

The version of this script that produced p5c, p5d, p5e, p5g and p5h wound its
ribbon quads from the caller's traverse direction, which is not a fixed sense.
229 of the 249 polygons came out facing the ground against a single-sided
material, so `edging_hardscape` was backface-culled and rendered ONE pixel at
HERO and none at WEST or NW - measured against a working control in the same
isolated pass, and confirmed by a depth-test-off render that returned the same
zero, which is what ruled out an occlusion or z-fighting explanation.

Three things are different now, and only three:
  * every quad is oriented from its own XY shoelace area rather than from the
    direction of travel, and the resulting normals are ASSERTED (see strip);
  * StoneAO / COLOR_0 is baked, so the object stops forking MAT_Stone_Trim;
  * the script is re-runnable - it removes a previous `edging_hardscape` first.

The 30 mm lift is deliberately NOT changed; the constant carries the ray-cast
measurement that justifies leaving it. Geometry, width, footprint, segment
length and material are all untouched, so a re-run reproduces the shipped
positions exactly.

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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# Constants and function definitions only - no module-level execution. Checked
# before importing, because P4A lost a locked source to a generator that
# regenerated its textures on import.
import bake_ao_raycast as AO

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
W = 0.28                      # edging width, metres
# LIFT IS UNCHANGED AT 30 mm, AND THAT IS A MEASUREMENT RATHER THAN INERTIA.
#
# The tempting correction was to raise it: the ground plane spans 520 m, so
# Draco's 14-bit position quantisation gives a 31.74 mm step - confirmed on the
# DECODED mesh in the browser, where ground_plane's 15,455 vertices carry only
# 218 distinct Y values exactly 31.74 mm apart - and 30 mm of lift is less than
# one of those steps. That sounds fatal and is not.
#
# What matters is the CLEARANCE THAT SURVIVES, and it was measured rather than
# assumed: every one of the shipped edging's 568 vertices was ray-cast against
# the shipped post-Draco ground surface. Minimum 17.71 mm, median 18.98,
# maximum 50.72, mean 23.56 - and ZERO vertices at or below the ground, zero
# under 5 mm. Depth precision at the 30 m the HERO camera works at is about
# 0.54 mm, so the thinnest clearance is roughly 33 depth units. It survives.
#
# Raising it would also cost something real. This ribbon has no side wall: it is
# a flat strip that follows the terrain. Lifting it further does not make a
# taller kerb, it makes a plane floating over the grass with a shadow gap under
# it. Flush is the design, and flush is what the measurement supports.
LIFT = 0.030                  # above the sampled ground; see the note above
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
# The subject is excluded from BOTH snapshots. It was only excluded from the
# `after` one originally, which was correct while this script could only ever
# create the object; now that it also replaces one, leaving it in `before` makes
# the control fire on the very change the script exists to make.
before_objs = {o.name: snap_obj(o) for o in bpy.data.objects
               if o.type == 'MESH' and o.name != 'edging_hardscape'}

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
        # ORIENT EVERY QUAD UPWARD, AND DO IT FROM THE GEOMETRY RATHER THAN
        # FROM THE CALLER'S TRAVERSE DIRECTION. THIS IS THE BUG THAT SHIPPED.
        #
        # The original built the quad as (p0, p1, q1, q0) - along the polyline,
        # then across the ribbon - so the winding depended on the SIGN
        # relationship between the direction of travel and the offset direction.
        # Work it through and the answer is not uniform: rect_run's four sides,
        # the forecourt arc and the side=-1 approach flank all come out normal
        # -Z, while the side=+1 flank alone comes out +Z, because its offset is
        # mirrored. That is exactly what the shipped mesh measured - 229 of 249
        # polygons facing the ground and 20 facing the sky, and 132 rect + 77 arc
        # + 40 flank = 249 accounts for every one of them.
        #
        # MAT_Stone_Trim is doubleSided:false, so nine tenths of the object was
        # backface-culled and `edging_hardscape` rendered ONE pixel at HERO and
        # none at WEST or NW. Nothing caught it because the only assertion here
        # checked vertex Z against the sampled ground - a POSITION test, which
        # was true, and which says nothing whatever about winding.
        #
        # The fix is not a post-hoc recalc_face_normals. These ribbons are an
        # OPEN surface, and recalc only makes a connected component mutually
        # consistent - for an open sheet the global sense it settles on is
        # arbitrary, so it would trade a reproducible bug for a coin toss. Every
        # quad here is a near-horizontal strip whose visible face is its top, so
        # the correct orientation is knowable outright: take the shoelace area of
        # the quad in XY, which is positive exactly when the vertex order is
        # counter-clockwise seen from +Z, and reverse the order when it is not.
        # Direction-independent, deterministic, and asserted below.
        quad = [p0, p1, q1, q0]
        area2 = sum(quad[i][0] * quad[(i + 1) % 4][1] - quad[(i + 1) % 4][0] * quad[i][1]
                    for i in range(4))
        if area2 < 0.0:
            quad.reverse()
        vs = [bm.verts.new((px, py, gz(px, py) + LIFT)) for (px, py) in quad]
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

# RE-RUNNABLE. A previous run's object has to go before a new one takes its
# name, or Blender silently makes `edging_hardscape.001` and the graft would
# then replace nothing. The old mesh datablock goes with it.
old = bpy.data.objects.get('edging_hardscape')
if old is not None:
    old_me = old.data
    prev_polys = len(old_me.polygons)
    prev_down = sum(1 for p in old_me.polygons
                    if (old.matrix_world.to_3x3() @ p.normal).z < -0.5)
    log['replaced_previous'] = {'polys': prev_polys, 'faces_pointing_down': prev_down}
    bpy.data.objects.remove(old, do_unlink=True)
    if old_me.users == 0:
        bpy.data.meshes.remove(old_me)

me = bpy.data.meshes.new('edging_hardscape')
bm.to_mesh(me); bm.free()
trim = bpy.data.materials['MAT_Stone_Trim']
me.materials.append(trim)
ob = bpy.data.objects.new('edging_hardscape', me)
for c in ground.users_collection: c.objects.link(ob)
ob.matrix_world = ground.matrix_world.copy()

# THE ORIENTATION IS ASSERTED, NOT ASSUMED. The whole defect was an assertion
# that tested the wrong property, so this one tests the property that failed.
# The ground's world matrix must also preserve +Z, or "up" in local space is not
# up in the scene and the shoelace test above is measuring the wrong plane.
zax = ob.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))
assert zax.z > 0.999, 'edging local +Z is not world up (%.4f)' % zax.z
nz = [(ob.matrix_world.to_3x3() @ p.normal).z for p in me.polygons]
n_down = sum(1 for z in nz if z < 0.5)
log['normals'] = {
    'polys': len(nz), 'faces_up_gt_0.5': sum(1 for z in nz if z > 0.5),
    'faces_not_up': n_down,
    'min_nz': round(min(nz), 5), 'mean_nz': round(sum(nz) / len(nz), 5),
    'max_nz': round(max(nz), 5),
}
assert n_down == 0, '%d of %d faces do not face up' % (n_down, len(nz))

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

# ---- StoneAO / COLOR_0, so this stops forking MAT_Stone_Trim -----------------
# MAT_Stone_Trim multiplies base colour by the StoneAO attribute through a
# ShaderNodeMix (RGBA / MULTIPLY / Factor 1), and three's GLTFLoader carries
# `vertex-colors:` in its material cache key. This object was the ONLY one of 37
# trim primitives without the attribute, so it both rendered unmultiplied and
# made the loader cache a second MeshStandardMaterial for the same glTF
# material - measured live as 16 material names resolving to 17 instances.
# Baked with the same instrument and the same 0.40 floor as the rest of the
# stone, so it joins the family instead of forking it.
AO.build()
log['ao'] = AO.run(['edging_hardscape'])
ca = me.color_attributes.get('StoneAO')
assert ca is not None, 'StoneAO was not created on edging_hardscape'
vals = [float(ca.data[i].color[0]) for i in range(len(ca.data))]
log['stoneao'] = {
    'domain': ca.domain, 'data_type': ca.data_type, 'loops': len(vals),
    'min': round(min(vals), 4), 'mean': round(sum(vals) / len(vals), 4),
    'max': round(max(vals), 4),
}
assert min(vals) >= 0.39, 'StoneAO fell below the 0.40 floor (%.4f)' % min(vals)
assert max(vals) <= 1.0001, 'StoneAO exceeded 1.0 (%.4f)' % max(vals)

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
