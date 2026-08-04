#!/usr/bin/env python3
"""
Rasterise the cleaned logo so it can be looked at.

    python tools/brand/render_svg.py <in.svg> <out.png> [width] [--dark]

There is no SVG renderer in this environment, and the whole point of this
exercise is that the previous attempt was never viewed before being shown to
anyone. So the paths are flattened and filled with the same maths a browser
would use: cubics sampled, subpaths combined even-odd so counters stay holes,
elements painted in document order.

--dark drops the white artboard so the mark can be checked against the site
ground, where any stray white fringe would show.
"""

import re
import sys

import cv2
import numpy as np

PATH_RE = re.compile(r'<path\s+fill="([^"]+)"\s+fill-rule="evenodd"\s+d="([^"]+)"')
VIEWBOX_RE = re.compile(r'viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"')
SS = 3  # render oversampled, then area-average down for clean antialiasing


def subpaths(d):
    """Flatten every subpath of `d` into a dense polygon."""
    out, cur = [], []
    for tok in re.findall(r"[MCZ][^MCZ]*", d):
        cmd = tok[0]
        nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", tok[1:])]
        if cmd == "M":
            if len(cur) >= 3:
                out.append(cur)
            cur = [(nums[0], nums[1])]
        elif cmd == "C" and cur:
            p0 = cur[-1]
            c1, c2, p3 = (nums[0], nums[1]), (nums[2], nums[3]), (nums[4], nums[5])
            for s in range(1, 17):
                t = s / 16.0
                m = 1 - t
                cur.append((
                    m**3 * p0[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t**3 * p3[0],
                    m**3 * p0[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t**3 * p3[1],
                ))
        elif cmd == "Z":
            if len(cur) >= 3:
                out.append(cur)
            cur = []
    if len(cur) >= 3:
        out.append(cur)
    return out


def main():
    src, dst = sys.argv[1], sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 and not sys.argv[3].startswith("-") else 1200
    dark = "--dark" in sys.argv

    text = open(src, encoding="utf-8").read()
    vx, vy, vw, vh = (float(x) for x in VIEWBOX_RE.search(text).groups())
    scale = width / vw
    W, H = int(round(vw * scale)), int(round(vh * scale))

    bg = (20, 17, 10) if dark else (255, 255, 255)
    canvas = np.zeros((H * SS, W * SS, 3), np.uint8)
    canvas[:] = bg

    for fill, d in PATH_RE.findall(text):
        rgb = fill.lstrip("#")
        colour = tuple(int(rgb[i:i + 2], 16) for i in (4, 2, 0))  # BGR
        rings = subpaths(d)
        if not rings:
            continue
        # even-odd: XOR each ring so nested rings punch holes
        acc = np.zeros((H * SS, W * SS), np.uint8)
        for r in rings:
            pts = np.round((np.array(r) - (vx, vy)) * scale * SS).astype(np.int32)
            one = np.zeros_like(acc)
            cv2.fillPoly(one, [pts], 255)
            acc = cv2.bitwise_xor(acc, one)
        canvas[acc > 0] = colour

    out = cv2.resize(canvas, (W, H), interpolation=cv2.INTER_AREA)
    cv2.imwrite(dst, out)
    print("wrote %s (%dx%d)" % (dst, W, H))


if __name__ == "__main__":
    main()
