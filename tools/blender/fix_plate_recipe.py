"""
Restore the PLATE node recipe on the S3 and S4 hologram plates.

MAT_Holo3D_Plate_S1/S2 are built one way (transparent + emission + mix), and
MAT_Holo3D_Top_S1/S2 another (the same plus a MATH node shaping the mix). The
S3 plate was authored with the TOP recipe by mistake, and S4 was cloned from S3,
so on both stations the plate and the block-top are structurally identical
materials. glTF dedup then legitimately merges them, and the station binding
names MAT_Holo3D_Plate_S3 / _S4 disappear from the shipped file.

Rebuilding the two plates from the Plate_S1 template restores the "same
structural recipe" the brief asks for, keeps plate and top distinct, and lets
the documented dedup pass run with materials enabled.

    blender --background mansion_web.blend --python fix_plate_recipe.py
"""
import bpy, json

D = bpy.data
TEMPLATE = D.materials["MAT_Holo3D_Plate_S1"]

# station -> the floorplan the plate carries. S4 has no published project, so it
# ships dark: no image and no emission.
PLATES = {"S3": "gayatri_holo_tex.png", "S4": None}

report = {}
for s, imgname in PLATES.items():
    target = "MAT_Holo3D_Plate_%s" % s
    old = D.materials.get(target)
    users = []
    for o in D.objects:
        if o.type != 'MESH' or not o.data:
            continue
        for i, m in enumerate(o.data.materials):
            if m is old:
                users.append((o, i))

    new = TEMPLATE.copy()
    tmp = new.name
    if old is not None:
        D.materials.remove(old)
    new.name = target

    img = D.images.get(imgname) if imgname else None
    for n in new.node_tree.nodes:
        if n.type == 'TEX_IMAGE':
            n.image = img
        if n.type == 'EMISSION' and img is None:
            n.inputs['Strength'].default_value = 0.0
    for o, i in users:
        o.data.materials[i] = new

    report[target] = {
        "rebuilt_from": TEMPLATE.name,
        "texture": img.name if img else None,
        "slots_rebound": len(users),
        "nodes": sorted(x.type for x in new.node_tree.nodes),
    }

# plate and top must now be structurally different on every station
for s in ("S1", "S2", "S3", "S4"):
    p = D.materials.get("MAT_Holo3D_Plate_%s" % s)
    t = D.materials.get("MAT_Holo3D_Top_%s" % s)
    report.setdefault("distinct", {})["%s" % s] = {
        "plate_nodes": sorted(x.type for x in p.node_tree.nodes) if p else None,
        "top_nodes": sorted(x.type for x in t.node_tree.nodes) if t else None,
        "structurally_different": (sorted(x.type for x in p.node_tree.nodes) !=
                                   sorted(x.type for x in t.node_tree.nodes)) if p and t else None,
    }

bpy.ops.wm.save_mainfile()
print("###PLATEFIX###")
print(json.dumps(report, indent=1))
