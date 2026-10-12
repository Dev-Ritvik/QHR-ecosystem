r"""
THE STATIONS' SITE MODELS: the traced cells, cleaned for a model.

    python tools/gltf/clean_plan_cells.py [--preview <dir>]

Reads assets/floorplans/<name>_cells.json (each layout's sanctioned sheet,
traced: one cell a block of plots or a piece of land, with the colour it is
printed in) and writes assets/floorplans/<name>_model_cells.json, which is what
the models' geometry and their printed faces are both made from
(tools/blender/make_plan_model_geo.py, tools/gltf/make_plan_models.py).

The tracing was made for a drawing in light, and a model is solid. The forensic
audit of 2026-10-09 found what that left on two of the three boards:

  #41 (VSR Gayatri Township, AI-SLOP): "The green open-space block has a
  plus-shaped hole in it, and the white strips round the plots have lumpy,
  beaded edges ... Both are the marks of a drawing traced automatically (a
  symbol and a row of tree icons read as geometry). Expected: clean blocks: a
  whole green, straight verges."

  #40 (Lucky Garden): "Half the model is one blank pale slab, and the plots
  carry pastel tints with nothing to explain them. Expected: the 'future
  extension' shown as open ground in the board's own flock, and plots in one
  colour unless a key is on the plaque." (The one colour is the face's:
  make_plan_models.py, CHROMA.)

So, here:

  LAND PRINTED GREEN IS OPEN LAND. The tracing called everything that was not
  the one big park a plot: the hedge the sheet draws round the site as a row of
  bushes (the "white strip", white because a plot is plaster), the lawn in the
  corner, the strip beside the last row. Each is printed green on the sheet and
  is the model's flock, not a block of plaster.
  OPEN LAND IS WHOLE. A hole in it is kept only where something stands in it (a
  plot, a road's island); a hole with nothing in it is a symbol the sheet
  prints on the grass, and is filled.
  ITS EDGES ARE STRAIGHT. The bushes along a hedge were traced one by one;
  the outline is drawn again through them (Douglas-Peucker, at more than a
  bush's depth), so a verge is a band with straight sides.
  LAND HELD BACK IS OPEN GROUND, in the same flock, with nothing lettered on
  it (`plain`: the sheet prints "FUTURE EXTENTION" across it).

Nothing is added: no plot the tracing did not find is drawn here. (It did not
find them all - on the Gayatri sheet, plots 1 to 12 among others - and a model
is not the place to guess them: that wants the sanctioned plan's clean
original, which is the client's to supply.)
"""
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FLOOR = os.path.join(ROOT, 'assets', 'floorplans')
PLANS = ('kartikeya', 'lucky', 'gayatri')

# A bush on these sheets stands about a hundredth of the sheet's long side
# proud of its hedge; an outline is redrawn through anything shallower.
STRAIGHTEN = 0.0075
# A "plot" under this share of its sheet's median plot is no plot. Named sheet
# by sheet, because it was looked at sheet by sheet: Gayatri's one (a
# seventeenth of a plot, at the lawn's corner) is a scrap of the road's label
# that the tracing closed into a shape, and stood on the model as a crumb.
STRAY = {'gayatri': 0.1}
# NOT A PLOT: a cell the tracing made of something that is not land for sale,
# named by where it lies on its sheet (x0, y0, x1, y1 of the cell's box, y up).
#   lucky    the approach road: two lines the sheet draws in from its left
#            edge to plot 1, closed into a shape. It carries no number.
NOT_A_PLOT = {'lucky': [(-0.01, 0.48, 0.18, 0.61)]}
# TWO THINGS TRACED AS ONE: where to cut a cell, as a box on the sheet (y up),
# and what the piece inside it is.
#   gayatri  the hedge round the site was traced in one piece with the
#            hatched plots it runs under (148 to 151 and 171 to 173, at the
#            foot of the second block): the hedge is open land, the plots are
#            plots.
SPLIT = {'gayatri': [((0.338, 0.052, 0.462, 0.21), 'plot', (1.0, 0.86, 0.3))]}


def is_green(rgb):
    r, g, b = rgb
    return g > r * 1.08 and g > b * 1.4 and (max(rgb) - min(rgb)) > 0.2


def inside(pt, ring):
    """Even-odd."""
    x, y = pt
    hit = False
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


def centroid(ring):
    return (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))


def area(ring):
    s = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % len(ring)]
        s += x0 * y1 - x1 * y0
    return abs(s) / 2.0


def straighten(ring, w, h):
    """The ring redrawn through its own bumps, in the sheet's pixels (so the
    tolerance is the same along both of its sides)."""
    pts = np.array([[x * w, y * h] for x, y in ring], np.float32).reshape(-1, 1, 2)
    out = cv2.approxPolyDP(pts, STRAIGHTEN * max(w, h), True).reshape(-1, 2)
    if len(out) < 3:
        return ring
    return [[float(x) / w, float(y) / h] for x, y in out]


def cut(cell, box, w, h):
    """A cell in two: the piece of it inside `box`, and the rest."""
    mask = np.zeros((h, w), np.uint8)
    px = lambda ring: np.array([[x * w, (1 - y) * h] for x, y in ring], np.int32)
    cv2.fillPoly(mask, [px(cell['rings'][0])], 255)
    for hole in cell.get('holes') or []:
        cv2.fillPoly(mask, [px(hole)], 0)
    x0, y0, x1, y1 = box
    sel = np.zeros_like(mask)
    sel[int((1 - y1) * h):int((1 - y0) * h), int(x0 * w):int(x1 * w)] = 255
    pieces = []
    for part in (cv2.bitwise_and(mask, sel), cv2.bitwise_and(mask, cv2.bitwise_not(sel))):
        found, _ = cv2.findContours(part, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not found:
            pieces.append(None)
            continue
        ring = max(found, key=cv2.contourArea)
        ring = cv2.approxPolyDP(ring, 1.5, True).reshape(-1, 2)
        pieces.append(([[float(x) / w, 1 - float(y) / h] for x, y in ring], float(cv2.contourArea(max(found, key=cv2.contourArea)))))
    return pieces


def clean(name):
    doc = json.load(open(os.path.join(FLOOR, f'{name}_cells.json')))
    w, h = doc['w'], doc['h']
    cells = [dict(c) for c in doc['cells']]
    # Not plots at all.
    def box_of(c):
        xs = [p[0] for p in c['rings'][0]]
        ys = [p[1] for p in c['rings'][0]]
        return min(xs), min(ys), max(xs), max(ys)
    within = lambda b, o: b[0] >= o[0] and b[1] >= o[1] and b[2] <= o[2] and b[3] <= o[3]
    dropped = [c for c in cells if any(within(box_of(c), o) for o in NOT_A_PLOT.get(name, []))]
    cells = [c for c in cells if c not in dropped]
    # Two things traced as one.
    for box, cat, rgb in SPLIT.get(name, []):
        for c in list(cells):
            b = box_of(c)
            # the cell that reaches right across the box and well beyond it
            if not (b[0] < box[0] and b[2] > box[2] and c.get('area', 0) > 50000):
                continue
            inside_piece, rest = cut(c, box, w, h)
            if not inside_piece or not rest:
                continue
            c['rings'] = [rest[0]]
            c['area'] = rest[1]
            cells.append({'cat': cat, 'rings': [inside_piece[0]], 'holes': [], 'rgb': list(rgb), 'area': inside_piece[1], 'h': 0.016, 'as_traced': True})
            break
    marks = [centroid(c['rings'][0]) for c in cells]
    out = []
    report = {'to_green': 0, 'to_ground': 0, 'holes_filled': 0, 'strays': 0, 'not_plots': len(dropped), 'points_before': 0, 'points_after': 0}
    plots = sorted(c.get('area', 0) for c in cells if c['cat'] in ('plot', 'plot_hot'))
    median = plots[len(plots) // 2] if plots else 0
    for i, c in enumerate(cells):
        c = dict(c)
        cat = c['cat']
        if cat in ('plot', 'plot_hot') and c.get('area', 0) < STRAY.get(name, 0) * median:
            report['strays'] += 1
            continue
        # (a plot the sheet MARKS in a colour is `plot_hot`, and green is one
        # of the Lucky Garden sheet's marks: those stay plots)
        if cat == 'plot' and is_green(c['rgb']):
            cat = 'green'
            report['to_green'] += 1
        if cat == 'pad':
            # Land held back: open ground, in the flock, and nothing on it.
            cat = 'green'
            c['plain'] = True
            report['to_ground'] += 1
        if cat == 'green':
            ring = [list(p) for p in c['rings'][0]]
            # A hole is kept where something stands in it.
            kept = []
            for hole in c.get('holes') or []:
                if any(j != i and inside(marks[j], hole) for j in range(len(cells))):
                    kept.append(hole)
                else:
                    report['holes_filled'] += 1
            report['points_before'] += len(ring)
            ring = straighten(ring, w, h)
            report['points_after'] += len(ring)
            c['rings'] = [ring]
            c['holes'] = [straighten(hh, w, h) for hh in kept]
            c['h'] = 0.006
        c['cat'] = cat
        out.append(c)
    doc['cells'] = out
    path = os.path.join(FLOOR, f'{name}_model_cells.json')
    json.dump(doc, open(path, 'w'), separators=(',', ':'))
    cats = {}
    for c in out:
        cats[c['cat']] = cats.get(c['cat'], 0) + 1
    print(name, cats, report, '->', os.path.relpath(path, ROOT))
    return doc


def preview(name, doc, folder):
    w, h = doc['w'], doc['h']
    s = 1400 / max(w, h)
    img = np.full((int(h * s), int(w * s), 3), (52, 70, 94), np.uint8)  # the board
    order = sorted(doc['cells'], key=lambda c: -c.get('area', 0))
    for c in order:
        colour = {'green': (76, 92, 84), 'plot': (210, 225, 232), 'plot_hot': (190, 205, 215)}.get(c['cat'], (150, 160, 170))
        cv2.fillPoly(img, [np.array([[x * w * s, (1 - y) * h * s] for x, y in c['rings'][0]], np.int32)], colour, cv2.LINE_AA)
        if c['cat'] == 'green':
            for hole in c.get('holes') or []:
                cv2.fillPoly(img, [np.array([[x * w * s, (1 - y) * h * s] for x, y in hole], np.int32)], (52, 70, 94), cv2.LINE_AA)
    for c in order:
        if c['cat'] != 'green':
            cv2.polylines(img, [np.array([[x * w * s, (1 - y) * h * s] for x, y in c['rings'][0]], np.int32)], True, (120, 130, 140), 1, cv2.LINE_AA)
    os.makedirs(folder, exist_ok=True)
    cv2.imwrite(os.path.join(folder, f'{name}_model_cells.png'), img)


def main():
    folder = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    for name in PLANS:
        doc = clean(name)
        if folder:
            preview(name, doc, folder)


if __name__ == '__main__':
    main()
