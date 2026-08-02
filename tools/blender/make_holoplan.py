"""
Turn a printed layout sheet into hologram artwork.

The brief is "floating, glowing emissive linework against the glass, not an
opaque digital screen", so the paper has to disappear. Alpha is derived per
pixel as max(1 - luminance, saturation):

  * white paper        -> luminance 1, saturation 0 -> alpha 0   (gone)
  * black linework     -> luminance 0                -> alpha 1   (solid)
  * coloured plots     -> saturated                  -> alpha ~1  (solid)

That keeps roads reading as negative space, which is how a real plan hologram
behaves, instead of a white slab with a drawing on it.

    python make_holoplan.py <src> <dst> <crop l,t,r,b | auto> <width> [masks]

masks: semicolon-separated l,t,r,b rects in OUTPUT pixel space, forced to
alpha 0. Marketing sheets carry photos, legends and schedules that must not
float in the hologram alongside the plan.
"""
import sys, os
import numpy as np
from PIL import Image

src, dst, crop, width = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
MASKS = []
if len(sys.argv) > 5 and sys.argv[5] not in ("", "none"):
    for r in sys.argv[5].split(";"):
        MASKS.append(tuple(int(v) for v in r.split(",")))
im = Image.open(src).convert("RGB")

if crop != "auto":
    l, t, r, b = (int(v) for v in crop.split(","))
    im = im.crop((l, t, r, b))

if im.width > width:
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)

a = np.asarray(im).astype(np.float32) / 255.0
mx = a.max(axis=2)
mn = a.min(axis=2)
lum = 0.2126*a[..., 0] + 0.7152*a[..., 1] + 0.0722*a[..., 2]
sat = np.where(mx > 1e-5, (mx - mn) / np.maximum(mx, 1e-5), 0.0)

# Saturation is weighted up because the content that matters (plot fills, green
# landscape, status colours) is coloured but LIGHT - judged on luminance alone
# it survives no better than the pale grey context, which must vanish entirely.
alpha = np.maximum(1.0 - lum, sat * 1.6)
alpha = np.clip((alpha - 0.14) / 0.66, 0.0, 1.0) ** 0.80
alpha[alpha < 0.05] = 0.0

for (l, t, r, b) in MASKS:
    alpha[max(0, t):min(alpha.shape[0], b), max(0, l):min(alpha.shape[1], r)] = 0.0

# emissive holograms read better when the artwork keeps its hue but gains
# brightness - push value up where alpha is high
hsv_boost = np.clip(a * 1.18, 0.0, 1.0)
rgb = (hsv_boost * 255.0).astype(np.uint8)
out = np.dstack([rgb, (alpha * 255.0).astype(np.uint8)])

img = Image.fromarray(out, mode="RGBA")
os.makedirs(os.path.dirname(dst), exist_ok=True)
img.save(dst)
cov = float((alpha > 0.5).mean())
print("HOLO|%s|%dx%d|opaque_frac=%.3f|%.2fMB" % (
    os.path.basename(dst), img.width, img.height, cov,
    os.path.getsize(dst) / 1048576.0))
