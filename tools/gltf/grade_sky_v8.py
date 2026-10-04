"""Grade the estate's photographed sky for the second art-direction audit.

    python grade_sky_v8.py <in: sky_estate_v7_4k.jpg> <out: sky_estate_v8_4k.jpg>

The audit (2026-09-30): "the sky environment looks a bit muddy", and the scrims
behind the copy were removed, so the upper sky - where the navigation, the
eyebrows and the hero's headline sit - has to be dark enough to hold ivory type
on its own. A real clear sky at golden hour is darkest and most saturated at
the zenith and pales toward the sun and the horizon; the shipped equirect
(make_sky_ph_v7.py) is close to flat in value from 20 degrees up. So, above the
horizon only (the half below it is behind the terrain):

  * value falls with elevation, from 1.0 at 6 degrees to ZENITH_GAIN by 55,
    and less toward the sun's own azimuth, so its glow is kept;
  * saturation rises with it, up to +ZENITH_SAT, so the fall reads as deeper
    blue rather than as grey;
  * a gentle S about the clouds' mid-tones, so their lit edges separate from
    the blue instead of dissolving into it.

Only the background plate changes. The lighting environment
(sky_estate_v7_env.jpg) is left exactly as it was, so no surface in the scene
is lit any differently.
"""
import sys

import cv2
import numpy as np

ZENITH_GAIN = 0.62
ZENITH_SAT = 0.16
SUN_KEEP = 0.55  # how much of the darkening is withheld on the sun's azimuth


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def main(src, dst):
    img = cv2.imread(src, cv2.IMREAD_COLOR).astype(np.float32) / 255.0
    h, w, _ = img.shape
    rows = (np.arange(h, dtype=np.float32) + 0.5) / h
    elev = (0.5 - rows) * 180.0  # degrees above the horizon
    fall = smoothstep(6.0, 55.0, elev)[:, None]

    # The sun's azimuth: the brightest column in the band 3..20 degrees up.
    band = img[int(h * (0.5 - 20 / 180)) : int(h * (0.5 - 3 / 180))].mean(axis=(0, 2))
    sun_col = int(np.argmax(cv2.GaussianBlur(band[None, :], (0, 0), w / 90)[0]))
    cols = np.arange(w, dtype=np.float32)
    d = np.minimum(np.abs(cols - sun_col), w - np.abs(cols - sun_col)) / w * 360.0
    near_sun = np.exp(-(d / 38.0) ** 2)[None, :]

    k = fall * (1.0 - SUN_KEEP * near_sun)
    k = np.where(elev[:, None] > 0, k, 0.0)

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hsv[..., 1] = np.clip(hsv[..., 1] * (1.0 + ZENITH_SAT * k), 0, 1)
    v = hsv[..., 2]
    # an S about the mid-tones, weighted by how far up the sky the pixel is
    s_curve = v + 0.18 * k * (smoothstep(0.0, 1.0, v) - v)
    hsv[..., 2] = np.clip(s_curve * (1.0 - (1.0 - ZENITH_GAIN) * k), 0, 1)
    out = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    cv2.imwrite(dst, np.clip(out * 255.0 + 0.5, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(f"graded {src} -> {dst}; sun column {sun_col} of {w}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
