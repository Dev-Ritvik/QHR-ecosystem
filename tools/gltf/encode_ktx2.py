"""
KTX2 / Basis encode for an unpacked glTF, driving `ktx create` directly.

gltf-transform's own etc1s/uastc commands are not usable here: 4.4.2 invokes
`ktx create --assign-oetf`, which KTX-Software v5 renamed to --assign-tf, so
every texture fails. Rather than pin an older KTX, this calls ktx itself and
wires KHR_texture_basisu into the document by hand.

Codec choice is per slot, because the trade is not the same for every map:

  * normalTexture -> UASTC. Normals are a direction field; ETC1S quantises the
    endpoints hard enough to produce visible faceting across large flat walls.
  * everything else -> ETC1S. On the 4K lightmap atlas ETC1S lands at 1.1MB
    against 7.1MB for UASTC, and the atlas is mostly smooth low-frequency
    light, which is what ETC1S handles well. Paying 6MB there would be spent
    on gradients nobody can see.

Transfer function matters and is easy to get wrong. baseColor and emissive are
colour and get sRGB. normal, metallicRoughness are data and get linear. The
LIGHTMAP is the awkward one: it rides in the occlusion slot but holds
sRGB-ENCODED light (the bake normalises then applies the sRGB curve for
precision), so it is encoded sRGB here and must be declared SRGBColorSpace in
three.js after aoMap is promoted to lightMap.

    python encode_ktx2.py <ex/scene.gltf>
"""
import sys, os, json, subprocess, shutil
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

GLTF = sys.argv[1]
ROOT = os.path.dirname(GLTF)
KTX = shutil.which("ktx") or r"C:\Program Files\KTX-Software\bin\ktx.exe"
if not os.path.exists(KTX) and not shutil.which("ktx"):
    raise SystemExit("ktx not found - install KTX-Software and put it on PATH")

doc = json.load(open(GLTF))
textures = doc.get("textures", [])
images = doc.get("images", [])

# image index -> slot. Data slots win over colour slots when an image is shared,
# because mis-encoding a normal map as sRGB is far more visible than the reverse.
PRIORITY = {"normalTexture": 0, "metallicRoughnessTexture": 1,
            "occlusionTexture": 2, "baseColorTexture": 3, "emissiveTexture": 4}
slot_of = {}


def note(tex_index, slot):
    if tex_index is None or tex_index >= len(textures):
        return
    src = textures[tex_index].get("source")
    if src is None:
        return
    cur = slot_of.get(src)
    if cur is None or PRIORITY[slot] < PRIORITY[cur]:
        slot_of[src] = slot


for m in doc.get("materials", []):
    pbr = m.get("pbrMetallicRoughness", {})
    note((pbr.get("baseColorTexture") or {}).get("index"), "baseColorTexture")
    note((pbr.get("metallicRoughnessTexture") or {}).get("index"),
         "metallicRoughnessTexture")
    note((m.get("normalTexture") or {}).get("index"), "normalTexture")
    note((m.get("occlusionTexture") or {}).get("index"), "occlusionTexture")
    note((m.get("emissiveTexture") or {}).get("index"), "emissiveTexture")

SRGB_SLOTS = {"baseColorTexture", "emissiveTexture", "occlusionTexture"}
UASTC_SLOTS = {"normalTexture"}

before = after = 0
done = 0
for i, img in enumerate(images):
    uri = img.get("uri")
    if not uri or uri.lower().endswith(".ktx2"):
        continue
    src = os.path.join(ROOT, uri)
    if not os.path.exists(src):
        continue
    slot = slot_of.get(i, "baseColorTexture")
    with Image.open(src) as im:
        alpha = im.mode in ("RGBA", "LA") and im.getextrema()[-1][0] < 255
    srgb = slot in SRGB_SLOTS
    fmt = ("R8G8B8A8_" if alpha else "R8G8B8_") + ("SRGB" if srgb else "UNORM")
    dst = os.path.splitext(src)[0] + ".ktx2"

    cmd = [KTX, "create", "--format", fmt,
           "--assign-tf", "srgb" if srgb else "linear",
           "--generate-mipmap"]
    if slot in UASTC_SLOTS:
        cmd += ["--encode", "uastc", "--zstd", "18"]
    else:
        cmd += ["--encode", "basis-lz", "--qlevel", "255"]
    cmd += [src, dst]

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise SystemExit("ktx failed on %s (%s)\n%s" % (uri, slot, r.stderr[-600:]))

    before += os.path.getsize(src)
    after += os.path.getsize(dst)
    os.remove(src)
    img["uri"] = os.path.basename(dst)
    img["mimeType"] = "image/ktx2"
    done += 1
    print("KTX|%-26s %-24s %-6s %6.2fMB" % (
        os.path.basename(dst), slot,
        "uastc" if slot in UASTC_SLOTS else "etc1s",
        os.path.getsize(dst) / 1048576.0))

# A KTX2 image is only reachable through the extension. Move source into
# KHR_texture_basisu and drop the plain source, since there is no PNG fallback.
for t in textures:
    src = t.get("source")
    if src is None or not images[src].get("uri", "").endswith(".ktx2"):
        continue
    t.setdefault("extensions", {})["KHR_texture_basisu"] = {"source": src}
    t.pop("source", None)

used = doc.setdefault("extensionsUsed", [])
req = doc.setdefault("extensionsRequired", [])
for lst in (used, req):
    if "KHR_texture_basisu" not in lst:
        lst.append("KHR_texture_basisu")

json.dump(doc, open(GLTF, "w"))
print("KTX2|images=%d|%.1fMB -> %.1fMB" % (done, before / 1048576.0,
                                           after / 1048576.0))
