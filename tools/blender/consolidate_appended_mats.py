"""
Fold the .001 material copies the append created back onto their originals.

Appending the S4 hologram from the master brought its own copies of the shared
holo materials (MAT_Holo3D_Card.001, _Rule.001, _Side.001, _Sub.001, _Text.001).
They are identical in purpose to the originals, and leaving them costs extra
draw calls and forces the glTF dedup pass to rename materials the web binds by.

Only exact-suffix duplicates whose base name still exists are folded, and only
for the shared holo set - per-station materials (_Plate_S*, _Top_S*) are never
touched, because their names ARE the station binding contract.

    blender --background mansion_web.blend --python consolidate_appended_mats.py
"""
import bpy, re, json

D = bpy.data
SAFE = re.compile(r'^(MAT_Holo3D_(Card|Rule|Side|Sub|Text))\.\d{3}$')

folded, skipped = [], []
for m in list(D.materials):
    mo = SAFE.match(m.name)
    if not mo:
        if re.search(r'\.\d{3}$', m.name):
            skipped.append(m.name)
        continue
    base = D.materials.get(mo.group(1))
    if base is None or base is m:
        continue
    users = 0
    for o in D.objects:
        if o.type != 'MESH' or not o.data:
            continue
        for i, mm in enumerate(o.data.materials):
            if mm is m:
                o.data.materials[i] = base
                users += 1
    folded.append({"from": m.name, "to": base.name, "slots_remapped": users})
    D.materials.remove(m)

# station-binding materials must survive verbatim
contract = {}
for s in ("S1", "S2", "S3", "S4"):
    for kind in ("Plate", "Top"):
        n = "MAT_Holo3D_%s_%s" % (kind, s)
        contract[n] = n in D.materials

bpy.ops.wm.save_mainfile()
print("###CONSOLIDATE###")
print(json.dumps({
    "folded": folded,
    "left_alone_with_suffix": sorted(skipped),
    "station_material_contract": contract,
    "holo_materials_now": sorted(m.name for m in D.materials if "Holo" in m.name),
}, indent=1))
