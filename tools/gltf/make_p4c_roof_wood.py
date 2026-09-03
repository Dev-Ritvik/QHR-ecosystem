"""
P4C - roof slate readability and the dark-wood entrance, as derived textures.

    python tools/gltf/make_p4c_roof_wood.py

ROOF (MAT_Roof_Slate). Phase 2.5B proved the export chain and baked the two
lost multipliers (tint x half-strength AO) and the 0.42..0.82 roughness remap.
This does not regress any of that: it starts from the same sources and the
same maths, then does the three restrained things the brief asks for.
  * Course readability: the AO map IS the slate/joint structure. The authored
    Fac 0.5 gave joints at ~9% depth; here the AO weight is 0.72 - still a
    multiply of the same map, no new detail invented - so the courses survive
    the 2048 -> 1024 -> ETC1S -> mip chain at hero distance.
  * Per-slate variation: the 16-bit height map is a set of plateaus, one per
    slate. Quantising it (with a coarse cell so neighbours at the same level
    still differ) gives a slate id; each id gets a deterministic tone in
    [0.94, 1.06] and a roughness offset in [-0.04, +0.04]. Courses vary,
    individual slates read, nothing is noisy.
  * Colour: 3% toward graphite (R down, B up). Not black: mean linear luma
    stays within ~10% of the P2.5B bake, and that is printed.
  Roughness is written ABSOLUTE (remap applied, 0.42..0.82 plus the per-slate
  offset, clamped 0.40..0.84), so the material ships roughnessFactor 1.0 and
  Blender reads the same map with no MapRange - one representation, and no
  exporter-invisible node left in the chain.

WOOD (MAT_Wood_Dark). The shipped door was a small-plank parquet scan (planks
~12 cm at the door's 1 m/UV) with a flat 0.33 roughness and a flat normal, and
its base colour ran through an object-space mapping and a legacy MIX the
exporter cannot see (P2.5B). Authored fresh as a dark stained oak: continuous
vertical grain (no plank joints - the door's panels are geometry,
door_relief), linear albedo mean ~(0.078, 0.052, 0.034) - a real dark stain,
not black - roughness 0.36..0.56 following the grain (the old flat 0.33 is the
plastic read), and a subtle open-grain normal. Mapped through UV so Blender
and the runtime sample the same thing; door_relief's 0.333 m/UV puts the grain
3x denser on the mouldings than on the slab, which is right for thin members.

All outputs are new files beside the untouched sources.
"""
import numpy as np, os, json
from PIL import Image

R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'materials'))


def to_lin(u8):
    s = u8.astype(np.float64) / 255.0
    return np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)


def to_srgb8(lin):
    lin = np.clip(lin, 0, 1)
    s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return np.clip(np.rint(s * 255), 0, 255).astype(np.uint8)


def l8(x):
    return np.clip(np.rint(np.clip(x, 0, 1) * 255), 0, 255).astype(np.uint8)


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


# ---------------------------------------------------------------- ROOF ----
S = os.path.join(R, 'roof_slate')
base = to_lin(np.asarray(Image.open(os.path.join(S, 'basecolor.png')).convert('RGB')))
ao = np.asarray(Image.open(os.path.join(S, 'ao.png')).convert('L'), np.float64) / 255.0
rough = np.asarray(Image.open(os.path.join(S, 'roughness.png')).convert('L'), np.float64) / 255.0
h = np.asarray(Image.open(os.path.join(S, 'height.png')), np.float64)
h = (h - h.min()) / (h.max() - h.min())
TINT = np.array([0.82, 0.86, 0.94])
AO_FAC = 0.72
occ = (1 - AO_FAC) + AO_FAC * ao
hq = np.rint(h * 24).astype(np.int64)
cell = (np.arange(h.shape[0])[:, None] // 96) * 1000 + (np.arange(h.shape[1])[None, :] // 96)
sid = hq * 7919 + cell
ids, order = np.unique(sid, return_inverse=True)
rg = np.random.default_rng(4103)
tone = rg.uniform(0.94, 1.06, len(ids))[order].reshape(h.shape)
roff = rg.uniform(-0.04, 0.04, len(ids))[order].reshape(h.shape)
out = base * TINT[None, None, :] * occ[..., None] * tone[..., None]
out[..., 0] *= 0.97
out[..., 2] *= 1.03
rough_abs = np.clip(0.42 + 0.40 * rough + roff, 0.40, 0.84)
p25 = base * TINT[None, None, :] * (0.5 + 0.5 * ao)[..., None]
Image.fromarray(to_srgb8(out)).save(os.path.join(S, 'p4c_basecolor.png'), optimize=True)
Image.fromarray(l8(rough_abs)).save(os.path.join(S, 'p4c_roughness.png'), optimize=True)
print(json.dumps({'roof': {
    'p25b_bake_linear_luma': round(float(luma(p25).mean()), 5),
    'p4c_linear_luma': round(float(luma(out).mean()), 5),
    'ratio_to_p25b': round(float(luma(out).mean() / luma(p25).mean()), 3),
    'slate_ids': int(len(ids)),
    'rough_mean': round(float(rough_abs.mean()), 3),
    'rough_min': round(float(rough_abs.min()), 3), 'rough_max': round(float(rough_abs.max()), 3)}}))

# ---------------------------------------------------------------- WOOD ----
RES = 2048


def wrapped_noise(res, fx, fy, rg):
    g = rg.random((fy, fx)).astype(np.float32)
    g = np.vstack([g, g[:1]]); g = np.hstack([g, g[:, :1]])
    tx = np.linspace(0, fx, res, endpoint=False); ty = np.linspace(0, fy, res, endpoint=False)
    ix = np.floor(tx).astype(int); iy = np.floor(ty).astype(int)
    fxr = (tx - ix).astype(np.float32); fyr = (ty - iy).astype(np.float32)
    sx = fxr * fxr * (3 - 2 * fxr); sy = fyr * fyr * (3 - 2 * fyr)
    a = g[iy[:, None], ix[None, :]]; b = g[iy[:, None], ix[None, :] + 1]
    c = g[iy[:, None] + 1, ix[None, :]]; d = g[iy[:, None] + 1, ix[None, :] + 1]
    return (a * (1 - sx[None, :]) + b * sx[None, :]) * (1 - sy[:, None]) + \
           (c * (1 - sx[None, :]) + d * sx[None, :]) * sy[:, None]


rg = np.random.default_rng(4107)
grain = sum(wrapped_noise(RES, 48 * 2 ** i, 3 * 2 ** i, rg) * 0.5 ** i for i in range(4)) / 1.875
grain = (grain - grain.mean()) / (grain.std() + 1e-6)
figure = (wrapped_noise(RES, 6, 2, rg) - 0.5) * 2
pores = np.clip((wrapped_noise(RES, 160, 40, rg) - 0.72) / 0.28, 0, 1)
mean = np.array([0.078, 0.052, 0.034])
tone = 1.0 + 0.10 * np.clip(grain, -2, 2) / 2 + 0.06 * figure - 0.18 * pores
wood = mean[None, None, :] * tone[..., None]
wood[..., 0] *= 1.0 + 0.03 * figure
wood[..., 2] *= 1.0 - 0.03 * figure
wrough = np.clip(0.44 + 0.06 * grain / 2 + 0.10 * pores - 0.03 * figure, 0.36, 0.56)
hgt = -0.6 * pores + 0.08 * grain
dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5 * 4.0
dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5 * 4.0
nx, ny, nz = -dx, dy, np.full_like(hgt, 1 / 48.0)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
nrm = np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5], -1)
W = os.path.join(R, 'wood_dark')
Image.fromarray(to_srgb8(wood)).save(os.path.join(W, 'p4c_basecolor.png'), optimize=True)
Image.fromarray(l8(wrough)).save(os.path.join(W, 'p4c_roughness.png'), optimize=True)
Image.fromarray(l8(nrm)).save(os.path.join(W, 'p4c_normal.png'), optimize=True)
old = to_lin(np.asarray(Image.open(os.path.join(W, 'basecolor.png')).convert('RGB')))
authored = 0.32 * np.array([0.255, 0.165, 0.1]) + 0.68 * old.reshape(-1, 3).mean(0)
print(json.dumps({'wood': {
    'old_raw_linear_luma': round(float(luma(old).mean()), 4),
    'blender_authored_mix_luma': round(float(luma(authored)), 4),
    'p4c_linear_luma': round(float(luma(wood).mean()), 4),
    'p4c_srgb_mean': [int(x) for x in to_srgb8(wood).reshape(-1, 3).mean(0)],
    'rough_mean': round(float(wrough.mean()), 3),
    'rough_range': [round(float(wrough.min()), 3), round(float(wrough.max()), 3)]}}))
