"""
The film's daytime sky, for the visitor's own Day (HourChoice.tsx; the brief of
2026-11-01), from the same render of the same hills as the other three
(tools/blender/make_sky_hills_v11.py), so nothing jumps as one goes to another.

    python grade_sky_day_v13.py <render_dir> <out_dir>

Writes sky_estate_v13_day_4k.jpg and, at half the size, sky_estate_v13_day_2k.jpg.

A high sun, late morning, the dry season's clear air: a pale, slightly warm blue at the
horizon, deepening to the zenith, with fair-weather cumulus. The hills as the render lit
them, green going to blue with distance, a little mist still in the valley's floor. Not
saturated: the client asked for less, and this sky shares a frame with the old-money
ivory of the house. The hills' two massifs are the night's (grade_sky_hours_v12.py): by
day the haze has them.
"""
import os
import sys

import numpy as np
from PIL import Image

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
import cv2  # noqa: E402

SRC, OUT = sys.argv[1:3]


def lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def rgba(name):
    a = cv2.imread(os.path.join(SRC, name), cv2.IMREAD_UNCHANGED).astype(np.float64)
    return a[:, :, [2, 1, 0]], a[:, :, 3]


beauty, alpha = rgba("beauty.exr")
data, _ = rgba("data.exr")
H, W, _ = beauty.shape
cover = np.clip(alpha, 0, 1)
safe = np.maximum(cover, 1e-4)[..., None]
beauty = beauty / safe
data = data / safe
dist = data[..., 0]
hgt = data[..., 1]
land = cover > 0.002

v = (np.arange(H) + 0.5) / H
u = (np.arange(W) + 0.5) / W
EL = ((0.5 - v) * np.pi)[:, None] * np.ones((1, W))
DEG = np.degrees(EL)
L = beauty @ np.array([0.2126, 0.7152, 0.0722])
Lref = np.percentile(L[land], 80) if land.any() else 1.0
shape = np.clip(L / max(Lref, 1e-5), 0, 1.4) ** 0.8


def fbm(seed, fx, fy, octaves=6):
    """Noise that wraps round the compass, from a stack of random sines."""
    rng = np.random.default_rng(seed)
    yy = np.linspace(0, 1, H)[:, None]
    xx = np.linspace(0, 1, W)[None, :]
    out = np.zeros((H, W))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        layer = np.zeros((H, W))
        for _ in range(24):
            kx = rng.integers(1, int(fx * 2 ** o) + 2)
            ky = rng.uniform(0.5, fy * 2 ** o)
            ph0, ph1 = rng.uniform(0, 2 * np.pi, 2)
            layer += np.sin(2 * np.pi * kx * xx + ph0 + 2 * np.pi * ky * yy + ph1 * 0.5)
        out += amp * layer / 24.0
        tot += amp
        amp *= 0.55
    return out / tot


# THE SKY
HORIZON = lin((205, 216, 224))
LOW = lin((168, 196, 222))
MID = lin((118, 160, 206))
ZENITH = lin((70, 118, 180))
t1 = np.clip(DEG / 9.0, 0, 1)[..., None]
t2 = np.clip((DEG - 6.0) / 26.0, 0, 1)[..., None]
t3 = np.clip((DEG - 28.0) / 52.0, 0, 1)[..., None]
sky = HORIZON * (1 - t1) + LOW * t1
sky = sky * (1 - t2) + MID * t2
sky = sky * (1 - t3) + ZENITH * t3

# CUMULUS: flat-based, lit from above, only so high and thinning overhead. Foreshortened
# toward the horizon, as a layer of cloud is seen.
stretch = 1.0 / np.maximum(np.sin(np.clip(EL, np.radians(2.0), None)), 0.06)
n = fbm(7, 7, 22)
n2 = fbm(11, 3, 9, octaves=4)
field = 0.7 * n + 0.45 * n2
band = np.exp(-((DEG - 22.0) / 24.0) ** 2) * (DEG > 1.0)
puff = np.clip((field - 0.06) / 0.2, 0, 1) * band
puff = puff * puff * (3 - 2 * puff)
lit = np.clip(0.55 + 2.2 * (field - 0.12), 0.0, 1.0)
CLOUD_TOP = lin((246, 244, 238))
CLOUD_BASE = lin((168, 180, 196))
cloud = CLOUD_BASE * (1 - lit[..., None]) + CLOUD_TOP * lit[..., None]
sky = sky * (1 - puff[..., None] * 0.92) + cloud * puff[..., None] * 0.92

# THE HILLS, as lit, under the air: the render's own golden light taken to a neutral.
AP_M = 11000.0
T = np.exp(-np.maximum(dist, 0) / AP_M)[..., None]
near = lin((74, 96, 62))
far_air = lin((168, 190, 212))
base = near * (0.5 + 0.8 * shape[..., None])
col = base * T + far_air * (1 - T)
# what mist there is at this hour lies on the valley's floor
m = np.exp(-np.maximum(hgt - 10.0, 0) / 160.0) * (1 - np.exp(-np.maximum(dist, 0) / 3000.0))
m = np.clip(m * 0.55, 0, 1)[..., None]
MIST = lin((206, 216, 222))
col = col * (1 - m) + MIST * m
plate = col * cover[..., None] + sky * (1 - cover[..., None])
below = (EL < np.radians(-0.4)) & ~land
plate = np.where(below[..., None], MIST, plate)
foot = np.clip((np.radians(0.6) - EL) / np.radians(1.4), 0, 1)[..., None] * 0.85
plate = plate * (1 - foot) + MIST * foot

rng = np.random.default_rng(3)
noise = rng.random(plate.shape) - rng.random(plate.shape)
out = np.clip(srgb(plate) * 255 + 0.5 + noise * 0.8, 0, 255).astype(np.uint8)
im = Image.fromarray(out, "RGB")
os.makedirs(OUT, exist_ok=True)
if im.width != 4096:
    im = im.resize((4096, 2048), Image.LANCZOS)
im.save(os.path.join(OUT, "sky_estate_v13_day_4k.jpg"), quality=88, optimize=True, progressive=True)
im.resize((2048, 1024), Image.LANCZOS).save(os.path.join(OUT, "sky_estate_v13_day_2k.jpg"), quality=86, optimize=True, progressive=True)
for f in ("sky_estate_v13_day_4k.jpg", "sky_estate_v13_day_2k.jpg"):
    print(f, os.path.getsize(os.path.join(OUT, f)))
