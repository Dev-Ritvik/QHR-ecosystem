"""
The fountain's fish, refined.

    blender --background --factory-startup --python tools/blender/refine_fish_v7.py -- <src.glb> <out.blend> [preview_dir]

THE USER'S REFINEMENT BRIEF (2026-10-27): "follow a strict refinement phase for
all the models". The Tripo betta (Royal audit/betta fish 3d model.glb) is a
good likeness, a photographed halfmoon's colour on a modelled body, carrying
what a generator always carries: 150,000 triangles of uneven density, doubled
vertices along its seams, fins as solid as its body and one roughness for all
of it. Refined here, step by step:

  CLEAN: one mesh, welded, specks of loose geometry gone, normals recalculated.
  REDUCED with care: TRIS triangles (the site's copy was 5,000 by a plain
  collapse); a betta is all fin, and its outline is its fins'.
  THE FINS KNOWN: every vertex is measured for how thick the fish is there (a
  ray through the mesh against its own normal); a few millimetres is fin, and
  that mask is baked into the colour map's alpha (1 the body, 0 the thinnest
  fin), so the site lets the sun through the fins (FountainFish.tsx) the way
  it does through leaves. The material stays opaque: a betta's fins are
  translucent, not transparent, and a sorted, blended fish beside a mirror of
  water is a sorting fault waiting.
  WET: the scales glossier and the fins duller (ROUGH), from the model's own
  roughness: as glossy as the scales, every ruffled fin edge glinted white.
  BLED: a reduced mesh's edges no longer sit where the generator drew its UV
  islands, so the islands' colours are carried out over the ground round them
  (BLEED): a sample that falls just off an island, or a mip that reaches past
  it, takes the fish's colour.

Writes mesh "fish_betta_refined" (its images packed, material MAT_Fish_Betta)
into <out.blend> for build_estate_v7.py's fountain_fish, length along y, on
z = 0, at its real 0.6 m. With [preview_dir], a side view against the light.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
PREVIEW = argv[2] if len(argv) > 2 else ""
LENGTH = 0.6
TRIS = 9000
FIN = (0.004, 0.012)      # metres through the fish: all fin below, all body above
ROUGH = {"body": 0.6, "fin": 1.3}    # a share of the model's own roughness: wet scales, a membrane duller
MASK_PX = 1024
FOLD = 75          # degrees: an edge folded further than this is the rim of a fin
BLEED = 24        # texels the islands' colours are carried out over the ground


def uv_islands(me, w, h):
    """Which texels of a w x h map the mesh's UV triangles cover."""
    me.calc_loop_triangles()
    uvs = me.uv_layers.active.data
    cov = np.zeros((h, w), bool)
    for tri in me.loop_triangles:
        p = np.array([uvs[li].uv[:] for li in tri.loops]) * (w, h) - 0.5
        x0, y0 = np.floor(p.min(0)).astype(int) - 1
        x1, y1 = np.ceil(p.max(0)).astype(int) + 1
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w - 1), min(y1, h - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        (ax, ay), (bx, by), (cx, cy) = p
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-12:
            continue
        l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
        l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
        inside = (l1 >= -0.02) & (l2 >= -0.02) & (1 - l1 - l2 >= -0.02)
        cov[y0:y1 + 1, x0:x1 + 1] |= inside
    return cov


def bleed(arr, cov, n=BLEED):
    """Carry the covered texels' values out over the uncovered ones, a texel
    a pass (the mean of the covered neighbours), so a sample that falls just
    off an island - a collapsed edge's UVs moved, a mip's footprint - takes
    the island's colour and not the generator's white ground."""
    out = arr.copy()
    done = cov.copy()
    for _ in range(n):
        acc = np.zeros_like(out)
        cnt = np.zeros(done.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            m = np.roll(np.roll(done, dy, 0), dx, 1)
            v = np.roll(np.roll(out, dy, 0), dx, 1)
            acc += v * m[..., None]
            cnt += m
        grow = (~done) & (cnt > 0)
        if not grow.any():
            break
        out[grow] = acc[grow] / cnt[grow][:, None]
        done |= grow
    return out

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in sc.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
for o in list(sc.objects):
    if o is not ob:
        bpy.data.objects.remove(o, do_unlink=True)
ob.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
before = sum(len(p.vertices) - 2 for p in me.polygons)

# CLEAN
bm = bmesh.new()
bm.from_mesh(me)
size = max(ob.dimensions)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=size * 2e-5)
# loose specks: islands under a tenth of a percent of the faces
bm.faces.ensure_lookup_table()
seen = set()
islands = []
for f in bm.faces:
    if f.index in seen:
        continue
    stack, isl = [f], []
    seen.add(f.index)
    while stack:
        g = stack.pop()
        isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen:
                    seen.add(h.index)
                    stack.append(h)
    islands.append(isl)
small = [f for isl in islands if len(isl) < len(bm.faces) * 0.001 for f in isl]
bmesh.ops.delete(bm, geom=small, context="FACES")
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me)
bm.free()

# length along y (the generator stood it along its longest side), real size
d = ob.dimensions
if d.x > d.y:
    me.transform(Matrix.Rotation(math.radians(90), 4, "Z"))
me.update()
xs = [v.co.x for v in me.vertices]
ys = [v.co.y for v in me.vertices]
zs = [v.co.z for v in me.vertices]
s = LENGTH / (max(ys) - min(ys))
me.transform(Matrix.Diagonal((s, s, s, 1)))
me.transform(Matrix.Translation((-(min(xs) + max(xs)) / 2 * s, -(min(ys) + max(ys)) / 2 * s, -min(zs) * s)))
me.update()

# THE FINS KNOWN, on the full mesh
bvh = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
thick = np.empty(len(me.vertices))
for v in me.vertices:
    n = v.normal
    hit, _n, _i, dist = bvh.ray_cast(v.co - n * 1e-4, -n, 0.2)
    # (no far side at all is an open sheet: fin)
    thick[v.index] = dist if hit is not None else 0.0
fin = 1.0 - np.clip((thick - FIN[0]) / (FIN[1] - FIN[0]), 0.0, 1.0)
fin = fin * fin * (3 - 2 * fin)
# smoothed over neighbours, twice
edges = np.array([e.vertices[:] for e in me.edges])
for _ in range(2):
    acc = np.zeros_like(fin)
    cnt = np.zeros_like(fin)
    np.add.at(acc, edges[:, 0], fin[edges[:, 1]])
    np.add.at(acc, edges[:, 1], fin[edges[:, 0]])
    np.add.at(cnt, edges[:, 0], 1)
    np.add.at(cnt, edges[:, 1], 1)
    fin = 0.5 * fin + 0.5 * acc / np.maximum(cnt, 1)
attr = me.color_attributes.new("fin", "FLOAT_COLOR", "POINT")
attr.data.foreach_set("color", np.repeat(fin, 4).reshape(-1, 4).astype(np.float32).reshape(-1) * np.tile([1, 1, 1, 0], len(fin)) + np.tile([0, 0, 0, 1], len(fin)))
print("FINS", "share of vertices", round(float((fin > 0.5).mean()), 3))

# REDUCED with care
mod = ob.modifiers.new("decimate", "DECIMATE")
mod.decimate_type = "COLLAPSE"
mod.ratio = min(1.0, TRIS / max(before, 1))
bpy.context.view_layer.objects.active = ob
bpy.ops.object.modifier_apply(modifier=mod.name)
after = sum(len(p.vertices) - 2 for p in me.polygons)
for p in me.polygons:
    p.use_smooth = True
# A fin is a closed shell a few millimetres thick: smooth across its rim, the
# two sides' opposite normals average to one that points out along the fin,
# and at 9,000 triangles that rim is wide enough to catch the light as a white
# thread round every fin. Sharp where the shell folds back on itself.
# (By the faces' own normals: Mesh.set_sharp_from_angle marked 13 of the
# 1,318 edges folded past FOLD here.)
bm = bmesh.new()
bm.from_mesh(me)
bm.normal_update()
cos_fold = math.cos(math.radians(FOLD))
folds = 0
for e in bm.edges:
    f = e.link_faces
    if len(f) == 2 and f[0].normal.dot(f[1].normal) < cos_fold:
        e.smooth = False
        folds += 1
bm.to_mesh(me)
bm.free()
print("FISH", "tris", before, "->", after, "sharp folds", folds)

# the material: the model's maps, its colour's alpha the fin mask
mat = me.materials[0]
mat.name = "MAT_Fish_Betta"
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
base_node = bsdf.inputs["Base Color"].links[0].from_node
base_img = base_node.image
rough_link = bsdf.inputs["Roughness"].links[0] if bsdf.inputs["Roughness"].is_linked else None
uv_name = me.uv_layers.active.name

# bake the mask into UV space (Cycles, the attribute as emission)
sc.render.engine = "CYCLES"
sc.cycles.samples = 4
sc.cycles.device = "CPU"
mask_img = bpy.data.images.new("fin_mask", MASK_PX, MASK_PX, alpha=False, float_buffer=True)
mask_img.colorspace_settings.name = "Non-Color"
bake = bpy.data.materials.new("BAKE_FIN")
bake.use_nodes = True
bn = bake.node_tree
bn.nodes.clear()
bo = bn.nodes.new("ShaderNodeOutputMaterial")
ba = bn.nodes.new("ShaderNodeAttribute")
ba.attribute_name = "fin"
be = bn.nodes.new("ShaderNodeEmission")
bn.links.new(ba.outputs["Color"], be.inputs["Color"])
bn.links.new(be.outputs[0], bo.inputs[0])
bt = bn.nodes.new("ShaderNodeTexImage")
bt.image = mask_img
bn.nodes.active = bt
me.materials[0] = bake
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
bpy.ops.object.bake(type="EMIT", margin=8)
me.materials[0] = mat
w, h = base_img.size
mask = np.empty(MASK_PX * MASK_PX * 4, np.float32)
mask_img.pixels.foreach_get(mask)
mask = mask.reshape(MASK_PX, MASK_PX, 4)[:, :, 0]
# up to the colour map's size, nearest
yi = (np.arange(h) * MASK_PX // h).clip(0, MASK_PX - 1)
xi = (np.arange(w) * MASK_PX // w).clip(0, MASK_PX - 1)
mask = mask[yi][:, xi]
px = np.empty(w * h * 4, np.float32)
base_img.pixels.foreach_get(px)
px = px.reshape(h, w, 4)
px[:, :, 3] = 1.0 - np.clip(mask, 0.0, 1.0)
# (the islands of the REDUCED mesh: its edges' UVs have moved)
cov = uv_islands(me, w, h)
px = bleed(px, cov)
print("BLEED", "islands cover", round(float(cov.mean()), 3), "of the map")
rgba = bpy.data.images.new("betta_basecolor_fin", w, h, alpha=True)
# (CHANNEL_PACKED: the alpha is data. As a straight alpha Blender multiplies
# the colour by it wherever the Alpha socket is not read, and the fins, alpha
# near 0, rendered black.)
rgba.alpha_mode = "CHANNEL_PACKED"
rgba.pixels.foreach_set(px.reshape(-1))
rgba.filepath_raw = os.path.join(os.path.dirname(OUT), "betta_basecolor_fin.png")
rgba.file_format = "PNG"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
rgba.save()
rgba.pack()
base_node.image = rgba
# (the alpha is a mask for the site, not an opacity: left unconnected, the
# exporter writes the material opaque and the map keeps its fourth channel)
for l in list(bsdf.inputs["Alpha"].links):
    nt.links.remove(l)
# WET: the scales glossier than the fins, written into the model's own
# roughness map (green), so the exporter carries it as a map
if rough_link is not None and rough_link.from_node.type in ("SEPARATE_COLOR", "SEPRGB"):
    rm_node = rough_link.from_node.inputs[0].links[0].from_node
    rm_img = rm_node.image
    rw, rh = rm_img.size
    rpx = np.empty(rw * rh * 4, np.float32)
    rm_img.pixels.foreach_get(rpx)
    rpx = rpx.reshape(rh, rw, 4)
    ry = (np.arange(rh) * MASK_PX // rh).clip(0, MASK_PX - 1)
    rx = (np.arange(rw) * MASK_PX // rw).clip(0, MASK_PX - 1)
    fm = np.empty(MASK_PX * MASK_PX * 4, np.float32)
    mask_img.pixels.foreach_get(fm)
    fm = np.clip(fm.reshape(MASK_PX, MASK_PX, 4)[:, :, 0][ry][:, rx], 0, 1)
    rpx[:, :, 1] = rpx[:, :, 1] * (ROUGH["body"] + (ROUGH["fin"] - ROUGH["body"]) * fm)
    rpx = bleed(rpx, cov if (rw, rh) == (w, h) else uv_islands(me, rw, rh))
    wet = bpy.data.images.new("betta_rm_wet", rw, rh, alpha=False)
    wet.colorspace_settings.name = "Non-Color"
    wet.pixels.foreach_set(rpx.reshape(-1))
    wet.filepath_raw = os.path.join(os.path.dirname(OUT), "betta_rm_wet.png")
    wet.file_format = "PNG"
    wet.save()
    wet.pack()
    rm_node.image = wet
    print("WET", "roughness mean", round(float(rpx[:, :, 1].mean()), 3))
for img in bpy.data.images:
    if img.source == "FILE" and not img.packed_file:
        try:
            img.pack()
        except Exception:
            pass
ob.name = "fish_betta_refined"
me.name = "fish_betta_refined"
me.use_fake_user = True


def preview(outdir):
    os.makedirs(outdir, exist_ok=True)
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 1200, 800
    sc.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.32, 0.4, 0.46, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sc.world = world
    # a translucency for the preview, as the site gives it: the fin mask
    pm = mat.copy()
    pn = pm.node_tree
    pb = next(n for n in pn.nodes if n.type == "BSDF_PRINCIPLED")
    out = next(n for n in pn.nodes if n.type == "OUTPUT_MATERIAL")
    tr = pn.nodes.new("ShaderNodeBsdfTranslucent")
    col = pb.inputs["Base Color"].links[0].from_socket
    pn.links.new(col, tr.inputs["Color"])
    fa = pn.nodes.new("ShaderNodeAttribute")
    fa.attribute_name = "fin"
    sm = pn.nodes.new("ShaderNodeMath")
    sm.operation = "MULTIPLY"
    sm.inputs[1].default_value = 0.6
    pn.links.new(fa.outputs["Fac"], sm.inputs[0])
    mx = pn.nodes.new("ShaderNodeMixShader")
    pn.links.new(sm.outputs[0], mx.inputs["Fac"])
    pn.links.new(pb.outputs["BSDF"], mx.inputs[1])
    pn.links.new(tr.outputs["BSDF"], mx.inputs[2])
    pn.links.new(mx.outputs[0], out.inputs["Surface"])
    me.materials[0] = pm
    key = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "AREA"))
    key.data.energy = 140
    key.data.size = 0.6
    key.location = (-0.9, 0.5, 0.8)
    key.rotation_euler = (Vector((0, 0, 0.2)) - key.location).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(key)
    rim = bpy.data.objects.new("Rim", bpy.data.lights.new("Rim", "AREA"))
    rim.data.energy = 90
    rim.data.size = 0.8
    rim.data.color = (1.0, 0.92, 0.75)
    rim.location = (0.9, -0.2, 0.35)
    rim.rotation_euler = (Vector((0, 0, 0.2)) - rim.location).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(rim)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.lens = 70
    cam.location = (-1.3, 0.05, 0.3)
    cam.rotation_euler = (Vector((0, 0, 0.17)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(outdir, "fish_refined.png")
    bpy.ops.render.render(write_still=True)
    me.materials[0] = mat
    for o in (key, rim, cam):
        bpy.data.objects.remove(o, do_unlink=True)
    print("PREVIEW", outdir)


if PREVIEW:
    preview(PREVIEW)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
