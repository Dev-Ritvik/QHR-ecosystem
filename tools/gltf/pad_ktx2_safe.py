"""
Pad four textures up to KTX2-safe dimensions (every side divisible by 4).

Chrome rejects the Basis upload when a KTX2 level is not a multiple of 4 on
both axes. Three of these come out odd because optimize_textures.py resizes
proportionally with int() truncation:

    gayatri  2400x1710 -> 1024x729     lucky   2048x1214 -> 1024x607
    portrait 1024x1368 ->  766x1024    kartikeya is already odd at source

Fixing it at source means pre-sizing each file to the dimensions that currently
ship, then PADDING up. Because the results are all <= the 1024 cap, the
pipeline's `if max(im.size) > cap` test is false and optimize_textures leaves
them alone - so nothing about the established pipeline changes.

The artwork is never cropped and never re-scaled beyond the resize the pipeline
was already doing, so the visible pixels are identical to what is deployed now.
Padding is edge-replication (not a colour fill), so no border appears even if a
sampler reaches into it.

Padding goes on the PIL TOP and RIGHT. In glTF UV space that puts the artwork
at U 0..w/W and V 0..h/H - both anchored at zero - so callers only need to
scale UVs by that ratio, with no offset term.

    python pad_ktx2_safe.py
"""
from PIL import Image
import os, json

FLOOR = r"C:\dev\estate\assets\floorplans"
BRAND = r"C:\dev\estate\assets\brand"
OUTDIR = r"C:\dev\estate\assets\floorplans\ktx2_safe"
os.makedirs(OUTDIR, exist_ok=True)

# src, shipped size (what deploys today), padded target, output path
JOBS = [
    (os.path.join(FLOOR, "kartikeya_holo_tex.png"), (745, 725),  (748, 728),
     os.path.join(OUTDIR, "kartikeya_holo_tex.png")),
    (os.path.join(FLOOR, "lucky_holo_tex.png"),     (1024, 607), (1024, 608),
     os.path.join(OUTDIR, "lucky_holo_tex.png")),
    (os.path.join(FLOOR, "gayatri_holo_tex.png"),   (1024, 729), (1024, 732),
     os.path.join(OUTDIR, "gayatri_holo_tex.png")),
    (os.path.join(BRAND, "founder_portrait_graded.png"), (766, 1024), (768, 1024),
     os.path.join(OUTDIR, "founder_portrait_graded.png")),
]


def edge_pad(im, target):
    """Pad to target with replicated edge pixels; artwork sits bottom-left in
    PIL terms (pad on top and right)."""
    w, h = im.size
    W, H = target
    assert W >= w and H >= h, "padding must not shrink"
    pad_x, pad_y = W - w, H - h
    out = Image.new(im.mode, (W, H))
    out.paste(im, (0, pad_y))
    if pad_y:                      # replicate the artwork's top row upward
        row = out.crop((0, pad_y, W, pad_y + 1))
        for y in range(pad_y):
            out.paste(row, (0, y))
    if pad_x:                      # replicate the artwork's right column
        col = out.crop((w - 1, 0, w, H))
        for x in range(w, W):
            out.paste(col, (x, 0))
    return out, pad_x, pad_y


report = []
for src, shipped, target, dst in JOBS:
    im = Image.open(src)
    orig = im.size
    mode = im.mode
    if im.size != shipped:
        # exactly the resize optimize_textures would have done (LANCZOS)
        im = im.resize(shipped, Image.LANCZOS)
    padded, px, py = edge_pad(im, target)
    padded.save(dst, optimize=True)
    W, H = padded.size
    report.append({
        "name": os.path.basename(dst),
        "source": list(orig),
        "shipped_before": list(shipped),
        "padded_to": [W, H],
        "div4": (W % 4 == 0 and H % 4 == 0),
        "pad_px": {"right": px, "top": py},
        "mode": mode,
        "has_alpha": mode in ("RGBA", "LA"),
        # callers scale mesh UVs by this; both axes anchored at 0
        "uv_scale": [round(shipped[0] / W, 6), round(shipped[1] / H, 6)],
        "kb": round(os.path.getsize(dst) / 1024, 1),
    })

print("###PAD###")
print(json.dumps(report, indent=1))
