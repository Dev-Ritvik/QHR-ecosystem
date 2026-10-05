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
balustraded parapet with urns, and long-and-short quoins. NOT KEPT: the hipped
slate roof, its cupola and the pointed spire on it - the client had the roof
made fully flat (2026-10-01; see build_roof).

UNITS AND AXES: metres, Blender Z up, the entrance front faces -Y (three.js +z).
"""
import bpy
import bmesh
import math
import os
import random
import zlib
import sys
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else "C:/dev/Blender/mansion_estate_V7.blend"
STAGES = set(ARGS[1:]) or {"arch", "land", "lux"}
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
PEDIMENT_DEPTH = 0.8        # how far a pediment's gable runs back from its face


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
    # THE GROUND'S OWN SURFACES (the refinement brief, 2026-10-03; the scans
    # are fitted by tools/gltf/ph_surfaces_v7.py). The carriage ring, the avenue
    # and the garden walks of a house like this are raked gravel, and its
    # terrace is laid in flags: all of them were MAT_Stone_Paving, four flat
    # squares of one tan. Without the scans the paving stands in.
    if os.path.exists(f"{TEX}/v7_gravel_basecolor.png"):
        M["gravel"] = principled("MAT_Gravel", tex=t("v7_gravel"), normal_strength=1.0)
        M["flags"] = principled("MAT_Stone_Flags", tex=t("v7_flags"), normal_strength=0.8)
    else:
        M["gravel"] = M["flags"] = M["paving"]
    M["roof"] = principled("MAT_Roof_Slate", tex={"base": f"{SLATE}/p4c_basecolor.png", "rough": f"{SLATE}/p4c_roughness.png",
                                                  "normal": f"{SLATE}/normal.png"}, normal_strength=0.7)
    # THE FLAT IS LEAD (the paid audit of 2026-10-04, pass 4: "does this
    # material have a believable physical response to light?"). Laid in slate
    # flags it printed as one black rectangle in every frame taken from above
    # the parapet - the cover, the crane, the holdings - with nothing on it
    # for the light to find. The flat behind a house like this is sheet lead,
    # dressed over wooden rolls every two feet: a weathered grey that takes
    # the sky's colour, ruled with the rolls' fine shadows (build_roof).
    M["lead"] = principled("MAT_Roof_Lead", base=(0.26, 0.28, 0.3), rough=0.62, spec=0.5)
    # THE COMPOUND WALL IS NOT THE HOUSE'S STONE. It shared MAT_Stone_Wall, and
    # from the cover a quarter-kilometre of it ran behind the house as bright
    # as the front itself: a white line through the park. A boundary wall is
    # rendered masonry that has stood in the weather; it sits two stops under
    # the ashlar and the eye stays on the house.
    M["boundary"] = principled("MAT_Stone_Boundary", tex=t("v7_limestone"), tint=(0.5, 0.47, 0.42), normal_strength=0.8)
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
    # Foliage cards rendered from modelled leaf clusters (render_foliage_v7.py):
    # albedo with the occlusion between leaves, and the cluster's normals.
    M["frond"] = principled("MAT_Palm_Frond", tex={"base": f"{TEX}/v7_palm_frond.png", "normal": f"{TEX}/v7_palm_frond_normal.png"},
                            rough=0.7, double=True, clip=True, normal_strength=0.8)
    for key, stem in (("rain", "v7_canopy_rain"), ("mango", "v7_canopy_mango"), ("bougainvillea", "v7_bougainvillea"),
                      ("frangipani", "v7_frangipani")):
        M["leaf_" + key] = principled(f"MAT_Leaves_{key.title()}", tex={"base": f"{TEX}/{stem}.png", "normal": f"{TEX}/{stem}_normal.png"},
                                      rough=0.75, double=True, clip=True, normal_strength=0.8)
    M["bark"] = principled("MAT_Bark", base=(0.2, 0.15, 0.11), rough=0.9)
    # The shade trees made from Poly Haven's scans (ph_trees_v7.py): the leaf
    # card cut from each scan's own crown, and the scan's bark.
    for key in PH_TREES:
        stem = f"{TEX}/v7_ph_{key}"
        if not os.path.exists(f"{stem}.png"):
            continue
        # The procedural card material of the same name steps aside, or
        # Blender would name this one "MAT_Leaves_Rain.001".
        old = bpy.data.materials.get(f"MAT_Leaves_{key.title()}")
        if old is not None:
            old.name = f"MAT_Leaves_{key.title()}_Procedural"
        M["leaf_" + key] = principled(f"MAT_Leaves_{key.title()}", tex={"base": f"{stem}.png", "normal": f"{stem}_normal.png"},
                                      rough=0.75, double=True, clip=True, normal_strength=0.8)
        M["bark_" + key] = principled(f"MAT_Bark_{key.title()}", tex={"base": f"{stem}_bark.jpg", "normal": f"{stem}_bark_normal.jpg",
                                                                       "rough": f"{stem}_bark_rough.png"}, rough=0.9, normal_strength=1.0)
    # ---- the luxury programme -------------------------------------------
    # Polished stone reads as expense before any detail does: it is the one
    # surface in the set that carries a reflection, and a reflection is what
    # separates a render from a photograph.
    M["terrace"] = principled("MAT_Stone_Terrace", tex=t("v7_terrace"), rough=0.18, spec=0.7, normal_strength=0.35)
    M["pool"] = principled("MAT_Pool_Shell", base=(0.55, 0.8, 0.84), rough=0.3, spec=0.6)
    M["poolwater"] = principled("MAT_Water_Pool", base=(0.05, 0.45, 0.52), rough=0.02, spec=1.0, alpha=0.45)
    M["railglass"] = principled("MAT_Glass_Rail", base=(0.55, 0.62, 0.62), rough=0.02, spec=1.0, alpha=0.24, double=True)
    M["steel"] = principled("MAT_Steel", base=(0.62, 0.63, 0.64), rough=0.22, metal=1.0)
    M["teak"] = principled("MAT_Teak", base=(0.29, 0.17, 0.09), rough=0.45)
    M["fabric"] = principled("MAT_Fabric", base=(0.86, 0.83, 0.76), rough=0.85, double=True)
    M["carpaint"] = principled("MAT_Car_Paint", base=(0.016, 0.019, 0.026), rough=0.12, metal=0.75, spec=1.0)
    M["carpaint2"] = principled("MAT_Car_Paint_Pale", base=(0.5, 0.48, 0.45), rough=0.14, metal=0.7, spec=1.0)
    M["carglass"] = principled("MAT_Car_Glass", base=(0.03, 0.035, 0.04), rough=0.03, spec=1.0, alpha=0.62)
    M["chrome"] = principled("MAT_Chrome", base=(0.78, 0.79, 0.8), rough=0.08, metal=1.0)
    M["tarmac"] = principled("MAT_Helipad_Deck", base=(0.055, 0.057, 0.06), rough=0.75)
    M["paint"] = principled("MAT_Paint_Line", base=(0.86, 0.86, 0.83), rough=0.6)
    # Fixtures the evening channel lifts: WorldCanvas grades anything named
    # MAT_Light_* upward at dusk, so these are lamps rather than white plastic.
    M["lamp"] = principled("MAT_Light_Warm", base=(1.0, 0.78, 0.5), rough=0.3,
                           emission=((1.0, 0.72, 0.42), 2.2))
    M["poollamp"] = principled("MAT_Light_Pool", base=(0.6, 0.92, 1.0), rough=0.2,
                               emission=((0.45, 0.85, 1.0), 2.6))
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
        "MAT_Stone_Steps": 2.0, "MAT_Roof_Slate": 3.0, "MAT_Roof": 2.0, "MAT_Lawn": 6.0,
        "MAT_Stone_Terrace": 2.4, "MAT_Helipad_Deck": 4.0,
        # The scans' own size on the ground (Poly Haven: 3 m a tile).
        "MAT_Gravel": 3.0, "MAT_Stone_Flags": 3.0}


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


def ease_arrises(ob, width, min_edge=0.09, min_angle=55.0):
    """Take the knife edge off dressed stone: a chamfer of `width` on every
    convex arris.

    The refinement brief (2026-10-03): "Refine the asset so close camera
    positions do not expose ... overly clean edges". Every block here is a box
    with edges of zero radius, which no mason leaves and no stone keeps: a real
    arris is eased a few millimetres when it is cut and a few more by a century
    of weather, and that narrow face is what catches the light along a step, a
    plinth or a quoin. One flat chamfer (not a rounded one: the faces either
    side stay flat and keep their own shading), on edges long enough to be an
    edge of a block and not a facet of something turned (`min_edge`: a
    baluster's rings and a column's are shorter, and keep their mouldings).
    """
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    hard = []
    for e in bm.edges:
        if len(e.link_faces) != 2 or not e.is_convex or e.calc_length() < min_edge:
            continue
        try:
            if e.calc_face_angle() < math.radians(min_angle):
                continue
        except ValueError:
            continue
        hard.append(e)
    before = len(bm.faces)
    if hard:
        bmesh.ops.bevel(bm, geom=hard, offset=width, offset_type="OFFSET", segments=1, profile=0.5,
                        affect="EDGES", clamp_overlap=True)
    bm.to_mesh(me)
    after = len(bm.faces)
    bm.free()
    box_uv(ob, {})
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.set_sharp_from_angle(angle=math.radians(35.0))
    except Exception:
        pass
    print("ARRIS", ob.name, "edges", len(hard), "faces", before, "->", after)


# What the film's camera comes close to, and the chamfer each takes (metres).
ARRISES = {
    "portico_trim": 0.012, "portico_steps": 0.014, "garden_steps": 0.014, "podium_walls": 0.016,
    "mansion_quoins": 0.012, "mansion_window_trim": 0.008, "mansion_bands": 0.010,
    "mansion_pediments": 0.010, "mansion_parapet": 0.009, "podium_balustrade": 0.009,
    "fountain_stone": 0.012, "hardscape_kerbs": 0.010, "pool_coping": 0.010, "garden_planters": 0.010,
}


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


# A step's tread: how far it oversails the riser, and its thickness (metres).
NOSING = (0.028, 0.045)


def build_portico(M, col, gold_bm):
    bm = new_bm()      # trim
    st = new_bm()      # steps / paving
    # Platform
    add_box(bm, -FX - 0.6, FX + 0.6, -FD, PORTICO_FRONT - 0.15, 0.0, FLOOR_Z)
    add_box(st, -FX - 0.55, FX + 0.55, -FD + 0.02, PORTICO_FRONT - 0.1, FLOOR_Z - 0.02, FLOOR_Z + 0.005)
    # Steps down to the forecourt
    for k in range(3):
        top = FLOOR_Z - 0.15 * (k + 1)
        front = PORTICO_FRONT - 0.15 - 0.42 * (k + 1)
        add_box(st, -FX, FX, PORTICO_FRONT - 0.15, front, 0.0, top - NOSING[1])
        # The tread: a slab that oversails its riser (NOSING), so a step has a
        # nosing and a line of shadow under it, as a stone step does.
        add_box(st, -FX, FX, PORTICO_FRONT - 0.15, front - NOSING[0], top - NOSING[1], top)
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
    # THE ARCHITRAVE IN TWO FASCIAE, AND A DENTIL COURSE (the third review:
    # "columns of that diameter exist to bear massive weight; here they ...
    # [hold] up a paper-thin roof"). The entablature is 1.2 m over 4.4 m of
    # column, which is classical; what it lacked was the modelling that makes a
    # beam read as a beam. The architrave steps out twice as it rises, and a
    # row of dentils under the cornice throws a line of shadow blocks: the
    # same depth, read as stone laid in courses rather than a painted band.
    add_sweep(bm, path, [(0.0, 4.4), (0.025, 4.4), (0.025, 4.55), (0.0, 4.55)])
    add_sweep(bm, path, [(0.0, 4.55), (0.05, 4.55), (0.05, 4.7), (0.0, 4.7)])
    for k in range(int((2 * FX + 0.1) / 0.24)):
        x = -FX - 0.05 + 0.12 + 0.24 * k
        if x > FX - 0.07:
            break
        add_box(bm, x - 0.07, x + 0.07, PORTICO_FRONT - 0.1, PORTICO_FRONT + 0.001, 5.1, 5.22)
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
        # Tympanum, set back from the face. A GABLE ON THE FACADE, NOT A ROOF: it
        # ran 3 m back over the frontispiece, a pitched stone roof in miniature,
        # and with the house's roof made flat (build_roof) the two of them stood
        # on it like sheds. They are the thickness of the wall they stand on now,
        # and the flat runs up to their backs.
        add_prism(bm, [(-FX, base), (FX, base), (0, base + FX * math.tan(PEDIMENT_PITCH))], o, U, N, -PEDIMENT_DEPTH + 0.18, -0.22)
        # Raking cornices: a sloped slab and a bed moulding under it.
        for s in (-1, 1):
            for (d0, d1, t0, t1) in ((-PEDIMENT_DEPTH, overhang, 0.0, 0.3), (-PEDIMENT_DEPTH, 0.22, -0.06, 0.0)):
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
    """A FLAT ROOF, from parapet to parapet.

    The house carried a hipped slate roof behind its balustrade, a cupola on the
    ridge and a pointed spire on that. The client had the spire taken off first
    (2026-10-01: "remove the top part of the roof and replace it with a flat
    roof"), saw the cupola still standing on the hip under a flat lid, and was
    plain about it: "not this i said i want fully flat roof". So the hip, the
    cross gables behind the pediments and the cupola are all gone, and the
    house ends where a Palladian house with a flat ends: at its balustraded
    parapet and its urns, with the pediments as the only thing that rises
    above them.

    What lies behind the parapet is a slate flat, as a lead or slate flat is
    laid: one sheet from wall head to wall head, a stone kerb round its edge
    (the gutter runs between the kerb and the balustrade's plinth), and its
    middle raised one shallow step so the flat sheds its water outward. Flags,
    not courses: the runtime weathers this material flag by flag
    (exteriorSurfaces.ts), which on a level surface reads as paving.
    """
    bm = new_bm()       # the flat
    kerb = new_bm()     # its stone kerb
    rolls = new_bm()    # the lead's rolls
    z = ROOF_EAVE_Z
    # The wall heads' inner faces stand at the old eave line; the sheet laps
    # them by 6 cm so no seam shows from above.
    X, Y = ROOF_EAVE_X + 0.06, ROOF_EAVE_Y + 0.06
    add_box(bm, -X, X, -Y, Y, z - 0.08, z + 0.01)
    # The frontispieces' heads, front and back, under the pediments.
    fx = FX - WALL_T + 0.06
    for s_ in (-1, 1):
        y0, y1 = sorted((s_ * (ROOF_EAVE_Y - 0.1), s_ * (FD - WALL_T + 0.06)))
        add_box(bm, -fx, fx, y0, y1, z - 0.08, z + 0.01)
    # The raised middle: one step of 8 cm, clear of the pediments' backs.
    rx, ry = X - 2.4, Y - 2.4
    k_in = 0.3          # the rolls stop at the kerb
    add_box(bm, -rx, rx, -ry, ry, z + 0.01, z + 0.09)
    # THE ROLLS. Sheet lead is laid in bays about two feet wide, each dressed
    # over a wooden roll at its edge: from above, a flat ruled with fine
    # parallel ridges running with the fall. On the raised middle they run
    # front to back; on the lower walk round it, out to the gutter.
    bay = 0.68
    n = int((2 * rx) / bay)
    for k in range(n + 1):
        x = -rx + (2 * rx) * k / n
        add_box(rolls, x - 0.028, x + 0.028, -ry, ry, z + 0.09, z + 0.132)
    n_out = int((2 * X) / bay)
    for k in range(1, n_out):
        x = -X + (2 * X) * k / n_out
        for y0, y1 in ((-Y + k_in, -ry), (ry, Y - k_in)):
            add_box(rolls, x - 0.028, x + 0.028, y0, y1, z + 0.01, z + 0.052)
    n_side = int((2 * ry) / bay)
    for k in range(n_side + 1):
        y = -ry + (2 * ry) * k / n_side
        for x0, x1 in ((-X + k_in, -rx), (rx, X - k_in)):
            add_box(rolls, x0, x1, y - 0.028, y + 0.028, z + 0.01, z + 0.052)
    # The kerb, 28 cm of stone standing 15 cm over the sheet.
    k = 0.28
    for x0, x1, y0, y1 in ((-X, X, -Y, -Y + k), (-X, X, Y - k, Y),
                           (-X, -X + k, -Y + k, Y - k), (X - k, X, -Y + k, Y - k)):
        add_box(kerb, x0, x1, y0, y1, z + 0.005, z + 0.16)
    finish("mansion_roof", bm, [M["lead"]], col, smooth_angle=10)
    finish("mansion_roof_rolls", rolls, [M["lead"]], col, smooth_angle=10)
    finish("mansion_roof_kerb", kerb, [M["trim"]], col, smooth_angle=10)
    return z + 0.09


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
        front = Y + 0.42 * (k + 1)
        add_box(steps, -3.6, 3.6, Y, front, 0.0, top_z - NOSING[1])
        add_box(steps, -3.6 - NOSING[0], 3.6 + NOSING[0], Y, front + NOSING[0], top_z - NOSING[1], top_z + 0.0001)
    finish("podium_walls", bm, [M["rustic"]], col)
    finish("terrace_upper", top, [M["flags"]], col)
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
APRON_X = 7.0               # half width of the gravel apron between the steps and the ring
RING_R = (8.0, 14.0)        # the carriage ring round the fountain lawn
AVENUE_X = 7.6
WALL_X, WALL_FRONT, WALL_BACK = 72.0, -214.0, 84.0


def _smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def park_swell(x, y):
    """A few gentle swells in the park (the second client review: "a massive,
    completely flat green plane ... without any topographical dips"). Sums of
    long, incommensurate waves — 20 to 50 m across, a metre at most — so the
    ground rolls without ever repeating or reading as a pattern."""
    return (0.5 * math.sin(x / 23.0 + 0.7) * math.cos(y / 31.0 - 0.4)
            + 0.32 * math.sin((x + y) / 47.0 + 1.3)
            + 0.22 * math.cos((x - 2.0 * y) / 19.0 + 2.1))


def park_mask(x, y):
    """1 in the open park, 0 on anything formal or built. Level where it must
    be: the house, its gardens, the forecourt, the pool terrace and the canal
    (|x| < 40, -60 < y < 70), the avenue's corridor to the gate, and a margin
    inside the compound wall so the wall stands on level ground."""
    dx = max(0.0, abs(x) - 40.0)
    dy = max(0.0, -60.0 - y, y - 70.0)
    formal = math.hypot(dx, dy)
    if y < -60.0:
        formal = min(formal, max(0.0, abs(x) - 14.0))
    to_wall = min(WALL_X - abs(x), y - WALL_FRONT, WALL_BACK - y)
    if to_wall <= 0:
        return 0.0
    # And level under the helipad (a deck is laid flat), with room round it.
    pad = math.hypot(x - HELIPAD[0], y - HELIPAD[1]) - HELIPAD[2]
    return _smooth(formal / 18.0) * _smooth((to_wall - 4.0) / 14.0) * _smooth((pad - 3.0) / 12.0)


def ground_height(x, y):
    """Level in the formal core, gently rolling in the park, and a planted berm
    rising outside the compound so the horizon is trees, not a terrain edge."""
    ox = max(0.0, abs(x) - (WALL_X + 6))
    oy = max(0.0, (y - WALL_BACK - 6), (WALL_FRONT - 6) - y)
    o = math.hypot(ox, oy)
    berm = 2.6 * (1 - math.exp(-(o / 22.0) ** 2))
    return berm + 0.9 * park_swell(x, y) * park_mask(x, y)


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
    # THE POOL IS CUT INTO THE LAWN, NOT LAID ON IT. The grid used to run
    # straight under the pool terrace, so the lawn sat 20 mm below the pool's
    # water line and 1.5 m above its floor: through water at 45% alpha the pool
    # showed grass, and the tiled shell was never seen at all. Cells lying wholly
    # inside the terrace footprint are left out; the slab covers every one of
    # them except the pool opening, which is exactly the hole that was missing.
    T = TERRACE
    for j in range(N):
        for i in range(N):
            quad = [verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]]
            if all(T["x0"] <= v.co.x <= T["x1"] and T["y0"] <= v.co.y <= T["y1"] for v in quad):
                continue
            face(bm, quad, 0)
    finish("ground_plane", bm, [M["lawn"]], col, smooth_angle=60)


def build_hardscape(M, col):
    pav, kerb = new_bm(), new_bm()
    # The forecourt: a paved carriage ring round the fountain lawn.
    segs = 72
    r0, r1 = RING_R
    inner = [pav.verts.new((r0 * math.cos(2 * math.pi * k / segs), FOUNTAIN_Y + r0 * math.sin(2 * math.pi * k / segs), 0.012)) for k in range(segs)]
    outer = [pav.verts.new((r1 * math.cos(2 * math.pi * k / segs), FOUNTAIN_Y + r1 * math.sin(2 * math.pi * k / segs), 0.012)) for k in range(segs)]
    for k in range(segs):
        k2 = (k + 1) % segs
        face(pav, [inner[k], outer[k], outer[k2], inner[k2]], 0)
    kerb_prof = [(-0.08, 0.0), (0.08, 0.0), (0.08, 0.1), (-0.08, 0.1)]
    add_sweep(kerb, [(r0 * math.cos(2 * math.pi * k / segs), FOUNTAIN_Y + r0 * math.sin(2 * math.pi * k / segs)) for k in range(segs)],
              kerb_prof, closed=True, prof_closed=True)
    # THE OUTER KERB STOPS WHERE THE DRIVE RUNS THROUGH IT. It was one closed
    # circle, so a ten-centimetre kerb lay across the apron at the steps and
    # across the avenue at the far side: a drive nobody could drive (seen in the
    # approach, the refinement brief's "roads ... must feel like they inhabit
    # the same physical world"). Two arcs, east and west, each ending on the
    # straight kerb of the apron (x = 7) and of the avenue (x = 4.4).
    apron_at = math.degrees(math.acos(APRON_X / r1))
    avenue_at = math.degrees(math.acos(4.4 / r1))
    for a0, a1 in ((-avenue_at, apron_at), (180.0 - apron_at, 180.0 + avenue_at)):
        steps = max(2, int(round((a1 - a0) / 5.0)))
        arc = [math.radians(a0 + (a1 - a0) * k / steps) for k in range(steps + 1)]
        add_sweep(kerb, [(r1 * math.cos(t), FOUNTAIN_Y + r1 * math.sin(t)) for t in arc],
                  kerb_prof, closed=False, prof_closed=True)
    # Apron from the portico steps to the ring, the avenue to the gate, a walk
    # round the podium, and the rear walk to the canal. The apron runs to where
    # its own kerbs meet the ring's: it stopped 0.8 m inside the circle's top,
    # which left a wedge of lawn inside the kerbs at each corner.
    add_box(pav, -APRON_X, APRON_X, -13.0, FOUNTAIN_Y + math.sqrt(r1 * r1 - APRON_X * APRON_X), 0.0, 0.013)
    add_box(pav, -4.4, 4.4, FOUNTAIN_Y - r1 + 0.8, WALL_FRONT, 0.0, 0.013)
    add_box(pav, -17.4, 17.4, -12.2, 12.2, 0.0, 0.011)
    add_box(pav, -3.8, 3.8, 11.4, 17.6, 0.0, 0.013)
    # KERBS WHERE THE PAVING MEETS THE LAWN. Only the carriage ring had them;
    # the straight walks met the grass along a razor line with nothing between
    # (the review: "razor-sharp, unnatural edges that lack physical curbs").
    # A dressed stone kerb, 16 cm wide and 10 cm proud, on every lawn-facing
    # edge, stopping where one walk runs into another or into the ring's kerb.
    def kerb_run(x0, x1, y0, y1):
        add_box(kerb, x0, x1, y0, y1, 0.0, 0.1)
    ring_at = lambda x: math.sqrt(max(0.0, r1 * r1 - x * x))  # noqa: E731
    for s in (-1, 1):
        # the avenue, from the ring's outer kerb to the gate
        kerb_run(s * 4.4 - 0.08, s * 4.4 + 0.08, WALL_FRONT, FOUNTAIN_Y - ring_at(4.4))
        # the apron, from the ring's outer kerb to the podium walk
        kerb_run(s * APRON_X - 0.08, s * APRON_X + 0.08, FOUNTAIN_Y + ring_at(APRON_X), -12.2)
        # the rear walk, from the podium walk to the canal
        kerb_run(s * 3.8 - 0.08, s * 3.8 + 0.08, 12.2, 17.6)
    # the podium walk: its east side, and its front and back either side of the
    # apron and the rear walk. The west side is the pool terrace's.
    kerb_run(17.32, 17.48, -12.2, 12.2)
    kerb_run(TERRACE["x1"], -7.0, -12.28, -12.12)
    kerb_run(7.0, 17.48, -12.28, -12.12)
    kerb_run(TERRACE["x1"], -3.8, 12.12, 12.28)
    kerb_run(3.8, 17.48, 12.12, 12.28)
    finish("drive_forecourt", pav, [M["gravel"]], col)
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
    finish("estate_wall", bm, [M["boundary"]], col)


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


def card_tree_mesh(M, name, leaf_key, height, canopy_r, canopy_h, cards, seed, trunk_r=0.28, branches=4,
                   lobes=7, card_m=1.5):
    """A tree the way real-time foliage is built, and built to read as a tree
    rather than a lollipop.

    THE OLD CROWN was ~75 cards of 2-3 m scattered through one ellipsoid: a
    smooth blob with a leaf pattern stamped on it, which is most of what made
    the estate "look like a PS2 game". This one is grown:

      * LIMBS to LOBES. The crown is 5-9 lobes at the ends of limbs from the
        trunk top, biased to the upper and outer crown, with sky between them.
      * SMALL CARDS, MANY. `cards` cards of ~`card_m` metres - the size the
        foliage atlases were rendered at (render_foliage_v7.py), so the leaves
        read at their real size - laid on each lobe's outer shell, facing out.
      * NORMALS for soft volume: each card's normal blends its lobe's outward
        direction with the crown's, so lobes shade as lobes inside one crown.
      * OCCLUSION baked into a colour attribute: darker deep in a lobe, darker
        low in the crown, darker at the crown's core. Exported as COLOR_0 and
        multiplied into the leaf colour at runtime.
    """
    rng = random.Random(seed)
    bm = new_bm()
    occ_layer = bm.loops.layers.color.new("Col")
    trunk_top = height - canopy_h * 0.75
    add_lathe(bm, [(0.0, 0.0), (trunk_r * 1.35, 0.0), (trunk_r, 0.6), (trunk_r * 0.72, trunk_top), (0.0, trunk_top + 0.2)], 8, 0, 0, 0.0, 0)
    C = Vector((0.0, 0.0, height - canopy_h * 0.5))
    rx, rz = canopy_r, canopy_h * 0.5

    # Lobe centres on the upper/outer crown, spread by rejection so they do not
    # merge into one mass again.
    L = []
    tries = 0
    while len(L) < lobes and tries < 400:
        tries += 1
        az = rng.uniform(0, 2 * math.pi)
        el = rng.uniform(-0.25, 1.0)
        ring = math.sqrt(max(0.0, 1 - el * el))
        d = Vector((math.cos(az) * ring, math.sin(az) * ring, el))
        c = C + Vector((d.x * rx * 0.62, d.y * rx * 0.62, d.z * rz * 0.62))
        r = rng.uniform(0.3, 0.46) * (rx + rz)
        if any((c - q).length < 0.55 * (r + qr) for q, qr in L):
            continue
        L.append((c, r))
    if not L:
        L = [(C, 0.5 * (rx + rz))]
    # A central lobe fills the crown's core so it never shows sky straight through.
    L.append((C + Vector((0, 0, rz * 0.1)), 0.42 * (rx + rz)))

    base = Vector((0, 0, trunk_top - 0.3))
    for c, r in L[:-1]:
        axis = c - base
        Ln = axis.length * 0.85
        add_lathe_oriented(bm, [(0.0, 0.0), (trunk_r * 0.55, 0.0), (trunk_r * 0.2, Ln), (0.0, Ln)], 6, base,
                           axis, (0, 0, 1) if abs(axis.z) < 0.9 * axis.length else (1, 0, 0), 0)

    card_normals = []
    total_area = sum(r * r for _, r in L)
    for c, r in L:
        n_here = max(6, int(round(cards * (r * r) / total_area)))
        for i in range(n_here):
            while True:
                d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
                if 0.05 < d.length <= 1.0:
                    break
            d.normalize()
            out = (c - C)
            if out.length > 1e-3 and d.dot(out.normalized()) < -0.35 and rng.random() < 0.7:
                d = -d
            depth = rng.random() ** 1.6
            P = c + d * r * (1.0 - 0.45 * depth)
            size = card_m * rng.uniform(0.75, 1.15) * 0.5
            crown_out = (P - C)
            crown_out = crown_out.normalized() if crown_out.length > 1e-3 else Vector((0, 0, 1))
            n = (d * 0.55 + crown_out * 0.45 + Vector((rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35), rng.uniform(-0.2, 0.4)))).normalized()
            t1 = n.cross(Vector((0, 0, 1)))
            if t1.length < 1e-3:
                t1 = Vector((1, 0, 0))
            t1.normalize()
            t2 = n.cross(t1).normalized()
            rot = rng.uniform(0, 2 * math.pi)
            a1 = t1 * math.cos(rot) + t2 * math.sin(rot)
            a2 = n.cross(a1).normalized()
            corners = [P - a1 * size - a2 * size, P + a1 * size - a2 * size, P + a1 * size + a2 * size, P - a1 * size + a2 * size]
            vs = [bm.verts.new(q) for q in corners]
            f = face(bm, vs, 1)
            if f is None:
                continue
            core = (P - C)
            core_n = math.sqrt((core.x / rx) ** 2 + (core.y / rx) ** 2 + (core.z / rz) ** 2)
            height_t = max(0.0, min(1.0, (P.z - (C.z - rz)) / (2 * rz)))
            occ = (1.0 - 0.45 * depth) * (0.62 + 0.38 * height_t) * (0.72 + 0.28 * min(1.0, core_n))
            occ = max(0.28, min(1.0, occ))
            for q in corners:
                card_normals.append(((q - c).normalized() * 0.5 + n * 0.5).normalized())
            for loop in f.loops:
                loop[occ_layer] = (occ, occ, occ, 1.0)
    # bark: nearly fully lit (the colour attribute multiplies the bark too)
    for f in bm.faces:
        if f.material_index == 0:
            for loop in f.loops:
                loop[occ_layer] = (0.85, 0.85, 0.85, 1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    try:
        me.color_attributes.active_color = me.color_attributes["Col"]
    except Exception:
        pass
    uvl = me.uv_layers.new(name="UVMap")
    loop_normals = []
    ci = 0
    quad_uv = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    for p in me.polygons:
        p.use_smooth = True
        if p.material_index == 1:
            for k, li in enumerate(p.loop_indices):
                uvl.data[li].uv = quad_uv[k % 4]
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


def scatter(col, me, name, points, shape=0.0):
    """One object per point, all sharing `me`. `shape` is how far each tree's
    proportions may leave the mesh's own (0.12: a crown up to 12% wider or
    narrower one way than the other, a trunk up to 12% taller or shorter):
    the paid audit of 2026-10-04, pass 3, "vegetation repetition" - a belt of
    three meshes, turned and sized but never re-proportioned, is three trees."""
    parent = bpy.data.objects.new(name, None)
    col.objects.link(parent)
    jr = random.Random(zlib.crc32(name.encode()))
    for i, (x, y, rot, s) in enumerate(points):
        ob = bpy.data.objects.new(f"{name}_{i:03d}", me)
        col.objects.link(ob)
        ob.location = (x, y, ground_height(x, y) - 0.05)
        ob.rotation_euler = (0, 0, rot)
        if shape:
            ob.scale = (s * (1 + jr.uniform(-shape, shape)), s * (1 + jr.uniform(-shape, shape)),
                        s * (1 + jr.uniform(-shape, shape * 1.4)))
        else:
            ob.scale = (s, s, s)
        ob.parent = parent
    return parent


TRIPO_LIB = "C:/dev/Blender/_tripo/tripo_web.blend"


def tripo_mesh(key, lod=None):
    """A mesh of one of the client's generated models (Tripo; sized, lightened
    and filed by tools/blender/tripo_assets_v7.py), or None when the library or
    the model is not there: the build never depends on one having been
    generated. `lod` asks for a lighter copy the library keeps (tripo_<key>_
    <lod>) and takes the full one if it has none."""
    if not os.path.exists(TRIPO_LIB):
        return None
    base = "tripo_" + key
    wanted = [base + "_" + lod, base] if lod else [base]
    missing = [m for m in wanted if m not in bpy.data.meshes]
    if missing:
        with bpy.data.libraries.load(TRIPO_LIB, link=False) as (src, dst):
            dst.meshes = [m for m in missing if m in src.meshes]
    name = next((m for m in wanted if m in bpy.data.meshes), None)
    return bpy.data.meshes[name] if name else None


PH_TREES = ("rain", "mango", "neem")
PH_LIB = "C:/dev/Blender/_polyhaven/ph_trees_web.blend"


def ph_tree(M, key):
    """A shade tree made from a Poly Haven scan (tools/blender/ph_trees_v7.py),
    or None when the library or its textures are not there — the procedural
    card_tree_mesh stands in, so the build never depends on a download."""
    name = f"ph_tree_{key}"
    if "bark_" + key not in M or not os.path.exists(PH_LIB):
        return None
    if name not in bpy.data.meshes:
        with bpy.data.libraries.load(PH_LIB, link=False) as (src, dst):
            if name not in src.meshes:
                return None
            dst.meshes = [name]
    me = bpy.data.meshes[name]
    me.materials[0] = M["bark_" + key]
    me.materials[1] = M["leaf_" + key]
    return me


def build_vegetation(M, col):
    rng = random.Random(11)
    # FOUR royal palms, not two, at different heights and with the slight lean
    # a real palm grows with (the review: "perfectly spaced, rigid arrays ...
    # copy-paste cloning"). The avenue stays an allee; its trees stop being
    # one tree.
    royal = [make_palm(M, f"palm_royal_{k}", h, lean, 30 + k)
             for k, (h, lean) in enumerate(((13.0, 0.25), (14.5, -0.3), (12.2, 0.45), (15.4, -0.18)))]
    coco = [make_palm(M, f"palm_coconut_{k}", h, lean, 50 + k) for k, (h, lean) in enumerate(((9.5, 1.4), (11.0, -1.1)))]
    # Cards per crown and card size are set so a card's leaves read at their
    # rendered size (a ~1.1 m cluster) and the crown is covered with sky
    # between its lobes. The shade trees are the belt: ~180 of them, most far.
    # The shade trees: from the scans where they have been made (the review:
    # "repetitive, cloned 3D assets ... flat, 2D cutouts"), from the recipe
    # otherwise.
    rain = ph_tree(M, "rain") or card_tree_mesh(M, "tree_rain", "rain", 12.0, 7.5, 5.0, 300, 70, trunk_r=0.45, lobes=8, card_m=1.9)
    mango = ph_tree(M, "mango") or card_tree_mesh(M, "tree_mango", "mango", 10.5, 5.0, 6.5, 300, 71, trunk_r=0.36, lobes=7, card_m=1.6)
    neem = ph_tree(M, "neem") or card_tree_mesh(M, "tree_neem", "rain", 13.5, 5.5, 7.0, 280, 72, trunk_r=0.34, lobes=7, card_m=1.7)
    frangi = card_tree_mesh(M, "tree_frangipani", "frangipani", 4.8, 2.7, 2.4, 90, 90, trunk_r=0.16, lobes=5, card_m=1.1)
    bloom = card_tree_mesh(M, "shrub_bougainvillea", "bougainvillea", 1.7, 1.3, 1.3, 40, 95, trunk_r=0.05, lobes=3, card_m=0.75)

    avenue = []
    for k in range(18):
        for sx in (-1, 1):
            # A hand's width off the line and up to 0.7 m along it: planted by
            # people with a line and a tape, not placed by a script.
            y = FOUNTAIN_Y - 17.0 - 9.5 * k + rng.uniform(-0.7, 0.7)
            x = sx * AVENUE_X + rng.uniform(-0.3, 0.3)
            avenue.append((x, y, rng.uniform(0, 6.28), rng.uniform(0.88, 1.1)))
    # Each palm a variant chosen at random rather than alternating, so no
    # rhythm of two repeats down the avenue.
    buckets = [[] for _ in royal]
    for a in avenue:
        buckets[rng.randrange(len(royal))].append(a)
    # The client's own royal palm down the drive too, where it has been made
    # (its lighter `avenue` copy: tools/blender/tripo_assets_v7.py): the
    # scripted palm it replaces was a pale pole under a tuft, thirty-six times.
    t_avenue = tripo_mesh("palm_royal", "avenue")
    if t_avenue is not None and t_avenue.name.endswith("_avenue"):
        # One mesh, so each tree's own turn and height (12.3 to 15.4 m, as the
        # four scripted ones ran) is what tells it from its neighbour.
        scatter(col, t_avenue, "veg_palm_avenue", avenue)
    else:
        for k, b in enumerate(buckets):
            if b:
                scatter(col, royal[k], "veg_palm_avenue" + ("" if k == 0 else f"_{'bcd'[k - 1]}"), b)
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
        # AND clear of the hero's own sight line. The hero stands at
        # (-32, -49.6) looking at the house, and a 16.5 m royal palm at
        # (-17, -34.5) is 24 m from that lens and 20 degrees off its axis: it
        # laid a frond straight across the facade and softened the one frame the
        # whole page is judged on. Measured against estateBounds, this is the
        # only planting inside the hero cone; the mirrored palm on the east side
        # is 50 m away behind the building and stays.
        if x < -6.0 and y > -48.0:
            continue
        ring.append((x, y, rng.uniform(0, 6.28), rng.uniform(0.95, 1.05)))
    # THE PALMS THE FILM PASSES NEAR ARE THE CLIENT'S GENERATED ONES, where
    # they have been made (the refinement brief, 2026-10-03: "trees, palms,
    # roads, cars ... must feel like they inhabit the same physical world as
    # the architecture"; the scripted palm is a white pole and a fan of cards,
    # and in the hero it stands twenty-five metres from the lens). The forecourt's
    # royals, and the coconut groves - at full weight flanking the forecourt,
    # where the hero and the approach look across them, lighter in the groves
    # behind the house and down the drive. The avenue and the belt beyond the
    # wall, seen from eighty metres and more, keep the scripted palm: a
    # generated one is solid leaf, eight thousand triangles a crown.
    t_royal = tripo_mesh("palm_royal")
    t_coco = tripo_mesh("palm_coconut")
    t_coco_far = tripo_mesh("palm_coconut", "far")
    scatter(col, t_royal or royal[1], "veg_palm_forecourt", ring)
    near, far = [], []
    # Groves stand off the camera's orbit: flanking the forecourt well out,
    # at the back corners of the house, behind the canal, and down the drive.
    for cx, cy, n in ((-56, -40, 5), (56, -40, 5), (-46, 30, 6), (46, 30, 6), (-26, 70, 4), (26, 70, 4), (-55, -75, 5), (55, -75, 5)):
        for i in range(n):
            (near if cy == -40 else far).append(
                (cx + rng.uniform(-7, 7), cy + rng.uniform(-7, 7), rng.uniform(0, 6.28), rng.uniform(0.85, 1.15)))
    if t_coco is not None:
        scatter(col, t_coco, "veg_palm_coconut", near)
        scatter(col, t_coco_far or t_coco, "veg_palm_coconut_b", far)
    else:
        groves = near + far
        scatter(col, coco[0], "veg_palm_coconut", groves[0::2])
        scatter(col, coco[1], "veg_palm_coconut_b", groves[1::2])
    fr = [(sx * 12.5, 20 + 7.5 * k, rng.uniform(0, 6.28), rng.uniform(0.9, 1.1)) for k in range(6) for sx in (-1, 1)]
    fr += [(sx * 20.5, -40.0 - 7 * k, rng.uniform(0, 6.28), 1.0) for k in range(3) for sx in (-1, 1)]
    # THE GARDEN'S SMALL TREES ARE SCANNED TOO (the paid audit, pass 3: "the
    # trees closest to camera are particularly important. Those are the ones
    # that must withstand scrutiny"). The frangipani was the last procedural
    # tree in the garden - ninety cards on five lobes, a cream blossom painted
    # on each - and the revolution passes twenty metres over the canal's row of
    # them: a row of spotted pom-poms. A young mango from the same scan as the
    # belt's, two-fifths grown, is a real tree's branching and leaf at the
    # size of an ornamental one. The frangipani stands in where the scans
    # have not been made.
    small = ph_tree(M, "mango")
    if small is not None:
        srng = random.Random(23)
        scatter(col, small, "veg_tree_garden", [(x, y, r, srng.uniform(0.36, 0.5)) for x, y, r, _ in fr], shape=0.1)
    else:
        scatter(col, frangi, "veg_frangipani", fr)
    # Bougainvillea in the parterre beds.
    sh = []
    for sx in (-1, 1):
        for bx in (sx * 23.0, sx * 31.0):
            for by in (-31.0, -21.0):
                for j in range(3):
                    sh.append((bx + rng.uniform(-2.2, 2.2), by + rng.uniform(-2.5, 2.5), rng.uniform(0, 6.28), rng.uniform(0.8, 1.05)))
    # And the new beds: colour against the stone at the foot of the house, and
    # roses in the west parterre's quadrants.
    for sx in (-1, 1):
        for k in range(9):
            sh.append((sx * (15.3 + rng.uniform(-1.2, 1.2)), -10.6 + 2.6 * k, rng.uniform(0, 6.28), rng.uniform(0.7, 0.95)))
        for k in range(3):
            sh.append((sx * (9.0 + 1.5 * k), -10.2 + rng.uniform(-0.8, 0.8), rng.uniform(0, 6.28), rng.uniform(0.7, 0.9)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            for k in range(3):
                sh.append((-26.5 + sx * rng.uniform(2.4, 6.2), -25.0 + sy * rng.uniform(2.4, 5.6),
                           rng.uniform(0, 6.28), rng.uniform(0.6, 0.85)))
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
        # (0.85 to 1.3 until the paid audit: a wider spread of ages, a few
        # young trees among the old.)
        belt.append((x, y, rng.uniform(0, 6.28), rng.choice((rng.uniform(0.62, 0.85), rng.uniform(0.85, 1.3), rng.uniform(0.85, 1.3), rng.uniform(1.0, 1.42)))))
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
    scatter(col, rain, "veg_tree_rain", allt[0::3], shape=0.13)
    scatter(col, mango, "veg_tree_mango", allt[1::3], shape=0.13)
    scatter(col, neem, "veg_tree_neem", allt[2::3], shape=0.13)
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
                # A CLIPPED YEW, not a cone (the refinement brief, 2026-10-03:
                # "planting is cones and red masses"). The first was a
                # straight-sided lathe run to a needle's point, which is a
                # traffic cone painted green. Topiary is cut by hand to a
                # template: full at the foot, its sides a shallow curve, and
                # the top rounded off where the shears turn.
                add_lathe(hedge, [(0.0, 0.0), (0.43, 0.0), (0.47, 0.16), (0.46, 0.42), (0.41, 0.78), (0.33, 1.14),
                                  (0.23, 1.48), (0.13, 1.74), (0.06, 1.88), (0.0, 1.93)], 20, s * x, y, PODIUM_Z + 0.6)
    # Flower beds of bougainvillea colour in the parterres are shrubs (see veg).
    finish("garden_hedges", hedge, [M["hedge"]], col)
    finish("garden_beds", soil, [M["soil"]], col)
    finish("garden_planters", planters, [M["trim"]], col)


# ---------------------------------------------------------------------------
# THE LUXURY PROGRAMME
# ---------------------------------------------------------------------------
# The client review, in one line: "this nowhere looks like a 50L build". What
# was missing was not polygons on the house — it was everything a house like
# this is BOUGHT with. So the west lawn becomes a pool terrace, the rear lawn
# gets a helipad, the forecourt gets cars in it, the podium gets its balustrade,
# and the whole estate gets fixtures that light at dusk.
#
# Everything here is placed against the film: the hero stands at Blender
# (-32, -43, 25) looking at the house, which puts the WEST flank and the front
# across the frame — so the pool terrace is west, where the hero and the quarter
# beat both hold it, and the helipad is north-west, where the crane finds it.
TERRACE = {"x0": -36.0, "x1": -17.0, "y0": -12.6, "y1": 12.6, "top": 0.5}
POOL = {"x0": -32.8, "x1": -21.4, "y0": -6.6, "y1": 6.6,
        "water": 0.455, "floor": -1.55, "catch": -34.3}
HELIPAD = (-56.0, 34.0, 9.0)


def pool_terrace(M, col):
    """A terrace, an infinity pool, a glass rail, a cabana and the furniture that
    says someone lives here."""
    T, P = TERRACE, POOL
    stone, coping, shell, water, glass, steel, teak, fabric, lamp = (new_bm() for _ in range(9))
    top, wl = T["top"], P["water"]

    # The slab, as a ring round the pool opening so no boolean is needed.
    add_box(stone, T["x0"], P["catch"], T["y0"], T["y1"], 0.0, top)
    add_box(stone, P["x1"], T["x1"], T["y0"], T["y1"], 0.0, top)
    add_box(stone, P["catch"], P["x1"], T["y0"], P["y0"], 0.0, top)
    add_box(stone, P["catch"], P["x1"], P["y1"], T["y1"], 0.0, top)
    # Steps down to the lawn on the south edge, and a second flight west.
    for k in range(3):
        add_box(stone, -29.0, -23.0, T["y0"] - 0.42 * (k + 1), T["y0"] - 0.42 * k, 0.0, top - 0.167 * (k + 1))
    # The pool box: walls from the coping down to the floor.
    add_box(shell, P["x0"], P["x1"], P["y0"], P["y1"], P["floor"] - 0.12, P["floor"])
    for x0, x1, y0, y1 in ((P["x0"] - 0.3, P["x0"], P["y0"], P["y1"]),
                           (P["x1"], P["x1"] + 0.3, P["y0"], P["y1"]),
                           (P["x0"] - 0.3, P["x1"] + 0.3, P["y0"] - 0.3, P["y0"]),
                           (P["x0"] - 0.3, P["x1"] + 0.3, P["y1"], P["y1"] + 0.3)):
        add_box(shell, x0, x1, y0, y1, P["floor"] - 0.12, wl - 0.02)
    # THE INFINITY EDGE. The west lip stands exactly at water level and the
    # water sheet runs over it into a catch basin a metre below — which is the
    # one detail that makes a pool read as expensive rather than as a tank.
    add_box(shell, P["catch"], P["x0"], P["y0"] - 0.3, P["y1"] + 0.3, -0.62, -0.5)
    add_box(shell, P["catch"] - 0.25, P["catch"], P["y0"] - 0.3, P["y1"] + 0.3, -0.62, top)
    # Coping on the three sides that are not the spill.
    for x0, x1, y0, y1 in ((P["x1"], P["x1"] + 0.45, P["y0"] - 0.45, P["y1"] + 0.45),
                           (P["x0"] - 0.1, P["x1"] + 0.45, P["y0"] - 0.45, P["y0"]),
                           (P["x0"] - 0.1, P["x1"] + 0.45, P["y1"], P["y1"] + 0.45)):
        add_box(coping, x0, x1, y0, y1, top - 0.06, top + 0.02)
    # Water: the pool sheet, the spill face, and the catch basin below it.
    add_box(water, P["x0"] - 0.02, P["x1"], P["y0"], P["y1"], wl - 0.02, wl)
    add_box(water, P["x0"] - 0.06, P["x0"] - 0.02, P["y0"], P["y1"], -0.45, wl)
    add_box(water, P["catch"] + 0.02, P["x0"], P["y0"] - 0.2, P["y1"] + 0.2, -0.5, -0.42)
    # Underwater lights: two runs in the long walls.
    for y in (-4.4, -1.5, 1.5, 4.4):
        for x, d in ((P["x0"] + 0.02, -1), (P["x1"] - 0.02, 1)):
            add_box(lamp, x - 0.02 - 0.06 * (d > 0), x + 0.02 + 0.06 * (d < 0), y - 0.34, y + 0.34, wl - 0.62, wl - 0.38)
    # Glass balustrade along the west edge and returns along north and south.
    rails = [((T["x0"] + 0.2, T["y0"] + 0.2), (T["x0"] + 0.2, T["y1"] - 0.2)),
             ((T["x0"] + 0.2, T["y0"] + 0.2), (-24.0, T["y0"] + 0.2)),
             ((T["x0"] + 0.2, T["y1"] - 0.2), (-19.0, T["y1"] - 0.2))]
    for (ax, ay), (bx, by) in rails:
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        px, py = -uy, ux
        n = max(2, int(round(L / 1.7)))
        for k in range(n + 1):
            cx, cy = ax + ux * L * k / n, ay + uy * L * k / n
            add_box(steel, cx - 0.045, cx + 0.045, cy - 0.045, cy + 0.045, top, top + 1.06)
        # the glass, inset between the posts, and a steel handrail over it
        for k in range(n):
            t0, t1 = L * k / n + 0.07, L * (k + 1) / n - 0.07
            add_oriented_box(glass, Vector((ax, ay, 0)), Vector((ux, uy, 0)), Vector((px, py, 0)),
                             t0, t1, top + 0.06, top + 0.98, -0.009, 0.009)
        add_oriented_box(steel, Vector((ax, ay, 0)), Vector((ux, uy, 0)), Vector((px, py, 0)),
                         -0.05, L + 0.05, top + 1.02, top + 1.08, -0.05, 0.05)
    # Sun loungers and parasols on the east deck, facing the water.
    #
    # AS PEOPLE LEAVE THEM, not as a catalogue sets them. The review: "cloned
    # in a mathematically perfect straight line, which breaks organic realism".
    # Five loungers in two pairs and a single, each pair turned a few degrees
    # toward the other, set a hand's width off the line, and the backrests at
    # different rakes — one laid flat by someone who was lying in the sun.
    lrng = random.Random(41)
    loungers = ((-5.35, -4.0, 0.62), (-2.75, 3.5, 0.5), (0.35, 0.0, 0.62), (2.65, -3.0, 0.3), (5.3, 5.0, 0.62))
    for y0, yaw_deg, back in loungers:
        x = -19.3 + lrng.uniform(-0.14, 0.14)
        y = y0 + lrng.uniform(-0.12, 0.12)
        yaw = math.radians(yaw_deg + lrng.uniform(-1.5, 1.5))
        U = Vector((math.cos(yaw), math.sin(yaw), 0.0))
        V = Vector((-math.sin(yaw), math.cos(yaw), 0.0))
        O = Vector((x, y, 0.0))
        add_oriented_box(teak, O, U, V, -0.95, 0.95, top + 0.1, top + 0.16, -0.34, 0.34)
        for su in (-0.9, 0.9):
            for sv in (-0.3, 0.3):
                add_oriented_box(teak, O + U * su + V * sv, U, V, -0.04, 0.04, top, top + 0.12, -0.04, 0.04)
        add_oriented_box(fabric, O, U, V, -0.92, 0.5, top + 0.16, top + 0.24, -0.32, 0.32)
        # the backrest, at this lounger's rake
        add_prism(fabric, [(0.5, top + 0.16), (0.92, top + 0.16), (0.92, top + back), (0.5 + 0.12 * (back - 0.16) / 0.46, top + back)],
                  O, U, V, -0.32, 0.32)
    for y in (-3.9, 3.9):
        x = -17.9
        add_box(steel, x - 0.045, x + 0.045, y - 0.045, y + 0.045, top, top + 2.4)
        add_lathe(fabric, [(0.0, 0.0), (1.55, -0.42), (1.62, -0.5)], 12, x, y, top + 2.36)
    # The day bed at the north end. (It stood under a cabana: six square
    # posts and a slab, the one thing on the terrace nobody would have built.
    # The paid audit of 2026-10-04, pass 2: "what can be removed from frame?"
    # It is gone; the bed is what a terrace like this has.)
    cx0, cx1, cy0, cy1 = -31.0, -22.6, 8.4, 12.1
    add_box(teak, cx0 + 1.2, cx1 - 1.2, cy1 - 1.9, cy1 - 0.7, top, top + 0.42)
    add_box(fabric, cx0 + 1.2, cx1 - 1.2, cy1 - 1.9, cy1 - 0.7, top + 0.42, top + 0.58)
    add_box(fabric, cx0 + 1.2, cx1 - 1.2, cy1 - 0.82, cy1 - 0.7, top + 0.58, top + 1.02)
    # Deck bollards along the terrace walk.
    for y in (-10.4, -7.4, 7.4, 10.4):
        for x in (-34.4, -18.4):
            add_box(steel, x - 0.07, x + 0.07, y - 0.07, y + 0.07, top, top + 0.62)
            add_box(lamp, x - 0.09, x + 0.09, y - 0.09, y + 0.09, top + 0.62, top + 0.74)
    finish("pool_terrace", stone, [M["terrace"]], col)
    finish("pool_coping", coping, [M["trim"]], col)
    finish("pool_shell", shell, [M["pool"]], col)
    finish("pool_water", water, [M["poolwater"]], col, smooth_angle=60)
    finish("pool_rail_glass", glass, [M["railglass"]], col)
    finish("pool_rail_steel", steel, [M["steel"]], col, smooth_angle=50)
    finish("pool_furniture_teak", teak, [M["teak"]], col)
    finish("pool_furniture_fabric", fabric, [M["fabric"]], col, smooth_angle=50)
    finish("pool_lights", lamp, [M["poollamp"]], col)


def helipad(M, col):
    """A pad on the north-west lawn, which the crane beat looks straight down
    on. Painted ring, H, perimeter lights, windsock."""
    cx, cy, r = HELIPAD
    deck, paint, lamp, steel = new_bm(), new_bm(), new_bm(), new_bm()
    add_lathe(deck, [(0.0, 0.0), (r, 0.0), (r, 0.16), (0.0, 0.16)], 64, cx, cy, 0.0)
    # ring
    segs = 64
    for k in range(segs):
        a0, a1 = 2 * math.pi * k / segs, 2 * math.pi * (k + 1) / segs
        for r0, r1 in ((r - 1.5, r - 1.1),):
            p = [(cx + r0 * math.cos(a0), cy + r0 * math.sin(a0)), (cx + r1 * math.cos(a0), cy + r1 * math.sin(a0)),
                 (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1)), (cx + r0 * math.cos(a1), cy + r0 * math.sin(a1))]
            vs = [paint.verts.new((x, y, 0.17)) for x, y in p]
            face(paint, vs, 0)
    for x0, x1, y0, y1 in ((-2.1, -1.5, -2.6, 2.6), (1.5, 2.1, -2.6, 2.6), (-2.1, 2.1, -0.32, 0.32)):
        add_box(paint, cx + x0, cx + x1, cy + y0, cy + y1, 0.16, 0.175)
    for k in range(12):
        a = 2 * math.pi * k / 12
        x, y = cx + (r + 0.9) * math.cos(a), cy + (r + 0.9) * math.sin(a)
        add_box(steel, x - 0.08, x + 0.08, y - 0.08, y + 0.08, 0.0, 0.3)
        add_box(lamp, x - 0.1, x + 0.1, y - 0.1, y + 0.1, 0.3, 0.42)
    # A windsock: the mast, and the sleeve streaming off its head, which is the
    # one prop that says an aircraft is expected here rather than parked.
    wx, wy = cx + r + 3.4, cy - r + 1.0
    add_box(steel, wx - 0.07, wx + 0.07, wy - 0.07, wy + 0.07, 0.0, 4.6)
    add_lathe_oriented(paint, [(0.44, 0.0), (0.44, 0.12), (0.24, 1.55), (0.24, 1.7)], 14,
                       Vector((wx, wy, 4.42)), Vector((0.82, 0.52, -0.24)), Vector((0, 0, 1)))
    finish("helipad_deck", deck, [M["tarmac"]], col)
    finish("helipad_paint", paint, [M["paint"]], col)
    finish("helipad_lights", lamp, [M["lamp"]], col)
    finish("helipad_steel", steel, [M["steel"]], col, smooth_angle=50)


def car(body, glassbm, chrome, cx, cy, rot, L=4.92, W=1.96):
    """A car in silhouette, built the way a car is drawn: one SIDE PROFILE
    extruded across the body, a narrower glasshouse on top of it, and four
    wheels standing proud of both.

    The first version stacked boxes and put the wheels inside the body, which at
    forty metres is a black slab on a drive. Proportion is the whole job here —
    nothing at this distance reads as a car except a bonnet line, a roof that
    sits inboard, and wheels you can see under the sills."""
    c, s_ = math.cos(rot), math.sin(rot)
    O = Vector((cx, cy, 0.0))
    U = Vector((c, s_, 0.0))          # along the car
    Nv = Vector((-s_, c, 0.0))        # across it
    h, w = L / 4.92, W / 1.96

    # The side profile, nose to tail, in (x, z).
    lower = [(-L / 2, 0.52 * h), (-L / 2 + 0.16, 0.36 * h), (-L / 2 + 0.62, 0.30 * h),
             (L / 2 - 0.62, 0.30 * h), (L / 2 - 0.14, 0.38 * h), (L / 2, 0.62 * h),
             (L / 2 - 0.1, 0.92 * h), (L / 2 - 1.42, 1.02 * h), (-L / 2 + 1.32, 1.02 * h),
             (-L / 2 + 0.24, 0.88 * h)]
    add_prism(body, lower, O, U, Nv, -W / 2, W / 2)
    # The glasshouse: raked screens, inboard of the body by 90 mm a side.
    house = [(-L / 2 + 1.36, 1.0 * h), (-L / 2 + 2.08, 1.46 * h), (L / 2 - 2.05, 1.46 * h),
             (L / 2 - 1.38, 1.0 * h)]
    add_prism(glassbm, house, O, U, Nv, -W / 2 + 0.09, W / 2 - 0.09)
    roof = [(-L / 2 + 2.02, 1.44 * h), (-L / 2 + 2.12, 1.5 * h), (L / 2 - 2.09, 1.5 * h),
            (L / 2 - 2.12, 1.44 * h)]
    add_prism(body, roof, O, U, Nv, -W / 2 + 0.1, W / 2 - 0.1)
    # A waist line and a sill strip, which is where a car catches the light.
    for d in (-W / 2 - 0.012, W / 2 - 0.008):
        add_oriented_box(chrome, O, U, Nv, -L / 2 + 0.5, L / 2 - 0.5, 0.94 * h, 1.0 * h, d, d + 0.02)
        add_oriented_box(chrome, O, U, Nv, -L / 2 + 1.1, L / 2 - 1.1, 0.3 * h, 0.36 * h, d, d + 0.02)
    # Lamps: a bar at each end, which at dusk is what the eye finds first.
    add_oriented_box(chrome, O, U, Nv, L / 2 - 0.08, L / 2 + 0.02, 0.62 * h, 0.78 * h, -W / 2 + 0.22, W / 2 - 0.22)
    add_oriented_box(chrome, O, U, Nv, -L / 2 - 0.02, -L / 2 + 0.08, 0.66 * h, 0.8 * h, -W / 2 + 0.26, W / 2 - 0.26)
    # Four wheels, outboard of the sills so the car stands on them.
    for ax in (L / 2 - 1.18, -L / 2 + 1.28):
        for sy in (-1, 1):
            hub = O + U * ax + Nv * (sy * (W / 2 - 0.06))
            hub.z = 0.37 * h
            prof = [(0.0, -0.115 * w), (0.2, -0.13 * w), (0.37 * h, -0.115 * w),
                    (0.37 * h, 0.115 * w), (0.2, 0.13 * w), (0.0, 0.115 * w)]
            add_lathe_oriented(chrome, prof, 18, hub, Nv * sy, Vector((0, 0, 1)))


# The drive's own level (build_hardscape lays the ring at 12 mm).
DRIVE_Z = 0.012


def tripo_object(key, name, col, x, y, rot, z=DRIVE_Z, far=False):
    """One of the client's generated models (Tripo; sized, lightened and filed
    by tools/blender/tripo_assets_v7.py), stood at (x, y) and turned so its nose
    points the way the scripted car's did. None when the library or the model
    is not there: the build never depends on one having been generated.

    Placed twice, a model is one mesh and two objects - the exporter writes the
    geometry and its textures once. `far` asks for the lighter copy the library
    keeps for a car no camera comes near (and takes the full one if it has
    none)."""
    me = tripo_mesh(key, "far" if far else None)
    if me is None:
        return None
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    ob.location = (x, y, z)
    # The library's models face -y; car() draws its nose at -U, U being
    # (cos rot, sin rot).
    ob.rotation_euler = (0, 0, rot - math.pi / 2)
    return ob


def ring_berth(theta, radius=None):
    """A berth on the carriage ring: along its outer kerb at `theta` round the
    fountain (degrees from east, anticlockwise), nose the way a ring is driven
    where traffic keeps left - clockwise, the kerb on the driver's left. The
    scripted cars stood ACROSS the carriageway, nose to the fountain lawn, which
    is how nobody leaves a car on a drive six metres wide."""
    t = math.radians(theta)
    r = radius if radius is not None else RING_R[1] - 1.6
    # car() and tripo_object() put the nose at -U, U = (cos rot, sin rot); the
    # clockwise tangent is (sin t, -cos t).
    return r * math.cos(t), FOUNTAIN_Y + r * math.sin(t), math.atan2(math.cos(t), -math.sin(t))


def motor_court(M, col):
    """Two on the carriage ring either side of the axis, one at the steps.

    From the generated models where they have been made (the refinement brief,
    2026-10-03: the cars "must feel like they inhabit the same physical world as
    the architecture"; its audits read the scripted one as a block): a saloon
    waiting at the steps and another across the ring, and a coupe of an older
    decade opposite it. The scripted silhouette stands in for whichever is
    missing."""
    body, bodyp, glassbm, chrome = new_bm(), new_bm(), new_bm(), new_bm()
    places = (
        # arriving, up the west side; leaving, down the east
        ("car_saloon", "court_car_saloon_ring", body, *ring_berth(174.0), {"far": True}),
        ("car_classic", "court_car_classic", bodyp, *ring_berth(-8.0), {"far": True}),
        # At the steps: on the apron's east edge, nose out, clear of the stair's
        # pedestal behind it (y -13.25) and of the kerb beside it (x 6.92). It
        # stood at (6.4, -14.6): its tail in the podium wall, a wheel on the
        # lawn.
        ("car_saloon", "court_car_saloon_steps", body, 5.4, -16.6, math.radians(92), {"L": 5.15, "W": 2.02}),
    )
    for key, name, paint, x, y, rot, opts in places:
        size = {k: v for k, v in opts.items() if k in ("L", "W")}
        if tripo_object(key, name, col, x, y, rot, far=opts.get("far", False)) is None:
            car(paint, glassbm, chrome, x, y, rot, **size)
    for name, bm, mat, angle in (("court_car_dark", body, "carpaint", 48), ("court_car_pale", bodyp, "carpaint2", 48),
                                 ("court_car_glass", glassbm, "carglass", 48), ("court_car_chrome", chrome, "chrome", 55)):
        if bm.verts:
            finish(name, bm, [M[mat]], col, smooth_angle=angle)
        else:
            bm.free()


def podium_balustrade(M, col, gold_bm):
    """The podium walk gets the same balustrade the roof has, which is what ties
    the house to its terrace instead of letting it stand on a slab."""
    bm = new_bm()
    x, y, z = 17.4, 12.2, PODIUM_Z
    runs = [((-x, -y), (-x, y)), ((x, -y), (x, y)), ((-x, y), (x, y)),
            ((-x, -y), (-7.6, -y)), ((7.6, -y), (x, -y))]
    for a, b in runs:
        balustrade_run(bm, a, b, z, 1.02, die_w=0.62, spacing=0.34, segs=8)
    for sx in (-1, 1):
        for sy in (-1, 1):
            add_lathe(gold_bm, [(r * 0.85, zz * 0.85) for r, zz in URN], 20, sx * x, sy * y, z + 1.14)
    finish("podium_balustrade", bm, [M["trim"]], col)


def estate_lighting(M, col):
    """Uplights on the facade and lanterns down the avenue: at dusk they are the
    difference between a model and a place."""
    steel, lamp = new_bm(), new_bm()
    for sx in (-1, 1):
        for x in (3.4, 7.0, 10.6):
            add_box(lamp, sx * x - 0.16, sx * x + 0.16, -HD - 0.34, -HD - 0.06, 0.02, 0.1)
        for y in (-6.0, 0.0, 6.0):
            add_box(lamp, sx * (HW + 0.06), sx * (HW + 0.34), y - 0.16, y + 0.16, 0.02, 0.1)
    for k in range(9):
        y = -44.0 - k * 17.0
        for sx in (-1, 1):
            x = sx * (AVENUE_X + 2.6)
            add_box(steel, x - 0.08, x + 0.08, y - 0.08, y + 0.08, 0.0, 1.05)
            add_lathe(lamp, [(0.0, 0.0), (0.2, 0.06), (0.17, 0.34), (0.0, 0.4)], 8, x, y, 1.05)
    finish("estate_light_posts", steel, [M["steel"]], col, smooth_angle=50)
    finish("estate_lamps", lamp, [M["lamp"]], col, smooth_angle=50)


def west_parterre(M, col):
    """A formal garden between the pool terrace and the drive.

    THE HERO'S FOREGROUND WAS EMPTY. From (-32, -49.6) the left third of frame
    is lawn all the way from the pool terrace to the bottom of the picture, and
    an unbroken field of grass is the cheapest surface in any architectural
    photograph. A parterre is what actually goes there on an estate like this —
    clipped box in a pattern, a gravel walk round it, standard roses on the
    cross axes — and it reads at 40 m as detail rather than as decoration."""
    hedge, gravel, kerb, stone = new_bm(), new_bm(), new_bm(), new_bm()
    cx, cy = -26.5, -25.0
    hw, hd = 9.0, 8.0
    add_box(gravel, cx - hw, cx + hw, cy - hd, cy + hd, 0.0, 0.02)
    # The kerb, and a hedge inside it.
    for x0, x1, y0, y1 in ((cx - hw, cx + hw, cy - hd, cy - hd + 0.24),
                           (cx - hw, cx + hw, cy + hd - 0.24, cy + hd),
                           (cx - hw, cx - hw + 0.24, cy - hd, cy + hd),
                           (cx + hw - 0.24, cx + hw, cy - hd, cy + hd)):
        add_box(kerb, x0, x1, y0, y1, 0.0, 0.12)
    # Four quadrants of clipped box, with a walk on both axes.
    for sx in (-1, 1):
        for sy in (-1, 1):
            qx0, qx1 = sorted((cx + sx * 1.1, cx + sx * (hw - 1.1)))
            qy0, qy1 = sorted((cy + sy * 1.1, cy + sy * (hd - 1.1)))
            for a0, a1, b0, b1 in ((qx0, qx1, qy0, qy0 + 0.42), (qx0, qx1, qy1 - 0.42, qy1),
                                   (qx0, qx0 + 0.42, qy0, qy1), (qx1 - 0.42, qx1, qy0, qy1)):
                add_box(hedge, a0, a1, b0, b1, 0.0, 0.52)
            # a cone in the middle of each quadrant
            add_lathe(hedge, [(0.0, 0.0), (0.62, 0.0), (0.56, 0.4), (0.0, 2.3)], 14,
                      (qx0 + qx1) / 2, (qy0 + qy1) / 2, 0.0)
    # A stone urn on a plinth at the centre, on the cross of the walks.
    add_box(stone, cx - 0.62, cx + 0.62, cy - 0.62, cy + 0.62, 0.0, 0.72)
    add_lathe(stone, [(r * 1.5, zz * 1.5) for r, zz in URN], 24, cx, cy, 0.72)
    finish("parterre_gravel", gravel, [M["gravel"]], col)
    finish("parterre_kerb", kerb, [M["trim"]], col)
    finish("parterre_hedge", hedge, [M["hedge"]], col)
    finish("parterre_urn", stone, [M["trim"]], col)


def podium_beds(M, col):
    """Flowering beds along the foot of the house, which is where a garden of
    this kind puts its colour: against the stone, where it reads."""
    soil = new_bm()
    for sx in (-1, 1):
        add_box(soil, sx * 13.4, sx * 17.2, -11.6, 11.6, 0.0, 0.1)
    add_box(soil, -13.0, -8.2, -11.9, -8.6, 0.0, 0.1)
    add_box(soil, 8.2, 13.0, -11.9, -8.6, 0.0, 0.1)
    finish("podium_beds", soil, [M["soil"]], col)


# The portico's lantern (PorticoLantern.tsx, LANTERN): on the axis, midway
# between the wall and the columns, hung half a metre under the soffit.
LANTERN_AT = (0.0, -9.62)
LANTERN_TOP = 4.4 - 0.5
LANTERN_HEIGHT = 0.8        # tripo_assets_v7.ASSETS["lantern"]


def portico_lantern(M, col):
    """The lantern's body, from the client's generated model where it has been
    made: bronze, six-sided, its glass lit by the site at dusk. The site hangs
    it (rose and chain) and puts the lamp in it; without the model it draws a
    cage of its own, as it did."""
    ob = tripo_object("lantern", "portico_lantern_body", col, LANTERN_AT[0], LANTERN_AT[1], math.pi / 2,
                      z=LANTERN_TOP - LANTERN_HEIGHT)
    if ob is not None:
        print("LANTERN at", [round(v, 3) for v in ob.location])


def build_luxury(M, col):
    gold = new_bm()
    portico_lantern(M, col)
    pool_terrace(M, col)
    west_parterre(M, col)
    podium_beds(M, col)
    helipad(M, col)
    motor_court(M, col)
    podium_balustrade(M, col, gold)
    estate_lighting(M, col)
    finish("podium_urns_gold", gold, [M["gold"]], col, smooth_angle=40)


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
        flat = build_roof(M, col)
        build_podium(M, col)
        append_kept(M, col)
        finish("mansion_gold", gold, [M["gold"]], col, smooth_angle=40)
        # The highest thing on the house: the gilt finials on the corner urns.
        tip = CORNICE_TOP + 1.22 + 1.1 + max(zz for _, zz in FINIAL) * 1.2
        print("ROOF_TOP", round(tip, 3), "FLAT", round(flat, 3))
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
    if "lux" in STAGES:
        build_luxury(M, col)
    for name, width in ARRISES.items():
        ob = bpy.data.objects.get(name)
        if ob is not None and ob.type == "MESH":
            ease_arrises(ob, width)
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    print("SAVED", OUT)
    if "preview" in STAGES:
        preview(os.path.join(os.path.dirname(OUT), "_v7preview"))


main()
