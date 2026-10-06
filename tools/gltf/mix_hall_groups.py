r"""
The hall's light, mixed from its families.

STATUS, 2026-10-06: NOT WHAT SHIPS. The mix this was written for (a pooled
evening: the wash down, the sconces up) was sent back by the client the day
after he saw it; the hall ships the lightmap it had before. Kept for a
re-balance, should he ask for one.

    python mix_hall_groups.py split <bake_A> <bake_B> <families_dir>
    python mix_hall_groups.py mix <families_dir> <out.png>
        [--w chandelier=0.2,entry=0.05,sconces=3,portrait=1,stair=1,sky=0.02]
        [--tint sky=0.8,0.88,1.0] [--scale S] [--shoulder K] [--jpeg <preview.jpg>]

`split` takes the two channel-packed bakes of tools/blender/
rebake_hall_split_v7.py (three families of light to a bake, one a colour
channel) apart into six single-family passes, each written as the grey image
the finisher expects:

    <families_dir>/<family>/lightmap_raw.npy

Each is then finished on its own (finish_hall_lightmap.py --save-float
<families_dir>/<family>/denoised.npy, with the reference pass's normals), and
`mix` is their weighted sum with each family's own lamp colour given back —
the colour of the light that began every bounce in it, which is exact for the
direct light and loses only the tint a bounce takes from the surface it left.

Then, as mix_hall_passes.py does: normalised by the 99.5th percentile of the
lit texels (the divisor is printed and must become LIGHTMAP_INTENSITY in
HallModel.tsx, and the manifest's), sRGB-encoded with a half-LSB dither.

--shoulder K (0..1) KEEPS A LAMP'S POOL ITS LAMP'S COLOUR. The wall a hand's
breadth behind a sconce takes fifty times the light of the wall a metre away,
and an 8-bit atlas normalised for the room clips there: all three channels at
the ceiling, a white disc in the middle of an amber pool. With a shoulder, a
texel whose brightest channel is over K of the ceiling is brought under it on
a soft curve BY ITS BRIGHTEST CHANNEL, the three scaled together: no channel
clips, so the pool is its lamp's colour to its centre.

THE WEIGHTS ARE THE ROOM'S LIGHTING DESIGN. At 1 each, the families are the
lights as the model has them: a chandelier of 2,189 W and an area key of
1,470 W by the entry, which between them lay an even wash on every wall, and
twelve sconces of 16 W — pools that the wash drowns. The audit of 2026-10-05
asked for "rich darks and warm light pools": the wash down, the pools up.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

# family: (bake, channel, the lamp's own colour in the model)
FAMILIES = {
    "chandelier": ("A", 0, (1.0, 0.74, 0.48)),
    "entry": ("A", 1, (1.0, 0.94, 0.86)),
    "sconces": ("A", 2, (1.0, 0.68, 0.38)),
    "portrait": ("B", 0, (1.0, 0.9, 0.78)),
    "stair": ("B", 1, (1.0, 0.8, 0.58)),
    # The windows and the oculus were modelled as a warm afternoon's; the film
    # enters at dusk, and what is left in the sky is cooler than any lamp.
    "sky": ("B", 2, (0.8, 0.88, 1.0)),
}


def split(bake_a, bake_b, out):
    for name, (bake, ch, _) in FAMILIES.items():
        raw = os.path.join(bake_a if bake == "A" else bake_b, "lightmap_raw.npy")
        if not os.path.exists(raw):
            print("%-11s bake %s is not there yet: skipped" % (name, bake))
            continue
        src = np.load(raw)
        mono = src[..., ch]
        d = os.path.join(out, name)
        os.makedirs(d, exist_ok=True)
        np.save(os.path.join(d, "lightmap_raw.npy"), np.repeat(mono[..., None], 3, axis=2).astype(np.float16))
        lit = mono[mono > 1e-4].astype(np.float32)
        print("%-11s bake %s channel %s  lit %.1f%%  median %.4f  p99.5 %.3f"
              % (name, bake, "RGB"[ch], 100 * lit.size / mono.size, float(np.median(lit)) if lit.size else 0,
                 float(np.percentile(lit, 99.5)) if lit.size else 0))


def pairs(s, cast):
    out = {}
    for part in (s or "").split(";" if ";" in (s or "") else ","):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = cast(v)
    return out


def mix(args):
    weights = {k: 1.0 for k in FAMILIES}
    weights.update(pairs(args.w, float))
    tints = {k: np.array(c, dtype=np.float32) for k, (_, _, c) in FAMILIES.items()}
    for spec in args.tint or []:
        k, v = spec.split("=", 1)
        tints[k] = np.array([float(x) for x in v.split(",")], dtype=np.float32)
    rgb = None
    mask = None
    share = {}
    for name in FAMILIES:
        p = os.path.join(args.families, name, "denoised.npy")
        if not os.path.exists(p):
            print("MISSING", p)
            continue
        mono = np.load(p).astype(np.float32)[..., 0]
        part = mono[..., None] * (weights[name] * tints[name])
        rgb = part if rgb is None else rgb + part
        share[name] = float(part.sum())
        if mask is None:
            mp = os.path.join(args.families, name, "denoised_mask.npy")
            mask = np.load(mp) if os.path.exists(mp) else None
    if mask is None:
        mask = rgb.max(axis=2) > 1e-5
    lit = rgb[mask]
    lit = lit[lit.max(axis=1) > 1e-4]
    luma = lit @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    scale = args.scale or float(np.percentile(lit, 99.5))
    if args.shoulder:
        knee = float(args.shoulder) * scale
        room = scale - knee
        peak = rgb.max(axis=2)
        over = peak > knee
        soft = knee + room * (1.0 - np.exp(-(peak[over] - knee) / room))
        rgb[over] *= (soft / peak[over])[:, None]
        print("shoulder from %.3f: %.2f%% of the lit texels" % (knee, 100.0 * float(over[mask].mean())))
    total = sum(share.values()) or 1.0
    info = {
        "weights": weights,
        "tints": {k: [round(float(x), 3) for x in v] for k, v in tints.items()},
        "share_of_light": {k: round(v / total, 3) for k, v in share.items()},
        "scale": round(scale, 4),
        "shoulder": args.shoulder,
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
    if args.out.lower().endswith((".jpg", ".jpeg")):
        Image.fromarray(q).save(args.out, quality=92)
    else:
        Image.fromarray(q).save(args.out)
    json.dump(info, open(os.path.splitext(args.out)[0] + ".json", "w"), indent=1)
    print("wrote", args.out)
    if args.jpeg:
        Image.fromarray(q).save(args.jpeg, quality=92)
        print("wrote", args.jpeg)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "split":
        split(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        ap = argparse.ArgumentParser()
        ap.add_argument("cmd")
        ap.add_argument("families")
        ap.add_argument("out")
        ap.add_argument("--w", default="")
        ap.add_argument("--tint", action="append")
        ap.add_argument("--scale", type=float, default=None)
        ap.add_argument("--shoulder", type=float, default=None)
        ap.add_argument("--jpeg", default=None)
        mix(ap.parse_args())
