"""The pool's ripple: a seamless normal map, for exteriorWater.ts (RIPPLE).

    python tools/gltf/make_water_ripple.py <out.png> [px]

Water in a walled garden on a still evening is not the ocean's long waves: it is
small wind-driven ripples, a hand across, crossing each other, with a little longer
swell under them. So a height field is drawn in the frequency domain, which is what
makes it tile: random phases under a band-limited spectrum (a peak at the ripple's
wavelength and a soft fall-off above it), slightly stretched along the wind so the
crests have a direction. Its slope is written to red and green, 0.5 being flat, and
scaled so that the steepest one in a thousand reaches the edge of the range.

Seeded: the same file every time.
"""
import sys

import numpy as np
from PIL import Image

OUT = sys.argv[1]
PX = int(sys.argv[2]) if len(sys.argv) > 2 else 512
rng = np.random.default_rng(23)

fy = np.fft.fftfreq(PX)[:, None] * PX
fx = np.fft.fftfreq(PX)[None, :] * PX
# along and across the wind (24 degrees off the tile's axis): crests a little longer
# than they are wide
ang = np.radians(24.0)
u = fx * np.cos(ang) + fy * np.sin(ang)
v = -fx * np.sin(ang) + fy * np.cos(ang)
k = np.sqrt(u * u + (v * 1.5) ** 2)
# a tile holds some 14 ripples at their peak, with a longer swell a fifth as tall
peak = 14.0
amp = np.exp(-((np.log(np.maximum(k, 1e-3) / peak)) ** 2) / (2 * 0.55 ** 2)) / np.maximum(k, 1.0) ** 1.1
amp += 0.35 * np.exp(-((np.log(np.maximum(k, 1e-3) / 3.5)) ** 2) / (2 * 0.4 ** 2)) / np.maximum(k, 1.0) ** 0.6
amp[0, 0] = 0.0
spec = amp * np.exp(2j * np.pi * rng.random((PX, PX)))
h = np.fft.ifft2(spec).real
# the slope in the frequency domain: exact and seamless
dx = np.fft.ifft2(spec * 2j * np.pi * fx / PX).real * PX
dy = np.fft.ifft2(spec * 2j * np.pi * fy / PX).real * PX
scale = np.percentile(np.abs(np.concatenate([dx.ravel(), dy.ravel()])), 99.9)
r = np.clip(dx / scale * 0.5 + 0.5, 0.0, 1.0)
g = np.clip(dy / scale * 0.5 + 0.5, 0.0, 1.0)
img = np.stack([r, g, np.full_like(r, 0.5)], axis=-1)
Image.fromarray((img * 255.0 + 0.5).astype(np.uint8), 'RGB').save(OUT, optimize=True)
print('ripple', OUT, PX, 'mean', float(r.mean()), float(g.mean()))
