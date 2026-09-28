"""
The v7 sky from a photograph: Poly Haven's kloppenheim_06_puresky (CC0, Greg
Zaal / Jarod Guest), rotated onto the estate's sun and graded to sit where the
painted sky sat.

    python make_sky_ph_v7.py <in.hdr> <reference_sky.jpg> <out.jpg> <env_out.jpg>

WHY. The third review asked for "a photographic sky". The painted sky
(make_sky_v7.py) had the right hour and the right light, but its clouds were
noise: soft, uniform, the same scale everywhere, and a trained eye reads that as
generated. A photographed sky has what noise cannot fake - cumulus with hard
lit edges and soft shaded bellies, perspective (large clouds overhead, a
crowded band at the horizon), cirrus at a different altitude from the cumulus.

A PURE SKY, deliberately. The first photographic HDRI the site shipped carried
forested hills and a village on its horizon, and the client called it "a slum".
Poly Haven's "pure sky" variants have had the land removed; below the horizon
this script puts back the same haze the painted sky had, and the lighting copy
gets the lawn's bounce, exactly as make_sky_v7.py does.

THE SUN. In the photograph it stands 4.6 degrees up. The estate's key light
(WorldCanvas DAY_SUN) stands at 14. The panorama is turned about the vertical so
the two share a bearing, and the key keeps its height: the shadows it throws were
approved, and a sun 5 degrees up would put the lawn in the berm's shadow. The sky
still reads as the same hour - the warm glow sits on the key's bearing - and in
the lighting copy the photographed sun disc is taken down to its surrounding
glow, so no polished surface reflects a second sun below the one that lights it.

Orientation: three's equirect lookup, u = atan2(z, x)/2pi + 0.5, image top =
zenith (see make_sky_v7.py).
"""
import sys

import cv2
import numpy as np
from PIL import Image

HDR, REF, OUT, ENV_OUT = sys.argv[1:5]
SUN_DIR = np.array([86.0, 25.0, 50.0])
SUN_DIR = SUN_DIR / np.linalg.norm(SUN_DIR)


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lum(c):
    return c @ np.array([0.2126, 0.7152, 0.0722])


sky = cv2.imread(HDR, cv2.IMREAD_UNCHANGED)[:, :, ::-1].astype(np.float64)
H, W, _ = sky.shape

# 1. Turn the panorama so the photographed sun sits on the key light's bearing.
L = lum(sky)
sy, sx = np.unravel_index(np.argmax(L), L.shape)
u_sun = (sx + 0.5) / W
u_key = np.arctan2(SUN_DIR[2], SUN_DIR[0]) / (2 * np.pi) + 0.5
shift = int(round((u_key - u_sun) * W))
sky = np.roll(sky, shift, axis=1)
sx = (sx + shift) % W
print("sun at elev %.1f deg, turned %d px" % ((0.5 - (sy + 0.5) / H) * 180, shift))

v = (np.arange(H) + 0.5) / H
dy = np.sin((0.5 - v) * np.pi)[:, None] * np.ones((1, W))
upper = dy > 0.02

# 2. Exposure: the photograph's median sky brightness onto the painted sky's,
# so every fog, haze and grade constant tuned against the painted sky still
# holds. Matched on the median, which the sun and the brightest cloud tops do
# not move.
ref = srgb_to_lin(np.asarray(Image.open(REF).convert("RGB").resize((W, H), Image.LANCZOS)))
# Then a third of a stop over: the painted sky was a clean, bright haze, and a
# photographed one matched on its median reads a shade overcast beside it - the
# clouds' shaded bellies pull it down. The hour should read as luminous.
LIFT = 1.3
gain = np.median(lum(ref)[upper]) / np.median(lum(sky)[upper]) * LIFT
sky *= gain
print("exposure gain %.3f" % gain)

# 3. A film shoulder rather than a clip: the lit cumulus tops roll off into
# white instead of flattening into a plate at 1.0. Applied to luminance, so the
# roll-off does not bleach the warm side of the clouds toward cyan or magenta.
KNEE = 0.62
Y = lum(sky)
Yc = np.where(Y < KNEE, Y, KNEE + (1 - KNEE) * (1 - np.exp(-(Y - KNEE) / (1 - KNEE))))
sky *= (Yc / np.maximum(Y, 1e-6))[..., None]

# 4. Below the horizon: the painted sky's haze, which the fog colour matches.
# The photograph's own lower half is a blurred mirror of its sky.
ground_haze = srgb_to_lin((176, 164, 146))
hr = int(H * 0.5) - 3
horizon = cv2.GaussianBlur(sky[hr - 6:hr].mean(axis=0, keepdims=True), (0, 0), sigmaX=24, sigmaY=0.1)
fade = np.clip(-dy / 0.08, 0, 1)
below = horizon * (1 - fade[..., None]) + ground_haze[None, None, :] * fade[..., None]
blend = np.clip((0.012 - dy) / 0.012, 0, 1)[..., None]   # a feather, not a seam
sky = sky * (1 - blend) + below * blend

img = (lin_to_srgb(sky) * 255 + 0.5).astype(np.uint8)
Image.fromarray(img, "RGB").save(OUT, quality=88, optimize=True, progressive=True)

# 5. The lighting copy (see make_sky_v7.py, "THE LIGHTING COPY"): the lawn's
# bounce below the horizon, and the photographed sun disc taken down to the
# glow around it (the key light is the sun).
EW, EH = 1024, 512
env = cv2.resize(sky, (EW, EH), interpolation=cv2.INTER_AREA)
ex, ey = np.meshgrid(np.arange(EW), np.arange(EH))
cx, cy = sx * EW / W, sy * EH / H
dist = np.hypot(np.minimum(np.abs(ex - cx), EW - np.abs(ex - cx)), ey - cy)
glow = np.median(lum(env)[(dist > 10) & (dist < 16)])
El = lum(env)
cap = np.where(dist < 10, np.minimum(El, glow), El)
env *= (cap / np.maximum(El, 1e-6))[..., None]
ev = (np.arange(EH) + 0.5) / EH
edy = np.sin((0.5 - ev) * np.pi)[:, None]
bounce = srgb_to_lin((74, 88, 44))
t = np.clip(-edy / 0.12, 0, 1) ** 0.8
horizon_row = env[EH // 2 - 1][None, :, :]
ground = horizon_row * (1 - t[..., None]) + bounce[None, None, :] * t[..., None]
env = np.where((edy < 0)[..., None], ground, env)
Image.fromarray((lin_to_srgb(env) * 255 + 0.5).astype(np.uint8), "RGB").save(ENV_OUT, quality=90, optimize=True)

# The horizon colour on the sun's bearing, and opposite it: DAYLIGHT_HAZE (the
# fog) must sit between them, nearer the sun side the hero looks across.
for name, uu in (("sun", u_key), ("anti", (u_key + 0.5) % 1)):
    col = sky[hr - 4:hr, int(uu * W) - 40:int(uu * W) + 40].reshape(-1, 3).mean(axis=0)
    print("horizon", name, "sRGB", tuple(int(x) for x in lin_to_srgb(col) * 255 + 0.5))
print("SKY", OUT, img.shape, "ENV", ENV_OUT)
