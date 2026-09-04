"""
Author the P5D/P5E foliage sets: clipped box hedge, and cypress.

    python tools/gltf/make_foliage_p5.py [--hedge R G B] [--cypress R G B]

THE DEFECT. Both materials are a single baseColorFactor and NOTHING else -
MAT_Hedge (0.026, 0.052, 0.018) and MAT_Cypress (0.019, 0.038, 0.015), with no
map of any kind. Together they hold 3.8% of the HERO frame, 5.5% at WEST and
5.8% at NW, and they render as near-black paper cutouts: the emissive-id mask
measured the hedge at L 52.3 with sd 20.3 (all of which is the cast shadow, not
surface) and the cypress at L 44.2 with sd 15.8. They are the second-largest
soft-landscape mass after the ground and the only large surfaces in the scene
with no material at all.

WHAT SCALE THE TEXTURE HAS TO WORK AT, and it is not leaves. At HERO the hedge
stands ~13 m away, which is 0.010 m per pixel, and it is 0.96 m tall - about
100 px. A box leaf is 40 mm, so a leaf is 0.4 px. Authoring leaf detail would
put all the energy below the Nyquist limit of every camera in the sequence and
buy sparkle. What DOES resolve is the CLUMP structure a clipped hedge has at
150-300 mm (1.5-3 px) and the shear plane the shears leave. The cypresses are
40 m out and 5.4 m tall - about 110 px - so the same argument applies harder:
their 200-400 mm foliage sprays are sub-pixel, and what reads is the vertical
grain and the silhouette.

So both sets are authored at a 1.5 m tile (1.46 mm/texel) carrying clump-scale
structure and a light grain, with the leaf scale deliberately absent.

  HEDGE   MACRO  the shear plane: a clipped hedge is BRIGHTER along the top and
                 the cut faces because the shears expose pale new growth and
                 leave a dense flat surface, and DARKER in the hollows between
                 clumps where light does not reach. 250 mm clumps.
          MESO   a faint horizontal banding from successive cuts, 120 mm.
          MICRO  a 20 mm grain, low weight - see above.
          ROUGH  0.86. Foliage is matte and the wax on a box leaf is not enough
                 to change that at 13 m.
          NORMAL gentle, from the clump height only.

  CYPRESS MACRO  vertical sprays, 400 mm, elongated 3:1 along the tile's v axis
                 because a cypress's structure runs up the tree.
          MESO   190 mm clumps within the sprays.
          MICRO  30 mm grain.
          ROUGH  0.90, slightly rougher than the hedge - needle foliage
                 scatters more broadly than a clipped leaf plane.
          NORMAL stronger than the hedge's: the sprays are the silhouette.

CONTRAST IS SOLVED, NOT DIALLED, by the same bisection make_ground_p5a.py uses,
because the same arithmetic bites harder here: at a linear mean of 0.05,
d(sRGB)/d(linear) is 2.2, so the +/-8% wobble that reads as "some variation" in
a spreadsheet is +/-2 counts of 255 on screen.

DISTANCE COHERENCE. Both sets are normalised to their authored linear mean, so
the mip tail is the intended colour and a hedge does not change hue as the
camera pulls back along the revolution.

The colour targets are NOT the current factors. Those render at L 52.3 and 44.2
against a lawn that now sits at 70.5, i.e. the planting is 25-37% darker than
the grass it stands in - which is roughly right for box against turf and much
too dark once it has no surface. The targets below hold that relationship while
giving the surface something to be.
"""
import numpy as np, os, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'materials', '_foliage')
os.makedirs(OUT, exist_ok=True)
RES, TILE_M = 1024, 1.5
px_m = TILE_M / RES

HEDGE = [0.0300, 0.0530, 0.0205]
CYPRESS = [0.0225, 0.0405, 0.0180]
HEDGE_SD, CYPRESS_SD = 15.0, 17.0
for flag, tgt in (('--hedge', HEDGE), ('--cypress', CYPRESS)):
    if flag in sys.argv:
        i = sys.argv.index(flag); tgt[:] = [float(x) for x in sys.argv[i + 1:i + 4]]


def wrapped_noise(res, freq, rg, ay=1):
    """ay > 1 stretches the lattice along v, for structure that runs upward."""
    fy = max(1, int(round(freq / ay)))
    g = rg.random((fy, freq)).astype(np.float32)
    g = np.vstack([g, g[:1]]); g = np.hstack([g, g[:, :1]])
    tx = np.linspace(0, freq, res, endpoint=False)
    ty = np.linspace(0, fy, res, endpoint=False)
    ix, fx = np.floor(tx).astype(int), None
    iy = np.floor(ty).astype(int)
    fx = (tx - ix).astype(np.float32); fyv = (ty - iy).astype(np.float32)
    sx = (fx * fx * (3 - 2 * fx))[None, :]; sy = (fyv * fyv * (3 - 2 * fyv))[:, None]
    a = g[iy[:, None], ix[None, :]]; b = g[iy[:, None], ix[None, :] + 1]
    c = g[iy[:, None] + 1, ix[None, :]]; d = g[iy[:, None] + 1, ix[None, :] + 1]
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def fbm(res, f0, oct_, rg, gain=0.5, ay=1):
    out = np.zeros((res, res), np.float32); amp = 1.0; tot = 0.0; f = f0
    for _ in range(oct_):
        out += amp * wrapped_noise(res, f, rg, ay); tot += amp; amp *= gain; f *= 2
    return out / tot


def height_to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nx, ny, nz = -dx, dy, np.full_like(h, 1.0 / 48.0)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / ln * .5 + .5, ny / ln * .5 + .5, nz / ln * .5 + .5], -1)


def to_srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def save_rgb(n, a):
    Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8), 'RGB').save(os.path.join(OUT, n), optimize=True)


def save_l(n, a):
    Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8), 'L').save(os.path.join(OUT, n), optimize=True)


def norm_to(lin, t):
    o = np.empty(lin.shape, np.float32)
    for c in range(3):
        o[..., c] = np.clip(lin[..., c] * (t[c] / max(float(lin[..., c].mean()), 1e-6)), 0, 1)
    return o


def solve(build, target_sd, lo=0.02, hi=6.0, it=30):
    sd = lambda g: float((to_srgb(build(g))[..., 1] * 255).std())
    for _ in range(it):
        m = .5 * (lo + hi)
        if sd(m) < target_sd: lo = m
        else: hi = m
    g = .5 * (lo + hi); return g, sd(g)


def report(tag, lin, r, n, g):
    m = lin.reshape(-1, 3).mean(0); s8 = to_srgb(lin).reshape(-1, 3)
    print('%-8s linear (%.4f, %.4f, %.4f) R/G %.3f  gain %.3f' % (tag, m[0], m[1], m[2], m[0] / m[1], g))
    print('         srgb8 mean %s  sd %s   rough %.2f..%.2f   normal z %.3f'
          % (np.round(s8.mean(0) * 255, 1), np.round(s8.std(0) * 255, 1), r.min(), r.max(), n[..., 2].mean()))
    return m


# =============================================================== HEDGE ========
rg = np.random.default_rng(5201)
clump = fbm(RES, 6, 4, rg) - 0.5            # 250 mm
cut = np.sin(np.linspace(0, 12 * 2 * np.pi, RES, endpoint=False))[:, None] * np.ones((1, RES), np.float32)
cut = (np.tanh(cut * 1.4) * (0.6 + 0.8 * (fbm(RES, 3, 2, rg)))).astype(np.float32)   # 120 mm cut bands
grain = wrapped_noise(RES, 75, rg) - 0.5    # 20 mm
# The shear plane: exposed new growth on the cut faces reads PALER and yellower.
shear = np.clip((clump + 0.22 * cut) * 2.2, -1, 1)
VAR_H = (1.00 * clump + 0.30 * cut + 0.28 * grain).astype(np.float32)


def build_h(g):
    l = np.clip(1.0 + g * VAR_H, 0.05, 3.0)
    y = 0.5 + 0.5 * shear                              # 1 where freshly cut
    base = np.stack([HEDGE[0] * l * (0.82 + 0.42 * y),
                     HEDGE[1] * l * (0.96 + 0.10 * y),
                     HEDGE[2] * l * (1.10 - 0.22 * y)], -1).astype(np.float32)
    return norm_to(base, HEDGE)


gh, sdh = solve(build_h, HEDGE_SD)
h_lin = build_h(gh)
hh = (0.70 * clump + 0.25 * cut + 0.10 * grain).astype(np.float32)
h_nrm = height_to_normal(hh, 1.05)
h_rgh = np.clip(0.86 - 0.05 * clump + 0.04 * grain, 0.74, 0.95).astype(np.float32)
save_rgb('p5_hedge_basecolor.png', to_srgb(h_lin))
save_l('p5_hedge_roughness.png', h_rgh)
save_rgb('p5_hedge_normal.png', h_nrm)
m_h = report('HEDGE', h_lin, h_rgh, h_nrm, gh)

# ============================================================= CYPRESS ========
rg = np.random.default_rng(5202)
spray = fbm(RES, 4, 3, rg, ay=3.0) - 0.5     # 400 mm, 3:1 vertical
sub = fbm(RES, 8, 3, rg, ay=2.2) - 0.5       # 190 mm
cg = wrapped_noise(RES, 50, rg) - 0.5        # 30 mm
VAR_C = (1.00 * spray + 0.62 * sub + 0.26 * cg).astype(np.float32)


def build_c(g):
    l = np.clip(1.0 + g * VAR_C, 0.05, 3.0)
    y = 0.5 + 0.5 * np.tanh(spray * 2.6)
    base = np.stack([CYPRESS[0] * l * (0.86 + 0.30 * y),
                     CYPRESS[1] * l * (0.98 + 0.06 * y),
                     CYPRESS[2] * l * (1.14 - 0.26 * y)], -1).astype(np.float32)
    return norm_to(base, CYPRESS)


gc, sdc = solve(build_c, CYPRESS_SD)
c_lin = build_c(gc)
ch = (0.85 * spray + 0.35 * sub + 0.08 * cg).astype(np.float32)
c_nrm = height_to_normal(ch, 1.6)
c_rgh = np.clip(0.90 - 0.04 * spray + 0.03 * cg, 0.80, 0.97).astype(np.float32)
save_rgb('p5_cypress_basecolor.png', to_srgb(c_lin))
save_l('p5_cypress_roughness.png', c_rgh)
save_rgb('p5_cypress_normal.png', c_nrm)
m_c = report('CYPRESS', c_lin, c_rgh, c_nrm, gc)

for tag, m, t in (('hedge', m_h, HEDGE), ('cypress', m_c, CYPRESS)):
    e = float(np.max(np.abs(m - np.array(t))))
    assert e < 0.002, '%s linear mean missed target by %.4f' % (tag, e)
for tag, got, want in (('hedge', sdh, HEDGE_SD), ('cypress', sdc, CYPRESS_SD)):
    assert abs(got - want) < 0.15, '%s sd solved to %.2f, wanted %.2f' % (tag, got, want)
print('\nOK  tile %.1f m at %d px -> %.2f mm/texel  (clump scale 150-400 mm = 102-273 texels)'
      % (TILE_M, RES, px_m * 1000))
print('    leaf scale (40 mm) deliberately absent: it is 0.4 px at the HERO hedge.')
print('    wrote 6 files to', OUT)
