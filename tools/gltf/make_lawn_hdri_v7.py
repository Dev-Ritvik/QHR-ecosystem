"""
The estate's lawn, from a photograph of grass.

    python make_lawn_hdri_v7.py <hdri.exr> <outdir> [--contrast 1.0] [--seed 11]

Writes v7_lawn_basecolor.png, v7_lawn_normal.png and v7_lawn_roughness.png
over the synthesised turf that make_estate_textures_v7.py lays down (run it
after that script), and lawn_hdri_report.json beside them.

THE USER'S BRIEF (2026-10-27): "in C:/dev/estate/Royal audit there is a hdri
replace it with the grass all over the website". The HDRI is a meadow at dusk
(hdrmaps.com, free, 2048 x 1024): its lower half is a field of real grass, and
the synthesised turf it replaces was a few percent of noise over one flat
green, which is what every audit read as the lawn's "CG surface".

  GROUND, SEEN FROM ABOVE. Straight under the panorama's camera the field is
  photographed nearly top-down; the ground is projected onto a plane from a
  camera CAMERA_M above it, and only the disc out to USE_M is kept (beyond it
  the blades are seen from the side and smear along the radius). At this
  panorama's 0.18 degrees a pixel that disc is about 5 mm a pixel, which is
  what the lawn's tile asks: 1024 pixels to LAWN_TILE_M, 5.9 mm.

  NO LIGHT IN IT. The field was lit by the dusk sky alone, so there is no sun
  baked into the blades, only the dark between them; what is left of the
  sky's unevenness (brighter toward its glow) is divided out over 0.3 m, so
  the turf carries the grass and the scene's own sun lights it.

  ONE SEAMLESS TILE (image quilting, Efros and Freeman 2001, on a torus):
  patches of the disc laid on a grid that wraps at both edges, each chosen
  among those that best continue what is already down, and joined to it
  along the seam of least difference, so the tile repeats with no edge.

  THE LAWN'S OWN COLOUR. The dusk sky made the grass blue-green; each channel
  is scaled so the tile's mean is the approved turf's (104, 132, 64: "olive-
  gold, not a snooker table"), which keeps the grade, the haze and every
  contrast the film was measured at. What changes is everything under the
  mean: blades, the dark between them, a seed head, a buttercup.

The runtime lawn shader (apps/public/src/components/experience/
exteriorLawn.ts) still lays the mowing bands, the macro patches and the
anti-tiling over this tile.
"""
import json
import os
import sys

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith("--")]
if len(args) < 2:
    sys.exit(__doc__)
SRC, OUT = args[0], args[1]


def opt(name, fallback):
    flag = "--" + name
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return type(fallback)(sys.argv[i + 1])
    return fallback


CONTRAST = opt("contrast", 1.0)
RNG = np.random.default_rng(opt("seed", 11))
os.makedirs(OUT, exist_ok=True)

N = 1024                  # the tile, pixels (make_estate_textures_v7.py N)
TILE_M = 6.0              # the tile, metres (build_estate_v7.py TILE, MAT_Lawn)
CAMERA_M = 1.7            # the panorama's camera above the ground (a tripod's)
USE_M = 1.7               # the disc kept: past this the blades are side-on
FLAT_M = 0.3              # the sky's unevenness divided out over this
PATCH, OVERLAP = 112, 48  # quilting: 66 cm patches, 28 cm overlaps
TARGET_SRGB = (104, 132, 64)


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


# --- The ground, from above ---------------------------------------------------
pano = cv2.imread(SRC, cv2.IMREAD_UNCHANGED)
if pano is None:
    sys.exit("cannot read %s" % SRC)
pano = np.ascontiguousarray(pano[:, :, :3][:, :, ::-1], dtype=np.float32)  # BGR(A) -> RGB, linear
PH, PW = pano.shape[:2]

ppm = N / TILE_M
S = int(round(2 * USE_M * ppm))
c = (np.arange(S) + 0.5) / ppm - USE_M
x, y = np.meshgrid(c, c)
r = np.hypot(x, y)
dep = np.arctan2(CAMERA_M, r)
v = (0.5 + dep / np.pi) * PH - 0.5
u = ((np.arctan2(y, x) / (2 * np.pi)) % 1.0) * PW - 0.5
src = cv2.remap(pano, u.astype(np.float32), v.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_WRAP)
src = np.maximum(src, 0.0)
valid = r <= USE_M


def blur_masked(a, m, sigma):
    num = cv2.GaussianBlur(a * m, (0, 0), sigma)
    den = cv2.GaussianBlur(m, (0, 0), sigma)
    return num / np.maximum(den, 1e-6)


LUM = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
lum = src @ LUM
vm = valid.astype(np.float32)
low = blur_masked(lum, vm, FLAT_M * ppm)
src = src * (lum[valid].mean() / np.maximum(low, 1e-6))[:, :, None]
src[~valid] = 0.0

# --- Quilting on a torus --------------------------------------------------------
STEP = PATCH - OVERLAP
K = N // STEP
assert K * STEP == N
P = PATCH
Q = S - P + 1             # positions a patch can be cut from, each way

# The positions a patch may be cut from: wholly inside the disc (which is
# centred, so the same positions serve the disc turned and mirrored).
ii = cv2.integral(vm.astype(np.float64))
inside = (ii[P:, P:] - ii[:-P, P:] - ii[P:, :-P] + ii[:-P, :-P]) >= P * P - 0.5
inside = inside[:Q, :Q]

# The disc in its eight orientations: grass from above has no up, and a
# patch turned or mirrored is one the eye has not already seen.
VARIANTS = []
for turn in range(4):
    for mirror in (False, True):
        a = np.rot90(src, turn)
        a = np.ascontiguousarray(a[:, ::-1] if mirror else a, dtype=np.float64)
        VARIANTS.append((
            a,
            [np.fft.rfft2(a[:, :, k]) for k in range(3)],
            sum(np.fft.rfft2(a[:, :, k] ** 2) for k in range(3)),
        ))
# Where each orientation has been cut from already: a patch is dearer the
# nearer it lies to one used before (REUSE), so the tile does not repeat.
used = np.zeros((len(VARIANTS), Q, Q), np.float64)
REUSE, REUSE_PX, SPREAD_PX, SHORTLIST, TOLERANCE = 0.6, 36.0, 24, 8, 1.25
gy, gx = np.mgrid[:Q, :Q]


def ssd_map(variant, tmpl, mask):
    """Masked sum of squared differences of tmpl against every position."""
    _, F_S, F_S2 = variant
    pad = np.zeros((S, S), np.float64)
    pad[:P, :P] = mask
    acc = F_S2 * np.conj(np.fft.rfft2(pad))
    for k in range(3):
        pad[:P, :P] = mask * tmpl[:, :, k]
        acc -= 2.0 * F_S[k] * np.conj(np.fft.rfft2(pad))
    corr = np.fft.irfft2(acc, s=(S, S))
    return corr[:Q, :Q] + float((mask[:, :, None] * tmpl ** 2).sum())


def choose(e):
    """A position among the best few that are not next to one another."""
    flat = e.ravel()
    top = np.argpartition(flat, 4000)[:4000]
    top = top[np.argsort(flat[top])]
    keep = []
    for f in top:
        yy, xx = divmod(int(f), Q)
        if all((yy - a) ** 2 + (xx - b) ** 2 > SPREAD_PX ** 2 for a, b in keep):
            keep.append((yy, xx))
            if len(keep) == SHORTLIST:
                break
    best = e[keep[0]]
    keep = [k for k in keep if e[k] <= best * TOLERANCE + 1e-12]
    return keep[RNG.integers(len(keep))]


def cut(err):
    """The least-difference path down a strip (rows x cols): its column per row."""
    rows, cols = err.shape
    cost = err.copy()
    for i in range(1, rows):
        prev = cost[i - 1]
        left = np.r_[np.inf, prev[:-1]]
        right = np.r_[prev[1:], np.inf]
        cost[i] += np.minimum(np.minimum(left, prev), right)
    path = np.empty(rows, int)
    path[-1] = int(np.argmin(cost[-1]))
    for i in range(rows - 2, -1, -1):
        j = path[i + 1]
        lo, hi = max(0, j - 1), min(cols, j + 2)
        path[i] = lo + int(np.argmin(cost[i, lo:hi]))
    return path


out = np.zeros((N, N, 3), np.float64)
filled = np.zeros((N, N), bool)
errs = []
for pi in range(K):
    for pj in range(K):
        rows = (pi * STEP + np.arange(P)) % N
        cols = (pj * STEP + np.arange(P)) % N
        old = out[np.ix_(rows, cols)]
        have = filled[np.ix_(rows, cols)]
        t = int(RNG.integers(len(VARIANTS)))
        if have.any():
            # (an FFT's rounding leaves the best match a hair under zero)
            e = np.maximum(ssd_map(VARIANTS[t], old, have.astype(np.float64)), 0.0)
            e *= 1.0 + REUSE * used[t]
            e[~inside] = np.inf
            sy, sx = choose(e)
        else:
            pool = np.argwhere(inside)
            sy, sx = pool[RNG.integers(len(pool))]
        used[t] += np.exp(-((gy - sy) ** 2 + (gx - sx) ** 2) / (2 * REUSE_PX ** 2))
        new = VARIANTS[t][0][sy:sy + P, sx:sx + P]
        diff = ((new - old) ** 2).sum(axis=2) * have
        take = np.ones((P, P), bool)
        O = OVERLAP
        if have[:, :O].any():
            for i, j in enumerate(cut(diff[:, :O])):
                take[i, :j] = False
        if have[:, P - O:].any():
            for i, j in enumerate(cut(diff[:, P - O:][:, ::-1])):
                take[i, P - j:] = False
        if have[:O, :].any():
            for i, j in enumerate(cut(diff[:O, :].T)):
                take[:j, i] = False
        if have[P - O:, :].any():
            for i, j in enumerate(cut(diff[P - O:, :][::-1, :].T)):
                take[P - j:, i] = False
        w = cv2.GaussianBlur(take.astype(np.float32), (0, 0), 0.8).astype(np.float64)
        w = np.where(have, w, 1.0)[:, :, None]
        out[np.ix_(rows, cols)] = new * w + old * (1.0 - w)
        filled[np.ix_(rows, cols)] = True
        if have.any():
            errs.append(float(np.sqrt(diff[have].mean())))

# --- The lawn's own colour ---------------------------------------------------------
target = srgb_to_lin(TARGET_SRGB)
mean = out.reshape(-1, 3).mean(0)
lin = out * (target / mean)[None, None, :]
if CONTRAST != 1.0:
    lm = (lin @ LUM)[:, :, None]
    lin = lin * (np.maximum(lm, 1e-6) / (lm.mean())) ** (CONTRAST - 1.0)
    lin *= (target / lin.reshape(-1, 3).mean(0))[None, None, :]
base = (lin_to_srgb(lin) * 255 + 0.5).astype(np.uint8)
Image.fromarray(base, "RGB").save(os.path.join(OUT, "v7_lawn_basecolor.png"))

# --- Relief and sheen, from the blades' light (lit tips stand highest) -----------------
lum_t = lin @ LUM
height = np.log(np.maximum(lum_t, 1e-5))
height = (height - height.mean()) / height.std()
pad = 8   # (OpenCV blurs no wrapped border: the tile is padded with itself)
height = cv2.GaussianBlur(np.pad(height, pad, mode="wrap"), (0, 0), 0.7)[pad:-pad, pad:-pad]
height /= height.std()
dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
STRENGTH = 0.5
nx, ny, nz = -dx * STRENGTH, dy * STRENGTH, np.ones_like(height)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
nrm = np.stack([nx / ln, ny / ln, nz / ln], axis=-1)
Image.fromarray(((nrm * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8), "RGB").save(os.path.join(OUT, "v7_lawn_normal.png"))
tilt = np.degrees(np.arccos(np.clip(nrm[:, :, 2], -1, 1)))
rough = np.clip(0.9 - 0.04 * height, 0, 1)
Image.fromarray((rough * 255 + 0.5).astype(np.uint8), "L").save(os.path.join(OUT, "v7_lawn_roughness.png"))

srgb = base.reshape(-1, 3).astype(float)
report = {
    "source": os.path.basename(SRC),
    "disc_px": S,
    "patches": K * K,
    "seam_rms": round(float(np.mean(errs)), 6) if errs else 0,
    "mean_srgb": [round(float(v), 1) for v in srgb.mean(0)],
    "std_srgb": [round(float(v), 1) for v in srgb.std(0)],
    "lawn_tilt95": round(float(np.percentile(tilt, 95)), 2),
    "contrast": CONTRAST,
}
json.dump(report, open(os.path.join(OUT, "lawn_hdri_report.json"), "w"), indent=1)
print(json.dumps(report))
