"""
Clamp material scalars to the ranges glTF actually allows.

Blender is looser than the spec. MAT_Wood_Dark drives its roughness through a
multiply, and the exporter folds that into roughnessFactor as 1.05 - Cycles
clamps it silently, glTF calls it an error. Clamping the Principled socket in
Blender does not catch it, because the value is not a socket default; it only
exists once the exporter has flattened the node chain. So it has to be fixed
here, on the exported document.

    python fix_ranges.py <ex/scene.gltf>
"""
import sys, json

GLTF = sys.argv[1]
doc = json.load(open(GLTF))
fixed = []


def clamp(holder, key, lo, hi, label):
    if not isinstance(holder, dict) or key not in holder:
        return
    v = holder[key]
    if isinstance(v, (int, float)) and not (lo <= v <= hi):
        holder[key] = min(hi, max(lo, float(v)))
        fixed.append("%s.%s %s->%s" % (label, key, v, holder[key]))
    elif isinstance(v, list):
        out = [min(hi, max(lo, float(x))) if isinstance(x, (int, float)) else x
               for x in v]
        if out != v:
            holder[key] = out
            fixed.append("%s.%s %s->%s" % (label, key, v, out))


for i, m in enumerate(doc.get("materials", [])):
    label = m.get("name", "material[%d]" % i)
    pbr = m.get("pbrMetallicRoughness")
    if isinstance(pbr, dict):
        clamp(pbr, "metallicFactor", 0.0, 1.0, label)
        clamp(pbr, "roughnessFactor", 0.0, 1.0, label)
        clamp(pbr, "baseColorFactor", 0.0, 1.0, label)
    clamp(m, "emissiveFactor", 0.0, 1.0, label)
    clamp(m.get("occlusionTexture"), "strength", 0.0, 1.0, label)

    ext = m.get("extensions", {})
    clamp(ext.get("KHR_materials_transmission"), "transmissionFactor", 0.0, 1.0, label)
    clamp(ext.get("KHR_materials_specular"), "specularFactor", 0.0, 1.0, label)
    clamp(ext.get("KHR_materials_specular"), "specularColorFactor", 0.0, 1.0, label)
    clamp(ext.get("KHR_materials_clearcoat"), "clearcoatFactor", 0.0, 1.0, label)
    clamp(ext.get("KHR_materials_clearcoat"), "clearcoatRoughnessFactor", 0.0, 1.0, label)
    clamp(ext.get("KHR_materials_sheen"), "sheenColorFactor", 0.0, 1.0, label)
    clamp(ext.get("KHR_materials_sheen"), "sheenRoughnessFactor", 0.0, 1.0, label)
    clamp(ext.get("KHR_materials_iridescence"), "iridescenceFactor", 0.0, 1.0, label)
    clamp(ext.get("KHR_materials_ior"), "ior", 1.0, 50.0, label)

json.dump(doc, open(GLTF, "w"))
print("RANGES|fixed=%d%s" % (len(fixed), ("|" + "; ".join(fixed)) if fixed else ""))
