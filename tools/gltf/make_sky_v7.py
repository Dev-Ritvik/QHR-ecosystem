"""
Paint the v7 sky: an equirectangular panorama with nothing in it but sky.

    python make_sky_v7.py <out.jpg> [width]

WHY. The background the site shipped was a photographic HDRI of a Central
European meadow - forested hills, a farm track and a village on the horizon -
and it is what the client review called "cheap", "a slum", with "villages".
The estate now brings its own horizon (a planted berm and a belt of rain trees
and palms inside a compound wall), so the panorama only has to be sky.

REPAINTED FOR THE GOLDEN HOUR, and that is the single largest change in the
"make it look expensive" pass. A noon sky is the cheapest light there is: it
lands flat on every surface, it has no direction, and it gives a render nothing
to model with. Every photograph of a house that sells for what this one is meant
to sell for was taken in the last hour of light. So:

  * the sun sits 13 degrees up rather than 32, on the front-left bearing the
    daylight key now uses, which rakes the south and west elevations and throws
    the palms' shadows the length of the lawn;
  * the horizon is WARM where the sun is and cool opposite it, which is what
    gives a panorama a direction even in the parts of frame the sun never
    reaches;
  * the cumulus sit lower and are lit on their sun side, shaded on the other,
    with a cirrus deck above them catching the last of it;
  * and the whole thing is graded a stop down from noon, so the building's lit
    faces are the brightest thing in the picture rather than the sky behind it.

Orientation matches three's equirect lookup (u = atan2(z, x)/2pi + 0.5,
v = asin(y)/pi + 0.5, image top = zenith), so SUN_DIR below is in three space
and MUST agree with the daylight key light in WorldCanvas.
"""
import sys

import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "sky_estate_v7.jpg"
W = int(sys.argv[2]) if len(sys.argv) > 2 else 4096
H = W // 2
# The daylight key: [-96, 26, 62] in WorldCanvas, normalised.
SUN_DIR = np.array([-96.0, 26.0, 62.0])
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

zenith = srgb_to_lin((36, 78, 150))
mid = srgb_to_lin((104, 146, 196))
horizon_cool = srgb_to_lin((186, 198, 210))
horizon_warm = srgb_to_lin((250, 208, 156))
ground_haze = srgb_to_lin((176, 164, 146))

h = np.clip(dy, 0, 1)
# Azimuthal warmth: 1 toward the sun, 0 away from it, over a wide falloff so the
# whole sun side of the sky carries the hour.
sun_h = np.array([SUN_DIR[0], 0.0, SUN_DIR[2]])
sun_h = sun_h / np.linalg.norm(sun_h)
az = np.clip(dx * sun_h[0] + dz * sun_h[2], -1, 1)
warm_h = np.clip(0.5 + 0.5 * az, 0, 1) ** 1.5

horizon = horizon_cool[None, None, :] * (1 - warm_h[..., None]) + horizon_warm[None, None, :] * warm_h[..., None]
t1 = np.clip(h / 0.16, 0, 1) ** 0.75
t2 = np.clip((h - 0.16) / 0.84, 0, 1) ** 0.85
sky = horizon * (1 - t1[..., None]) + mid[None, None, :] * t1[..., None]
sky = sky * (1 - t2[..., None]) + zenith[None, None, :] * t2[..., None]

# Sun glow: a broad warm scatter and a tighter halo. The disc itself is left out;
# bloom in the composer owns that.
cosang = np.clip(dx * SUN_DIR[0] + dy * SUN_DIR[1] + dz * SUN_DIR[2], -1, 1)
glow = np.exp((cosang - 1) * 5.0) * 0.85 + np.exp((cosang - 1) * 44.0) * 1.5
warm = srgb_to_lin((255, 222, 168))
sky = sky + warm[None, None, :] * glow[..., None] * (0.45 + 0.55 * (1 - h[..., None]))


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


# Cumulus, lower in the sky than a noon deck and lit from the side. The lit
# colour is the sun's own, not white: at this hour a cloud's sunward face is the
# warmest thing in frame and its shadow side is the blue of the sky it sits in.
n = fbm((H, W), 6, 8, 11)
band = np.exp(-((h - 0.17) / 0.15) ** 2) * np.clip((dy - 0.008) / 0.04, 0, 1)
cover = np.clip((n + 0.02) * 4.4, 0, 1) * band
cover = cover ** 1.3
cloud_lit = srgb_to_lin((255, 226, 190))
cloud_shade = srgb_to_lin((132, 146, 172))
# Which side of a cloud is lit follows the sun's azimuth, offset by the cloud's
# own shape so the terminator is ragged rather than a gradient across the sky.
shade_mix = np.clip(0.28 + 1.5 * warm_h + 1.4 * fbm((H, W), 4, 16, 12), 0, 1)
cloud = cloud_shade[None, None, :] * (1 - shade_mix[..., None]) + cloud_lit[None, None, :] * shade_mix[..., None]
sky = sky * (1 - cover[..., None] * 0.88) + cloud * cover[..., None] * 0.88

# A high cirrus deck, stretched in longitude, catching the last light. It is
# what keeps the upper half of frame from being an empty blue field.
cn = fbm((H, W), 5, 6, 21)
cirrus = np.clip((cn + 0.06) * 3.4, 0, 1) * np.exp(-((h - 0.55) / 0.34) ** 2)
cirrus = cirrus ** 1.6 * 0.4
cirrus_col = srgb_to_lin((255, 232, 206))
sky = sky * (1 - cirrus[..., None]) + cirrus_col[None, None, :] * cirrus[..., None]

# Below the horizon: haze that the fog colour matches, never visible except
# past the tree belt.
below = dy < 0
fade = np.clip(-dy / 0.08, 0, 1)
gh = horizon * (1 - fade[..., None]) + ground_haze[None, None, :] * fade[..., None]
sky = np.where(below[..., None], gh, sky)

img = (lin_to_srgb(sky) * 255 + 0.5).astype(np.uint8)
Image.fromarray(img, "RGB").save(OUT, quality=88, optimize=True, progressive=True)
# The horizon colour on the sun's bearing is what DAYLIGHT_HAZE must match.
warm_horizon = lin_to_srgb(horizon_cool * 0.25 + horizon_warm * 0.75) * 255
print("SKY", OUT, img.shape, "haze sRGB", tuple(int(x) for x in (warm_horizon + 0.5)))
