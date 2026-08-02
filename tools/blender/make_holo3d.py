"""
Turn a flat layout raster into an extrudable 3D layer set.

The client's note is correct: a PNG on a horizontal quad has no silhouette, so
from any oblique angle it collapses. The fix is real geometry - plot blocks,
landscape and water as separate vertical layers with their own top faces and
side walls.

Method: the drawing is line art, so the plots are the *closed cells* bounded by
that line art, not the coloured pixels. Detect the linework, label everything
that is not linework, and each connected component is one plot / road / green
belt. Classify each cell by its mean fill colour, trace its contour, and emit
normalised polygons. Blender turns those into prisms.

    python make_holo3d.py <key>          # key = kartikeya | lucky

Writes <key>_cells.json next to the artwork plus <key>_debug.png so the
classification can be eyeballed before any geometry is built.
"""
import sys, os, json
import numpy as np
import cv2
from scipy import ndimage

ROOT = r"C:\dev\estate\assets\floorplans"

# ---------------------------------------------------------------- per-sheet cfg
# Three separate concerns that were tangled together on the first pass, with
# visible consequences in the render, so they now get their own lists:
#
# mask  : blanked to white here AND punched to alpha 0 in the texture. Photos,
#         logos, schedules, marketing copy - and any label the brief wants
#         re-floated as an upright card instead of baked into the sheet.
# fence : ringed with a wall. Only for rects that physically overlapped live
#         line work; blanking those opens the cells behind them and they drain
#         into the page background and disappear.
# nogeo : no geometry is built here. Every fenced rect needs this or the fence
#         itself closes into a cell and extrudes as a ghost rectangle.
#         Also covers plan graphics that are not site area (the compass rose).
CFG = {
    # Semantic sheet: colour carries meaning (cream = plot, green = landscape,
    # blue = lake, grey = carriageway).
    "kartikeya": {
        "src":  "holo_kartikeya.png",
        # The last rect is the right-hand margin below the lake. It holds a
        # couple of stray trees that belong to no part of the site; floated,
        # they read as a grey blade hanging beside the model.
        "mask": [(0, 636, 118, 725), (372, 694, 745, 725), (0, 340, 20, 368),
                 (700, 255, 745, 285), (706, 566, 745, 700)],
        "fence": [],
        "nogeo": [(608, 458, 712, 562), (0, 636, 118, 725), (372, 694, 745, 725),
                  (0, 340, 20, 368), (700, 255, 745, 285), (706, 566, 745, 700)],
        "mode": "semantic",
        "block": 21, "C": 5, "dark": 0.30,
        "heights": {"plot": 0.016, "plot_hot": 0.024, "green": 0.006,
                    "water": 0.0, "road": 0.0, "pad": 0.004},
        "min_area": 60,
        "layers": [("green", (55, 155), 0.18, 2500, 0.006)],
    },
    # Third palette. Semantic like Kartikeya - green is real open space, grey is
    # real carriageway - but drawn at 300dpi, so the linework is several pixels
    # wide and needs a larger adaptive window than the 745px Kartikeya scan.
    "gayatri": {
        "src":  "holo_gayatri.png",
        # Right-hand strip carries marketing bleed that survived the crop (the
        # Quality Homes mark and a letter of the Telugu wordmark).
        "mask": [(2230, 1150, 2400, 1710), (275, 1190, 350, 1500)],
        "fence": [],
        "nogeo": [(2230, 1150, 2400, 1710), (275, 1190, 350, 1500)],
        "mode": "semantic",
        "block": 25, "C": 6, "dark": 0.26,
        "heights": {"plot": 0.016, "plot_hot": 0.016, "green": 0.006,
                    "water": 0.0, "road": 0.0, "pad": 0.005},
        "min_area": 400,
        # (min local wall density, min parcel area px, height) - the sheet marks
        # a run of parcels with a diagonal hatch fill.
        "hatch": (0.34, 60000, 0.016),
        "hatch_win": 27,
        "layers": [("green", (80, 165), 0.16, 20000, 0.006)],
    },
    # Status sheet: every fill colour is an availability state, not terrain.
    # There is no landscape and no water on this drawing, so the semantic
    # hue rules must be switched off or green plots sink into the lawn.
    "lucky": {
        "src":  "holo_lucky_garden.png",
        # The last rect is the sheet's own "FUTURE EXTENTION" lettering. It is
        # masked but NOT fenced and NOT nogeo, so the pad underneath stays one
        # continuous piece and the label comes back as an upright card.
        # The last rect is the sheet's right-hand margin: survey line fragments
        # sitting outside the site boundary that extrude into a tall bar
        # floating clear of the model.
        "mask": [(0, 0, 320, 272), (0, 828, 258, 1214), (1466, 578, 1958, 1172),
                 (515, 335, 895, 485), (1962, 0, 2048, 1214)],
        "fence": [(1466, 578, 1958, 1172)],
        "nogeo": [(0, 0, 320, 272), (0, 828, 258, 1214), (1466, 578, 1958, 1172),
                  (1962, 0, 2048, 1214)],
        "mode": "status",
        "block": 25, "C": 8, "dark": 0.38,
        "heights": {"plot": 0.014, "plot_hot": 0.022, "green": 0.014,
                    "water": 0.022, "road": 0.0, "pad": 0.005},
        "min_area": 90,
        "layers": [],
    },
}

key = sys.argv[1]
cfg = CFG[key]
src = os.path.join(ROOT, cfg["src"])

rgba = cv2.imread(src, cv2.IMREAD_UNCHANGED)
if rgba is None:
    raise SystemExit("cannot read %s" % src)
bgr = rgba[..., :3].astype(np.float32) / 255.0
rgb = bgr[..., ::-1].copy()
H, W = rgb.shape[:2]

for (l, t, r, b) in cfg["mask"]:
    rgb[max(0, t):min(H, b), max(0, l):min(W, r)] = 1.0

mx = rgb.max(axis=2)
mn = rgb.min(axis=2)
lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
sat = np.where(mx > 1e-5, (mx - mn) / np.maximum(mx, 1e-5), 0.0)

hsv = cv2.cvtColor((rgb[..., ::-1] * 255).astype(np.uint8), cv2.COLOR_BGR2HSV)
hue = hsv[..., 0].astype(np.float32) * 2.0          # 0..360

# ------------------------------------------------------------------ line work
# A global luminance cut cannot separate line work on both sheets at once: the
# Kartikeya plot dividers are lighter than the green landscape they sit beside,
# so any threshold that catches the dividers swallows the lawn. Ask the local
# question instead - "is this pixel darker than its neighbourhood?" - which is
# what line work actually is, regardless of what it is drawn on.
l8 = (lum * 255).astype(np.uint8)
wall = cv2.adaptiveThreshold(l8, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                             cv2.THRESH_BINARY_INV, cfg["block"] | 1,
                             cfg["C"]).astype(bool)
wall |= lum < cfg["dark"]

# Saturated *thin* strokes (the red and blue survey lines on the Lucky Garden
# sheet) are walls too, but the saturated plot FILLS are not - separated by
# asking whether the stroke survives an opening.
strong = (sat > 0.45) & (lum < 0.86)
thin = strong & ~cv2.morphologyEx(strong.astype(np.uint8),
                                  cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)).astype(bool)
wall |= thin

# Blanking a photo to white punches a hole in whatever line work it overlapped,
# so the cells behind it drain into the page background and vanish. Fence each
# such rect with its own wall to keep those cells closed.
for (l, t, r, b) in cfg["fence"]:
    l, t = max(0, l), max(0, t)
    r, b = min(W, r), min(H, b)
    wall[t:b, max(0, l - 1):l + 1] = True
    wall[t:b, max(0, r - 1):r + 1] = True
    wall[max(0, t - 1):t + 1, l:r] = True
    wall[max(0, b - 1):b + 1, l:r] = True

wall = cv2.morphologyEx(wall.astype(np.uint8), cv2.MORPH_CLOSE,
                        np.ones((3, 3), np.uint8)).astype(bool)

lab, n = ndimage.label(~wall)
print("CELLS|raw=%d" % n)

slices = ndimage.find_objects(lab)
areas = ndimage.sum(np.ones_like(lab, dtype=np.float32), lab, range(1, n + 1))
bg_id = int(np.argmax(areas)) + 1                    # the page itself

nogeo = np.zeros((H, W), bool)
for (l, t, r, b) in cfg["nogeo"]:
    nogeo[max(0, t):min(H, b), max(0, l):min(W, r)] = True

MODE = cfg["mode"]

BIG = 0.02 * W * H

def classify(s, l, h, area):
    if s < 0.13 and 0.46 < l < 0.90:
        return "road"                                # grey carriageway
    if area > BIG:
        # An undivided expanse this size is not a plot - it is the balance of
        # the survey (Lucky Garden's FUTURE EXTENTION). Give it a low pad so it
        # reads as claimed land without competing with the sold inventory.
        return "pad"
    if MODE == "semantic":
        if s > 0.22 and 150 <= h <= 260:
            return "water"
        if s > 0.16 and 55 <= h < 150:
            return "green"                           # built by the layer pass
        # Every plot on this sheet is the same cream. Splitting it on
        # saturation would scatter random tall blocks through the grid.
        return "plot"
    if l > 0.90 and s < 0.10:
        return "plot"                                # unsold / uncoloured plot
    if s > 0.30:
        return "plot_hot"                            # status-coloured plot
    return "plot"

cells = []
H_MAP = cfg["heights"]

# ------------------------------------------------------------------- hatching
# A hatched block is a solid parcel drawn with a diagonal fill pattern. Cell
# labelling shatters it: every hatch stroke reads as linework, so all that
# survives is a scatter of slivers between the strokes, and the block appears as
# a hole in the model.
#
# The discriminator is DENSITY, not colour or hue. Plot boundaries are sparse -
# a few percent of any neighbourhood. Hatching fills a third or more of it. So
# measure local wall density, take the dense regions as single parcels, and mark
# them no-go for the normal pass so the slivers are not emitted as well.
if cfg.get("hatch"):
    dmin, hamin, hz = cfg["hatch"]
    K = cfg.get("hatch_win", 25) | 1
    # Solid fill is not hatching. The carriageways are a dark flat colour, so
    # they are 100% "wall" and would otherwise register as the densest hatch on
    # the sheet - the first attempt swallowed the entire road network and, after
    # closing, most of the plan with it. Strip large solid areas first, then
    # require density in a BAND: hatching is strokes with gaps between them, so
    # it never saturates the window the way a filled region does.
    solid = cv2.morphologyEx((lum < cfg["dark"]).astype(np.uint8),
                             cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)).astype(bool)
    dens = cv2.boxFilter((wall & ~solid).astype(np.float32), -1, (K, K))
    hm = ((dens > dmin) & (dens < 0.85) & ~solid).astype(np.uint8)
    # Plot NUMBERS are locally dense too. Opening hard first removes those blobs
    # (a two-digit label is ~40x80px) while a hatched parcel, two orders of
    # magnitude larger in area, survives; the dilate afterwards restores the
    # edge the opening ate.
    hm = cv2.morphologyEx(hm, cv2.MORPH_OPEN, np.ones((21, 21), np.uint8))
    hm = cv2.dilate(hm, np.ones((21, 21), np.uint8))
    hm = cv2.morphologyEx(hm, cv2.MORPH_CLOSE, np.ones((K, K), np.uint8))
    hm[nogeo] = 0
    hcnts, hhier = cv2.findContours(hm, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    nhatch = 0
    for ci, c in enumerate(hcnts):
        if hhier[0][ci][3] >= 0 or abs(cv2.contourArea(c)) < hamin:
            continue
        ap = cv2.approxPolyDP(c, 2.0, True).reshape(-1, 2).astype(np.float32)
        if len(ap) < 3:
            continue
        m = np.zeros((H, W), np.uint8)
        cv2.drawContours(m, [c], -1, 1, -1)
        sel = m.astype(bool)
        cells.append({
            "cat": "plot", "h": hz,
            "rgb": [round(float(rgb[..., i][sel].mean()), 4) for i in range(3)],
            "area": float(abs(cv2.contourArea(c))),
            "rings": [[[float(p[0]) / W, 1.0 - float(p[1]) / H] for p in ap]],
            "holes": [],
        })
        nhatch += 1
    nogeo |= hm.astype(bool)
    print("HATCH|parcels=%d" % nhatch)
for i in range(1, n + 1):
    if i == bg_id:
        continue
    area = float(areas[i - 1])
    if area < cfg["min_area"]:
        continue
    sl = slices[i - 1]
    sub = (lab[sl] == i)
    if nogeo[sl][sub].any():
        continue
    ys, xs = sl
    r_ = float(rgb[sl][..., 0][sub].mean())
    g_ = float(rgb[sl][..., 1][sub].mean())
    b_ = float(rgb[sl][..., 2][sub].mean())
    s_ = float(sat[sl][sub].mean())
    l_ = float(lum[sl][sub].mean())
    hh = float(np.median(hue[sl][sub]))
    bw = xs.stop - xs.start
    bh = ys.stop - ys.start
    # Margin strips and half-cut cells along the sheet edge survive labelling as
    # long ribbons. Extruded, they float beside the model as bright bars with no
    # relationship to the site, which is exactly how they showed up in review.
    if min(bw, bh) < 4 or max(bw, bh) > 25 * max(min(bw, bh), 1):
        continue
    if area / float(bw * bh) < 0.22:
        continue
    cat = classify(s_, l_, hh, area)
    if MODE == "semantic" and cat == "green":
        continue                                     # the layer pass owns this
    z = H_MAP[cat]
    if z <= 0.0:
        continue

    # dilate by one pixel so neighbouring prisms nearly touch and the linework
    # reads as a groove rather than a canyon
    pad = 3
    m8 = np.zeros((bh + pad * 2, bw + pad * 2), np.uint8)
    m8[pad:pad + bh, pad:pad + bw] = sub.astype(np.uint8)
    m8 = cv2.dilate(m8, np.ones((3, 3), np.uint8), iterations=1)

    cnts, hier = cv2.findContours(m8, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        continue
    rings, holes = [], []
    for ci, c in enumerate(cnts):
        eps = 1.2
        ap = cv2.approxPolyDP(c, eps, True).reshape(-1, 2).astype(np.float32)
        if len(ap) < 3:
            continue
        if abs(cv2.contourArea(ap)) < 30:
            continue
        ap[:, 0] += xs.start - pad
        ap[:, 1] += ys.start - pad
        pts = [[float(p[0]) / W, 1.0 - float(p[1]) / H] for p in ap]
        (rings if hier[0][ci][3] < 0 else holes).append(pts)
    if not rings:
        continue
    cells.append({"cat": cat, "h": z, "rgb": [round(r_, 4), round(g_, 4), round(b_, 4)],
                  "area": area, "rings": rings, "holes": holes})

# ------------------------------------------------------------- colour layers
# Landscape is not a cell - it is a continuous belt broken up by hundreds of
# tree crowns. Cell labelling shatters it into confetti, so pull it straight
# from the hue mask and close the gaps into one pad.
for lname, (h0, h1), smin, amin, z in cfg["layers"]:
    m = ((sat > smin) & (hue >= h0) & (hue < h1)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m[nogeo] = 0
    cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    for ci, c in enumerate(cnts):
        if hier[0][ci][3] >= 0 or abs(cv2.contourArea(c)) < amin:
            continue
        ap = cv2.approxPolyDP(c, 2.5, True).reshape(-1, 2).astype(np.float32)
        if len(ap) < 3:
            continue
        pts = [[float(p[0]) / W, 1.0 - float(p[1]) / H] for p in ap]
        holes = []
        for hj, hc in enumerate(cnts):
            if hier[0][hj][3] == ci and abs(cv2.contourArea(hc)) > amin * 0.25:
                hp = cv2.approxPolyDP(hc, 2.5, True).reshape(-1, 2).astype(np.float32)
                if len(hp) >= 3:
                    holes.append([[float(p[0]) / W, 1.0 - float(p[1]) / H] for p in hp])
        sub = m[c[:, 0, 1].min():c[:, 0, 1].max() + 1,
                c[:, 0, 0].min():c[:, 0, 0].max() + 1]
        cells.append({"cat": lname, "h": z, "rgb": [0.36, 0.55, 0.28],
                      "area": float(abs(cv2.contourArea(c))),
                      "rings": [pts], "holes": holes})

by = {}
for c in cells:
    by[c["cat"]] = by.get(c["cat"], 0) + 1
print("CELLS|kept=%d|%s" % (len(cells), by))

dst = os.path.join(ROOT, "%s_cells.json" % key)
json.dump({"w": W, "h": H, "cells": cells}, open(dst, "w"))
print("JSON|%s|%.2fMB" % (os.path.basename(dst), os.path.getsize(dst) / 1048576.0))

# --------------------------------------------------------------- texture pass
# Emit the hologram texture from the SAME mask list that drove the geometry.
# On the first pass these were maintained separately and drifted: the sheets
# still showed their logo, plot schedule and resort photograph floating in the
# hologram while the geometry knew nothing about them.
tex = rgba.copy()
if tex.shape[2] == 3:
    tex = np.dstack([tex, np.full(tex.shape[:2], 255, np.uint8)])

# A sheet that arrives straight from a scan (Gayatri, from a 300dpi TIFF) has no
# alpha at all, so the paper ships as an opaque slab and the "hologram" reads as
# a lit signboard. Derive alpha the same way the first two sheets got it:
# per pixel, max(1 - luminance, saturation). White paper -> 0 and disappears;
# ink and coloured fills -> 1 and stay. Saturation is weighted up because the
# content that matters (plot fills, landscape) is coloured but LIGHT, and on
# luminance alone it would fade out with the paper.
if tex[..., 3].min() == 255:
    a = np.maximum(1.0 - lum, sat * 1.6)
    a = np.clip((a - 0.14) / 0.66, 0.0, 1.0) ** 0.80
    a[a < 0.05] = 0.0
    tex[..., 3] = (a * 255.0).astype(np.uint8)
    print("ALPHA|derived|opaque_frac=%.3f" % float((a > 0.5).mean()))
for (l, t, r, b) in cfg["mask"]:
    tex[max(0, t):min(H, b), max(0, l):min(W, r), 3] = 0

# Anything opaque that reaches the sheet border lights up the plate's 2mm
# solidify rim, which reads as a bright blade floating off the side of the
# model. Retire a thin margin so no content ever touches the edge.
EDGE = 10
tex[:EDGE, :, 3] = 0
tex[-EDGE:, :, 3] = 0
tex[:, :EDGE, 3] = 0
tex[:, -EDGE:, 3] = 0
tex_dst = os.path.join(ROOT, "%s_holo_tex.png" % key)
cv2.imwrite(tex_dst, tex)
print("TEX|%s|%dx%d|%.2fMB" % (os.path.basename(tex_dst), W, H,
                               os.path.getsize(tex_dst) / 1048576.0))

# ------------------------------------------------------------------- debug png
COL = {"plot": (90, 200, 255), "plot_hot": (60, 80, 255), "green": (80, 220, 120),
       "water": (255, 190, 60), "road": (120, 120, 120), "pad": (200, 120, 220)}
dbg = (rgb[..., ::-1] * 255).astype(np.uint8).copy()
dbg = (dbg * 0.35).astype(np.uint8)
for c in cells:
    col = COL[c["cat"]]
    for ring in c["rings"]:
        p = np.array([[r[0] * W, (1.0 - r[1]) * H] for r in ring], np.int32)
        cv2.fillPoly(dbg, [p], tuple(int(v * 0.5) for v in col))
        cv2.polylines(dbg, [p], True, col, 1, cv2.LINE_AA)
cv2.imwrite(os.path.join(ROOT, "%s_debug.png" % key), dbg)
print("DEBUG|%s_debug.png" % key)
