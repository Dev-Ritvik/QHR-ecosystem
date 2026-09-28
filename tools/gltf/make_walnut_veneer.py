r"""
A book-matched, crown-cut walnut veneer, generated: basecolor, roughness and a
normal map for the hall's panelling (MAT_Wood_Dark).

    python make_walnut_veneer.py <out_dir> [size]

WHY GENERATED. The hall's panels arrived with a parquet-strip texture on UVs
that run into the thousands (measured: -2879..2880), so no photograph could be
laid on them as delivered; HallModel re-projects one sheet per panel at load.
A panel of real boiserie is exactly that — one book-matched set of leaves per
field — so the texture is authored as a whole sheet, not a tile:

  * LEAVES. Six leaves across the sheet, consecutive slices of one log, each
    mirrored against its neighbour (book-matched), so the figure meets itself
    at every joint and the panel reads symmetrical from across the room.
  * FIGURE. Crown cut: growth rings sliced at a shallow angle through a
    slightly tapered log make nested cathedral arches up the leaf. Modelled as
    level sets of a paraboloid in (across, along), warped by low-frequency
    noise that runs WITH the grain, so the arches wander the way wood does.
  * RINGS. Each ring is a wide pale earlywood band closed by a thin dark
    latewood line; the profile is asymmetric, which is what separates wood
    from stripes.
  * PORES. Walnut is semi-ring-porous: fine dark dashes along the grain, which
    also give the lacquer its only texture (roughness and normal).
  * TONE. Chocolate to a warm mid-brown, with a slow lengthwise shift between
    leaves. No reds, no orange: the hall's print warms it enough.
"""
import os
import sys

import numpy as np
from PIL import Image

OUT = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 2048
LEAVES = 6
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1847)


def value_noise(shape, cells, seed):
    """Smooth value noise on a (cells_y x cells_x) lattice, bicubic-upsampled."""
    r = np.random.default_rng(seed)
    g = r.random((cells[0] + 3, cells[1] + 3)).astype(np.float32)
    img = Image.fromarray(g, mode="F").resize((shape[1], shape[0]), Image.BICUBIC)
    return np.asarray(img, dtype=np.float32)


def fbm(shape, base, octaves, seed, aspect=(1.0, 1.0)):
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        cy = max(1, int(base * aspect[0] * 2 ** o))
        cx = max(1, int(base * aspect[1] * 2 ** o))
        out += amp * value_noise(shape, (cy, cx), seed + o * 101)
        tot += amp
        amp *= 0.5
    return out / tot


H, W = N, N
leaf_w = W // LEAVES
# One leaf's field, generated a little taller than needed so slices can shift.
lh, lw = H, leaf_w
yy, xx = np.mgrid[0:lh, 0:lw].astype(np.float32)
v = yy / lh            # along the grain, 0 bottom .. 1 top (image rows top-down; flipped below)
u = xx / lw            # across the leaf

leaves_rgb, leaves_pore = [], []
for i in range(LEAVES // 2):
    seed = 7000 + i * 13
    # Warp: slow along the grain, a little faster across it.
    warp = (fbm((lh, lw), 2, 4, seed, aspect=(1.5, 0.6)) - 0.5) * 0.22
    warp2 = (fbm((lh, lw), 6, 3, seed + 50, aspect=(3.0, 0.8)) - 0.5) * 0.035
    # Crown cut: the heart sits slightly off the leaf's centre line; ring index
    # rises with the parabola across and with height along.
    heart = 0.42 + 0.08 * (i % 2)
    t = 5.5 * (u - heart + warp) ** 2 * 3.2 + (1.0 - v) * 2.6 + warp2 * 8.0
    rings = 5.2 * t + fbm((lh, lw), 3, 3, seed + 90, aspect=(2.0, 0.5)) * 0.9
    f = rings - np.floor(rings)
    # Earlywood fades into a thin, sharp latewood line.
    late = np.clip((f - 0.62) / 0.38, 0, 1) ** 2.2
    early = 1.0 - late
    # Slow tonal drift, lengthwise, and a few darker streaks (mineral lines).
    drift = fbm((lh, lw), 2, 3, seed + 200, aspect=(1.0, 0.25))
    streak = np.clip((fbm((lh, lw), 5, 3, seed + 300, aspect=(0.3, 2.5)) - 0.62) * 4.0, 0, 1)
    # Pores: short dashes stretched along the grain.
    pn = fbm((lh, lw), 110, 2, seed + 400, aspect=(0.22, 1.0))
    pores = np.clip((pn - 0.70) * 5.0, 0, 1) * 0.8

    dark = np.array([0.036, 0.019, 0.011], np.float32)     # latewood, linear
    mid = np.array([0.092, 0.050, 0.028], np.float32)      # body
    pale = np.array([0.170, 0.092, 0.047], np.float32)     # earlywood highlight
    tone = 0.85 + 0.3 * drift
    base = mid[None, None, :] * tone[..., None]
    base = base + (pale - mid)[None, None, :] * (early * 0.55 * (0.6 + 0.4 * drift))[..., None]
    base = base * (1.0 - 0.7 * late)[..., None] + dark[None, None, :] * (0.7 * late)[..., None]
    base = base * (1.0 - 0.35 * streak)[..., None]
    base = base * (1.0 - 0.22 * pores)[..., None]
    leaves_rgb.append(base)
    leaves_pore.append(np.maximum(pores, late * 0.35))

rgb = np.zeros((H, W, 3), np.float32)
pore = np.zeros((H, W), np.float32)
for k in range(LEAVES):
    src = k // 2
    L, P = leaves_rgb[src], leaves_pore[src]
    if k % 2 == 1:           # book-match: every second leaf is its neighbour's mirror
        L, P = L[:, ::-1], P[:, ::-1]
    rgb[:, k * leaf_w:(k + 1) * leaf_w] = L[:, :leaf_w]
    pore[:, k * leaf_w:(k + 1) * leaf_w] = P[:, :leaf_w]
# Fill any rounding remainder at the right edge from the last leaf.
if LEAVES * leaf_w < W:
    rgb[:, LEAVES * leaf_w:] = rgb[:, LEAVES * leaf_w - (W - LEAVES * leaf_w):LEAVES * leaf_w]
    pore[:, LEAVES * leaf_w:] = pore[:, LEAVES * leaf_w - (W - LEAVES * leaf_w):LEAVES * leaf_w]
# Written as generated: image row 0 is the TOP of the panel, and the cathedral
# arches point up it, the way veneer is laid. The KTX2 copies load with
# flipY false, so the runtime projection (hallWalnut.ts) samples row 0 at the
# panel's top edge.


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


Image.fromarray((to_srgb(rgb) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "walnut_basecolor.png"))

# Lacquer: smooth, a touch rougher in the pores and on the latewood.
rough = 0.2 + 0.16 * pore
Image.fromarray((np.clip(rough, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "walnut_roughness.png"))

# Normal from the pores as a shallow height field (pores are hollows).
height = -pore * 0.6
gy, gx = np.gradient(height)
strength = 1.2
nx, ny, nz = -gx * strength, gy * strength, np.ones_like(gx)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
nrm = np.stack([nx / ln, ny / ln, nz / ln], axis=-1)
Image.fromarray(((nrm * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "walnut_normal.png"))
print("wrote", OUT, N)
