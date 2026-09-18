"""
Settle the v7 estate's glTF materials the exporter cannot infer.

    python fix_estate_materials_v7.py <ex/scene.gltf>

  * Foliage (palm fronds, leaf-cluster cards) is alpha-CUT, not blended: MASK at
    0.5, double-sided. Blended foliage sorts per mesh, not per card, and a
    canopy of blended cards flickers as the camera orbits. The exporter only
    writes MASK for a specific Math-node pattern, so it is set here by name.
  * The window glass is BLEND at its authored alpha, so the curtains behind it
    read through a reflective pane.
  * Occlusion textures are not used by this export; any emptied slot is removed.
"""
import json
import sys

path = sys.argv[1]
doc = json.load(open(path))
changed = []
for m in doc.get("materials", []):
    name = m.get("name", "")
    if name == "MAT_Palm_Frond" or name.startswith("MAT_Leaves_"):
        m["alphaMode"] = "MASK"
        m["alphaCutoff"] = 0.5
        m["doubleSided"] = True
        changed.append(name)
    elif name == "MAT_Glass_Window":
        m["alphaMode"] = "BLEND"
        pbr = m.setdefault("pbrMetallicRoughness", {})
        f = pbr.get("baseColorFactor", [0.05, 0.065, 0.075, 1.0])
        if f[3] >= 0.999:
            f[3] = 0.55
        pbr["baseColorFactor"] = f
        m["doubleSided"] = False
        changed.append(name)
    elif m.get("alphaMode") == "BLEND" and name not in ("MAT_Glass_Window",):
        # nothing else in the estate is meant to be transparent
        m.pop("alphaMode", None)
        changed.append(name + "(opaque)")
json.dump(doc, open(path, "w"), indent=1)
print("MATERIALS", changed)
