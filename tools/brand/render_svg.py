#!/usr/bin/env python3
"""
Rasterise an SVG so it can actually be looked at.

    python tools/brand/render_svg.py <in.svg> <out.png> [width] [--dark] [--flat]

There is no SVG renderer in this environment, and the first logo attempt
reached the client having never been viewed. So this exists: a small renderer
covering exactly the subset these files use - absolute and relative path
commands, polygons, compound paths, and vertical linear gradients.

Holes are done by XOR across a path's subpaths. Illustrator writes a counter as
a subpath wound opposite to its outer ring, so under non-zero winding it is a
hole; with one level of nesting XOR gives the identical result and needs no
winding-direction bookkeeping.

--dark renders on the site ground, which is where a stray white fringe or a
counter that failed to knock out will show up.
--flat ignores gradients, to check geometry independently of fill.
"""

import re
import sys

import cv2
import numpy as np

SS = 3  # oversample, then area-average down for clean edges

TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE]-?\d+)?")
ELEM = re.compile(r"<(path|polygon)\s+([^>]*?)/>", re.S)
ATTR = re.compile(r'(\w[\w-]*)="([^"]*)"')
VIEWBOX = re.compile(r'viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"')
GRAD = re.compile(r'<linearGradient[^>]*id="([^"]+)"[^>]*>(.*?)</linearGradient>', re.S)
STOP = re.compile(r'<stop[^>]*offset="([\d.]+)"[^>]*stop-color="([^"]+)"', re.S)


def flatten(d):
    """SVG path data -> list of dense polygons, one per subpath."""
    toks = TOKEN.findall(d)
    polys, cur = [], []
    x = y = sx = sy = 0.0
    px = py = 0.0          # previous cubic control, for S
    cmd = None
    args = []

    def close():
        nonlocal cur
        if len(cur) >= 3:
            polys.append(cur)
        cur = []

    def cubic(c1, c2, p):
        nonlocal x, y, px, py
        p0 = (x, y)
        for s in range(1, 17):
            t = s / 16.0
            m = 1 - t
            cur.append((
                m**3 * p0[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t**3 * p[0],
                m**3 * p0[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t**3 * p[1],
            ))
        px, py = c2
        x, y = p

    def run():
        nonlocal x, y, sx, sy, cur, px, py
        rel = cmd.islower()
        c = cmd.upper()
        n = args
        if c == "M":
            for k in range(0, len(n) - 1, 2):
                nx, ny = (x + n[k], y + n[k + 1]) if rel else (n[k], n[k + 1])
                if k == 0:
                    close()
                    sx, sy = nx, ny
                x, y = nx, ny
                cur.append((x, y))
        elif c == "L":
            for k in range(0, len(n) - 1, 2):
                x, y = (x + n[k], y + n[k + 1]) if rel else (n[k], n[k + 1])
                cur.append((x, y))
        elif c == "H":
            for v in n:
                x = x + v if rel else v
                cur.append((x, y))
        elif c == "V":
            for v in n:
                y = y + v if rel else v
                cur.append((x, y))
        elif c == "C":
            for k in range(0, len(n) - 5, 6):
                if rel:
                    c1 = (x + n[k], y + n[k + 1]); c2 = (x + n[k + 2], y + n[k + 3])
                    p = (x + n[k + 4], y + n[k + 5])
                else:
                    c1 = (n[k], n[k + 1]); c2 = (n[k + 2], n[k + 3]); p = (n[k + 4], n[k + 5])
                cubic(c1, c2, p)
        elif c == "S":
            for k in range(0, len(n) - 3, 4):
                c1 = (2 * x - px, 2 * y - py)
                if rel:
                    c2 = (x + n[k], y + n[k + 1]); p = (x + n[k + 2], y + n[k + 3])
                else:
                    c2 = (n[k], n[k + 1]); p = (n[k + 2], n[k + 3])
                cubic(c1, c2, p)
        elif c == "Z":
            if cur:
                cur.append((sx, sy))
            close()
            x, y = sx, sy

    for t in toks:
        if t[0].isalpha():
            if cmd:
                run()
            cmd, args = t, []
        else:
            args.append(float(t))
    if cmd:
        run()
    close()
    return polys


def parse_gradients(text):
    grads = {}
    for gid, body in GRAD.findall(text):
        stops = [(float(o), c) for o, c in STOP.findall(body)]
        if stops:
            grads[gid] = stops
    return grads


def hex_bgr(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (4, 2, 0))


def main():
    src, dst = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    width = next((int(a) for a in args if a.isdigit()), 1200)
    dark = "--dark" in args
    flat = "--flat" in args

    text = open(src, encoding="utf-8").read()
    vx, vy, vw, vh = (float(v) for v in VIEWBOX.search(text).groups())
    scale = width / vw
    W, H = int(round(vw * scale)), int(round(vh * scale))

    grads = parse_gradients(text)
    canvas = np.zeros((H * SS, W * SS, 3), np.uint8)
    canvas[:] = (20, 17, 10) if dark else (255, 255, 255)

    for tag, attrs in ELEM.findall(text):
        a = dict(ATTR.findall(attrs))
        fill = a.get("fill", "#000000")
        if fill == "none":
            continue
        if tag == "polygon":
            nums = [float(n) for n in re.findall(r"-?\d*\.?\d+", a["points"])]
            polys = [[(nums[i], nums[i + 1]) for i in range(0, len(nums) - 1, 2)]]
        else:
            polys = flatten(a["d"])
        polys = [p for p in polys if len(p) >= 3]
        if not polys:
            continue

        mask = np.zeros((H * SS, W * SS), np.uint8)
        for p in polys:
            pts = np.round((np.array(p) - (vx, vy)) * scale * SS).astype(np.int32)
            ring = np.zeros_like(mask)
            cv2.fillPoly(ring, [pts], 255)
            mask = cv2.bitwise_xor(mask, ring)

        ys, xs = np.nonzero(mask)
        if not len(ys):
            continue

        m = re.match(r"url\(#([^)]+)\)", fill)
        if m and not flat and m.group(1) in grads:
            stops = grads[m.group(1)]
            y0, y1 = ys.min(), ys.max()
            span = max(1, y1 - y0)
            # vertical two-stop ramp, evaluated per row
            c0 = np.array(hex_bgr(stops[0][1]), np.float32)
            c1 = np.array(hex_bgr(stops[-1][1]), np.float32)
            for row in range(y0, y1 + 1):
                t = (row - y0) / span
                colour = c0 * (1 - t) + c1 * t
                sel = mask[row] > 0
                canvas[row][sel] = colour.astype(np.uint8)
        else:
            if m:
                stops = grads.get(m.group(1))
                colour = hex_bgr(stops[-1][1]) if stops else (0, 0, 0)
            else:
                colour = hex_bgr(fill)
            canvas[mask > 0] = colour

    out = cv2.resize(canvas, (W, H), interpolation=cv2.INTER_AREA)
    cv2.imwrite(dst, out)
    print("wrote %s (%dx%d)" % (dst, W, H))


if __name__ == "__main__":
    main()
