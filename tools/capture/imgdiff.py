"""
Compare two capture sets, ALWAYS against a same-candidate control.

    python imgdiff.py <controlA> <controlB> <candidate>

Phase 5 established that this renderer is not frame-deterministic: two captures
of the SAME build at the same pose differ by a mean absolute pixel difference
around 0.07 with a few thousand pixels above 8. So a raw difference between two
builds is meaningless on its own — it has to be read against how much the build
differs from ITSELF. A p5k-vs-p5m diff once looked like a real quality change
(max 94-126, ~0.5% of pixels) until the control showed the same candidate
differing MORE.

controlA and controlB must be two runs of the same build; candidate is the run
of the other build. Every metric is printed for both pairs side by side, and the
verdict is a comparison of the two, never a comparison against zero.
"""
import sys
import os
import numpy as np
from PIL import Image


def load(p):
    im = Image.open(p).convert('RGB')
    return np.asarray(im).astype(np.int16)


def stats(a, b):
    if a.shape != b.shape:
        return None
    d = np.abs(a - b)
    flat = d.max(axis=2)          # per-pixel max across channels
    return {
        'mean': float(d.mean()),
        'maxAbs': int(d.max()),
        'px_gt8': int((flat > 8).sum()),
        'px_gt32': int((flat > 32).sum()),
        'pct_gt8': 100.0 * float((flat > 8).sum()) / flat.size,
    }


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    ca, cb, cand = sys.argv[1:4]
    names = sorted(n for n in os.listdir(ca) if n.endswith('.png'))

    print('%-20s | %-28s | %-28s | verdict' % ('frame', 'CONTROL (same build, 2 runs)', 'CANDIDATE (A vs B)'))
    print('-' * 108)
    worse = []
    for n in names:
        pa, pb, pc = os.path.join(ca, n), os.path.join(cb, n), os.path.join(cand, n)
        if not (os.path.exists(pb) and os.path.exists(pc)):
            continue
        A, B, C = load(pa), load(pb), load(pc)
        ctl = stats(A, B)
        can = stats(C, B)
        if ctl is None or can is None:
            print('%-20s | SIZE MISMATCH' % n)
            continue
        # "Below the noise floor" means EITHER the candidate difference is no
        # larger than the build's own run-to-run difference, OR it is negligible
        # in absolute terms.
        #
        # The absolute floor is not a convenience. A pure ratio test divides by
        # the control, and where the control is ~0 — which is exactly what a
        # time-pinned capture of a static interior produces — any nonzero
        # candidate value fails it. That flagged four frames as regressions when
        # the largest of them differed in EIGHT pixels out of 1.28 million, by
        # at most 23/255. A test that cannot return "identical" is not a test.
        #
        # 0.01 mean and 200 pixels are read against a 1424x900 frame: 200 px is
        # 0.016% of it, and at that count a difference cannot be a lighting or
        # material change — those move regions, not scattered pixels.

        negligible = can['mean'] < 0.01 and can['px_gt8'] < 200
        within = (can['mean'] <= ctl['mean'] * 1.15
                  and can['px_gt8'] <= max(ctl['px_gt8'] * 1.15, ctl['px_gt8'] + 200))
        below = negligible or within

        if not below:
            worse.append(n)
        print('%-20s | mean %6.4f  max %3d  >8 %6d | mean %6.4f  max %3d  >8 %6d | %s' % (
            n, ctl['mean'], ctl['maxAbs'], ctl['px_gt8'],
            can['mean'], can['maxAbs'], can['px_gt8'],
            'below noise' if below else 'ABOVE NOISE'))

    print()
    if worse:
        print('FRAMES ABOVE THE NOISE FLOOR: %s' % ', '.join(worse))
    else:
        print('Every frame is within the build\'s own run-to-run repeatability.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
