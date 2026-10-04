"""
Size the v7 estate's textures for the wire, per slot, before KTX2 encoding.

    python resize_estate_textures_v7.py <ex/scene.gltf>

Measured on the first export: the six normal maps were 11.9 MB of a 15.9 MB
texture payload, two of them 2048 px (the roof slate and the door leaves carried
over from P3F). A normal map on dressed stone seen from 20 m and up carries no
detail a 512 px map does not, and UASTC is the expensive codec, so normals go to
512. Colour and roughness stay at 1024, which is where a facade's tone actually
lives. Every size stays a power of two, which KTX2 requires anyway.
"""
import json
import os
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
path = sys.argv[1]
root = os.path.dirname(path)
doc = json.load(open(path))
textures, images = doc.get("textures", []), doc.get("images", [])

limit = {}


def want(tex_ref, px):
    if not tex_ref:
        return
    src = textures[tex_ref["index"]].get("source")
    if src is None:
        return
    limit[src] = min(limit.get(src, 1 << 14), px)


# A thing a hand's width across on the screen does not carry a facade's maps:
# the portico's lantern is 0.4 m of bronze, never nearer the lens than two
# metres.
SMALL = {"MAT_Lantern_Bronze": 512}

for m in doc.get("materials", []):
    pbr = m.get("pbrMetallicRoughness", {})
    cap = SMALL.get(m.get("name", ""), 1 << 14)
    want(pbr.get("baseColorTexture"), min(1024, cap))
    want(pbr.get("metallicRoughnessTexture"), min(1024, cap))
    want(m.get("normalTexture"), min(512, cap))
    # (Only the generated lantern carries one: the mask of its glass.)
    want(m.get("emissiveTexture"), min(1024, cap))

for i, img in enumerate(images):
    uri = img.get("uri")
    if not uri or i not in limit:
        continue
    p = os.path.join(root, uri)
    with Image.open(p) as im:
        w, h = im.size
        cap = limit[i]
        if max(w, h) <= cap:
            continue
        s = cap / max(w, h)
        out = im.resize((max(4, int(w * s)), max(4, int(h * s))), Image.LANCZOS)
    out.save(p)
    print("RESIZE|%s %dx%d -> %dx%d" % (uri, w, h, out.size[0], out.size[1]))
