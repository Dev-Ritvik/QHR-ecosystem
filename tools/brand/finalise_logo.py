#!/usr/bin/env python3
"""
Build the production logo assets from the client's Illustrator export.

    python tools/brand/finalise_logo.py

Reads   assets/brand/logo-illustrator.svg
Writes  apps/public/public/brand/{qhr-logo,qhr-mark,qhr-mark-flat}.svg

The Illustrator file is already correct: real cubic Beziers, two clean fills,
and letter counters as proper compound-path holes. So this does not redraw
anything. It does four things the export cannot do for itself.

1. DROPS THE ARTBOARD FRAME. Element 0 is a 1200x600 rectangle with a second
   ring inside it - the navy keyline box around the artwork. It is packaging,
   not logo, and it would fight every background the mark is ever placed on.

2. RESTORES THE ROOF GRADIENT. Illustrator's Limited-3-colour trace flattened
   it to one navy. The two stops here were eyedropped from the artwork by the
   client: R0 G131 B199 at the apex, R48 G48 B143 at the foot. Rebuilt as a
   real two-stop gradient rather than the banding a higher trace colour count
   would have produced - a gradient wants stops, not more quantisation levels.

3. SPLITS MARK FROM WORDMARK. The mark is the house, the Q and the H stem
   (everything above y=330); the rest is type. Separating them is what makes a
   header lockup, a favicon and a 3D sign possible from one source.

4. EMITS A FLAT MARK. Below roughly 32px the gradient reads as mud because the
   ramp gets three or four pixels to run in. The flat variant is for favicons
   and anywhere the mark is small - standard practice, not a compromise.

Colours are the client's, unchanged: #2f3291 navy, #ec6028 orange.
"""

import os
import re

SRC = "assets/brand/logo-illustrator.svg"
OUT = "apps/public/public/brand"

# Eyedropped from the artwork in Illustrator by the client.
ROOF_TOP = "#0083C7"     # R0 G131 B199
ROOF_BOTTOM = "#30308F"  # R48 G48 B143

# The house path's own vertical extent, so the ramp spans exactly the shape it
# fills. Taken from the measured bbox, not guessed.
HOUSE_Y0, HOUSE_Y1 = 30.0, 217.0

MARK_MAX_Y = 330.0       # clean empty band between the mark and the type

ELEM = re.compile(r"<(path|polygon)\s+([^>]*?)/>", re.S)
ATTR = re.compile(r'(\w[\w-]*)="([^"]*)"')

GRADIENT = (
    '  <defs>\n'
    '    <linearGradient id="qhr-roof" gradientUnits="userSpaceOnUse"\n'
    '                    x1="0" y1="%s" x2="0" y2="%s">\n'
    '      <stop offset="0" stop-color="%s"/>\n'
    '      <stop offset="1" stop-color="%s"/>\n'
    '    </linearGradient>\n'
    '  </defs>\n' % (HOUSE_Y0, HOUSE_Y1, ROOF_TOP, ROOF_BOTTOM)
)


def coords(tag, a):
    """Every on-path point of an element, for bbox and classification."""
    if tag == "polygon":
        n = [float(v) for v in re.findall(r"-?\d*\.?\d+", a["points"])]
        return [(n[i], n[i + 1]) for i in range(0, len(n) - 1, 2)]
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from render_svg import flatten
    return [p for poly in flatten(a["d"]) for p in poly]


def main():
    text = open(SRC, encoding="utf-8").read()
    els = ELEM.findall(text)

    parsed = []
    for tag, attrs in els:
        a = dict(ATTR.findall(attrs))
        pts = coords(tag, a)
        if not pts:
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        parsed.append({
            "tag": tag, "attrs": a,
            "x0": min(xs), "y0": min(ys), "x1": max(xs), "y1": max(ys),
        })

    # 1. drop the artboard frame: the only element spanning the whole canvas
    body = [e for e in parsed if not (e["x1"] - e["x0"] > 1100 and e["y1"] - e["y0"] > 550)]
    print("dropped %d artboard element(s)" % (len(parsed) - len(body)))

    mark = [e for e in body if e["y1"] <= MARK_MAX_Y]
    word = [e for e in body if e["y1"] > MARK_MAX_Y]
    print("mark: %d elements, wordmark: %d elements" % (len(mark), len(word)))

    # 2. the house is the tallest navy shape in the mark -> gets the gradient
    house = max((e for e in mark if e["attrs"].get("fill", "").lower() == "#2f3291"),
                key=lambda e: (e["x1"] - e["x0"]) * (e["y1"] - e["y0"]))
    print("gradient applied to house at (%.0f,%.0f)-(%.0f,%.0f)"
          % (house["x0"], house["y0"], house["x1"], house["y1"]))

    def render(e, gradient=True):
        a = dict(e["attrs"])
        if gradient and e is house:
            a["fill"] = "url(#qhr-roof)"
        if e["tag"] == "polygon":
            return '    <polygon points="%s" fill="%s"/>' % (a["points"], a["fill"])
        return '    <path d="%s" fill="%s"/>' % (a["d"], a["fill"])

    def bbox(group, pad=6):
        x0 = min(e["x0"] for e in group) - pad
        y0 = min(e["y0"] for e in group) - pad
        x1 = max(e["x1"] for e in group) + pad
        y1 = max(e["y1"] for e in group) + pad
        return "%.0f %.0f %.0f %.0f" % (x0, y0, x1 - x0, y1 - y0)

    def doc(groups, view, defs=True):
        rows = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" role="img" '
                'aria-label="Quality Homes Reality">' % view,
                "  <title>Quality Homes Reality</title>"]
        if defs:
            rows.append(GRADIENT.rstrip())
        for label, els_, grad in groups:
            rows.append('  <g id="%s">' % label)
            rows += [render(e, grad) for e in els_]
            rows.append("  </g>")
        rows += ["</svg>", ""]
        return "\n".join(rows)

    os.makedirs(OUT, exist_ok=True)
    files = {
        "qhr-logo.svg": doc([("mark", mark, True), ("wordmark", word, True)], bbox(body)),
        "qhr-mark.svg": doc([("mark", mark, True)], bbox(mark)),
        # flat: no gradient, no defs — for favicons and small sizes
        "qhr-mark-flat.svg": doc([("mark", mark, False)], bbox(mark), defs=False),
    }
    for name, content in files.items():
        path = os.path.join(OUT, name)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
        print("wrote %-20s %5.1f KB" % (name, len(content) / 1024))


if __name__ == "__main__":
    main()
