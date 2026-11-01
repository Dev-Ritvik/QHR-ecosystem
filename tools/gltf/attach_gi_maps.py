"""Put the baked light (tools/blender/bake_estate_gi_v7.py) on the estate's materials.

    python attach_gi_maps.py <ex/scene.gltf> <gi_arch.png> <gi_ground.png>

Run on the unpacked glTF, before the textures are encoded. Each material with one of
the occlusion atlases takes the matching GI map in its emissive slot, on the same UV:
glTF has no slot for a second light map, the emissive slot is otherwise unused on these
materials, its factor stays black (so anything else reading the file sees no glow), and
exteriorGI.ts reads it for what it is. sRGB-encoded, which the encoder gives that slot.
"""
import json
import os
import shutil
import sys

GLTF, ARCH, GROUND = sys.argv[1:4]
ROOT = os.path.dirname(GLTF)
doc = json.load(open(GLTF))
images = doc["images"]
textures = doc["textures"]


def add(path, name):
    uri = name + ".png"
    shutil.copyfile(path, os.path.join(ROOT, uri))
    images.append({"uri": uri, "mimeType": "image/png", "name": name})
    textures.append({"source": len(images) - 1, **({"sampler": textures[0]["sampler"]} if "sampler" in textures[0] else {})})
    return len(textures) - 1


made = {}
count = {"arch": 0, "ground": 0}
for m in doc["materials"]:
    occ = m.get("occlusionTexture")
    if not occ:
        continue
    img = images[textures[occ["index"]]["source"]]
    label = (img.get("name") or img.get("uri") or "").lower()
    kind = "arch" if "ao_arch" in label else "ground" if "ao_ground" in label else None
    if kind is None:
        continue
    if kind not in made:
        made[kind] = add(ARCH if kind == "arch" else GROUND, "gi_" + kind)
    info = {"index": made[kind]}
    if occ.get("texCoord"):
        info["texCoord"] = occ["texCoord"]
    m["emissiveTexture"] = info
    m["emissiveFactor"] = [0.0, 0.0, 0.0]
    count[kind] += 1
json.dump(doc, open(GLTF, "w"))
print("GI maps attached", count)
