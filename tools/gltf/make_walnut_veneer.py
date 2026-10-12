r"""
The hall's walnut, generated: two sheets of veneer at the timber's true size.

    python make_walnut_veneer.py <out_dir> [--preview]

  walnut_crown.png      2048 x 2048   four crown-cut leaves, book-matched in
                                      pairs: the panels' fields
  walnut_straight.png   1024 x 2048   two quarter-cut leaves, book-matched:
                                      the framing, the model boards, the trays

Both are drawn at two-thirds of a millimetre to the pixel: a leaf is 512 px and
341 mm across, a sheet 1.365 m along the grain. They are laid at that size (or
finer, never coarser) and repeat MIRRORED, which along the grain is an end
match and across it a book match, so a sheet tiles without a seam.

WHY GENERATED, AND WHY AGAIN. The hall's panels arrived with a parquet-strip
texture on UVs that run into the thousands, so no photograph could be laid on
them as delivered. The first sheet (2026-09-21) drew six leaves of nested
parabolas with a bold dark line every fifteen centimetres, and was stretched
whole over whatever wore it: a 2.1 m wall panel, a 3.7 m arch, a 60 cm board.
The forensic audit of 2026-10-09 (#37): "One procedural grain at one scale is
used on a three-metre wall panel, a 60 cm board and a table top, so the grain
is cartoon-large on the small objects ... the same looping cathedral grain."

What a crown-cut leaf of walnut actually shows, and what is drawn here:

  * RINGS BY THE MILLIMETRE. Growth rings are two to five millimetres apart
    where the cut crosses them squarely (the leaf's flanks, which read as fine
    straight grain) and open into long flames only down the leaf's middle,
    where the cut runs nearly along them. Modelled as level sets of a long
    paraboloid, a hundred and more to the leaf, each ring a pale band closed
    by a thin dark line of its OWN strength (no two years grow alike).
  * A HEART THAT WANDERS. The flames' axis drifts a few centimetres along the
    leaf and the rings wobble across it, so no arch is a parabola.
  * FIBRE AND PORE. A fine streak along the grain in every tone, and short
    dark dashes (walnut is semi-ring-porous).
  * TONE. Chocolate to a warm mid-brown with slow lengthwise drifts and a few
    mineral streaks. No reds, no orange.

A quarter-cut leaf is the same log cut across its rings everywhere: a fine
straight stripe with slow ribbons of tone, which is what a frame's stiles and
rails are made of and what a small object can carry at its own size.
"""
import os
import sys

import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = args[0]
os.makedirs(OUT, exist_ok=True)

# Metres to the pixel, and a leaf.
MPP = 0.341 / 512
LEAF_PX = 512
H_PX = 2048
LEAF_M = LEAF_PX * MPP
H_M = H_PX * MPP


def value_noise(shape, cells, seed):
    """Smooth value noise on a (cells_y x cells_x) lattice, bicubic-upsampled."""
    r = np.random.default_rng(seed)
    g = r.random((cells[0] + 3, cells[1] + 3)).astype(np.float32)
    img = Image.fromarray(g, mode='F').resize((shape[1], shape[0]), Image.BICUBIC)
    return np.asarray(img, dtype=np.float32)


def fbm(shape, cells, octaves, seed):
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * value_noise(shape, (max(1, int(cells[0] * 2 ** o)), max(1, int(cells[1] * 2 ** o))), seed + o * 101)
        tot += amp
        amp *= 0.5
    return out / tot - 0.5


def hash01(n, seed):
    """A number in 0..1 for each integer of `n` (a ring's own year)."""
    x = np.sin(n.astype(np.float64) * 12.9898 + seed * 78.233) * 43758.5453
    return (x - np.floor(x)).astype(np.float32)


def ring_ink(rings, seed):
    """Each ring a pale band closed by a thin dark line of its own strength,
    faded where the rings run finer than the sheet can hold."""
    f = rings - np.floor(rings)
    year = np.floor(rings)
    strength = 0.3 + 0.7 * hash01(year, seed) ** 1.6
    # latewood: a slow darkening through the last third of the year, cut off
    # sharply where the next spring's growth begins
    late = np.clip((f - 0.58) / 0.42, 0.0, 1.0) ** 1.8
    gy, gx = np.gradient(rings)
    period = 1.0 / np.maximum(np.hypot(gx, gy), 1e-4)  # pixels to the ring
    hold = np.clip((period - 2.2) / 3.0, 0.0, 1.0)
    return late * strength * hold, hold


def tone(shape, seed, ink, early, straight):
    """Rings, fibre, pores and drift into colour (linear)."""
    h, w = shape
    drift = fbm(shape, (2, 3), 3, seed + 200)                 # slow, lengthwise
    ribbon = fbm(shape, (1, 14 if straight else 7), 2, seed + 240)  # bands across the grain
    fibre = fbm(shape, (9, w // 3), 2, seed + 400)            # a streak a few px wide, decimetres long
    fine = fbm(shape, (40, w // 2), 1, seed + 430)
    pores = np.clip((fbm(shape, (150, w // 2), 2, seed + 460) - 0.19) * 9.0, 0.0, 1.0)
    streak = np.clip((fbm(shape, (2, 26), 2, seed + 300) - 0.2) * 7.0, 0.0, 1.0)

    # A waxed European walnut, mid-brown: under the hall's print it stands
    # where the old lacquered slabs did (89, 56, 35 on a 1920 frame beside the
    # first table). At a third of this - the first sheet's chocolate - the
    # panelling without the lacquer's mirror was an espresso band round a room
    # the client has twice asked to be kept bright.
    dark = np.array([0.090, 0.051, 0.030], np.float32)   # latewood
    mid = np.array([0.258, 0.147, 0.084], np.float32)    # body
    pale = np.array([0.450, 0.264, 0.141], np.float32)   # earlywood
    lift = 1.0 + 0.36 * drift + (0.3 if straight else 0.2) * ribbon + 0.16 * fibre + 0.07 * fine
    base = mid[None, None, :] + (pale - mid)[None, None, :] * (0.5 * early)[..., None]
    base = base * lift[..., None]
    k = (0.52 * ink)[..., None]
    base = base * (1.0 - k) + dark[None, None, :] * k
    base = base * (1.0 - 0.3 * streak)[..., None]
    base = base * (1.0 - 0.2 * pores)[..., None]
    return base


def crown_leaf(seed, heart):
    """A crown-cut leaf: flames down the middle, straight grain at the flanks."""
    h, w = H_PX, LEAF_PX
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x = (xx / w - 0.5) * LEAF_M          # metres across, 0 on the leaf's centre line
    y = (1.0 - yy / h) * H_M             # metres up the leaf (row 0 is its top)
    wander = 0.03 * fbm((h, w), (3, 1), 2, seed + 10) * 2.0
    wobble = 0.007 * fbm((h, w), (14, 5), 3, seed + 20) * 2.0
    xr = x - heart - wander + wobble
    # A long paraboloid: 4 mm between rings at 12 cm out, flames some
    # centimetres apart down the middle, their spacing drifting with the years.
    pace = 1.0 + 0.5 * fbm((h, w), (4, 1), 2, seed + 30) * 2.0
    # (rising with the height, so each flame's apex points up the leaf, the
    # way veneer is laid; and only a little noise in the rings' own count: more
    # closes the arches into eyes)
    t = 1000.0 * xr * xr + 16.0 * y * pace + 0.9 * fbm((h, w), (8, 3), 3, seed + 40)
    ink, hold = ring_ink(t, seed)
    f = t - np.floor(t)
    early = (1.0 - np.clip((f - 0.4) / 0.6, 0.0, 1.0)) * hold + 0.5 * (1.0 - hold)
    return tone((h, w), seed, ink, early, False)


def straight_leaf(seed):
    """A quarter-cut leaf: the rings crossed squarely from edge to edge."""
    h, w = H_PX, LEAF_PX
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x = (xx / w - 0.5) * LEAF_M
    y = (1.0 - yy / h) * H_M
    lean = 0.012 * (y - H_M / 2)                                   # a degree off the leaf's edge
    wobble = 0.006 * fbm((h, w), (6, 3), 3, seed + 20) * 2.0
    pace = 1.0 + 0.4 * fbm((h, w), (1, 9), 2, seed + 30) * 2.0     # wide years and narrow
    t = (x + lean + wobble) * 300.0 * pace                         # a ring to 3.3 mm
    ink, hold = ring_ink(t, seed)
    f = t - np.floor(t)
    early = (1.0 - np.clip((f - 0.4) / 0.6, 0.0, 1.0)) * hold + 0.5 * (1.0 - hold)
    return tone((h, w), seed, ink * 0.8, early, True)


def book(leaves):
    """Leaves side by side, every second one its neighbour's mirror."""
    return np.concatenate([leaf if i % 2 == 0 else leaf[:, ::-1] for i, leaf in enumerate(leaves)], axis=1)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


# Two consecutive slices of one log to a pair: the same figure, a little moved on.
a = crown_leaf(7000, -0.012)
b = crown_leaf(7013, 0.02)
crown = book([a, a, b, b])
s = straight_leaf(7101)
straight = book([s, s])

for name, sheet in (('walnut_crown', crown), ('walnut_straight', straight)):
    img = (to_srgb(sheet) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(img).save(os.path.join(OUT, name + '.png'))
    mean = img.reshape(-1, 3).mean(axis=0)
    print(name, img.shape[1], 'x', img.shape[0], 'mean sRGB #%02x%02x%02x' % tuple(int(round(v)) for v in mean))
    if '--preview' in sys.argv:
        Image.fromarray(img).resize((img.shape[1] // 2, img.shape[0] // 2), Image.LANCZOS).save(os.path.join(OUT, name + '_preview.jpg'), quality=90)
print('leaf %.3f m, sheet %.3f m along the grain, %.3f mm to the pixel' % (LEAF_M, H_M, MPP * 1000))
