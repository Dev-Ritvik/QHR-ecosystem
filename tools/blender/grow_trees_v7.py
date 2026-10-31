"""
Grow the estate's trees the way real-time foliage is grown.

    blender --background --python tools/blender/grow_trees_v7.py -- <tex_dir> <out.blend> [species,...] [preview_dir]

THE USER'S REFINEMENT BRIEF (2026-10-27): "follow a strict refinement phase for
all the models", with a playbook for the tree the canal's rows were given on
2026-10-26 (Royal audit/tree 3d model.glb). That model is a Tripo generation:
131,000 triangles of one closed "blob" of leaf shapes on a stick, a single
2048 colour map wrapped round it, no wood under the leaves and no light
through them, "a 2006 game" in the brief's words. Its silhouette is the one
the user chose (a round head on a clean stem); everything under the silhouette
is grown here instead, step by step as the brief lays it out:

  1. A BRANCH HIERARCHY, not a blob. Level 0, the trunk and its root flare;
     level 1, the major limbs; level 2, the sub-branches; level 3, the fine
     twigs, which carry the leaves and are not modelled ("group them as
     instanced planes"). Each grows as a polyline that bends (seeded noise),
     leans the way its level does (limbs up, twigs out and down) and is
     turned back as it nears the crown's envelope, so the head is the chosen
     globe and the limbs inside it are a tree's. Radii follow the pipe model
     (a parent's section shared among its children), with knots.
  2. PBR BARK: a tileable Poly Haven bark at 2K (colour times its occlusion,
     normal, roughness), tiled round and along every limb; its displacement
     map moves the trunk's own surface (DISP), so the stem's outline is not a
     lathe's. (The scans' bark maps are UV atlases of the scanned trunks and
     smear when tiled; the brief's step is the tileable set.)
  3. LEAF TRANSLUCENCY: a leaf atlas made here, not cut from a crown. Four
     twigs, each laid with eight to twelve of the Poly Haven scan's own
     photographed leaves (folded on the midrib, drooping, alternate), are
     rendered top-down under a white sky into a 2x2 atlas: colour with the
     shade between leaves, alpha, and the camera-space normals as a card
     normal map. On the site the foliage shader lets the sun through every
     MAT_Leaves_ material (exteriorFoliage.ts); the preview here mixes a
     translucent BSDF in for the same reason.
  4. THE CANOPY BY ASSEMBLY: five leafy-twig variants of three to five cards,
     each bent a little more along the twig, set on every fine twig at
     random roll and scale, leaning out and down, each card one of the
     atlas's four twigs.
  5. FOR THE WEB: the wood a few thousand triangles, a card two; the crown's
     occlusion baked into the "Col" attribute by rays cast through the cards
     (a card lets part of the sky through: LEAF_PASS), and the cards' normals
     those of the crown, so it shades as a volume, not as a thousand planes.
     One mesh, slots [BARK, LEAF] and a "UVMap" layer, as the scanned trees
     are, so build_estate_v7.py places it the same way. The textures are
     written to <tex_dir> as v7_grown_<species>[_normal].png and
     v7_grown_<species>_bark[_normal|_rough].

THE OTHER MODELS IN THE BRIEF'S FOLDER (added to Royal audit the same
morning: a rounded tree, a large tree, a sprawling tamarind and a grove of
coconut palms, all Tripo generations of the same kind) are grown the same way
as species of their own, each to its model's silhouette:

  mango     the rounded tree: a dense dome on a short, flared stem, the
            scan's leaves drawn long and narrow, dark, a bronze flush at a
            few tips.
  banyan    the large tree: a crown twice as wide as it is tall on near-level
            limbs, and what makes a banyan one, the AERIAL ROOTS: strands
            hanging from the limbs in twos and threes, and here and there one
            that reached the ground and became a pillar.
  tamarind  the sprawling tamarind: crooked limbs, drooping twigs and the
            jacaranda scan's feathery compound leaves for its fine foliage.
  coconut   the palms: not a branching tree, grown by build_palm: a ringed
            trunk that leans out at its foot and grows back up, and a crown
            of pinnate fronds, each a rachis with two hanging rows of
            leaflets (cards from a frond atlas rendered here from modelled
            leaflets), a few dry ones under them, nuts at the crown's foot.

The belt's trees are seen by the hundred, so these carry a lighter wood
(`step`, `sides`) and larger cards cut from a larger atlas cell (`cell_m`): the
leaves keep their real size, the card count falls to a quarter.

With [preview_dir], four review renders like the brief's blueprint: the
hierarchy coloured by level, the bark, the leaves against the light, and the
tree in the sun. Run for some species only, the library keeps the others.

Inputs (CC0, not in the repo): the Poly Haven tree scans in PH_DIR (the leaf
photographs) and the bark sets in PH_DIR/bark/<set>/ (2K jpg: diff, ao,
nor_gl, rough, disp; downloaded at the user's brief, 2026-10-27).
"""
import math
import os
import random
import shutil
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TEX = argv[0] if argv else "C:/dev/estate/assets/materials/_v7"
OUT = argv[1] if len(argv) > 1 else "C:/dev/Blender/_trees/grown_trees_web.blend"
ONLY = set(argv[2].split(",")) if len(argv) > 2 and argv[2] else None
PREVIEW = argv[3] if len(argv) > 3 else ""
PH = os.environ.get("PH_DIR", "C:/dev/Blender/_polyhaven")

# Per level: segment length, wobble, tropism (+ up, - down), tube sides.
STEP = (0.14, 0.24, 0.17, 0.1)
WOBBLE = (0.035, 0.15, 0.22, 0.3)
TROPISM = (0.02, 0.1, -0.03, -0.12)
SIDES = (12, 7, 5, 3)
# How much sky a card lets through where a ray meets it.
LEAF_PASS = 0.5
ATLAS_PX = 2048
# The atlas's twigs: each in a cell this many metres square.
CELL_M = 0.5

# The leaves in a scan's leaf photograph (u0, v0, u1, v1; stem at v0),
# found by their outlines on its black ground.
LEAF_BOXES = {
    "island_tree_02": [
        (0.0166, 0.4893, 0.1455, 0.9795), (0.1650, 0.6074, 0.3369, 0.9795),
        (0.6943, 0.5859, 0.8164, 0.9795), (0.3613, 0.6387, 0.4824, 0.9678),
        (0.5176, 0.6377, 0.6494, 0.9502), (0.2168, 0.0000, 0.3545, 0.4209),
        (0.4229, 0.0000, 0.5615, 0.3965), (0.0176, 0.0000, 0.1816, 0.3701),
    ],
    # Whole compound leaves lying across the photograph: "u+" its stem at u0,
    # "u-" at u1.
    "jacaranda_tree": [
        (0.1602, 0.5264, 0.9902, 0.9785, "u+"), (0.2432, 0.0039, 1.0000, 0.4111, "u-"),
        (0.0000, 0.3027, 0.4297, 0.6768, "u+"),
    ],
}

# The belt's lighter wood: longer segments, fewer sides.
BELT_STEP = (0.34, 0.6, 0.5, 0.12)
BELT_SIDES = (9, 5, 3, 3)

SPECIES = {
    # The canal's rows: the globe the user chose, five metres tall.
    "globe": dict(
        seed=27, height=5.2, trunk_h=1.95, lean=0.05,
        crown=(2.3, 2.3, 1.75),
        trunk_r=0.15, flare=0.85,
        limbs=7, limb_angle=(30, 58),
        l2=(5, 6), l3=(5, 6),
        cell_m=0.6, card_m=0.6, assemblies=2, cards=(4, 5), shoots=2, per_shoot=(8, 11),
        bark_set="bark_brown_02", bark_tile=0.9, disp=0.014,
        leaves="island_tree_02", leaf_len=(0.11, 0.16), per_twig=(26, 32),
        leaf_tint=(0.75, 0.85, 1.3),
    ),
    # Royal audit/rounded tree 3d model.glb: a mango's dense dome.
    "mango": dict(
        seed=41, height=10.0, trunk_h=2.0, lean=0.05,
        crown=(6.5, 6.3, 4.0),
        trunk_r=0.32, flare=1.1,
        limbs=8, limb_angle=(50, 80), reach=(0.82, 0.95),
        l2=(4, 5), l3=(4, 5), l2_max=2.2, l3_len=(0.4, 0.75),
        step=BELT_STEP, sides=BELT_SIDES,
        cell_m=1.2, card_m=1.45, assemblies=1, cards=(3, 4),
        bark_set="bark_brown_02", bark_tile=1.2, disp=0.03, bark_tint=(0.8, 0.78, 0.76),
        leaves="island_tree_02", leaf_len=(0.17, 0.25), per_twig=(36, 44), per_shoot=(15, 18), shoots=7,
        leaf_narrow=1.5, leaf_tint=(0.43, 0.64, 0.62), flush=0.12, occ_floor=0.52,
    ),
    # Royal audit/large tree 3d model.glb: a banyan, twice as wide as tall.
    "banyan": dict(
        seed=53, height=12.0, trunk_h=2.9, lean=0.03,
        crown=(12.5, 12.0, 4.6),
        trunk_r=0.66, flare=1.5,
        limbs=10, limb_angle=(70, 88), reach=(0.84, 0.96),
        l2=(3, 4), l3=(3, 4), l2_max=3.2, l3_len=(0.5, 0.9),
        step=(0.32, 0.66, 0.5, 0.12), sides=BELT_SIDES, tropism=(0.02, 0.015, -0.03, -0.12),
        cell_m=1.4, card_m=1.9, assemblies=1, cards=(4, 5), shoots=7,
        bark_set="japanese_hackberry_bark", bark_tile=1.6, disp=0.04, bark_tint=(0.92, 0.9, 0.86),
        leaves="island_tree_02", leaf_len=(0.16, 0.22), per_twig=(38, 46), per_shoot=(16, 20),
        leaf_narrow=0.85, leaf_tint=(0.46, 0.73, 0.67), occ_floor=0.52,
        # clusters per limb, strands per cluster, share that are pillars
        roots=(2, (1, 2), 0.2),
    ),
    # Royal audit/sprawling tamarind tree 3d model.glb.
    "tamarind": dict(
        seed=63, height=12.0, trunk_h=2.9, lean=0.15,
        crown=(8.6, 7.8, 4.6),
        trunk_r=0.5, flare=0.9,
        limbs=8, limb_angle=(52, 82), reach=(0.82, 0.95),
        l2=(4, 5), l3=(4, 5), l2_max=2.6, l3_len=(0.45, 0.8),
        step=BELT_STEP, sides=BELT_SIDES,
        wobble=(0.05, 0.26, 0.26, 0.3), tropism=(0.02, 0.05, -0.07, -0.22),
        cell_m=1.2, card_m=1.5, assemblies=1, cards=(3, 4), shoots=6,
        bark_set="bark_brown_02", bark_tile=1.3, disp=0.035, bark_tint=(0.6, 0.58, 0.56),
        leaves="jacaranda_tree", leaf_len=(0.2, 0.3), per_twig=(24, 28), per_shoot=(11, 14),
        leaf_tint=(0.59, 0.75, 0.7), occ_floor=0.52,
    ),
    # Royal audit/coconut palm 3d model.glb: grown by build_palm.
    "coconut": dict(
        palm=True, seed=88, height=11.0, lean=2.4,
        trunk_r=0.16, base_r=0.3, trunk_steps=26,
        fronds=24, dry=3, frond_len=(3.7, 4.7), keel=32, nuts=9,
        bark_set="japanese_hackberry_bark", bark_tile=1.4, disp=0.0, bark_tint=(0.86, 0.8, 0.7),
        rings=0.085,
    ),
}


# ---------------------------------------------------------------------------
# scene

def reset(px=1000, spp=96):
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
    sc.cycles.samples = spp
    sc.cycles.use_denoising = True
    sc.cycles.transparent_max_bounces = 128
    sc.render.resolution_x = px
    sc.render.resolution_y = px
    sc.view_settings.view_transform = "AgX"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("World")
    sc.world.use_nodes = True
    return sc


def white_sky(sc, strength=1.0):
    nt = sc.world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs[0])


def sock(sockets, name, kind):
    return next(x for x in sockets if x.name == name and x.type == kind)


def load(path, colour=True):
    img = bpy.data.images.load(path, check_existing=True)
    if not colour:
        img.colorspace_settings.name = "Non-Color"
    return img


def pixels(img):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def save_image(arr, path, fmt):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=arr.shape[2] == 4)
    rgba = arr if arr.shape[2] == 4 else np.concatenate([arr, np.ones((h, w, 1), np.float32)], 2)
    img.pixels.foreach_set(rgba.reshape(-1).astype(np.float32))
    img.filepath_raw = path
    img.file_format = fmt
    img.save()
    bpy.data.images.remove(img)


# ---------------------------------------------------------------------------
# 2. bark

def make_bark(sp, cfg):
    """The tileable set into the estate's textures; its displacement back."""
    s = cfg["bark_set"]
    d = f"{PH}/bark/{s}/{s}"
    diff = pixels(load(f"{d}_diff_2k.jpg", colour=False))
    ao = pixels(load(f"{d}_ao_2k.jpg", colour=False))
    rough = pixels(load(f"{d}_rough_2k.jpg", colour=False))
    disp = pixels(load(f"{d}_disp_2k.jpg", colour=False))[:, :, 0].copy()
    col = diff[:, :, :3] * (ao[:, :, :1] ** 0.55) * np.array(cfg.get("bark_tint", (1, 1, 1)), np.float32)
    if cfg.get("rings"):
        # A palm's trunk: the scars of fallen fronds, a ring every `rings`
        # metres round it (the tile is bark_tile metres tall), each a dark
        # groove with a lighter lip above it, never quite level.
        h, w = col.shape[:2]
        y = np.arange(h, dtype=np.float32)[:, None] / h * cfg["bark_tile"]
        x = np.arange(w, dtype=np.float32)[None, :] / w
        wav = 0.012 * np.sin(2 * np.pi * x * 2 + 1.3) + 0.006 * np.sin(2 * np.pi * x * 5)
        ph = ((y + wav) / cfg["rings"]) % 1.0
        groove = np.exp(-((ph - 0.5) / 0.07) ** 2)
        lip = np.exp(-((ph - 0.62) / 0.06) ** 2)
        col = col * (1 - 0.55 * groove[..., None]) * (1 + 0.18 * lip[..., None])
        hgt = disp * 0.35 - groove * 0.8 + lip * 0.2
        gy, gx = np.gradient(hgt.astype(np.float32))
        # (Blender's pixel rows run up the image: gy is d/dv already)
        nrm = np.stack([-gx * 6, -gy * 6, np.ones_like(gx)], -1)
        nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
        save_image(nrm * 0.5 + 0.5, f"{TEX}/v7_grown_{sp}_bark_normal.jpg", "JPEG")
        rough = rough.copy()
        rough[:, :, 0] = np.clip(rough[:, :, 0] + 0.15 * groove, 0, 1)
    else:
        shutil.copyfile(f"{d}_nor_gl_2k.jpg", f"{TEX}/v7_grown_{sp}_bark_normal.jpg")
    save_image(np.clip(col, 0, 1), f"{TEX}/v7_grown_{sp}_bark.jpg", "JPEG")
    save_image(np.repeat(rough[:, :, :1], 3, 2), f"{TEX}/v7_grown_{sp}_bark_rough.png", "PNG")
    print("BARK", sp, "from", s, diff.shape[1], "px")
    return disp


# ---------------------------------------------------------------------------
# 3. the leaf atlas

def leaf_material(cfg):
    sp_leaves = cfg["leaves"]
    tex = f"{PH}/{sp_leaves}/textures/{sp_leaves}"
    m = bpy.data.materials.new("ATLAS_LEAF")
    m.use_nodes = True
    nt = m.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    c = nt.nodes.new("ShaderNodeTexImage")
    c.image = load(f"{tex}_leaves_diff_1k.jpg")
    nt.links.new(uv.outputs["UV"], c.inputs["Vector"])
    tint = nt.nodes.new("ShaderNodeAttribute")
    tint.attribute_name = "tint"
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    sock(mul.inputs, "Factor", "VALUE").default_value = 1.0
    nt.links.new(c.outputs["Color"], sock(mul.inputs, "A", "RGBA"))
    nt.links.new(tint.outputs["Color"], sock(mul.inputs, "B", "RGBA"))
    nt.links.new(sock(mul.outputs, "Result", "RGBA"), bsdf.inputs["Base Color"])
    # alpha: the leaf against the photograph's black ground
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    nt.links.new(c.outputs["Color"], bw.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.interpolation_type = "SMOOTHSTEP"
    mr.inputs["From Min"].default_value = 0.03
    mr.inputs["From Max"].default_value = 0.07
    nt.links.new(bw.outputs[0], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], bsdf.inputs["Alpha"])
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = load(f"{tex}_leaves_nor_gl_1k.jpg", colour=False)
    nt.links.new(uv.outputs["UV"], n.inputs["Vector"])
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.uv_map = "UVMap"
    nt.links.new(n.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    a = nt.nodes.new("ShaderNodeTexImage")
    a.image = load(f"{tex}_leaves_arm_1k.jpg", colour=False)
    nt.links.new(uv.outputs["UV"], a.inputs["Vector"])
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(a.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs[1], bsdf.inputs["Roughness"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m, mr, nm


def twig_material():
    m = bpy.data.materials.new("ATLAS_TWIG")
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.13, 0.09, 0.06, 1)
    b.inputs["Roughness"].default_value = 0.8
    return m


def twig_tube(bm, pts, r0):
    """A three-sided stem along pts, tapering."""
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        d = (b - a).normalized()
        side = Vector((-d.y, d.x, 0))
        ra = r0 * (1 - 0.6 * i / (len(pts) - 1))
        rb = r0 * (1 - 0.6 * (i + 1) / (len(pts) - 1))
        ring_a = [bm.verts.new(a + side * math.cos(k * 2.094) * ra + Vector((0, 0, math.sin(k * 2.094) * ra))) for k in range(3)]
        ring_b = [bm.verts.new(b + side * math.cos(k * 2.094) * rb + Vector((0, 0, math.sin(k * 2.094) * rb))) for k in range(3)]
        for k in range(3):
            f = bm.faces.new((ring_a[k], ring_a[(k + 1) % 3], ring_b[(k + 1) % 3], ring_b[k]))
            f.material_index = 1


def leaf(bm, uvl, tintl, p, ld, box, length, rng, young, cfg):
    """One photographed leaf: folded on its midrib, drooping, its stem at p."""
    u0, v0, u1, v1 = box[:4]
    way = box[4] if len(box) > 4 else "v+"
    along_u = way != "v+"
    aspect = (u1 - u0) / (v1 - v0) if along_u else (v1 - v0) / (u1 - u0)
    width = length / (aspect * cfg.get("leaf_narrow", 1.0))
    across = Vector((-ld.y, ld.x, 0))
    fold = rng.uniform(0.12, 0.3) * width
    droop = rng.uniform(0.0, 0.25) * length
    z0 = rng.uniform(0.004, 0.04) * cfg.get("cell_m", CELL_M) / CELL_M
    lt = cfg.get("leaf_tint", (1.0, 1.0, 1.0))
    tint = (rng.uniform(0.9, 1.08) * lt[0], (rng.uniform(0.95, 1.1) + 0.08 * young) * lt[1], rng.uniform(0.85, 1.0) * lt[2], 1.0)
    if cfg.get("flush") and young > 0.8 and rng.random() < cfg["flush"]:
        # a mango's new leaves come out bronze, a flush at the tips
        tint = (tint[0] * 1.55, tint[1] * 0.74, tint[2] * 0.7, 1.0)
    grid = []
    for s_t in (0.0, 1 / 3, 2 / 3, 1.0):
        row = []
        for sgn in (-1, 0, 1):
            q = p + ld * (length * s_t) + across * (width * 0.5 * sgn)
            q.z = z0 + fold * abs(sgn) - droop * s_t * s_t + rng.uniform(-0.002, 0.002)
            if along_u:
                su = s_t if way == "u+" else 1.0 - s_t
                uvv = (u0 + su * (u1 - u0), v0 + (sgn + 1) / 2 * (v1 - v0))
            else:
                uvv = (u0 + (sgn + 1) / 2 * (u1 - u0), v0 + s_t * (v1 - v0))
            row.append((bm.verts.new(q), uvv))
        grid.append(row)
    for a_i in range(3):
        for k in range(2):
            quad = (grid[a_i][k], grid[a_i][k + 1], grid[a_i + 1][k + 1], grid[a_i + 1][k])
            f = bm.faces.new([q[0] for q in quad])
            f.material_index = 0
            for loop, (_, uvv) in zip(f.loops, quad):
                loop[uvl].uv = uvv
                loop[tintl] = tint


def leaves_along(bm, uvl, tintl, pts, n, cfg, rng, boxes, scale=1.0):
    """n leaves in nodes along a stem, one or two to a node, alternating."""
    segs = len(pts) - 1
    j = 0
    while j < n:
        t = 0.1 + 0.9 * (j + rng.uniform(0.1, 0.6)) / n
        seg = min(int(t * segs), segs - 1)
        u = t * segs - seg
        p = pts[seg].lerp(pts[seg + 1], u)
        d = (pts[seg + 1] - pts[seg]).normalized()
        pair = rng.random() < 0.45
        for sgn in ((1, -1) if pair else ((1 if j % 2 else -1),)):
            ang = math.radians(rng.uniform(32, 72)) * sgn
            ld = Vector((d.x * math.cos(ang) - d.y * math.sin(ang), d.x * math.sin(ang) + d.y * math.cos(ang), 0))
            length = rng.uniform(*cfg["leaf_len"]) * (1.08 - 0.32 * t) * scale
            leaf(bm, uvl, tintl, p, ld, rng.choice(boxes), length, rng, t, cfg)
            j += 1


def build_twigs(cfg, rng):
    """Four twigs, one to an atlas cell, lying in the card's plane (z up to
    the camera), running from the cell's left edge to its right, each with a
    side shoot: leaves in nodes of one or two, so a card is mostly leaf."""
    boxes = LEAF_BOXES[cfg["leaves"]]
    cell_m = cfg.get("cell_m", CELL_M)
    k = cell_m / CELL_M
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    tintl = bm.loops.layers.float_color.new("tint")
    for cell in range(4):
        ox = (cell % 2) * cell_m
        oy = (cell // 2) * cell_m
        # the twig: a gentle curve across the cell, at its middle
        start = Vector((ox + 0.03 * k, oy + cell_m / 2 + rng.uniform(-0.03, 0.03) * k, 0))
        bendy = rng.uniform(-0.05, 0.05) * k
        pts = [start + Vector((0.4 * k * t, bendy * math.sin(math.pi * t), 0.01 * k * t)) for t in (0, 0.25, 0.5, 0.75, 1.0)]
        twig_tube(bm, pts, 0.006 * k ** 0.5)
        leaves_along(bm, uvl, tintl, pts, rng.randint(*cfg["per_twig"]), cfg, rng, boxes)
        # the side shoots, off the twig's first two-thirds, the first toward
        # the emptier side and then alternating (a larger cell, more of them)
        side = -1 if bendy > 0 else 1
        for n_s in range(cfg.get("shoots", 1)):
            t0 = (n_s + rng.uniform(0.25, 0.75)) / max(1, cfg.get("shoots", 1)) * 0.66
            seg = min(int(t0 * 4), 3)
            s0 = pts[seg].lerp(pts[seg + 1], t0 * 4 - seg)
            ang = math.radians(rng.uniform(28, 48)) * side
            sd = Vector((math.cos(ang), math.sin(ang), 0))
            reach = 0.2 * k * rng.uniform(0.75, 1.0) * (1.0 - 0.35 * t0)
            spts = [s0 + sd * (reach * t) + Vector((0, 0, 0.006 * k * t)) for t in (0, 0.33, 0.66, 1.0)]
            twig_tube(bm, spts, 0.004 * k ** 0.5)
            leaves_along(bm, uvl, tintl, spts, rng.randint(*cfg.get("per_shoot", (6, 9))), cfg, rng, boxes, scale=0.85)
            side = -side
    me = bpy.data.meshes.new("atlas_twigs")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("atlas_twigs", me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def normal_pass_material(mr, cfg):
    """Emission of the shading normal (with the leaf's own normal map) in
    camera space, 0..1, cut out by the leaf's alpha: the card's normal map,
    since the camera looks straight down the card."""
    sp_leaves = cfg["leaves"]
    tex = f"{PH}/{sp_leaves}/textures/{sp_leaves}"
    m = bpy.data.materials.new("ATLAS_NORMALS")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = load(f"{tex}_leaves_nor_gl_1k.jpg", colour=False)
    nt.links.new(uv.outputs["UV"], n.inputs["Vector"])
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.uv_map = "UVMap"
    nt.links.new(n.outputs["Color"], nm.inputs["Color"])
    # (Cycles has already turned a back face's shading normal to the eye: no
    # flip here, or the leaves seen from beneath point away.)
    vt = nt.nodes.new("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"
    vt.convert_from = "WORLD"
    vt.convert_to = "CAMERA"
    nt.links.new(nm.outputs["Normal"], vt.inputs[0])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(vt.outputs[0], sep.inputs[0])
    nz = nt.nodes.new("ShaderNodeMath")
    nz.operation = "MULTIPLY"
    nz.inputs[1].default_value = -1.0
    nt.links.new(sep.outputs[2], nz.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs[0], comb.inputs[0])
    nt.links.new(sep.outputs[1], comb.inputs[1])
    nt.links.new(nz.outputs[0], comb.inputs[2])
    half = nt.nodes.new("ShaderNodeVectorMath")
    half.operation = "MULTIPLY_ADD"
    half.inputs[1].default_value = (0.5, 0.5, 0.5)
    half.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(comb.outputs[0], half.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(half.outputs[0], em.inputs["Color"])
    # cut out by the leaf: the same alpha as the colour pass
    c = nt.nodes.new("ShaderNodeTexImage")
    c.image = load(f"{tex}_leaves_diff_1k.jpg")
    nt.links.new(uv.outputs["UV"], c.inputs["Vector"])
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    nt.links.new(c.outputs["Color"], bw.inputs[0])
    mr2 = nt.nodes.new("ShaderNodeMapRange")
    mr2.interpolation_type = "SMOOTHSTEP"
    mr2.inputs["From Min"].default_value = 0.03
    mr2.inputs["From Max"].default_value = 0.07
    nt.links.new(bw.outputs[0], mr2.inputs["Value"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(mr2.outputs["Result"], mix.inputs["Fac"])
    nt.links.new(tr.outputs["BSDF"], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return m


def twig_normal_material():
    """The twig's own normals in the normal pass (no cut-out)."""
    m = bpy.data.materials.new("ATLAS_TWIG_NORMALS")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    vt = nt.nodes.new("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"
    vt.convert_from = "WORLD"
    vt.convert_to = "CAMERA"
    nt.links.new(geo.outputs["Normal"], vt.inputs[0])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(vt.outputs[0], sep.inputs[0])
    nz = nt.nodes.new("ShaderNodeMath")
    nz.operation = "MULTIPLY"
    nz.inputs[1].default_value = -1.0
    nt.links.new(sep.outputs[2], nz.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs[0], comb.inputs[0])
    nt.links.new(sep.outputs[1], comb.inputs[1])
    nt.links.new(nz.outputs[0], comb.inputs[2])
    half = nt.nodes.new("ShaderNodeVectorMath")
    half.operation = "MULTIPLY_ADD"
    half.inputs[1].default_value = (0.5, 0.5, 0.5)
    half.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(comb.outputs[0], half.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(half.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def make_atlas(sp, cfg):
    sc = reset(px=ATLAS_PX, spp=64)
    white_sky(sc, 1.0)
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    rng = random.Random(cfg["seed"] + 7)
    leaf, mr, _nm = leaf_material(cfg)
    ob = build_twigs(cfg, rng)
    ob.data.materials.append(leaf)
    ob.data.materials.append(twig_material())
    cell_m = cfg.get("cell_m", CELL_M)
    cam_data = bpy.data.cameras.new("C")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2 * cell_m
    cam = bpy.data.objects.new("C", cam_data)
    sc.collection.objects.link(cam)
    cam.location = (cell_m, cell_m, 3.0)
    sc.camera = cam
    sc.render.filepath = f"{TEX}/v7_grown_{sp}.png"
    sc.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    ob.data.materials[0] = normal_pass_material(mr, cfg)
    ob.data.materials[1] = twig_normal_material()
    # data, not a picture: no display transform (the estate's other cards
    # were written through "Standard", so their flat reads 0.73, not 0.5)
    sc.view_settings.view_transform = "Raw"
    sc.cycles.samples = 16
    sc.render.filepath = f"{TEX}/v7_grown_{sp}_normal.png"
    bpy.ops.render.render(write_still=True)
    print("ATLAS", sp, "from", cfg["leaves"], ATLAS_PX, "px")


# ---------------------------------------------------------------------------
# 1. growth

class Branch:
    def __init__(self, level, pts, radii):
        self.level = level
        self.pts = pts
        self.radii = radii
        self.children = []


def crown_r(p, C, R):
    d = p - C
    return math.sqrt((d.x / R.x) ** 2 + (d.y / R.y) ** 2 + (d.z / R.z) ** 2)


def crown_out(p, C, R):
    """The envelope's outward normal at (or through) p."""
    d = p - C
    g = Vector((d.x / R.x ** 2, d.y / R.y ** 2, d.z / R.z ** 2))
    return g.normalized() if g.length > 1e-9 else Vector((0, 0, 1))


def to_shell(p, d, C, R):
    """How far from p along d the envelope is (p inside it)."""
    o = Vector(((p.x - C.x) / R.x, (p.y - C.y) / R.y, (p.z - C.z) / R.z))
    v = Vector((d.x / R.x, d.y / R.y, d.z / R.z))
    a, b, c = v.dot(v), 2 * o.dot(v), o.dot(o) - 1
    disc = b * b - 4 * a * c
    if disc < 0 or a < 1e-12:
        return 0.0
    return max(0.0, (-b + math.sqrt(disc)) / (2 * a))


def grow(start, d0, length, r0, level, rng, C, R, keep_in=True, cfg=None):
    cfg = cfg or {}
    steps = max(3, int(round(length / cfg.get("step", STEP)[level])))
    seg = length / steps
    pts = [start.copy()]
    d = d0.normalized()
    for _ in range(steps):
        p = pts[-1]
        turn = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))) * cfg.get("wobble", WOBBLE)[level]
        d = d + turn + Vector((0, 0, cfg.get("tropism", TROPISM)[level]))
        if keep_in and level >= 1:
            r = crown_r(p, C, R)
            if r > 0.82:
                d -= crown_out(p, C, R) * (r - 0.82) * 2.4
        d.normalize()
        q = p + d * seg
        if keep_in and level >= 2 and crown_r(q, C, R) > 1.05:
            break
        pts.append(q)
    n = len(pts)
    radii = []
    for i in range(n):
        t = i / max(1, n - 1)
        r = r0 * (1 - 0.82 * t) ** 1.25
        # knots: a swelling here and there along a limb
        if level <= 1 and 0 < i < n - 1 and rng.random() < 0.18:
            r *= rng.uniform(1.06, 1.16)
        radii.append(max(r, 0.004))
    return Branch(level, pts, radii)


def at(branch, t):
    """Point, direction and radius a share t along a branch."""
    n = len(branch.pts)
    f = t * (n - 1)
    i = min(int(f), n - 2)
    u = f - i
    p = branch.pts[i].lerp(branch.pts[i + 1], u)
    d = (branch.pts[i + 1] - branch.pts[i]).normalized()
    r = branch.radii[i] * (1 - u) + branch.radii[i + 1] * u
    return p, d, r


def off_axis(d, angle, azimuth):
    """A direction `angle` off d, turned `azimuth` round it."""
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    a = d.cross(ref).normalized()
    b = d.cross(a).normalized()
    side = a * math.cos(azimuth) + b * math.sin(azimuth)
    return (d * math.cos(angle) + side * math.sin(angle)).normalized()


def grow_tree(cfg):
    rng = random.Random(cfg["seed"])
    H = cfg["height"]
    R = Vector(cfg["crown"])
    C = Vector((0, 0, H - R.z))
    if C.z - R.z > cfg["trunk_h"]:
        print("WARN the crown's envelope starts above the clear stem:", round(C.z - R.z, 2), ">", cfg["trunk_h"])
    golden = math.radians(137.5)
    # Level 0: the trunk, on into the crown as its leader.
    lean = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized() * cfg["lean"]
    trunk = grow(Vector((0, 0, -0.12)), Vector((0, 0, 1)) + lean, C.z + R.z * 0.55 + 0.12, cfg["trunk_r"], 0, rng, C, R, keep_in=False, cfg=cfg)
    # Level 1: the limbs, from the top of the clear stem upward.
    az = rng.uniform(0, 2 * math.pi)
    z0 = cfg["trunk_h"]
    z1 = C.z + R.z * 0.35
    zt = trunk.pts[-1].z - trunk.pts[0].z
    for k in range(cfg["limbs"]):
        z = z0 + (z1 - z0) * (k + rng.uniform(0.1, 0.9)) / cfg["limbs"]
        t = max(0.0, min(0.97, (z - trunk.pts[0].z) / zt))
        p, d, r = at(trunk, t)
        az += golden
        ang = math.radians(rng.uniform(*cfg["limb_angle"]))
        dl = off_axis(d, ang, az)
        L = to_shell(p, dl, C, R) * rng.uniform(*cfg.get("reach", (0.72, 0.88)))
        # (a limb that starts under the envelope finds no shell along its way:
        # it is given the crown's own reach instead of none)
        if L < 0.3 * min(R.x, R.y):
            L = 0.62 * min(R.x, R.y) * rng.uniform(0.85, 1.0)
        limb = grow(p - dl * r * 0.6, dl, max(L, 0.6), r * rng.uniform(0.5, 0.62), 1, rng, C, R, cfg=cfg)
        trunk.children.append(limb)
    # Level 2 along every limb (and the leader's top), level 3 along those.
    hosts = list(trunk.children) + [trunk]
    for host in hosts:
        n2 = rng.randint(*cfg["l2"]) + (1 if host is trunk else 0)
        az2 = rng.uniform(0, 2 * math.pi)
        for j in range(n2):
            t = (0.62 if host is trunk else 0.3) + (0.36 if host is trunk else 0.62) * (j + rng.uniform(0.2, 0.8)) / n2
            p, d, r = at(host, min(t, 0.97))
            az2 += golden
            d2 = off_axis(d, math.radians(rng.uniform(38, 68)), az2)
            # leaning out of the crown, a little down at the tips
            d2 = (d2 + crown_out(p, C, R) * 0.45 + Vector((0, 0, -0.08))).normalized()
            L = min(cfg.get("l2_max", 1.25), max(0.35, to_shell(p, d2, C, R) * rng.uniform(0.62, 0.86)))
            br = grow(p - d2 * r * 0.5, d2, L, max(r * 0.55, 0.012), 2, rng, C, R, cfg=cfg)
            host.children.append(br)
            n3 = rng.randint(*cfg["l3"])
            az3 = rng.uniform(0, 2 * math.pi)
            for m in range(n3):
                t3 = 0.3 + 0.65 * (m + rng.uniform(0.2, 0.8)) / n3
                p3, d3, r3 = at(br, min(t3, 0.97))
                az3 += golden
                dd = off_axis(d3, math.radians(rng.uniform(35, 60)), az3)
                dd = (dd + crown_out(p3, C, R) * 0.6 + Vector((0, 0, -0.12))).normalized()
                tw = grow(p3, dd, rng.uniform(*cfg.get("l3_len", (0.22, 0.42))), max(r3 * 0.5, 0.006), 3, rng, C, R, cfg=cfg)
                br.children.append(tw)
    # A banyan's aerial roots, from its limbs (after the crown, so they take
    # nothing from its random numbers).
    roots = []
    if cfg.get("roots"):
        per_limb, strands, pillars = cfg["roots"]
        for limb in trunk.children:
            if limb.level != 1:
                continue
            for _ in range(per_limb):
                p, d, r = at(limb, rng.uniform(0.28, 0.92))
                if p.z < 2.4:
                    continue
                if rng.random() < pillars:
                    top = p - Vector((0, 0, r * 0.7))
                    roots.append(grow_root(top, top.z + 0.12, rng.uniform(0.07, 0.15), rng, pillar=True))
                else:
                    for _s in range(rng.randint(*strands)):
                        top = p + Vector((rng.uniform(-1, 1) * r, rng.uniform(-1, 1) * r, -r * 0.7))
                        roots.append(grow_root(top, top.z * rng.uniform(0.22, 0.78), rng.uniform(0.009, 0.02), rng))
    return trunk, C, R, roots


def grow_root(top, length, r0, rng, pillar=False):
    """An aerial root: straight down under its own weight, a little astray.
    A pillar is one that reached the ground and thickened into a stem."""
    seg = 0.8 if pillar else 1.0
    steps = max(2, int(round(length / seg)))
    pts = [top.copy()]
    d = Vector((rng.uniform(-0.06, 0.06), rng.uniform(-0.06, 0.06), -1.0)).normalized()
    for _ in range(steps):
        d = (d + Vector((rng.gauss(0, 0.04), rng.gauss(0, 0.04), -0.3))).normalized()
        pts.append(pts[-1] + d * (length / steps))
    if pillar:
        pts[-1].z = -0.12
    n = len(pts)
    if pillar:
        radii = [r0 * (0.55 + 0.45 * (i / (n - 1)) ** 0.6) for i in range(n)]
    else:
        radii = [r0 * (1 - 0.55 * i / (n - 1)) for i in range(n)]
    b = Branch(1 if pillar else 2, pts, radii)
    b.root = True
    return b


def all_branches(b):
    yield b
    for c in b.children:
        yield from all_branches(c)


# ---------------------------------------------------------------------------
# geometry

def frames(pts):
    """Parallel-transport frames along a polyline: (tangent, normal, binormal)."""
    tans = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        tans.append((b - a).normalized())
    ref = Vector((0, 0, 1)) if abs(tans[0].z) < 0.9 else Vector((1, 0, 0))
    n = tans[0].cross(ref).normalized()
    out = []
    for i, t in enumerate(tans):
        if i:
            prev = tans[i - 1]
            axis = prev.cross(t)
            if axis.length > 1e-6:
                ang = math.acos(max(-1.0, min(1.0, prev.dot(t))))
                n = (Matrix.Rotation(ang, 3, axis.normalized()) @ n).normalized()
        n = (n - t * n.dot(t)).normalized()
        out.append((t, n, t.cross(n).normalized()))
    return out


def sample(img, u, v):
    h, w = img.shape
    return float(img[int((v % 1.0) * (h - 1)), int((u % 1.0) * (w - 1))])


def tube(bm, uv_layer, lvl_layer, branch, tile, flare=0.0, disp=None, disp_amp=0.0, rng=None, sides=None):
    """A tapered tube along the branch, UVs tiled round and along it; the
    trunk's surface moved by the bark's displacement."""
    sides = (sides or SIDES)[branch.level]
    fr = frames(branch.pts)
    rings = []
    dist = 0.0
    lobes = rng.uniform(0, 2 * math.pi) if rng else 0.0
    ur = max(1, round(2 * math.pi * max(branch.radii[0], 0.02) / tile))
    for i, (p, (t, n, b)) in enumerate(zip(branch.pts, fr)):
        if i:
            dist += (p - branch.pts[i - 1]).length
        r = branch.radii[i]
        ring = []
        for s in range(sides):
            th = 2 * math.pi * s / sides
            rr = r
            if flare and p.z < 0.6:
                k = (1 - max(p.z, 0.0) / 0.6) ** 2
                rr = r * (1 + flare * k) * (1 + 0.32 * max(0.0, math.cos(5 * th + lobes)) * k)
            if disp is not None:
                rr += disp_amp * (sample(disp, s / sides * ur, dist / tile) - 0.5) * 2
            ring.append(bm.verts.new(p + (n * math.cos(th) + b * math.sin(th)) * rr))
        rings.append((ring, dist))
    faces = []
    for i in range(len(rings) - 1):
        (ra, da), (rb, db) = rings[i], rings[i + 1]
        for s in range(sides):
            s2 = (s + 1) % sides
            f = bm.faces.new((ra[s], ra[s2], rb[s2], rb[s]))
            us = (s / sides * ur, (s + 1) / sides * ur)
            for loop, uv in zip(f.loops, ((us[0], da / tile), (us[1], da / tile), (us[1], db / tile), (us[0], db / tile))):
                loop[uv_layer].uv = uv
                loop[lvl_layer] = (branch.level / 3.0, 0.0, 0.0, 1.0)
            faces.append(f)
    # the tip closed to a point
    ring, d = rings[-1]
    tip = bm.verts.new(branch.pts[-1] + fr[-1][0] * branch.radii[-1] * 1.5)
    for s in range(sides):
        f = bm.faces.new((ring[s], ring[(s + 1) % sides], tip))
        for loop in f.loops:
            loop[uv_layer].uv = (0.5, d / tile)
            loop[lvl_layer] = (branch.level / 3.0, 0.0, 0.0, 1.0)
        faces.append(f)
    return faces


def assembly_variants(cfg, rng):
    """Five leafy twigs: cards along a short stem in the twig's own frame
    (x along the twig), each turned and bent a little more."""
    out = []
    k = cfg["card_m"] / 0.5
    for _ in range(5):
        cards = []
        n = rng.randint(*cfg["cards"])
        bend = rng.uniform(0.05, 0.22)
        for c in range(n):
            x = (0.04 + 0.3 * c / max(1, n - 1) + rng.uniform(-0.03, 0.03)) * k
            roll = (1 if c % 2 else -1) * math.radians(rng.uniform(25, 65)) + rng.uniform(-0.3, 0.3)
            pitch = bend * c + rng.uniform(-0.15, 0.15)
            yaw = rng.uniform(-0.5, 0.5)
            size = cfg["card_m"] * rng.uniform(0.8, 1.12)
            cards.append((x, roll, pitch, yaw, size, rng.randrange(4)))
        out.append(cards)
    return out


def canopy(bm, uv_layer, lvl_layer, twigs, cfg, rng, C, R):
    """The cards on every fine twig (and one more cluster on the outer end of
    every sub-branch, so no limb's reach is bare), each one of the atlas's
    four twigs; returns [(face, card centre)]."""
    variants = assembly_variants(cfg, rng)
    placed = []
    for tw in twigs:
        for a in range(cfg["assemblies"] if tw.level == 3 else 1):
            if tw.level == 3:
                t = 1.0 if a == 0 else rng.uniform(0.35, 0.7)
            else:
                t = rng.uniform(0.72, 0.95)
            p, d, _ = at(tw, min(t, 0.999))
            x = (d + crown_out(p, C, R) * 0.5).normalized()
            y = Vector((0, 0, 1)).cross(x)
            y = y.normalized() if y.length > 1e-4 else Vector((0, 1, 0))
            z = x.cross(y).normalized()
            base = Matrix((x, y, z)).transposed() @ Matrix.Rotation(rng.uniform(0, 2 * math.pi), 3, "X")
            s = rng.uniform(0.85, 1.15)
            for (cx, roll, pitch, yaw, size, cell) in rng.choice(variants):
                m = base @ Matrix.Rotation(roll, 3, "X") @ Matrix.Rotation(pitch, 3, "Y") @ Matrix.Rotation(yaw, 3, "Z")
                ax = m @ Vector((1, 0, 0))
                ay = m @ Vector((0, 1, 0))
                h = size * s * 0.5
                # the card's left edge at the twig, as the atlas's twig is
                centre = p + base @ Vector((cx * s, 0, 0)) + ax * h
                vs = [bm.verts.new(centre + ax * sx * h + ay * sy * h) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
                f = bm.faces.new(vs)
                f.material_index = 1
                ou, ov = (cell % 2) * 0.5, (cell // 2) * 0.5
                for loop, (uu, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                    loop[uv_layer].uv = (ou + uu * 0.5, ov + vv * 0.5)
                    loop[lvl_layer] = (1.0, 1.0, 0.0, 1.0)
                placed.append((f, centre))
    return placed


# ---------------------------------------------------------------------------
# 5. the crown's occlusion, by rays through the cards

def hemisphere(n, rng):
    dirs = []
    for i in range(n):
        u = (i + rng.random()) / n
        v = rng.random()
        r = math.sqrt(u)
        th = 2 * math.pi * v
        dirs.append(Vector((r * math.cos(th), r * math.sin(th), math.sqrt(max(0.0, 1 - u)))))
    return dirs


def exposure(bvh, p, normal, dirs):
    """Share of the sky seen from p over the hemisphere round `normal` (and
    up), a card on the way letting LEAF_PASS of it through."""
    up = (normal + Vector((0, 0, 1.2))).normalized()
    ref = Vector((1, 0, 0)) if abs(up.x) < 0.9 else Vector((0, 1, 0))
    a = up.cross(ref).normalized()
    b = up.cross(a)
    total = 0.0
    for d in dirs:
        w = (a * d.x + b * d.y + up * d.z).normalized()
        o = p + w * 0.02
        trans = 1.0
        for _ in range(4):
            hit, _n, _i, _dist = bvh.ray_cast(o, w, 12.0)
            if hit is None:
                break
            trans *= LEAF_PASS
            o = hit + w * 0.01
        total += trans
    return total / len(dirs)


def placeholder(name, colour):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*colour, 1.0)
    return m


def build(sp, cfg, disp):
    if cfg.get("palm"):
        return build_palm(sp, cfg)
    rng = random.Random(cfg["seed"] + 1)
    trunk, C, R, roots = grow_tree(cfg)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    lvl_layer = bm.loops.layers.float_color.new("Level")
    branches = list(all_branches(trunk))
    sides = cfg.get("sides")
    wood = []
    for br in branches:
        if br.level == 3:
            continue
        if br.level == 0:
            wood += tube(bm, uv_layer, lvl_layer, br, cfg["bark_tile"], flare=cfg["flare"], disp=disp, disp_amp=cfg["disp"], rng=rng, sides=sides)
        else:
            wood += tube(bm, uv_layer, lvl_layer, br, cfg["bark_tile"], rng=rng, sides=sides)
    for br in roots:
        wood += tube(bm, uv_layer, lvl_layer, br, cfg["bark_tile"], flare=0.5 if br.level == 1 else 0.0, rng=rng, sides=sides)
    for f in wood:
        f.material_index = 0
        f.smooth = True
    twigs = [b for b in branches if b.level == 3]
    placed = canopy(bm, uv_layer, lvl_layer, twigs + [b for b in branches if b.level == 2], cfg, rng, C, R)
    for f, _c in placed:
        f.smooth = True
    bm.normal_update()

    # Occlusion: rays from every card and every wood vertex against the cards.
    leaf_verts, leaf_tris = [], []
    for f, _c in placed:
        base = len(leaf_verts)
        leaf_verts += [v.co.copy() for v in f.verts]
        leaf_tris += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    bvh = BVHTree.FromPolygons(leaf_verts, leaf_tris)
    dirs = hemisphere(28, random.Random(5))
    col_layer = bm.loops.layers.float_color.new("Col")
    zlo, zhi = C.z - R.z, C.z + R.z
    for f, centre in placed:
        e = exposure(bvh, centre, crown_out(centre, C, R), dirs)
        # the lower crown sees less of the sky than its rays say (the ground)
        low = 0.8 + 0.2 * max(0.0, min(1.0, (centre.z - zlo) / (zhi - zlo)))
        floor = cfg.get("occ_floor", 0.38)
        occ = (floor + (1 - floor) * e ** 0.7) * low
        for loop in f.loops:
            loop[col_layer] = (occ, occ, occ, 1.0)
    bm.verts.index_update()
    cache = {}
    for f in wood:
        for loop in f.loops:
            v = loop.vert
            occ = cache.get(v.index)
            if occ is None:
                e = exposure(bvh, v.co, v.normal, dirs[::2])
                occ = cache[v.index] = 0.4 + 0.55 * e ** 0.8
            loop[col_layer] = (occ, occ, occ, 1.0)

    me = bpy.data.meshes.new(f"grown_tree_{sp}")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(placeholder("BARK", (0.25, 0.19, 0.14)))
    me.materials.append(placeholder("LEAF", (0.2, 0.32, 0.12)))
    # Col as the scanned trees carry it: bytes, written as linear values.
    fl = me.color_attributes["Col"]
    vals = [0.0] * (len(me.loops) * 4)
    fl.data.foreach_get("color", vals)
    me.color_attributes.remove(fl)
    col = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    col.data.foreach_set("color", vals)
    # The cards shade as the crown: their normals are the envelope's.
    me.update()
    cn = [0.0] * (len(me.loops) * 3)
    me.corner_normals.foreach_get("vector", cn)
    mat_of_loop = [0] * len(me.loops)
    for p in me.polygons:
        for li in p.loop_indices:
            mat_of_loop[li] = p.material_index
    custom = []
    for li, loop in enumerate(me.loops):
        if mat_of_loop[li] == 1:
            co = me.vertices[loop.vertex_index].co
            custom.append(tuple((crown_out(co, C, R) * 0.75 + Vector((0, 0, 0.35))).normalized()))
        else:
            custom.append(tuple(cn[li * 3:li * 3 + 3]))
    me.normals_split_custom_set(custom)
    me.color_attributes.active_color = me.color_attributes["Col"]
    ob = bpy.data.objects.new(f"grown_tree_{sp}", me)
    bpy.context.scene.collection.objects.link(ob)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    wood_tris = sum(len(p.vertices) - 2 for p in me.polygons if p.material_index == 0)
    print("TREE", sp, "tris", tris, "wood", wood_tris, "cards", len(placed), "branches",
          {lvl: sum(1 for b in branches if b.level == lvl) for lvl in range(4)}, "roots", len(roots))
    me.use_fake_user = True
    return ob, twigs


# ---------------------------------------------------------------------------
# the coconut palm

FROND_M = 4.0     # the atlas's half-frond: this long, along a row
ROW_IN = 0.03     # the rachis's line in a row, from its foot (metres)


def leaflet_material(dry):
    """A coconut leaflet: waxy green (or a dead one's straw), a paler midrib
    down it and fine veins along it; per-leaflet `tint`."""
    m = bpy.data.materials.new("ATLAS_LEAFLET_DRY" if dry else "ATLAS_LEAFLET")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs["UV"], sep.inputs[0])
    off = nt.nodes.new("ShaderNodeMath")
    off.operation = "SUBTRACT"
    off.inputs[1].default_value = 0.5
    nt.links.new(sep.outputs[1], off.inputs[0])
    ab = nt.nodes.new("ShaderNodeMath")
    ab.operation = "ABSOLUTE"
    nt.links.new(off.outputs[0], ab.inputs[0])
    rib = nt.nodes.new("ShaderNodeMapRange")
    rib.inputs["From Min"].default_value = 0.0
    rib.inputs["From Max"].default_value = 0.09
    rib.inputs["To Min"].default_value = 1.0
    rib.inputs["To Max"].default_value = 0.0
    nt.links.new(ab.outputs[0], rib.inputs["Value"])
    veins = nt.nodes.new("ShaderNodeTexWave")
    veins.wave_type = "BANDS"
    veins.bands_direction = "Y"
    veins.inputs["Scale"].default_value = 9.0
    veins.inputs["Distortion"].default_value = 1.5
    nt.links.new(uv.outputs["UV"], veins.inputs["Vector"])
    base = (0.05, 0.106, 0.0125) if not dry else (0.2, 0.12, 0.05)
    pale = (0.17, 0.19, 0.04) if not dry else (0.34, 0.24, 0.12)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    sock(mix.inputs, "A", "RGBA").default_value = (*base, 1)
    sock(mix.inputs, "B", "RGBA").default_value = (*pale, 1)
    nt.links.new(rib.outputs["Result"], sock(mix.inputs, "Factor", "VALUE"))
    vm = nt.nodes.new("ShaderNodeMix")
    vm.data_type = "RGBA"
    vm.blend_type = "MULTIPLY"
    sock(vm.inputs, "Factor", "VALUE").default_value = 0.12
    nt.links.new(sock(mix.outputs, "Result", "RGBA"), sock(vm.inputs, "A", "RGBA"))
    nt.links.new(veins.outputs["Color"], sock(vm.inputs, "B", "RGBA"))
    tint = nt.nodes.new("ShaderNodeAttribute")
    tint.attribute_name = "tint"
    tm = nt.nodes.new("ShaderNodeMix")
    tm.data_type = "RGBA"
    tm.blend_type = "MULTIPLY"
    sock(tm.inputs, "Factor", "VALUE").default_value = 1.0
    nt.links.new(sock(vm.outputs, "Result", "RGBA"), sock(tm.inputs, "A", "RGBA"))
    nt.links.new(tint.outputs["Color"], sock(tm.inputs, "B", "RGBA"))
    nt.links.new(sock(tm.outputs, "Result", "RGBA"), bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.42 if not dry else 0.8
    return m


def leaflet_profile(s):
    """A leaflet's length along the frond (s 0 at the foot, 1 at the tip):
    short at both ends, longest a third of the way out."""
    return max(0.0, math.sin(math.pi * (0.04 + 0.96 * s))) ** 0.6 * (1.0 - 0.3 * s)


def make_frond_atlas(sp, cfg):
    """Four half-fronds, one to a row of the atlas: a rachis along the row's
    foot and leaflets off it toward the tip, three green and one dead."""
    sc = reset(px=ATLAS_PX, spp=64)
    white_sky(sc, 1.0)
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    rng = random.Random(cfg["seed"] + 7)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    tintl = bm.loops.layers.float_color.new("tint")
    for row in range(4):
        dry = row == 3
        y0 = row * 1.0 + ROW_IN
        # the rachis: a flattened tube along the row's foot
        twig_tube(bm, [Vector((x, y0, 0.0)) for x in (0.0, 1.0, 2.0, 3.0, FROND_M)], 0.03)
        x = 0.12
        while x < FROND_M - 0.08:
            s = x / FROND_M
            gap = dry and rng.random() < 0.22
            ln = 0.93 * leaflet_profile(s) * rng.uniform(0.9, 1.04) * (rng.uniform(0.55, 0.85) if dry else 1.0)
            if ln > 0.06 and not gap:
                ang = math.radians(rng.uniform(52, 66) + 10 * s)
                d = Vector((math.cos(ang), math.sin(ang), 0))
                across = Vector((-d.y, d.x, 0))
                w = rng.uniform(0.042, 0.055) * (0.8 if dry else 1.0)
                curl = rng.uniform(0.05, 0.14) * (2.2 if dry else 1.0)
                tint = (rng.uniform(0.88, 1.1), rng.uniform(0.9, 1.12), rng.uniform(0.85, 1.05), 1.0)
                z0 = rng.uniform(0.0, 0.03)
                rows_v = []
                for i in range(7):
                    t = i / 6
                    # the leaflet bends back toward the frond's foot as it goes
                    p = Vector((x, y0, 0)) + d * (ln * t) - Vector((1, 0, 0)) * (curl * ln * t * t)
                    hw = w * 0.5 * min(1.0, t / 0.08 + 0.25) * (1.0 - t ** 2.2)
                    a = across
                    rows_v.append([(bm.verts.new(p + a * hw * sgn + Vector((0, 0, z0 + (0.012 if sgn == 0 else 0.0) * (1 - t)))),
                                    (t, (sgn + 1) / 2)) for sgn in (-1, 0, 1)])
                for i in range(6):
                    for k in range(2):
                        quad = (rows_v[i][k], rows_v[i][k + 1], rows_v[i + 1][k + 1], rows_v[i + 1][k])
                        f = bm.faces.new([q[0] for q in quad])
                        f.material_index = 0
                        for loop, (_, uvv) in zip(f.loops, quad):
                            loop[uvl].uv = uvv
                            loop[tintl] = tint
            # alternate leaflets close and far, as a coconut's are
            x += rng.uniform(0.042, 0.062)
        # the dead frond's own leaflets on the green rows' faces: dry material
        if dry:
            for f in bm.faces:
                if f.material_index == 0 and min(v.co.y for v in f.verts) > y0 - 0.05:
                    f.material_index = 2
    me = bpy.data.meshes.new("atlas_fronds")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("atlas_fronds", me)
    sc.collection.objects.link(ob)
    me.materials.append(leaflet_material(False))
    rach = twig_material()
    b = next(n for n in rach.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.32, 0.3, 0.1, 1)
    me.materials.append(rach)
    me.materials.append(leaflet_material(True))
    # (the rachis tubes were made in slot 1 by twig_tube)
    cam_data = bpy.data.cameras.new("C")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = FROND_M
    cam = bpy.data.objects.new("C", cam_data)
    sc.collection.objects.link(cam)
    cam.location = (FROND_M / 2, FROND_M / 2, 3.0)
    sc.camera = cam
    sc.render.filepath = f"{TEX}/v7_grown_{sp}.png"
    sc.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    nm = twig_normal_material()
    for i in range(len(me.materials)):
        me.materials[i] = nm
    sc.view_settings.view_transform = "Raw"
    sc.cycles.samples = 16
    sc.render.filepath = f"{TEX}/v7_grown_{sp}_normal.png"
    bpy.ops.render.render(write_still=True)
    print("ATLAS", sp, "fronds", ATLAS_PX, "px")


def build_palm(sp, cfg):
    """A coconut palm: the ringed trunk, the crown of fronds (each a rachis
    and two hanging rows of leaflets, cards on the frond atlas's rows), the
    dead fronds under them and the nuts at the crown's foot."""
    rng = random.Random(cfg["seed"] + 1)
    H = cfg["height"]
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    lvl_layer = bm.loops.layers.float_color.new("Level")
    az = rng.uniform(0, 2 * math.pi)
    lean = Vector((math.cos(az), math.sin(az), 0))
    side = Vector((-lean.y, lean.x, 0))
    n = cfg["trunk_steps"]
    pts, radii = [], []
    for i in range(n + 1):
        t = i / n
        # out at the foot and back up: the bow a coconut grows with
        off = lean * cfg["lean"] * (1 - (1 - t) ** 2) + side * 0.22 * math.sin(math.pi * 1.4 * t)
        pts.append(Vector((0, 0, H * t - 0.15 * (1 - t))) + off)
        r = cfg["trunk_r"] + (cfg["base_r"] - cfg["trunk_r"]) * (1 - t) ** 7 + 0.01 * math.sin(23 * t + 1.1)
        r *= 1 + 0.4 * max(0.0, (t - 0.95) / 0.05)
        radii.append(r)
    trunk = Branch(0, pts, radii)
    wood = tube(bm, uv_layer, lvl_layer, trunk, cfg["bark_tile"], sides=(10, 6, 3, 3))
    top = pts[-1]
    # the nuts, at the crown's foot
    for k in range(cfg["nuts"]):
        a = 2 * math.pi * k / cfg["nuts"] + rng.uniform(-0.3, 0.3)
        c = top + Vector((math.cos(a) * 0.26, math.sin(a) * 0.26, -0.32 + rng.uniform(-0.12, 0.08)))
        res = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=rng.uniform(0.1, 0.13),
                                        matrix=Matrix.Translation(c))
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index = 0
            for loop in f.loops:
                loop[uv_layer].uv = (0.12, 0.4)
                loop[lvl_layer] = (0.0, 0.0, 0.0, 1.0)
            wood.append(f)
    for f in wood:
        f.material_index = 0
        f.smooth = True
    # the crown
    cards = []
    golden = math.radians(137.5)
    a0 = rng.uniform(0, 2 * math.pi)
    total = cfg["fronds"] + cfg["dry"]
    for k in range(total):
        dry = k >= cfg["fronds"]
        rank = 1.0 if dry else k / max(1, cfg["fronds"] - 1)
        a = a0 + k * golden + rng.uniform(-0.12, 0.12)
        if dry:
            elev = math.radians(rng.uniform(-80, -62))
        else:
            elev = math.radians(66 - 92 * rank ** 0.85 + rng.uniform(-6, 6))
        L = rng.uniform(*cfg["frond_len"]) * (0.72 + 0.28 * min(1.0, rank * 1.8)) * (0.78 if dry else 1.0)
        d0 = Vector((math.cos(a) * math.cos(elev), math.sin(a) * math.cos(elev), math.sin(elev)))
        base = top + d0 * 0.16 - Vector((0, 0, 0.08))
        cards += frond(bm, uv_layer, lvl_layer, base, d0, L, rank, dry, cfg, rng)
    bm.normal_update()
    # occlusion: rays against the fronds, as the trees' against their cards
    leaf_verts, leaf_tris = [], []
    for f in cards:
        b0 = len(leaf_verts)
        leaf_verts += [v.co.copy() for v in f.verts]
        leaf_tris += [(b0, b0 + 1, b0 + 2), (b0, b0 + 2, b0 + 3)] if len(f.verts) == 4 else [(b0, b0 + 1, b0 + 2)]
    bvh = BVHTree.FromPolygons(leaf_verts, leaf_tris)
    dirs = hemisphere(28, random.Random(5))
    col_layer = bm.loops.layers.float_color.new("Col")
    for f in cards:
        c = f.calc_center_median()
        e = exposure(bvh, c + Vector((0, 0, 0.05)), (c - top).normalized() if (c - top).length > 1e-3 else Vector((0, 0, 1)), dirs)
        occ = 0.42 + 0.58 * e ** 0.7
        for loop in f.loops:
            loop[col_layer] = (occ, occ, occ, 1.0)
    for f in wood:
        for loop in f.loops:
            v = loop.vert
            e = exposure(bvh, v.co, v.normal, dirs[::2])
            occ = 0.45 + 0.55 * e ** 0.8
            loop[col_layer] = (occ, occ, occ, 1.0)
    me = bpy.data.meshes.new(f"grown_tree_{sp}")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(placeholder("BARK", (0.25, 0.19, 0.14)))
    me.materials.append(placeholder("LEAF", (0.2, 0.32, 0.12)))
    fl = me.color_attributes["Col"]
    vals = [0.0] * (len(me.loops) * 4)
    fl.data.foreach_get("color", vals)
    me.color_attributes.remove(fl)
    col = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    col.data.foreach_set("color", vals)
    # the fronds shade as the crown: out from its heart and up
    me.update()
    cn = [0.0] * (len(me.loops) * 3)
    me.corner_normals.foreach_get("vector", cn)
    custom = []
    mat_of = {li: p.material_index for p in me.polygons for li in p.loop_indices}
    for li, loop in enumerate(me.loops):
        if mat_of[li] == 1:
            co = me.vertices[loop.vertex_index].co
            out = co - top
            out.z *= 0.4
            custom.append(tuple((out.normalized() * 0.6 + Vector((0, 0, 0.6))).normalized()))
        else:
            custom.append(tuple(cn[li * 3:li * 3 + 3]))
    me.normals_split_custom_set(custom)
    me.color_attributes.active_color = me.color_attributes["Col"]
    ob = bpy.data.objects.new(f"grown_tree_{sp}", me)
    bpy.context.scene.collection.objects.link(ob)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    print("PALM", sp, "tris", tris, "trunk+nuts", sum(len(p.vertices) - 2 for p in me.polygons if p.material_index == 0),
          "fronds", total, "cards", len(cards))
    me.use_fake_user = True
    return ob, []


def frond(bm, uvl, lvl, base, d0, L, rank, dry, cfg, rng):
    """One frond: the rachis bowed by its weight (the older, the more), and a
    row of leaflets either side of it hanging in a V (`keel`), on one of the
    atlas's rows. Returns its cards."""
    segs = 9
    droop = 0.02 if dry else 0.05 + 0.15 * rank
    pts = []
    for i in range(segs + 1):
        s = i / segs * L
        pts.append(base + d0 * s - Vector((0, 0, droop * s * s)))
    row = 3 if dry else rng.randrange(3)
    v_in, v_out = (row + ROW_IN) / 4, (row + 1.0) / 4
    fr = frames(pts)
    keel = math.radians(cfg["keel"] * (1.3 if dry else rng.uniform(0.85, 1.15)))
    cards = []
    # the rachis, on the atlas's own drawn rachis
    for i in range(segs):
        a, b = pts[i], pts[i + 1]
        r_a = 0.045 * (1 - 0.8 * i / segs)
        r_b = 0.045 * (1 - 0.8 * (i + 1) / segs)
        (_, na, ba), (_, nb, bb) = fr[i], fr[i + 1]
        ra = [bm.verts.new(a + (na * math.cos(t) + ba * math.sin(t)) * r_a) for t in (0, 2.094, 4.189)]
        rb = [bm.verts.new(b + (nb * math.cos(t) + bb * math.sin(t)) * r_b) for t in (0, 2.094, 4.189)]
        for k in range(3):
            f = bm.faces.new((ra[k], ra[(k + 1) % 3], rb[(k + 1) % 3], rb[k]))
            f.material_index = 1
            f.smooth = True
            for loop, u in zip(f.loops, (i / segs, i / segs, (i + 1) / segs, (i + 1) / segs)):
                loop[uvl].uv = (u, (row + ROW_IN) / 4)
                loop[lvl] = (2 / 3, 0.0, 0.0, 1.0)
    up = Vector((0, 0, 1))
    for sgn in (-1, 1):
        ring = []
        for i, (P, (T, N, B)) in enumerate(zip(pts, fr)):
            A = T.cross(up)
            A = (A if A.length > 1e-4 else N).normalized() * sgn
            down = T.cross(A).normalized()
            if down.z > 0:
                down = -down
            Ad = (A * math.cos(keel) + down * math.sin(keel)).normalized()
            # (as wide as the row's leaflets are long there, not the row's
            # full metre: the card's empty corners were fill the site paid for
            # and threw away)
            reach = min(1.0, 0.08 + leaflet_profile(i / segs) * 0.97)
            ring.append((bm.verts.new(P), bm.verts.new(P + Ad * reach), i / segs, v_in + (v_out - v_in) * reach))
        for i in range(segs):
            (a_in, a_out, sa, va), (b_in, b_out, sb, vb) = ring[i], ring[i + 1]
            quad = ((a_in, (sa, v_in)), (b_in, (sb, v_in)), (b_out, (sb, vb)), (a_out, (sa, va)))
            # (wound so the row's FRONT faces the sky: the site turns a back
            # face's normal round, and seen from above, as the film sees a
            # palm, rows wound the other way took the crown's up-and-out
            # normals pointing down and drew every frond black)
            if sgn > 0:
                quad = quad[::-1]
            f = bm.faces.new([q[0] for q in quad])
            f.material_index = 1
            f.smooth = True
            for loop, (_, uvv) in zip(f.loops, quad):
                loop[uvl].uv = uvv
                loop[lvl] = (1.0, 1.0, 0.0, 1.0)
            cards.append(f)
    return cards


# ---------------------------------------------------------------------------
# preview: the brief's four panels

def preview_materials(sp, cfg):
    bark = bpy.data.materials.new("PREVIEW_BARK")
    bark.use_nodes = True
    nt = bark.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    stem = f"{TEX}/v7_grown_{sp}_bark"
    c = nt.nodes.new("ShaderNodeTexImage")
    c.image = load(stem + ".jpg")
    occ = nt.nodes.new("ShaderNodeVertexColor")
    occ.layer_name = "Col"
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    sock(mul.inputs, "Factor", "VALUE").default_value = 1.0
    nt.links.new(c.outputs["Color"], sock(mul.inputs, "A", "RGBA"))
    nt.links.new(occ.outputs["Color"], sock(mul.inputs, "B", "RGBA"))
    nt.links.new(sock(mul.outputs, "Result", "RGBA"), bsdf.inputs["Base Color"])
    r = nt.nodes.new("ShaderNodeTexImage")
    r.image = load(stem + "_rough.png", colour=False)
    nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 1.6
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = load(stem + "_normal.jpg", colour=False)
    nt.links.new(n.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])

    leaf = bpy.data.materials.new("PREVIEW_LEAF")
    leaf.use_nodes = True
    nt = leaf.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    stem = f"{TEX}/v7_grown_{sp}"
    c = nt.nodes.new("ShaderNodeTexImage")
    c.image = load(stem + ".png")
    occ = nt.nodes.new("ShaderNodeVertexColor")
    occ.layer_name = "Col"
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    sock(mul.inputs, "Factor", "VALUE").default_value = 1.0
    nt.links.new(c.outputs["Color"], sock(mul.inputs, "A", "RGBA"))
    nt.links.new(occ.outputs["Color"], sock(mul.inputs, "B", "RGBA"))
    nt.links.new(sock(mul.outputs, "Result", "RGBA"), bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55
    nmn = nt.nodes.new("ShaderNodeTexImage")
    nmn.image = load(stem + "_normal.png", colour=False)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(nmn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = 0.2
    trans = nt.nodes.new("ShaderNodeBsdfTranslucent")
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.blend_type = "MULTIPLY"
    sock(tint.inputs, "Factor", "VALUE").default_value = 1.0
    sock(tint.inputs, "B", "RGBA").default_value = (1.1, 1.3, 0.45, 1)
    nt.links.new(sock(mul.outputs, "Result", "RGBA"), sock(tint.inputs, "A", "RGBA"))
    nt.links.new(sock(tint.outputs, "Result", "RGBA"), trans.inputs["Color"])
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs["Fac"].default_value = 0.35
    nt.links.new(bsdf.outputs["BSDF"], mix.inputs[1])
    nt.links.new(trans.outputs["BSDF"], mix.inputs[2])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    am = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(c.outputs["Alpha"], am.inputs["Fac"])
    nt.links.new(tr.outputs["BSDF"], am.inputs[1])
    nt.links.new(mix.outputs["Shader"], am.inputs[2])
    nt.links.new(am.outputs["Shader"], out.inputs["Surface"])
    return bark, leaf


def flat(name, colour, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*colour, 1)
    b.inputs["Roughness"].default_value = 0.7
    if emit and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*colour, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


def preview(ob, twigs, sp, cfg, outdir):
    os.makedirs(outdir, exist_ok=True)
    sc = bpy.context.scene
    sc.cycles.samples = 128
    sc.render.resolution_x = sc.render.resolution_y = 1000
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    bark, leaf = preview_materials(sp, cfg)
    me = ob.data
    orig = list(me.materials)
    me.materials[0] = bark
    me.materials[1] = leaf
    world = sc.world
    nt = world.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new("ShaderNodeTexSky")
    bg = nt.nodes.new("ShaderNodeBackground")
    wo = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs[0], wo.inputs[0])
    bg.inputs["Strength"].default_value = 0.4
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4.5
    sun.data.angle = math.radians(1.5)
    sun.data.color = (1.0, 0.93, 0.8)
    sc.collection.objects.link(sun)
    H = cfg["height"]
    # The globe's frames, scaled to the tree, and aimed at its crown (a
    # palm's stands off its foot).
    k = max(H / 5.2, cfg["crown"][0] / 2.3) if "crown" in cfg else H / 4.7
    kb = cfg.get("trunk_r", 0.15) / 0.15 if "crown" in cfg else cfg["base_r"] / 0.15
    hi = [ob.matrix_world @ v.co for v in me.vertices if v.co.z > 0.6 * H]
    cx = sum(p.x for p in hi) / max(1, len(hi))
    cy = sum(p.y for p in hi) / max(1, len(hi))
    ground = bpy.data.objects.new("Ground", bpy.data.meshes.new("Ground"))
    gb = bmesh.new()
    bmesh.ops.create_grid(gb, x_segments=1, y_segments=1, size=40 * k)
    gb.to_mesh(ground.data)
    gb.free()
    ground.data.materials.append(flat("G", (0.07, 0.1, 0.04)))
    sc.collection.objects.link(ground)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.clip_end = 400

    def shoot(name, eye, look, lens, sun_rot):
        cam.location = Vector(eye)
        cam.rotation_euler = (Vector(look) - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = lens
        sun.rotation_euler = sun_rot
        sc.render.filepath = os.path.join(outdir, f"{sp}_{name}.png")
        bpy.ops.render.render(write_still=True)

    shoot("04_render", (cx + 8.0 * k, cy - 9.0 * k, 3.4 * k), (cx, cy, H * 0.48), 42, (math.radians(52), 0, math.radians(30)))
    # the leaves against the light: looking up into the crown toward the sun
    shoot("03_leaves", (cx - 1.1 * k, cy - 2.4 * k, 1.7), (cx + 0.4 * k, cy + 0.6 * k, H * 0.7), 32, (math.radians(62), 0, math.radians(195)))
    shoot("02_bark", (0.75 * kb, -1.05 * kb, 0.75 + 0.1 * kb), (0, 0, 0.6 + 0.05 * kb), 55, (math.radians(55), 0, math.radians(20)))
    if cfg.get("palm"):
        # (a palm has no hierarchy to colour: its crown from its own height)
        shoot("01_crown", (cx + 6.5, cy - 7.0, H * 0.9), (cx, cy, H * 0.84), 40, (math.radians(50), 0, math.radians(35)))
        cam.location = Vector((cx + 8.0 * k, cy - 9.0 * k, 3.4 * k))
        cam.rotation_euler = (Vector((cx, cy, H * 0.48)) - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = 42
        sun.rotation_euler = (math.radians(52), 0, math.radians(30))
        review = os.path.join(os.path.dirname(OUT), f"grown_trees_review_{sp}.blend")
        bpy.ops.wm.save_as_mainfile(filepath=review, copy=True)
        for i, m in enumerate(orig):
            me.materials[i] = m
        sc.collection.objects.unlink(ground)
        print("PREVIEW", outdir, "REVIEW", review)
        return
    # the hierarchy: the wood coloured by level, the fine twigs drawn green,
    # the cards gone
    lv = bpy.data.materials.new("LEVELS")
    lv.use_nodes = True
    lnt = lv.node_tree
    b = next(n for n in lnt.nodes if n.type == "BSDF_PRINCIPLED")
    vc = lnt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Level"
    sep = lnt.nodes.new("ShaderNodeSeparateColor")
    lnt.links.new(vc.outputs["Color"], sep.inputs["Color"])
    ramp = lnt.nodes.new("ShaderNodeValToRGB")
    lnt.links.new(sep.outputs[0], ramp.inputs["Fac"])
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"
    cr.elements[0].color = (0.32, 0.19, 0.1, 1)
    cr.elements[1].position = 0.2
    cr.elements[1].color = (0.95, 0.42, 0.08, 1)
    cr.elements.new(0.5).color = (0.95, 0.85, 0.15, 1)
    lnt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    if "Emission Color" in b.inputs:
        lnt.links.new(ramp.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 0.25
    hide = bpy.data.materials.new("HIDE")
    hide.use_nodes = True
    hn = hide.node_tree
    hn.nodes.clear()
    hout = hn.nodes.new("ShaderNodeOutputMaterial")
    ht = hn.nodes.new("ShaderNodeBsdfTransparent")
    hn.links.new(ht.outputs["BSDF"], hout.inputs["Surface"])
    wood_only = ob.copy()
    wood_only.data = me.copy()
    wb = bmesh.new()
    wb.from_mesh(wood_only.data)
    bmesh.ops.delete(wb, geom=[f for f in wb.faces if f.material_index == 1], context="FACES")
    wb.to_mesh(wood_only.data)
    wb.free()
    wood_only.data.materials[0] = lv
    sc.collection.objects.link(wood_only)
    ob.hide_render = True
    tb = bmesh.new()
    tuv = tb.loops.layers.uv.new("UVMap")
    tlv = tb.loops.layers.float_color.new("Level")
    for tw in twigs:
        tube(tb, tuv, tlv, tw, 0.5)
    tme = bpy.data.meshes.new("twigs")
    tb.to_mesh(tme)
    tb.free()
    tob = bpy.data.objects.new("twigs", tme)
    tme.materials.append(flat("TWIG", (0.2, 0.75, 0.25), emit=0.3))
    sc.collection.objects.link(tob)
    # (on a plain grey, the sky's own glare washing the levels out)
    nt.links.remove(bg.inputs["Color"].links[0])
    bg.inputs["Color"].default_value = (0.32, 0.34, 0.37, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.view_settings.view_transform = "Standard"
    shoot("01_hierarchy", (7.5 * k, -8.5 * k, 3.6 * k), (0, 0, H * 0.5), 42, (math.radians(40), 0, math.radians(35)))
    sc.collection.objects.unlink(tob)
    sc.collection.objects.unlink(wood_only)
    ob.hide_render = False
    # The review file: the tree in its preview materials, sun, sky and
    # camera, to be opened in Blender itself.
    world.node_tree.links.new(sky.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.4
    sc.view_settings.view_transform = "AgX"
    cam.location = Vector((8.0 * k, -9.0 * k, 3.4 * k))
    cam.rotation_euler = (Vector((0, 0, H * 0.48)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 42
    sun.rotation_euler = (math.radians(52), 0, math.radians(30))
    try:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE"
    review = os.path.join(os.path.dirname(OUT), "grown_trees_review.blend" if sp == "globe" else f"grown_trees_review_{sp}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=review, copy=True)
    sc.render.engine = "CYCLES"
    for i, m in enumerate(orig):
        me.materials[i] = m
    sc.collection.objects.unlink(ground)
    print("PREVIEW", outdir, "REVIEW", review)


def main():
    built = []
    for sp, cfg in SPECIES.items():
        if ONLY and sp not in ONLY:
            continue
        reset()
        disp = make_bark(sp, cfg)
        if cfg.get("palm"):
            make_frond_atlas(sp, cfg)
        else:
            make_atlas(sp, cfg)
        built.append((sp, cfg, disp))
    # The trees, grown into one library file.
    reset()
    trees = []
    for sp, cfg, disp in built:
        ob, twigs = build(sp, cfg, disp)
        trees.append((ob, twigs, sp, cfg))
    if PREVIEW:
        for ob, twigs, sp, cfg in trees:
            # (every species stands at the origin: one in the frame at a time)
            for other, *_ in trees:
                other.hide_render = other is not ob
            preview(ob, twigs, sp, cfg, PREVIEW)
        for other, *_ in trees:
            other.hide_render = False
    # What the library keeps: the trees, their Col, their two slots.
    names = {ob.name for ob, *_ in trees}
    for o in list(bpy.data.objects):
        if o.name not in names:
            bpy.data.objects.remove(o, do_unlink=True)
    for ob, *_ in trees:
        lv = ob.data.color_attributes.get("Level")
        if lv is not None:
            ob.data.color_attributes.remove(lv)
        ob.data.color_attributes.active_color = ob.data.color_attributes["Col"]
    # The species not grown this time, kept from the library as it was.
    if os.path.exists(OUT):
        grown = {f"grown_tree_{sp}" for sp, *_ in built}
        with bpy.data.libraries.load(OUT, link=False) as (src, dst):
            dst.meshes = [m for m in src.meshes if m.startswith("grown_tree_") and m not in grown]
        for me in dst.meshes:
            if me is not None:
                me.use_fake_user = True
                print("KEPT", me.name)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # (Blender will not write over a file it has loaded from: written beside
    # it, and moved over it)
    for lib in list(bpy.data.libraries):
        bpy.data.libraries.remove(lib)
    tmp = OUT[:-6] + ".new.blend"
    bpy.ops.wm.save_as_mainfile(filepath=tmp)
    os.replace(tmp, OUT)
    print("SAVED", OUT)


main()
