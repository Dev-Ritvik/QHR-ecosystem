"""
Build the v7 estate: the mansion, larger, with every elevation finished, set in an
Indian luxury estate.

    blender --background --python build_estate_v7.py -- <out.blend> [stages...]

stages: arch land preview   (default: arch land)

WHY A GENERATOR AND NOT ANOTHER PASS ON P3F. The client review asked for the
house to be "bigger, taller, wider, and importantly longer" while keeping its
features, and then listed what was wrong with the one we have: arched windows
whose black bleeds past the arch, upper windows with no glass at all (they were
blind panels), stone "like a skin disease", a back elevation nobody finished, and
a background of Central European hills with a village in it. P3F is one merged
25k-vertex wall mesh, 267 individually toned ashlar blocks and four phases of
hand fixes; stretching it by more bays would carry every one of those defects
into a bigger building. This builds the same house from its parts instead, so a
bay is a bay on every elevation and nothing is finished on one side only.

WHAT IS KEPT (appended from P3F, untouched): the front door leaves, their carved
relief and handles - the doorway passage opens those exact leaves - and the lion
frieze. WHAT IS KEPT AS VOCABULARY: a pedimented centre, a columned portico
carrying the lion frieze, arched ground-floor windows with keystones, a
balustraded parapet with urns, long-and-short quoins, a hipped slate roof, and the
cupola with the pointed spire the brief asks for.

UNITS AND AXES: metres, Blender Z up, the entrance front faces -Y (three.js +z).
"""
import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else "C:/dev/Blender/mansion_estate_V7.blend"
STAGES = set(ARGS[1:]) or {"arch", "land"}
P3F = "C:/dev/Blender/mansion_exterior_P3F.blend"
TEX = "C:/dev/estate/assets/materials/_v7"
SLATE = "C:/dev/estate/assets/materials/roof_slate"
RNG = random.Random(7)

# ---------------------------------------------------------------------------
# THE HOUSE, IN NUMBERS
# ---------------------------------------------------------------------------
HW, HD = 13.1, 7.8          # half width (X), half depth (Y) of the main block
FX, FD = 4.6, 8.4           # frontispiece half width, and the face it projects to
WALL_T = 0.6
PODIUM_Z = 0.45
FLOOR_Z = 0.6               # ground floor / portico floor / door sill
BASE_TOP = 0.9              # top of the base course; rustication starts here
GF_TOP = 4.8                # ground floor; string course 4.8..5.1
UF_BASE = 5.1
UF_TOP = 8.5                # upper floor; entablature 8.5..9.4
CORNICE_TOP = 9.4
PARAPET_TOP = 10.4
RUST_COURSES = 7

WING_X = (6.1, 8.8, 11.5)   # window centres on each wing, front and back
SIDE_Y = (-5.4, -2.7, 0.0, 2.7, 5.4)
CENTRE_X = 2.95             # windows either side of the centre door, clear of the portico responds

ARCH_W, ARCH_SILL, ARCH_SPRING = 1.4, 1.45, 3.55      # ground floor, r = 0.7
RECT_W, RECT_SILL, RECT_HEAD = 1.3, 5.65, 7.75         # upper floor
DOOR_W, DOOR_TOP = 2.6, 4.0
COLUMNS_X = (-4.15, -1.75, 1.75, 4.15)
PORTICO_FRONT = -11.25      # front face of the portico entablature
COLUMN_Y = -10.85

ROOF_EAVE_X, ROOF_EAVE_Y, ROOF_EAVE_Z = 12.5, 7.2, 9.42
ROOF_PITCH = math.radians(19)
PEDIMENT_PITCH = math.radians(17)


# ---------------------------------------------------------------------------
# SCENE AND MATERIALS
# ---------------------------------------------------------------------------
def fresh_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    col = bpy.data.collections.new("COL_Estate_V7")
    bpy.context.scene.collection.children.link(col)
    return col


def image(path, colour=True):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    return img


def principled(name, base=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, spec=0.5,
               tex=None, normal_strength=0.6, tint=None, alpha=None, emission=None,
               vertex_colour=False, double=False, clip=False):
    """One Principled BSDF material in the shape the glTF exporter understands:
    image -> (multiply by a tint) -> base colour; roughness and normal images on
    the same UV map."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Specular IOR Level"].default_value = spec
    if tex:
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = "UVMap"
        b = nt.nodes.new("ShaderNodeTexImage")
        b.image = image(tex["base"], True)
        nt.links.new(uv.outputs["UV"], b.inputs["Vector"])
        if tint:
            mix = nt.nodes.new("ShaderNodeMixRGB")
            mix.blend_type = "MULTIPLY"
            mix.inputs["Fac"].default_value = 1.0
            mix.inputs["Color2"].default_value = (*tint, 1.0)
            nt.links.new(b.outputs["Color"], mix.inputs["Color1"])
            nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(b.outputs["Color"], bsdf.inputs["Base Color"])
        if clip:
            nt.links.new(b.outputs["Alpha"], bsdf.inputs["Alpha"])
        if tex.get("rough"):
            r = nt.nodes.new("ShaderNodeTexImage")
            r.image = image(tex["rough"], False)
            nt.links.new(uv.outputs["UV"], r.inputs["Vector"])
            nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
        if tex.get("normal"):
            n = nt.nodes.new("ShaderNodeTexImage")
            n.image = image(tex["normal"], False)
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = normal_strength
            nt.links.new(uv.outputs["UV"], n.inputs["Vector"])
            nt.links.new(n.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    if vertex_colour:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha is not None:
        bsdf.inputs["Alpha"].default_value = alpha
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission[0], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission[1]
    if alpha is not None or clip:
        m.blend_method = "CLIP" if clip else "BLEND"
        try:
            m.surface_render_method = "DITHERED" if clip else "BLENDED"
        except AttributeError:
            pass
    m.use_backface_culling = not double
    return m


def build_materials():
    t = lambda stem: {"base": f"{TEX}/{stem}_basecolor.png", "rough": f"{TEX}/{stem}_roughness.png",
                      "normal": f"{TEX}/{stem}_normal.png"}
    M = {}
    M["wall"] = principled("MAT_Stone_Wall", tex=t("v7_limestone"), normal_strength=0.8)
    M["trim"] = principled("MAT_Stone_Trim", tex=t("v7_trim"), normal_strength=0.6)
    M["rustic"] = principled("MAT_Stone_Rustic", tex=t("v7_limestone"), tint=(0.9, 0.87, 0.82), normal_strength=0.9)
    M["paving"] = principled("MAT_Stone_Paving", tex=t("v7_paving"), normal_strength=0.8)
    M["steps"] = principled("MAT_Stone_Steps", tex=t("v7_paving"), tint=(0.96, 0.95, 0.93), normal_strength=0.8)
    M["roof"] = principled("MAT_Roof_Slate", tex={"base": f"{SLATE}/p4c_basecolor.png", "rough": f"{SLATE}/p4c_roughness.png",
                                                  "normal": f"{SLATE}/normal.png"}, normal_strength=0.7)
    M["spire"] = principled("MAT_Roof", tex={"base": f"{SLATE}/p4c_basecolor.png", "rough": f"{SLATE}/p4c_roughness.png",
                                             "normal": f"{SLATE}/normal.png"}, tint=(0.82, 0.84, 0.86), normal_strength=0.7)
    M["gold"] = principled("MAT_Gold", base=(1.0, 0.77, 0.36), rough=0.3, metal=1.0)
    # Glass you can see INTO: tinted, reflective, and 45% transparent, so the
    # curtain behind it reads. The old glass was an opaque near-black plane over
    # a black box, which is what "the black bleeds to the edges" described.
    M["glass"] = principled("MAT_Glass_Window", base=(0.05, 0.065, 0.075), rough=0.04, spec=1.0, alpha=0.55)
    # The name the runtime already grades: warm emissive at dusk makes these the
    # lit rooms. By day they are cream curtains in the shade of the reveal.
    M["curtain"] = principled("MAT_Window_Interior", base=(0.62, 0.53, 0.41), rough=0.95)
    M["frame"] = principled("MAT_Window_Frame", base=(0.83, 0.8, 0.74), rough=0.45)
    M["louvre"] = principled("MAT_Louvre", base=(0.035, 0.03, 0.028), rough=0.6)
    M["lawn"] = principled("MAT_Lawn", tex=t("v7_lawn"), normal_strength=0.4)
    M["hedge"] = principled("MAT_Hedge", base=(0.045, 0.1, 0.03), rough=0.9)
    M["water"] = principled("MAT_Water", base=(0.012, 0.03, 0.036), rough=0.02, spec=1.0)
    M["soil"] = principled("MAT_Soil", base=(0.16, 0.1, 0.065), rough=0.95)
    M["trunk"] = principled("MAT_Palm_Trunk", base=(0.34, 0.31, 0.27), rough=0.85)
    M["shaft"] = principled("MAT_Palm_Crownshaft", base=(0.19, 0.27, 0.12), rough=0.6)
    M["frond"] = principled("MAT_Palm_Frond", tex={"base": f"{TEX}/v7_palm_frond.png"}, rough=0.7, double=True, clip=True)
    for key, stem in (("rain", "v7_canopy_rain"), ("mango", "v7_canopy_mango"), ("bougainvillea", "v7_bougainvillea"),
                      ("frangipani", "v7_frangipani")):
        M["leaf_" + key] = principled(f"MAT_Leaves_{key.title()}", tex={"base": f"{TEX}/{stem}.png"}, rough=0.75,
                                      double=True, clip=True)
    M["bark"] = principled("MAT_Bark", base=(0.2, 0.15, 0.11), rough=0.9)
    return M


# ---------------------------------------------------------------------------
# GEOMETRY PRIMITIVES (bmesh)
# ---------------------------------------------------------------------------
def new_bm():
    return bmesh.new()


def face(bm, verts, mi):
    try:
        f = bm.faces.new(verts)
    except ValueError:
        return None
    f.material_index = mi
    return f


def add_box(bm, x0, x1, y0, y1, z0, z1, mi=0):
    if x0 > x1: x0, x1 = x1, x0
    if y0 > y1: y0, y1 = y1, y0
    if z0 > z1: z0, z1 = z1, z0
    c = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    v = [bm.verts.new(p) for p in c]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        face(bm, [v[i] for i in f], mi)


def add_oriented_box(bm, origin, u, n, u0, u1, z0, z1, d0, d1, mi=0):
    """A box in a facade's own frame: u along the facade, d along its outward
    normal n, z up."""
    O, U, N = Vector(origin), Vector(u), Vector(n)
    def P(uu, zz, dd):
        return O + U * uu + N * dd + Vector((0, 0, zz))
    pts = [P(u0, z0, d0), P(u1, z0, d0), P(u1, z0, d1), P(u0, z0, d1),
           P(u0, z1, d0), P(u1, z1, d0), P(u1, z1, d1), P(u0, z1, d1)]
    v = [bm.verts.new(p) for p in pts]
    fs = [face(bm, [v[i] for i in f], mi) for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))]
    fs = [f for f in fs if f]
    # A facade frame (u, n, z) can be left-handed; let the closed box decide.
    bmesh.ops.recalc_face_normals(bm, faces=fs)
    return fs


def add_prism(bm, poly, origin, u, n, d0, d1, mi=0):
    """Extrude a polygon given in facade (u, z) coordinates between depths d0 and
    d1 along the facade normal."""
    O, U, N = Vector(origin), Vector(u), Vector(n)
    lo = [bm.verts.new(O + U * pu + N * d0 + Vector((0, 0, pz))) for pu, pz in poly]
    hi = [bm.verts.new(O + U * pu + N * d1 + Vector((0, 0, pz))) for pu, pz in poly]
    made = [face(bm, lo[::-1], mi), face(bm, hi, mi)]
    k = len(poly)
    for i in range(k):
        j = (i + 1) % k
        made.append(face(bm, [lo[i], lo[j], hi[j], hi[i]], mi))
    made = [f for f in made if f]
    bmesh.ops.recalc_face_normals(bm, faces=made)
    return made


def add_lathe_oriented(bm, prof, segs, centre, axis, up, mi=0):
    """A lathe whose axis is `axis` (profile z runs along it), centred at
    `centre` - for rosettes and cartouches laid on a wall."""
    A = Vector(axis).normalized()
    Upv = Vector(up).normalized()
    Rv = Upv.cross(A).normalized()
    Upv = A.cross(Rv).normalized()
    C = Vector(centre)
    rings = []
    for r, z in prof:
        if r < 1e-6:
            rings.append([bm.verts.new(C + A * z)])
        else:
            rings.append([bm.verts.new(C + A * z + Rv * (r * math.cos(2 * math.pi * k / segs)) + Upv * (r * math.sin(2 * math.pi * k / segs)))
                          for k in range(segs)])
    made = []
    for a, b in zip(rings, rings[1:]):
        for k in range(segs):
            k2 = (k + 1) % segs
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                made.append(face(bm, [a[0], b[k2], b[k]], mi))
            elif len(b) == 1:
                made.append(face(bm, [a[k], a[k2], b[0]], mi))
            else:
                made.append(face(bm, [a[k], a[k2], b[k2], b[k]], mi))
    made = [f for f in made if f]
    bmesh.ops.recalc_face_normals(bm, faces=made)
    return made


def add_lathe(bm, prof, segs, cx, cy, z0=0.0, mi=0, sx=1.0, sy=1.0):
    rings = []
    for r, z in prof:
        if r < 1e-6:
            rings.append([bm.verts.new((cx, cy, z0 + z))])
        else:
            rings.append([bm.verts.new((cx + r * sx * math.cos(2 * math.pi * k / segs),
                                        cy + r * sy * math.sin(2 * math.pi * k / segs), z0 + z)) for k in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for k in range(segs):
            k2 = (k + 1) % segs
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                face(bm, [a[0], b[k2], b[k]], mi)
            elif len(b) == 1:
                face(bm, [a[k], a[k2], b[0]], mi)
            else:
                face(bm, [a[k], a[k2], b[k2], b[k]], mi)


def miters(path, closed=True):
    n = len(path)
    out = []
    for i in range(n):
        p = Vector(path[i])
        has_prev = closed or i > 0
        has_next = closed or i < n - 1
        if has_prev:
            d0 = (p - Vector(path[i - 1])).normalized()
            n0 = Vector((d0.y, -d0.x))
        if has_next:
            d1 = (Vector(path[(i + 1) % n]) - p).normalized()
            n1 = Vector((d1.y, -d1.x))
        if has_prev and has_next:
            m = (n0 + n1).normalized()
            out.append(m / max(0.25, m.dot(n0)))
        else:
            out.append(n0 if has_prev else n1)
    return out


def add_sweep(bm, path, prof, mi=0, closed=True, prof_closed=False, z_off=0.0):
    """Sweep an (outward offset, z) profile along a CCW plan path with mitred
    corners. Profiles run bottom-up round the outside, so faces point out."""
    ms = miters(path, closed)
    rings = [[bm.verts.new((path[i][0] + ms[i].x * d, path[i][1] + ms[i].y * d, z + z_off)) for d, z in prof]
             for i in range(len(path))]
    n = len(path)
    k = len(prof)
    for i in range(n if closed else n - 1):
        A, B = rings[i], rings[(i + 1) % n]
        for j in range(k if prof_closed else k - 1):
            j2 = (j + 1) % k
            face(bm, [A[j], B[j], B[j2], A[j2]], mi)


def arch_poly(w, sill, spring, segs=16, top_extra=0.0):
    r = w / 2
    pts = [(-r, sill), (r, sill), (r, spring)]
    for s in range(1, segs):
        a = math.pi * s / segs
        pts.append((r * math.cos(a), spring + r * math.sin(a) + top_extra))
    pts.append((-r, spring))
    return pts


def rect_poly(w, z0, z1):
    return [(-w / 2, z0), (w / 2, z0), (w / 2, z1), (-w / 2, z1)]


def finish(name, bm, mats, col, uv_tiles=None, smooth_angle=35.0):
    """Mesh object from a bmesh, with world-box UVs sized per material (tile
    metres) and sharp edges from angle so flat stone stays flat and turned work
    shades round."""
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    box_uv(ob, uv_tiles or {})
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    except Exception:
        pass
    return ob


TILE = {"MAT_Stone_Wall": 3.0, "MAT_Stone_Trim": 2.0, "MAT_Stone_Rustic": 3.0, "MAT_Stone_Paving": 2.0,
        "MAT_Stone_Steps": 2.0, "MAT_Roof_Slate": 3.0, "MAT_Roof": 2.0, "MAT_Lawn": 6.0}


def box_uv(ob, _unused):
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers["UVMap"].data
    for p in me.polygons:
        mat = me.materials[p.material_index] if me.materials else None
        tile = TILE.get(mat.name if mat else "", 1.0)
        nx, ny, nz = (abs(c) for c in p.normal)
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if nz >= nx and nz >= ny:
                u, v = co.x, co.y
            elif nx >= ny:
                u, v = co.y, co.z
            else:
                u, v = co.x, co.z
            uv[li].uv = (u / tile, v / tile)


def bool_apply(target, cutters, col_name, operation="DIFFERENCE"):
    ccol = bpy.data.collections.new(col_name)
    bpy.context.scene.collection.children.link(ccol)
    for c in cutters:
        for oc in list(c.users_collection):
            oc.objects.unlink(c)
        ccol.objects.link(c)
    mod = target.modifiers.new("cut", "BOOLEAN")
    mod.operation = operation
    mod.operand_type = "COLLECTION"
    mod.collection = ccol
    mod.solver = "EXACT"
    dg = bpy.context.evaluated_depsgraph_get()
    ev = target.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = target.data
    target.modifiers.clear()
    target.data = me
    bpy.data.meshes.remove(old)
    for c in list(ccol.objects):
        bpy.data.objects.remove(c)
    bpy.data.collections.remove(ccol)


def cutter_object(name, bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------------------
# FACADES
# ---------------------------------------------------------------------------
def perimeter():
    """The main block with its front and rear frontispieces, CCW from above."""
    return [(-HW, -HD), (-FX, -HD), (-FX, -FD), (FX, -FD), (FX, -HD), (HW, -HD),
            (HW, HD), (FX, HD), (FX, FD), (-FX, FD), (-FX, HD), (-HW, HD)]


class Facade:
    """A straight run of wall: origin on the face, u along it (left to right
    seen from outside), n its outward normal."""
    def __init__(self, key, origin, u, n):
        self.key, self.origin, self.u, self.n = key, Vector(origin), Vector(u), Vector(n)


def facade_openings():
    """Every opening in the house: (facade, u, kind). u is measured from the
    facade origin, which is the centre line of that elevation."""
    front = Facade("front", (0, -HD, 0), (1, 0, 0), (0, -1, 0))
    front_c = Facade("front_c", (0, -FD, 0), (1, 0, 0), (0, -1, 0))
    back = Facade("back", (0, HD, 0), (-1, 0, 0), (0, 1, 0))
    back_c = Facade("back_c", (0, FD, 0), (-1, 0, 0), (0, 1, 0))
    left = Facade("left", (-HW, 0, 0), (0, -1, 0), (-1, 0, 0))
    right = Facade("right", (HW, 0, 0), (0, 1, 0), (1, 0, 0))
    ops = []
    for f in (front, back):
        for x in WING_X:
            for s in (-1, 1):
                ops.append((f, s * x, "arch"))
                ops.append((f, s * x, "rect"))
    for f in (front_c, back_c):
        for s in (-1, 1):
            ops.append((f, s * CENTRE_X, "arch"))
            ops.append((f, s * CENTRE_X, "rect"))
    ops.append((front_c, 0.0, "door"))
    ops.append((front_c, 0.0, "french"))
    ops.append((back_c, 0.0, "garden"))
    ops.append((back_c, 0.0, "rect_centre"))
    for f in (left, right):
        for y in SIDE_Y:
            ops.append((f, y, "arch"))
            ops.append((f, y, "rect"))
    return ops


GARDEN_W, GARDEN_SPRING = 2.2, 3.4
FRENCH_W, FRENCH_SILL, FRENCH_HEAD = 1.5, 5.62, 7.95


def opening_poly(kind):
    if kind == "arch":
        return arch_poly(ARCH_W, ARCH_SILL, ARCH_SPRING)
    if kind in ("rect", "rect_centre"):
        return rect_poly(RECT_W, RECT_SILL, RECT_HEAD)
    if kind == "door":
        return rect_poly(DOOR_W, FLOOR_Z, DOOR_TOP)
    if kind == "french":
        return rect_poly(FRENCH_W, FRENCH_SILL, FRENCH_HEAD)
    if kind == "garden":
        return arch_poly(GARDEN_W, FLOOR_Z, GARDEN_SPRING)
    raise ValueError(kind)


def build_walls(M, col):
    bm = new_bm()
    P = perimeter()
    add_sweep(bm, P, [(-WALL_T, 0.0), (0.0, 0.0), (0.0, CORNICE_TOP), (-WALL_T, CORNICE_TOP)],
              mi=0, closed=True, prof_closed=True)
    walls = finish("mansion_walls", bm, [M["wall"]], col)

    cutters = []
    # Banded rustication on the ground floor: a V channel every course.
    step = (GF_TOP - BASE_TOP) / RUST_COURSES
    for k in range(1, RUST_COURSES):
        z = BASE_TOP + k * step
        b = new_bm()
        add_sweep(b, P, [(0.3, z - 0.032), (0.3, z + 0.032), (-0.028, z)], closed=True, prof_closed=True)
        cutters.append(cutter_object(f"rust_{k}", b))
    # The channel under the string course and over the base course.
    for z in (BASE_TOP + 0.004, GF_TOP - 0.004):
        b = new_bm()
        add_sweep(b, P, [(0.3, z - 0.03), (0.3, z + 0.03), (-0.026, z)], closed=True, prof_closed=True)
        cutters.append(cutter_object("rust_edge", b))
    for i, (f, u, kind) in enumerate(facade_openings()):
        b = new_bm()
        add_prism(b, opening_poly(kind), f.origin + f.u * u, f.u, f.n, 0.5, -WALL_T - 0.4)
        cutters.append(cutter_object(f"open_{i}", b))
    bool_apply(walls, cutters, "CUT_walls")
    box_uv(walls, None)
    for p in walls.data.polygons:
        p.use_smooth = False
    return walls


def build_bands(M, col):
    """Base course, string course, entablature and cornice, as mitred sweeps."""
    bm = new_bm()
    P = perimeter()
    add_sweep(bm, P, [(0.0, PODIUM_Z), (0.12, PODIUM_Z), (0.12, BASE_TOP - 0.1), (0.09, BASE_TOP - 0.04),
                      (0.02, BASE_TOP), (0.0, BASE_TOP)], mi=0)
    add_sweep(bm, P, [(0.0, GF_TOP), (0.1, GF_TOP), (0.13, GF_TOP + 0.05), (0.13, UF_BASE - 0.06),
                      (0.09, UF_BASE), (0.0, UF_BASE)], mi=1)
    ent = [(0.0, UF_TOP), (0.05, UF_TOP), (0.05, UF_TOP + 0.08), (0.08, UF_TOP + 0.1), (0.08, UF_TOP + 0.18),
           (0.02, UF_TOP + 0.2), (0.02, 8.98), (0.12, 8.98), (0.12, 9.02), (0.2, 9.07), (0.24, 9.12),
           (0.58, 9.12), (0.58, 9.27), (0.63, 9.31), (0.63, 9.35), (0.55, CORNICE_TOP), (0.0, CORNICE_TOP)]
    add_sweep(bm, P, ent, mi=1)
    ob = finish("mansion_bands", bm, [M["rustic"], M["trim"]], col)
    # Dentils under the corona, every 0.24 m along every run.
    dm = new_bm()
    ms = miters(P)
    for i in range(len(P)):
        a, b = Vector(P[i]), Vector(P[(i + 1) % len(P)])
        run = (b - a)
        L = run.length
        d = run.normalized()
        nrm = Vector((d.y, -d.x))
        count = int((L - 0.5) / 0.24)
        for k in range(count):
            t = 0.25 + (k + 0.5) * (L - 0.5) / count
            c = a + d * t
            o = Vector((c.x, c.y, 0))
            add_oriented_box(dm, o, Vector((d.x, d.y, 0)), Vector((nrm.x, nrm.y, 0)), -0.055, 0.055, 9.02, 9.12, 0.02, 0.2)
    finish("mansion_dentils", dm, [M["trim"]], col)
    return ob


def build_quoins(M, col):
    """Long-and-short quoins on every external corner, one course per block,
    all one tone."""
    bm = new_bm()
    corners = [((-HW, -HD), (-1, 0), (0, -1)), ((HW, -HD), (1, 0), (0, -1)), ((HW, HD), (1, 0), (0, 1)),
               ((-HW, HD), (-1, 0), (0, 1)), ((-FX, -FD), (-1, 0), (0, -1)), ((FX, -FD), (1, 0), (0, -1)),
               ((FX, FD), (1, 0), (0, 1)), ((-FX, FD), (-1, 0), (0, 1))]
    courses = 14
    h = (UF_TOP - BASE_TOP) / courses
    p, q, gap = 0.055, 0.2, 0.011
    for (cx, cy), nA2, nB2 in corners:
        C = Vector((cx, cy))
        nA, nB = Vector(nA2), Vector(nB2)
        for k in range(courses):
            LA, LB = (0.95, 0.5) if k % 2 == 0 else (0.5, 0.95)
            # frontispiece corners are short on their 0.6 m return
            if abs(cx) == FX:
                LA = min(LA, 0.5)
            poly = [C + nA * p + nB * p, C + nA * p - nB * LA, C - nA * q - nB * LA,
                    C - nA * q - nB * q, C - nB * q - nA * LB, C + nB * p - nA * LB]
            area = sum(poly[i].x * poly[(i + 1) % 6].y - poly[(i + 1) % 6].x * poly[i].y for i in range(6))
            if area < 0:
                poly.reverse()
            z0, z1 = BASE_TOP + k * h + gap, BASE_TOP + (k + 1) * h - gap
            lo = [bm.verts.new((v.x, v.y, z0)) for v in poly]
            hi = [bm.verts.new((v.x, v.y, z1)) for v in poly]
            face(bm, lo[::-1], 0)
            face(bm, hi, 0)
            for i in range(6):
                j = (i + 1) % 6
                face(bm, [lo[i], lo[j], hi[j], hi[i]], 0)
    ob = finish("mansion_quoins", bm, [M["trim"]], col)
    for p_ in ob.data.polygons:
        p_.use_smooth = False
    return ob


def window_dressing(M, col):
    """Surrounds, sills, hoods and keystones in stone; frames and glazing bars in
    painted timber; glass; curtains."""
    trim, frame, glass, curtain = new_bm(), new_bm(), new_bm(), new_bm()
    for f, u, kind in facade_openings():
        O = f.origin + f.u * u
        U, N = f.u, f.n
        if kind in ("arch", "garden"):
            w = ARCH_W if kind == "arch" else GARDEN_W
            sill = ARCH_SILL if kind == "arch" else FLOOR_Z
            spring = ARCH_SPRING if kind == "arch" else GARDEN_SPRING
            r = w / 2
            band = 0.17
            for s in (-1, 1):
                add_oriented_box(trim, O, U, N, s * r, s * (r + band), sill, spring, -0.02, 0.07)
            segs = 18
            for k in range(segs):
                a0, a1 = math.pi * k / segs, math.pi * (k + 1) / segs
                ring = [(r * math.cos(a0), spring + r * math.sin(a0)), ((r + band) * math.cos(a0), spring + (r + band) * math.sin(a0)),
                        ((r + band) * math.cos(a1), spring + (r + band) * math.sin(a1)), (r * math.cos(a1), spring + r * math.sin(a1))]
                add_prism(trim, ring, O, U, N, -0.02, 0.07)
            ktop = spring + r + 0.42
            add_prism(trim, [(-0.11, spring + r - 0.06), (0.11, spring + r - 0.06), (0.16, ktop), (-0.16, ktop)], O, U, N, -0.02, 0.13)
            if kind == "arch":
                add_oriented_box(trim, O, U, N, -r - 0.24, r + 0.24, sill - 0.13, sill, -0.12, 0.17)
                for s in (-1, 1):
                    add_oriented_box(trim, O, U, N, s * (r + 0.02), s * (r + 0.16), sill - 0.36, sill - 0.13, -0.02, 0.11)
            poly = arch_poly(w, sill, spring, 18)
            add_prism(glass, poly, O, U, N, -0.28, -0.285, 0)
            _glazing_bars(frame, O, U, N, w, sill, spring, arched=True, door=(kind == "garden"))
            _curtain(curtain, O, U, N, w, sill, spring + r, door=(kind == "garden"))
        elif kind in ("rect", "rect_centre", "french"):
            w = RECT_W if kind != "french" else FRENCH_W
            sill = RECT_SILL if kind != "french" else FRENCH_SILL
            head = RECT_HEAD if kind != "french" else FRENCH_HEAD
            hw, band = w / 2, 0.15
            for s in (-1, 1):
                add_oriented_box(trim, O, U, N, s * hw, s * (hw + band), sill, head, -0.02, 0.06)
            add_oriented_box(trim, O, U, N, -hw - band - 0.04, hw + band + 0.04, head, head + band, -0.02, 0.06)
            add_oriented_box(trim, O, U, N, -hw - band, hw + band, head + band, head + 0.3, -0.02, 0.035)
            if kind == "french" or kind == "rect_centre":
                rise = (hw + 0.36) * math.tan(math.radians(20))
                base_z = head + 0.3
                add_prism(trim, [(-hw - 0.36, base_z), (hw + 0.36, base_z), (0, base_z + rise)], O, U, N, -0.02, 0.2)
                add_prism(trim, [(-hw - 0.26, base_z + 0.05), (hw + 0.26, base_z + 0.05), (0, base_z + rise - 0.04)], O, U, N, 0.2, 0.25)
            else:
                add_oriented_box(trim, O, U, N, -hw - 0.3, hw + 0.3, head + 0.3, head + 0.44, -0.02, 0.24)
                add_oriented_box(trim, O, U, N, -hw - 0.24, hw + 0.24, head + 0.26, head + 0.3, -0.02, 0.15)
            for s in (-1, 1):
                add_oriented_box(trim, O, U, N, s * (hw + 0.14), s * (hw + 0.27), head - 0.05, head + 0.3, -0.02, 0.2)
            if kind != "french":
                add_oriented_box(trim, O, U, N, -hw - 0.2, hw + 0.2, sill - 0.11, sill, -0.12, 0.14)
                add_oriented_box(trim, O, U, N, -hw + 0.05, hw - 0.05, sill - 0.62, sill - 0.16, -0.02, 0.03)
            add_prism(glass, rect_poly(w, sill, head), O, U, N, -0.28, -0.285, 0)
            _glazing_bars(frame, O, U, N, w, sill, head, arched=False, door=(kind == "french"))
            _curtain(curtain, O, U, N, w, sill, head, door=(kind == "french"))
        elif kind == "door":
            hw, band = DOOR_W / 2, 0.24
            for s in (-1, 1):
                add_oriented_box(trim, O, U, N, s * hw, s * (hw + band), FLOOR_Z, DOOR_TOP, -0.02, 0.09)
            add_oriented_box(trim, O, U, N, -hw - band - 0.05, hw + band + 0.05, DOOR_TOP, DOOR_TOP + band, -0.02, 0.09)
    finish("mansion_window_trim", trim, [M["trim"]], col)
    finish("mansion_frames", frame, [M["frame"]], col)
    finish("mansion_glass", glass, [M["glass"]], col)
    finish("mansion_window_back", curtain, [M["curtain"]], col, smooth_angle=80)


def _glazing_bars(bm, O, U, N, w, z0, z1, arched, door):
    """Frame and glazing bars, set just inside the glass."""
    hw, t, bar = w / 2, 0.07, 0.035
    d0, d1 = -0.3, -0.24
    top = z1
    add_oriented_box(bm, O, U, N, -hw, -hw + t, z0, top, d0, d1)
    add_oriented_box(bm, O, U, N, hw - t, hw, z0, top, d0, d1)
    add_oriented_box(bm, O, U, N, -hw, hw, z0, z0 + t, d0, d1)
    if not arched:
        add_oriented_box(bm, O, U, N, -hw, hw, top - t, top, d0, d1)
    add_oriented_box(bm, O, U, N, -bar / 2, bar / 2, z0, top + (hw if arched else 0) - 0.02, d0 + 0.01, d1 - 0.01)
    rows = 3 if not door else 4
    for k in range(1, rows + (1 if arched else 0)):
        zz = z0 + (z1 - z0) * k / rows
        if zz >= z1 - 0.01 and not arched:
            continue
        add_oriented_box(bm, O, U, N, -hw, hw, zz - bar / 2, zz + bar / 2, d0 + 0.01, d1 - 0.01)
    if arched:
        segs = 16
        for k in range(segs):
            a0, a1 = math.pi * k / segs, math.pi * (k + 1) / segs
            ring = [((hw - t) * math.cos(a0), z1 + (hw - t) * math.sin(a0)), (hw * math.cos(a0), z1 + hw * math.sin(a0)),
                    (hw * math.cos(a1), z1 + hw * math.sin(a1)), ((hw - t) * math.cos(a1), z1 + (hw - t) * math.sin(a1))]
            add_prism(bm, ring, O, U, N, d0, d1)
        for a in (math.pi / 4, 3 * math.pi / 4):
            c, s = math.cos(a), math.sin(a)
            px, pz = -s * bar / 2, c * bar / 2
            ex, ez = (hw - t) * c, z1 + (hw - t) * s
            pts = [(px, z1 + pz), (ex + px, ez + pz), (ex - px, ez - pz), (-px, z1 - pz)]
            add_prism(bm, pts, O, U, N, d0 + 0.01, d1 - 0.01)


def _curtain(bm, O, U, N, w, z0, z1, door):
    """A drawn curtain in soft folds, filling the opening behind the glass."""
    folds = 14 if w < 2 else 20
    n = folds * 2
    hw = w / 2 + 0.05
    rows = [z0 - 0.02, z1 + 0.02]
    grid = []
    for z in rows:
        line = []
        for i in range(n + 1):
            uu = -hw + 2 * hw * i / n
            dd = -0.46 + (0.035 if i % 2 else -0.035)
            line.append(bm.verts.new(O + U * uu + N * dd + Vector((0, 0, z))))
        grid.append(line)
    for i in range(n):
        face(bm, [grid[0][i], grid[0][i + 1], grid[1][i + 1], grid[1][i]], 0)


# ---------------------------------------------------------------------------
# PARAPET, PORTICO, PEDIMENTS, ROOF, CUPOLA
# ---------------------------------------------------------------------------
BALUSTER = [(0.0, 0.0), (0.075, 0.0), (0.075, 0.06), (0.055, 0.08), (0.05, 0.12), (0.085, 0.25), (0.09, 0.32),
            (0.07, 0.4), (0.04, 0.48), (0.035, 0.54), (0.05, 0.57), (0.05, 0.6), (0.075, 0.62), (0.075, 0.68), (0.0, 0.68)]


def balustrade_run(bm, a, b, z, height, dies=True, die_w=0.56, spacing=0.3, mi_trim=0, segs=10):
    """Plinth, balusters and coping between two plan points, with dies at both
    ends. The run's balusters scale to `height`."""
    A, B = Vector(a), Vector(b)
    d = (B - A)
    L = d.length
    if L < 0.05:
        return
    d.normalize()
    nrm = Vector((d.y, -d.x))
    o = Vector((A.x, A.y, 0))
    U = Vector((d.x, d.y, 0))
    Nn = Vector((nrm.x, nrm.y, 0))
    s_bal = height / 0.86
    inset = die_w / 2 if dies else 0.0
    if L - 2 * inset > 0.02:
        add_oriented_box(bm, o, U, Nn, inset, L - inset, z, z + 0.14 * s_bal, -0.22, 0.2, mi_trim)
        add_oriented_box(bm, o, U, Nn, inset, L - inset, z + 0.82 * s_bal - 0.02, z + height, -0.25, 0.23, mi_trim)
    span = L - 2 * inset
    count = int(span / spacing)
    for k in range(count):
        t = inset + (k + 0.5) * span / count
        c = A + d * t
        prof = [(r * s_bal, zz * s_bal) for r, zz in BALUSTER]
        add_lathe(bm, prof, segs, c.x, c.y, z + 0.14 * s_bal, mi_trim)
    if dies:
        for t in (0.0, L):
            c = A + d * t
            add_box(bm, c.x - die_w / 2, c.x + die_w / 2, c.y - die_w / 2, c.y + die_w / 2, z, z + height + 0.12, mi_trim)
            add_box(bm, c.x - die_w / 2 - 0.05, c.x + die_w / 2 + 0.05, c.y - die_w / 2 - 0.05, c.y + die_w / 2 + 0.05,
                    z + height + 0.12, z + height + 0.22, mi_trim)


URN = [(0.0, 0.0), (0.22, 0.0), (0.22, 0.06), (0.14, 0.1), (0.1, 0.18), (0.13, 0.24), (0.24, 0.34), (0.3, 0.48),
       (0.29, 0.6), (0.22, 0.7), (0.16, 0.74), (0.2, 0.78), (0.2, 0.82), (0.1, 0.86), (0.0, 0.9)]
FINIAL = [(0.0, 0.0), (0.08, 0.0), (0.08, 0.05), (0.05, 0.08), (0.12, 0.2), (0.12, 0.28), (0.05, 0.38), (0.035, 0.5),
          (0.0, 0.62)]


def build_parapet(M, col, gold_bm):
    bm = new_bm()
    z = CORNICE_TOP
    # Runs between dies over every pier. The frontispiece fronts carry the
    # pediments instead.
    xs_front = [-HW, -10.15, -7.45, -FX]
    runs = []
    for s in (-1, 1):
        pts = [s * x for x in xs_front]
        for y in (-HD, HD):
            for i in range(3):
                runs.append(((pts[i], y), (pts[i + 1], y)))
    ys = [-HD, -4.05, -1.35, 1.35, 4.05, HD]
    for x in (-HW, HW):
        for i in range(5):
            runs.append(((x, ys[i]), (x, ys[i + 1])))
    for s in (-1, 1):
        runs.append(((s * FX, -HD), (s * FX, -FD)))
        runs.append(((s * FX, HD), (s * FX, FD)))
    for a, b in runs:
        balustrade_run(bm, a, b, z, 1.0)
    # Urns on the four main corners and over the frontispiece returns.
    for x, y in ((-HW, -HD), (HW, -HD), (HW, HD), (-HW, HD)):
        add_lathe(bm, [(r * 1.25, zz * 1.25) for r, zz in URN], 20, x, y, z + 1.22)
        add_lathe(gold_bm, [(r * 1.2, zz * 1.2) for r, zz in FINIAL], 14, x, y, z + 1.22 + 1.1)
    finish("mansion_parapet", bm, [M["trim"]], col)


def build_portico(M, col, gold_bm):
    bm = new_bm()      # trim
    st = new_bm()      # steps / paving
    # Platform
    add_box(bm, -FX - 0.6, FX + 0.6, -FD, PORTICO_FRONT - 0.15, 0.0, FLOOR_Z)
    add_box(st, -FX - 0.55, FX + 0.55, -FD + 0.02, PORTICO_FRONT - 0.1, FLOOR_Z - 0.02, FLOOR_Z + 0.005)
    # Steps down to the forecourt
    for k in range(3):
        top = FLOOR_Z - 0.15 * (k + 1)
        add_box(st, -FX, FX, PORTICO_FRONT - 0.15, PORTICO_FRONT - 0.15 - 0.42 * (k + 1), 0.0, top)
    # Cheek walls with urns
    for s in (-1, 1):
        x0, x1 = s * (FX + 0.02), s * (FX + 0.62)
        add_box(bm, x0, x1, PORTICO_FRONT - 0.15, PORTICO_FRONT - 1.95, 0.0, 0.78)
        add_box(bm, x0 - s * 0.05, x1 + s * 0.05, PORTICO_FRONT - 0.1, PORTICO_FRONT - 2.0, 0.78, 0.88)
        add_lathe(bm, [(r * 1.3, zz * 1.3) for r, zz in URN], 20, s * (FX + 0.32), PORTICO_FRONT - 1.05, 0.88)
    # Columns
    shaft = [(0.0, 0.0), (0.42, 0.0), (0.42, 0.12), (0.44, 0.13), (0.44, 0.19), (0.39, 0.24), (0.36, 0.27),
             (0.345, 0.34), (0.352, 1.2), (0.345, 2.2), (0.32, 3.1), (0.305, 3.35), (0.0, 3.35)]
    for x in COLUMNS_X:
        add_box(bm, x - 0.45, x + 0.45, COLUMN_Y - 0.45, COLUMN_Y + 0.45, FLOOR_Z, FLOOR_Z + 0.12)
        add_lathe(bm, shaft, 32, x, COLUMN_Y, FLOOR_Z + 0.12)
        cap = FLOOR_Z + 0.12 + 3.35
        add_lathe(gold_bm, [(0.0, 0.0), (0.325, 0.0), (0.345, 0.02), (0.345, 0.05), (0.325, 0.07), (0.0, 0.07)], 32, x, COLUMN_Y, cap - 0.04)
        add_lathe(bm, [(0.0, 0.0), (0.31, 0.0), (0.31, 0.1), (0.36, 0.13), (0.43, 0.19), (0.46, 0.24), (0.46, 0.26), (0.0, 0.26)], 32, x, COLUMN_Y, cap + 0.03)
        add_box(bm, x - 0.5, x + 0.5, COLUMN_Y - 0.5, COLUMN_Y + 0.5, cap + 0.29, 4.4)
    # Responds on the frontispiece
    for x in (-4.15, 4.15):
        add_box(bm, x - 0.32, x + 0.32, -FD - 0.09, -FD + 0.01, FLOOR_Z, 4.4)
    # Entablature block and its cornice
    add_box(bm, -FX - 0.05, FX + 0.05, -FD + 0.1, PORTICO_FRONT, 4.4, 5.22)
    path = [(-FX - 0.05, PORTICO_FRONT), (FX + 0.05, PORTICO_FRONT), (FX + 0.05, -FD + 0.3), (-FX - 0.05, -FD + 0.3)]
    add_sweep(bm, path, [(0.0, 4.72), (0.03, 4.72), (0.03, 4.74), (0.0, 4.76)])
    add_sweep(bm, path, [(0.0, 5.22), (0.1, 5.22), (0.16, 5.28), (0.5, 5.3), (0.5, 5.47), (0.55, 5.51), (0.55, 5.55),
                         (0.45, 5.6), (-0.3, 5.6)])
    # Plain frieze panels either side of the lions, each with a gilt rosette.
    for sx in (-1, 1):
        cx = sx * (2.8 + (FX - 2.8) / 2)
        add_lathe_oriented(gold_bm, [(0.0, 0.0), (0.17, 0.0), (0.21, 0.03), (0.13, 0.07), (0.0, 0.09)], 20,
                           (cx, PORTICO_FRONT - 0.005, 4.98), (0, -1, 0), (0, 0, 1))
    # The balcony floor over the portico.
    add_box(st, -FX + 0.2, FX - 0.2, -FD - 0.02, PORTICO_FRONT + 0.3, 5.2, 5.6)
    # Balcony over the portico
    for a, b in (((-FX - 0.05, PORTICO_FRONT + 0.25), (FX + 0.05, PORTICO_FRONT + 0.25)),
                 ((FX - 0.2, PORTICO_FRONT + 0.25), (FX - 0.2, -FD - 0.05)),
                 ((-FX + 0.2, -FD - 0.05), (-FX + 0.2, PORTICO_FRONT + 0.25))):
        balustrade_run(bm, a, b, 5.6, 0.95)
    finish("portico_trim", bm, [M["trim"]], col)
    finish("portico_steps", st, [M["steps"]], col)


def build_pediments(M, col, gold_bm):
    bm = new_bm()
    overhang = 0.58
    half = FX + overhang
    rise = half * math.tan(PEDIMENT_PITCH)
    for side in (-1, 1):                      # -1 front, +1 back
        face_y = side * FD
        o = Vector((0, face_y, 0))
        U = Vector((1, 0, 0)) if side < 0 else Vector((-1, 0, 0))
        N = Vector((0, side, 0))
        base = CORNICE_TOP
        # Tympanum, set back from the face.
        add_prism(bm, [(-FX, base), (FX, base), (0, base + FX * math.tan(PEDIMENT_PITCH))], o, U, N, -3.0, -0.22)
        # Raking cornices: a sloped slab and a bed moulding under it.
        for s in (-1, 1):
            for (d0, d1, t0, t1) in ((-3.2, overhang, 0.0, 0.3), (-3.2, 0.22, -0.06, 0.0)):
                x0, z0 = s * half, base + t0
                x1, z1 = 0.0, base + rise + t0 + 0.02
                pts = [(x0, z0), (x1, z1), (x1, z1 + (t1 - t0) + 0.02), (x0, z0 + (t1 - t0))]
                if s > 0:
                    pts = pts[::-1]
                add_prism(bm, pts, o, U, N, d0, d1)
        # Gilt cartouche in the tympanum.
        add_lathe_oriented(gold_bm, [(0.0, 0.0), (0.5, 0.0), (0.56, 0.04), (0.5, 0.09), (0.36, 0.09), (0.32, 0.05), (0.0, 0.04)], 32,
                           (0, face_y - side * 0.22, base + 0.72), (0, side, 0), (0, 0, 1))
        # Acroteria
        add_lathe(gold_bm, [(r * 1.6, zz * 1.6) for r, zz in FINIAL], 16, 0, face_y + side * 0.2, base + rise + 0.32)
        for s in (-1, 1):
            add_box(bm, s * half - 0.35, s * half + 0.35, face_y - 0.35, face_y + 0.35, base, base + 0.36)
            add_lathe(bm, URN, 20, s * half, face_y, base + 0.36)
    finish("mansion_pediments", bm, [M["trim"]], col)


def build_roof(M, col):
    bm = new_bm()
    rise = ROOF_EAVE_Y * math.tan(ROOF_PITCH)
    rz = ROOF_EAVE_Z + rise
    rx = ROOF_EAVE_X - ROOF_EAVE_Y
    e = ROOF_EAVE_Z
    v = {k: bm.verts.new(p) for k, p in {
        "fl": (-ROOF_EAVE_X, -ROOF_EAVE_Y, e), "fr": (ROOF_EAVE_X, -ROOF_EAVE_Y, e),
        "br": (ROOF_EAVE_X, ROOF_EAVE_Y, e), "bl": (-ROOF_EAVE_X, ROOF_EAVE_Y, e),
        "rl": (-rx, 0, rz), "rr": (rx, 0, rz)}.items()}
    face(bm, [v["fl"], v["fr"], v["rr"], v["rl"]], 0)
    face(bm, [v["br"], v["bl"], v["rl"], v["rr"]], 0)
    face(bm, [v["fr"], v["br"], v["rr"]], 0)
    face(bm, [v["bl"], v["fl"], v["rl"]], 0)
    # Cross gables behind each pediment, dying into the hip.
    half = FX + 0.3
    prise = half * math.tan(PEDIMENT_PITCH)
    pz = CORNICE_TOP + prise + 0.3
    for side in (-1, 1):
        y_front = side * (FD - 0.15)
        # where the hip reaches the gable ridge height
        y_back = side * max(0.4, ROOF_EAVE_Y - (pz - e) / math.tan(ROOF_PITCH))
        a = bm.verts.new((-half, y_front, CORNICE_TOP + 0.3))
        b = bm.verts.new((0, y_front, pz))
        c = bm.verts.new((0, y_back, pz))
        d = bm.verts.new((-half, y_back + side * 0.0, CORNICE_TOP + 0.3))
        a2 = bm.verts.new((half, y_front, CORNICE_TOP + 0.3))
        d2 = bm.verts.new((half, y_back, CORNICE_TOP + 0.3))
        if side < 0:
            face(bm, [a, b, c, d], 0)
            face(bm, [b, a2, d2, c], 0)
        else:
            face(bm, [d, c, b, a], 0)
            face(bm, [c, d2, a2, b], 0)
    me_ob = finish("mansion_roof", bm, [M["roof"]], col)
    # Slate courses run along each slope: re-map UVs so u follows the eave and v
    # climbs the slope, 3 m per tile.
    me = me_ob.data
    uv = me.uv_layers["UVMap"].data
    for p in me.polygons:
        n = p.normal
        horiz = Vector((n.x, n.y, 0))
        if horiz.length < 1e-4:
            continue
        horiz.normalize()
        along = Vector((-horiz.y, horiz.x, 0))
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            up = -(co.x * horiz.x + co.y * horiz.y) / math.cos(ROOF_PITCH)
            uv[li].uv = ((co.x * along.x + co.y * along.y) / 3.0, up / 3.0)
    return rz


def build_cupola(M, col, gold_bm, ridge_z):
    wall, trim, spire, louvre = new_bm(), new_bm(), new_bm(), new_bm()
    h = 2.5
    z0, z1 = ridge_z - 1.0, ridge_z + 1.75
    add_box(wall, -h, h, -h, h, z0, z1)
    sq = [(-h, -h), (h, -h), (h, h), (-h, h)]
    add_sweep(trim, sq, [(0.0, z1), (0.06, z1), (0.1, z1 + 0.06), (0.32, z1 + 0.1), (0.32, z1 + 0.24), (0.36, z1 + 0.28),
                         (0.26, z1 + 0.34), (0.0, z1 + 0.34)])
    for x, y in sq:
        add_box(trim, x - 0.24, x + 0.24, y - 0.24, y + 0.24, ridge_z - 0.3, z1)
    sill, spring, r = ridge_z + 0.25, ridge_z + 1.0, 0.55
    for o, u, n in (((0, -h, 0), (1, 0, 0), (0, -1, 0)), ((0, h, 0), (-1, 0, 0), (0, 1, 0)),
                    ((-h, 0, 0), (0, -1, 0), (-1, 0, 0)), ((h, 0, 0), (0, 1, 0), (1, 0, 0))):
        O, U, N = Vector(o), Vector(u), Vector(n)
        add_prism(louvre, arch_poly(2 * r, sill, spring, 14), O, U, N, 0.0, 0.012)
        for k in range(14):
            a0, a1 = math.pi * k / 14, math.pi * (k + 1) / 14
            b = 0.12
            ring = [(r * math.cos(a0), spring + r * math.sin(a0)), ((r + b) * math.cos(a0), spring + (r + b) * math.sin(a0)),
                    ((r + b) * math.cos(a1), spring + (r + b) * math.sin(a1)), (r * math.cos(a1), spring + r * math.sin(a1))]
            add_prism(trim, ring, O, U, N, 0.0, 0.07)
        for sx in (-1, 1):
            add_oriented_box(trim, O, U, N, sx * r, sx * (r + 0.12), sill, spring, 0.0, 0.07)
        add_oriented_box(trim, O, U, N, -r - 0.18, r + 0.18, sill - 0.1, sill, -0.02, 0.12)
    bal_z = z1 + 0.34
    for a, b in (((-h + 0.2, -h + 0.2), (h - 0.2, -h + 0.2)), ((h - 0.2, -h + 0.2), (h - 0.2, h - 0.2)),
                 ((h - 0.2, h - 0.2), (-h + 0.2, h - 0.2)), ((-h + 0.2, h - 0.2), (-h + 0.2, -h + 0.2))):
        balustrade_run(trim, a, b, bal_z, 0.62, die_w=0.42, spacing=0.24)
    for x, y in ((-h + 0.2, -h + 0.2), (h - 0.2, -h + 0.2), (h - 0.2, h - 0.2), (-h + 0.2, h - 0.2)):
        add_lathe(gold_bm, [(rr * 1.4, zz * 1.4) for rr, zz in FINIAL], 14, x, y, bal_z + 0.62 + 0.22)
    # The spire: an octagonal pyramid on a plinth, a gilt collar, a gilt finial.
    base_r = 1.95
    foot = bal_z - 0.2
    apex = foot + 5.6
    add_lathe(spire, [(0.0, 0.0), (base_r + 0.1, 0.0), (base_r + 0.1, 0.18), (base_r, 0.2), (0.0, apex - foot)], 8, 0, 0, foot)
    add_lathe(gold_bm, [(0.0, 0.0), (base_r + 0.13, 0.0), (base_r + 0.13, 0.1), (base_r + 0.02, 0.12), (0.0, 0.12)], 8, 0, 0, foot + 0.19)
    tip = [(0.0, 0.0), (0.2, 0.0), (0.2, 0.08), (0.1, 0.16), (0.24, 0.36), (0.24, 0.46), (0.08, 0.62), (0.05, 0.9), (0.0, 1.25)]
    tip_base = apex - 0.3
    add_lathe(gold_bm, tip, 16, 0, 0, tip_base)
    finish("cupola_walls", wall, [M["wall"]], col)
    finish("cupola_trim", trim, [M["trim"]], col)
    finish("cupola_louvres", louvre, [M["louvre"]], col)
    finish("spire_body", spire, [M["spire"]], col, smooth_angle=10)
    return tip_base + 1.25


def build_podium(M, col):
    bm = new_bm()
    X, Y = 15.4, 10.2
    add_box(bm, -X, X, -Y, Y, 0.0, PODIUM_Z)
    top = new_bm()
    add_box(top, -X + 0.02, X - 0.02, -Y + 0.02, Y - 0.02, PODIUM_Z - 0.01, PODIUM_Z + 0.004)
    path = [(-X, -Y), (X, -Y), (X, Y), (-X, Y)]
    add_sweep(bm, path, [(0.0, PODIUM_Z - 0.08), (0.08, PODIUM_Z - 0.06), (0.08, PODIUM_Z + 0.02), (0.0, PODIUM_Z + 0.04)])
    add_sweep(bm, path, [(0.0, 0.0), (0.1, 0.0), (0.1, 0.12), (0.0, 0.16)])
    steps = new_bm()
    for k in range(3):
        top_z = PODIUM_Z - 0.15 * (k + 1)
        add_box(steps, -3.6, 3.6, Y, Y + 0.42 * (k + 1), 0.0, top_z + 0.0001)
    finish("podium_walls", bm, [M["rustic"]], col)
    finish("terrace_upper", top, [M["paving"]], col)
    finish("garden_steps", steps, [M["steps"]], col)


def append_kept(M, col):
    """The front door leaves, their relief and handles, and the lion frieze,
    appended from P3F and set into the new frontispiece. Transforms are baked
    into the meshes first, so each keeps its exact shape and the web reads
    plain world coordinates."""
    names = ["mansion_doors", "door_relief", "door_handle_0", "door_handle_1", "lion_frieze"]
    with bpy.data.libraries.load(P3F, link=False) as (src, dst):
        dst.objects = [n for n in names if n in src.objects]
    got = {}
    for ob in dst.objects:
        if ob is None:
            continue
        if not ob.users_collection:
            col.objects.link(ob)
        got[ob.name] = ob
    bpy.context.view_layer.update()

    def bake(ob, fn):
        mw = ob.matrix_world.copy()
        ob.parent = None
        me = ob.data.copy()
        ob.data = me
        for v in me.vertices:
            v.co = fn(mw @ v.co)
        ob.matrix_world = Matrix.Identity(4)

    # P3F leaves: x -1.2..1.2, face y -5.1..-5.0, z 0.6..3.9. Fit the new
    # 2.6 x 3.4 opening, leaves 0.15-0.25 behind the frontispiece face.
    sx, sz = DOOR_W / 2.4, (DOOR_TOP - FLOOR_Z) / 3.3
    dy = (-FD + 0.25) - (-5.0)
    for n in ("mansion_doors", "door_relief", "door_handle_0", "door_handle_1"):
        if n in got:
            bake(got[n], lambda w: Vector((w.x * sx, w.y + dy, FLOOR_Z + (w.z - 0.6) * sz)))
    # P3F frieze: y -6.0..-5.5 against an architrave faced at -5.9, z 3.6..4.1.
    if "lion_frieze" in got:
        bake(got["lion_frieze"], lambda w: Vector((w.x, w.y + (PORTICO_FRONT + 5.9), w.z + (4.74 - 3.6))))
        got["lion_frieze"].data.materials.clear()
        got["lion_frieze"].data.materials.append(M["trim"])
    for n in ("door_handle_0", "door_handle_1"):
        if n in got:
            got[n].data.materials.clear()
            got[n].data.materials.append(M["gold"])
    print("KEPT", sorted(got))
    return got


# ---------------------------------------------------------------------------
# THE ESTATE
# ---------------------------------------------------------------------------
FOUNTAIN_Y = -30.0
AVENUE_X = 7.6
WALL_X, WALL_FRONT, WALL_BACK = 72.0, -214.0, 84.0


def ground_height(x, y):
    """Flat inside the compound; a planted berm rises outside it so the horizon
    is trees, not a terrain edge."""
    ox = max(0.0, abs(x) - (WALL_X + 6))
    oy = max(0.0, (y - WALL_BACK - 6), (WALL_FRONT - 6) - y)
    o = math.hypot(ox, oy)
    return 2.6 * (1 - math.exp(-(o / 22.0) ** 2))


def build_ground(M, col):
    bm = new_bm()
    N, S = 110, 330.0
    verts = []
    for j in range(N + 1):
        row = []
        for i in range(N + 1):
            x = -S + 2 * S * i / N
            y = -S - 60 + 2 * S * j / N
            row.append(bm.verts.new((x, y, ground_height(x, y) - 0.02)))
        verts.append(row)
    for j in range(N):
        for i in range(N):
            face(bm, [verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]], 0)
    finish("ground_plane", bm, [M["lawn"]], col, smooth_angle=60)


def build_hardscape(M, col):
    pav, kerb = new_bm(), new_bm()
    # The forecourt: a paved carriage ring round the fountain lawn.
    segs = 72
    r0, r1 = 8.0, 14.0
    inner = [pav.verts.new((r0 * math.cos(2 * math.pi * k / segs), FOUNTAIN_Y + r0 * math.sin(2 * math.pi * k / segs), 0.012)) for k in range(segs)]
    outer = [pav.verts.new((r1 * math.cos(2 * math.pi * k / segs), FOUNTAIN_Y + r1 * math.sin(2 * math.pi * k / segs), 0.012)) for k in range(segs)]
    for k in range(segs):
        k2 = (k + 1) % segs
        face(pav, [inner[k], outer[k], outer[k2], inner[k2]], 0)
    for r in (r0, r1):
        add_sweep(kerb, [(r * math.cos(2 * math.pi * k / segs), FOUNTAIN_Y + r * math.sin(2 * math.pi * k / segs)) for k in range(segs)],
                  [(-0.08, 0.0), (0.08, 0.0), (0.08, 0.1), (-0.08, 0.1)], closed=True, prof_closed=True)
    # Apron from the portico steps to the ring, the avenue to the gate, a walk
    # round the podium, and the rear walk to the canal.
    add_box(pav, -7.0, 7.0, -13.0, FOUNTAIN_Y + r1 - 0.8, 0.0, 0.013)
    add_box(pav, -4.4, 4.4, FOUNTAIN_Y - r1 + 0.8, WALL_FRONT, 0.0, 0.013)
    add_box(pav, -17.4, 17.4, -12.2, 12.2, 0.0, 0.011)
    add_box(pav, -3.8, 3.8, 11.4, 17.6, 0.0, 0.013)
    finish("drive_forecourt", pav, [M["paving"]], col)
    finish("hardscape_kerbs", kerb, [M["trim"]], col)


def build_fountain(M, col, gold_bm):
    stone, water = new_bm(), new_bm()
    fy = FOUNTAIN_Y
    add_lathe(stone, [(0.0, 0.0), (3.9, 0.0), (3.9, 0.46), (3.95, 0.5), (3.95, 0.6), (3.45, 0.6), (3.45, 0.18), (0.0, 0.18)], 64, 0, fy)
    add_lathe(water, [(0.0, 0.0), (3.46, 0.0), (0.0, 0.0)], 64, 0, fy, 0.44)
    stem = [(0.0, 0.0), (0.7, 0.0), (0.7, 0.2), (0.45, 0.3), (0.3, 0.6), (0.36, 1.1), (0.22, 1.4), (1.9, 1.55), (1.95, 1.72),
            (1.55, 1.78), (0.25, 1.75), (0.2, 2.2), (0.28, 2.45), (1.0, 2.55), (1.02, 2.68), (0.8, 2.72), (0.14, 2.7), (0.1, 3.1), (0.0, 3.2)]
    add_lathe(stone, stem, 48, 0, fy, 0.18)
    add_lathe(water, [(0.0, 0.0), (1.8, 0.0), (0.0, 0.0)], 48, 0, fy, 1.86)
    add_lathe(water, [(0.0, 0.0), (0.92, 0.0), (0.0, 0.0)], 32, 0, fy, 2.82)
    finish("fountain_stone", stone, [M["trim"]], col)
    ob = finish("fountain_water", water, [M["water"]], col)


def build_canal(M, col):
    stone, water = new_bm(), new_bm()
    y0, y1, w = 18.0, 60.0, 2.0
    add_box(stone, -w - 0.45, -w, y0 - 0.45, y1 + 0.45, 0.0, 0.26)
    add_box(stone, w, w + 0.45, y0 - 0.45, y1 + 0.45, 0.0, 0.26)
    add_box(stone, -w, w, y0 - 0.45, y0, 0.0, 0.26)
    add_box(stone, -w, w, y1, y1 + 0.45, 0.0, 0.26)
    add_box(water, -w, w, y0, y1, 0.1, 0.12)
    add_lathe(stone, [(0.0, 0.0), (3.4, 0.0), (3.4, 0.4), (3.0, 0.4), (3.0, 0.1), (0.0, 0.1)], 48, 0, y1 + 3.6)
    add_lathe(water, [(0.0, 0.0), (3.0, 0.0), (0.0, 0.0)], 48, 0, y1 + 3.6, 0.3)
    add_lathe(stone, [(0.0, 0.0), (0.5, 0.0), (0.3, 0.3), (0.18, 1.0), (0.7, 1.2), (0.7, 1.3), (0.0, 1.3)], 24, 0, y1 + 3.6, 0.3)
    finish("canal_stone", stone, [M["trim"]], col)
    finish("canal_water", water, [M["water"]], col)


def build_compound_wall(M, col):
    bm = new_bm()
    runs = [((-WALL_X, WALL_FRONT), (-WALL_X, WALL_BACK)), ((WALL_X, WALL_FRONT), (WALL_X, WALL_BACK)),
            ((-WALL_X, WALL_BACK), (WALL_X, WALL_BACK)), ((-WALL_X, WALL_FRONT), (-6.5, WALL_FRONT)),
            ((6.5, WALL_FRONT), (WALL_X, WALL_FRONT))]
    for a, b in runs:
        A, B = Vector(a), Vector(b)
        d = (B - A)
        L = d.length
        d.normalize()
        n = Vector((d.y, -d.x))
        o = Vector((A.x, A.y, 0))
        U, Nn = Vector((d.x, d.y, 0)), Vector((n.x, n.y, 0))
        add_oriented_box(bm, o, U, Nn, 0, L, 0.0, 2.3, -0.2, 0.2)
        add_oriented_box(bm, o, U, Nn, -0.05, L + 0.05, 2.3, 2.42, -0.27, 0.27)
        piers = int(L / 8.0)
        for k in range(piers + 1):
            t = L * k / piers
            add_oriented_box(bm, o, U, Nn, t - 0.35, t + 0.35, 0.0, 2.75, -0.35, 0.35)
            add_oriented_box(bm, o, U, Nn, t - 0.42, t + 0.42, 2.75, 2.88, -0.42, 0.42)
    for s in (-1, 1):
        add_box(bm, s * 6.5 - 0.7, s * 6.5 + 0.7, WALL_FRONT - 0.7, WALL_FRONT + 0.7, 0.0, 3.6)
        add_box(bm, s * 6.5 - 0.82, s * 6.5 + 0.82, WALL_FRONT - 0.82, WALL_FRONT + 0.82, 3.6, 3.78)
    finish("estate_wall", bm, [M["trim"]], col)


# ---- vegetation -------------------------------------------------------------
def palm_mesh(M, name, height, lean=0.0, fronds=16, frond_len=4.4, droop=0.9, seed=1):
    rng = random.Random(seed)
    bm = new_bm()
    segs, rings = 9, 14
    top = height
    shaft_from = height - 1.7

    def axis(t):
        return Vector((lean * t * t * height * 0.08, 0.0, t * height))
    prev = None
    for r_i in range(rings + 1):
        t = r_i / rings
        c = axis(t)
        z = c.z
        if z > shaft_from:
            rad = 0.27 - 0.03 * (z - shaft_from) / 1.7
        else:
            rad = 0.43 - 0.16 * min(1, z / 1.2) + 0.03 * math.sin(math.pi * min(1.0, z / shaft_from))
            rad = max(0.24, rad) if z > 1.2 else rad
        ring = [bm.verts.new((c.x + rad * math.cos(2 * math.pi * k / segs), c.y + rad * math.sin(2 * math.pi * k / segs), z))
                for k in range(segs)]
        if prev:
            mi = 1 if z > shaft_from + 0.05 else 0
            for k in range(segs):
                k2 = (k + 1) % segs
                face(bm, [prev[k], prev[k2], ring[k2], ring[k]], mi)
        prev = ring
    crown = axis(1.0) + Vector((0, 0, 0.15))
    for f in range(fronds):
        az = 2 * math.pi * f / fronds + rng.uniform(-0.12, 0.12)
        tier = f % 3
        elev = (math.radians(58), math.radians(28), math.radians(-5))[tier] + rng.uniform(-0.1, 0.1)
        L = frond_len * (0.85 + 0.2 * rng.random()) * (0.8 if tier == 0 else 1.0)
        dirv = Vector((math.cos(az) * math.cos(elev), math.sin(az) * math.cos(elev), math.sin(elev)))
        side = Vector((-math.sin(az), math.cos(az), 0))
        n = 9
        left, mid, right = [], [], []
        for k in range(n + 1):
            t = k / n
            p = crown + dirv * (t * L) + Vector((0, 0, -droop * L * 0.55 * t * t))
            w = 0.62 * math.sin(min(1.0, t * 1.25) * math.pi * 0.5) * (1 - 0.75 * t ** 2.2)
            up = Vector((0, 0, 0.18 * w))
            mid.append((bm.verts.new(p), t))
            left.append((bm.verts.new(p + side * w + up), t))
            right.append((bm.verts.new(p - side * w + up), t))
        for k in range(n):
            for a, b in ((left, mid), (mid, right)):
                fc = face(bm, [a[k][0], a[k + 1][0], b[k + 1][0], b[k][0]], 2)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    uvl = me.uv_layers.new(name="UVMap")
    # frond UVs: u along the frond, v across (0 left, .5 rachis, 1 right)
    vcount = len(me.vertices)
    for p in me.polygons:
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index
            co = me.vertices[vi].co
            uvl.data[li].uv = (co.x * 0.3, co.z * 0.3)
    bm.free()
    # Re-derive frond UVs exactly from construction order.
    me.materials.append(M["trunk"])
    me.materials.append(M["shaft"])
    me.materials.append(M["frond"])
    return me


def frond_uvs(me, fronds, n, trunk_verts):
    """Frond vertices were created as (mid, left, right) per step; rebuild their
    UVs from that order."""
    uv = me.uv_layers["UVMap"].data
    per = (n + 1) * 3
    for p in me.polygons:
        if p.material_index != 2:
            continue
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index - trunk_verts
            k, role = divmod(vi % per, 3)
            t = k / n
            v = (0.5, 0.0, 1.0)[role]
            uv[li].uv = (0.02 + 0.96 * t, v)


def make_palm(M, name, height, lean, seed):
    fronds, n, segs, rings = 16, 9, 9, 14
    me = palm_mesh(M, name, height, lean=lean, fronds=fronds, seed=seed)
    frond_uvs(me, fronds, n, segs * (rings + 1))
    for p in me.polygons:
        p.use_smooth = p.material_index != 2
    return me


def card_tree_mesh(M, name, leaf_key, height, canopy_r, canopy_h, cards, seed, trunk_r=0.28, branches=4):
    """A tree the way real-time foliage is built: a bark trunk and a few limbs,
    and a canopy of alpha-cut leaf-cluster cards scattered through an
    ellipsoid. Each card's normals point away from the canopy centre, so the
    crown shades as one soft volume instead of a hundred flat planes."""
    rng = random.Random(seed)
    bm = new_bm()
    trunk_top = height - canopy_h * 0.75
    add_lathe(bm, [(0.0, 0.0), (trunk_r * 1.35, 0.0), (trunk_r, 0.6), (trunk_r * 0.72, trunk_top), (0.0, trunk_top + 0.2)], 8, 0, 0, 0.0, 0)
    C = Vector((0.0, 0.0, height - canopy_h * 0.5))
    for b in range(branches):
        a = 2 * math.pi * b / branches + rng.uniform(-0.4, 0.4)
        tip = C + Vector((math.cos(a) * canopy_r * 0.55, math.sin(a) * canopy_r * 0.55, rng.uniform(-0.2, 0.3) * canopy_h))
        base = Vector((0, 0, trunk_top - 0.3))
        axis = tip - base
        L = axis.length
        add_lathe_oriented(bm, [(0.0, 0.0), (trunk_r * 0.5, 0.0), (trunk_r * 0.22, L), (0.0, L)], 6, base, axis, (0, 0, 1) if abs(axis.z) < 0.9 * L else (1, 0, 0), 0)
    card_normals = []
    uv_pairs = []
    for i in range(cards):
        while True:
            d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
            if 0.05 < d.length <= 1.0:
                break
        d.normalize()
        shell = 0.45 + 0.55 * rng.random() ** 0.5
        P = C + Vector((d.x * canopy_r * shell, d.y * canopy_r * shell, d.z * canopy_h * 0.5 * shell))
        size = rng.uniform(0.75, 1.1) * max(1.0, canopy_r * 0.42)
        n = (d + Vector((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), rng.uniform(-0.3, 0.6)))).normalized()
        t1 = n.cross(Vector((0, 0, 1)))
        if t1.length < 1e-3:
            t1 = Vector((1, 0, 0))
        t1.normalize()
        t2 = n.cross(t1).normalized()
        rot = rng.uniform(0, 2 * math.pi)
        a1 = t1 * math.cos(rot) + t2 * math.sin(rot)
        a2 = n.cross(a1).normalized()
        corners = [P - a1 * size - a2 * size, P + a1 * size - a2 * size, P + a1 * size + a2 * size, P - a1 * size + a2 * size]
        vs = [bm.verts.new(c) for c in corners]
        f = face(bm, vs, 1)
        if f is None:
            continue
        for c in corners:
            card_normals.append(((c - C) * 0.8 / max(0.001, (c - C).length) + n * 0.2).normalized())
        uv_pairs.append(f)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    uvl = me.uv_layers.new(name="UVMap")
    loop_normals = []
    ci = 0
    quad_uv = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    for p in me.polygons:
        p.use_smooth = True
        if p.material_index == 1:
            for k, li in enumerate(p.loop_indices):
                uvl.data[li].uv = quad_uv[k % 4]
    # custom normals: bark keeps its own, cards take the canopy's
    for p in me.polygons:
        for li in p.loop_indices:
            if p.material_index == 1:
                loop_normals.append(tuple(card_normals[ci]))
                ci += 1
            else:
                loop_normals.append(tuple(p.normal))
    try:
        me.normals_split_custom_set(loop_normals)
    except Exception as e:
        print("normals_split_custom_set failed", e)
    me.materials.append(M["bark"])
    me.materials.append(M["leaf_" + leaf_key])
    return me


def scatter(col, me, name, points):
    parent = bpy.data.objects.new(name, None)
    col.objects.link(parent)
    for i, (x, y, rot, s) in enumerate(points):
        ob = bpy.data.objects.new(f"{name}_{i:03d}", me)
        col.objects.link(ob)
        ob.location = (x, y, ground_height(x, y) - 0.05)
        ob.rotation_euler = (0, 0, rot)
        ob.scale = (s, s, s)
        ob.parent = parent
    return parent


def build_vegetation(M, col):
    rng = random.Random(11)
    royal = [make_palm(M, f"palm_royal_{k}", h, 0.0, 30 + k) for k, h in enumerate((13.0, 14.5))]
    coco = [make_palm(M, f"palm_coconut_{k}", h, lean, 50 + k) for k, (h, lean) in enumerate(((9.5, 1.4), (11.0, -1.1)))]
    rain = card_tree_mesh(M, "tree_rain", "rain", 12.0, 7.5, 5.0, 84, 70, trunk_r=0.45, branches=5)
    mango = card_tree_mesh(M, "tree_mango", "mango", 10.5, 5.0, 6.5, 70, 71, trunk_r=0.36)
    neem = card_tree_mesh(M, "tree_neem", "rain", 13.5, 5.5, 7.0, 76, 72, trunk_r=0.34)
    frangi = card_tree_mesh(M, "tree_frangipani", "frangipani", 4.8, 2.7, 2.4, 30, 90, trunk_r=0.16, branches=4)
    bloom = card_tree_mesh(M, "shrub_bougainvillea", "bougainvillea", 1.7, 1.3, 1.3, 14, 95, trunk_r=0.05, branches=0)

    avenue = []
    for k in range(18):
        y = FOUNTAIN_Y - 17.0 - 9.5 * k
        for sx in (-1, 1):
            avenue.append((sx * AVENUE_X, y, rng.uniform(0, 6.28), rng.uniform(0.92, 1.08)))
    scatter(col, royal[0], "veg_palm_avenue", avenue[0::2])
    scatter(col, royal[1], "veg_palm_avenue_b", avenue[1::2])
    # The forecourt ring is planted only on its far half and flanks, so no palm
    # stands between the camera and the front of the house.
    ring = []
    for k in range(14):
        a = 2 * math.pi * (k + 0.5) / 14
        x, y = 17.5 * math.cos(a), FOUNTAIN_Y + 17.5 * math.sin(a)
        # Clear of the house (far half and flanks only) and of the entry axis,
        # where the approach and the doorway fly.
        if y > FOUNTAIN_Y - 3.0 or abs(x) < 9.0:
            continue
        ring.append((x, y, rng.uniform(0, 6.28), rng.uniform(0.95, 1.05)))
    scatter(col, royal[1], "veg_palm_forecourt", ring)
    groves = []
    # Groves stand off the camera's orbit: flanking the forecourt well out,
    # at the back corners of the house, behind the canal, and down the drive.
    for cx, cy, n in ((-56, -40, 5), (56, -40, 5), (-46, 30, 6), (46, 30, 6), (-26, 70, 4), (26, 70, 4), (-55, -75, 5), (55, -75, 5)):
        for i in range(n):
            groves.append((cx + rng.uniform(-7, 7), cy + rng.uniform(-7, 7), rng.uniform(0, 6.28), rng.uniform(0.85, 1.15)))
    scatter(col, coco[0], "veg_palm_coconut", groves[0::2])
    scatter(col, coco[1], "veg_palm_coconut_b", groves[1::2])
    fr = [(sx * 12.5, 20 + 7.5 * k, rng.uniform(0, 6.28), rng.uniform(0.9, 1.1)) for k in range(6) for sx in (-1, 1)]
    fr += [(sx * 20.5, -40.0 - 7 * k, rng.uniform(0, 6.28), 1.0) for k in range(3) for sx in (-1, 1)]
    scatter(col, frangi, "veg_frangipani", fr)
    # Bougainvillea in the parterre beds.
    sh = []
    for sx in (-1, 1):
        for bx in (sx * 23.0, sx * 31.0):
            for by in (-31.0, -21.0):
                for j in range(3):
                    sh.append((bx + rng.uniform(-2.2, 2.2), by + rng.uniform(-2.5, 2.5), rng.uniform(0, 6.28), rng.uniform(0.8, 1.05)))
    scatter(col, bloom, "veg_bougainvillea", sh)
    # The belt: big canopies outside the compound wall and along its inside.
    belt = []

    def far_ok(x, y):
        return abs(x) > WALL_X + 3 or y > WALL_BACK + 3 or y < WALL_FRONT - 3
    tries = 0
    while len(belt) < 190 and tries < 9000:
        tries += 1
        x = rng.uniform(-175, 175)
        y = rng.uniform(-300, 210)
        if not far_ok(x, y):
            continue
        if abs(x) < 22 and y < WALL_FRONT:
            continue
        if any((x - bx) ** 2 + (y - by) ** 2 < 90 for bx, by, _, _ in belt):
            continue
        belt.append((x, y, rng.uniform(0, 6.28), rng.uniform(0.85, 1.3)))
    # Planted thick along the inside of the wall, so from the hero and the
    # revolution the compound reads as a belt of trees rather than a long white
    # boundary wall.
    inner = []
    for k in range(56):
        sx = -1 if k % 2 else 1
        inner.append((sx * rng.uniform(57, 67), rng.uniform(WALL_FRONT + 12, WALL_BACK - 8), rng.uniform(0, 6.28), rng.uniform(0.85, 1.15)))
    for k in range(30):
        x = -64 + 128 * (k + rng.uniform(0.1, 0.9)) / 30
        if abs(x) < 16:
            continue
        inner.append((x, rng.uniform(WALL_BACK - 9, WALL_BACK - 4), rng.uniform(0, 6.28), rng.uniform(0.85, 1.15)))
    allt = belt + inner
    rng.shuffle(allt)
    scatter(col, rain, "veg_tree_rain", allt[0::3])
    scatter(col, mango, "veg_tree_mango", allt[1::3])
    scatter(col, neem, "veg_tree_neem", allt[2::3])
    scatter(col, coco[0], "veg_palm_belt", [(p[0] + 4.5, p[1] + 3.5, p[2], 1.0) for p in belt[::4]])


def build_gardens(M, col):
    hedge, beds, soil = new_bm(), new_bm(), new_bm()
    def hedge_rect(x0, x1, y0, y1, h=0.7, t=0.5):
        add_box(hedge, x0, x1, y0, y0 + t, 0.0, h)
        add_box(hedge, x0, x1, y1 - t, y1, 0.0, h)
        add_box(hedge, x0, x0 + t, y0 + t, y1 - t, 0.0, h)
        add_box(hedge, x1 - t, x1, y0 + t, y1 - t, 0.0, h)
    # Parterres flanking the forecourt.
    for s in (-1, 1):
        x0, x1 = sorted((s * 19.0, s * 35.0))
        hedge_rect(x0, x1, -36.0, -15.0)
        for (a0, a1) in ((x0 + 1.4, (x0 + x1) / 2 - 0.8), ((x0 + x1) / 2 + 0.8, x1 - 1.4)):
            for (b0, b1) in ((-34.6, -26.3), (-24.7, -16.4)):
                add_box(soil, a0, a1, b0, b1, 0.0, 0.08)
                add_box(hedge, a0, a1, b0, b0 + 0.3, 0.0, 0.42)
                add_box(hedge, a0, a1, b1 - 0.3, b1, 0.0, 0.42)
    # Canal lawn borders.
    for s in (-1, 1):
        x0, x1 = sorted((s * 3.2, s * 15.0))
        hedge_rect(x0, x1, 16.0, 62.0, h=0.9)
    # Topiary cones in stone planters on the podium, between the windows.
    planters = new_bm()
    for s in (-1, 1):
        for x in (7.45, 10.15):
            for y in (-9.35, 9.35):
                add_lathe(planters, [(0.0, 0.0), (0.42, 0.0), (0.5, 0.08), (0.46, 0.55), (0.52, 0.62), (0.0, 0.62)], 24, s * x, y, PODIUM_Z)
                add_lathe(hedge, [(0.0, 0.0), (0.46, 0.0), (0.42, 0.3), (0.0, 2.0)], 16, s * x, y, PODIUM_Z + 0.6)
    # Flower beds of bougainvillea colour in the parterres are shrubs (see veg).
    finish("garden_hedges", hedge, [M["hedge"]], col)
    finish("garden_beds", soil, [M["soil"]], col)
    finish("garden_planters", planters, [M["trim"]], col)


# ---------------------------------------------------------------------------
# PREVIEW
# ---------------------------------------------------------------------------
def preview(outdir):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 1280, 800
    sc.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    sky = nt.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = "MULTIPLE_SCATTERING"
    except Exception:
        pass
    sky.sun_elevation = math.radians(38)
    sky.sun_rotation = math.radians(215)
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.22
    sc.view_settings.exposure = -0.6
    sun = bpy.data.objects.new("SUN", bpy.data.lights.new("SUN", "SUN"))
    sc.collection.objects.link(sun)
    sun.data.energy = 3.2
    sun.data.angle = math.radians(1.5)
    sun.rotation_euler = (math.radians(52), 0, math.radians(-35))
    cam = bpy.data.objects.new("CAM", bpy.data.cameras.new("CAM"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    shots = {
        "hero": ((-36.0, -52.0, 26.0), (0.0, -4.0, 5.0), 38),
        "front": ((0.0, -48.0, 6.5), (0.0, -8.0, 6.0), 40),
        "rear34": ((38.0, 44.0, 20.0), (0.0, 2.0, 5.5), 40),
        "side": ((-46.0, 6.0, 9.0), (0.0, 0.0, 6.0), 40),
        "aerial": ((-95.0, -170.0, 85.0), (0.0, -40.0, 0.0), 45),
        "estate": ((0.0, -110.0, 22.0), (0.0, -10.0, 6.0), 40),
        "door": ((0.0, -22.0, 3.2), (0.0, -8.4, 2.6), 42),
    }
    os.makedirs(outdir, exist_ok=True)
    for name, (p, t, fov) in shots.items():
        cam.location = p
        d = Vector(t) - Vector(p)
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        cam.data.angle = math.radians(fov)
        sc.render.filepath = os.path.join(outdir, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print("PREVIEW", name)


def main():
    col = fresh_scene()
    M = build_materials()
    if "arch" in STAGES:
        gold = new_bm()
        build_walls(M, col)
        build_bands(M, col)
        build_quoins(M, col)
        window_dressing(M, col)
        build_parapet(M, col, gold)
        build_portico(M, col, gold)
        build_pediments(M, col, gold)
        ridge = build_roof(M, col)
        tip = build_cupola(M, col, gold, ridge)
        build_podium(M, col)
        append_kept(M, col)
        finish("mansion_gold", gold, [M["gold"]], col, smooth_angle=40)
        print("SPIRE_TIP", round(tip, 3), "RIDGE", round(ridge, 3))
    if "land" in STAGES:
        build_ground(M, col)
        build_hardscape(M, col)
        g2 = new_bm()
        build_fountain(M, col, g2)
        g2.free()
        build_canal(M, col)
        build_compound_wall(M, col)
        build_gardens(M, col)
        build_vegetation(M, col)
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    print("SAVED", OUT)
    if "preview" in STAGES:
        preview(os.path.join(os.path.dirname(OUT), "_v7preview"))


main()
