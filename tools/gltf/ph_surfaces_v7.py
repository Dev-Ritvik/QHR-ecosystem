"""
The estate's stone, flags and gravel from scans, in place of the synthesised set.

    python ph_surfaces_v7.py <polyhaven_textures_dir> <outdir>

WHY. The refinement brief (2026-10-03) and both of the audits behind it: at the
distances the camera works at "the mansion reads as ... a game/CG asset", the
stone has "no surface", the ground is flat colour. Measured on the textures
themselves, they were right: make_estate_textures_v7.py draws limestone as a
cloud of 1/f noise a few per cent deep, paving as four flat squares and a
terrace as a marbled wash. That was a deliberate answer to an earlier review
(the first stone was pebbled and patched, "like a skin disease"), and it
overcorrected: nothing a hand or a quarry made is in them. Geometry carries the
house's joints and mouldings; what was missing is what a SURFACE is — the
grain, the trowel and saw marks, the stain that is not noise.

So the surfaces are photographed ones (Poly Haven, CC0), fitted to the colours
the estate was graded with:

  STONE (walls, trim, steps)   white_plaster_02
      Its DETAIL only: the scan's luminance with everything broader than a
      third of the tile taken out (in the frequency domain, so it still tiles),
      laid over the wall's own colour at STONE_DEPTH. No hue from the scan and
      no broad blotches, so no stone is a different colour from its neighbour:
      what arrives is grain and tooling. The scan's normals at a part strength.

  FLAGS (the podium terrace)   large_floor_tiles_02
      The whole scan — the flags, their joints, the weather on them — white
      balanced from its grey to the house's stone.

  GRAVEL (the carriage ring, the avenue, the walks)   floor_pebbles_01
      The whole scan, brought to a raked golden gravel a little under the old
      paving's tone (the approach's copy stands on it).

Colour maps are written sRGB, 1024 px; the ship step sizes and encodes them
(resize_estate_textures_v7.py, encode_ktx2.py).
"""
import os
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "C:/dev/Blender/_polyhaven/textures"
OUT = sys.argv[2] if len(sys.argv) > 2 else "assets/materials/_v7"
N = 1024

# The colours the estate was graded with, scene-linear (the means of the
# synthesised maps these replace).
LIMESTONE = (0.6724, 0.5711, 0.4233)
TRIM = (0.7758, 0.7011, 0.5711)
STEPS = (0.5472, 0.4413, 0.3023)
FLAGS = (0.47, 0.40, 0.30)
GRAVEL = (0.40, 0.325, 0.215)
# How deep the scan's detail goes into the stone, as a fraction of its own.
STONE_DEPTH = {"v7_limestone": 0.55, "v7_trim": 0.4, "v7_paving": 0.6}


def to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def load(stem, kind, mode="RGB"):
    path = os.path.join(SRC, f"{stem}_{kind}_2k.jpg")
    im = Image.open(path).convert(mode).resize((N, N), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64) / 255.0


def save(arr, name, mode="RGB"):
    a = np.clip(arr * 255.0 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(a, mode).save(os.path.join(OUT, name), optimize=True)
    print("wrote", name, a.shape, a.reshape(-1, a.shape[-1] if a.ndim == 3 else 1).mean(0).round(1))


def high_pass(field, lowest):
    """Remove everything broader than `lowest` cycles a tile. Periodic by
    construction, so the result tiles as the scan does."""
    f = np.fft.fft2(field)
    ky = np.fft.fftfreq(field.shape[0])[:, None] * field.shape[0]
    kx = np.fft.fftfreq(field.shape[1])[None, :] * field.shape[1]
    k = np.sqrt(kx * kx + ky * ky)
    # A soft shoulder, so the cut does not ring.
    keep = np.clip((k - lowest * 0.5) / (lowest * 0.5), 0.0, 1.0)
    keep[0, 0] = 0.0
    return np.real(np.fft.ifft2(f * keep))


def normal_map(stem, strength, turn=0):
    n = load(stem, "nor_gl") * 2.0 - 1.0
    for _ in range(turn):
        # A quarter turn of a tangent-space map turns its vectors with it.
        n = np.rot90(n)
        n = np.stack([-n[..., 1], n[..., 0], n[..., 2]], axis=-1)
    n[..., 0] *= strength
    n[..., 1] *= strength
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def stone(name, colour, turn=0):
    """A dressed stone: the house's colour, the scan's grain."""
    depth = STONE_DEPTH[name]
    d = np.rot90(to_lin(load("white_plaster_02", "diff")), turn)
    lum = d @ np.array([0.2126, 0.7152, 0.0722])
    detail = high_pass(lum, 3.0) / lum.mean()
    # The scan's specks are darker than its field: let them be, but no deeper
    # than a stone's own pores.
    detail = np.clip(detail, -0.35, 0.25)
    base = np.array(colour)[None, None, :] * (1.0 + depth * detail[..., None])
    save(to_srgb(base), f"{name}_basecolor.png")
    r = np.rot90(load("white_plaster_02", "rough", "L"), turn)
    rough = 0.8 if name != "v7_trim" else 0.7
    save(np.clip(rough + depth * 0.5 * high_pass(r, 3.0), 0.05, 1.0), f"{name}_roughness.png", "L")
    save(normal_map("white_plaster_02", 0.5 * depth / 0.55, turn), f"{name}_normal.png")


def whole(name, stem, colour, contrast, rough_mean, normal_strength):
    """A scan kept whole, brought to the estate's tone."""
    d = to_lin(load(stem, "diff"))
    mean = d.reshape(-1, 3).mean(0)
    lum = d @ np.array([0.2126, 0.7152, 0.0722])
    lmean = lum.mean()
    # Its own structure about its mean, at `contrast`; its hue pulled most of
    # the way to the target's (a grey flag under a cream house is a different
    # stone; a cream one with the scan's weather on it is the same quarry).
    rel = d / mean[None, None, :]
    rel = 1.0 + contrast * (rel - 1.0)
    out = np.array(colour)[None, None, :] * rel
    save(to_srgb(out), f"{name}_basecolor.png")
    r = load(stem, "rough", "L")
    save(np.clip(rough_mean + (r - r.mean()) * 0.8, 0.05, 1.0), f"{name}_roughness.png", "L")
    save(normal_map(stem, normal_strength), f"{name}_normal.png")
    return lmean


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    stone("v7_limestone", LIMESTONE)
    stone("v7_trim", TRIM, turn=1)
    stone("v7_paving", STEPS, turn=2)
    whole("v7_flags", "large_floor_tiles_02", FLAGS, 0.8, 0.78, 0.8)
    whole("v7_gravel", "floor_pebbles_01", GRAVEL, 0.85, 0.9, 0.9)
