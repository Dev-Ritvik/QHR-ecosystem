"""
Paint the v7 daylight sky: an equirectangular panorama with nothing in it but sky.

    python make_sky_v7.py <out.jpg> [width]

WHY. The background the site shipped was a photographic HDRI of a Central
European meadow - forested hills, a farm track and a village on the horizon -
and it is what the client review called "cheap", "a slum", with "villages".
The estate now brings its own horizon (a planted berm and a belt of rain trees
and palms inside a compound wall), so the panorama only has to be sky: a deep
tropical blue overhead, a warm haze at the horizon that the scene fog matches,
a sun glow where the key light is, and a few soft fair-weather clouds.

Orientation matches three's equirect lookup (u = atan2(z, x)/2pi + 0.5,
v = asin(y)/pi + 0.5, image top = zenith), so SUN_DIR below is in three space
and must agree with the daylight key light in WorldCanvas.
"""
import sys

import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "sky_estate_v7.jpg"
W = int(sys.argv[2]) if len(sys.argv) > 2 else 4096
H = W // 2
SUN_DIR = np.array([-0.61, 0.53, 0.59])
SUN_DIR = SUN_DIR / np.linalg.norm(SUN_DIR)
rng = np.random.default_rng(3)


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


v = (np.arange(H) + 0.5) / H          # 0 top .. 1 bottom
u = (np.arange(W) + 0.5) / W
lat = (0.5 - v) * np.pi                 # +pi/2 zenith
lon = (u - 0.5) * 2 * np.pi
LAT, LON = np.meshgrid(lat, lon, indexing="ij")
dx = np.cos(LAT) * np.cos(LON)
dz = np.cos(LAT) * np.sin(LON)
dy = np.sin(LAT)

zenith = srgb_to_lin((58, 110, 184))
mid = srgb_to_lin((120, 166, 214))
horizon = srgb_to_lin((214, 222, 222))
ground_haze = srgb_to_lin((170, 180, 170))

h = np.clip(dy, 0, 1)
t1 = np.clip(h / 0.18, 0, 1) ** 0.8
t2 = np.clip((h - 0.18) / 0.82, 0, 1) ** 0.9
sky = horizon[None, None, :] * (1 - t1[..., None]) + mid[None, None, :] * t1[..., None]
sky = sky * (1 - t2[..., None]) + zenith[None, None, :] * t2[..., None]

# Sun glow: a broad warm scatter and a tighter halo. The disc itself is left out;
# the scene's own god-ray pass owns that.
cosang = np.clip(dx * SUN_DIR[0] + dy * SUN_DIR[1] + dz * SUN_DIR[2], -1, 1)
glow = np.exp((cosang - 1) * 9.0) * 0.55 + np.exp((cosang - 1) * 90.0) * 0.9
warm = srgb_to_lin((255, 236, 200))
sky = sky + warm[None, None, :] * glow[..., None] * (0.35 + 0.65 * (1 - h[..., None]))


def fbm(shape, octaves, base, seed):
    r = np.random.default_rng(seed)
    out = np.zeros(shape)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        n = base * (2 ** o)
        small = r.standard_normal((n // 2 + 1, n + 1))
        img = Image.fromarray(((small - small.min()) / (np.ptp(small) + 1e-9) * 255).astype(np.uint8))
        up = np.asarray(img.resize((shape[1], shape[0]), Image.BICUBIC), dtype=np.float64) / 255.0
        out += amp * (up - 0.5)
        total += amp
        amp *= 0.55
    return out / total


# Fair-weather cumulus: thresholded fbm, flattened toward the horizon, thin
# overhead so the zenith stays clean blue behind the constellation.
n = fbm((H, W), 6, 8, 11)
band = np.exp(-((h - 0.24) / 0.2) ** 2) * np.clip((dy - 0.01) / 0.05, 0, 1)
cover = np.clip((n + 0.015) * 4.2, 0, 1) * band
cover = cover ** 1.35
cloud_lit = srgb_to_lin((250, 248, 244))
cloud_shade = srgb_to_lin((176, 186, 200))
shade_mix = np.clip(0.5 + 1.8 * fbm((H, W), 4, 16, 12), 0, 1)
cloud = cloud_shade[None, None, :] * (1 - shade_mix[..., None]) + cloud_lit[None, None, :] * shade_mix[..., None]
sky = sky * (1 - cover[..., None] * 0.85) + cloud * cover[..., None] * 0.85

# Below the horizon: haze that the fog colour matches, never visible except
# past the tree belt.
below = dy < 0
fade = np.clip(-dy / 0.08, 0, 1)
gh = horizon[None, None, :] * (1 - fade[..., None]) + ground_haze[None, None, :] * fade[..., None]
sky = np.where(below[..., None], gh, sky)

img = (lin_to_srgb(sky) * 255 + 0.5).astype(np.uint8)
Image.fromarray(img, "RGB").save(OUT, quality=88, optimize=True, progressive=True)
horizon_srgb = tuple(int(x) for x in (lin_to_srgb(horizon) * 255 + 0.5))
print("SKY", OUT, img.shape, "horizon sRGB", horizon_srgb)
