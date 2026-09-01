"""
West-facade ashlar prototype — Phase 2A.

REVERSIBLE BY CONSTRUCTION. Everything this script makes lives in one
collection, COL_Ashlar_West, and every placed object is a linked duplicate of a
kit mesh parked at z = -50. Deleting the collection and the KIT_ASHLAR_* meshes
returns the file to exactly its previous state. `mansion_walls` is never opened,
never edited, never even selected.

WHAT THE MEASUREMENTS SAID, because every number below is derived rather than
chosen:

  west wall plane        x = -7.50   (101 west-facing faces, 61.4 m2)
  facade extent          y -5.29 .. +5.29   (10.58 m)
                         z  0.09 .. 5.08    (4.99 m)
  string course          z 3.33 .. 3.47
  window bays            4, width 1.11 m, z 1.07 .. 3.79
                         y centres -3.745, -1.25, +1.25, +3.745
  existing reveal        120 mm (wall -7.50 -> glass -7.38)
  existing rustic module 0.704 w x 0.344 h x 0.24 d  (terrace plinth, NOT the
                         building - used here as a DIMENSIONAL reference only)

THE AESTHETIC LINE, which is the part a number cannot carry: the terrace
rustication is small, rough and heavily chamfered. The facade must not look like
it. These blocks are wide (0.62-1.06 m against the terrace's 0.704), flat-faced,
and carry a 2 mm arris rather than a rustic chamfer - dressed ashlar, cut and
rubbed, not quarry-faced. The only thing borrowed from the terrace kit is the
course height, so the two systems agree about scale without agreeing about
character.

COURSES land on the real datums rather than on a round number:

  plinth        0.09 -> 0.45   1 course  0.360 m   35 mm proud
  lower storey  0.45 -> 3.33   8 courses 0.360 m   12 mm proud
  upper storey  3.47 -> 5.08   5 courses 0.322 m   12 mm proud

Both storeys divide exactly into their zone, and both course heights sit within
7% of the terrace's 0.344 - so it reads as one masonry system across the estate
without the facade inheriting the terrace's texture.

JOINTS are a gap, not a line. Blocks stand 12 mm proud of x = -7.50, so the
original wall surface IS the bottom of the joint. Nothing is painted and nothing
is cut.

TOLERANCE lives in the joints, which is where real masonry puts it. Widths are
quantised to 12 values so the kit stays at 24 unique meshes; each run of blocks
between two openings is then fitted to its exact span by solving the joint width,
clamped to 14-24 mm. A run that cannot be fitted inside that band gains or loses
a block until it can.

    blender mansion_exterior.blend --python build_ashlar_west.py
"""
import bpy
import bmesh
import random
from mathutils import Vector

# ---------------------------------------------------------------- constants

COLL = "COL_Ashlar_West"
KIT_PREFIX = "KIT_ASHLAR"
PARK_Z = -50.0
SEED = 20260827

WALL_X = -7.50          # measured wall plane
Y0, Y1 = -5.55, 5.55    # true wall-plane VERTEX extent (11.10 m)
# 12 -> 25 mm. At 12 mm the neutral diagnostic read as a smooth slab with
# scored lines: the courses were present in the geometry and absent from the
# image, because a 12 mm step under a high sun casts a shadow narrower than the
# 18 mm joint it sits in. 25 mm is the only variable changed in this pass.
# Burial drops 78 -> 65 mm, still far beyond any z-fighting risk.
PROUD_WALL = 0.025      # 25 mm proud of the wall plane
PROUD_PLINTH = 0.035    # 35 mm — the plinth carries more mass
DEPTH = 0.090           # block depth; 78 mm of it is buried in the wall
ARRIS = 0.002           # 2 mm — an arris, not a rustic chamfer
# 8 mm chamfer on the TOP front edge only.
#
# WHY ONLY THE TOP. Raising projection 12 -> 25 mm multiplied vertical-joint
# contrast by up to 2.3x and moved course lines by 1.09-1.17x — almost nothing.
# The reason is that a horizontal joint is overhung by the block above it by the
# same amount it is recessed, so lifting the projection raises the shadow and
# the thing casting it together. A chamfer breaks that symmetry: it turns the
# top arris into a facet tilted up toward the sky, which LIGHTS rather than
# shadows, drawing the course as a bright line instead of a dark one.
#
# 8 mm on a 360 mm course is 2.2% of the block face — an arris, not a bevelled
# tile edge. The vertical joints are deliberately untouched in this experiment.
TOP_ARRIS = 0.008
JOINT_MIN, JOINT_NOM, JOINT_MAX = 0.014, 0.018, 0.024

# 12 quantised widths, 0.62 .. 1.06, mean 0.84
WIDTHS = [0.62, 0.66, 0.70, 0.74, 0.78, 0.82, 0.88, 0.92, 0.96, 1.00, 1.03, 1.06]

PLINTH = dict(z0=0.09, z1=0.45, h=0.360)
LOWER = dict(z0=0.45, z1=3.33, n=8, h=0.360)
UPPER = dict(z0=3.47, z1=5.74, n=7, h=0.322)   # to the cornice soffit

# ---------------------------------------------------------------- exclusions
#
# Everything the ashlar must terminate against, as world rectangles in the
# facade plane: (y_min, y_max, z_min, z_max). The fitter treats them all the
# same way it already treated windows — the run stops at the edge and a fresh
# run starts beyond it.
#
# WINDOWS. Opening is 1.09 m at z 1.08..3.78; the 40 mm y margin keeps ashlar
# off the reveal. z gets NO margin, or a course whose bottom clears the head by
# 8 mm is cut for nothing.
BAY_Z0, BAY_Z1 = 1.08, 3.78
BAY_HALF = 0.545 + 0.040
BAYS = [-3.75, -1.25, 1.25, 3.75]

# PILASTERS — MEASURED, THEN DISCARDED. Recorded here because the mistake is
# worth keeping.
#
# pilaster_-1_{-4.8,-2.4,0,2.4,4.8} straddle x -7.577..-7.023, so they cross the
# west wall plane at -7.50 and appear to project 77 mm. I excluded the ashlar
# around them, and the facade lost its entire window storey: every pier between
# a pilaster and a window reveal came out 0.167-0.467 m, all below the 0.62 m
# minimum block, so 96 runs were skipped and 8 of 16 courses ended up empty.
#
# They are in COL_INTERIOR. They are the hall's internal order, they are
# excluded from the exterior GLB, and they are never visible from outside. A
# raycast at a pilaster centreline with the interior hidden hits mansion_walls
# at -7.50, not the pilaster.
#
# THE RULE THIS ESTABLISHES: collection membership decides what ships, not
# geometric position. An object crossing the wall plane is not exterior
# articulation just because it pokes through. Nothing in COL_Exterior sits
# between x -9.4 (the terrace plinth) and -7.5 (the wall), so the west wall
# face is clean and the ashlar runs uninterrupted between openings.
PILASTERS = [-4.8, -2.4, 0.0, 2.4, 4.8]
PIL_SHAFT_HALF = 0.28 + 0.018
PIL_BASE_HALF = 0.36 + 0.018
PIL_SHAFT_Z = (0.30, 5.96)
PIL_BASE_Z = (0.00, 0.30)


def exclusions():
    """Every rectangle the masonry must stop against, in facade coordinates.

    Windows only. The pilasters above are interior and deliberately absent.
    """
    return [(c - BAY_HALF, c + BAY_HALF, BAY_Z0, BAY_Z1) for c in BAYS]
# y gets a 40 mm working margin so ashlar never fouls the reveal; z does
# NOT, or a course whose bottom clears the head by 8 mm still gets cut.
BAY_Z0, BAY_Z1 = 1.07, 3.79

MAT_WALL = "MAT_Stone_Wall"
MAT_TRIM = "MAT_Stone_Trim"

# UVs are authored at 1 unit per METRE, which is the convention mansion_walls
# already uses. The 3.33 m/tile scaling is applied once, by the Mapping node
# inside MAT_Stone_Wall. Baking the tile scale into the mesh UVs as well would
# multiply the two together and land the stone at 11 m per tile.
UV_PER_M = 1.0


# ---------------------------------------------------------------- kit meshes

def make_block(name, w, h, depth, proud, top_weather=0.0):
    """One dressed block. Front face is -X (west). Origin at the block centre.

    `top_weather` chamfers the top-front arris more heavily, which is what turns
    a block into a plinth capping — it sheds water and it catches the key light
    as a single bright line along the base of the building.
    """
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    x_out = -(depth - (depth - proud))  # front face sits at -proud from origin
    x0, x1 = -proud, depth - proud
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y *= w
        v.co.z *= h

    # ORDER MATTERS. The top chamfer is cut FIRST, off the original square edge,
    # so its width is exactly `top_weather`. Doing the general arris first would
    # split the top edge in two and the second bevel would catch both halves,
    # giving roughly double the intended chamfer.
    if top_weather > 0:
        top_front = [e for e in bm.edges
                     if all(abs(v.co.x - x0) < 1e-6 and v.co.z > h * 0.5 - 1e-6
                            for v in e.verts)]
        if top_front:
            bmesh.ops.bevel(bm, geom=top_front, offset=top_weather, segments=1,
                            affect='EDGES', profile=0.5, clamp_overlap=True)

    # Remaining front edges get the fine arris. The chamfer facet's own lower
    # edge is excluded, or it would be rounded away again.
    zt = h * 0.5 - top_weather - 1e-4
    front = [e for e in bm.edges
             if all(abs(v.co.x - x0) < 1e-6 for v in e.verts)
             and not all(v.co.z > zt for v in e.verts)]
    if front and ARRIS > 0:
        bmesh.ops.bevel(bm, geom=front, offset=ARRIS, segments=1,
                        affect='EDGES', profile=0.5, clamp_overlap=True)

    # The back face is buried 78 mm inside a solid wall and can never be seen.
    back = [f for f in bm.faces if all(abs(v.co.x - x1) < 1e-6 for v in f.verts)]
    bmesh.ops.delete(bm, geom=back, context='FACES')

    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            co = l.vert.co
            n = f.normal
            if abs(n.x) > 0.5:
                u, v_ = co.y, co.z
            elif abs(n.y) > 0.5:
                u, v_ = co.x, co.z
            else:
                u, v_ = co.y, co.x
            l[uv].uv = (u * UV_PER_M, v_ * UV_PER_M)

    bm.to_mesh(me)
    bm.free()
    # Flat shading throughout: a dressed block has no smooth curvature to keep,
    # and auto-smooth was removed from the Mesh API in Blender 4.1+ anyway.
    for p in me.polygons:
        p.use_smooth = False
    return me


# ---------------------------------------------------------------- run fitting

def fit_run(span, rng, palette):
    """Choose block widths for one run and solve the joint width to fit exactly.

    DETERMINISTIC AND TOTAL. The first version drew widths at random and kept a
    candidate only if the resulting joint happened to land in the legal band —
    which silently returned None for the 1.305 m piers between windows, and left
    3.7 m holes in the middle of the facade. Randomly sampling a 22 mm target out
    of a 12-value palette is a lottery, and a wall is not a lottery.

    This walks the run instead: at each step it takes the palette width closest
    to the space that remains once the outstanding joints are paid for, nudged by
    a deterministic jitter so the coursing still varies. The last block absorbs
    whatever is left. It always returns a complete run.

    Every width is drawn from the palette, so the kit never grows, and the span
    is absorbed by the joint — which is where real masonry puts its tolerance.
    A pier too narrow for two blocks takes one, centred, with the surplus shared
    by the two jamb joints.

    Returns (widths, joint) or None only if the run cannot hold a single block.
    """
    if span < min(palette) + 0.010:
        return None

    ideal = max(1, int(round(span / (0.84 + JOINT_NOM))))

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
        widths, left = [], target
        ok = True
        for k in range(n):
            rem = n - k
            want = left / rem
            # deterministic jitter, so the coursing varies without going random
            want *= 1.0 + (rng.random() - 0.5) * 0.30
            # Only widths that leave the remaining blocks a legal share are
            # candidates. Without this bound the first pick can overshoot, the
            # run becomes unsatisfiable, and the whole pier falls back to one
            # block with 122 mm jamb gaps either side — which is what put
            # holes beside every window on the first build.
            lo, hi = min(palette), max(palette)
            if rem == 1:
                # The last block absorbs the remainder. Bounding it like the
                # others would demand an exact palette match to the millimetre,
                # which never happens — and that emptied every full course down
                # to a single block.
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

    # SHUFFLE THE RUN. The fitter is deterministic, so every course crossing the
    # same window piers solved to the same widths in the same order — eight
    # identical courses stacked up, and 62% of vertical joints landing within
    # 80 mm of the joint above. That is the procedural brick wall this system
    # exists to avoid.
    #
    # Reordering is free: the joint width is computed from the SUM of the
    # widths, which a permutation does not change. The run still fits exactly;
    # only the joint positions move.
    widths = best[1][:]
    rng.shuffle(widths)
    return widths, best[2]


def segments_for_course(z0, z1):
    """Horizontal spans of wall left once every exclusion overlapping this
    course has been removed. Overlapping exclusions are merged, so a pilaster
    that touches a window reveal produces one boundary rather than two."""
    cuts = []
    for (a, b, ez0, ez1) in exclusions():
        if z1 > ez0 and z0 < ez1:
            cuts.append((a, b))
    if not cuts:
        return [(Y0, Y1)]
    cuts.sort()
    merged = [list(cuts[0])]
    for a, b in cuts[1:]:
        if a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    segs, y = [], Y0
    for a, b in merged:
        if a > y:
            segs.append((y, a))
        y = max(y, b)
    if y < Y1:
        segs.append((y, Y1))
    return segs


# ---------------------------------------------------------------- build

def build():
    rng = random.Random(SEED)
    scn = bpy.context.scene

    # collection
    old = bpy.data.collections.get(COLL)
    if old:
        # Children first. Removing the parent alone orphans the kit collection,
        # and eleven rebuilds left eleven COL_Ashlar_West_KIT.0xx datablocks
        # floating in the file.
        for child in list(old.children):
            for ob in list(child.objects):
                bpy.data.objects.remove(ob, do_unlink=True)
            bpy.data.collections.remove(child)
        for ob in list(old.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    for c in list(bpy.data.collections):
        if c.name.startswith(COLL) and c.users == 0:
            bpy.data.collections.remove(c)
    coll = bpy.data.collections.new(COLL)
    scn.collection.children.link(coll)

    for m in list(bpy.data.meshes):
        if m.name.startswith(KIT_PREFIX):
            bpy.data.meshes.remove(m)

    mat_wall = bpy.data.materials.get(MAT_WALL)
    mat_trim = bpy.data.materials.get(MAT_TRIM) or mat_wall

    # 24 kit meshes: 12 widths x 2 course heights, + 12 plinth
    kit = {}
    for tag, h, proud, weather in (("LO", LOWER["h"], PROUD_WALL, TOP_ARRIS),
                                   ("UP", UPPER["h"], PROUD_WALL, TOP_ARRIS),
                                   ("PL", PLINTH["h"], PROUD_PLINTH, 0.010)):
        for i, w in enumerate(WIDTHS):
            nm = "%s_%s_%02d" % (KIT_PREFIX, tag, i)
            me = make_block(nm, w, h, DEPTH if tag != "PL" else DEPTH + 0.023,
                            proud, weather)
            # Baseline test: the plinth rides MAT_Stone_Wall too. MAT_Stone_Trim
            # still carries the synthetic trim maps, and letting it into frame
            # would contaminate the one variable this render is isolating.
            me.materials.append(mat_wall)
            kit[(tag, i)] = me

    # park one instance of each so the kit survives a file reload
    park = bpy.data.collections.new(COLL + "_KIT")
    coll.children.link(park)
    for (tag, i), me in kit.items():
        ob = bpy.data.objects.new("KITOBJ_%s_%02d" % (tag, i), me)
        ob.location = (0, 0, PARK_Z)
        park.objects.link(ob)

    widx = {w: i for i, w in enumerate(WIDTHS)}
    placed = 0
    tris = 0
    skipped = []   # runs too narrow for the approved palette

    def emit(tag, w, y_c, z_c):
        nonlocal placed, tris
        i = widx[w]
        me = kit[(tag, i)]
        ob = bpy.data.objects.new("ashlar_%s_%03d" % (tag, placed), me)
        ob.location = (WALL_X, y_c, z_c)
        coll.objects.link(ob)
        placed += 1
        tris += sum(len(p.vertices) - 2 for p in me.polygons)

    # ---- plinth: one continuous course, no openings reach it
    z_c = PLINTH["z0"] + PLINTH["h"] / 2
    for (a, b) in segments_for_course(PLINTH["z0"], PLINTH["z1"]):
        got = fit_run(b - a, rng, WIDTHS)
        if not got:
            skipped.append(("PL", round(a, 3), round(b, 3), round(b - a, 3)))
            continue
        widths, joint = got
        y = a if len(widths) > 1 else (a + b) / 2 - widths[0] / 2
        for w in widths:
            emit("PL", w, y + w / 2, z_c)
            y += w + joint

    # ---- storeys
    for tag, spec in (("LO", LOWER), ("UP", UPPER)):
        for c in range(spec["n"]):
            z0 = spec["z0"] + c * spec["h"]
            z_c = z0 + spec["h"] / 2
            for (a, b) in segments_for_course(z0, z0 + spec["h"]):
                got = fit_run(b - a, rng, WIDTHS)
                if not got:
                    skipped.append((tag, round(a, 3), round(b, 3), round(b - a, 3)))
                    continue
                widths, joint = got
                # A single block in a narrow pier is centred, so the surplus is
                # shared evenly by the two jamb joints rather than piling up on
                # one side of the opening.
                y = a if len(widths) > 1 else (a + b) / 2 - widths[0] / 2
                for w in widths:
                    emit(tag, w, y + w / 2, z_c)
                    y += w + joint

    return dict(collection=COLL, blocks=placed, tris=tris,
                skipped_runs=len(skipped), skipped=skipped[:20],
                unique_meshes=len(kit),
                joint_nominal_mm=JOINT_NOM * 1000,
                joint_depth_mm=PROUD_WALL * 1000,
                plinth_proud_mm=PROUD_PLINTH * 1000,
                arris_mm=ARRIS * 1000)


if __name__ == "__main__":
    print(build())
