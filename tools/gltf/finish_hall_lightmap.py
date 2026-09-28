r"""
Finish a raw hall lightmap bake into the shipped atlas.

    python finish_hall_lightmap.py <bake_dir> <out_png> [--scale S] [--no-oidn]

Reads <bake_dir>/lightmap_raw.npy and normal_raw.npy, written by
tools/blender/rebake_hall_lightmap_v7.py (float16, top-down, linear
irradiance), and writes the 8-bit sRGB atlas that interior_hall.glb carries in
its occlusion slot. Then encode it (UASTC, see the note at the bottom) and put
it into the GLB with glb_replace_image.py.

THE STEPS, AND WHY EACH IS THERE

1. DENOISE with Intel Open Image Denoise, the same library Cycles uses for
   renders (Cycles does not denoise bakes). It runs through ctypes on the DLL
   Blender already ships, on the CPU device, with two guides:
     albedo  the island mask (1 inside a baked island, 0 in the empty atlas),
             so light is never smeared across an island's edge into nothing;
     normal  the baked object-space normals, so creases inside an island (a
             coffer's inner corner, a moulding's fillet) stay creases.
2. DILATE the islands into the whole empty atlas (push-pull). The GPU samples
   a coarser mip as a wall recedes, and a coarse mip averages an island with
   its surroundings: with black surroundings, every island grows a dark rim at
   distance. Filled with the island's own light, the rim cannot form.
3. NORMALISE by the 99.5th percentile of the lit texels, the convention
   bake_lightmap.py established; the divisor is printed and must become
   LIGHTMAP_INTENSITY in HallModel.tsx (and the manifest). --scale pins it.
4. sRGB-ENCODE and quantise with a half-LSB triangular dither, so the smooth
   gradients of a lamplit wall do not band at 8 bits.
"""
import argparse
import ctypes
import os

import cv2
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
BLENDER_SHARED = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.shared"

ap = argparse.ArgumentParser()
ap.add_argument("bake_dir")
ap.add_argument("out_png")
ap.add_argument("--scale", type=float, default=None)
ap.add_argument("--no-oidn", action="store_true")
args = ap.parse_args()

rgb = np.load(os.path.join(args.bake_dir, "lightmap_raw.npy")).astype(np.float32)
H, W, _ = rgb.shape
nrm_path = os.path.join(args.bake_dir, "normal_raw.npy")
normal_raw = np.load(nrm_path).astype(np.float32) if os.path.exists(nrm_path) else None
# COVERAGE comes from the normal pass, never from the light. A texel on an
# island that receives no light (a moulding's underside, the wall behind a
# panel) bakes to exactly 0, the same value as the empty atlas; judged by its
# light it would be "empty", and the fill below would paint it bright - which
# is how the first finish of this bake came out: black-and-bright speckle on
# every shadowed surface. The normal pass encodes (n + 1) / 2, which is never 0
# on a covered texel.
if normal_raw is not None:
    mask = (normal_raw.max(axis=2) > 1e-3).astype(np.float32)
else:
    print("WARNING: no normal_raw.npy - coverage guessed from light; shadowed texels will be filled")
    mask = (rgb.max(axis=2) > 1e-5).astype(np.float32)
print("atlas %dx%d, islands %.1f%%" % (W, H, 100 * mask.mean()))


def oidn_denoise(color, albedo, normal):
    os.add_dll_directory(BLENDER_SHARED)
    lib = ctypes.CDLL(os.path.join(BLENDER_SHARED, "OpenImageDenoise.dll"))
    vp = ctypes.c_void_p
    lib.oidnNewDevice.restype = vp
    lib.oidnNewDevice.argtypes = [ctypes.c_int]
    lib.oidnCommitDevice.argtypes = [vp]
    lib.oidnNewFilter.restype = vp
    lib.oidnNewFilter.argtypes = [vp, ctypes.c_char_p]
    lib.oidnSetSharedFilterImage.argtypes = [vp, ctypes.c_char_p, vp, ctypes.c_int,
                                             ctypes.c_size_t, ctypes.c_size_t,
                                             ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t]
    lib.oidnSetFilterBool.argtypes = [vp, ctypes.c_char_p, ctypes.c_bool]
    lib.oidnSetFilterInt.argtypes = [vp, ctypes.c_char_p, ctypes.c_int]
    lib.oidnCommitFilter.argtypes = [vp]
    lib.oidnExecuteFilter.argtypes = [vp]
    lib.oidnGetDeviceError.restype = ctypes.c_int
    lib.oidnGetDeviceError.argtypes = [vp, ctypes.POINTER(ctypes.c_char_p)]
    FLOAT3 = 3
    CPU = 1  # shared host buffers need the CPU device

    color = np.ascontiguousarray(color, dtype=np.float32)
    albedo = np.ascontiguousarray(albedo, dtype=np.float32)
    normal = np.ascontiguousarray(normal, dtype=np.float32)
    out = np.zeros_like(color)
    dev = lib.oidnNewDevice(CPU)
    lib.oidnCommitDevice(dev)
    f = lib.oidnNewFilter(dev, b"RT")
    h, w, _ = color.shape
    for name, arr in ((b"color", color), (b"albedo", albedo), (b"normal", normal), (b"output", out)):
        lib.oidnSetSharedFilterImage(f, name, arr.ctypes.data, FLOAT3, w, h, 0, 0, 0)
    lib.oidnSetFilterBool(f, b"hdr", True)
    lib.oidnSetFilterBool(f, b"cleanAux", True)   # baked guides carry no noise
    lib.oidnSetFilterInt(f, b"quality", 6)          # OIDN_QUALITY_HIGH
    lib.oidnCommitFilter(f)
    lib.oidnExecuteFilter(f)
    msg = ctypes.c_char_p()
    err = lib.oidnGetDeviceError(dev, ctypes.byref(msg))
    if err:
        raise SystemExit("OIDN error %d: %s" % (err, msg.value))
    return out


if not args.no_oidn:
    normal = normal_raw * 2.0 - 1.0 if normal_raw is not None else np.zeros_like(rgb)
    normal *= mask[..., None]
    albedo = np.repeat(mask[..., None], 3, axis=2)
    rgb = oidn_denoise(rgb, albedo, normal) * mask[..., None]
    print("denoised")


def push_pull(img, m):
    """Fill every empty texel from the nearest islands, smoothly, by building a
    mask-weighted pyramid down to 1x1 and pulling coarse values back up into
    the holes."""
    levels = []
    c, w = img * m[..., None], m.copy()
    while min(c.shape[:2]) > 1:
        levels.append((c, w))
        c = cv2.resize(c, (c.shape[1] // 2, c.shape[0] // 2), interpolation=cv2.INTER_AREA)
        w = cv2.resize(w, (w.shape[1] // 2, w.shape[0] // 2), interpolation=cv2.INTER_AREA)
    fill = c / np.maximum(w, 1e-8)[..., None]
    for c, w in reversed(levels):
        up = cv2.resize(fill, (c.shape[1], c.shape[0]), interpolation=cv2.INTER_LINEAR)
        known = c / np.maximum(w, 1e-8)[..., None]
        a = np.clip(w, 0, 1)[..., None]
        fill = known * a + up * (1 - a)
    return fill


# Filled only within a band round the islands, not across the whole atlas: 32 px
# protects every mip down to 1/32 resolution, further than a wall is ever
# sampled, and the empty atlas beyond stays black — which is what zstd
# compresses to nothing. Filling it all cost 3.7 MB of UASTC for texels no
# fragment reads.
BAND = 32
band = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=BAND) > 0
rgb = np.where(mask[..., None] > 0, rgb, np.where(band[..., None], push_pull(rgb, mask), 0.0))
print("dilated (%d px band)" % BAND)

lit = rgb[mask > 0]
lit = lit[lit.max(axis=1) > 1e-4]
scale = args.scale or float(np.percentile(lit, 99.5))
print("SCALE %.4f  (LIGHTMAP_INTENSITY)" % scale)
v = np.clip(rgb / scale, 0.0, 1.0)
s = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(np.maximum(v, 1e-8), 1 / 2.4) - 0.055)
rng = np.random.default_rng(7)
dither = (rng.random(s.shape, dtype=np.float32) - rng.random(s.shape, dtype=np.float32)) * 0.5
q = np.clip(np.floor(s * 255.0 + 0.5 + dither), 0, 255).astype(np.uint8)
Image.fromarray(q).save(args.out_png)
print("wrote", args.out_png)
# Encode: UASTC, not ETC1S. ETC1S's shared codebook turns a lamplit wall's
# gentle chroma into pink and green 4x4 blocks; UASTC is BC7-class per block.
#   ktx create --format R8G8B8_SRGB --assign-tf srgb --generate-mipmap
#       --encode uastc --uastc-quality 2 --uastc-rdo --uastc-rdo-l 1.5 --zstd 20 in.png out.ktx2
