"""The estate's sky plate and its lighting copy, v10: the sun's glow in amber.

    python tools/gltf/grade_sky_v10.py [--plate-only] [--out <dir>]

The forensic audit of 2026-10-09 (#14): "The sky round the sun is yellow-green
instead of warm gold ... Expected: a sun glow between amber and rose, with the
green taken out of the grade." Strongest from the film's 17% to its 40%, and
on a phone.

WHERE THE GREEN CAME FROM. Not from any green in the plate: measured on v9,
the glow round the photographed sun is a pale yellow (hue 42 to 49 degrees)
and the column the plate carries down under the horizon on the sun's bearing
a full one (253, 213, 140: hue 39). Two things then happen to that yellow on
its way to the frame. The print leans its highlights warm, which is more
yellow still (measured on the film at 30%: hue 43 to 49 at a saturation of
0.36). And the land's haze is read from this plate, bearing by bearing
(skyHaze.ts), so everything seen toward the sun is veiled in it: and a wall in
the sky's blue shade, veiled in yellow, is green. That is the same audit's
#15, the house's shaded side "a cold grey-green" on the revolve (85, 89, 86
on the rear wall: green over red by four).

SO THE GLOW IS TURNED, NOT THE GRADE. A low sun through this much air is
amber going to rose at its edges; yellow is what a camera makes of it at
clipping. Every saturated warm hue in the plate, from 22 degrees (the rose of
the column's edges, which stays where it is) to 60, is drawn in toward 22 to
34: the yellow core comes to an amber, the pale glow over it to a peach, and
their order is kept, so no gradient is turned over. Pale tones are left
alone (the far haze at a saturation of 0.16, the lit cloud): `SAT` is where
the turning begins and where it is whole. Value and saturation are not
touched, so the sky is no darker and the haze no thinner than v9's.

The lighting copy is turned the same way, so what lights the scene and what
is seen behind it stay one sky.
"""
import colorsys
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, '..', '..', 'apps', 'public', 'public', 'textures')
OUT = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else TEX
PLATE_ONLY = '--plate-only' in sys.argv

# Hues, degrees: from KEEP up to TOP are drawn in to KEEP..AMBER.
KEEP, TOP, AMBER = 22.0, 60.0, 34.0
# Saturation at which the turning begins, and at which it is whole.
SAT = (0.18, 0.32)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def turn(rgb):
    """rgb: HxWx3 uint8 (sRGB). The same, with its saturated yellows turned to amber."""
    a = rgb.astype(np.float64) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-9), 0.0)
    # hue, degrees (only where red is the largest and green the middle: 0..60)
    warm = (mx == r) & (g >= b) & (d > 1e-6)
    h = np.where(warm, 60.0 * (g - b) / np.maximum(d, 1e-9), -1.0)
    in_band = warm & (h > KEEP) & (h <= TOP)
    h2 = KEEP + (h - KEEP) * ((AMBER - KEEP) / (TOP - KEEP))
    w = smoothstep(SAT[0], SAT[1], s) * in_band
    hn = h + (h2 - h) * w
    # back to rgb at the same value and saturation: red stays the largest, blue the least
    g2 = mn + (hn / 60.0) * d
    out = a.copy()
    out[..., 1] = np.where(in_band, g2, g)
    return (np.clip(out, 0, 1) * 255.0 + 0.5).astype(np.uint8), float(w.mean())


def report(name, img):
    H, W, _ = img.shape
    for label, (u, v) in (('under the sun', (0.555, 0.56)), ('glow, 3 deg up', (0.555, 0.483)), ('glow, 8 deg up', (0.555, 0.455)),
                          ('column edge', (0.60, 0.56)), ('far haze', (0.2, 0.56)), ('blue, opposite', (0.05, 0.44))):
        x, y = int(u * W), int(v * H)
        m = img[max(0, y - 3):y + 4, max(0, x - 3):x + 4].reshape(-1, 3).mean(0) / 255.0
        hh, ss, vv = colorsys.rgb_to_hsv(*m)
        print('  %-16s %-18s hue %5.1f  sat %.2f  val %.2f' % (label, tuple(int(c * 255) for c in m), hh * 360, ss, vv))


for src, dst, q in (('sky_estate_v9_4k.jpg', 'sky_estate_v10_4k.jpg', 90), ('sky_estate_v9_env.jpg', 'sky_estate_v10_env.jpg', 92)):
    if PLATE_ONLY and 'env' in src:
        continue
    img = np.asarray(Image.open(os.path.join(TEX, src)).convert('RGB'))
    out, share = turn(img)
    Image.fromarray(out, 'RGB').save(os.path.join(OUT, dst), quality=q, optimize=True)
    print('SKY', dst, img.shape[:2], 'turned %.1f%% of it' % (100 * share))
    print(' before'); report(src, img)
    print(' after'); report(dst, out)
