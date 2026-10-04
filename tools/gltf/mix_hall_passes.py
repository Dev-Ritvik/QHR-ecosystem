r"""
Mix the hall's two finished light passes into the shipped atlas, at a balance.

    python mix_hall_passes.py <lamps.npy> <sky.npy> <out.png>
        [--lamps A] [--sky B] [--lamp-tint r,g,b] [--sky-tint r,g,b]
        [--scale S] [--jpeg <preview.jpg>]

The room's light is baked as two families (tools/blender/
rebake_hall_lightmap_v7.py: the lamps; the windows and the oculus), and each is
denoised and dilated on its own (finish_hall_lightmap.py --save-float). Light
adds, so the room at any hour is a weighted sum of the two, and a tint on a
family re-colours its sources exactly, every bounce being linear in the light
that began it. This does the sum and the last two steps of the finish: the
normalisation by the 99.5th percentile of the lit texels (the divisor is
printed and must become LIGHTMAP_INTENSITY in HallModel.tsx, and the
manifest's), and the sRGB encode with a half-LSB dither.

Balancing is then a matter of seconds, not of an hour's bake: --jpeg writes a
small preview that a capture script can hand a running debug build (with
?debug=1 the scene and three are on window.__estate: load it, give it the old
atlas's channel and flipY, and put it on every material that has a lightMap),
so two balances can be compared in the room itself before one is encoded.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ap = argparse.ArgumentParser()
ap.add_argument("lamps")
ap.add_argument("sky")
ap.add_argument("out_png")
ap.add_argument("--lamps", dest="a", type=float, default=1.0)
ap.add_argument("--sky", dest="b", type=float, default=1.0)
ap.add_argument("--lamp-tint", default="1,1,1")
ap.add_argument("--sky-tint", default="1,1,1")
ap.add_argument("--scale", type=float, default=None)
ap.add_argument("--jpeg", default=None)
args = ap.parse_args()


def tint(s):
    return np.array([float(v) for v in s.split(",")], dtype=np.float32)


lamps = np.load(args.lamps).astype(np.float32) * (args.a * tint(args.lamp_tint))
sky = np.load(args.sky).astype(np.float32) * (args.b * tint(args.sky_tint))
assert lamps.shape == sky.shape, (lamps.shape, sky.shape)
mask_path = os.path.splitext(args.lamps)[0] + "_mask.npy"
mask = np.load(mask_path) if os.path.exists(mask_path) else (lamps + sky).max(axis=2) > 1e-5
rgb = lamps + sky

lit = rgb[mask]
lit = lit[lit.max(axis=1) > 1e-4]
luma = lit @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
scale = args.scale or float(np.percentile(lit, 99.5))
info = {
    "lamps": args.a, "sky": args.b, "lamp_tint": args.lamp_tint, "sky_tint": args.sky_tint,
    "lamp_share_of_light": round(float(lamps[mask].sum() / max(1e-9, rgb[mask].sum())), 3),
    "scale": round(scale, 4),
    "median_luma": round(float(np.median(luma)), 4),
    "mean_rgb": [round(float(v), 4) for v in lit.mean(axis=0)],
}
print("SCALE %.4f  (LIGHTMAP_INTENSITY)" % scale)
print("MIX|" + json.dumps(info))
v = np.clip(rgb / scale, 0.0, 1.0)
s = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(np.maximum(v, 1e-8), 1 / 2.4) - 0.055)
rng = np.random.default_rng(7)
dither = (rng.random(s.shape, dtype=np.float32) - rng.random(s.shape, dtype=np.float32)) * 0.5
q = np.clip(np.floor(s * 255.0 + 0.5 + dither), 0, 255).astype(np.uint8)
Image.fromarray(q).save(args.out_png)
json.dump(info, open(os.path.splitext(args.out_png)[0] + ".json", "w"), indent=1)
print("wrote", args.out_png)
if args.jpeg:
    Image.fromarray(q).save(args.jpeg, quality=92)
    print("wrote", args.jpeg)
