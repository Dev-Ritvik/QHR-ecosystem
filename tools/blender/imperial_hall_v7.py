"""
The hall made imperial: a double-curved staircase, a room three times the
original's height, and the portrait on the central landing.

    blender --background mansion_web_V7HALL.blend --python imperial_hall_v7.py -- <out.blend>

Then bake and ship as the extended hall was:

    # pack the lightmap UVs and take a quick bake (the pack is CPU-only and
    # takes ~20 min on this many curved pieces; the GPU idles meanwhile)
    blender --background <out.blend> --python bake_lightmap.py -- <bakedir> 4096 64 600 <out.blend> 2048
    BLEND=<out.blend> BAKE=<bakedir> WORK=<workdir> bash tools/gltf/ship_hall_v7.sh
    # the shipped atlas: re-baked on that layout, denoised, UASTC, swapped in
    blender --background <out.blend> --python rebake_hall_lightmap_v7.py -- <rebakedir> 768 4096 2048
    python tools/gltf/finish_hall_lightmap.py <rebakedir> <atlas.png>
    ktx create ... --encode uastc ... <atlas.png> <atlas.ktx2>   (see finish_hall_lightmap.py)
    python tools/gltf/glb_replace_image.py interior_hall.glb out.glb 3 <atlas.ktx2>

WHAT THE CLIENT APPROVED (the third review): "a double-curved imperial
staircase, triple the ceiling height, and a portrait at a central landing."

THE STAIR. A horseshoe: two curved flights, each 2 m wide, springing apart from
the hall floor and climbing 119 degrees round a central court to a landing
4.2 m up against the back wall - the Fontainebleau figure. 26 risers of 16 cm,
30 cm goings on the walking line. The flights are solid stone with a raked
soffit, so from the court one sees the underside sweep up with them. One
balustrade runs unbroken up the right flight, across the landing's curved front
and down the left; the outer balustrades die into the back wall. Newels stand at
the four feet and where each flight meets the landing. A runner climbs each
flight and crosses the landing, held by brass rods.

THE HEIGHT. The shell was 8 m. The walls now rise to 13 m, with the existing
cornice kept as the string course between two storeys: above it an attic order
(the room's own pilasters at 0.59 scale), arched clerestory windows between
them on the side walls, three over the entry, and a second cornice. Over that, a
coffered ceiling opens into a dome 10.8 m across whose oculus stands at 19.2 m -
three times the 6.4 m of the room as it was first built. Three times the 8 m
of the extended hall (24 m) would have put the hall's ceiling twice as high as
the house's own parapet; the dome is how a real house of this type gets its
height, under the lantern, and it is what a visitor looking up expects to see.

THE PORTRAIT hangs on the back wall over the landing, a quarter larger, on a
walnut panel inside an arched architrave that breaks through the string course.
The chandelier hangs under the dome on a chain from the oculus ring, larger and
higher, clear of every camera beat.

Axes are Blender's: entry on -y, stair on +y, z up.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

OUT = sys.argv[sys.argv.index("--") + 1]

# ---------------------------------------------------------------- the numbers
HALF_X, HALF_Y = 9.9, 7.7
OLD_TOP, WALL_TOP = 8.0, 13.0
CORNICE_LIFT = WALL_TOP - OLD_TOP          # the upper cornice is the lower one, 5 m up
STRING_TOP = 8.02                          # top of the kept cornice (the string course)
# The stair
C = Vector((0.0, 3.1, 0.0))                # the horseshoe's centre, on the floor
R_I, R_O = 2.6, 4.6                        # the flights' inner and outer radii
R_C = (R_I + R_O) / 2                      # the walking line
TH_TOP, TH_BOT = math.radians(65.0), math.radians(-54.0)
H_LAND = 4.2
N_RISE = 26
RISE = H_LAND / N_RISE
N_TREAD = N_RISE - 1
DTH = (TH_TOP - TH_BOT) / N_TREAD
SOFFIT = 0.55                              # stone depth under the nosing line
# The balustrade
BAL_IN = 0.14                              # the balusters' line, in from each edge
PLINTH_W, PLINTH_H, PLINTH_DOWN = 0.26, 0.16, 0.36
BAL_H = 0.95
RAIL_W, RAIL_H = 0.17, 0.11
BAL_STEP = 0.25
# The portrait
PORTRAIT_SCALE = 1.25                      # relative to where it hangs now
# the bottom of the frame: high enough that the landing's rail, seen from the
# camera's rise up the court, passes below the canvas rather than across it
PORTRAIT_FOOT = H_LAND + 0.8
ARCH_HALF, ARCH_SPRING = 1.85, 9.6         # the walnut panel's half-width and spring
BAND = 0.28
# The attic storey
UP_ORDER = (12.45 - STRING_TOP) / 7.452    # the lower order is 0..7.452
# The dome
DOME_R, OCULUS_R, LANTERN_TOP = 5.4, 1.0, 19.2
# Texture densities (UV units per metre), measured on the delivered hall
DEN = {"MAT_Trim_Cream": 0.215, "MAT_Wall_Plaster": 3.0, "MAT_Ceiling_Plaster": 3.0,
       "MAT_Wood_Dark": 0.303, "MAT_Runner": 0.727, "MAT_Runner_Binding": 0.727,
       "MAT_Gold": 2.0, "MAT_Table_Brass": 1.054, "MAT_MarbleFloor": 1.667}

interior = bpy.data.collections["COL_Interior"]
objs = {o.name: o for o in interior.all_objects}
M = bpy.data.materials


def mat(name):
    return M[name]


def emissive(name, colour, strength):
    m = M.get(name) or M.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Emission Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    bsdf.inputs["Roughness"].default_value = 0.3
    return m


MAT_GLASS = emissive("MAT_Clerestory", (1.0, 0.9, 0.74), 3.2)
MAT_SKY = emissive("MAT_OculusSky", (0.92, 0.95, 1.0), 6.0)

made = []


def add_mesh(name, verts, faces, material, face_uvs=None, density=None):
    """A new lightmappable mesh in COL_Interior. UV0 is either given per face
    (a list of per-loop (u, v) per face) or box-projected at the material's
    measured texel density, so new stone reads at the scale the old stone does."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.materials.append(material)
    uv = me.uv_layers.new(name="UVMap")
    d = density if density is not None else DEN.get(material.name, 1.0)
    for pi, poly in enumerate(me.polygons):
        if face_uvs is not None and face_uvs[pi] is not None:
            for k, li in enumerate(poly.loop_indices):
                uv.data[li].uv = face_uvs[pi][k]
            continue
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[a] * d, co[b] * d)
    me.validate()
    me.update()
    o = bpy.data.objects.new(name, me)
    interior.objects.link(o)
    made.append(o)
    return o


def face_toward(o, n):
    """Single-sided surfaces (panes, panels, the sky): face them into the room."""
    me = o.data
    mean = Vector()
    for p in me.polygons:
        mean += p.normal * p.area
    if mean.dot(n) < 0:
        for p in me.polygons:
            p.flip()
        me.update()
    return o


def recalc(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()
    return o


def sweep(name, path, profile, material, frame, closed_path=False, caps=True, density=None):
    """A profile swept along a path. `frame(i, tangent)` returns the (side, up)
    axes the profile's (a, b) coordinates are laid on at path point i. UVs run
    along the path and round the profile at the material's density."""
    d = density if density is not None else DEN.get(material.name, 1.0)
    n, m = len(path), len(profile)
    verts, faces, uvs = [], [], []
    along = [0.0]
    for i in range(1, n):
        along.append(along[-1] + (path[i] - path[i - 1]).length)
    round_ = [0.0]
    for k in range(1, m + 1):
        a0, b0 = profile[k - 1]
        a1, b1 = profile[k % m]
        round_.append(round_[-1] + math.hypot(a1 - a0, b1 - b0))
    for i in range(n):
        t = (path[min(n - 1, i + 1)] - path[max(0, i - 1)])
        if closed_path:
            t = path[(i + 1) % n] - path[(i - 1) % n]
        t.normalize()
        side, up = frame(i, t)
        for a, b in profile:
            verts.append(path[i] + side * a + up * b)
    last = n if closed_path else n - 1
    for i in range(last):
        j = (i + 1) % n
        for k in range(m):
            k2 = (k + 1) % m
            faces.append((i * m + k, i * m + k2, j * m + k2, j * m + k))
            s0, s1 = along[i] * d, (along[i] + (path[j] - path[i]).length) * d
            uvs.append([(s0, round_[k] * d), (s0, round_[k + 1] * d), (s1, round_[k + 1] * d), (s1, round_[k] * d)])
    if caps and not closed_path:
        faces.append(tuple(reversed(range(m))))
        uvs.append(None)
        faces.append(tuple((n - 1) * m + k for k in range(m)))
        uvs.append(None)
    return recalc(add_mesh(name, verts, faces, material, uvs, density))


def upright(i, t):
    """Rails, plinths, bands: the section stays vertical whatever the rake."""
    side = t.cross(Vector((0, 0, 1)))
    if side.length < 1e-6:
        side = Vector((1, 0, 0))
    return side.normalized(), Vector((0, 0, 1))


def bbox(o):
    ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (Vector((min(v.x for v in ws), min(v.y for v in ws), min(v.z for v in ws))),
            Vector((max(v.x for v in ws), max(v.y for v in ws), max(v.z for v in ws))))


def face_gradients(pts, uvs):
    """World-space gradients of u and of v across one polygon (extend_hall_v7.py)."""
    best, tri = 0.0, None
    for k in range(1, len(pts) - 1):
        a = (pts[k] - pts[0]).cross(pts[k + 1] - pts[0]).length
        if a > best:
            best, tri = a, (0, k, k + 1)
    if tri is None or best < 1e-10:
        return None
    i0, i1, i2 = tri
    e1, e2 = pts[i1] - pts[i0], pts[i2] - pts[i0]
    t = e1.normalized()
    b = e1.cross(e2).normalized().cross(t)
    a11, a12, a21, a22 = e1.dot(t), e1.dot(b), e2.dot(t), e2.dot(b)
    det = a11 * a22 - a12 * a21
    if abs(det) < 1e-12:
        return None
    grads = []
    for c in (0, 1):
        d1, d2 = uvs[i1][c] - uvs[i0][c], uvs[i2][c] - uvs[i0][c]
        grads.append(t * ((d1 * a22 - d2 * a12) / det) + b * ((a11 * d2 - a21 * d1) / det))
    return grads


def remap(o, fn):
    """Move every vertex through fn (world space), carrying UV0 with it so the
    texel density is unchanged (the lightmap layer is re-packed by the bake)."""
    me = o.data.copy() if o.data.users > 1 else o.data
    o.data = me
    mw, inv = o.matrix_world.copy(), o.matrix_world.inverted()
    old = [mw @ v.co for v in me.vertices]
    new = [fn(w.copy()) for w in old]
    for layer in me.uv_layers:
        if layer.name == "UVLightmap":
            continue
        for poly in me.polygons:
            loops = list(poly.loop_indices)
            vs = [me.loops[li].vertex_index for li in loops]
            uvs = [tuple(layer.data[li].uv) for li in loops]
            g = face_gradients([old[vi] for vi in vs], uvs)
            if g is None:
                continue
            for li, vi, uv in zip(loops, vs, uvs):
                dd = new[vi] - old[vi]
                layer.data[li].uv = (uv[0] + g[0].dot(dd), uv[1] + g[1].dot(dd))
    for v, w in zip(me.vertices, new):
        v.co = inv @ w


def duplicate(o, name, m=None, copy_data=True):
    n = o.copy()
    if copy_data and o.data is not None:
        n.data = o.data.copy()
    for col in o.users_collection:
        col.objects.link(n)
    if m is not None:
        n.matrix_world = m @ o.matrix_world
    n.name = name
    return n


def compose(o, pivot, scale, dest):
    P, D = Vector(pivot), Vector(dest)
    o.matrix_world = Matrix.Translation(D) @ Matrix.Diagonal((scale, scale, scale, 1)) @ Matrix.Translation(-P) @ o.matrix_world


def remove(o):
    bpy.data.objects.remove(o, do_unlink=True)


def starts(name, *p):
    return any(name.startswith(x) for x in p)


# ------------------------------------------------ 1. clear the straight stair
gone = [n for n in objs if starts(n, "stair_", "runner_", "bal_", "newel_", "ceiling_rosette", "coffer_")
        or n == "int_ceiling"]
kit_baluster = objs["bal_1_l0"].data
kit_newel = objs["newel_bot_1"].data
BAL_SCALE = 1.25 * BAL_H / 1.10           # the delivered baluster is 1.10 m at 1.25
NEWEL_SCALE = 1.25
for n in gone:
    remove(objs.pop(n))
print("CLEARED|%d" % len(gone))


# ------------------------------------------------------------ 2. the shell up
for n in ("int_wall_back", "int_wall_front", "int_wall_left", "int_wall_right"):
    remap(objs[n], lambda w: Vector((w.x, w.y, WALL_TOP if w.z > OLD_TOP - 0.01 else w.z)))

# The upper cornice: the lower one's profile, 5 m up, unbroken, taken before
# the back wall's is opened for the portrait.
for n in [n for n in objs if n.startswith("int_cornice_")]:
    duplicate(objs[n], n.replace("int_cornice_", "int_cornice_up_"), Matrix.Translation((0, 0, CORNICE_LIFT)))

# The string course opens round the portrait's arch on the back wall.
GAP = ARCH_HALF + BAND
for n in [n for n in objs if n.startswith("int_cornice_b_")]:
    o = objs[n]
    left = duplicate(o, n + "_L")
    remap(left, lambda w: Vector((min(w.x, -GAP), w.y, w.z)))
    remap(o, lambda w: Vector((max(w.x, GAP), w.y, w.z)))
    o.name = n + "_R"
for n in [n for n in list(objs) if n.startswith("anth_x")]:
    lo, hi = bbox(objs[n])
    if hi.y > 7.0 and abs((lo.x + hi.x) / 2) < GAP + 0.1:
        remove(objs.pop(n))
objs = {o.name: o for o in interior.all_objects}


# The attic order: the room's pilasters at 0.59, standing on the string course.
added_order = 0
for n in [n for n in objs if starts(n, "pilaster_", "pil_plinth_", "pil_torus_", "capital_")]:
    o = objs[n]
    lo, hi = bbox(o)
    s = math.copysign(1.0, (lo.x + hi.x) / 2)
    cy = (lo.y + hi.y) / 2
    up = duplicate(o, n + "_up", copy_data=not n.startswith("capital_"))
    compose(up, (s * 10.0, cy, 0.0), UP_ORDER, (s * 10.0, cy, STRING_TOP))
    added_order += 1
print("ORDER|%d" % added_order)


# --------------------------------------------------------- 3. the windows
def arch_outline(cx, cz_spring, half, sill, n_arc=16):
    """An arch-topped opening in its wall plane: (a, z) points, anticlockwise."""
    pts = [(cx - half, sill), (cx + half, sill)]
    for k in range(n_arc + 1):
        a = math.pi * k / n_arc
        pts.append((cx + half * math.cos(a), cz_spring + half * math.sin(a)))
    return pts


def wall_point(wall, a, z, off):
    """A point on a wall's inner face. a runs along the wall, off into the room."""
    if wall == "L":
        return Vector((-HALF_X + off, a, z))
    if wall == "R":
        return Vector((HALF_X - off, -a, z))
    if wall == "F":
        return Vector((-a, -HALF_Y + off, z))
    return Vector((a, HALF_Y - off, z))          # back


def wall_normal(wall):
    return {"L": Vector((1, 0, 0)), "R": Vector((-1, 0, 0)), "F": Vector((0, 1, 0)), "B": Vector((0, -1, 0))}[wall]


def window(tag, wall, cx, half, sill, spring, lights, pane=None, bars=True):
    """A clerestory window: a glowing pane, glazing bars, an architrave and a
    sill. The wall is not cut - the pane sits on its face - so the bake sees the
    light arrive through the window's shape, which is what it reads as."""
    outline = arch_outline(cx, spring, half, sill)
    nrm = wall_normal(wall)
    # the pane
    pv = [wall_point(wall, a, z, 0.012) for a, z in outline]
    face_toward(add_mesh(("dress_win_%s" if pane is None else "win_blind_%s") % tag, pv, [list(range(len(pv)))],
                         MAT_GLASS if pane is None else pane), nrm)
    # the architrave: the outline swept, proud of the wall
    path = [wall_point(wall, a, z, 0.0) for a, z in outline[1:]] + [wall_point(wall, *outline[0], 0.0)]
    centre = wall_point(wall, cx, (sill + spring) / 2, 0.0)

    def frame(i, t):
        out = (path[i] - centre)
        out -= nrm * out.dot(nrm)
        side = t.cross(nrm).normalized()
        if side.dot(out) < 0:
            side = -side
        return side, nrm
    prof = [(0.0, 0.0), (BAND * 0.62, 0.0), (BAND * 0.62, 0.05), (BAND * 0.3, 0.09), (0.0, 0.13)]
    sweep("win_frame_%s" % tag, path, prof, mat("MAT_Trim_Cream"), frame, caps=False)
    # glazing bars: one mullion, two transoms, a radiating pair in the arch
    bar_v = []
    for a0, z0, a1, z1 in ((cx, sill, cx, spring + half), (cx - half, sill + (spring - sill) * 0.36, cx + half, sill + (spring - sill) * 0.36),
                           (cx - half, spring, cx + half, spring),
                           (cx, spring, cx - half * 0.7071, spring + half * 0.7071), (cx, spring, cx + half * 0.7071, spring + half * 0.7071)):
        p0, p1 = wall_point(wall, a0, z0, 0.02), wall_point(wall, a1, z1, 0.02)
        t = (p1 - p0).normalized()
        side = t.cross(nrm).normalized()
        w, dpt = 0.035, 0.05
        for p in (p0, p1):
            for sa, sb in ((-w, 0), (w, 0), (w, dpt), (-w, dpt)):
                bar_v.append(p + side * sa + nrm * sb)
    fb = []
    for b in range(len(bar_v) // 8):
        o = b * 8
        for k in range(4):
            k2 = (k + 1) % 4
            fb.append((o + k, o + k2, o + 4 + k2, o + 4 + k))
    if bars:
        recalc(add_mesh("win_bar_%s" % tag, bar_v, fb, mat("MAT_Trim_Cream")))
    # the sill
    s0, s1 = wall_point(wall, cx - half - 0.12, sill - 0.12, 0.0), wall_point(wall, cx + half + 0.12, sill, 0.16)
    lo = Vector(map(min, s0, s1))
    hi = Vector(map(max, s0, s1))
    box("win_sill_%s" % tag, lo, hi, mat("MAT_Trim_Cream"))
    # the light it lets in, for the bake
    if lights:
        ld = bpy.data.lights.new("LGT_win_%s" % tag, "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = half * 2, (spring + half - sill)
        ld.energy = lights
        ld.color = (1.0, 0.9, 0.76)
        lo_ = bpy.data.objects.new("LGT_win_%s" % tag, ld)
        interior.objects.link(lo_)
        at = wall_point(wall, cx, (sill + spring + half) / 2, 0.05)
        # an area light shines down its local -Z: point that into the room
        lo_.matrix_world = Matrix.Translation(at) @ (nrm * -1).to_track_quat("Z", "Y").to_matrix().to_4x4()


def box(name, lo, hi, material):
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return add_mesh(name, [Vector(p) for p in v], f, material)


SILL, SPRING, HALF_W = 8.6, 11.0, 0.65
for wall in ("L", "R"):
    for cy in (-6.0, -3.6, -1.2, 1.2, 3.6, 6.0):
        a = cy if wall == "L" else -cy
        window("%s%+.1f" % (wall, cy), wall, a, HALF_W, SILL, SPRING, 140)
# over the entry: a great arched window on the axis, a smaller one either side
window("F0", "F", 0.0, 2.0, 8.5, 10.1, 520)
window("F-1", "F", -5.4, HALF_W + 0.1, SILL, SPRING, 150)
window("F+1", "F", 5.4, HALF_W + 0.1, SILL, SPRING, 150)
# the back wall's upper storey: the same windows, either side of the portrait
for cx in (-5.4, 5.4):
    window("B%+.0f" % cx, "B", cx, HALF_W + 0.1, SILL, SPRING, 150)


# --------------------------------------------------- 4. the ceiling and dome
def ceiling_with_hole(z, r_hole, name):
    """The flat ceiling, x +/-HALF_X by y +/-HALF_Y, with the dome's round
    opening: a ring of quads from the circle out to the rectangle."""
    corners = [math.atan2(sy * HALF_Y, sx * HALF_X) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
    angs = sorted(set([2 * math.pi * k / 96 for k in range(96)] + [a % (2 * math.pi) for a in corners]))
    verts, faces = [], []
    for a in angs:
        c, s = math.cos(a), math.sin(a)
        t = min(HALF_X / abs(c) if abs(c) > 1e-9 else 1e9, HALF_Y / abs(s) if abs(s) > 1e-9 else 1e9)
        verts.append(Vector((r_hole * c, r_hole * s, z)))
        verts.append(Vector((t * c, t * s, z)))
    n = len(angs)
    for i in range(n):
        j = (i + 1) % n
        faces.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))    # facing down
    return add_mesh(name, verts, faces, mat("MAT_Ceiling_Plaster"))


ceiling_with_hole(WALL_TOP, DOME_R + 0.45, "int_ceiling")

# Coffer beams: a grid, stopped short of the dome's ring.
BEAM_W, BEAM_D = 0.3, 0.42
ring_out = DOME_R + 0.45
k = 0
for x in (-7.5, -5.0, -2.5, 0.0, 2.5, 5.0, 7.5):
    # the beam along y at this x, split where it would cross the ring
    ys = [(-HALF_Y, HALF_Y)]
    if abs(x) < ring_out:
        h = math.sqrt(ring_out ** 2 - x ** 2)
        ys = [(-HALF_Y, -h), (h, HALF_Y)]
    for y0, y1 in ys:
        box("coffer_y_%d" % k, Vector((x - BEAM_W / 2, y0, WALL_TOP - BEAM_D)), Vector((x + BEAM_W / 2, y1, WALL_TOP)), mat("MAT_Ceiling_Plaster"))
        k += 1
for y in (-5.0, -2.5, 0.0, 2.5, 5.0):
    xs = [(-HALF_X, HALF_X)]
    if abs(y) < ring_out:
        h = math.sqrt(ring_out ** 2 - y ** 2)
        xs = [(-HALF_X, -h), (h, HALF_X)]
    for x0, x1 in xs:
        box("coffer_x_%d" % k, Vector((x0, y - BEAM_W / 2, WALL_TOP - BEAM_D)), Vector((x1, y + BEAM_W / 2, WALL_TOP)), mat("MAT_Ceiling_Plaster"))
        k += 1
# the perimeter frame
box("coffer_edge_f", Vector((-HALF_X, -HALF_Y, WALL_TOP - BEAM_D)), Vector((HALF_X, -HALF_Y + 0.5, WALL_TOP)), mat("MAT_Ceiling_Plaster"))
box("coffer_edge_b", Vector((-HALF_X, HALF_Y - 0.5, WALL_TOP - BEAM_D)), Vector((HALF_X, HALF_Y, WALL_TOP)), mat("MAT_Ceiling_Plaster"))
box("coffer_edge_l", Vector((-HALF_X, -HALF_Y, WALL_TOP - BEAM_D)), Vector((-HALF_X + 0.5, HALF_Y, WALL_TOP)), mat("MAT_Ceiling_Plaster"))
box("coffer_edge_r", Vector((HALF_X - 0.5, -HALF_Y, WALL_TOP - BEAM_D)), Vector((HALF_X, HALF_Y, WALL_TOP)), mat("MAT_Ceiling_Plaster"))

# The ring the dome springs from: a moulded annulus, and its soffit.
RING_SEG = 96
ring = [Vector((math.cos(2 * math.pi * i / RING_SEG), math.sin(2 * math.pi * i / RING_SEG), 0)) for i in range(RING_SEG)]
ring_prof = [(0.0, 0.0), (0.45, 0.0), (0.45, -0.18), (0.3, -0.26), (0.12, -0.3), (0.0, -0.42)]


def ring_sweep(name, radius, z, prof, material):
    path = [Vector((p.x * radius, p.y * radius, z)) for p in ring]
    return sweep(name, path, prof, material,
                 lambda i, t: (Vector((path[i].x, path[i].y, 0)).normalized(), Vector((0, 0, 1))),
                 closed_path=True, caps=False)


ring_sweep("coffer_ring", DOME_R, WALL_TOP, ring_prof, mat("MAT_Trim_Cream"))

# The dome: a hemisphere of radius DOME_R springing at the ceiling, faced
# inward, open at the oculus.
SEG, RINGS = 64, 22
top_phi = math.acos(OCULUS_R / DOME_R)
dv, df, duv = [], [], []
for r in range(RINGS + 1):
    phi = top_phi * r / RINGS
    for s in range(SEG):
        a = 2 * math.pi * s / SEG
        dv.append(Vector((DOME_R * math.cos(phi) * math.cos(a), DOME_R * math.cos(phi) * math.sin(a), WALL_TOP + DOME_R * math.sin(phi))))
d = DEN["MAT_Ceiling_Plaster"]
for r in range(RINGS):
    for s in range(SEG):
        s2 = (s + 1) % SEG
        df.append((r * SEG + s, (r + 1) * SEG + s, (r + 1) * SEG + s2, r * SEG + s2))   # inward
        u0, u1 = s / SEG * 2 * math.pi * DOME_R * d, (s + 1) / SEG * 2 * math.pi * DOME_R * d
        v0, v1 = top_phi * r / RINGS * DOME_R * d, top_phi * (r + 1) / RINGS * DOME_R * d
        duv.append([(u0, v0), (u0, v1), (u1, v1), (u1, v0)])
add_mesh("int_dome", dv, df, mat("MAT_Ceiling_Plaster"), duv)

# Ribs and rings on the dome, in the room's cream.
centre = Vector((0, 0, WALL_TOP))


def dome_frame(path):
    def f(i, t):
        n = (centre - path[i]).normalized()      # into the room
        side = t.cross(n).normalized()
        return side, n
    return f


rib_prof = [(-0.11, 0.0), (0.11, 0.0), (0.09, 0.07), (0.04, 0.11), (-0.04, 0.11), (-0.09, 0.07)]
for s in range(16):
    a = 2 * math.pi * s / 16
    path = []
    for r in range(RINGS + 1):
        phi = top_phi * r / RINGS
        path.append(Vector(((DOME_R - 0.005) * math.cos(phi) * math.cos(a), (DOME_R - 0.005) * math.cos(phi) * math.sin(a),
                            WALL_TOP + (DOME_R - 0.005) * math.sin(phi))))
    sweep("dome_rib_%02d" % s, path, rib_prof, mat("MAT_Trim_Cream"), dome_frame(path), caps=False)
for tag, phi in (("lo", math.radians(24)), ("hi", math.radians(52))):
    rr = (DOME_R - 0.005) * math.cos(phi)
    zz = WALL_TOP + (DOME_R - 0.005) * math.sin(phi)
    path = [Vector((p.x * rr, p.y * rr, zz)) for p in ring]
    sweep("dome_ring_%s" % tag, path, [(-0.09, 0.0), (0.09, 0.0), (0.06, 0.09), (-0.06, 0.09)], mat("MAT_Trim_Cream"),
          dome_frame(path), closed_path=True, caps=False)

# The lantern: a short drum over the oculus, and the sky at its top.
z_oc = WALL_TOP + DOME_R * math.sin(top_phi)
lv, lf = [], []
for s in range(SEG):
    a = 2 * math.pi * s / SEG
    lv.append(Vector((OCULUS_R * math.cos(a), OCULUS_R * math.sin(a), z_oc)))
    lv.append(Vector((OCULUS_R * math.cos(a), OCULUS_R * math.sin(a), LANTERN_TOP)))
for s in range(SEG):
    s2 = (s + 1) % SEG
    lf.append((2 * s, 2 * s + 1, 2 * s2 + 1, 2 * s2))
add_mesh("int_lantern", lv, lf, mat("MAT_Ceiling_Plaster"))
ring_sweep("dome_oculus_ring", OCULUS_R, z_oc, [(0.0, 0.0), (0.22, 0.0), (0.22, -0.08), (0.08, -0.16), (0.0, -0.18)], mat("MAT_Gold"))
sky = [Vector((OCULUS_R * 1.01 * math.cos(2 * math.pi * s / SEG), OCULUS_R * 1.01 * math.sin(2 * math.pi * s / SEG), LANTERN_TOP - 0.01)) for s in range(SEG)]
face_toward(add_mesh("dress_oculus_sky", sky, [list(range(SEG))], MAT_SKY), Vector((0, 0, -1)))
oc = bpy.data.lights.new("LGT_oculus", "AREA")
oc.shape, oc.size, oc.energy, oc.color = "DISK", OCULUS_R * 2, 4200, (1.0, 0.95, 0.86)
oco = bpy.data.objects.new("LGT_oculus", oc)
interior.objects.link(oco)
oco.matrix_world = Matrix.Translation((0, 0, LANTERN_TOP - 0.05))

# --------------------------------------------------------- 5. the chandelier
for n in [n for n in objs if starts(n, "chandelier", "LGT_chandelier")]:
    # its crown at 12.7, inside the dome's opening: the bottom crystal at 9.8
    # leaves the portrait beat a camera under it, 8 m out on the axis
    compose(objs[n], (0, -0.87, 7.85), 1.45, (0, 0, 12.7))
chain = [Vector((0, 0, 12.65)), Vector((0, 0, z_oc - 0.1))]
cv, cf = [], []
for z in (chain[0].z, chain[1].z):
    for s in range(10):
        a = 2 * math.pi * s / 10
        cv.append(Vector((0.035 * math.cos(a), 0.035 * math.sin(a), z)))
for s in range(10):
    s2 = (s + 1) % 10
    cf.append((s, s2, 10 + s2, 10 + s))
add_mesh("chandelier_chain", cv, cf, mat("MAT_Gold"))
L = bpy.data.objects.get("LGT_chandelier")
if L:
    L.data.energy *= 1.8
    L.data.shadow_soft_size *= 1.45
W = bpy.data.objects.get("LGT_stair_wash")
if W:
    W.matrix_world = Matrix.Translation((0, 3.6, 10.5))
    W.data.energy *= 3.0
    W.data.size = 5.0

# ----------------------------------------------------------- 6. the portrait
for n in [n for n in objs if starts(n, "portrait_", "piclight_", "LGT_portrait")]:
    compose(objs[n], (0, HALF_Y, 3.95), PORTRAIT_SCALE, (0, HALF_Y, PORTRAIT_FOOT))
P = bpy.data.objects.get("LGT_portrait")
if P:
    P.data.energy *= PORTRAIT_SCALE ** 2

# The walnut panel it hangs on, arched, and the architrave round it.
panel = arch_outline(0.0, ARCH_SPRING, ARCH_HALF, H_LAND, n_arc=24)
pv = [wall_point("B", a, z, 0.03) for a, z in panel]
face_toward(add_mesh("arch_panel", pv, [list(range(len(pv)))], mat("MAT_Wood_Dark")), wall_normal("B"))
path = [wall_point("B", a, z, 0.0) for a, z in panel[1:]] + [wall_point("B", *panel[0], 0.0)]
nb = wall_normal("B")
mid = wall_point("B", 0.0, ARCH_SPRING, 0.0)


def band_frame(i, t):
    out = path[i] - mid
    out -= nb * out.dot(nb)
    side = t.cross(nb).normalized()
    if side.dot(out) < 0:
        side = -side
    return side, nb


sweep("arch_band", path, [(0.0, 0.0), (BAND, 0.0), (BAND, 0.07), (BAND * 0.55, 0.12), (BAND * 0.2, 0.16), (0.0, 0.18)],
      mat("MAT_Trim_Cream"), band_frame)
ks = wall_point("B", 0.0, ARCH_SPRING + ARCH_HALF - 0.08, 0.0)
box("arch_keystone", Vector((-0.22, ks.y - 0.22, ks.z)), Vector((0.22, ks.y, ks.z + 0.62)), mat("MAT_Trim_Cream"))


# ------------------------------------------------------------- 7. the stair
def at(theta, r, s=1.0, z=0.0):
    return Vector((s * r * math.cos(theta), C.y + r * math.sin(theta), z))


def nosing(theta):
    """The line through the treads' nosings: RISE at the foot, H_LAND at the top."""
    return RISE * (1.0 + (theta - TH_BOT) / DTH)


def soffit(theta):
    return max(0.0, nosing(theta) - SOFFIT)


def flight(s):
    tag = "R" if s > 0 else "L"
    verts, faces, uvs = [], [], []
    dS = DEN["MAT_Trim_Cream"]

    def quad(ps, uv):
        base = len(verts)
        verts.extend(ps)
        f = (base, base + 1, base + 2, base + 3)
        # keep every face's winding outward whichever flight this is
        faces.append(f if s > 0 else tuple(reversed(f)))
        uvs.append(uv if s > 0 else list(reversed(uv)))

    for k in range(N_TREAD):
        ta, tb = TH_BOT + k * DTH, TH_BOT + (k + 1) * DTH
        zt, zb = (k + 1) * RISE, k * RISE
        # tread
        quad([at(ta, R_I, s, zt), at(ta, R_O, s, zt), at(tb, R_O, s, zt), at(tb, R_I, s, zt)],
             [(R_I * dS, ta * R_C * dS), (R_O * dS, ta * R_C * dS), (R_O * dS, tb * R_C * dS), (R_I * dS, tb * R_C * dS)])
        # riser, at the start of the tread
        quad([at(ta, R_I, s, zb), at(ta, R_O, s, zb), at(ta, R_O, s, zt), at(ta, R_I, s, zt)],
             [(R_I * dS, zb * dS), (R_O * dS, zb * dS), (R_O * dS, zt * dS), (R_I * dS, zt * dS)])
        # the two stringer faces, soffit to tread
        for r, sgn in ((R_O, 1), (R_I, -1)):
            p = [at(ta, r, s, soffit(ta)), at(tb, r, s, soffit(tb)), at(tb, r, s, zt), at(ta, r, s, zt)]
            u0, u1 = ta * r * dS, tb * r * dS
            uv = [(u0, soffit(ta) * dS), (u1, soffit(tb) * dS), (u1, zt * dS), (u0, zt * dS)]
            if sgn < 0:
                p, uv = list(reversed(p)), list(reversed(uv))
            quad(p, uv)
        # the soffit
        if soffit(tb) > 0.0:
            quad([at(ta, R_I, s, soffit(ta)), at(tb, R_I, s, soffit(tb)), at(tb, R_O, s, soffit(tb)), at(ta, R_O, s, soffit(ta))],
                 [(R_I * dS, ta * R_C * dS), (R_I * dS, tb * R_C * dS), (R_O * dS, tb * R_C * dS), (R_O * dS, ta * R_C * dS)])
    o = add_mesh("stair_flight_%s" % tag, verts, faces, mat("MAT_Trim_Cream"), uvs)
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(me)
    bm.free()
    return o


flight(1.0)
flight(-1.0)

# The landing: from the flights' heads to the back wall, its front the inner
# arc. Solid to the floor; its curved face is the court's back.
front = [at(TH_TOP + (math.pi - 2 * TH_TOP) * i / 24, R_I) for i in range(25)]
x_out = R_O * math.cos(TH_TOP)
y_out = C.y + R_O * math.sin(TH_TOP)
foot = front + [Vector((-x_out, y_out, 0)), Vector((-x_out, HALF_Y, 0)), Vector((x_out, HALF_Y, 0)), Vector((x_out, y_out, 0))]
bm = bmesh.new()
bv = [bm.verts.new((p.x, p.y, 0.0)) for p in foot]
f = bm.faces.new(bv)
bmesh.ops.recalc_face_normals(bm, faces=[f])
if f.normal.z > 0:
    f.normal_flip()
ex = bmesh.ops.extrude_face_region(bm, geom=[f])
top_verts = [e for e in ex["geom"] if isinstance(e, bmesh.types.BMVert)]
bmesh.ops.translate(bm, verts=top_verts, vec=(0, 0, H_LAND))
me = bpy.data.meshes.new("stair_landing")
bm.to_mesh(me)
bm.free()
lvs = [v.co.copy() for v in me.vertices]
lfs = [list(p.vertices) for p in me.polygons]
bpy.data.meshes.remove(me)
land = recalc(add_mesh("stair_landing", lvs, lfs, mat("MAT_Trim_Cream")))
# its nosing: a moulded lip along the curved front
lip = [at(TH_TOP + (math.pi - 2 * TH_TOP) * i / 24, R_I, 1.0, H_LAND) for i in range(25)]
sweep("stair_landing_lip", lip, [(0.0, 0.0), (0.07, 0.0), (0.07, -0.05), (0.03, -0.1), (0.0, -0.16)], mat("MAT_Trim_Cream"),
      lambda i, t: (Vector((C.x - lip[i].x, C.y - lip[i].y, 0)).normalized(), Vector((0, 0, 1))), caps=True)
# a walnut panel on the court's face of the landing
pan = []
for i in range(19):
    th = math.radians(74) + (math.pi - 2 * math.radians(74)) * i / 18
    pan.append(th)
pvv, pff = [], []
for i, th in enumerate(pan):
    p = at(th, R_I - 0.02)
    pvv.append(Vector((p.x, p.y, 0.55)))
    pvv.append(Vector((p.x, p.y, H_LAND - 0.55)))
for i in range(len(pan) - 1):
    pff.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
add_mesh("stair_apron_panel", pvv, pff, mat("MAT_Wood_Dark"))


# ------------------------------------------------------- 8. the balustrade
def rail_path_flight(s, r, forward=True):
    """Points along a flight's balustrade line, foot to head."""
    th0 = TH_BOT + 0.35 * DTH
    n = max(2, int((TH_TOP - th0) * r / 0.12))
    pts = [at(th0 + (TH_TOP - th0) * i / n, r, s, nosing(th0 + (TH_TOP - th0) * i / n)) for i in range(n + 1)]
    return pts if forward else list(reversed(pts))


def landing_front(r):
    n = 28
    return [at(TH_TOP + (math.pi - 2 * TH_TOP) * i / n, r, 1.0, H_LAND) for i in range(n + 1)]


inner = rail_path_flight(1.0, R_I + BAL_IN) + landing_front(R_I + BAL_IN)[1:] + rail_path_flight(-1.0, R_I + BAL_IN, False)[1:]
outer_R = rail_path_flight(1.0, R_O - BAL_IN)
outer_L = rail_path_flight(-1.0, R_O - BAL_IN)
# the outer rails run on from the flights' heads to the back wall
for run in (outer_R, outer_L):
    head = run[-1]
    run.append(Vector((head.x, HALF_Y - 0.02, H_LAND)))


def lifted(pts, dz):
    return [Vector((p.x, p.y, p.z + dz)) for p in pts]


plinth_prof = [(-PLINTH_W / 2, -PLINTH_DOWN), (PLINTH_W / 2, -PLINTH_DOWN), (PLINTH_W / 2, PLINTH_H - 0.03),
               (PLINTH_W / 2 - 0.03, PLINTH_H), (-PLINTH_W / 2 + 0.03, PLINTH_H), (-PLINTH_W / 2, PLINTH_H - 0.03)]
rail_prof = [(-RAIL_W / 2, 0.0), (RAIL_W / 2, 0.0), (RAIL_W / 2, RAIL_H * 0.55), (RAIL_W * 0.3, RAIL_H),
             (-RAIL_W * 0.3, RAIL_H), (-RAIL_W / 2, RAIL_H * 0.55)]
n_bal = 0
for tag, run in (("in", inner), ("outR", outer_R), ("outL", outer_L)):
    sweep("bal_plinth_%s" % tag, run, plinth_prof, mat("MAT_Trim_Cream"), upright)
    sweep("bal_rail_%s" % tag, lifted(run, PLINTH_H + BAL_H), rail_prof, mat("MAT_Wood_Dark"), upright)
    # balusters at even spacing along the run's plan length
    plan = [0.0]
    for i in range(1, len(run)):
        plan.append(plan[-1] + (run[i] - run[i - 1]).xy.length)
    total = plan[-1]
    count = int(total / BAL_STEP)
    j = 0
    for b in range(1, count):
        d = total * b / count
        while plan[j + 1] < d:
            j += 1
        f_ = (d - plan[j]) / max(1e-9, plan[j + 1] - plan[j])
        p = run[j].lerp(run[j + 1], f_)
        o = bpy.data.objects.new("bal_%d_%s%d" % (1 if p.x >= 0 else -1, "l" if tag == "in" else "r", n_bal), kit_baluster)
        interior.objects.link(o)
        o.matrix_world = Matrix.Translation((p.x, p.y, p.z + PLINTH_H)) @ Matrix.Diagonal((BAL_SCALE, BAL_SCALE, BAL_SCALE, 1))
        n_bal += 1
# the kit baluster's origin: find its foot so every placement stands on the plinth
foot_z = min(v.co.z for v in kit_baluster.vertices) * BAL_SCALE
for o in interior.all_objects:
    if o.data is kit_baluster:
        o.matrix_world = Matrix.Translation((0, 0, -foot_z)) @ o.matrix_world
print("BALUSTERS|%d" % n_bal)

# Newels: the four feet, and the heads of the flights on the landing.
newel_foot = min(v.co.z for v in kit_newel.vertices) * NEWEL_SCALE
k = 0
for s in (1.0, -1.0):
    for r in (R_I + BAL_IN, R_O - BAL_IN):
        for kind, th, z in (("bot", TH_BOT + 0.2 * DTH, 0.0), ("mid", TH_TOP, H_LAND)):
            p = at(th, r, s, z)
            o = bpy.data.objects.new("newel_%s_%d" % (kind, (k + 1) * (1 if s > 0 else -1)), kit_newel)
            interior.objects.link(o)
            o.matrix_world = Matrix.Translation((p.x, p.y, z - newel_foot)) @ Matrix.Diagonal((NEWEL_SCALE,) * 3 + (1,))
            k += 1

# ------------------------------------------------------------ 9. the runner
RUN_HALF = 0.66


def runner(s):
    tag = "R" if s > 0 else "L"
    verts, faces, uvs = [], [], []
    bverts, bfaces, buvs = [], [], []
    rods_v, rods_f = [], []
    d = DEN["MAT_Runner"]
    v_along = 0.0
    r0, r1 = R_C - RUN_HALF, R_C + RUN_HALF

    def quad(dst, dfaces, duvs, ps, uv):
        base = len(dst)
        dst.extend(ps)
        f = (base, base + 1, base + 2, base + 3)
        dfaces.append(f if s > 0 else tuple(reversed(f)))
        duvs.append(uv if s > 0 else list(reversed(uv)))

    for k in range(N_TREAD):
        ta, tb = TH_BOT + k * DTH, TH_BOT + (k + 1) * DTH
        zt, zb = (k + 1) * RISE + 0.012, k * RISE + (0.012 if k else 0.0)
        eps = 0.012 / R_C                         # proud of the riser face
        # riser
        v0, v1 = v_along, v_along + (zt - zb)
        quad(verts, faces, uvs, [at(ta - eps, r0, s, zb), at(ta - eps, r1, s, zb), at(ta - eps, r1, s, zt), at(ta - eps, r0, s, zt)],
             [(0, v0 * d), (2 * RUN_HALF * d, v0 * d), (2 * RUN_HALF * d, v1 * d), (0, v1 * d)])
        v_along = v1
        # tread
        v0, v1 = v_along, v_along + DTH * R_C
        quad(verts, faces, uvs, [at(ta - eps, r0, s, zt), at(ta - eps, r1, s, zt), at(tb, r1, s, zt), at(tb, r0, s, zt)],
             [(0, v0 * d), (2 * RUN_HALF * d, v0 * d), (2 * RUN_HALF * d, v1 * d), (0, v1 * d)])
        v_along = v1
        # the binding, both edges, on the tread
        for ra, rb in ((r0, r0 + 0.045), (r1 - 0.045, r1)):
            quad(bverts, bfaces, buvs, [at(ta - eps, ra, s, zt + 0.002), at(ta - eps, rb, s, zt + 0.002), at(tb, rb, s, zt + 0.002), at(tb, ra, s, zt + 0.002)],
                 [(0, v0 * d), (0.045 * d, v0 * d), (0.045 * d, v1 * d), (0, v1 * d)])
        # a brass rod where this tread meets the next riser
        if k < N_TREAD:
            th = tb - 0.02 / R_C
            a, b = at(th, r0 - 0.06, s, zt + 0.016), at(th, r1 + 0.06, s, zt + 0.016)
            ax = (b - a).normalized()
            n1 = ax.cross(Vector((0, 0, 1))).normalized()
            n2 = ax.cross(n1)
            base = len(rods_v)
            for p in (a, b):
                for q in range(8):
                    ang = 2 * math.pi * q / 8
                    rods_v.append(p + (n1 * math.cos(ang) + n2 * math.sin(ang)) * 0.009)
            for q in range(8):
                q2 = (q + 1) % 8
                rods_f.append((base + q, base + q2, base + 8 + q2, base + 8 + q))
    add_mesh("runner_flight_%s" % tag, verts, faces, mat("MAT_Runner"), uvs)
    add_mesh("runner_binding_%s" % tag, bverts, bfaces, mat("MAT_Runner_Binding"), buvs)
    add_mesh("stair_rod_brass_%s" % tag, rods_v, rods_f, mat("MAT_Table_Brass"))


runner(1.0)
runner(-1.0)
# across the landing, on the walking line
lv, lf, luv = [], [], []
n = 24
d = DEN["MAT_Runner"]
for i in range(n + 1):
    th = TH_TOP + (math.pi - 2 * TH_TOP) * i / n
    for r in (R_C - RUN_HALF, R_C + RUN_HALF):
        lv.append(at(th, r, 1.0, H_LAND + 0.012))
for i in range(n):
    lf.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    v0 = (math.pi - 2 * TH_TOP) * i / n * R_C * d
    v1 = (math.pi - 2 * TH_TOP) * (i + 1) / n * R_C * d
    luv.append([(0, v0), (2 * RUN_HALF * d, v0), (2 * RUN_HALF * d, v1), (0, v1)])
add_mesh("stair_landing_runner", lv, lf, mat("MAT_Runner"), luv)

# ------------------------------------------------------ 10. the urns move out
# The flights now reach where they stood, and the side lanes to the back tables
# need the floor clear, so the pair go to the entry wall and flank the doors.
URN_AT = (3.3, -6.4)
for i, sx in ((0, -1.0), (1, 1.0)):
    lo, hi = bbox(objs["dress_urn_plinth_%d" % i])
    c = (lo + hi) / 2
    for n in ("dress_urn_%d" % i, "dress_urn_plinth_%d" % i):
        o = objs.get(n)
        if o:
            o.matrix_world = Matrix.Translation((sx * URN_AT[0] - c.x, URN_AT[1] - c.y, 0)) @ o.matrix_world

bpy.context.view_layer.update()


# --------------------------------------------------------------- the report
def union(prefix):
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    n = 0
    for o in interior.all_objects:
        if o.matrix_world.translation.z > -20 and o.name.startswith(prefix) and o.type in {"MESH", "LIGHT"}:
            a, b = bbox(o) if o.type == "MESH" else (o.matrix_world.translation, o.matrix_world.translation)
            lo = Vector(map(min, lo, a))
            hi = Vector(map(max, hi, b))
            n += 1
    return n, tuple(round(v, 3) for v in lo), tuple(round(v, 3) for v in hi)


for p in ("int_wall", "int_ceiling", "int_dome", "int_lantern", "dress_oculus", "stair_flight_R", "stair_flight_L",
          "stair_landing", "bal_plinth", "bal_rail", "bal_1_", "bal_-1_", "newel_bot", "newel_mid", "portrait_frame_outer",
          "portrait_canvas", "piclight_", "arch_", "chandelier", "dress_urn_0", "dress_urn_1", "dress_win", "win_frame",
          "capital_", "pilaster_", "coffer_", "LGT_"):
    print("BOX|%s|%s|%s|%s" % ((p,) + union(p)))
print("MADE|%d" % len(made))
bpy.ops.wm.save_as_mainfile(filepath=OUT, copy=False)
print("SAVED|%s" % OUT)
