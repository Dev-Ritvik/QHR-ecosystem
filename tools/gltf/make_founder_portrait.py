r"""
The founder's portrait, produced from the one photograph of him there is.

    python tools/gltf/make_founder_portrait.py <source.jpg> <out.png> [--stage mask|cut|final] [--debug <dir>]

THE AUDIT OF 2026-10-05, P0: "Replace the founder portrait with a produced
image. Now: a casual snapshot with an office background and a bright blue shirt
sits in the gilded frame. It does not match the colour and light of the hall
... Done when: the portrait looks commissioned rather than snapped, its colours
sit inside the hall's warm palette, it reads as a physical picture lit by the
picture light."

There is one photograph: a snapshot taken across a conference table, a
colleague's head behind the sitter's shoulder, a fabric wall and a wood panel
behind him, paper cups in front. No sitting can be arranged from here, and a
generated likeness of a real man is not this script's to make. What it does is
what a retoucher does with the frame a client has:

  1. THE SITTER IS CUT FROM THE ROOM. GrabCut, seeded by hand (the figures
     below are this photograph's own), its edge refined by a guided filter on
     the photograph so hair keeps its wisps.
  2. THE ROOM IS REPLACED WITH A SITTER'S BACKDROP: a painted ground of raw
     umber going to a warm half-light behind the shoulder the light falls on,
     the way a studio's canvas backdrop is lit, mottled by hand-made noise at
     three scales so it is a surface and not a gradient.
  3. THE CLOTH IS BROUGHT INTO THE HALL'S PALETTE. The shirt's cobalt was the
     one saturated cool in a room of ivory, walnut and gilt: it is taken to a
     deep slate, the same garment in a quieter dye. The jacket's cream is
     warmed a little toward the room's plaster and its glare taken down.
  4. THE LIGHT IS A PORTRAIT'S: a key from upper left as the photograph has it,
     the figure falling away into the backdrop toward the foot of the canvas
     (which is also where the table, the cups and the hands were).
  5. IT IS FINISHED AS A PICTURE: the grain of a phone's sensor smoothed with
     an edge-keeping filter, a canvas weave laid in at a few per cent, and the
     whole printed a third of a stop under, because it hangs under a lamp.

The output is the canvas's own proportions (0.714: portrait_canvas in the
hall, 2.62 x 3.67 m).
"""
import argparse
import os

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("source")
ap.add_argument("out")
ap.add_argument("--stage", default="final")
ap.add_argument("--debug", default=None)
ap.add_argument("--height", type=int, default=2048)
args = ap.parse_args()

src = cv2.imread(args.source, cv2.IMREAD_COLOR)
assert src is not None, args.source
H0, W0 = src.shape[:2]
assert (W0, H0) == (954, 1280), "the seeds below are for the 954 x 1280 original"


def dbg(name, img):
    if args.debug:
        os.makedirs(args.debug, exist_ok=True)
        cv2.imwrite(os.path.join(args.debug, name), img)


# ── 1. the sitter, cut from the room ────────────────────────────────────────
# Seeds, in the photograph's own pixels. FG: surely the sitter. BG: surely the
# room (and the colleague behind his right shoulder). Everything else is left
# for GrabCut to decide.
def poly(mask, pts, val):
    cv2.fillPoly(mask, [np.array(pts, dtype=np.int32)], val)


gc = np.full((H0, W0), cv2.GC_PR_BGD, np.uint8)
# probably the sitter: a generous outline of head, neck and torso
poly(gc, [(190, 300), (215, 215), (300, 175), (430, 170), (530, 215), (565, 330), (575, 470),
          (560, 520), (700, 560), (860, 600), (953, 660), (953, 1279), (0, 1279), (0, 800), (60, 690),
          (190, 620), (265, 560), (235, 470), (215, 380)], cv2.GC_PR_FGD)
# surely the sitter: the face, the neck, the shirt, the jacket's body
poly(gc, [(250, 330), (290, 250), (430, 235), (505, 290), (515, 420), (500, 520), (470, 600),
          (640, 640), (850, 700), (900, 800), (900, 1150), (120, 1150), (60, 900), (110, 760),
          (300, 640), (300, 560), (260, 470)], cv2.GC_FGD)
# his hair, surely
poly(gc, [(240, 290), (250, 230), (320, 200), (430, 195), (500, 235), (520, 300), (480, 270), (300, 270)], cv2.GC_FGD)
# surely the room: the top, the wall either side of the head, the wood panel
poly(gc, [(0, 0), (953, 0), (953, 560), (720, 520), (620, 480), (610, 300), (560, 180), (440, 120),
          (300, 120), (190, 180), (150, 320), (160, 430), (0, 640)], cv2.GC_BGD)
# the colleague's head behind his right shoulder
poly(gc, [(150, 500), (190, 505), (232, 530), (250, 590), (200, 625), (150, 650), (120, 640)], cv2.GC_BGD)
# the table, the cups and the glass at the foot
poly(gc, [(0, 1195), (953, 1195), (953, 1279), (0, 1279)], cv2.GC_BGD)
poly(gc, [(0, 1030), (175, 1030), (175, 1279), (0, 1279)], cv2.GC_BGD)

bgd = np.zeros((1, 65), np.float64)
fgd = np.zeros((1, 65), np.float64)
cv2.grabCut(src, gc, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
hard = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
# One figure: the largest piece, its holes closed.
n, labels, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
if n > 1:
    keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    hard = np.where(labels == keep, 255, 0).astype(np.uint8)
inv = cv2.bitwise_not(hard)
n, labels, stats, _ = cv2.connectedComponentsWithStats(inv, 8)
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if x > 0 and y > 0 and x + w < W0 and y + h < H0:  # an island of "room" inside the figure
        hard[labels == i] = 255
hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))


def guided(guide, p, r, eps):
    """He's guided filter (grey guide): the mask's edge follows the photograph's."""
    mean = lambda a: cv2.boxFilter(a, cv2.CV_32F, (2 * r + 1, 2 * r + 1))
    mI, mp = mean(guide), mean(p)
    cov = mean(guide * p) - mI * mp
    var = mean(guide * guide) - mI * mI
    a = cov / (var + eps)
    b = mp - a * mI
    return mean(a) * guide + mean(b)


grey = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
alpha = guided(grey, hard.astype(np.float32) / 255.0, 6, 1e-3)
# Drawn in a little: the outermost pixels of a cut-out are half wall, and half
# a pale wall on a dark ground is a halo round the sitter.
alpha = np.clip((alpha - 0.36) / 0.58, 0, 1)

# And what is left of the wall in the edge is taken out of its colour: each
# edge pixel takes the colour of the figure just inside it.
core = cv2.erode(hard, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))).astype(np.float32) / 255.0
spread = cv2.GaussianBlur(src.astype(np.float32) * core[..., None], (0, 0), 5)
weight = cv2.GaussianBlur(core, (0, 0), 5)[..., None]
inside = spread / np.maximum(weight, 1e-4)
edge = (1 - core)[..., None] * np.clip(weight * 6, 0, 1)
src = (src.astype(np.float32) * (1 - edge) + inside * edge).clip(0, 255).astype(np.uint8)
dbg("1_seeds.png", (gc * 80).astype(np.uint8))
dbg("1_alpha.png", (alpha * 255).astype(np.uint8))
if args.stage == "mask":
    cv2.imwrite(args.out, (alpha * 255).astype(np.uint8))
    raise SystemExit

# ── the crop: the canvas's proportions, head and shoulders ──────────────────
ASPECT = 2.62 / 3.67
CH = 1010
CW = int(round(CH * ASPECT))
CX, CY = 398, 100  # the sitter's own centre line, and the crop's top, in the photograph
x0 = max(0, min(W0 - CW, CX - CW // 2))
crop = (slice(CY, CY + CH), slice(x0, x0 + CW))
img = src[crop].astype(np.float32) / 255.0
a = alpha[crop]
h, w = a.shape
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
u, v = xx / w, yy / h

if args.stage == "cut":
    out = (img * a[..., None] + np.array([0.2, 0.8, 0.2]) * (1 - a[..., None]))
    cv2.imwrite(args.out, (np.clip(out, 0, 1) * 255).astype(np.uint8))
    raise SystemExit


# ── 3. the cloth, into the hall's palette ───────────────────────────────────
def to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


hsv = cv2.cvtColor((img * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
hue, sat, val = hsv[..., 0], hsv[..., 1] / 255.0, hsv[..., 2] / 255.0
# The shirt: saturated blue (OpenCV hue 95..125), inside the figure.
blue = np.clip((sat - 0.28) / 0.25, 0, 1) * np.clip(1 - np.abs(hue - 108) / 16, 0, 1) * a
blue = cv2.GaussianBlur(blue, (0, 0), 1.6)
rgb = img[..., ::-1]
lin = to_lin(rgb)
luma = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
SLATE = np.array([0.50, 0.57, 0.66], dtype=np.float32)  # a slate dye, as a tint on the cloth's own light
shirt = luma[..., None] * SLATE * 0.62
lin = lin * (1 - blue[..., None]) + shirt * blue[..., None]
# The jacket and the skin: a breath warmer, and the phone's hard highlights eased.
warm = np.array([1.04, 1.0, 0.93], dtype=np.float32)
lin = lin * (1 + (warm - 1) * (a * (1 - blue))[..., None])
peak = np.clip((luma - 0.42) / 0.5, 0, 1) * a * (1 - blue)
lin = lin * (1 - 0.3 * peak[..., None])

# ── 2. the backdrop ─────────────────────────────────────────────────────────
rng = np.random.default_rng(11)


def cloud(scale, seed):
    r = np.random.default_rng(seed)
    small = r.random((max(2, h // scale), max(2, w // scale))).astype(np.float32)
    return cv2.GaussianBlur(cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC), (0, 0), scale * 0.35)


mottle = 0.5 * cloud(170, 3) + 0.32 * cloud(60, 4) + 0.18 * cloud(18, 5)
mottle = (mottle - mottle.mean()) / (mottle.std() + 1e-6)
# Raw umber, lit from upper left: a half-light behind the sitter's left
# shoulder (the picture's right), falling to near-dark at the corners.
glow = np.exp(-(((u - 0.66) / 0.5) ** 2 + ((v - 0.34) / 0.42) ** 2))
fall = np.clip(1.15 - 0.75 * np.hypot((u - 0.5) / 0.75, (v - 0.42) / 0.8), 0.25, 1.0)
level = (0.035 + 0.085 * glow) * fall * (1 + 0.16 * mottle)
UMBER = np.array([1.0, 0.80, 0.56], dtype=np.float32)
OLIVE = np.array([0.86, 0.84, 0.62], dtype=np.float32)
tone = UMBER * (0.55 + 0.45 * glow[..., None]) + OLIVE * (0.45 - 0.45 * glow[..., None])
backdrop = level[..., None] * tone

# ── 4. the light: the figure falls away toward the foot of the canvas ───────
foot = np.clip((v - 0.66) / 0.25, 0, 1)
foot = foot * foot * (3 - 2 * foot)
side = np.clip((np.abs(u - 0.5) - 0.30) / 0.22, 0, 1) * np.clip((v - 0.5) / 0.4, 0, 1)
shade = 1 - 0.8 * foot - 0.5 * side * (1 - foot)
figure = lin * np.clip(shade, 0.02, 1)[..., None]
# ...and is lost in it before the canvas ends, as a bust is painted: the
# figure's own edge dissolves into the ground (what was at the foot of the
# photograph — the table, the cups, the hands — goes with it).
lost = np.clip((v - 0.74) / 0.17, 0, 1)
lost = lost * lost * (3 - 2 * lost)
a = a * (1 - lost)

comp = figure * a[..., None] + backdrop * (1 - a[..., None])
dbg("4_comp.png", (to_srgb(comp)[..., ::-1] * 255).clip(0, 255).astype(np.uint8))

# ── 5. the finish ───────────────────────────────────────────────────────────
out = to_srgb(comp * 0.80)
big = cv2.resize(out, (int(round(args.height * ASPECT)), args.height), interpolation=cv2.INTER_LANCZOS4)
big8 = (np.clip(big, 0, 1) * 255).astype(np.uint8)[..., ::-1]
# The sensor's grain and the upscale's softness, as brushwork: an edge-keeping
# smooth, then the edges it kept given back a little of their bite.
smooth = cv2.bilateralFilter(big8, 9, 26, 7)
smooth = cv2.bilateralFilter(smooth, 9, 18, 9)
soft = cv2.GaussianBlur(smooth, (0, 0), 1.4)
fin = cv2.addWeighted(smooth, 1.35, soft, -0.35, 0).astype(np.float32) / 255.0
# A canvas weave: two sets of threads, a few per cent.
Hh, Ww = fin.shape[:2]
gy, gx = np.mgrid[0:Hh, 0:Ww].astype(np.float32)
pitch = Hh / 420.0
weave = 0.5 * np.sin(gx * (2 * np.pi / pitch)) * np.sin(gy * (2 * np.pi / pitch) + 1.3)
weave += 0.5 * rng.standard_normal((Hh, Ww)).astype(np.float32) * 0.6
weave = cv2.GaussianBlur(weave, (0, 0), 0.7)
fin = np.clip(fin * (1 + 0.035 * weave[..., None]), 0, 1)
cv2.imwrite(args.out, (fin * 255).astype(np.uint8))
print("wrote", args.out, fin.shape[1], "x", fin.shape[0])
