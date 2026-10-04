"""
Tripo's generated models, made assets of the estate: cleaned, set to their real
size, lightened to a web budget and filed in one library.

    blender --background --factory-startup --python tripo_assets_v7.py -- <tripo_dir> <out.blend>

WHY. The refinement brief (2026-10-03): "trees, palms, roads, cars ... must feel
like they inhabit the same physical world as the architecture"; its audits read
the scripted car as "a block". A car is the one thing on the estate that cannot
be drawn from a profile and a lathe. The client generates them (Tripo, from
prompts written for this film) into <repo>/tripo, and this turns each file that
is there into an object the build can place (build_estate_v7.py, tripo_object):
it never depends on one being there.

WHAT IS DONE TO EACH.
  * joined to one mesh, its doubled vertices welded;
  * turned so its length lies on Blender's y with its NOSE to -y, stood on
    z = 0 and centred — a generated model arrives at an arbitrary size (a unit
    box) and the right way up;
  * scaled so its length (a car) or its height (a lantern, a tree) is the real
    one, below;
  * decimated to its budget, which is set by what the model's texture seams
    will bear rather than by what the distance needs;
  * its one material renamed (MAT_<Name>), its images packed, so the estate's
    export sizes and encodes them with everything else;
  * given lighter copies (tripo_<key>_<lod>) where the estate places many of
    it, or places it far from every camera.

AND TWO THINGS A GENERATOR CANNOT KNOW. The lantern arrives hanging from a wall
bracket; the portico's hangs from its soffit by a chain, so the bracket is cut
away above the roof (trim_bracket). And its glass is painted white into the one
texture every part of it shares: a mask of that white is made here and wired as
the material's emission, so the site can light the panes and leave the bronze
dark (PorticoLantern.tsx drives its strength with the evening).
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC = argv[0]
OUT = argv[1]

# key: the file's stem. length / height in metres; tris the budget; material
# the name the build and the site know it by.
ASSETS = {
    # (Sixty-odd thousand, not twenty: collapsed further, a generated mesh's
    # texture seams pull apart and every chrome line on the car wobbles — seen
    # at 24k. The file pays in Draco bytes, a few hundred kilobytes a car.)
    #
    # `far` is a second, lighter copy (tripo_<key>_far) for a car no camera
    # comes near: across the carriage ring a centimetre of wobble is under a
    # pixel, and three cars at full weight were 186,000 triangles, an eighth of
    # everything the estate draws, twice more in its shadow maps.
    "car_saloon": {"length": 5.45, "tris": 64000, "lods": {"far": 20000}, "material": "MAT_Car_Saloon"},
    "car_classic": {"length": 4.75, "tris": 60000, "lods": {"far": 18000}, "material": "MAT_Car_Classic"},
    # 0.8 m from its foot to the top of its finial, once the bracket is off.
    "lantern": {"height": 0.8, "tris": 9000, "material": "MAT_Lantern_Bronze", "trim": "bracket", "glow": True},
    # THE PALMS ARE PLANTED BY THE DOZEN, and a generated palm is solid leaf: at
    # sixteen thousand triangles, the estate's forty-odd would be two thirds of
    # a million. Seen whole at eight thousand a crown is the same crown (tested
    # side by side); at five it is a little ragged, which across a lawn is a
    # palm; at three it is a mop. So eight where the film passes near, five for
    # the groves it does not.
    # `avenue`: the thirty-six down the drive, seen across the park and never
    # near (the refinement brief: the far palms were the scripted pole).
    "palm_royal": {"height": 14.0, "tris": 8000, "lods": {"avenue": 2600}, "material": "MAT_Palm_Royal"},
    "palm_coconut": {"height": 10.5, "tris": 8000, "lods": {"far": 5000}, "material": "MAT_Palm_Coconut"},
}


def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def world_box(o):
    # From the vertices, not o.bound_box: that is cached, and stale after a
    # mesh has been cut (the lantern was sized by the height of its bracket).
    ws = [o.matrix_world @ v.co for v in o.data.vertices]
    return (Vector((min(w.x for w in ws), min(w.y for w in ws), min(w.z for w in ws))),
            Vector((max(w.x for w in ws), max(w.y for w in ws), max(w.z for w in ws))))


def trim_bracket(ob):
    """Cut a hanging lantern free of the wall bracket it was generated on: an
    arm that runs up one side of the body from its foot, over the roof, and
    curls away above the finial.

    The lantern is a turned and six-sided thing: whatever it has on one side of
    its axis it has on the other. The bracket is on one side only (+x, as the
    generator stood it). So the axis is taken from the foot, which the arm does
    not reach, and at every height the body is as wide toward +x as it is toward
    -x: anything beyond that is the bracket. Above the finial there is nothing
    on the far side at all, and so nothing is kept. (The first cut kept a
    cylinder round the middle of the lower half - which the arm was part of, so
    it measured the lantern as wide as its own bracket and left the arm on.)"""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    zs = [v.co.z for v in bm.verts]
    z0, H = min(zs), max(zs) - min(zs)
    foot = [v.co for v in bm.verts if v.co.z < z0 + 0.06 * H]
    cx = (min(c.x for c in foot) + max(c.x for c in foot)) / 2
    cy = (min(c.y for c in foot) + max(c.y for c in foot)) / 2
    BANDS = 48
    reach = [-1.0] * BANDS      # how far the body stands toward -x, per height
    band = lambda z: min(BANDS - 1, max(0, int((z - z0) / H * BANDS)))
    for v in bm.verts:
        k = band(v.co.z)
        reach[k] = max(reach[k], cx - v.co.x)
    # A band is as wide as its neighbours at least: a chamfer's own band can
    # hold one side's vertices and not the other's.
    wide = [max(reach[max(0, k - 1):k + 2]) for k in range(BANDS)]
    doomed = []
    for f in bm.faces:
        c = f.calc_center_median()
        if c.x - cx > wide[band(c.z)] * 1.03 + 0.004 * H:
            doomed.append(f)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    # What the cut left hanging in the air: every island but the lantern.
    seen, islands = set(), []
    for v in bm.verts:
        if v in seen:
            continue
        stack, island = [v], []
        seen.add(v)
        while stack:
            q = stack.pop()
            island.append(q)
            for e in q.link_edges:
                o = e.other_vert(q)
                if o not in seen:
                    seen.add(o)
                    stack.append(o)
        islands.append(island)
    biggest = max(len(i) for i in islands)
    loose = [v for i in islands if len(i) < 0.04 * biggest for v in i]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=12)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((-cx, -cy, 0.0)))
    bm.to_mesh(me)
    bm.free()
    me.update()
    print("TRIPO|trim_bracket: %d faces cut, %d loose verts, axis at (%.3f, %.3f)" % (len(doomed), len(loose), cx, cy))


def glow_mask(mat, key):
    """An emission map for a lantern whose glass is painted into its one
    texture: white where the base colour is pale and without hue (the panes,
    the candles), black on the bronze. Wired to the material's emission at
    strength 1, which the exporter writes as an emissive texture."""
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    link = bsdf.inputs["Base Color"].links
    if not link or link[0].from_node.type != "TEX_IMAGE":
        print("TRIPO|glow: no base colour image on", mat.name)
        return
    src_node = link[0].from_node
    src = src_node.image
    w, h = src.size
    px = np.empty(w * h * 4, dtype=np.float32)
    src.pixels.foreach_get(px)
    rgb = px.reshape(h, w, 4)[..., :3]
    hi, lo = rgb.max(axis=2), rgb.min(axis=2)
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    sat = (hi - lo) / np.maximum(hi, 1e-4)

    def step(e0, e1, x):
        t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
        return t * t * (3 - 2 * t)

    mask = step(0.42, 0.62, lum) * (1.0 - step(0.16, 0.34, sat))
    out = np.ones((h, w, 4), dtype=np.float32)
    out[..., :3] = mask[..., None]
    img = bpy.data.images.new("tripo_%s_glow" % key, w, h, alpha=False)
    img.pixels.foreach_set(out.ravel())
    img.pack()
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.location = (src_node.location.x, src_node.location.y - 320)
    for l in src_node.inputs["Vector"].links:
        nt.links.new(l.from_socket, node.inputs["Vector"])
    nt.links.new(node.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    print("TRIPO|glow: %s, %.1f%% of the texture lit" % (img.name, 100.0 * float((mask > 0.5).mean())))


def make(key, spec):
    path = os.path.join(SRC, key + ".glb")
    if not os.path.exists(path):
        return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    if not meshes:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    # Free of the importer's parents, with the transform in the mesh.
    mw = ob.matrix_world.copy()
    ob.parent = None
    ob.matrix_world = mw
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o is not ob and o.name in bpy.data.objects:
            bpy.data.objects.remove(o)

    me = ob.data
    raw = tri_count(me)
    bm = bmesh.new()
    bm.from_mesh(me)
    lo, hi = world_box(ob)
    span = max(hi - lo)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=span * 1e-5)
    bm.to_mesh(me)
    bm.free()

    if spec.get("trim") == "bracket":
        trim_bracket(ob)

    # Size, and the ground. A car's length is its longest side and lies on y
    # (glTF's z arrives as Blender's -y, nose first); anything else is sized by
    # its height.
    lo, hi = world_box(ob)
    size = hi - lo
    if "length" in spec:
        if size.x > size.y:
            ob.matrix_world = Matrix.Rotation(math.radians(90), 4, "Z") @ ob.matrix_world
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            lo, hi = world_box(ob)
            size = hi - lo
        k = spec["length"] / size.y
    else:
        k = spec["height"] / size.z
    centre = (lo + hi) / 2
    ob.matrix_world = Matrix.Diagonal((k, k, k, 1)) @ Matrix.Translation((-centre.x, -centre.y, -lo.z))
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # The budget.
    now = tri_count(me)
    if now > spec["tris"]:
        mod = ob.modifiers.new("budget", "DECIMATE")
        mod.ratio = spec["tris"] / now
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in me.polygons:
        p.use_smooth = True

    ob.name = "tripo_" + key
    me.name = "tripo_" + key
    for m in me.materials:
        if m:
            m.name = spec["material"]
    lo, hi = world_box(ob)
    print("TRIPO|%s: %d -> %d tris, %.2f x %.2f x %.2f m, materials %s"
          % (key, raw, tri_count(me), hi.x - lo.x, hi.y - lo.y, hi.z - lo.z, [m.name for m in me.materials if m]))
    if spec.get("glow"):
        for m in me.materials:
            if m:
                glow_mask(m, key)
    made = [ob]
    for lod, budget in spec.get("lods", {}).items():
        if tri_count(me) <= budget:
            continue
        light = ob.copy()
        light.data = me.copy()
        bpy.context.scene.collection.objects.link(light)
        bpy.ops.object.select_all(action="DESELECT")
        light.select_set(True)
        bpy.context.view_layer.objects.active = light
        mod = light.modifiers.new(lod, "DECIMATE")
        mod.ratio = budget / tri_count(light.data)
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        light.name = light.data.name = "tripo_%s_%s" % (key, lod)
        print("TRIPO|%s_%s: %d tris" % (key, lod, tri_count(light.data)))
        made.append(light)
    return made


bpy.ops.wm.read_factory_settings(use_empty=True)
made = [o for group in (make(k, s) for k, s in ASSETS.items()) if group for o in group]
if not made:
    print("TRIPO|nothing to make in", SRC)
else:
    # Keep the objects against Blender's purge, and their images in the file.
    for o in made:
        o.use_fake_user = True
        o.data.use_fake_user = True
    bpy.ops.file.pack_all()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    print("TRIPO|saved", OUT, [o.name for o in made])
