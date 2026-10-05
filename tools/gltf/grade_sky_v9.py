"""The estate's sky plate, v9: the evening's haze at its foot, all the way round.

    python tools/gltf/grade_sky_v9.py

The paid audit of 2026-10-04 (pass 1): "more atmospheric integration ... more
believable relationship between sky and ground"; (pass 2) the cover was re-cut
on a long lens, which stacks the park's far trees up behind the house.

The land's haze was one warm cream, the plate's horizon on the SUN'S bearing.
Away from the sun the photographed sky's foot is a flat grey a stop darker
(measured on v8: 127, 126, 129 on the cover's bearing, against 239, 193, 132
toward the sun), so the far belt, fading to cream, printed LIGHTER than the
sky behind it: white cumulus where a tree line should be. Matching the haze to
that grey instead is correct and dull: a golden hour seen through a grey veil.

At this hour the air itself is lit. Haze thickens toward the horizon in every
direction and takes the low sun's colour: brightest and most orange round the
sun, a paler rose-cream opposite it (the band a photographer calls the
anti-twilight arch). So the plate's lowest ten degrees are graded toward that
haze, by bearing from the sun, most at the horizon and none by seven degrees
up, and the half below the horizon carries each bearing's horizon colour on
down. The scene's fog is then read from this plate (skyHaze.ts): the far
trees and the sky's foot are the same air.

Only the plate. The lighting environment is sky_estate_v9_env.jpg
(make_env_v9.py), made from the v7 one and untouched by this.
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, '..', '..', 'apps', 'public', 'public', 'textures')
SRC = os.path.join(TEX, 'sky_estate_v8_4k.jpg')
OUT = os.path.join(TEX, 'sky_estate_v9_4k.jpg')

# The haze opposite the sun and beside it (sRGB), how high it reaches, and how
# much of the sky it replaces at the horizon itself.
# (214, 196, 174 at first: the park's far haze then stood brighter than the
# house's lit front, and the eye went to the horizon. 184, 170, 154 next: a
# grey veil, and the golden hour went out of the cover.)
HAZE_AWAY = (198, 183, 161)
HAZE_TOP_DEG = 7.0
HAZE_AT_HORIZON = 0.82
# Within this many degrees of the sun's bearing the plate keeps its own foot.
SUN_KEEP_DEG = 55.0


def to_lin(v):
    v = np.asarray(v, dtype=np.float64) / 255.0
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def to_srgb(v):
    v = np.clip(v, 0, 1)
    return np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


img = np.asarray(Image.open(SRC).convert('RGB'))
H, W, _ = img.shape
sky = to_lin(img)

rows = (np.arange(H) + 0.5) / H
elev = (0.5 - rows) * 180.0

# The sun's bearing is the daylight key's (softSunShadows.ts, DAY_SUN = [86, 25,
# 50]; three reads a panorama at u = atan2(z, x) / 2pi + 0.5). Not found from
# the plate: its brightest low band is a lit cloud bank thirty degrees off.
sun_col = int((np.arctan2(50.0, 86.0) / (2 * np.pi) + 0.5) * W)
cols = np.arange(W)
d = np.minimum(np.abs(cols - sun_col), W - np.abs(cols - sun_col)) / W * 360.0
away = smoothstep(SUN_KEEP_DEG * 0.45, SUN_KEEP_DEG, d)  # 0 at the sun, 1 away

# How much haze, by height: all of HAZE_AT_HORIZON at the horizon, none at the top.
w_el = (1.0 - smoothstep(0.0, HAZE_TOP_DEG, elev)) ** 1.35
w = (w_el[:, None] * HAZE_AT_HORIZON) * away[None, :]
w = np.where(elev[:, None] > 0, w, 0.0)

haze = to_lin(HAZE_AWAY)
out = sky * (1.0 - w[..., None]) + haze[None, None, :] * w[..., None]

# Below the horizon: each bearing's own horizon colour carried down, so the
# plate has no line where the land's far edge meets it.
hz = int(H * 0.5) - 1
foot = out[hz - 2:hz + 1].mean(axis=0)
# (smoothed along the horizon, six degrees wide, so a cloud on the horizon row
# is not drawn down the plate as a stripe)
n = W // 60
foot = np.stack([np.convolve(np.concatenate([foot[:, c]] * 3), np.ones(n) / n, mode='same')[W:2 * W] for c in range(3)], axis=1)
out[hz + 1:] = foot[None, :, :]

Image.fromarray((to_srgb(out) * 255 + 0.5).astype(np.uint8), 'RGB').save(OUT, quality=90, optimize=True)
print('SKY', OUT, (H, W), 'sun column', sun_col, 'u', round(sun_col / W, 3))
for name, u in (('cover', 0.314), ('sun', sun_col / W), ('north', 0.25), ('south-east', 0.62)):
    x = int(u * W)
    px = (to_srgb(out[hz - 30:hz - 4, max(0, x - 80):x + 80].reshape(-1, 3).mean(0)) * 255).round()
    print('  foot of the sky,', name, tuple(int(v) for v in px))
