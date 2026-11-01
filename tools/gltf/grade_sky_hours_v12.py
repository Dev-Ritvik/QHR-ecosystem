"""
The film's other two skies, from the same render of the same hills as the golden
hour's plate (tools/blender/make_sky_hills_v11.py, tools/gltf/grade_sky_hills_v11.py):
the twilight's and the midnight's, to the user's two references of 2026-11-01.

    python grade_sky_hours_v12.py <render_dir> <out_dir> [preview_dir]

Writes sky_estate_v12_twilight_4k.jpg, sky_estate_v12_night_4k.jpg, each again at
half the size (_2k), and sky_estate_v12_ridge.png, the hills' skyline by bearing,
for the stars (a star is not drawn over a hill).

THE SAME RIDGES IN ALL THREE. The film goes from one sky to the next on the same
camera move, by a dissolve in the sky's own shader (skyHours.ts). A dissolve
between two skies over two sets of hills is a slide changing; over the same
hills it is the light going.

THE HILLS are not lit by anything but the sky at these hours: no sun, so the
render's sunlit side is taken back to a shape, its luminance raised to a power
and held low, and what colour they have is the air's, the further the more
(AP_M, as v11): near hills almost black, the far ranges paler and bluer, the last
of them mauve against the afterglow.

THE TWILIGHT'S SKY: the sun has been gone a while (the user's reference of the blue
hour, 2026-11-01). A pale blue-grey low down, deepening through slate and blue to
indigo at the zenith, with two small clouds still catching rose and peach; the hills
in blue, paler the further off; blue mist in the valley.

AND TWO GREAT MASSIFS, left and right of the layout's frame, near and almost black.
No day's plate has them: by day the haze has them, and they come out of it as the
light goes, over the same dissolve, with the hills standing still in front of the
sky. They are the night's too, and the stars' skyline.

THE MIDNIGHT'S: navy overhead, a little paler at the foot, no glow. The stars are
the shader's (a plate's stars would be soft, and it is magnified six times).
"""
import os
import sys

import numpy as np
from PIL import Image

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
import cv2  # noqa: E402

SRC, OUT = sys.argv[1:3]
PREVIEW = sys.argv[3] if len(sys.argv) > 3 else None


def lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def look(name, default):
    v = os.environ.get(name)
    return type(default)(v) if v is not None else default


def rgba(name):
    a = cv2.imread(os.path.join(SRC, name), cv2.IMREAD_UNCHANGED).astype(np.float64)
    return a[:, :, [2, 1, 0]], a[:, :, 3]


# Premultiplied by the land's cover of each pixel, as in v11.
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
DEG = np.degrees(EL)

# the render's own light, as a shape: its luminance, normalised and flattened
L = beauty @ np.array([0.2126, 0.7152, 0.0722])
Lref = np.percentile(L[land], 80) if land.any() else 1.0
shape = np.clip(L / max(Lref, 1e-5), 0, 1.4) ** 0.8

yy, xx = np.meshgrid(np.linspace(0, 1, H), np.linspace(0, 1, W), indexing="ij")


def fbm(seed, fx, fy, octaves=5):
    """Wrapped noise from sines, smooth and tiling round the compass."""
    rng = np.random.default_rng(seed)
    out = np.zeros((H, W))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        kx = max(1, int(round(fx * 2**o)))
        ky = fy * 2**o
        for _ in range(4):
            a, b, c = rng.uniform(0, 6.283, 3)
            nx = kx + rng.integers(0, 3)
            out += amp * np.sin(xx * 6.283 * nx + a + 1.4 * np.sin(yy * ky * 3.1 + b)) * np.sin(yy * 6.283 * ky + c + 0.9 * np.sin(xx * 6.283 * max(1, kx // 2) + a))
            tot += amp
        amp *= 0.55
    return out / tot * 2.2 * 0.5 + 0.5


def banks():
    rng = np.random.default_rng(7)
    b = np.zeros((H, W))
    for k, a in ((6, 0.5), (13, 0.3), (29, 0.2)):
        ph = rng.uniform(0, 6.283, 4)
        b += a * (np.sin(xx * 6.283 * k + ph[0] + 2.0 * np.sin(yy * 9 + ph[1])) * np.sin(yy * 6.283 * k * 0.35 + ph[2]) * 0.5 + 0.5)
    return 0.55 + 0.45 * b


BANKS = banks()
AP_M = look("AP_M", 14000.0)
MIST_H = look("MIST_H", 300.0)
MIST_D = look("MIST_D", 3000.0)


def angle_from(az0_deg):
    d = (np.degrees(AZ) - az0_deg + 180.0) % 360.0 - 180.0
    return d


def compose(sky, near, far, mist_col, mist_k, shape_gain):
    """The hills under the air, over the sky, with the mist alone below them."""
    T = np.exp(-np.maximum(dist, 0) / AP_M)
    # nearer hills: their own dark, with the render's shapes in it
    base = near[None, None, :] * (0.55 + shape_gain * shape[..., None])
    col = base * T[..., None] + far * (1 - T[..., None])
    m = np.exp(-np.maximum(hgt - 10.0, 0) / MIST_H) * (1 - np.exp(-np.maximum(dist, 0) / MIST_D))
    m = np.clip(m * mist_k * BANKS, 0, 1)[..., None]
    col = col * (1 - m) + mist_col * m
    plate = col * cover[..., None] + sky * (1 - cover[..., None])
    below = (EL < np.radians(-0.4)) & ~land
    plate = np.where(below[..., None], mist_col, plate)
    foot = np.clip((np.radians(0.6) - EL) / np.radians(1.4), 0, 1)[..., None] * 0.85
    return plate * (1 - foot) + mist_col * foot


def dither(a, seed):
    """A triangular dither, under a level: dark gradients do not band."""
    rng = np.random.default_rng(seed)
    n = rng.random(a.shape) - rng.random(a.shape)
    return np.clip(srgb(a) * 255 + 0.5 + n * 0.8, 0, 255).astype(np.uint8)


# ---- THE TWILIGHT
# (on the middle of the layout's frame, whose top edge looks 8 to 10 degrees up: so
# the glow stands as high as that, and falls away before the frame's two ends, where
# the header stands)
GLOW_AZ = look("TW_AZ", -21.0)      # the last of the light's bearing on the plate, degrees
GLOW_W = look("TW_W", 40.0)         # how far round the compass it falls away
d = angle_from(GLOW_AZ)
side = np.exp(-((d / GLOW_W) ** 2))
t_low = np.clip(DEG / 11.0, 0, 1)
t_mid = np.clip((DEG - 10.0) / 20.0, 0, 1)
t_high = np.clip((DEG - 22.0) / 50.0, 0, 1)

GLOW_LOW = lin((170, 178, 198))     # at the horizon, on the sun's side
GLOW_HIGH = lin((158, 172, 194))    # a little above it
AWAY_LOW = lin((158, 182, 210))     # the horizon away from the sun
SLATE = lin((112, 130, 158))        # a dozen degrees up
BLUE = lin((52, 70, 104))           # thirty degrees up
INDIGO = lin((20, 30, 56))          # the zenith


def mix3(a, b, t):
    t = t[..., None]
    return a * (1 - t) + b * t


low = mix3(mix3(np.broadcast_to(AWAY_LOW, (H, W, 3)), np.broadcast_to(GLOW_LOW, (H, W, 3)), side),
           mix3(np.broadcast_to(SLATE, (H, W, 3)), np.broadcast_to(GLOW_HIGH, (H, W, 3)), side * 0.8),
           t_low ** 0.8)
tw = mix3(low, np.broadcast_to(SLATE, (H, W, 3)), t_mid ** 0.75)
tw = mix3(tw, np.broadcast_to(BLUE, (H, W, 3)), np.clip(t_mid * 1.3 - 0.3, 0, 1))
tw = mix3(tw, np.broadcast_to(INDIGO, (H, W, 3)), t_high ** 0.8)

# long streaks of cloud, lit from under on the sun's side, slate away from it
streak = fbm(11, 3, 9.0)
streak = np.clip((streak - 0.52) / 0.22, 0, 1) ** 1.6
band = np.exp(-(((DEG - 14.0) / 6.0) ** 2))
lit = np.broadcast_to(lin((132, 142, 168)), (H, W, 3))
tw = mix3(tw, lit, np.clip(streak * band * 0.7, 0, 1))


def cloud(az0, el0, saz, sel, seed):
    """A long soft cloud at a place on the sky, its edges broken by noise."""
    dd = angle_from(az0)
    body = np.exp(-((dd / saz) ** 2)) * np.exp(-(((DEG - el0) / sel) ** 2))
    return np.clip(body * (0.55 + 0.95 * fbm(seed, 9, 22.0, 4)) - 0.16, 0, 1)


# What is left of the light on two clouds, each with its slate under-side; on the
# layout's frame, where the reference has them (bearings from c14/hour_rays.mjs).
for az0, el0, saz, sel, seed, colour in (
    (-46.0, 8.4, 9.0, 0.55, 51, (112, 112, 140)),
    (-47.0, 9.0, 8.0, 0.7, 52, (214, 168, 172)),
    (-21.0, 7.0, 8.0, 0.4, 53, (118, 120, 146)),
    (-23.0, 7.7, 8.5, 0.55, 54, (236, 208, 188)),
):
    tw = mix3(tw, np.broadcast_to(lin(colour), (H, W, 3)), cloud(az0, el0, saz, sel, seed))
tw = tw * look("TW_SKY", 1.0)

# (what the print takes from a dark blue is more of its red than of its blue, so these
# stand greyer than the reference's values on the frame: 59, 93, 131 and 78, 119, 161)
far_tw = mix3(np.broadcast_to(lin((76, 92, 110)), (H, W, 3)), np.broadcast_to(lin((86, 100, 116)), (H, W, 3)), side)
mist_tw = mix3(np.broadcast_to(lin((104, 130, 158)), (H, W, 3)), np.broadcast_to(lin((116, 138, 164)), (H, W, 3)), side * 0.7)
twilight = compose(tw, lin((50, 80, 112)), far_tw, mist_tw * look("TW_MIST", 1.0), look("TW_MIST_K", 0.72), 0.5)

# ---- THE MASSIFS, by bearing and height on the plate (degrees): on the layout's
# frame they stand where the reference has its two great dark mountains.
AZ_DEG = np.degrees(az)
MASSIF = np.array([
    (-180, 2.0), (-140, 3.0), (-110, 6.0), (-90, 10.0), (-70, 11.5), (-60, 10.5), (-55, 9.6), (-50, 8.3),
    (-45.5, 7.0), (-40, 5.4), (-34, 3.7), (-30, 2.6), (-27, 1.6), (-25, 1.8), (-23.5, 3.0), (-22, 4.0),
    (-18, 5.0), (-13.7, 6.3), (-9, 7.6), (-5, 8.8), (-1, 9.4), (3, 9.2), (7, 8.9), (11, 9.0), (15, 8.6),
    (25, 6.6), (40, 4.6), (60, 2.5), (90, 1.5), (120, 1.5), (180, 2.0),
])
rng_m = np.random.default_rng(41)
prof = np.interp(AZ_DEG, MASSIF[:, 0], MASSIF[:, 1], period=360.0)
for k, a in ((11, 0.42), (23, 0.32), (47, 0.22), (97, 0.14), (191, 0.08), (383, 0.05), (767, 0.03)):
    # (ridged: the crests sharp and the saddles round, as a mountain's are)
    prof = prof + a * (1 - 2 * np.abs(np.sin(np.radians(AZ_DEG) * k * 0.5 + rng_m.uniform(0, 6.283))))
massif_mask = np.clip((prof[None, :] - DEG) / 0.07, 0, 1) * np.clip((DEG + 0.4) / 0.6, 0, 1)
facet = fbm(61, 26, 34.0, 4)


def with_massifs(plate, dark, foot):
    t = (np.clip((DEG - 0.6) / 3.2, 0, 1) ** 0.8)[..., None]
    col = (np.broadcast_to(foot, (H, W, 3)) * (1 - t) + np.broadcast_to(dark, (H, W, 3)) * t) * (0.86 + 0.32 * facet)[..., None]
    m = massif_mask[..., None]
    return plate * (1 - m) + col * m


twilight = with_massifs(twilight, lin((26, 46, 64)), lin((56, 78, 100)))

# ---- THE MIDNIGHT
ZEN = lin((8, 14, 36))
UP = lin((14, 24, 56))
FOOT = lin((28, 40, 74))
t1 = np.clip(DEG / 16.0, 0, 1) ** 0.7
t2 = np.clip((DEG - 12.0) / 55.0, 0, 1) ** 0.8
ni = mix3(mix3(np.broadcast_to(FOOT, (H, W, 3)), np.broadcast_to(UP, (H, W, 3)), t1), np.broadcast_to(ZEN, (H, W, 3)), t2)
# a thin high veil, so the sky is not a flat fill under its stars
veil = fbm(23, 4, 5.0, 4)
ni = ni * (0.92 + 0.22 * np.clip(veil, 0, 1))[..., None]
ni = ni * look("NI_SKY", 1.0)
far_ni = np.broadcast_to(lin((22, 32, 58)), (H, W, 3))
mist_ni = np.broadcast_to(lin((34, 46, 76)), (H, W, 3)) * look("NI_MIST", 1.0)
night = compose(ni, lin((7, 11, 20)), far_ni, mist_ni, look("NI_MIST_K", 0.6), 0.5)
night = with_massifs(night, lin((6, 12, 26)), lin((22, 32, 58)))

os.makedirs(OUT, exist_ok=True)
for name, plate, seed, q in (("twilight", twilight, 31, 92), ("night", night, 37, 94)):
    out8 = dither(plate, seed)
    path = os.path.join(OUT, f"sky_estate_v12_{name}_4k.jpg")
    # 4:4:4: a dark colour gradient at a chroma quarter the size is blocks
    Image.fromarray(out8, "RGB").save(path, quality=q, optimize=True, subsampling=0)
    print("PLATE", path, out8.shape, round(os.path.getsize(path) / 1024), "kB")
    # and at half the size, for a small screen (SkyHours.tsx, skyPlateUrl)
    small = cv2.resize(plate, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    path2 = os.path.join(OUT, f"sky_estate_v12_{name}_2k.jpg")
    Image.fromarray(dither(small, seed + 1), "RGB").save(path2, quality=q, optimize=True, subsampling=0)
    print("PLATE", path2, round(os.path.getsize(path2) / 1024), "kB")
    if PREVIEW:
        os.makedirs(PREVIEW, exist_ok=True)
        Image.fromarray(out8, "RGB").resize((2048, 1024), Image.LANCZOS).save(os.path.join(PREVIEW, f"{name}.jpg"), quality=90)

# ---- THE SKYLINE, by bearing: the highest land, degrees over the horizon, for
# the stars. 8 bits over 0..64 degrees: a quarter of a degree a level.
RIDGE_W = 1024
ridge = np.zeros(W)
ridge_any = np.where(land, DEG, -90.0).max(axis=0)
ridge = np.maximum(np.maximum(ridge_any, 0.0), prof)
# bins of the plate's width down to the table's: the highest of each bin
idx = (np.arange(W) * RIDGE_W // W).astype(int)
table = np.zeros(RIDGE_W)
np.maximum.at(table, idx, ridge)
data8 = np.clip(np.round(table / 64.0 * 255.0), 0, 255).astype(np.uint8)
Image.fromarray(data8[None, :], "L").save(os.path.join(OUT, "sky_estate_v12_ridge.png"), optimize=True)
print("RIDGE", round(float(table.max()), 1), "degrees at most")
