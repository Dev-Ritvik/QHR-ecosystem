"""The estate's LIGHTING environment, v9: the v7 copy with its ground re-toned.

The paid audit of 2026-10-04 (pass 1, light): "subtle bounced/environmental
light ... less separation between illuminated and unilluminated surfaces".
The sky's fill was raised to open the shadows (WorldCanvas, GRADE_LOOK), and
with it the lower hemisphere of the lighting copy came up too: a saturated
lawn green (74, 88, 44), which put a green cast on every shaded wall
(measured on the west flank: 60, 67, 66). The house does not stand on lawn
alone: its walls look out on a pale flagged terrace, a gravel forecourt and
clipped turf. What they throw back is a warm olive-grey, so that is what the
lower hemisphere carries now, and the stone's shade prints as stone.

    python tools/gltf/make_env_v9.py
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, '..', '..', 'apps', 'public', 'public', 'textures')
SRC = os.path.join(TEX, 'sky_estate_v7_env.jpg')
OUT = os.path.join(TEX, 'sky_estate_v9_env.jpg')
BOUNCE = (92, 88, 68)


def to_lin(v):
    v = np.asarray(v, dtype=np.float64) / 255.0
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def to_srgb(v):
    v = np.clip(v, 0, 1)
    return np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)


img = np.asarray(Image.open(SRC).convert('RGB'))
H, W, _ = img.shape
env = to_lin(img)
v = (np.arange(H) + 0.5) / H
dy = np.sin((0.5 - v) * np.pi)[:, None]
t = np.clip(-dy / 0.12, 0, 1) ** 0.8
horizon = env[H // 2 - 1][None, :, :]
ground = horizon * (1 - t[..., None]) + to_lin(BOUNCE)[None, None, :] * t[..., None]
env = np.where((dy < 0)[..., None], ground, env)
Image.fromarray((to_srgb(env) * 255 + 0.5).astype(np.uint8), 'RGB').save(OUT, quality=90, optimize=True)
print('ENV', OUT, (H, W), 'bounce', BOUNCE)
