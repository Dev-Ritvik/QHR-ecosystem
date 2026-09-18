"""
Synthesise the v7 estate texture set: tileable, low-contrast stone, paving and
lawn, plus the palm frond cut-out.

WHY SYNTHESISED, AND WHY THIS QUIET. The client review said the stone looked
"uneven, like a skin disease". Measured on the shipped set, that was two things:

  * limestone_normal.png is a coarse pebble field at full strength - every wall
    in raking light reads as popcorn render, not dressed limestone;
  * each ashlar block carried its own tone in COLOR_0 (0.90..1.08), so the
    facade was a patchwork of lighter and darker stones.

Dressed limestone at the distances this film is seen from (20-60 m) is nearly
featureless. What reads as QUALITY is crisp geometry - joints, rustication,
cornices - over a clean, even surface. So these maps are deliberately almost
flat: a few percent of low-frequency variation so a wall is not a CG plane, a
fine grain in the normal so a raking sun has something to catch, and nothing a
visitor can see as a blemish. The joints and rustication are GEOMETRY in the
v7 build, not texture.

Every noise field is generated in the frequency domain, so it tiles exactly.

    python make_estate_textures_v7.py <outdir>
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/materials/_v7"
os.makedirs(OUT, exist_ok=True)
RNG = np.random.default_rng(7)
N = 1024


def periodic_noise(n, beta, lo, hi, seed=None):
    """Tileable noise with a 1/f^beta spectrum restricted to [lo, hi] cycles per
    tile. Returns zero-mean, unit-std field."""
    rng = np.random.default_rng(seed) if seed is not None else RNG
    white = rng.standard_normal((n, n))
    f = np.fft.fft2(white)
    ky = np.fft.fftfreq(n)[:, None] * n
    kx = np.fft.fftfreq(n)[None, :] * n
    k = np.sqrt(kx * kx + ky * ky)
    k[0, 0] = 1.0
    amp = k ** (-beta / 2.0)
    amp[(k < lo) | (k > hi)] = 0.0
    field = np.real(np.fft.ifft2(f * amp))
    field -= field.mean()
    s = field.std()
    return field / s if s > 0 else field


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def colour_map(base_srgb, variation, name):
    """Base colour times (1 + variation), variation in linear luminance units."""
    base = srgb_to_lin(base_srgb)
    rgb = base[None, None, :] * (1.0 + variation[:, :, None])
    img = (lin_to_srgb(rgb) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(img, "RGB").save(os.path.join(OUT, name))


def normal_map(height, strength, name):
    """Tangent-space normal from a periodic height field (wraps at the edges)."""
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    nx, ny, nz = -dx * strength, dy * strength, np.ones_like(height)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / ln, ny / ln, nz / ln], axis=-1)
    img = ((n * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(img, "RGB").save(os.path.join(OUT, name))
    tilt = np.degrees(np.arccos(np.clip(n[:, :, 2], -1, 1)))
    return float(np.percentile(tilt, 95))


def grey_map(values, name):
    img = (np.clip(values, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(img, "L").save(os.path.join(OUT, name))


report = {}

# --- LIMESTONE (walls). Warm ivory, sold as "dressed stone", not render. -----
lf = periodic_noise(N, 2.4, 1.5, 12)
mf = periodic_noise(N, 1.6, 12, 90)
grain = periodic_noise(N, 0.6, 180, 512)
colour_map((214, 199, 174), 0.022 * lf + 0.012 * mf + 0.016 * grain, "v7_limestone_basecolor.png")
report["limestone_tilt95"] = normal_map(0.55 * mf + 1.0 * grain, 0.09, "v7_limestone_normal.png")
grey_map(0.8 + 0.035 * mf + 0.03 * grain, "v7_limestone_roughness.png")

# --- TRIM (cornices, surrounds, columns, balustrade). Lighter and finer. -----
lf2 = periodic_noise(N, 2.4, 1.5, 10)
grain2 = periodic_noise(N, 0.6, 220, 512)
colour_map((228, 218, 199), 0.014 * lf2 + 0.01 * grain2, "v7_trim_basecolor.png")
report["trim_tilt95"] = normal_map(0.8 * grain2, 0.07, "v7_trim_normal.png")
grey_map(0.7 + 0.03 * grain2, "v7_trim_roughness.png")

# --- PAVING (terrace, steps, forecourt). 1 m slabs on a 2 m tile. ------------
# Each slab its own quiet tone (+/-2.5%), a dark 6 mm joint, a worn arris.
slabs = 2
cell = N // slabs
tone = np.zeros((N, N))
for j in range(slabs):
    for i in range(slabs):
        tone[j * cell:(j + 1) * cell, i * cell:(i + 1) * cell] = RNG.uniform(-0.025, 0.025)
yy, xx = np.mgrid[0:N, 0:N]
jd = np.minimum(np.minimum(xx % cell, cell - xx % cell), np.minimum(yy % cell, cell - yy % cell))
joint = np.clip(1.0 - jd / 3.0, 0, 1)          # ~6 mm at 2 m / 1024 px
arris = np.clip(1.0 - jd / 10.0, 0, 1) * 0.35
pgrain = periodic_noise(N, 0.8, 120, 512)
pmid = periodic_noise(N, 1.8, 4, 60)
colour_map((196, 178, 150), tone + 0.015 * pmid + 0.02 * pgrain - 0.55 * joint - 0.06 * arris, "v7_paving_basecolor.png")
report["paving_tilt95"] = normal_map(0.5 * pgrain - 6.0 * joint - 1.2 * arris, 0.12, "v7_paving_normal.png")
grey_map(0.82 + 0.04 * pgrain + 0.1 * joint, "v7_paving_roughness.png")

# --- LAWN. A 6 m tile: two 3 m mowing stripes and fine turf. -----------------
stripe = np.where((xx // (N // 2)) % 2 == 0, 1.0, -1.0)
# Soften the stripe edge over ~10 cm so it reads as mown grass, not paint.
stripe = np.array(Image.fromarray(((stripe * 0.5 + 0.5) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))) / 255.0 * 2 - 1
turf = periodic_noise(N, 0.4, 200, 512)
tmid = periodic_noise(N, 1.4, 8, 80)
tlf = periodic_noise(N, 2.2, 1, 6)
colour_map((92, 124, 62), 0.035 * stripe + 0.05 * tmid + 0.08 * turf + 0.05 * tlf, "v7_lawn_basecolor.png")
report["lawn_tilt95"] = normal_map(1.2 * turf, 0.35, "v7_lawn_normal.png")
grey_map(0.92 + 0.04 * turf, "v7_lawn_roughness.png")

# --- PALM FROND. A dense pinnate leaf on a transparent ground, rachis along u.
# Real pinnae are narrow, but at every distance this film sees a palm from they
# overlap into a solid feather; the texture is drawn that way so alpha coverage
# inside the silhouette is ~70% and the frond reads as a frond, not a comb.
FW, FH = 1024, 256
frond = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
d = ImageDraw.Draw(frond)
mid = FH / 2
for layer in range(2):
    for side in (-1, 1):
        count = 118
        for k in range(count):
            t = (k + 0.5 + RNG.uniform(-0.3, 0.3)) / count
            x0 = 14 + t * (FW - 24)
            length = (FH * 0.5) * (np.sin(min(1.0, t * 1.6) * np.pi * 0.5) * (1.0 - 0.8 * t ** 2.4)) * RNG.uniform(0.9, 1.05)
            ang = np.radians(52 + 18 * t + RNG.uniform(-6, 6))
            # each leaflet droops: a two-segment stroke
            xm = x0 + np.cos(ang) * length * 0.35
            ym = mid + side * np.sin(ang) * length * 0.55
            x1 = x0 + np.cos(ang - 0.25) * length * 0.8
            y1 = mid + side * np.sin(ang) * length * 0.98
            shade = RNG.uniform(-1, 1)
            g = int(np.clip(104 + 22 * shade + 18 * (1 - t) - 18 * layer, 40, 255))
            col = (int(np.clip(56 + 14 * shade + 20 * t, 0, 255)), g, int(np.clip(30 + 10 * t, 0, 255)), 255)
            w = max(3, int(14 * (1.0 - 0.55 * t)))
            d.line([(x0, mid + side * 2), (xm, ym)], fill=col, width=w)
            d.line([(xm, ym), (x1, y1)], fill=col, width=max(2, w - 4))
d.line([(6, mid), (FW - 6, mid)], fill=(128, 120, 72, 255), width=8)
frond.save(os.path.join(OUT, "v7_palm_frond.png"))


def leaf_cluster(name, leaf_cols, flower_cols=(), flower_share=0.0, n=420, leaf=(26, 11)):
    """A round cluster of small leaves (and optionally flowers) for canopy
    cards: dense in the middle, ragged at the edge, alpha cut."""
    S = 512
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    rng = np.random.default_rng(abs(hash(name)) % (2 ** 32))
    for i in range(n):
        rr = S * 0.46 * rng.uniform(0, 1) ** 0.62
        a = rng.uniform(0, 2 * np.pi)
        cx, cy = S / 2 + rr * np.cos(a), S / 2 + rr * np.sin(a)
        is_flower = flower_cols and rng.uniform() < flower_share
        palette = flower_cols if is_flower else leaf_cols
        base = palette[int(rng.integers(len(palette)))]
        # leaves deeper in the cluster are darker
        k = 0.72 + 0.28 * (rr / (S * 0.46)) + rng.uniform(-0.08, 0.08)
        col = tuple(int(np.clip(c * k, 0, 255)) for c in base) + (255,)
        L, W = (leaf[0] * 0.7, leaf[1] * 1.1) if is_flower else leaf
        L *= rng.uniform(0.8, 1.2)
        ang = rng.uniform(0, np.pi)
        ca, sa = np.cos(ang), np.sin(ang)
        pts = []
        for j in range(10):
            th = 2 * np.pi * j / 10
            ex, ey = L * np.cos(th), W * np.sin(th) * (1.0 if not is_flower else 1.0)
            pts.append((cx + ex * ca - ey * sa, cy + ex * sa + ey * ca))
        dr.polygon(pts, fill=col)
    img.save(os.path.join(OUT, name))


leaf_cluster("v7_canopy_rain.png", [(52, 92, 38), (64, 104, 44), (44, 80, 34), (78, 112, 50)])
leaf_cluster("v7_canopy_mango.png", [(36, 70, 30), (46, 84, 36), (30, 60, 28), (58, 92, 40)], leaf=(30, 10))
leaf_cluster("v7_bougainvillea.png", [(48, 88, 36), (58, 98, 40)], [(196, 32, 120), (214, 48, 140), (178, 24, 104)], 0.62, n=520, leaf=(18, 12))
leaf_cluster("v7_frangipani.png", [(58, 100, 42), (70, 112, 48)], [(246, 240, 226), (250, 226, 150)], 0.3, n=380, leaf=(34, 12))

print("TEXTURES", OUT, report)
