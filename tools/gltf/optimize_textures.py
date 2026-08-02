"""
Texture pass for the web GLB.

Why this exists instead of `gltf-transform resize` / `webp`: those shell out to
sharp, and the libvips build that npx installs on this machine fails on every
PNG with "colourspace: parameter space not set". Rather than depend on a broken
binary, the whole texture stage runs in Pillow and gltf-transform is left to do
only what it does reliably here - repacking and Draco.

Run it on an UNPACKED gltf (gltf-transform copy in.glb ex/scene.gltf), then
repack. It rewrites the image URIs and mime types in place.

    python optimize_textures.py <ex/scene.gltf> [max_px] [lightmap_max_px] [fmt]

fmt is "jpeg" (default) or "png".

Encoding policy:
  * Anything with real alpha stays PNG - the hologram plates and cards depend
    on it, and JPEG would destroy them.
  * fmt=jpeg: everything else becomes JPEG. WebP would be smaller but needs
    EXT_texture_webp wired into every texture object by hand; JPEG needs no
    extension and every target browser and loader takes it.
  * fmt=png: use this when a KTX2/Basis pass runs afterwards. Handing the
    Basis encoder JPEG means it spends its bit budget reproducing someone
    else's compression artifacts, so the input has to stay lossless.
  * Normal and packed metal/rough maps carry DATA, not pictures, so under JPEG
    they get a higher quality and no chroma subsampling. Crushing them shows up
    as shading noise across large flat surfaces.
"""
import sys, os, json, glob
from PIL import Image, ImageFile

Image.MAX_IMAGE_PIXELS = None

GLTF = sys.argv[1]
MAXPX = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
LMPX = int(sys.argv[3]) if len(sys.argv) > 3 else 4096
FMT = (sys.argv[4] if len(sys.argv) > 4 else "jpeg").lower()
ROOT = os.path.dirname(GLTF)

DATA_MAPS = ("normal", "metallicRoughness", "occlusion")


def is_lightmap(name):
    return name.startswith("occlusion")


mapping, saved_before, saved_after = {}, 0, 0
for f in sorted(glob.glob(os.path.join(ROOT, "*.png")) +
                glob.glob(os.path.join(ROOT, "*.jpg")) +
                glob.glob(os.path.join(ROOT, "*.jpeg"))):
    base = os.path.basename(f)
    saved_before += os.path.getsize(f)
    im = Image.open(f)
    has_alpha = im.mode in ("RGBA", "LA", "P") and "A" in im.getbands()
    if has_alpha:
        im = im.convert("RGBA")
        has_alpha = im.getextrema()[3][0] < 255
    im = im.convert("RGBA" if has_alpha else "RGB")

    cap = LMPX if is_lightmap(base) else MAXPX
    if max(im.size) > cap:
        r = cap / float(max(im.size))
        im = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))),
                       Image.LANCZOS)

    stem = os.path.splitext(f)[0]
    if has_alpha or FMT == "png":
        out = stem + ".png"
        im.save(out, optimize=True)          # re-encoded, drops any ICC profile
    else:
        q = 93 if base.startswith(DATA_MAPS) else 88
        out = stem + ".jpg"
        # Progressive + optimize makes Pillow's encoder allocate per-scan blocks
        # it cannot size for a 4K atlas: it dies with "broken data stream".
        # Raising MAXBLOCK is the documented workaround and is still not enough
        # here, so fall back to a plain baseline encode. The size difference is
        # a few percent; failing the build over it is not worth it.
        ImageFile.MAXBLOCK = max(im.width * 4, 1 << 22)
        sub = 0 if q > 90 else 2
        try:
            im.save(out, quality=q, optimize=True, progressive=True, subsampling=sub)
        except OSError:
            im.save(out, quality=q, subsampling=sub)
    if os.path.abspath(out) != os.path.abspath(f):
        os.remove(f)
    saved_after += os.path.getsize(out)
    mapping[base] = os.path.basename(out)

doc = json.load(open(GLTF))
for img in doc.get("images", []):
    u = os.path.basename(img.get("uri", ""))
    if u in mapping:
        img["uri"] = mapping[u]
        img["mimeType"] = ("image/png" if mapping[u].endswith(".png")
                           else "image/jpeg")
json.dump(doc, open(GLTF, "w"))

print("TEX|count=%d|png=%d|jpeg=%d|%.1fMB -> %.1fMB" % (
    len(mapping),
    sum(1 for v in mapping.values() if v.endswith(".png")),
    sum(1 for v in mapping.values() if v.endswith(".jpg")),
    saved_before / 1048576.0, saved_after / 1048576.0))
