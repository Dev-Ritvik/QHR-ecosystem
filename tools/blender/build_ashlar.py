"""
Ashlar generator, driven by the visible-surface survey.

THE CHANGE THAT MATTERS. Earlier versions were told where the wall was — a
plane, an extent, a list of window centres, all hand-entered from measurements
that turned out to describe other parts of the same mesh. This version is not
told anything. It reads survey_<FACADE>.json, keeps the samples where the
frontmost surface is mansion_walls, and treats that set as the wall. Openings,
projecting sills, architraves, eaves and applied bronze exclude themselves,
because at those samples something else won the ray.

That removes the entire class of error that produced, in order: a facade built
to a bounding box, one built 0.24 m short at each end, one built 0.50 m too long
with three courses buried behind a wall step, and one that excluded the whole
window storey around interior pilasters.

WHAT THE SURVEY FOUND that no previous method did:
  * the west wall is FOUR planes, not one -
        z 0.15-0.85  x -7.50      z 1.10-3.55  x -7.50
        z 3.80-5.00  x -7.60      z 5.20-5.50  x -7.50
    the 3.80-5.00 band steps out 100 mm, which is where three courses of the
    previous build were sitting 75 mm behind the wall, invisible.
  * there is a SECOND STOREY OF GLAZING on west and east. mansion_glass spans
    z 1.05-5.05 and only the lower row exists as archglass_L*; the upper row was
    never in any hand-written opening list. It leaves piers of 0.55-0.60 m.
  * projecting sill and architrave bands at z 0.90-1.05 and 3.60-3.75.
  * the roof eaves occlude the wall above z 5.55.

COURSE LAYOUT. Each zone takes as many full courses of its storey height as fit,
then one closing course of the remainder if that remainder is worth a stone.
Real coursed ashlar does exactly this where it meets a band or a cornice.

JAMB STONES. The field palette bottoms out at 0.62 m and the upper piers are
0.55-0.60 m. A pier that narrow is one stone per course in real masonry - a jamb
stone, which is legitimately not field ashlar - so a separate narrow palette is
used only when the field palette cannot fit the run. Without it the entire upper
storey is skipped.

DETERMINISM. rng is seeded once and consumed in a fixed order: zones bottom to
top, courses bottom to top, segments left to right. Kit meshes are built lazily
and consume no rng.
"""
import bpy
import bmesh
import json
import math
import os
import random
from collections import defaultdict

SURVEY_DIR = r"C:\Users\DEVRIT~1\AppData\Local\Temp\claude\C--dev-estate\05c976ed-fa0e-4226-990b-1e9cde51c862\scratchpad"

# ------------------------------------------------------------ locked constants
COLL_PREFIX = "COL_Ashlar"
KIT_PREFIX = "KIT_ASHLAR"
PARK_Z = -50.0
SEED = 20260827

PROUD_WALL = 0.025
PROUD_PLINTH = 0.035
DEPTH = 0.090
ARRIS = 0.002
TOP_ARRIS = 0.008
JOINT_MIN, JOINT_NOM, JOINT_MAX = 0.014, 0.018, 0.024

WIDTHS = [0.62, 0.66, 0.70, 0.74, 0.78, 0.82, 0.88, 0.92, 0.96, 1.00, 1.03, 1.06]
# Narrow piers only. 0.30 is the floor: the north facade has four 0.36 m runs
# at z 3.27, and a 0.34 stone plus two 14 mm joints needs 0.368 - so they were
# being skipped by eight millimetres.
JAMB_WIDTHS = [0.30, 0.34, 0.40, 0.46, 0.52, 0.58]

H_LOWER, H_UPPER = 0.360, 0.322
STOREY_SPLIT = 3.60            # above this the upper course height applies
MIN_CLOSER = 0.15              # a closing course thinner than this is dropped

MAT_WALL = "MAT_Stone_Wall"
UV_PER_M = 1.0

SPEC = {  # axis, outward sign, nominal plane
    "WEST":  ('x', -1, -7.50),
    "EAST":  ('x', +1, +7.50),
    "SOUTH": ('y', -1, -5.00),
    "NORTH": ('y', +1, +5.00),
}

# ---------------------------------------------------------------- regions
#
# A region overrides the stone palette across a horizontal band of a facade.
# It exists for one reason: the south entrance bay must not read as the same
# procedural wall clipped around a portico.
#
# THE SOUTH MAP, from the raycast. The "projecting entrance block" turns out not
# to be a projecting wall at all - the wall behind the portico is flush at
# y = -5.00, the same plane as the wings. What projects is the PORTICO:
#
#     portico_architrave   y -5.92   x -3.04 .. 3.04   at z 3.51
#     portico_cornice      y -6.06   x -3.24 .. 3.24   at z 4.19
#     mansion_doors        y -5.10   x -1.04 .. 1.04
#     entry_cheek/step     y -6.80                     at z 0.59
#     corner quoins        y -5.08   |x| 7.00 .. 7.48
#     pilaster strips      y -5.10   |x| 4.72..5.28, 6.92..7.48, z >= 3.5
#     gold panels          y -5.17   four bands        at z 5.19
#
# So the entrance is framed rather than extruded, and the masonry answer is a
# change of SCALE, not of plane: larger dressed stones in the bay the portico
# frames, coursed on exactly the same bed heights as the wings so the two read
# as one wall. Bigger stone at the centre of a facade is standard classical
# hierarchy; a different course height there would break the building in half.
ENTRANCE_WIDTHS = [1.10, 1.20, 1.30, 1.40, 1.52, 1.62]

# Regions: (h0, h1, z0, z1, palette). palette=None means NO masonry — the wall
# is left smooth on purpose.
#
# WHY THE ENTRANCE BAY IS SMOOTH BELOW THE CORNICE. The first attempt gave the
# bay a larger palette and it did the opposite of what was intended: the visible
# wall between the door surround and the columns is four strips of 0.52-0.60 m,
# far too narrow for a 1.10 m stone, so every one of them fell through to the
# JAMB palette and the entrance ended up with the smallest stones on the
# building instead of the largest. Measured: 28 bay blocks, mean width 0.66 m,
# minimum 0.34 - against 0.88 m in the wings.
#
# Forcing big stones into strips that cannot hold them is how a facade starts
# looking procedural. The classical answer is the opposite move: leave the
# framed bay as plain dressed panel, let the portico own that part of the wall,
# and put the masonry expression in the wings and in the field above the
# cornice, where there is real width to course. Calm beside the ornament,
# texture away from it.
#
# 4.42 is the top of portico_cymatium, measured. Above it the bay is continuous
# wall and takes the large palette, so the entrance reads as heavier stone
# carried on the same bed heights as the wings.
PORTICO_TOP = 4.42
PORTICO_HALF = 3.24          # portico_cornice half-width, measured

REGIONS = {
    "SOUTH": [
        (-PORTICO_HALF, PORTICO_HALF, 0.0, PORTICO_TOP, None),
        (-PORTICO_HALF, PORTICO_HALF, PORTICO_TOP, 99.0, ENTRANCE_WIDTHS),
    ],
}


def region_for(name, h0, h1, z0, z1):
    """(palette, suppressed) for a run. Suppressed runs emit no stone."""
    mid_h, mid_z = (h0 + h1) / 2, (z0 + z1) / 2
    for (a, b, za, zb, pal) in REGIONS.get(name, []):
        if a <= mid_h <= b and za <= mid_z <= zb:
            return (pal, pal is None)
    return (WIDTHS, False)


def split_at_regions(name, a, b):
    """Break a run wherever it crosses a region boundary."""
    cuts = {a, b}
    for (ra, rb, _za, _zb, _pal) in REGIONS.get(name, []):
        for c in (ra, rb):
            if a < c < b:
                cuts.add(c)
    xs = sorted(cuts)
    segs = [(xs[i], xs[i + 1]) for i in range(len(xs) - 1)]
    # A region boundary that lands a few centimetres from a wall edge leaves a
    # fragment too small for any stone. Fold it into its neighbour rather than
    # emitting an unbuildable run: the palette change moves by 60 mm, which
    # nobody will ever see, and the alternative is a hole.
    out = []
    for seg in segs:
        if out and (seg[1] - seg[0]) < min(JAMB_WIDTHS):
            out[-1] = (out[-1][0], seg[1])
        elif out and (out[-1][1] - out[-1][0]) < min(JAMB_WIDTHS):
            out[-1] = (out[-1][0], seg[1])
        else:
            out.append(seg)
    return out

# The lowest wall the ground works leave visible. Below this the terrace and its
# rusticated plinth stand in front of the wall, so ashlar there is never seen.
FIELD_Z0 = 0.44


# ------------------------------------------------------------ survey -> zones

def load_mask(name):
    rows = json.load(open(os.path.join(SURVEY_DIR, "survey_%s.json" % name)))
    by_z = defaultdict(list)
    for h, z, ob, dep, nx, ny, nz in rows:
        if ob == "mansion_walls":
            by_z[round(z, 3)].append((h, dep))
    return by_z


def zones_from_mask(by_z, zstep=0.04, plane_tol=0.03, min_rows=3):
    """Cluster z rows into contiguous bands of constant visible wall depth."""
    from collections import Counter
    prof = []
    for z in sorted(by_z):
        d = Counter(round(x[1], 2) for x in by_z[z])
        plane, n = d.most_common(1)[0]
        prof.append((z, plane, n))

    zones, cur = [], None
    for z, plane, n in prof:
        if cur and abs(cur["plane"] - plane) <= plane_tol and z - cur["z1"] <= zstep * 1.6:
            cur["z1"] = z
            cur["n"] += n
            cur["rows"] += 1
        else:
            if cur:
                zones.append(cur)
            cur = {"plane": plane, "z0": z, "z1": z, "n": n, "rows": 1}
    if cur:
        zones.append(cur)
    return [z for z in zones if z["rows"] >= min_rows]


def runs_for_course(by_z, plane, z0, z1, hstep=0.04, tol=0.035):
    """Contiguous horizontal runs where the wall is present at this plane across
    the WHOLE course height. A block needs wall behind all of it, not just its
    midline."""
    zs = [z for z in by_z if z0 - 1e-6 <= z <= z1 + 1e-6]
    if not zs:
        return []
    sets = []
    for z in zs:
        sets.append({round(h, 3) for h, dep in by_z[z] if abs(dep - plane) <= tol})
    common = set.intersection(*sets) if sets else set()
    if not common:
        return []
    vals = sorted(common)
    runs = [[vals[0], vals[0]]]
    for v in vals[1:]:
        if v - runs[-1][1] <= hstep * 1.6:
            runs[-1][1] = v
        else:
            runs.append([v, v])
    # a run must be wide enough to hold the narrowest stone we are willing to cut
    return [(a, b) for a, b in runs if b - a >= min(JAMB_WIDTHS)]


# A zone only receives ashlar if it is genuinely the wall field. The survey also
# returns the projecting sill and architrave bands, the thin transitions either
# side of them, the cornice, and one phantom band where the roof eaves occlude
# the wall and the ray lands on the far side of the building.
PLANE_TOL = 0.15      # a zone stepping further than this is trim, not wall
MIN_ZONE_H = 0.30     # thinner than one course is a band, not a field
EAVES_Z = 5.55        # above this the roof is in front of the wall


def valid_zone(z, nominal):
    if abs(z["plane"] - nominal) > PLANE_TOL:
        return False                      # phantom plane behind an occluder
    if z["z1"] - max(z["z0"], FIELD_Z0) < MIN_ZONE_H:
        return False                      # sill band, architrave band, transition
    if z["z1"] > EAVES_Z:
        return False                      # cornice / parapet, occluded by eaves
    return True


# ------------------------------------------------------------ kit

_KIT = {}


def block_mesh(prefix, h, w, proud, weather, depth):
    key = (prefix, round(h, 4), round(w, 4), round(proud, 4), round(weather, 4))
    if key in _KIT:
        return _KIT[key]
    name = "%s_h%03d_w%03d" % (prefix, round(h * 1000), round(w * 1000))
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    x0, x1 = -proud, depth - proud
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y *= w
        v.co.z *= h
    if weather > 0:
        top = [e for e in bm.edges
               if all(abs(v.co.x - x0) < 1e-6 and v.co.z > h * 0.5 - 1e-6 for v in e.verts)]
        if top:
            bmesh.ops.bevel(bm, geom=top, offset=weather, segments=1,
                            affect='EDGES', profile=0.5, clamp_overlap=True)
    zt = h * 0.5 - weather - 1e-4
    front = [e for e in bm.edges
             if all(abs(v.co.x - x0) < 1e-6 for v in e.verts)
             and not all(v.co.z > zt for v in e.verts)]
    if front:
        bmesh.ops.bevel(bm, geom=front, offset=ARRIS, segments=1,
                        affect='EDGES', profile=0.5, clamp_overlap=True)
    back = [f for f in bm.faces if all(abs(v.co.x - x1) < 1e-6 for v in f.verts)]
    bmesh.ops.delete(bm, geom=back, context='FACES')
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            co, n = l.vert.co, f.normal
            if abs(n.x) > 0.5:
                u, v_ = co.y, co.z
            elif abs(n.y) > 0.5:
                u, v_ = co.x, co.z
            else:
                u, v_ = co.y, co.x
            l[uv].uv = (u * UV_PER_M, v_ * UV_PER_M)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    mat = bpy.data.materials.get(MAT_WALL)
    if mat:
        me.materials.append(mat)
    _KIT[key] = me
    return me


# ------------------------------------------------------------ fitter

def fit_run(span, rng, palette):
    if span < min(palette) + 0.010:
        return None
    ideal = max(1, int(round(span / (sum(palette) / len(palette) + JOINT_NOM))))
    if ideal == 1:
        fits = [w for w in palette if w <= span - 2 * JOINT_MIN]
        if not fits:
            return None
        return [max(fits)], 0.0
    best = None
    for n in (ideal, ideal + 1, ideal - 1, ideal + 2):
        if n < 2:
            continue
        target = span - (n - 1) * JOINT_NOM
        widths, left, ok = [], target, True
        for k in range(n):
            rem = n - k
            want = (left / rem) * (1.0 + (rng.random() - 0.5) * 0.30)
            lo, hi = min(palette), max(palette)
            if rem == 1:
                w = min(palette, key=lambda c: abs(c - left))
            else:
                cands = [c for c in palette
                         if (rem - 1) * lo - 1e-9 <= left - c <= (rem - 1) * hi + 1e-9]
                if not cands:
                    ok = False
                    break
                w = min(cands, key=lambda c: abs(c - want))
            widths.append(w)
            left -= w
        if not ok:
            continue
        joint = (span - sum(widths)) / (n - 1)
        if not (0.008 <= joint <= 0.034):
            continue
        bad = abs(joint - JOINT_NOM)
        if best is None or bad < best[0]:
            best = (bad, widths, joint)
    if best is None:
        fits = [w for w in palette if w <= span - 2 * JOINT_MIN]
        if not fits:
            return None
        return [max(fits)], 0.0
    widths = best[1][:]
    rng.shuffle(widths)
    return widths, best[2]


def fit_any(span, rng, palette=None):
    """Given palette first; fall back to jamb stones for narrow piers."""
    got = fit_run(span, rng, palette or WIDTHS)
    if got:
        return got, "field"
    got = fit_run(span, rng, JAMB_WIDTHS)
    if got:
        return got, "jamb"
    return None, None


# ------------------------------------------------------------ build

def build(name):
    axis, sign, nominal = SPEC[name]
    rng = random.Random(SEED)
    scn = bpy.context.scene
    coll_name = "%s_%s" % (COLL_PREFIX, name.title())

    old = bpy.data.collections.get(coll_name)
    if old:
        for ch in list(old.children):
            for ob in list(ch.objects):
                bpy.data.objects.remove(ob, do_unlink=True)
            bpy.data.collections.remove(ch)
        for ob in list(old.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    for c in list(bpy.data.collections):
        if c.name.startswith(coll_name) and c.users == 0:
            bpy.data.collections.remove(c)
    kit_prefix = "%s_%s" % (KIT_PREFIX, name)
    for m in list(bpy.data.meshes):
        if m.name.startswith(kit_prefix) and m.users == 0:
            bpy.data.meshes.remove(m)
    _KIT.clear()

    coll = bpy.data.collections.new(coll_name)
    scn.collection.children.link(coll)

    by_z = load_mask(name)
    zones = [z for z in zones_from_mask(by_z) if valid_zone(z, nominal)]

    rot_z = (0.0 if sign < 0 else math.pi) if axis == 'x' else \
            (math.pi / 2 if sign < 0 else -math.pi / 2)

    placed = [0]
    tris = [0]
    skipped = []
    jamb_used = [0]
    report = []

    def emit(me, h_pos, z_c, plane):
        # The object origin sits ON its zone's plane; the mesh already carries
        # the 25 mm proud offset, so a stepped wall needs no special casing.
        ob = bpy.data.objects.new("ashlar_%s_%03d" % (name, placed[0]), me)
        loc = (plane, h_pos, z_c) if axis == 'x' else (h_pos, plane, z_c)
        ob.location = loc
        ob.rotation_euler = (0.0, 0.0, rot_z)
        coll.objects.link(ob)
        placed[0] += 1
        tris[0] += sum(len(p.vertices) - 2 for p in me.polygons)

    for zi, zn in enumerate(zones):
        plane = zn["plane"]
        z_lo = max(zn["z0"], FIELD_Z0)
        z_hi = zn["z1"]
        if z_hi - z_lo < MIN_CLOSER:
            continue
        ch = H_LOWER if z_hi <= STOREY_SPLIT else H_UPPER
        n_full = int((z_hi - z_lo) // ch)
        rem = (z_hi - z_lo) - n_full * ch
        heights = [ch] * n_full + ([rem] if rem >= MIN_CLOSER else [])
        zc = z_lo
        placed_before = placed[0]
        for hgt in heights:
            runs = runs_for_course(by_z, plane, zc, zc + hgt)
            for (ra, rb) in runs:
                for (a, b) in split_at_regions(name, ra, rb):
                    pal, suppressed = region_for(name, a, b, zc, zc + hgt)
                    if suppressed:
                        continue
                    got, kind = fit_any(b - a, rng, pal)
                    if not got:
                        skipped.append((name, zi, round(zc, 3), round(a, 3), round(b, 3),
                                        round(b - a, 3)))
                        continue
                    widths, joint = got
                    if kind == "jamb":
                        jamb_used[0] += 1
                    hp = a if len(widths) > 1 else (a + b) / 2 - widths[0] / 2
                    for w in widths:
                        me = block_mesh(kit_prefix, hgt, w, PROUD_WALL, TOP_ARRIS, DEPTH)
                        emit(me, hp + w / 2, zc + hgt / 2, plane)
                        hp += w + joint
            zc += hgt
        report.append({"zone": zi, "plane": plane, "z": [round(z_lo, 3), round(z_hi, 3)],
                       "courses": len(heights), "course_h": round(ch, 3),
                       "closer": round(rem, 3) if rem >= MIN_CLOSER else None,
                       "blocks": placed[0] - placed_before})

    park = bpy.data.collections.new(coll_name + "_KIT")
    coll.children.link(park)
    for i, me in enumerate(sorted(set(_KIT.values()), key=lambda m: m.name)):
        ob = bpy.data.objects.new("KITOBJ_%s_%03d" % (name, i), me)
        ob.location = (0, 0, PARK_Z)
        park.objects.link(ob)

    return dict(facade=name, collection=coll_name, blocks=placed[0], tris=tris[0],
                unique_meshes=len(set(_KIT.values())), zones=report,
                skipped_runs=len(skipped), skipped=skipped[:12],
                jamb_runs=jamb_used[0])
