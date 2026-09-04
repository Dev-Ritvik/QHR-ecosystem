"""
Author the P5A ground SURFACE sets: maintained turf, and gravel forecourt.

    python tools/gltf/make_ground_p5a.py [--lawn R G B] [--gravel R G B]
                                         [--lawn-sd N] [--gravel-sd N]

WHY THIS EXISTS, IN ONE MEASUREMENT. The shipped ground is a single 1024 map
clamped across 240 m -> 0.2344 m per texel. Ray-cast against the real cameras
(tools/capture/phase5_ground.mjs) the nearest ground in frame needs 0.0197 m
per PIXEL at HERO and 0.0153 at NW, i.e. the map is MAGNIFIED 12-15x across the
nearest half of every exterior frame. Below mip 0 there is nothing to sample,
so the GPU interpolates between texels that carry no information: 25-47% of
every frame is a bilinear smear. Re-baking a better 240 m map cannot fix that -
the frequency simply is not there. The only thing that can put detail at 0.02 m
per pixel is a TILING set.

TILE SIZE IS DERIVED, NOT PICKED. At 6.0 m over 1024 px the set carries
0.00586 m/texel. Against the 0.0197 m/px the near HERO ground needs, that is a
minification of 3.4x - so the hardware samples around mip 1.75 and gets a
correctly band-limited result, and it stays correctly sampled all the way out
(0.0635 m/px at the HERO horizon -> mip ~3.4). Going finer would buy nothing
the screen can show; going coarser would put us back under mip 0. 6 m also
keeps the repeat period at 305 px on the near ground, and neither set carries a
landmark feature large enough to make that period legible - which is the actual
mechanism by which tiling reads as tiling.

CONTRAST IS SOLVED FOR, NOT DIALLED. The first attempt at this file composed
its variation as hand-picked percentages and produced an sRGB standard
deviation of 1.7-3.4 counts - numerically a flat colour, i.e. it would have
replaced one featureless plane with another at 60x the texel cost. The failure
is arithmetic and worth stating: at a linear mean of 0.132, d(sRGB)/d(linear)
is 1.46, so a +/-7% linear wobble is +/-2.5 counts of 255. Turf needs ~40%
RELATIVE variation to read at all. So the variation field is now built with
unit weights and then SCALED to hit a stated sRGB standard deviation, measured
after the sRGB transfer. The target is the authored parameter; the internal
gain is solved.

DISTANCE COHERENCE IS ENFORCED, NOT HOPED FOR. A tiling map's far field IS its
mip tail, so the tail has to land on the intended colour or the estate changes
hue with distance. Both sets are normalised so their LINEAR mean equals the
authored target exactly (asserted under 0.002), which makes mip N the target
colour by construction.

WHAT THE SETS CARRY

  TURF   MACRO  mowing bands. A maintained lawn's signature is not blade
                detail - it is the alternating lay of the grass behind a
                cylinder mower. 1.0 m stripes (6 whole per tile, so the seam is
                exact), softened square wave rather than a sine because a
                mower's boundary is a real edge.
         MESO   clump and wear mottle at 375 mm and 1.2 m, plus a warm/cool
                drift so the sward is not one green - it is the CHROMA
                variation the eye reads, not the luma.
         MICRO  blade grain at 60 mm and 19 mm. Held at moderate weight: at
                0.02 m per pixel a blade is one pixel, so high-contrast blade
                detail would alias into sparkle rather than read as grass.
         ROUGH  0.72 base. Grass is not glossy and not chalk: the blades give
                a broad dull sheen, modulated by the mowing bands, because the
                lay of the blades is exactly what makes stripes visible.
         NORMAL from height, weak - at these distances the relief that matters
                is the mowing band, not the blade.

  GRAVEL MACRO  raked drift at 1.5 m, and two compacted wheel tracks. A
                forecourt that has been driven on is the point of a forecourt,
                and the tracks are the cheapest true signal of use.
         MESO   stone clusters at 150 mm - the layer that says gravel rather
                than sand.
         MICRO  individual stones ~30 mm as thresholded rounded blobs with a
                real height field, at a density that reads as bound
                self-binding gravel rather than loose shingle.
         ROUGH  0.62, falling to ~0.48 on stone crowns (polished by traffic)
                and rising to ~0.86 in the fines between them.
         NORMAL from height, the stronger of the two sets - stones are the one
                thing here with genuine relief at 0.02 m/px.

COLOUR. Both are authored in LINEAR and written sRGB-encoded. Neither material
carries a baseColorFactor tint (unlike the Phase 4 stone), because the ground
has no tint to inherit and a factor would only be a second place to look.

The lawn target is NOT the textbook grass albedo. P4A established that this
scene's locked cool environment plus the #5E6147 daylight haze desaturates
hard: the shipped ground renders at R/G 0.99 - a neutral olive - from a source
whose own R/G is 0.85. So the authored green is pushed past the target read and
the RENDERED result is what gets measured, exactly as the limestone was.

The four noise helpers are COPIED from make_limestone_wall.py rather than
imported. That module executes at import and writes the P4A wall set, so
importing it rewrote a locked source - see the note on _mean_default there.

Seamless by construction: every field is a wrapped lattice.
Sources are untouched; this writes a new _ground/ set.
"""
import numpy as np, os, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'materials', '_ground')
os.makedirs(OUT, exist_ok=True)
RES = 1024
TILE_M = 6.0
px_m = TILE_M / RES                       # 5.86 mm per pixel

# Authored LINEAR means, and the sRGB standard deviation each set is solved to.
# SOLVED, not chosen. v1 of this set authored (0.086, 0.132, 0.043) and the
# runtime rendered the lawn at L 81.3 against the mansion's 100.4 - a ratio of
# 0.81, where the shipped ground sat at 0.70. That is the mansion losing
# dominance to a surface holding 43.7% of the frame, which the brief forbids.
#
# The correction is a two-point fit of the runtime's own response rather than a
# guess. Measured on the SAME masked classes, rendered_linear = a * source + c
# with a = (0.431, 0.465, 0.491) and c = (0.0341, 0.0304, 0.0195): roughly half
# the albedo survives, on top of a large additive fill from the hemisphere,
# ambient and #5E6147 haze. That c is the whole reason a textbook grass green
# renders as neutral olive - it is added equally to R and G, so it washes the
# hue out no matter how saturated the source is.
#
# Solving that fit for a rendered L of 72.5 (ratio 0.72, just above the shipped
# 70.6 to pay for the extra micro-detail) at R/G 0.854 gives the values below.
# The TEXTURE and the CHROMA structure are unchanged; only the level moved.
LAWN = [0.044, 0.0912, 0.0259]
# +20% and warmed. v1 rendered at L 87.8 against the terrace paving's 116.1 - a
# gravel drive should sit below dressed limestone, but 0.76 read as tarmac
# rather than as the warm self-binding gravel an estate of this stone would use.
GRAVEL = [0.272, 0.253, 0.218]
LAWN_SD, GRAVEL_SD = 18.0, 28.0
for flag, tgt in (('--lawn', LAWN), ('--gravel', GRAVEL)):
    if flag in sys.argv:
        i = sys.argv.index(flag); tgt[:] = [float(x) for x in sys.argv[i + 1:i + 4]]
if '--lawn-sd' in sys.argv: LAWN_SD = float(sys.argv[sys.argv.index('--lawn-sd') + 1])
if '--gravel-sd' in sys.argv: GRAVEL_SD = float(sys.argv[sys.argv.index('--gravel-sd') + 1])


# ----------------------------------------------------------------- helpers ----
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


def norm_to(lin, target):
    """Force the LINEAR mean onto the target per channel, preserving structure."""
    out = np.empty(lin.shape, np.float32)
    for c in range(3):
        ch = lin[..., c]
        out[..., c] = np.clip(ch * (target[c] / max(float(ch.mean()), 1e-6)), 0, 1)
    return out


def solve_gain(build, target_sd, lo=0.02, hi=5.00, iters=30):
    """Find the variation gain whose sRGB green-channel sd hits target_sd.

    Bisection rather than a formula because the sRGB transfer is non-linear and
    the fields are clipped at 0 and 1, so the relationship between gain and
    measured sd has no closed form. 26 iterations resolves the gain to 1e-7,
    which is far finer than the 0.1-count tolerance asserted below.
    """
    def sd_of(g):
        return float((to_srgb(build(g))[..., 1] * 255).std())
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        if sd_of(mid) < target_sd: lo = mid
        else: hi = mid
    g = 0.5 * (lo + hi)
    return g, sd_of(g)


def report(tag, lin, rough, nrm, gain):
    m = lin.reshape(-1, 3).mean(0)
    s8 = to_srgb(lin).reshape(-1, 3)
    print('%-7s linear mean (%.4f, %.4f, %.4f)  R/G %.3f  G/B %.3f  gain %.4f'
          % (tag, m[0], m[1], m[2], m[0] / m[1], m[1] / m[2], gain))
    print('        srgb8 mean %s  sd %s  p05..p95 %s..%s'
          % (np.round(s8.mean(0) * 255, 1), np.round(s8.std(0) * 255, 1),
             np.round(np.percentile(s8 * 255, 5, axis=0), 1),
             np.round(np.percentile(s8 * 255, 95, axis=0), 1)))
    print('        rough mean %.3f  range %.3f..%.3f      normal z mean %.3f (1.0 = flat)'
          % (rough.mean(), rough.min(), rough.max(), nrm[..., 2].mean()))
    return m


# =============================================================== TURF =========
rg = np.random.default_rng(5101)

# MACRO - mowing bands. 3 whole stripes per 6 m tile, so 1.0 m per mower pass
# and the seam stays exact.
#
# THE STRIPE IS NOT AN ALBEDO PATTERN AND IT IS NOT A RIDGE. The first version
# of this file made it both and rendered corduroy: 24 hard bars across a 2x2
# tile, over a normal map that was nothing but vertical bands. The physical
# mechanism is neither. A cylinder mower leaves alternate passes with the blades
# LEANING toward and away from the machine, so what alternates is the direction
# of the specular lobe - a normal TILT plus a roughness change, with only a
# trace in albedo. Modelled that way here: weight 0.10 in colour, a real +/-
# tilt injected into the normal's x AFTER the height derivative, and the full
# swing left in roughness, where it belongs.
stripe = np.tanh(np.sin(np.linspace(0, 3 * 2 * np.pi, RES, endpoint=False))[None, :] * 2.2) \
    * np.ones((RES, 1), np.float32)
wander = fbm(RES, 2, 3, rg) - 0.5
stripe = (stripe * (1.0 + 0.70 * wander)).astype(np.float32)

tussock = fbm(RES, 50, 3, rg) - 0.5        # 120 mm - the clump scale that
                                           # actually reads as grass at 20 mm/px
clump = fbm(RES, 16, 4, rg) - 0.5          # 375 mm
wear = fbm(RES, 5, 3, rg) - 0.5            # 1.2 m
blade = fbm(RES, 110, 2, rg) - 0.5         # 55 mm. Two octaves, not three: the
                                           # third landed at 14 mm and aliased.
grain = wrapped_noise(RES, 260, rg) - 0.5  # 23 mm
warm = 0.5 + 0.5 * np.tanh((wear + 0.6 * clump) * 3.0)

# Unit-weighted variation; the gain in front of it is solved for, not chosen.
# The weights are the DESIGN; the gain in front of them is solved. They are
# deliberately loaded onto the low-frequency end, because this set is minified
# 3.4x at the near HERO ground: mip ~1.75 averages roughly 11 texels, which
# leaves the 120 mm tussock and the 375 mm clump intact on screen and takes most
# of the 23 mm grain away. Weighting the fine end would buy sd in the file that
# the frame never sees.
VAR_T = (0.10 * stripe + 0.85 * clump + 1.00 * tussock + 0.55 * wear
         + 0.45 * blade + 0.20 * grain).astype(np.float32)


def build_turf(gain):
    luma = np.clip(1.0 + gain * VAR_T, 0.05, 3.0)
    base = np.stack([
        LAWN[0] * luma * (0.86 + 0.30 * warm),
        LAWN[1] * luma * (1.02 - 0.04 * warm),
        LAWN[2] * luma * (1.16 - 0.34 * warm),
    ], -1).astype(np.float32)
    return norm_to(base, LAWN)


g_t, sd_t = solve_gain(build_turf, LAWN_SD)
turf_lin = build_turf(g_t)

# Height from the clump structure only: tussocks and blades have relief, a
# mowing stripe does not.
h_t = (0.55 * tussock + 0.30 * clump + 0.22 * blade + 0.08 * grain).astype(np.float32)
turf_nrm = height_to_normal(h_t, strength=0.85)
# ...then lean the blades: a constant tangent-space x tilt per pass,
# renormalised. This is the specular-direction flip, not a bump.
LEAN = 0.16
turf_nrm[..., 0] = np.clip(turf_nrm[..., 0] + LEAN * stripe * 0.5, 0, 1)
_v = turf_nrm * 2.0 - 1.0
_v /= np.linalg.norm(_v, axis=-1, keepdims=True)
turf_nrm = (_v * 0.5 + 0.5).astype(np.float32)
# Roughness carries the full stripe swing: the lay of the blades is what makes
# one pass read brighter than the next under a raking key.
turf_rgh = np.clip(0.72 - 0.085 * stripe + 0.045 * clump - 0.030 * tussock,
                   0.55, 0.88).astype(np.float32)

save_rgb('p5a_turf_basecolor.png', to_srgb(turf_lin))
save_l('p5a_turf_roughness.png', turf_rgh)
save_rgb('p5a_turf_normal.png', turf_nrm)
m_turf = report('TURF', turf_lin, turf_rgh, turf_nrm, g_t)

# ============================================================= GRAVEL =========
rg = np.random.default_rng(5102)

rake = fbm(RES, 4, 3, rg) - 0.5            # 1.5 m
tw = np.linspace(0, 1, RES, endpoint=False)[None, :] * np.ones((RES, 1), np.float32)
track = (np.exp(-((tw - 0.30) / 0.055) ** 2) + np.exp(-((tw - 0.70) / 0.055) ** 2)) \
    * (0.75 + 0.5 * fbm(RES, 3, 2, rg))
track = np.clip(track, 0, 1).astype(np.float32)
cluster = fbm(RES, 40, 3, rg) - 0.5        # 150 mm
sf = fbm(RES, 200, 2, rg)                  # ~30 mm
stones = (np.clip((sf - 0.52) / 0.30, 0, 1) ** 0.65).astype(np.float32)
fines = wrapped_noise(RES, 420, rg) - 0.5  # 14 mm

VAR_G = (0.42 * rake + 0.38 * cluster + 0.95 * (stones - stones.mean()) + 0.30 * fines).astype(np.float32)


def build_gravel(gain):
    luma = np.clip(1.0 + gain * VAR_G, 0.05, 3.0) * (1.0 - 0.085 * track)
    base = np.stack([GRAVEL[0] * luma * 1.030,
                     GRAVEL[1] * luma * 1.000,
                     GRAVEL[2] * luma * 0.955], -1).astype(np.float32)
    return norm_to(base, GRAVEL)


g_g, sd_g = solve_gain(build_gravel, GRAVEL_SD)
grav_lin = build_gravel(g_g)

# Height from a SMOOTHED stone field. height_to_normal differentiates, which
# amplifies whatever the highest frequency present is - so feeding it the raw
# threshold plus 14 mm fines produced a normal map that was pure sandpaper and
# carried no stone-scale relief at all. A 5 px (30 mm) wrapped box blur puts the
# derivative's energy back at the size of an actual stone; the fines drop to a
# trace, and the strength rises to compensate the flatter input.
def wrap_blur(a, r):
    k = np.ones(2 * r + 1, np.float32) / (2 * r + 1)
    out = a.astype(np.float32)
    for ax in (0, 1):
        pad = np.concatenate([out[-r:], out, out[:r]], axis=0) if ax == 0 else \
              np.concatenate([out[:, -r:], out, out[:, :r]], axis=1)
        out = np.apply_along_axis(lambda m: np.convolve(m, k, 'valid'), ax, pad)
    return out.astype(np.float32)


stones_h = wrap_blur(stones, 5)
h_g = (0.95 * stones_h + 0.35 * cluster + 0.20 * rake + 0.03 * fines - 0.30 * track).astype(np.float32)
grav_nrm = height_to_normal(h_g, strength=2.2)
grav_rgh = np.clip(0.62 - 0.100 * stones + 0.140 * (0.5 - cluster) - 0.060 * track,
                   0.48, 0.86).astype(np.float32)

save_rgb('p5a_gravel_basecolor.png', to_srgb(grav_lin))
save_l('p5a_gravel_roughness.png', grav_rgh)
save_rgb('p5a_gravel_normal.png', grav_nrm)
m_grav = report('GRAVEL', grav_lin, grav_rgh, grav_nrm, g_g)

# ------------------------------------------------------------- assertions -----
for tag, m, t in (('turf', m_turf, LAWN), ('gravel', m_grav, GRAVEL)):
    err = float(np.max(np.abs(m - np.array(t))))
    assert err < 0.002, '%s linear mean missed target by %.4f' % (tag, err)
for tag, got, want in (('turf', sd_t, LAWN_SD), ('gravel', sd_g, GRAVEL_SD)):
    assert abs(got - want) < 0.1, '%s sd solved to %.2f, wanted %.2f' % (tag, got, want)
print('\nOK  tile %.1f m at %d px -> %.2f mm/texel  (shipped ground: 234.4 mm/texel, 40.0x coarser)'
      % (TILE_M, RES, px_m * 1000))
print('    near HERO ground needs 19.7 mm/px: this set is minified 3.4x (mip ~1.75, correctly sampled).')
print('    shipped set was MAGNIFIED 11.9x - below mip 0, nothing to sample.')
print('    wrote 6 files to', OUT)
