"""
Web-weight estate trees from Poly Haven's scanned trees (CC0).

    blender --background --python tools/blender/ph_trees_v7.py -- <ph_dir> <tex_out_dir> <out.blend> [spp] [species,...]

WHY. The estate's shade trees were grown from a procedural recipe (lobes of
cards round a lathed trunk, build_estate_v7.card_tree_mesh). The art-direction
review still read them as "repetitive, cloned 3D assets ... flat, 2D cutouts
without volumetric depth". A recipe cannot know how a real crown is built; a
scan can. Poly Haven publishes three broadleaf trees, CC0, as full geometry —
every leaf modelled, 0.7-2.4 million triangles of leaves each — which is the
right SOURCE and the wrong asset: no browser draws two hundred of them.

So each scan is used three ways, the way real-time foliage is made:

  THE CARD. A cluster of the scan's own leaves and twigs, cut from the upper
  outer crown, rendered straight on under a white sky (albedo with the
  occlusion between leaves) and again as camera-space normals. Real leaves,
  real twigs, real gaps — instead of leaves modelled by hand.

  THE CROWN. Cards are laid where the scan's leaves ARE: the leaves are binned
  into a grid of half-card cells and each chosen cell gets a card, facing out
  of the crown, favouring cells on the crown's surface. The crown's silhouette,
  its lobes and its holes are the real tree's, not a recipe's.

  THE WOOD. The scan's trunk and limbs, decimated to a few thousand triangles,
  with its own bark maps (colour, normal, and roughness from the ARM map's
  green channel).

Writes, per species:
    <tex_out>/v7_ph_<sp>.png, v7_ph_<sp>_normal.png       the leaf card
    <tex_out>/v7_ph_<sp>_bark.jpg, _bark_normal.jpg, _bark_rough.png
    <out.blend>: mesh "ph_tree_<sp>" — material 0 "BARK", material 1 "LEAF",
    a "UVMap" layer, and a "Col" colour attribute (baked crown occlusion,
    multiplied into the leaf colour at runtime, like card_tree_mesh's).
build_estate_v7.py links these meshes and assigns its own materials.
"""
import math
import os
import random
import shutil
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PH = argv[0] if argv else "C:/dev/Blender/_polyhaven"
TEX = argv[1] if len(argv) > 1 else "C:/dev/estate/assets/materials/_v7"
OUT = argv[2] if len(argv) > 2 else "C:/dev/Blender/_polyhaven/ph_trees_web.blend"
SPP = int(argv[3]) if len(argv) > 3 else 96
ONLY = set(argv[4].split(",")) if len(argv) > 4 and argv[4] else None
PX = 1024

# species -> the scan it is made from, its height in the estate, the card's
# size (metres, at that height), how many cards, and the wood's triangle budget.
SPECIES = {
    # An umbrella crown on a leaning trunk: the rain tree's habit.
    "rain": dict(ph="tree_small_02", height=12.0, card_m=1.9, cards=560, wood=3200, seed=70),
    # A dense, broad, rounded crown of fine bipinnate leaves.
    "mango": dict(ph="jacaranda_tree", height=10.5, card_m=1.6, cards=620, wood=3600, seed=71),
    # A gnarled trunk and an open, irregular crown.
    "neem": dict(ph="island_tree_02", height=11.0, card_m=1.7, cards=520, wood=3200, seed=72),
}


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
    nt = world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs[0])
    return sc


def ortho_camera(sc, size):
    cd = bpy.data.cameras.new("C")
    cd.type = "ORTHO"
    cd.ortho_scale = size
    cd.clip_start = 0.01
    cd.clip_end = 50
    cam = bpy.data.objects.new("C", cd)
    sc.collection.objects.link(cam)
    cam.location = (0, 0, 10.0)
    sc.camera = cam
    sc.render.resolution_x = PX
    sc.render.resolution_y = PX
    return cam


def normal_material():
    """Emission of the shading normal in camera space, 0..1: the card's
    tangent-space normal, since the camera looks straight down the card."""
    m = bpy.data.materials.new("NORMALS")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    flip = nt.nodes.new("ShaderNodeMix"); flip.data_type = "VECTOR"
    neg = nt.nodes.new("ShaderNodeVectorMath"); neg.operation = "SCALE"
    neg.inputs["Scale"].default_value = -1.0
    nt.links.new(geo.outputs["Normal"], neg.inputs[0])
    nt.links.new(geo.outputs["Backfacing"], flip.inputs["Factor"])
    nt.links.new(geo.outputs["Normal"], flip.inputs["A"])
    nt.links.new(neg.outputs[0], flip.inputs["B"])
    vt = nt.nodes.new("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"; vt.convert_from = "WORLD"; vt.convert_to = "CAMERA"
    nt.links.new(flip.outputs["Result"], vt.inputs[0])
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


# ---------------------------------------------------------------------------
# the scan

def load_scan(ph_id, height):
    """Import the scan, split it by material, and stand it at the origin at the
    estate's height. Returns (leaf objects, wood objects, scale)."""
    path = os.path.join(PH, ph_id, f"{ph_id}_1k.gltf")
    bpy.ops.import_scene.gltf(filepath=path)
    # Some scans (the jacaranda) multiply colour AND alpha by a vertex-colour
    # attribute that carries wind data, not colour. The pieces cut from the
    # scan do not carry it, the node reads black, and the leaves rendered as
    # black, mostly transparent flecks. Drop the node; its inputs read white.
    for m in bpy.data.materials:
        if not m.node_tree:
            continue
        nt = m.node_tree
        for node in [n for n in nt.nodes if n.type == "VERTEX_COLOR"]:
            for out in node.outputs:
                for link in list(out.links):
                    sock = link.to_socket
                    nt.links.remove(link)
                    if sock.type == "RGBA":
                        sock.default_value = (1.0, 1.0, 1.0, 1.0)
                    elif sock.type == "VALUE":
                        sock.default_value = 1.0
            nt.nodes.remove(node)
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in obs:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if len(o.data.materials) > 1:
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.mesh.separate(type="MATERIAL")
            bpy.ops.object.mode_set(mode="OBJECT")
    parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    leaves = [o for o in parts if o.data.materials and "leaves" in o.data.materials[0].name.lower()]
    wood = [o for o in parts if o not in leaves]
    # Stand it: base at z 0, trunk foot at x=y=0, scaled to height.
    zmin = min(min((o.matrix_world @ Vector(c)).z for c in o.bound_box) for o in parts)
    zmax = max(max((o.matrix_world @ Vector(c)).z for c in o.bound_box) for o in parts)
    foot = []
    for o in wood:
        co = np.empty(len(o.data.vertices) * 3, dtype=np.float32)
        o.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        foot.append(co[co[:, 2] < zmin + 0.04 * (zmax - zmin)])
    foot = np.concatenate(foot) if foot else np.zeros((1, 3))
    fx, fy = float(foot[:, 0].mean()), float(foot[:, 1].mean())
    s = height / (zmax - zmin)
    M = Matrix.Scale(s, 4) @ Matrix.Translation((-fx, -fy, -zmin))
    for o in parts:
        o.data.transform(M)
        o.data.update()
    return leaves, wood, s


def mesh_arrays(o):
    me = o.data
    n = len(me.polygons)
    cen = np.empty(n * 3, dtype=np.float32); me.polygons.foreach_get("center", cen)
    nor = np.empty(n * 3, dtype=np.float32); me.polygons.foreach_get("normal", nor)
    area = np.empty(n, dtype=np.float32); me.polygons.foreach_get("area", area)
    return cen.reshape(-1, 3), nor.reshape(-1, 3), area


def cut_region(o, keep_poly):
    """A new object holding only the polygons of `o` flagged in keep_poly."""
    me = o.data
    n_loops = len(me.loops)
    lv = np.empty(n_loops, dtype=np.int32); me.loops.foreach_get("vertex_index", lv)
    ls = np.empty(len(me.polygons), dtype=np.int32); me.polygons.foreach_get("loop_start", ls)
    lt = np.empty(len(me.polygons), dtype=np.int32); me.polygons.foreach_get("loop_total", lt)
    co = np.empty(len(me.vertices) * 3, dtype=np.float32); me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    uv = None
    if me.uv_layers:
        uv = np.empty(n_loops * 2, dtype=np.float32); me.uv_layers[0].data.foreach_get("uv", uv)
        uv = uv.reshape(-1, 2)
    polys = np.nonzero(keep_poly)[0]
    loops = np.concatenate([np.arange(ls[p], ls[p] + lt[p]) for p in polys]) if len(polys) else np.zeros(0, dtype=np.int64)
    used, remap = np.unique(lv[loops], return_inverse=True)
    faces = []
    k = 0
    for p in polys:
        faces.append(remap[k:k + lt[p]].tolist())
        k += lt[p]
    nme = bpy.data.meshes.new(o.name + "_cut")
    nme.from_pydata(co[used].tolist(), [], faces)
    if uv is not None:
        ul = nme.uv_layers.new(name="UVMap")
        ul.data.foreach_set("uv", uv[loops].reshape(-1))
    for m in me.materials:
        nme.materials.append(m)
    ob = bpy.data.objects.new(nme.name, nme)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------------------
# 1. the card

def pieces(me):
    """Connected-piece id per polygon (a leaf, a twig), by vertex position."""
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    _, canon = np.unique(np.round(co * 1e4).astype(np.int64), axis=0, return_inverse=True)
    canon = canon.reshape(-1)
    lv = np.empty(len(me.loops), dtype=np.int32); me.loops.foreach_get("vertex_index", lv)
    ls = np.empty(len(me.polygons), dtype=np.int32); me.polygons.foreach_get("loop_start", ls)
    lt = np.empty(len(me.polygons), dtype=np.int32); me.polygons.foreach_get("loop_total", lt)
    parent = np.arange(canon.max() + 1 if n else 1)

    def find(x):
        root = x
        while parent[root] != root:
            root = parent[root]
        while parent[x] != root:
            parent[x], x = root, parent[x]
        return root
    for p_ in range(len(me.polygons)):
        a = find(canon[lv[ls[p_]]])
        for k in range(1, lt[p_]):
            b = find(canon[lv[ls[p_] + k]])
            if a != b:
                parent[b] = a
    return np.array([find(canon[lv[ls[p_]]]) for p_ in range(len(me.polygons))])


def feather(ob, size, seed):
    """Thin the cluster toward the card's rim by dropping WHOLE pieces (leaves,
    twig ends) at random: all of them inside a fifth of the card, none past
    0.46. A hard circle read as a round plate in the crown; dropping single
    triangles left shards of leaves."""
    me = ob.data
    if not len(me.polygons):
        return None
    pid = pieces(me)
    cen, _, area = mesh_arrays(ob)
    uniq, inv = np.unique(pid, return_inverse=True)
    w = np.bincount(inv, weights=area, minlength=len(uniq))
    cx = np.bincount(inv, weights=cen[:, 0] * area, minlength=len(uniq)) / np.maximum(w, 1e-12)
    cy = np.bincount(inv, weights=cen[:, 1] * area, minlength=len(uniq)) / np.maximum(w, 1e-12)
    r = np.hypot(cx, cy) / size
    chance = np.clip((0.46 - r) / (0.46 - 0.2), 0.0, 1.0) ** 1.4
    luck = np.random.default_rng(seed).random(len(uniq))
    # And no long limbs: one sawn-off branch across a card repeats in every
    # card of the crown.
    lo = np.full((len(uniq), 3), np.inf); hi = np.full((len(uniq), 3), -np.inf)
    np.minimum.at(lo, inv, cen); np.maximum.at(hi, inv, cen)
    keep_piece = (luck < chance) & (np.linalg.norm(hi - lo, axis=1) < 0.45 * size)
    keep = keep_piece[inv]
    if not keep.any():
        return None
    return cut_region(ob, keep)


def render_card(sp, cfg, leaves, wood, cen, nor):
    sc = bpy.context.scene
    rng = random.Random(cfg["seed"])
    C = cen.mean(axis=0)
    size = cfg["card_m"]
    # The DENSEST cluster in the upper, outer crown, not its extreme tip: the
    # tip is a few leaves on a twig (the rain tree's first card was 18% leaf).
    # Leaves binned into card-sized cells; among the cells in the top 60% of
    # the crown and outside the median radius, one of the five fullest.
    cell = size * 0.8
    keys = np.floor(cen / cell).astype(np.int64)
    uniq, inv = np.unique(keys, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    counts = np.bincount(inv, minlength=len(uniq))
    mid = np.stack([np.bincount(inv, weights=cen[:, k], minlength=len(uniq)) for k in range(3)], 1) / np.maximum(counts, 1)[:, None]
    zlo, zhi = cen[:, 2].min(), cen[:, 2].max()
    rad = np.hypot(mid[:, 0] - C[0], mid[:, 1] - C[1])
    ok = (mid[:, 2] > zlo + 0.4 * (zhi - zlo)) & (rad > np.median(rad))
    order = [i for i in np.argsort(-counts) if ok[i]][:5]
    pick = order[rng.randrange(len(order))] if order else int(np.argmax(counts))
    p0 = Vector(mid[pick])
    out = Vector((p0.x - C[0], p0.y - C[1], 0.0))
    out = out.normalized() if out.length > 1e-3 else Vector((1, 0, 0))
    d = (out + Vector((0, 0, 0.9))).normalized()
    # Frame: d is the card's +Z.
    x = Vector((0, 0, 1)).cross(d)
    x = x.normalized() if x.length > 1e-3 else Vector((1, 0, 0))
    y = d.cross(x).normalized()
    R = Matrix((x, y, d)).to_4x4()  # rows: world -> card
    to_card = R @ Matrix.Translation(-p0)
    # A DISC of the crown, not a square: a square cut prints its straight
    # edges into every card, and a crown of cards shows them as a grid. And
    # only the fine branches — a limb cut off at the card's edge reads as a
    # sawn stump in the middle of the canopy.
    twigs = [o for o in wood if o.data.materials and "branch" in o.data.materials[0].name.lower()]
    cuts = []
    for o in leaves + twigs:
        c, _, _ = mesh_arrays(o)
        rel = (c - np.array(p0, dtype=np.float32)) @ np.array([x, y, d], dtype=np.float32).T
        keep = (np.hypot(rel[:, 0], rel[:, 1]) < size * 0.5) & (rel[:, 2] > -size * 0.9) & (rel[:, 2] < size * 0.6)
        if keep.any():
            ob = cut_region(o, keep)
            ob.data.transform(to_card)
            feathered = feather(ob, size, cfg["seed"])
            bpy.data.objects.remove(ob, do_unlink=True)
            if feathered is not None:
                cuts.append(feathered)
    for o in leaves + wood:
        o.hide_render = True
    cam = ortho_camera(sc, size)
    cam.location = (0, 0, size * 3)
    sc.render.filepath = f"{TEX}/v7_ph_{sp}.png"
    bpy.ops.render.render(write_still=True)
    nm = normal_material()
    saved = {}
    for ob in cuts:
        saved[ob.name] = list(ob.data.materials)
        for i in range(len(ob.data.materials)):
            ob.data.materials[i] = nm
    samples = sc.cycles.samples
    sc.cycles.samples = max(8, SPP // 4)
    sc.render.filepath = f"{TEX}/v7_ph_{sp}_normal.png"
    bpy.ops.render.render(write_still=True)
    sc.cycles.samples = samples
    for ob in cuts:
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    for o in leaves + wood:
        o.hide_render = False
    print("card", sp, "cut from", tuple(round(v, 2) for v in p0))


# ---------------------------------------------------------------------------
# 2. the crown

def crown_cards(sp, cfg, cen, area):
    rng = random.Random(cfg["seed"] + 1)
    cell = cfg["card_m"] * 0.4
    keys = np.floor(cen / cell).astype(np.int64)
    uniq, inv, counts = np.unique(keys, axis=0, return_inverse=True, return_counts=True)
    inv = inv.reshape(-1)
    wsum = np.bincount(inv, weights=area, minlength=len(uniq))
    pos = np.stack([np.bincount(inv, weights=cen[:, k] * area, minlength=len(uniq)) for k in range(3)], 1) / np.maximum(wsum, 1e-9)[:, None]
    # Cells with real leaf in them (not a stray leaf or two).
    solid = wsum > np.percentile(wsum, 20)
    occupied = {tuple(k) for k in uniq[solid]}
    C = (pos[solid] * wsum[solid, None]).sum(0) / wsum[solid].sum()
    zlo, zhi = pos[solid, 2].min(), pos[solid, 2].max()
    exposure = np.zeros(len(uniq))
    offsets = [(i, j, k) for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1) if (i, j, k) != (0, 0, 0)]
    for idx in np.nonzero(solid)[0]:
        kx, ky, kz = uniq[idx]
        exposure[idx] = sum((kx + a, ky + b, kz + c) not in occupied for a, b, c in offsets) / 26.0
    cand = np.nonzero(solid)[0]
    w = (0.15 + exposure[cand]) ** 1.5
    w = w / w.sum()
    n = min(cfg["cards"], len(cand))
    chosen = np.random.default_rng(cfg["seed"]).choice(cand, size=n, replace=False, p=w)

    bm = bmesh.new()
    occ_layer = bm.loops.layers.color.new("Col")
    uv_layer = bm.loops.layers.uv.new("UVMap")
    normals = []
    quad_uv = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    for idx in chosen:
        P = Vector(pos[idx]) + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * cell * 0.25
        # Outward: away from the leaf mass round this cell, and away from the
        # crown's centre, blended.
        kx, ky, kz = uniq[idx]
        empty = Vector((0, 0, 0))
        for a, b, c in offsets:
            if (kx + a, ky + b, kz + c) not in occupied:
                empty += Vector((a, b, c))
        crown_out = (P - Vector(C))
        crown_out = crown_out.normalized() if crown_out.length > 1e-3 else Vector((0, 0, 1))
        local = empty.normalized() if empty.length > 1e-3 else crown_out
        nrm = (local * 0.55 + crown_out * 0.35 + Vector((0, 0, 0.25)) +
               Vector((rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(-0.2, 0.3)))).normalized()
        t1 = nrm.cross(Vector((0, 0, 1)))
        t1 = t1.normalized() if t1.length > 1e-3 else Vector((1, 0, 0))
        t2 = nrm.cross(t1).normalized()
        rot = rng.uniform(0, 2 * math.pi)
        a1 = t1 * math.cos(rot) + t2 * math.sin(rot)
        a2 = nrm.cross(a1).normalized()
        half = cfg["card_m"] * rng.uniform(0.78, 1.12) * 0.5
        corners = [P - a1 * half - a2 * half, P + a1 * half - a2 * half, P + a1 * half + a2 * half, P - a1 * half + a2 * half]
        vs = [bm.verts.new(q) for q in corners]
        f = bm.faces.new(vs)
        f.material_index = 1
        f.smooth = True
        ht = max(0.0, min(1.0, (P.z - zlo) / max(zhi - zlo, 1e-3)))
        occ = (0.5 + 0.5 * exposure[idx]) * (0.66 + 0.34 * ht)
        occ = max(0.3, min(1.0, occ))
        for k, loop in enumerate(f.loops):
            loop[occ_layer] = (occ, occ, occ, 1.0)
            loop[uv_layer].uv = quad_uv[k]
            normals.append(((corners[k] - P).normalized() * 0.35 + nrm * 0.65).normalized())
    me = bpy.data.meshes.new(f"ph_cards_{sp}")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(bark_placeholder())
    me.materials.append(leaf_placeholder())
    ob = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob, normals


def bark_placeholder():
    return bpy.data.materials.get("BARK") or bpy.data.materials.new("BARK")


def leaf_placeholder():
    return bpy.data.materials.get("LEAF") or bpy.data.materials.new("LEAF")


# ---------------------------------------------------------------------------
# 3. the wood

def limbs_only(o, min_len):
    """Keep only the connected pieces of `o` longer than min_len metres: the
    limbs. The twigs are hundreds of thousands of triangles of thin tube that
    no decimation survives (they collapse to shards), and the leaf cards
    already carry them."""
    me = o.data
    n = len(me.vertices)
    lv = np.empty(len(me.loops), dtype=np.int32); me.loops.foreach_get("vertex_index", lv)
    ls = np.empty(len(me.polygons), dtype=np.int32); me.polygons.foreach_get("loop_start", ls)
    parent = np.arange(n)

    def find(x):
        root = x
        while parent[root] != root:
            root = parent[root]
        while parent[x] != root:
            parent[x], x = root, parent[x]
        return root
    # Union each polygon's first vertex with its others.
    lt = np.empty(len(me.polygons), dtype=np.int32); me.polygons.foreach_get("loop_total", lt)
    for p_ in range(len(me.polygons)):
        a = find(lv[ls[p_]])
        for k in range(1, lt[p_]):
            b = find(lv[ls[p_] + k])
            if a != b:
                parent[b] = a
    roots = np.array([find(i) for i in range(n)])
    co = np.empty(n * 3, dtype=np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    uniq, inv = np.unique(roots, return_inverse=True)
    lo = np.full((len(uniq), 3), np.inf); hi = np.full((len(uniq), 3), -np.inf)
    np.minimum.at(lo, inv, co); np.maximum.at(hi, inv, co)
    diag = np.linalg.norm(hi - lo, axis=1)
    keep_part = diag > min_len
    keep_poly = keep_part[inv[lv[ls]]]
    print("limbs", o.name, int(keep_part.sum()), "of", len(uniq), "pieces;", int(keep_poly.sum()), "of", len(keep_poly), "polys")
    return cut_region(o, keep_poly)


def decimate(ob, budget):
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris <= budget:
        return
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new("dec", "DECIMATE")
    mod.ratio = budget / tris
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)


def web_wood(sp, cfg, wood):
    """The trunk on its own budget (60%), the limbs on theirs (40%): decimated
    together, the twigs took the whole budget and the trunk collapsed to one
    triangle."""
    before = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in wood)
    trunk = [o for o in wood if not (o.data.materials and "branch" in o.data.materials[0].name.lower())]
    twigs = [o for o in wood if o not in trunk]
    parts = []
    for o in trunk:
        # The scans stand on a disc of their own ground (island_tree_02 on a
        # plate of soil and rock): flat faces at the foot go; the estate has
        # its own lawn.
        c, n, _ = mesh_arrays(o)
        base = (c[:, 2] < 0.3) & (np.abs(n[:, 2]) > 0.6)
        if base.any():
            kept = cut_region(o, ~base)
            bpy.data.objects.remove(o, do_unlink=True)
            o = kept
        decimate(o, int(cfg["wood"] * 0.6 / max(len(trunk), 1)))
        parts.append(o)
    for o in twigs:
        limb = limbs_only(o, cfg["height"] * 0.22)
        bpy.data.objects.remove(o, do_unlink=True)
        if len(limb.data.polygons):
            decimate(limb, int(cfg["wood"] * 0.4 / max(len(twigs), 1)))
            parts.append(limb)
        else:
            bpy.data.objects.remove(limb, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    me = ob.data
    # One UV layer, named as the estate's materials expect.
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    if me.uv_layers:
        me.uv_layers[0].name = "UVMap"
    for a in [a.name for a in me.color_attributes]:
        me.color_attributes.remove(me.color_attributes[a])
    me.materials.clear()
    me.materials.append(bark_placeholder())
    me.materials.append(leaf_placeholder())
    for p in me.polygons:
        p.material_index = 0
        p.use_smooth = True
    col = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    col.data.foreach_set("color", [0.85, 0.85, 0.85, 1.0] * len(me.loops))
    print("wood", sp, before, "->", sum(len(p.vertices) - 2 for p in me.polygons))
    return ob


def copy_bark(sp, ph_id):
    tex = os.path.join(PH, ph_id, "textures")
    names = os.listdir(tex)
    trunk = [n for n in names if "_diff_" in n and ("trunk" in n or n == f"{ph_id}_diff_1k.jpg")]
    stem = trunk[0].replace("_diff_1k.jpg", "") if trunk else f"{ph_id}"
    shutil.copyfile(os.path.join(tex, f"{stem}_diff_1k.jpg"), f"{TEX}/v7_ph_{sp}_bark.jpg")
    shutil.copyfile(os.path.join(tex, f"{stem}_nor_gl_1k.jpg"), f"{TEX}/v7_ph_{sp}_bark_normal.jpg")
    # Roughness = ARM.g, written through Blender's own image API (no PIL here).
    arm = bpy.data.images.load(os.path.join(tex, f"{stem}_arm_1k.jpg"))
    arm.colorspace_settings.name = "Non-Color"
    w, h = arm.size
    px = np.empty(w * h * 4, dtype=np.float32)
    arm.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    g = px[:, 1:2]
    out = np.concatenate([g, g, g, np.ones_like(g)], 1).reshape(-1)
    img = bpy.data.images.new(f"rough_{sp}", w, h, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(out)
    img.filepath_raw = f"{TEX}/v7_ph_{sp}_bark_rough.png"
    img.file_format = "PNG"
    img.save()
    print("bark", sp, "from", stem)


# ---------------------------------------------------------------------------

def build(sp, cfg):
    sc = reset()
    leaves, wood, s = load_scan(cfg["ph"], cfg["height"])
    cen, nor, area = [], [], []
    for o in leaves:
        c, n, a = mesh_arrays(o)
        cen.append(c); nor.append(n); area.append(a)
    cen = np.concatenate(cen); nor = np.concatenate(nor); area = np.concatenate(area)
    render_card(sp, cfg, leaves, wood, cen, nor)
    copy_bark(sp, cfg["ph"])
    cards, card_normals = crown_cards(sp, cfg, cen, area)
    for o in leaves:
        bpy.data.objects.remove(o, do_unlink=True)
    w = web_wood(sp, cfg, wood)
    # Custom normals: the wood keeps its own, the cards take the crown's.
    w.data.update()
    cn = np.empty(len(w.data.loops) * 3, dtype=np.float32)
    w.data.corner_normals.foreach_get("vector", cn)
    wood_normals = [tuple(v) for v in cn.reshape(-1, 3)]
    bpy.ops.object.select_all(action="DESELECT")
    w.select_set(True)
    cards.select_set(True)
    bpy.context.view_layer.objects.active = w
    bpy.ops.object.join()
    tree = bpy.context.view_layer.objects.active
    tree.name = f"ph_tree_{sp}"
    tree.data.name = f"ph_tree_{sp}"
    tree.data.normals_split_custom_set(wood_normals + [tuple(n) for n in card_normals])
    tree.data.color_attributes.active_color = tree.data.color_attributes["Col"]
    tris = sum(len(p.vertices) - 2 for p in tree.data.polygons)
    print("tree", sp, "tris", tris, "cards", len(card_normals) // 4)
    tree.use_fake_user = True
    tree.data.use_fake_user = True
    return tree


def main():
    os.makedirs(TEX, exist_ok=True)
    trees = {}
    for sp, cfg in SPECIES.items():
        if ONLY and sp not in ONLY:
            continue
        tree = build(sp, cfg)
        # Keep only the finished mesh: write it to its own temp file and
        # collect them all at the end, so the scans never reach the library.
        path = os.path.join(os.path.dirname(OUT), f"_ph_{sp}.blend")
        bpy.data.libraries.write(path, {tree.data}, fake_user=True)
        trees[sp] = path
    # The library: every finished tree, nothing else.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if os.path.exists(OUT) and ONLY:
        with bpy.data.libraries.load(OUT) as (src, dst):
            dst.meshes = [m for m in src.meshes if m.startswith("ph_tree_") and m[8:] not in trees]
    for sp, path in trees.items():
        with bpy.data.libraries.load(path) as (src, dst):
            dst.meshes = [f"ph_tree_{sp}"]
    for m in bpy.data.meshes:
        m.use_fake_user = True
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    print("wrote", OUT, sorted(m.name for m in bpy.data.meshes))


main()
