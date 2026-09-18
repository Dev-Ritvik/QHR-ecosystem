"""
Round every image in an unpacked glTF to multiple-of-four dimensions.

WHY IT EXISTS. ETC1S and UASTC encode in 4x4 blocks, and a KTX2 level whose
width or height is not a multiple of four fails its compressed upload in the
browser: Chrome logs "THREE.KTX2Loader: ETC1S and UASTC textures should use
multiple-of-four dimensions" and then ~80 GL_INVALID_OPERATION per load, and the
texture renders as nothing. That shipped once — the founder's portrait and all
three site plans arrived with no artwork — because optimize_textures.py resizes
proportionally and int() truncation landed on 766x1024, 745x725, 1024x607 and
1024x729.

Those four are pre-sized at source now (tools/gltf/pad_ktx2_safe.py), but any
future texture whose aspect ratio lands badly under the cap would do the same
thing silently. So the pipeline checks rather than trusts.

RESIZED, NOT PADDED. The correction is at most three pixels on a side, which at
1024 is under 0.4% — invisible, and it needs no UV compensation. Padding would
be exact in the pixels it keeps but would need every sampling mesh's UVs scaled
to match, which is the kind of change that goes wrong in one material and stays
wrong.

    python round4_textures.py <ex/scene.gltf>
"""
import sys, os, json, glob

from PIL import Image

Image.MAX_IMAGE_PIXELS = None

GLTF = sys.argv[1]
ROOT = os.path.dirname(GLTF)

fixed = []
for f in sorted(glob.glob(os.path.join(ROOT, "*.png")) +
                glob.glob(os.path.join(ROOT, "*.jpg")) +
                glob.glob(os.path.join(ROOT, "*.jpeg"))):
    with Image.open(f) as im:
        w, h = im.size
        W, H = max(4, round(w / 4) * 4), max(4, round(h / 4) * 4)
        if (W, H) == (w, h):
            continue
        out = im.resize((W, H), Image.LANCZOS)
    out.save(f)
    fixed.append("%s %dx%d->%dx%d" % (os.path.basename(f), w, h, W, H))

print("ROUND4|fixed=%d%s" % (len(fixed), ("|" + "; ".join(fixed)) if fixed else ""))
