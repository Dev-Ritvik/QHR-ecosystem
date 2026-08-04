#!/usr/bin/env python3
"""
Turn the VTracer auto-trace of the Quality Homes Reality logo into a clean,
production vector.

    python tools/brand/vectorise_logo.py <in.svg> <out.svg>

---------------------------------------------------------------------------
What is wrong with the input
---------------------------------------------------------------------------

VTracer ran in polygon mode over a compressed raster, so the file is correct
in every way that matters and unusable in every way that shows:

  * Every contour is a 1-pixel staircase - `L580,16 L577,17 L575,18` - so what
    should be a circle is a 256-sided polygon and every diagonal is a flight
    of stairs. That is what makes it look rough at any size.

  * Each region was sampled independently from a lossy raster, so the twelve
    letters of QUALITY HOMES carry twelve different navies (#30318E, #31338E,
    #32348F, #333591, #373990 ...) and the seven of REALITY carry seven
    oranges. A logo has three colours, not twenty-eight.

The contours are pixel-accurate to the artwork, so everything below is
measured off the client's real mark rather than redrawn by eye.

---------------------------------------------------------------------------
How the staircase is removed
---------------------------------------------------------------------------

In raster space, which is where the problem was created.

Each contour is re-rasterised into its own bounding box at 8x, low-pass
filtered, and re-extracted at the half-intensity crossing. A Gaussian is
exactly the right instrument here: a staircase is the true edge plus
high-frequency square-wave noise, and blurring averages the treads back onto
the diagonal they were quantised from rather than guessing at a replacement.
Re-extracting at 8x then dividing by 8 lands the result on an eighth-pixel
grid, so the output is *more* precise than the integer input, not less.

Sigma is 4 at 8x, i.e. half a pixel at final size. Enough to erase a
one-pixel tread; far too little to visibly round the roof apex or a letter
terminal, which is the failure that would matter.

Curves are then fitted as Catmull-Rom converted to cubic Bezier. That is
closed-form and passes exactly through every sampled point - no least-squares
solve, so no degenerate fit throwing a control point off the artboard, which
is precisely how the first attempt at this failed.

Holes are preserved by keeping each source path's subpaths together under
fill-rule="evenodd". Splitting them into separate elements would fill in
every letter counter.
"""

import re
import sys
from collections import defaultdict

import cv2
import numpy as np

SS = 8          # supersample factor
SIGMA = 4.0     # blur sigma, in supersampled pixels (= 0.5px final)
SIMPLIFY = 0.50 # approxPolyDP epsilon, in final pixels
MARK_MAX_Y = 330

PATH_RE = re.compile(
    r'<path\s+d="([^"]+)"\s+fill="([^"]+)"\s+transform="translate\((-?[\d.]+),(-?[\d.]+)\)"'
)


# --------------------------------------------------------------------------
# Parse
# --------------------------------------------------------------------------

def parse(svg_text):
    """-> [(fill, [np.array of points, ...])] with translates applied."""
    out = []
    for d, fill, tx, ty in PATH_RE.findall(svg_text):
        tx, ty = float(tx), float(ty)
        subs = []
        for chunk in d.split("M")[1:]:
            nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", chunk.rstrip("Z "))]
            pts = np.array(
                [(nums[i] + tx, nums[i + 1] + ty) for i in range(0, len(nums) - 1, 2)],
                dtype=np.float64,
            )
            if len(pts) >= 3:
                subs.append(pts)
        if subs:
            out.append((fill.upper(), subs))
    return out


# --------------------------------------------------------------------------
# Colour
# --------------------------------------------------------------------------

def _hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def classify(fill):
    r, g, b = _hex_to_rgb(fill)
    if r > 200 and g > 200 and b > 200:
        return "paper"
    return "navy" if (b > r and b > g) else "orange"


def canonical_colours(items):
    """
    Collapse the sampled fills to the palette the logo actually has.

    The canonical value per family is an AREA-WEIGHTED median. Weighting by
    area matters: a whole letter is a truer sample of the ink than a four-point
    sliver of compression noise, and an unweighted median lets the slivers vote
    as loudly as the letters.
    """
    buckets = defaultdict(list)
    for fill, subs in items:
        area = sum(abs(cv2.contourArea(s.astype(np.float32))) for s in subs)
        buckets[classify(fill)].append((area, _hex_to_rgb(fill)))

    canon = {}
    for name, samples in buckets.items():
        total = sum(a for a, _ in samples) or 1.0
        chans = []
        for ch in range(3):
            acc, val = 0.0, samples[0][1][ch]
            for a, rgb in sorted(samples, key=lambda s: s[1][ch]):
                acc += a
                if acc >= total / 2:
                    val = rgb[ch]
                    break
            chans.append(val)
        canon[name] = "#%02X%02X%02X" % tuple(chans)

    # Paper is paper; any drift off white is compression, not intent.
    canon["paper"] = "#FFFFFF"
    return canon, buckets


# --------------------------------------------------------------------------
# Smoothing
# --------------------------------------------------------------------------

def smooth_contour(pts):
    """Staircase polygon -> smooth sub-pixel polygon. None if too small."""
    x0, y0 = pts.min(axis=0) - 3
    x1, y1 = pts.max(axis=0) + 3
    w, h = int(np.ceil(x1 - x0)), int(np.ceil(y1 - y0))
    if w < 2 or h < 2:
        return None

    mask = np.zeros((h * SS, w * SS), np.uint8)
    cv2.fillPoly(mask, [np.round((pts - (x0, y0)) * SS).astype(np.int32)], 255)

    k = int(SIGMA * 6) | 1
    mask = cv2.GaussianBlur(mask, (k, k), SIGMA)
    _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

    found, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not found:
        return None
    big = max(found, key=cv2.contourArea)
    if cv2.contourArea(big) < (SS * SS * 4):
        return None

    poly = cv2.approxPolyDP(big, SIMPLIFY * SS, True).reshape(-1, 2).astype(np.float64)
    if len(poly) < 3:
        return None
    return poly / SS + (x0, y0)


COS_CORNER = 0.62   # ~52 degrees: sharper than this is a corner, not a curve


def _tangents(poly):
    """
    Per-vertex tangent for a corner-aware cardinal spline.

    Plain Catmull-Rom takes the tangent at a vertex as (next - prev)/6 no
    matter how sharply the outline turns there. On a logo that is wrong twice
    over: at the roof apex or a letter terminal it rounds the corner off, and
    because the tangent ignores segment length it overshoots hugely when one
    neighbour is far away. Measured, that produced a median deviation of 4-6px
    from the traced outline - a visibly different letterform.

    Two corrections:

      * a vertex whose adjacent segments turn by more than COS_CORNER gets a
        ZERO tangent, so the curve arrives and leaves in a point and the corner
        survives exactly;
      * tangent magnitude is clamped to a third of the SHORTER adjacent
        segment, which is the standard guard against a long neighbour dragging
        the curve outside the polygon.

    A straight run is reproduced exactly: both tangents lie along the edge, so
    the control points land on the line between the endpoints.
    """
    n = len(poly)
    out = []
    for i in range(n):
        p0, p1, p2 = poly[(i - 1) % n], poly[i], poly[(i + 1) % n]
        v1, v2 = p1 - p0, p2 - p1
        l1, l2 = np.linalg.norm(v1), np.linalg.norm(v2)
        if l1 < 1e-9 or l2 < 1e-9:
            out.append(np.zeros(2))
            continue
        d1, d2 = v1 / l1, v2 / l2
        if float(np.dot(d1, d2)) < COS_CORNER:
            out.append(np.zeros(2))            # corner: hold it
            continue
        d = d1 + d2
        dl = np.linalg.norm(d)
        out.append(np.zeros(2) if dl < 1e-9 else (d / dl) * (min(l1, l2) / 3.0))
    return out


def _segments(poly):
    """Yield (p_start, c1, c2, p_end) cubics around the closed outline."""
    n = len(poly)
    T = _tangents(poly)
    for i in range(n):
        p1, p2 = poly[i], poly[(i + 1) % n]
        yield p1, p1 + T[i], p2 - T[(i + 1) % n], p2


def _flatten(poly, steps=10):
    """Sample the curve this poly will actually become."""
    out = []
    for p1, c1, c2, p2 in _segments(poly):
        for s_ in range(steps):
            t = s_ / float(steps)
            m = 1 - t
            out.append(m**3 * p1 + 3 * m * m * t * c1 + 3 * m * t * t * c2 + t**3 * p2)
    return out


def deviation(orig, poly):
    """
    Worst distance, in final pixels, from the emitted CURVE back to the polygon
    it came from.

    Measured on the flattened curve, not on the control points. The control
    points always sit on the curve, so measuring those reported an identical
    0.38px at every simplification tolerance - blind to the only error that
    varies, which is how far the curve bows between the points it kept.

    Measured against the source contour directly rather than by rendering both
    and diffing pixels: the geometry is right here, and a number computed from
    it cannot be wrong about which shape it measured.

    There is a floor. The input is a 1px staircase, so its own treads sit up to
    ~0.5px off the true edge; a curve reporting 0.00 would mean it had faithfully
    reproduced the stairs, which is the thing being removed.
    """
    c = orig.astype(np.float32).reshape(-1, 1, 2)
    return max(
        abs(cv2.pointPolygonTest(c, (float(x), float(y)), True))
        for x, y in _flatten(poly)
    )


def curve_d(poly):
    """Closed path through every measured point, as corner-aware cubics."""
    if len(poly) < 3:
        return None
    parts = ["M%.2f,%.2f" % (poly[0][0], poly[0][1])]
    for _p1, c1, c2, p2 in _segments(poly):
        parts.append("C%.2f,%.2f %.2f,%.2f %.2f,%.2f"
                     % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]))
    parts.append("Z")
    return "".join(parts)


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main():
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as fh:
        items = parse(fh.read())

    canon, buckets = canonical_colours(items)
    print("Sampled fills collapsed to the real palette:")
    for name in ("navy", "orange", "paper"):
        if name in buckets:
            print("  %-6s %2d sampled -> %s" % (name, len(buckets[name]), canon[name]))

    # items[0] is the white artboard, items[1] the navy keyline box around it.
    # Neither is the logo, and both would fight whatever the mark is placed on.
    body = items[2:]

    # ---- smooth every contour, keeping its family and its source element ----
    elements, devs, dropped = [], [], 0
    for idx, (fill, subs) in enumerate(body):
        rings = []
        for pts in subs:
            poly = smooth_contour(pts)
            if poly is None:
                dropped += 1
                continue
            rings.append(poly)
            devs.append(deviation(pts, poly))
        if rings:
            elements.append({"cls": classify(fill), "rings": rings, "idx": idx})

    # ---- turn painted counters into real holes -------------------------------
    #
    # VTracer has no concept of a hole: it paints the inside of a Q as a white
    # SHAPE stacked on top of the navy one. That looks correct on the white
    # artboard it was traced from and falls apart everywhere else - on the dark
    # site every counter lit up as a white blob, and the logo could never be
    # placed over a photograph or reversed to one colour.
    #
    # So each white contour is matched to the coloured contour that encloses it
    # and re-attached as a subpath of it. Under fill-rule="evenodd" a nested
    # subpath is a hole, so the background shows through exactly as it should.
    # Matched by containment rather than by proximity: nesting is the actual
    # relationship, and two adjacent letters can be closer than a letter is to
    # its own counter.
    holes = 0
    solids = [e for e in elements if e["cls"] != "paper"]
    for e in [e for e in elements if e["cls"] == "paper"]:
        for ring in e["rings"]:
            c = ring.mean(axis=0)
            host = None
            for cand in solids:
                outer = cand["rings"][0].astype(np.float32).reshape(-1, 1, 2)
                if cv2.pointPolygonTest(outer, (float(c[0]), float(c[1])), False) >= 0:
                    # smallest enclosing shape wins, so a counter attaches to its
                    # own letter and not to some larger shape that also spans it
                    if host is None or cv2.contourArea(outer) < host[1]:
                        host = (cand, cv2.contourArea(outer))
            if host:
                host[0]["rings"].append(ring)
                holes += 1
        e["rings"] = []

    print("contours: %d smoothed, %d dropped as noise, %d counters knocked out"
          % (len(devs), dropped, holes))
    if devs:
        devs.sort()
        print("deviation from the traced outline: max %.2f px, median %.2f px, "
              "on a 1170px artwork (%.3f%%)"
              % (devs[-1], devs[len(devs) // 2], 100.0 * devs[-1] / 1170))

    mark, word = [], []
    for e in elements:
        if not e["rings"]:
            continue
        ds = [curve_d(r) for r in e["rings"]]
        ds = [d for d in ds if d]
        if not ds:
            continue
        ymid = float(np.mean([r[:, 1].mean() for r in e["rings"]]))
        (mark if ymid < MARK_MAX_Y else word).append((canon[e["cls"]], " ".join(ds)))

    print("elements: %d in mark, %d in wordmark" % (len(mark), len(word)))

    def emit(group, label):
        rows = ['  <g id="%s">' % label]
        for fill, d in group:
            rows.append('    <path fill="%s" fill-rule="evenodd" d="%s"/>' % (fill, d))
        rows.append("  </g>")
        return "\n".join(rows)

    out = "\n".join([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="15 15 1170 570" role="img" '
        'aria-label="Quality Homes Reality">',
        "  <title>Quality Homes Reality</title>",
        emit(mark, "mark"),
        emit(word, "wordmark"),
        "</svg>",
        "",
    ])
    with open(dst, "w", encoding="utf-8") as fh:
        fh.write(out)
    print("wrote %s (%.1f KB)" % (dst, len(out) / 1024))


if __name__ == "__main__":
    main()
