r"""
THE MAP TABLE: the two districts as a relief model, generated.

    python make_map_table.py <out_dir> [labels.png]

The fourth art-direction critique (2026-09-30) asked for the film's last
chapter to leave the abstract land it used to open onto ("a low-poly, abstract
desert with floating golden pillars ... like an entirely different project was
spliced in") and to stay in the house: "If you need to show the raw land,
transition to a highly realistic, beautifully lit topographical map on the
grand table." This builds that table's top: one square of textures covering the
whole round top, 2.2 m across, on the table's own plan (x east, z south; image
row 0 is north, so a KTX2 texture, which uploads with flipY false, lands with
v = (z + 1.1) / 2.2).

THE LAND. Vizianagaram and Srikakulam, the northern coastal districts of
Andhra Pradesh, at 1:134,000 across (115 km to the relief's 0.86 m radius) and
seven times that upright. Drawn after the region's real shape — the coast from
Bhimunipatnam to Ichchapuram, the Nagavali, Vamsadhara, Champavati, Gosthani,
Mahendratanaya and Bahuda running down to it, the Eastern Ghats rising inland
to the north-west, Mahendragiri standing alone near the northern coast, the
granite hills scattered over the plains — from coordinates written into this
file, not from a survey: a model, which the page says it is.

THE FINISH. Plaster for the land, graded from ivory on the coastal plain to a
warm stone in the hills, with a contour engraved every 100 m and every 500 m
cut deeper; the sea in dark ink lacquer with its shelf engraved in gilt; the
rivers, the coastline and the two districts' boundaries inlaid in gilt and
brass; land outside the two districts a shade quieter. A brass bezel, then the
walnut of the table's rim (the hall's own veneer, make_walnut_veneer.py).

THE LIGHT IS BAKED, AND THAT IS THE POINT. The critique: "baked, cinematic
lighting with high contrast and deep shadows". The hall's GI is a Cycles bake
and adding a real-time light to the room would recompile every one of its
programs at the door. So the table is lit by the same low sun that comes
through the clerestory (WindowLight.DIR: from the east, 37 degrees up), and its
light is computed here: a soft shadow from a small sun, ray-marched across the
relief, the bezel and the rim (key_shadow), and ambient occlusion (the R of
the ORM map). The table's shader adds that sun per pixel with the normal map
(MapTable.tsx), so the light is baked and the shading is still sharp.

Outputs (PNG, then KTX2 via ktx create):
    top_color.png     2048  sRGB  RGBA, alpha is the relief's disc
    top_normal.png    2048  linear tangent-space normal (u east, v south)
    top_orm.png       2048  linear R occlusion, G roughness, B metalness
    top_height.png    1024  linear displacement, 0..1 of HEIGHT_RANGE
    top_shadow.png    1024  linear visibility of the key light
    top_meta.png       128  R height, G district (0 sea, 1 Vizianagaram,
                             2 Srikakulam, 3 other land) - for the pins
    top_meta.json         constants the component reads
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

OUT = sys.argv[1]
LABELS = sys.argv[2] if len(sys.argv) > 2 else None
os.makedirs(OUT, exist_ok=True)

# ── the table's plan ────────────────────────────────────────────────────────
HALF = 1.1                 # the texture square, metres: the whole round top
R_RELIEF = 0.86            # the relief's radius
R_BEZEL0, R_BEZEL1 = 0.862, 0.895
R_TOP = 1.1
SEA_DROP = 0.004           # the lacquer sea, below the walnut rim
BEZEL_RISE = 0.006
HEIGHT_RANGE = 0.1         # the displacement's 0..1, metres above sea level
KM_PER_M = 115.0 / R_RELIEF
EXAGGERATION = 5.5
M_PER_REAL_M = EXAGGERATION / (KM_PER_M * 1000.0)   # table metres per metre of land

N = 2048
N_LIGHT = 1024
PX = 2 * HALF / N

# The geographic centre of the table, and the local scale.
LON0, LAT0 = 83.72, 18.58
KM_LON, KM_LAT = 105.6, 110.6


def to_table(lon, lat):
    """lon/lat -> table metres (x east, z south)."""
    x = (np.asarray(lon) - LON0) * KM_LON / KM_PER_M
    z = -(np.asarray(lat) - LAT0) * KM_LAT / KM_PER_M
    return x, z


def to_px(lon, lat, n=N):
    x, z = to_table(lon, lat)
    return (x + HALF) / (2 * HALF) * n, (z + HALF) / (2 * HALF) * n


# ── the geography, from coordinates ─────────────────────────────────────────
COAST = [
    (82.60, 17.10), (82.95, 17.38), (83.20, 17.62), (83.30, 17.69), (83.36, 17.76),
    (83.45, 17.89), (83.55, 17.98), (83.63, 18.05), (83.72, 18.10), (83.82, 18.16),
    (83.92, 18.21), (83.98, 18.26), (84.05, 18.29), (84.12, 18.33), (84.20, 18.42),
    (84.30, 18.55), (84.38, 18.66), (84.45, 18.73), (84.58, 18.88), (84.67, 18.98),
    (84.77, 19.08), (84.88, 19.20), (85.05, 19.33), (85.30, 19.52), (85.70, 19.80),
]
RIVERS = {
    'nagavali': ([(82.95, 19.45), (83.12, 19.20), (83.25, 19.02), (83.35, 18.88), (83.47, 18.76),
                  (83.58, 18.62), (83.68, 18.50), (83.78, 18.40), (83.87, 18.32), (83.93, 18.29),
                  (83.98, 18.26)], 1.0),
    'vamsadhara': ([(83.65, 19.65), (83.78, 19.40), (83.88, 19.15), (83.95, 18.95), (84.00, 18.78),
                    (84.03, 18.62), (84.06, 18.48), (84.09, 18.38), (84.12, 18.33)], 1.0),
    'suvarnamukhi': ([(83.15, 18.60), (83.30, 18.58), (83.45, 18.60), (83.58, 18.62)], 0.6),
    'vegavathi': ([(83.20, 18.45), (83.40, 18.52), (83.55, 18.58), (83.63, 18.56)], 0.55),
    'champavati': ([(83.15, 18.28), (83.30, 18.22), (83.45, 18.14), (83.55, 18.09), (83.63, 18.05)], 0.7),
    'gosthani': ([(82.95, 18.15), (83.10, 18.05), (83.25, 17.98), (83.38, 17.92), (83.45, 17.89)], 0.7),
    'mahendratanaya': ([(84.30, 19.02), (84.40, 18.97), (84.50, 18.92), (84.58, 18.88)], 0.55),
    'bahuda': ([(84.50, 19.20), (84.60, 19.14), (84.70, 19.10), (84.77, 19.08)], 0.5),
}
# The two districts together: the Odisha border to the north and north-west,
# Visakhapatnam's to the south-west, and the coast between.
OUTER = [
    (83.43, 17.87), (83.30, 17.98), (83.18, 18.08), (83.05, 18.22), (82.95, 18.42),
    (82.92, 18.62), (83.00, 18.85), (83.05, 19.05), (83.18, 19.18), (83.35, 19.22),
    (83.55, 19.15), (83.72, 19.12), (83.90, 19.10), (84.10, 19.12), (84.30, 19.15),
    (84.50, 19.18), (84.70, 19.12), (84.79, 19.10),
]
# Vizianagaram to the west, Srikakulam to the east.
INNER = [(83.76, 18.10), (83.70, 18.30), (83.62, 18.48), (83.52, 18.62), (83.45, 18.80),
         (83.38, 19.00), (83.35, 19.22)]
MAHENDRAGIRI = (84.37, 18.97)
AGENCY = (83.45, 18.95)

# ── the grid ────────────────────────────────────────────────────────────────
xs = -HALF + (np.arange(N) + 0.5) * PX
X, Z = np.meshgrid(xs, xs)              # X east, Z south; row 0 north
R = np.hypot(X, Z)
LON = LON0 + X * KM_PER_M / KM_LON
LAT = LAT0 - Z * KM_PER_M / KM_LAT
rng = np.random.default_rng(1998)


def poly_mask(points, n=N, close_via=None):
    img = Image.new('L', (n, n), 0)
    pts = [tuple(map(float, to_px(lo, la, n))) for lo, la in points]
    if close_via:
        pts += [tuple(map(float, to_px(lo, la, n))) for lo, la in close_via]
    ImageDraw.Draw(img).polygon(pts, fill=255)
    return np.asarray(img) > 127


def meander(points, amp_km=2.2, seed=0):
    """A river's course, densified and set wandering across its line."""
    r = np.random.default_rng(seed)
    out = []
    for (a0, b0), (a1, b1) in zip(points[:-1], points[1:]):
        for t in np.linspace(0, 1, 12, endpoint=False):
            out.append((a0 + (a1 - a0) * t, b0 + (b1 - b0) * t))
    out.append(points[-1])
    out = np.array(out)
    d = np.gradient(out, axis=0)
    nrm = np.stack([-d[:, 1], d[:, 0]], -1)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    k = np.arange(len(out))
    # A smoothed random walk, not a sine: meanders of every length, as a river
    # has, and none of them regular.
    wob = nd.gaussian_filter1d(r.normal(0, 1, len(out)), 2.2)
    wob += 0.5 * nd.gaussian_filter1d(r.normal(0, 1, len(out)), 5.0)
    wob /= np.abs(wob).max() + 1e-9
    wob *= np.minimum(1.0, np.minimum(k, len(out) - 1 - k) / 6.0)
    off = wob[:, None] * nrm * (amp_km / 105.0)
    return [tuple(p) for p in (out + off)]


def line_mask(points, width_px, n=N):
    img = Image.new('L', (n, n), 0)
    pts = [tuple(map(float, to_px(lo, la, n))) for lo, la in points]
    ImageDraw.Draw(img).line(pts, fill=255, width=max(1, int(round(width_px))), joint='curve')
    return np.asarray(img) > 127


def distance_km(mask):
    """Distance from every pixel to the nearest True pixel, in km."""
    return nd.distance_transform_edt(~mask) * PX * KM_PER_M


# Land: the coast polyline closed round the north-west.
land = poly_mask(COAST, close_via=[(86.5, 21.0), (81.0, 21.0), (81.0, 16.5), (82.6, 16.5)])
# The coast with a little life in it: a wandering offset along the shore.
coast_line = line_mask(COAST, 1)
d_land = distance_km(~land)             # inland distance, km (0 at sea)
d_sea = distance_km(land)               # offshore distance, km


def value_noise(x, y, seed):
    """Smooth value noise on a unit lattice, vectorised."""
    # Periodic over 256 in both axes: the octaves of a deep fbm run far past
    # the lattice, and a table that does not wrap leaves a straight seam in
    # the land at every multiple of 256 (the first pass had them, as cliffs).
    r = np.random.default_rng(seed)
    table = r.random((256, 256)).astype(np.float32)
    xi = np.floor(x).astype(np.int64)
    yi = np.floor(y).astype(np.int64)
    xf = (x - xi).astype(np.float32)
    yf = (y - yi).astype(np.float32)
    u = xf * xf * (3 - 2 * xf)
    v = yf * yf * (3 - 2 * yf)
    x0, x1 = xi & 255, (xi + 1) & 255
    y0, y1 = yi & 255, (yi + 1) & 255
    a = table[y0, x0]
    b = table[y0, x1]
    c = table[y1, x0]
    d = table[y1, x1]
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v


def fbm(x, y, octaves, seed, lac=2.03, gain=0.5):
    s = np.zeros_like(x, dtype=np.float32)
    amp, norm = 1.0, 0.0
    for i in range(octaves):
        s += amp * value_noise(x, y, seed + i * 17)
        norm += amp
        x = x * lac + 3.1
        y = y * lac + 1.7
        amp *= gain
    return s / norm


def eroded(x, y, octaves, seed):
    """Derivative-damped fbm (after Inigo Quilez): each octave is quietened
    where the octaves above it are steep, so ridges stay sharp and the valleys
    between them open out smooth, the way water leaves a range."""
    s = np.zeros_like(x, dtype=np.float32)
    dx = np.zeros_like(x, dtype=np.float32)
    dy = np.zeros_like(x, dtype=np.float32)
    amp, freq = 1.0, 1.0
    c, sn = np.cos(0.64), np.sin(0.64)
    for i in range(octaves):
        n = value_noise(x, y, seed + i * 13) * 2.0 - 1.0
        gy, gx = np.gradient(n)
        step_x = np.gradient(x, axis=1)
        step_y = np.gradient(y, axis=0)
        gx = gx / np.where(np.abs(step_x) > 1e-9, step_x, 1e-9)
        gy = gy / np.where(np.abs(step_y) > 1e-9, step_y, 1e-9)
        dx += gx / freq
        dy += gy / freq
        s += amp * n / (1.0 + dx * dx + dy * dy)
        amp *= 0.5
        freq *= 2.0
        x, y = (c * x - sn * y) * 2.0 + 1.3, (sn * x + c * y) * 2.0 + 4.7
    return s


def ridged(x, y, octaves, seed):
    s = np.zeros_like(x, dtype=np.float32)
    amp, norm = 1.0, 0.0
    for i in range(octaves):
        n = 1.0 - np.abs(2.0 * value_noise(x, y, seed + i * 31) - 1.0)
        s += amp * n * n
        norm += amp
        x = x * 2.07 + 5.3
        y = y * 2.07 + 2.9
        amp *= 0.52
    return s / norm


# Noise coordinates in km, and a frame turned to the coast's bearing (the
# ghats' ridges run with the coast, north-east / south-west).
KX = X * KM_PER_M
KY = -Z * KM_PER_M
ang = np.radians(47.0)
AX = KX * np.cos(ang) + KY * np.sin(ang)     # along the coast
AY = -KX * np.sin(ang) + KY * np.cos(ang)    # across it

# ── the land's height, metres ───────────────────────────────────────────────
low = fbm(KX / 55.0, KY / 55.0, 3, 11)
mid = fbm(KX / 14.0, KY / 14.0, 4, 23)
plain = 3.0 + 55.0 * (1 - np.exp(-d_land / 16.0)) + 90.0 * np.clip((d_land - 18) / 50, 0, 1) * (0.45 + 0.55 * low)
plain += 25.0 * (mid - 0.5) * np.clip(d_land / 20.0, 0, 1)

# The ghats: rising inland, strongest to the north-west, their ranges running
# with the coast and their valleys draining it.
warp = fbm(KX / 40.0, KY / 40.0, 3, 5) - 0.5
ghat_band = np.clip((d_land - 48.0) / 55.0, 0, 1) ** 1.2
mount = eroded((AX + 18 * warp) / 26.0, (AY - 12 * warp) / 16.0, 7, 41)
mount = np.clip(mount * 0.9 + 0.45, 0, 1.4)
ghats = ghat_band * (260.0 + 1050.0 * mount) * (0.8 + 0.4 * low)

# The agency hills behind Parvathipuram and Seethampeta.
ax_, az_ = to_table(*AGENCY)
r_ag = np.hypot(X - ax_, Z - az_) * KM_PER_M
agency = 520.0 * np.exp(-(r_ag / 24.0) ** 2) * np.clip(0.4 + 0.9 * eroded(AX / 11.0, AY / 8.0, 6, 57), 0, 1.5)

# Mahendragiri, alone near the northern coast.
mx_, mz_ = to_table(*MAHENDRAGIRI)
r_m = np.hypot(X - mx_, Z - mz_) * KM_PER_M
mahendra = 1180.0 * np.exp(-(r_m / 7.5) ** 1.35) * np.clip(0.75 + 0.45 * eroded(KX / 5.0, KY / 5.0, 6, 77), 0.3, 1.3)
mahendra += 300.0 * np.exp(-(r_m / 17.0) ** 2) * np.clip(0.5 + eroded(AX / 7.0, AY / 5.0, 5, 79), 0, 1.4)

# The granite hills of the plains: isolated, irregular, some in short chains,
# each an elongated knot of ridges rather than a dome.
insel = np.zeros_like(X, dtype=np.float32)
knots = eroded(KX / 2.2, KY / 2.2, 5, 97)
for i in range(30):
    lo = rng.uniform(83.0, 84.6)
    la = rng.uniform(17.98, 19.1)
    ix, iz = to_table(lo, la)
    px, pz = int((ix + HALF) / PX), int((iz + HALF) / PX)
    if not (0 <= px < N and 0 <= pz < N) or not land[pz, px] or d_land[pz, px] < 8:
        continue
    for j in range(int(rng.integers(1, 4))):
        h = rng.uniform(90, 420)
        ra = rng.uniform(1.4, 3.6)
        rb = ra * rng.uniform(0.35, 0.7)
        th = rng.uniform(0, np.pi)
        ox, oz = ix + rng.normal(0, 0.012), iz + rng.normal(0, 0.012)
        ux = (X - ox) * KM_PER_M
        uz = (Z - oz) * KM_PER_M
        a = (ux * np.cos(th) + uz * np.sin(th)) / ra
        b = (-ux * np.sin(th) + uz * np.cos(th)) / rb
        insel = np.maximum(insel, h * np.exp(-(a * a + b * b) ** 0.8))
insel *= np.clip(0.55 + 0.8 * knots, 0.2, 1.3)

elev = plain + ghats + agency + mahendra + insel

# The rivers carve their valleys, wider inland; the channel itself is inlaid.
river_mask = np.zeros_like(land)
river_lines = []
for ri, (name, (pts, order)) in enumerate(RIVERS.items()):
    pts = meander(pts, 1.2 + 1.0 * order, seed=ri)
    m = line_mask(pts, 1)
    d = distance_km(m)
    w = 1.6 + 0.045 * d_land + 1.2 * order
    valley = np.exp(-(d / w) ** 2)
    elev = elev - (elev - 0.3 * elev - 2.0) * 0.72 * valley
    wpx = 2.6 * order + 0.6
    river_lines.append(line_mask(pts, wpx))
for m in river_lines:
    river_mask |= m

elev = np.where(land, np.maximum(elev, 1.5), -np.minimum(80.0, 1.8 * d_sea + 0.04 * d_sea ** 2))

# Toward the bezel the relief settles to sea level, as a model's land meets
# its frame.
edge = np.clip((R_RELIEF - 0.008 - R) / 0.13, 0, 1)
edge = edge * edge * (3 - 2 * edge)
land_h = np.where(land, elev, 0.0) * edge

# ── heights on the table, metres above the walnut rim ───────────────────────
relief = np.where(land & (R < R_RELIEF), 0.0012 + land_h * M_PER_REAL_M, 0.0) - SEA_DROP
# The bezel and the rim, for the light's shadows.
bez_t = np.clip((R - R_BEZEL0) / (R_BEZEL1 - R_BEZEL0), 0, 1)
bezel = BEZEL_RISE * np.sin(np.pi * bez_t) ** 0.7
top = np.where(R < R_BEZEL0, relief, np.where(R < R_BEZEL1, bezel, 0.0))
top = np.where(R > R_TOP, -0.06, top)

# ── districts ───────────────────────────────────────────────────────────────
outer = poly_mask(OUTER + COAST[::-1][4:20])
# Two halves: west of the inner line is Vizianagaram. Build by closing the
# inner line round the west through the outer border.
west_poly = INNER + [(83.35, 19.22), (83.18, 19.18), (83.05, 19.05), (83.00, 18.85), (82.92, 18.62),
                     (82.95, 18.42), (83.05, 18.22), (83.18, 18.08), (83.30, 17.98), (83.43, 17.87),
                     (83.55, 17.97), (83.63, 18.04), (83.72, 18.09)]
west = poly_mask(west_poly)
viz = outer & west & land
sri = outer & ~west & land
district = np.where(~land, 0, np.where(viz, 1, np.where(sri, 2, 3))).astype(np.uint8)

# ── colour ──────────────────────────────────────────────────────────────────
def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float32) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


IVORY = srgb_to_lin((224, 215, 197))
STONE = srgb_to_lin((206, 188, 158))
HILL = srgb_to_lin((186, 164, 130))
LACQUER = srgb_to_lin((22, 30, 42))
SHALLOW = srgb_to_lin((34, 48, 64))
GILT = srgb_to_lin((205, 164, 98))
BRASS = srgb_to_lin((190, 150, 88))

e = np.clip(land_h / 1100.0, 0, 1)[..., None]
col = IVORY * (1 - np.clip(e * 2.2, 0, 1)) + STONE * np.clip(e * 2.2, 0, 1)
col = col * (1 - np.clip((e - 0.45) * 2.0, 0, 1)) + HILL * np.clip((e - 0.45) * 2.0, 0, 1)
grain = fbm(X / 0.004, Z / 0.004, 3, 91)[..., None]
col *= 0.975 + 0.05 * grain
# Outside the two districts, a shade quieter.
quiet = (district == 3)[..., None]
lum = (col * np.array([0.2126, 0.7152, 0.0722])).sum(-1, keepdims=True)
col = np.where(quiet, (0.7 * col + 0.3 * lum) * 0.84, col)

# Contours: every 100 m, every 500 m cut deeper.
def contour_lines(h, step, width_px):
    q = h / step
    f = np.abs(q - np.round(q))
    g = np.hypot(*np.gradient(q)) + 1e-6
    return np.clip(1.0 - f / (g * width_px), 0, 1)

c100 = contour_lines(land_h, 100.0, 0.9) * (land_h > 20)
c500 = contour_lines(land_h, 500.0, 1.5) * (land_h > 20)
engr = np.maximum(c100 * 0.2, c500 * 0.32) * land
col *= (1 - engr[..., None])

# The sea: lacquer, lighter over the shelf, the shelf engraved in gilt.
sea_t = np.clip(d_sea / 30.0, 0, 1)[..., None]
sea_col = SHALLOW * (1 - sea_t) + LACQUER * sea_t
shelf = contour_lines(-np.minimum(elev, 0), 12.0, 0.8) * (~land) * (d_sea < 40) * (d_sea > 0.8)
sea_col = sea_col * (1 - shelf[..., None] * 0.25) + GILT * (shelf[..., None] * 0.22)
col = np.where(land[..., None], col, sea_col)

# Inlays: rivers and coast in gilt; the district lines in brass.
coast_inlay = line_mask(COAST, 2.2)
inner_line = line_mask(INNER, 2.0)
outer_line = line_mask(OUTER, 1.8)
# The inner boundary dashed, as a map draws an administrative line.
yy, xx = np.mgrid[0:N, 0:N]
dash = ((xx + yy) // 14) % 2 == 0
inner_line &= dash
metal = river_mask | coast_inlay | inner_line | outer_line
metal &= R < R_RELIEF
col = np.where((river_mask | coast_inlay)[..., None] & (R < R_RELIEF)[..., None], GILT, col)
col = np.where((inner_line | outer_line)[..., None] & (R < R_RELIEF)[..., None], BRASS, col)

# Engraved lettering, rendered with the site's own face (make_map_labels.mjs).
if LABELS and os.path.exists(LABELS):
    lab = np.asarray(Image.open(LABELS).convert('RGBA').resize((N, N), Image.LANCZOS)).astype(np.float32) / 255.0
    a = lab[..., 3:4]
    engrave = land[..., None] & (a > 0)
    col = np.where(engrave, col * (1 - 0.45 * a), col)
    on_sea = (~land)[..., None]
    col = col * (1 - a * on_sea) + GILT * (a * on_sea * 0.9) + col * (a * on_sea * 0.1)
    label_groove = lab[..., 3]
else:
    label_groove = np.zeros((N, N), np.float32)

# The bezel and the walnut rim.
walnut_path = os.path.join(OUT, '_walnut', 'walnut_basecolor.png')
if os.path.exists(walnut_path):
    wal = np.asarray(Image.open(walnut_path).convert('RGB').resize((N, N), Image.LANCZOS))
    # The veneer as the hall's panelling reads under its lacquer: a deep,
    # chocolate walnut — the sheet's own tone taken down and warmed.
    walnut = srgb_to_lin(wal) * np.array([0.5, 0.44, 0.4])
else:
    walnut = np.broadcast_to(srgb_to_lin((94, 70, 50)), (N, N, 3))
col = np.where((R >= R_BEZEL0)[..., None], BRASS, col)
col = np.where((R >= R_BEZEL1)[..., None], walnut, col)

alpha = (R < R_RELIEF + 0.004).astype(np.float32)
rgba = np.concatenate([lin_to_srgb(col), alpha[..., None]], -1)
Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'top_color.png'))

# ── normal ──────────────────────────────────────────────────────────────────
h_n = top.copy()
h_n -= 0.00022 * engr / 0.32              # engraved contours
h_n -= 0.00025 * label_groove             # engraved lettering
h_n -= 0.00012 * shelf * (R < R_RELIEF)   # the shelf, engraved in the lacquer
h_n += 0.00004 * (fbm(X / 0.0025, Z / 0.0025, 3, 131) - 0.5) * land   # plaster
gz, gx = np.gradient(h_n, PX)             # d/dz (rows), d/dx (cols)
nx, ny, nz = -gx, np.ones_like(gx), -gz
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
nrm = np.stack([nx / ln, nz / ln, ny / ln], -1)   # tangent space: u east, v south
Image.fromarray(((nrm * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(OUT, 'top_normal.png'))

# ── roughness and metalness ─────────────────────────────────────────────────
rough = np.where(land, 0.84 + 0.06 * (grain[..., 0] - 0.5), 0.3)
rough = np.where(metal, 0.3, rough)
rough = np.where(R >= R_BEZEL0, 0.28, rough)
rough = np.where(R >= R_BEZEL1, 0.34, rough)
metalness = np.where(metal | ((R >= R_BEZEL0) & (R < R_BEZEL1)), 1.0, 0.0)

# ── the light ───────────────────────────────────────────────────────────────
# Worked at 1024: a soft sun and the occlusion, both ray-marched over the
# top's own heights (relief, bezel, rim).
def down(a, n):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((n, n), Image.BILINEAR))

hL = down(top, N_LIGHT)
pxL = 2 * HALF / N_LIGHT
sun = np.array([0.66, 0.52, 0.2])
sun = sun / np.linalg.norm(sun)
az0 = np.arctan2(sun[2], sun[0])          # in the x-z plane (z south)
el0 = np.arcsin(sun[1])
vis = np.zeros_like(hL)
samples = [(da, de) for da in (-0.022, 0.0, 0.022) for de in (-0.014, 0.0, 0.014)]
rows, cols = np.mgrid[0:N_LIGHT, 0:N_LIGHT].astype(np.float32)
for da, de in samples:
    az, el = az0 + da, el0 + de
    dx, dz = np.cos(az), np.sin(az)
    slope = np.tan(el)
    lit = np.ones_like(hL)
    for k in range(1, 80):
        step = k * 1.5
        cx = cols + dx * step
        cz = rows + dz * step
        hs = nd.map_coordinates(hL, [cz, cx], order=1, mode='nearest')
        rise = hL + step * pxL * slope
        lit *= np.clip(1.0 - (hs - rise) / 0.0009, 0, 1)
    vis += lit
vis /= len(samples)

# Occlusion: the horizon in twelve directions out to 6 cm.
ao = np.zeros_like(hL)
for i in range(12):
    a = 2 * np.pi * i / 12
    dx, dz = np.cos(a), np.sin(a)
    horizon = np.zeros_like(hL)
    for k in (1, 2, 3, 5, 7, 10, 14, 19, 26):
        cx = cols + dx * k
        cz = rows + dz * k
        hs = nd.map_coordinates(hL, [cz, cx], order=1, mode='nearest')
        horizon = np.maximum(horizon, (hs - hL) / (k * pxL))
    ao += 1.0 - np.sin(np.arctan(np.maximum(horizon, 0)))
ao /= 12
ao = np.clip(ao, 0, 1) ** 1.4

ao_big = np.asarray(Image.fromarray(ao.astype(np.float32), 'F').resize((N, N), Image.BILINEAR))
orm = np.stack([ao_big, rough, metalness], -1)
Image.fromarray((np.clip(orm, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(OUT, 'top_orm.png'))
Image.fromarray((np.clip(vis, 0, 1) * 255 + 0.5).astype(np.uint8), 'L').save(os.path.join(OUT, 'top_shadow.png'))

# ── displacement, for the relief's mesh ─────────────────────────────────────
disp = np.clip((relief + SEA_DROP) / HEIGHT_RANGE, 0, 1)
Image.fromarray((down(disp, 1024) * 255 + 0.5).astype(np.uint8), 'L').save(os.path.join(OUT, 'top_height.png'))

# ── the pins' map ───────────────────────────────────────────────────────────
meta_h = down(disp, 128)
meta_d = np.asarray(Image.fromarray(district, 'L').resize((128, 128), Image.NEAREST))
meta = np.stack([(meta_h * 255 + 0.5).astype(np.uint8), meta_d, np.zeros_like(meta_d)], -1)
Image.fromarray(meta, 'RGB').save(os.path.join(OUT, 'top_meta.png'))

# Where the names go (for make_map_labels.mjs), in texture pixels.
json.dump({
    'half': HALF, 'reliefRadius': R_RELIEF, 'bezel': [R_BEZEL0, R_BEZEL1], 'top': R_TOP,
    'seaDrop': SEA_DROP, 'heightRange': HEIGHT_RANGE, 'bezelRise': BEZEL_RISE,
    'sun': sun.tolist(), 'kmPerMetre': KM_PER_M, 'exaggeration': EXAGGERATION,
    # Set where an engraver would put them: each district's name on its own
    # plain, clear of the hills, and the sea's along the shelf.
    'labels': {
        'VIZIANAGARAM': [float(v) for v in to_px(83.36, 18.38)],
        'SRIKAKULAM': [float(v) for v in to_px(84.06, 18.60)],
        'BAY OF BENGAL': [float(v) for v in to_px(84.42, 18.02)],
    },
    'size': N,
}, open(os.path.join(OUT, 'top_meta.json'), 'w'), indent=1)
print('ok', 'land max m', float(land_h.max()), 'relief max m', float(relief.max()),
      'districts px', int(viz.sum()), int(sri.sum()))
