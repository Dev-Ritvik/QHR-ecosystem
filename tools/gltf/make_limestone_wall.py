"""
Author the P4A primary-limestone SURFACE set for MAT_Stone_Wall.

    python tools/gltf/make_limestone_wall.py

WHY A SURFACE, NOT A COURSED TILE. The wall is 267 individually placed ashlar
blocks (mean 0.855 x 0.335 m, 0.36 m course pitch) over a field n-gon that is
95% hidden behind them. Each block is ONE physical stone with world-space UVs.
A coursed texture (make_stone_materials.py's wall set, 405 mm courses) would
print its own joints across those blocks - sub-courses on a single stone, the
classic tell of a wall texture dragged over masonry, and its 405 mm pitch would
beat against the 360 mm geometry. So this set carries no joints at all. The
MESO layer (per-block tone) rides COLOR_0 instead, written per object by
tools/blender/blocktone_stoneao.py, which costs no texture and exports as-is.

WHY NOT THE MARBLE SCAN IT REPLACES. marble026 had roughness mean 0.33 with a
0.11 floor (polished), 69% of its tonal energy above 1/64 of the tile (pure
micro), and under the #E7E3DA tint an effective albedo of R/B 2.50 - an orange.
Cut limestone (Bath, Portland, Caen) sits near linear (0.54, 0.51, 0.44),
R/B ~1.2-1.35, and reads matte-to-eggshell: roughness 0.55-0.80.

WHAT THIS SET IS.
  MACRO  bed mottle, 0.4-1.2 m, +/-6% luma, very slightly cool-warm drift so
         adjacent blocks do not share one tone even before COLOR_0 does its part.
  MESO   faint horizontal "bedding" bands, 60-120 mm, +/-2% - the sedimentary
         grain of the stone itself, NOT courses.
  MICRO  pores and shell pits 3-12 mm at low density, and a fine grain under
         them. Density is deliberately low: the viewer should see stone before
         texture.
  ROUGH  0.58 base, +0.12 in the mottle lows (dirt gathers where it is darker),
         pores rougher, band of 0.55..0.82 overall. Never below 0.50.
  NORMAL from height: pores in, bedding barely there, strength kept modest -
         the geometry already gives 25 mm of block relief and the shadow map
         resolves it; the map only has to carry pores at the 6 m camera.

COLOUR SPACE. Base is authored in LINEAR and written sRGB-encoded (to_srgb),
same as make_stone_materials.py; roughness and normal are written linear. The
tint stays in the material as the exporter's baseColorFactor, so the texture is
authored pale and near-neutral: linear mean ~(0.676, 0.664, 0.628), which the
tint (0.799, 0.768, 0.701) brings to the target.

Seamless by construction: every noise field is built on a wrapped lattice.
Tile spans 1.20 m at 1024 px -> 1.17 mm/px. Sources are untouched; this writes
a NEW key, limestone_*, beside the existing wall_* set.
"""
import numpy as np, os, json, sys
from PIL import Image

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..',
                                   'assets', 'materials', '_stone'))
RES = 1024
TILE_M = 1.20
SEED = 4101

# Authored base-colour mean, LINEAR, before the material tint. Overridable:
#     --mean R G B
# HISTORY. v1 used the physically "correct" limestone albedo target
# (0.54, 0.51, 0.44 after tint, R/B 1.23). Rendered under this scene's locked,
# cool environment that came out blue-grey in Blender (R/B 0.95) and blown out
# in the runtime (+67 luma over reference) - the old marble's heavy warmth had
# been compensating for the cool sky, and its low albedo (0.34 luma) for the
# runtime's direct key. So the target is the RENDERED read, not the albedo
# figure: warmer, and back near the old effective luma. v2 default below lands
# tint x texture at (0.470, 0.360, 0.235), R/B 2.0, luma 0.374.
_mean_default = [0.588, 0.469, 0.335]
if '--mean' in sys.argv:
    i = sys.argv.index('--mean'); _mean_default = [float(x) for x in sys.argv[i + 1:i + 4]]


def wrapped_noise(res, freq, rg):
    g = rg.random((freq, freq)).astype(np.float32)
    g = np.vstack([g, g[:1]]); g = np.hstack([g, g[:, :1]])
    t = np.linspace(0, freq, res, endpoint=False)
    i0 = np.floor(t).astype(int); f = (t - i0).astype(np.float32)
    s = f * f * (3 - 2 * f); sx, sy = s[None, :], s[:, None]
    a = g[i0[:, None], i0[None, :]]; b = g[i0[:, None], i0[None, :] + 1]
    c = g[i0[:, None] + 1, i0[None, :]]; d = g[i0[:, None] + 1, i0[None, :] + 1]
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def fbm(res, base_freq, octaves, rg, gain=0.5):
    out = np.zeros((res, res), np.float32); amp = 1.0; tot = 0.0; f = base_freq
    for _ in range(octaves):
        out += amp * wrapped_noise(res, f, rg); tot += amp; amp *= gain; f *= 2
    return out / tot


def height_to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nx, ny, nz = -dx, dy, np.full_like(h, 1.0 / 48.0)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5], -1)


def to_srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def save_rgb(name, arr):
    p = os.path.join(OUT, name)
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save(p, optimize=True)
    return p


def save_l(name, arr):
    p = os.path.join(OUT, name)
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), 'L').save(p, optimize=True)
    return p


rg = np.random.default_rng(SEED)
px_m = TILE_M / RES                      # metres per pixel

# ---- MACRO: bed mottle 0.4..1.2 m -----------------------------------------
mottle = fbm(RES, 2, 3, rg, gain=0.55)            # ~0.6 m dominant
mottle = (mottle - mottle.mean()) / (mottle.std() + 1e-6)   # z-score
macro = 1.0 + 0.06 * np.clip(mottle, -2, 2) / 2.0            # +/-6% luma
# slight warm/cool drift with the mottle: darker patches marginally warmer
drift = 0.012 * np.clip(mottle, -2, 2) / 2.0

# ---- MESO: bedding bands 60..120 mm, horizontal, faint --------------------
yy = np.arange(RES)[:, None] * px_m
band_f = rg.uniform(9.0, 13.0)                    # cycles per metre ~ 80-110 mm
bands = np.sin(2 * np.pi * (band_f * yy + 0.15 * fbm(RES, 3, 2, rg)))
bands = np.repeat(bands, 1, axis=1) if bands.shape[1] == RES else np.tile(bands, (1, RES))
meso = 1.0 + 0.02 * bands

# ---- MICRO: grain + pores/shell pits --------------------------------------
grain = fbm(RES, 96, 3, rg, gain=0.5); grain = (grain - 0.5) * 2.0          # -1..1
pore_field = fbm(RES, 48, 2, rg, gain=0.6)
pores = np.clip((pore_field - 0.78) / 0.22, 0, 1) ** 1.6                   # sparse pits
micro = 1.0 - 0.045 * pores - 0.018 * grain

# ---- base colour (linear), authored pale/near-neutral under the tint -----
base_mean = np.array(_mean_default, np.float32)
tone = (macro * meso * micro)[..., None]
base = base_mean[None, None, :] * tone
base[..., 0] *= (1.0 + drift); base[..., 2] *= (1.0 - drift)               # warm/cool drift
# dirt in pores: slightly darker & cooler-neutral
base *= (1.0 - 0.10 * pores)[..., None]

# ---- roughness -------------------------------------------------------------
rough = 0.58 + 0.12 * np.clip(-mottle, 0, 2) / 2.0                           # dirtier lows rougher
rough += 0.14 * pores + 0.03 * grain
rough = np.clip(rough, 0.52, 0.84)

# ---- normal from height -----------------------------------------------------
# v3: the runtime's key is a hard directional at grazing incidence on the west
# face, and it turned the bedding ripple and the pore relief into a dense
# horizontal stipple across every block that Cycles' softer lighting never
# showed. Bedding stays in the COLOUR (it is a tonal fact, not a relief), and
# the normal map carries pores only, at half the depth.
h = -0.5 * pores - 0.06 * grain
nrm = height_to_normal(h, strength=6.0)

files = {'basecolor': save_rgb('limestone_basecolor.png', to_srgb(base)),
         'roughness': save_l('limestone_roughness.png', rough),
         'normal': save_rgb('limestone_normal.png', nrm)}
Y = 0.2126 * base[..., 0] + 0.7152 * base[..., 1] + 0.0722 * base[..., 2]
tint = np.array([0.7991, 0.7682, 0.7011])
eff = base.reshape(-1, 3).mean(0) * tint
print(json.dumps({'tile_m': TILE_M, 'mm_per_px': round(px_m * 1000, 2),
                  'base_linear_mean': [round(float(x), 4) for x in base.reshape(-1, 3).mean(0)],
                  'base_luma_std': round(float(Y.std()), 4),
                  'effective_albedo_under_tint': [round(float(x), 4) for x in eff],
                  'effective_R_over_B': round(float(eff[0] / eff[2]), 3),
                  'rough_mean': round(float(rough.mean()), 3), 'rough_min': round(float(rough.min()), 3),
                  'rough_max': round(float(rough.max()), 3), 'pore_coverage': round(float((pores > 0.2).mean()), 4),
                  'files': files}, indent=1))
