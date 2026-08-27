"""
Bind the KTX2-safe padded textures and compensate UVs; drop invalid anisotropy.

TEXTURES
    The four padded files carry the same artwork with edge-replicated padding
    on the PIL top and right, so in UV space the artwork sits at U 0..w/W and
    V 0..h/H, both anchored at zero. Scaling the sampling meshes' UVs by that
    ratio makes UV 0..1 address exactly the original artwork again - no offset
    term, no KHR_texture_transform, no crop.

    Only the loops whose polygon uses the material that samples the texture are
    scaled, so the block sides (MAT_Holo3D_Side) keep their own mapping.

    Image DATABLOCK names are left alone. glTF takes its image names from them,
    and the web build refers to kartikeya_holo_tex / lucky_holo_tex /
    gayatri_holo_tex / founder_portrait_graded by those names.

ANISOTROPY
    MAT_Gold exported KHR_materials_anisotropy (strength 0.4, rotation 0.94) on
    geometry with no TANGENT attribute. Undefined tangents make the anisotropic
    lobe evaluate to NaN, which the bloom pass then smears across the frame.

    MAT_Gold samples the gilt_aged set - aged gold leaf, not a brushed metal.
    Anisotropy is not part of that look and reads as a leftover default, so the
    correct fix is to remove it rather than ship tangents for an effect the
    material never wanted. Removing it also drops the extension from the GLB,
    so the web build's runtime guard is no longer needed.

    blender --background <file.blend> --python apply_ktx2_safe_textures.py
"""
import bpy, os, json

D = bpy.data
SAFE = r"C:\dev\estate\assets\floorplans\ktx2_safe"

# image datablock -> (padded file, uv scale u, uv scale v, materials sampling it)
BIND = {
    "kartikeya_holo_tex.png": ("kartikeya_holo_tex.png", 0.995989, 0.995879,
                               ("MAT_Holo3D_Plate_S1", "MAT_Holo3D_Top_S1")),
    "lucky_holo_tex.png":     ("lucky_holo_tex.png",     1.0,      0.998355,
                               ("MAT_Holo3D_Plate_S2", "MAT_Holo3D_Top_S2")),
    "gayatri_holo_tex.png":   ("gayatri_holo_tex.png",   1.0,      0.995902,
                               ("MAT_Holo3D_Plate_S3", "MAT_Holo3D_Top_S3")),
    "founder_portrait_graded": ("founder_portrait_graded.png", 0.997396, 1.0,
                                ("MAT_Portrait",)),
}

report = {"rebound": {}, "uv_scaled": [], "anisotropy": {}, "skipped": []}

for dbname, (fname, su, sv, mats) in BIND.items():
    img = D.images.get(dbname)
    path = os.path.join(SAFE, fname)
    if img is None or not os.path.exists(path):
        report["skipped"].append(dbname)
        continue
    img.source = 'FILE'
    img.filepath = path
    img.reload()
    report["rebound"][dbname] = {"filepath": path, "size": list(img.size),
                                 "div4": (img.size[0] % 4 == 0 and img.size[1] % 4 == 0),
                                 "colorspace": img.colorspace_settings.name}

    if su == 1.0 and sv == 1.0:
        continue
    live = {m for m in mats if D.materials.get(m)}
    seen = set()
    for o in D.objects:
        if o.type != 'MESH' or not o.data or not o.data.uv_layers:
            continue
        me = o.data
        if me.name in seen:
            continue
        idxs = {i for i, m in enumerate(me.materials) if m and m.name in live}
        if not idxs:
            continue
        uvl = me.uv_layers[0]
        touched = 0
        for poly in me.polygons:
            if poly.material_index not in idxs:
                continue
            for li in poly.loop_indices:
                u, v = uvl.data[li].uv
                uvl.data[li].uv = (u * su, v * sv)
                touched += 1
        if touched:
            seen.add(me.name)
            report["uv_scaled"].append({"object": o.name, "mesh": me.name,
                                        "loops": touched,
                                        "scale": [round(su, 6), round(sv, 6)]})

# ---- MAT_Gold: remove anisotropy it has no tangents to evaluate -----------
m = D.materials.get("MAT_Gold")
if m and m.use_nodes:
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b:
        before = {}
        for k in ("Anisotropic", "Anisotropic Rotation", "Tangent"):
            if k in b.inputs and hasattr(b.inputs[k], "default_value"):
                v = b.inputs[k].default_value
                before[k] = round(v, 4) if isinstance(v, float) else list(v)[:3]
        for k in ("Anisotropic", "Anisotropic Rotation"):
            if k in b.inputs:
                b.inputs[k].default_value = 0.0
        after = {k: round(b.inputs[k].default_value, 4)
                 for k in ("Anisotropic", "Anisotropic Rotation") if k in b.inputs}
        report["anisotropy"] = {"material": "MAT_Gold", "before": before, "after": after}

bpy.ops.wm.save_mainfile()
report["saved"] = D.filepath
print("###KTX2SAFE###")
print(json.dumps(report, indent=1))
