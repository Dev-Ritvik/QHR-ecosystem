"""
Render the estate's foliage cards from real 3D leaf clusters.

    blender --background --python tools/blender/render_foliage_v7.py -- <out_dir> [species,...] [px] [spp]

WHY. The cards the estate's trees are built from were flat vector ellipses in a
round clump: no shading, no veins, no light between the leaves, and a cluster
outline that repeated as a disc on every card. At the hero that is most of
"it looks like a PS2 game". Real-time foliage is made the way this does it:
model the twig and its leaves, light them, and bake what the camera would see
into an alpha card.

WHAT EACH SPECIES WRITES (in <out_dir>):
    v7_<card>.png           albedo with the occlusion between leaves baked in
                            (rendered under a uniform white sky, so what is
                            left is colour times how much sky each point sees),
                            straight alpha from the film
    v7_<card>_normal.png    tangent-space normal of the card, from the geometry
                            and the vein bump, +Y up the card

Cards: canopy_mango, canopy_rain (rain tree and neem), frangipani,
bougainvillea — 1:1 — and palm_frond, 4:1 with the rachis along u.

Everything is procedural and seeded: no downloads, reproducible bytes.
"""
import math
import random
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "C:/dev/estate/assets/materials/_v7"
ONLY = set(argv[1].split(",")) if len(argv) > 1 and argv[1] else None
PX = int(argv[2]) if len(argv) > 2 else 1024
SPP = int(argv[3]) if len(argv) > 3 else 96


# ---------------------------------------------------------------------------
# scene

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                sc.cycles.device = "GPU"
                break
        except Exception:
            continue
    sc.cycles.samples = SPP
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.filter_size = 1.2
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    return sc


def camera(sc, w, h, cx=0.0, cy=0.0):
    """Orthographic, looking down -Z at the card's plane, covering w x h metres."""
    cam_data = bpy.data.cameras.new("C")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(w, h)
    cam = bpy.data.objects.new("C", cam_data)
    sc.collection.objects.link(cam)
    cam.location = (cx, cy, 5.0)
    cam.rotation_euler = (0, 0, 0)
    sc.camera = cam
    sc.render.resolution_x = PX if w >= h else int(PX * w / h)
    sc.render.resolution_y = PX if h >= w else int(PX * h / w)
    cam_data.clip_start = 0.01
    cam_data.clip_end = 20
    return cam


def sky(sc, strength=1.0):
    nt = sc.world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs[0])


# ---------------------------------------------------------------------------
# materials: one leaf shader, two outputs (albedo pass and normal pass)

def vein_height(nt, uv):
    """A midrib and lateral veins as a height field over the leaf's (u across,
    v along) coordinates: the veins are what make a leaf read as a leaf at the
    size a card shows it."""
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv, sep.inputs[0])
    absu = nt.nodes.new("ShaderNodeMath"); absu.operation = "ABSOLUTE"
    nt.links.new(sep.outputs[0], absu.inputs[0])
    # midrib: a ridge where |u| is small
    mid = nt.nodes.new("ShaderNodeMapRange")
    mid.inputs["From Min"].default_value = 0.0
    mid.inputs["From Max"].default_value = 0.06
    mid.inputs["To Min"].default_value = 1.0
    mid.inputs["To Max"].default_value = 0.0
    nt.links.new(absu.outputs[0], mid.inputs["Value"])
    # laterals: stripes along (v*k - |u|*j), thin
    k = nt.nodes.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = 22.0
    nt.links.new(sep.outputs[1], k.inputs[0])
    j = nt.nodes.new("ShaderNodeMath"); j.operation = "MULTIPLY"; j.inputs[1].default_value = 9.0
    nt.links.new(absu.outputs[0], j.inputs[0])
    d = nt.nodes.new("ShaderNodeMath"); d.operation = "SUBTRACT"
    nt.links.new(k.outputs[0], d.inputs[0]); nt.links.new(j.outputs[0], d.inputs[1])
    s = nt.nodes.new("ShaderNodeMath"); s.operation = "SINE"
    nt.links.new(d.outputs[0], s.inputs[0])
    p = nt.nodes.new("ShaderNodeMath"); p.operation = "POWER"; p.inputs[1].default_value = 8.0
    ab = nt.nodes.new("ShaderNodeMath"); ab.operation = "ABSOLUTE"
    nt.links.new(s.outputs[0], ab.inputs[0]); nt.links.new(ab.outputs[0], p.inputs[0])
    lat = nt.nodes.new("ShaderNodeMath"); lat.operation = "MULTIPLY"; lat.inputs[1].default_value = 0.35
    nt.links.new(p.outputs[0], lat.inputs[0])
    h = nt.nodes.new("ShaderNodeMath"); h.operation = "ADD"
    nt.links.new(mid.outputs[0], h.inputs[0]); nt.links.new(lat.outputs[0], h.inputs[1])
    return h.outputs[0]


def leaf_material(name, base, spread, vein_tint=1.15, gloss=0.35):
    """Albedo material: colour from a per-leaf attribute (so every leaf is a
    slightly different green), veins a touch paler, a little gloss."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    attr = nt.nodes.new("ShaderNodeAttribute"); attr.attribute_name = "leafcol"
    uvn = nt.nodes.new("ShaderNodeAttribute"); uvn.attribute_name = "leafuv"
    h = vein_height(nt, uvn.outputs["Vector"])
    tint = nt.nodes.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"
    nt.links.new(h, tint.inputs["Factor"])
    nt.links.new(attr.outputs["Color"], tint.inputs["A"])
    tint.inputs["B"].default_value = (vein_tint, vein_tint, vein_tint * 0.95, 1)
    nt.links.new(tint.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0 - gloss
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(h, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    # The albedo pass is lit by a white sky only: no specular, so the card
    # carries colour and occlusion and the runtime adds the sun's highlight.
    bsdf.inputs["Specular IOR Level"].default_value = 0.0
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    m["bump_out"] = True
    return m


def normal_override():
    """Emission of the shading normal in camera space, mapped to 0..1: the
    card's tangent-space normal map, since the camera looks straight down the
    card's normal. Includes the vein bump."""
    m = bpy.data.materials.new("NORMALS")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    uvn = nt.nodes.new("ShaderNodeAttribute"); uvn.attribute_name = "leafuv"
    h = vein_height(nt, uvn.outputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(h, bump.inputs["Height"])
    nt.links.new(geo.outputs["Normal"], bump.inputs["Normal"])
    # Facing the camera: a back face shows its flipped normal, which is what
    # the card should carry (the runtime draws the card double-sided).
    flip = nt.nodes.new("ShaderNodeMix"); flip.data_type = "VECTOR"
    neg = nt.nodes.new("ShaderNodeVectorMath"); neg.operation = "SCALE"
    neg.inputs["Scale"].default_value = -1.0
    nt.links.new(bump.outputs["Normal"], neg.inputs[0])
    nt.links.new(geo.outputs["Backfacing"], flip.inputs["Factor"])
    nt.links.new(bump.outputs["Normal"], flip.inputs["A"])
    nt.links.new(neg.outputs[0], flip.inputs["B"])
    vt = nt.nodes.new("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"; vt.convert_from = "WORLD"; vt.convert_to = "CAMERA"
    nt.links.new(flip.outputs["Result"], vt.inputs[0])
    # Blender's camera space looks down -Z with +Y up; the card wants +Z out of
    # the card toward the viewer, so z flips.
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(vt.outputs[0], sep.inputs[0])
    nz = nt.nodes.new("ShaderNodeMath"); nz.operation = "MULTIPLY"; nz.inputs[1].default_value = -1.0
    nt.links.new(sep.outputs[2], nz.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs[0], comb.inputs[0]); nt.links.new(sep.outputs[1], comb.inputs[1]); nt.links.new(nz.outputs[0], comb.inputs[2])
    half = nt.nodes.new("ShaderNodeVectorMath"); half.operation = "MULTIPLY_ADD"
    half.inputs[1].default_value = (0.5, 0.5, 0.5); half.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(comb.outputs[0], half.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(half.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def bark_material():
    m = bpy.data.materials.new("TWIG")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.11, 0.075, 0.05, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Specular IOR Level"].default_value = 0.0
    return m


# ---------------------------------------------------------------------------
# geometry

class Builder:
    """One mesh for the whole cluster, with per-corner leaf colour and leaf UV
    attributes, and material slots 0 = twig, 1..n = leaf materials."""

    def __init__(self, bounds=(-0.5, 0.5, -0.5, 0.5)):
        # Card extents in metres (x0, x1, y0, y1): nothing may cross them, or
        # the card's border cuts a straight line through the crown.
        self.bounds = bounds
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new("leafcol")
        # The leaf's own coordinates (u across -1..1, v along 0..1) as a UV map,
        # which the shaders read through an Attribute node by name.
        self.uv = self.bm.loops.layers.uv.new("leafuv")

    def leaf(self, base, tip, up, length, width, shape, colour, mi=1, fold=0.25, droop=0.15, segs=8, cols=3):
        """A leaf from `base` pointing along `tip` (a unit direction), its blade
        facing `up`: outline w(t) = width * shape(t), a V fold about the midrib
        and a droop along its length."""
        a = tip.normalized()
        n = (up - a * up.dot(a)).normalized()
        b = a.cross(n).normalized()
        # Shorten the leaf until its tip and its widest edge sit inside the card.
        x0, x1, y0, y1 = self.bounds
        m = width * 0.6 + 0.01
        for _ in range(12):
            e = base + a * length
            if x0 + m < e.x < x1 - m and y0 + m < e.y < y1 - m:
                break
            length *= 0.85
            width *= 0.92
        if not (x0 < base.x < x1 and y0 < base.y < y1) or length < 0.01:
            return []
        rows = []
        for i in range(segs + 1):
            t = i / segs
            w = width * shape(t)
            row = []
            for j in range(cols * 2 + 1):
                s = (j / cols) - 1.0            # -1 .. 1 across
                x = s * w * 0.5
                z = abs(s) * w * 0.5 * fold - (t * t) * length * droop
                P = base + a * (t * length) + b * x + n * z
                row.append((self.bm.verts.new(P), (s, t)))
            rows.append(row)
        faces = []
        for i in range(segs):
            for j in range(cols * 2):
                q = [rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]]
                try:
                    f = self.bm.faces.new([v for v, _ in q])
                except ValueError:
                    continue
                f.material_index = mi
                f.smooth = True
                for loop, (_, uv) in zip(f.loops, q):
                    loop[self.col] = (colour[0], colour[1], colour[2], 1.0)
                    loop[self.uv].uv = (uv[0], uv[1])
                faces.append(f)
        return faces

    def twig(self, a, b, r0, r1, segs=6):
        axis = (b - a)
        L = axis.length
        if L < 1e-4:
            return
        z = axis.normalized()
        x = z.orthogonal().normalized()
        y = z.cross(x)
        ring0, ring1 = [], []
        for k in range(segs):
            ang = 2 * math.pi * k / segs
            d = x * math.cos(ang) + y * math.sin(ang)
            ring0.append(self.bm.verts.new(a + d * r0))
            ring1.append(self.bm.verts.new(b + d * r1))
        for k in range(segs):
            try:
                f = self.bm.faces.new([ring0[k], ring0[(k + 1) % segs], ring1[(k + 1) % segs], ring1[k]])
                f.material_index = 0
                f.smooth = True
                for loop in f.loops:
                    loop[self.col] = (0.1, 0.07, 0.05, 1.0)
            except ValueError:
                pass

    def build(self, name, mats):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def jitter_colour(rng, base, spread):
    """base (linear RGB) varied in value and a little in hue: no two leaves the
    same green, and the old ones darker."""
    v = 1.0 + rng.uniform(-spread, spread)
    h = rng.uniform(-spread, spread) * 0.6
    r, g, b = base
    return (max(0, r * v * (1 + h)), max(0, g * v), max(0, b * v * (1 - h)))


def lanceolate(t):
    return math.sin(math.pi * min(1.0, t * 1.05)) ** 0.75 * (1.0 - 0.25 * t)


def oblong(t):
    return (math.sin(math.pi * t) ** 0.45) * (0.85 + 0.15 * t)


def ovate(t):
    return math.sin(math.pi * t) ** 0.6 * (1.15 - 0.4 * t)


def leaflet(t):
    return math.sin(math.pi * t) ** 0.7


def random_dir(rng, cone_axis, spread):
    while True:
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if 0.05 < d.length <= 1:
            break
    d.normalize()
    return (cone_axis * (1 - spread) + d * spread).normalized()


# ---------------------------------------------------------------------------
# species

def mango(b, rng):
    """Mangifera: long glossy lanceolate leaves in terminal whorls at the ends
    of stout twigs — the dense dark crown of every Indian compound."""
    base = (0.045, 0.12, 0.036)
    for t in range(12):
        ang = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.05, 0.42)
        tip = Vector((math.cos(ang) * r, math.sin(ang) * r, rng.uniform(-0.05, 0.12)))
        root = tip * 0.25 + Vector((0, 0, -0.35))
        b.twig(root, tip, 0.012, 0.007)
        n = rng.randint(7, 13)
        for k in range(n):
            # Irregular whorls: uneven spacing and lengths, some leaves lifted,
            # so a rosette reads as leaves and not as a star.
            a2 = 2 * math.pi * k / n + rng.uniform(-0.45, 0.45)
            dirv = Vector((math.cos(a2), math.sin(a2), rng.uniform(-0.55, 0.45))).normalized()
            L = rng.uniform(0.15, 0.3)
            young = rng.random() < 0.18
            col = (0.07, 0.11, 0.035) if young else jitter_colour(rng, base, 0.28)
            b.leaf(tip, dirv, Vector((0, 0, 1)) + dirv * 0.2, L, L * rng.uniform(0.2, 0.26), lanceolate, col,
                   mi=1, fold=0.3, droop=rng.uniform(0.1, 0.3))


def rain(b, rng):
    """Samanea / neem: bipinnate and pinnate compound leaves — many small
    leaflets on thin rachises, the fine feathery texture of a big shade tree."""
    base = (0.065, 0.15, 0.04)
    for c in range(46):
        ang = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.0, 0.36) ** 0.8
        start = Vector((math.cos(ang) * r, math.sin(ang) * r, rng.uniform(-0.08, 0.08)))
        dirv = random_dir(rng, Vector((math.cos(ang), math.sin(ang), 0.1)), 0.5)
        L = rng.uniform(0.28, 0.42)
        # The rachis, and the leaflets hung off it, stay inside the card.
        while L > 0.1 and max(abs((start + dirv * L).x), abs((start + dirv * L).y)) > 0.44:
            L *= 0.9
        end = start + dirv * L
        b.twig(start, end, 0.003, 0.0015, segs=4)
        pairs = rng.randint(10, 15)
        side = dirv.cross(Vector((0, 0, 1))).normalized()
        colbase = jitter_colour(rng, base, 0.22)
        for p in range(pairs):
            tt = (p + 0.5) / pairs
            P = start + dirv * (L * tt)
            ll = 0.07 * (1.0 - 0.35 * abs(tt - 0.5) * 2) * rng.uniform(0.85, 1.1)
            for s in (-1, 1):
                d2 = (side * s + dirv * 0.25).normalized()
                b.leaf(P, d2, Vector((0, 0, 1)), ll, ll * 0.38, leaflet, jitter_colour(rng, colbase, 0.12),
                       mi=1, fold=0.15, droop=0.05, segs=4, cols=1)


def frangipani(b, rng):
    """Plumeria: thick blunt branch tips crowned with big oblong leaves and a
    cluster of five-petalled white flowers with a yellow heart."""
    base = (0.06, 0.15, 0.04)
    for t in range(4):
        ang = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.08, 0.33)
        tip = Vector((math.cos(ang) * r, math.sin(ang) * r, rng.uniform(-0.05, 0.05)))
        b.twig(tip * 0.2 + Vector((0, 0, -0.35)), tip, 0.03, 0.022)
        n = rng.randint(8, 11)
        for k in range(n):
            a2 = 2 * math.pi * k / n + rng.uniform(-0.15, 0.15)
            dirv = Vector((math.cos(a2), math.sin(a2), rng.uniform(-0.2, 0.25))).normalized()
            L = rng.uniform(0.24, 0.32)
            b.leaf(tip, dirv, Vector((0, 0, 1)), L, L * 0.3, oblong, jitter_colour(rng, base, 0.22),
                   mi=1, fold=0.2, droop=0.2)
        # the flower cluster, just above the rosette
        for f in range(rng.randint(5, 8)):
            fc = tip + Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), 0.06 + rng.uniform(0, 0.04)))
            rot = rng.uniform(0, 2 * math.pi)
            for pidx in range(5):
                a3 = rot + 2 * math.pi * pidx / 5
                dirv = Vector((math.cos(a3), math.sin(a3), 0.15)).normalized()
                b.leaf(fc, dirv, Vector((0, 0, 1)) + dirv.cross(Vector((0, 0, 1))) * 0.6, 0.035, 0.024, ovate,
                       (0.9, 0.86, 0.72), mi=2, fold=0.1, droop=-0.1, segs=5, cols=2)
            b.leaf(fc, Vector((0, 0, 1)), Vector((1, 0, 0)), 0.006, 0.01, ovate, (0.95, 0.72, 0.18), mi=2, fold=0, droop=0,
                   segs=2, cols=1)


def bougainvillea(b, rng):
    """Small leaves and masses of papery magenta bracts in threes."""
    base = (0.045, 0.11, 0.032)
    for c in range(170):
        ang = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.0, 1.0) ** 0.6 * 0.42
        P = Vector((math.cos(ang) * r, math.sin(ang) * r, rng.uniform(-0.1, 0.1)))
        dirv = random_dir(rng, Vector((0, 0, 1)), 0.9)
        b.leaf(P, dirv, Vector((0, 0, 1)), 0.07, 0.042, ovate, jitter_colour(rng, base, 0.25), mi=1, fold=0.2, droop=0.1,
               segs=5, cols=2)
    for c in range(130):
        ang = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.0, 1.0) ** 0.7 * 0.42
        P = Vector((math.cos(ang) * r, math.sin(ang) * r, rng.uniform(0.0, 0.14)))
        tint = rng.uniform(0.85, 1.1)
        col = (0.55 * tint, 0.03 * tint, 0.22 * tint)
        rot = rng.uniform(0, 2 * math.pi)
        for k in range(3):
            a2 = rot + 2 * math.pi * k / 3
            dirv = Vector((math.cos(a2), math.sin(a2), 0.5)).normalized()
            b.leaf(P, dirv, Vector((0, 0, 1)), 0.055, 0.045, ovate, col, mi=2, fold=0.35, droop=-0.05, segs=5, cols=2)


def palm_frond(b, rng):
    """One pinnate frond lying in the card plane, rachis along +X from the
    card's left edge: narrow V-folded leaflets in both ranks, hanging."""
    L = 4.0
    b.twig(Vector((0, 0, 0)), Vector((L, 0, 0)), 0.025, 0.004)
    base = (0.08, 0.16, 0.04)
    n = 70
    for k in range(n):
        t = (k + 0.5) / n
        P = Vector((L * (0.06 + 0.92 * t), 0, 0))
        ll = 0.52 * math.sin(math.pi * (0.1 + 0.85 * t)) ** 0.7 + 0.08
        for s in (-1, 1):
            ang = math.radians(55 + rng.uniform(-6, 6))
            d = Vector((math.cos(ang), s * math.sin(ang), -0.12)).normalized()
            col = jitter_colour(rng, base, 0.18)
            if t > 0.85:
                col = (col[0] * 1.3, col[1] * 1.05, col[2] * 0.8)
            b.leaf(P, d, Vector((0, 0, 1)), ll, 0.045, leaflet, col, mi=1, fold=0.5, droop=0.08, segs=6, cols=1)


SPECIES = {
    #  name              builder         card w, h, centre       leaf mats (albedo)
    "canopy_mango": (mango, 1.1, 1.1, 0.0, 0.0),
    "canopy_rain": (rain, 1.1, 1.1, 0.0, 0.0),
    "frangipani": (frangipani, 1.0, 1.0, 0.0, 0.0),
    "bougainvillea": (bougainvillea, 1.0, 1.0, 0.0, 0.0),
    "palm_frond": (palm_frond, 4.2, 1.05, 2.05, 0.0),
}


def render(name, fn, w, h, cx, cy):
    sc = reset()
    sky(sc, 1.0)
    rng = random.Random(hash(name) & 0xFFFF)
    b = Builder((cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2))
    fn(b, rng)
    leaf = leaf_material("LEAF", (0.05, 0.1, 0.03), 0.2)
    petal = leaf_material("PETAL", (0.9, 0.9, 0.9), 0.05, vein_tint=1.03, gloss=0.2)
    ob = b.build(name, [bark_material(), leaf, petal])
    camera(sc, w, h, cx, cy)
    # 1. albedo x occlusion, under a white sky
    sc.render.filepath = f"{OUT}/v7_{name}.png"
    bpy.ops.render.render(write_still=True)
    # 2. normals
    nm = normal_override()
    for i in range(len(ob.data.materials)):
        ob.data.materials[i] = nm
    sc.cycles.samples = max(8, SPP // 4)
    sc.render.filepath = f"{OUT}/v7_{name}_normal.png"
    bpy.ops.render.render(write_still=True)
    print("wrote", name)


for name, (fn, w, h, cx, cy) in SPECIES.items():
    if ONLY and name not in ONLY:
        continue
    render(name, fn, w, h, cx, cy)
