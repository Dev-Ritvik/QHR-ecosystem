"""
The v11 sky plate and its lighting copy, from the hills' render
(tools/blender/make_sky_hills_v11.py): the air laid on, the sky painted, the
whole graded to the concept the user asked to be built 1:1 (2026-10-27).

    python grade_sky_hills_v11.py <render_dir> <out_plate.jpg> <out_env.jpg> [preview.jpg]

THE SKY is painted, not the render's: a hazy golden-hour sky, cream at the
foot and a warm grey overhead, brightest on the sun's bearing (DAY_SUN, as
every plate since v7), with the sun's glow in two widths. The concept's sky
has no cloud in it, only haze; neither has this.

THE AIR, from the data pass (distance and height of what each ray met):

  distance  the hills fade toward the sky's own foot on their bearing, as far
            land does (AP_M: the distance at which a third of it is left), so
            the ranges stand in layers, each paler than the one before
  mist      the valley's: densest on the floor and thinning with height
            (MIST_H), more of it the further the ray runs through it, broken
            into banks by a slow noise, so the hills' feet stand in it and
            their crests stand clear

THE FOOT, below the hills, is the mist alone: the estate's own land runs out
to 900 m, and its far edge takes its fog colour from the plate just above the
horizon (skyHaze.ts), so the land, the mist and the hills' feet are one air.

THE LIGHTING COPY is the plate small, with the ground's warm olive-grey bounce
below the horizon (make_env_v9.py's), as before.

Orientation: the render is already in three's layout (u = atan2(z, x)/2pi +
0.5, the zenith at the top).
"""
import os
import sys

import numpy as np
from PIL import Image

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
import cv2  # noqa: E402

SRC, OUT, ENV_OUT = sys.argv[1:4]
PREVIEW = sys.argv[4] if len(sys.argv) > 4 else None

SUN3 = np.array([86.0, 25.0, 50.0])
SUN3 /= np.linalg.norm(SUN3)


def lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def look(name, default):
    v = os.environ.get(name)
    return type(default)(v) if v is not None else default


# ---- the look (each overridable from the environment for look-dev)
FOOT = lin((236, 222, 196))      # the sky's foot, away from the sun
FOOT_SUN = lin((252, 226, 182))  # and toward it
ZENITH = lin((178, 180, 176))    # overhead: a warm grey, no blue
SKY_GAIN = look("SKY_GAIN", 1.0)
AP_M = look("AP_M", 14000.0)      # distance haze: e-folding distance, m
MIST_H = look("MIST_H", 300.0)   # mist thins by e over this height, m
MIST_D = look("MIST_D", 3000.0)  # and gathers over this run, m
MIST_K = look("MIST_K", 0.85)    # how much of the valley's mist is drawn
LAND_GAIN = look("LAND_GAIN", 1.0)
HAZE_GAIN = look("HAZE_GAIN", 0.85)
MIST_COL = lin((238, 224, 198))

def rgba(name):
    a = cv2.imread(os.path.join(SRC, name), cv2.IMREAD_UNCHANGED).astype(np.float64)
    return a[:, :, [2, 1, 0]], a[:, :, 3]


# Premultiplied by the land's cover of each pixel (the sky is transparent in
# the render): divided back out here and composited over the painted sky.
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
el = (0.5 - v) * np.pi
az = (u - 0.5) * 2 * np.pi
EL, AZ = np.meshgrid(el, az, indexing="ij")
dirs = np.stack([np.cos(EL) * np.cos(AZ), np.sin(EL), np.cos(EL) * np.sin(AZ)], -1)
cos_sun = np.clip(dirs @ SUN3, -1, 1)
ang = np.degrees(np.arccos(cos_sun))
# the sun's side of the sky, horizontally (0 away .. 1 toward)
flat = np.hypot(SUN3[0], SUN3[2])
side = 0.5 + 0.5 * (np.cos(AZ) * SUN3[0] / flat + np.sin(AZ) * SUN3[2] / flat)


def sky_at(EL_, side_, ang_):
    t = np.clip(np.degrees(EL_) / 38.0, 0, 1) ** 0.55
    foot = FOOT[None, None, :] * (1 - side_[..., None] ** 3) + FOOT_SUN[None, None, :] * side_[..., None] ** 3
    s = foot * (1 - t[..., None]) + ZENITH[None, None, :] * t[..., None]
    glow = 0.55 * np.exp(-((ang_ / 30.0) ** 2)) + 1.6 * np.exp(-((ang_ / 7.0) ** 2))
    s = s * (1 + glow[..., None] * np.array([1.0, 0.86, 0.62]))
    return s * SKY_GAIN


sky = sky_at(EL, side, ang)
# the foot of the sky on each bearing, for the air in front of the hills
foot_row = sky_at(np.full_like(EL, np.radians(1.0)), side, ang)

# ---- the land under the air
col = beauty * LAND_GAIN
T = np.exp(-np.maximum(dist, 0) / AP_M)
air = foot_row * HAZE_GAIN
col = col * T[..., None] + air * (1 - T[..., None])
# the valley's mist: low, gathered over distance, in banks
yy, xx = np.meshgrid(np.linspace(0, 1, H), np.linspace(0, 1, W), indexing="ij")
rng = np.random.default_rng(7)
banks = np.zeros((H, W))
for k, amp in ((6, 0.5), (13, 0.3), (29, 0.2)):
    ph = rng.uniform(0, 6.283, 4)
    banks += amp * (np.sin(xx * 6.283 * k + ph[0] + 2.0 * np.sin(yy * 9 + ph[1]))
                    * np.sin(yy * 6.283 * k * 0.35 + ph[2]) * 0.5 + 0.5)
banks = 0.55 + 0.45 * banks
m = np.exp(-np.maximum(hgt - 10.0, 0) / MIST_H) * (1 - np.exp(-np.maximum(dist, 0) / MIST_D))
m = np.clip(m * MIST_K * banks, 0, 1)
mist = MIST_COL[None, None, :] * (0.92 + 0.16 * side[..., None] ** 2)
col = col * (1 - m[..., None]) + mist * m[..., None]

plate = col * cover[..., None] + sky * (1 - cover[..., None])
# THE FOOT: below the hills' line, the mist alone, so the estate's far land
# meets one colour (see the head of this file)
below = (EL < np.radians(-0.4)) & ~land
plate = np.where(below[..., None], mist * 1.0, plate)
foot_band = np.clip((np.radians(0.6) - EL) / np.radians(1.4), 0, 1)
plate = plate * (1 - foot_band[..., None] * 0.85) + mist * (foot_band[..., None] * 0.85)

out8 = (srgb(plate) * 255 + 0.5).astype(np.uint8)
Image.fromarray(out8, "RGB").save(OUT, quality=92, optimize=True)
print("PLATE", OUT, out8.shape)

# ---- the lighting copy
BOUNCE = lin((92, 88, 68))
small = cv2.resize(plate, (1024, 512), interpolation=cv2.INTER_AREA)
hs = 512
vv = (np.arange(hs) + 0.5) / hs
dy = np.sin((0.5 - vv) * np.pi)[:, None]
t = np.clip(-dy / 0.12, 0, 1) ** 0.8
horizon = small[hs // 2 - 1][None, :, :]
ground = horizon * (1 - t[..., None]) + BOUNCE[None, None, :] * t[..., None]
env = np.where((dy < 0)[..., None], ground, small)
Image.fromarray((srgb(env) * 255 + 0.5).astype(np.uint8), "RGB").save(ENV_OUT, quality=90, optimize=True)
print("ENV", ENV_OUT)
if PREVIEW:
    Image.fromarray(out8, "RGB").resize((min(W, 2048), min(W, 2048) // 2), Image.LANCZOS).save(PREVIEW, quality=90)
