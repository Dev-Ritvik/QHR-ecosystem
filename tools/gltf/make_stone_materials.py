"""
Author the exterior stone material system as seamless tiling textures.

WHY AUTHORED AND NOT SCANNED
    limestone_cream / stone_wall_03 is a granular conglomerate scan - no
    courses, no joints, no blocks. Stretched across a facade it reads exactly
    as the reported "continuous beige granular surface". Masonry has to be
    constructed, so the coursing is generated here and grain is added
    underneath it, never the other way round.

    Governing rule for every set: BLOCK READ BEFORE GRAIN READ. Per-block tonal
    variation and joint contrast always exceed the within-block noise, so the
    eye resolves stonework first and surface second.

SEAMLESS BY CONSTRUCTION
    Every tile is a whole number of courses tall and each course's block lengths
    sum exactly to the tile width, so the pattern wraps. Noise is built on a
    wrapped lattice for the same reason.

REAL-WORLD SCALE
    Each set declares the metres its tile spans; the Blender side divides that
    into each mesh's measured metres-per-UV, so a course is a real course no
    matter how the object was unwrapped.

    python make_stone_materials.py
"""
import numpy as np
from PIL import Image
import os, json

OUT = r"C:\dev\estate\assets\materials\_stone"
os.makedirs(OUT, exist_ok=True)
RES = 1024


# ------------------------------------------------------------------ noise --
def wrapped_noise(res, freq, seed):
    g = np.random.default_rng(seed).random((freq, freq)).astype(np.float32)
    g = np.vstack([g, g[:1]])
    g = np.hstack([g, g[:, :1]])
    t = np.linspace(0, freq, res, endpoint=False)
    i0 = np.floor(t).astype(int)
    f = (t - i0).astype(np.float32)
    s = f * f * (3 - 2 * f)
    sx, sy = s[None, :], s[:, None]
    x0, y0 = i0, i0
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x0 + 1)]
    c = g[np.ix_(y0 + 1, x0)]; d = g[np.ix_(y0 + 1, x0 + 1)]
    return (a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) +
            c * (1 - sx) * sy + d * sx * sy).astype(np.float32)


def fbm(res, base_freq, octaves, seed, gain=0.5):
    out = np.zeros((res, res), np.float32)
    amp, f, norm = 1.0, float(base_freq), 0.0
    for o in range(octaves):
        out += amp * wrapped_noise(res, max(2, int(round(f))), seed + o * 977)
        norm += amp
        amp *= gain
        f *= 2
    return out / norm


def blur(a, k=1):
    out = a.astype(np.float32)
    for _ in range(k):
        out = (out + np.roll(out, 1, 0) + np.roll(out, -1, 0)
               + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 5.0
    return out


def height_to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nx, ny, nz = -dx, dy, np.full_like(h, 1.0 / 48.0)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5], -1)


def to_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def save_rgb(name, arr):
    Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8), "RGB") \
        .save(os.path.join(OUT, name), optimize=True)
    return name


def save_l(name, arr):
    Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8), "L") \
        .save(os.path.join(OUT, name), optimize=True)
    return name


# ------------------------------------------------------- coursed layout ----
def course_lengths(total, choices, rg):
    """Block lengths summing EXACTLY to total, so the course wraps."""
    for _ in range(600):
        seq, s = [], 0
        while s < total:
            c = int(rg.choice(choices))
            if s + c > total:
                break
            seq.append(c); s += c
        if s == total and len(seq) >= 2:
            return seq
    seq, s = [], 0
    base = int(min(choices))
    while s + base <= total:
        seq.append(base); s += base
    if s < total and seq:
        seq[-1] += total - s
    return seq


def masonry_fields(res, courses, joint_px, choices, seed, chamfer):
    """ids, joint mask, per-block tone, per-block roughness, edge ramp."""
    rg = np.random.default_rng(seed)
    ch = res // courses
    ids = np.zeros((res, res), np.int32)
    joint = np.zeros((res, res), np.float32)
    tone = np.zeros((res, res), np.float32)
    rough = np.zeros((res, res), np.float32)
    edge = np.zeros((res, res), np.float32)
    nid = 1
    for c in range(courses):
        y0, y1 = c * ch, (c + 1) * ch
        lens = course_lengths(res, choices, rg)
        shift = int(rg.integers(0, res))
        x = 0
        for L in lens:
            xs = (np.arange(x, x + L) + shift) % res
            tone[y0:y1, xs] = float(np.clip(rg.normal(0.5, 0.23), 0, 1))
            rough[y0:y1, xs] = float(np.clip(rg.normal(0.5, 0.24), 0, 1))
            ids[y0:y1, xs] = nid
            h = max(1, joint_px // 2)
            for k in range(h + 1):
                joint[y0:y1, (xs[0] - k) % res] = 1.0
                joint[y0:y1, (xs[-1] + k) % res] = 1.0
            w = max(1, min(chamfer, L // 2))
            for k in range(w):
                v = 1.0 - k / float(w)
                np.maximum.at(edge, (slice(y0, y1), xs[k]), v)
                np.maximum.at(edge, (slice(y0, y1), xs[-1 - k]), v)
            x += L; nid += 1
        h = max(1, joint_px // 2)
        for k in range(h + 1):
            joint[(y0 - k) % res, :] = 1.0
            joint[(y1 - 1 + k) % res, :] = 1.0
        w = max(1, min(chamfer, ch // 2))
        for k in range(w):
            v = 1.0 - k / float(w)
            np.maximum.at(edge, ((y0 + k) % res, slice(None)), v)
            np.maximum.at(edge, ((y1 - 1 - k) % res, slice(None)), v)
    return ids, joint, tone, rough, edge


# ---------------------------------------------------------------- builder --
def build_set(key, tile_m, courses, joint_px, choices, seed,
              col_lo, col_hi, joint_col, joint_mul=0.80,
              grain_amp=0.055, grain_freq=110, mottle_amp=0.075, mottle_freq=6,
              rough_lo=0.55, rough_hi=0.78, joint_rough=0.90,
              recess=0.42, chamfer=4, normal_strength=1.0,
              wear=0.045, weather_amp=0.0, weather_freq=4, coursed=True):
    res = RES
    if coursed:
        ids, joint, tone, brough, edge = masonry_fields(
            res, courses, joint_px, choices, seed, chamfer)
        joint = blur(joint, 1)
        edge = blur(edge, 1)
    else:
        ids = np.zeros((res, res), np.int32)
        joint = np.zeros((res, res), np.float32)
        tone = fbm(res, 3, 3, seed + 11)
        brough = fbm(res, 4, 3, seed + 29)
        edge = np.zeros((res, res), np.float32)

    grain = fbm(res, grain_freq, 4, seed + 101) - 0.5
    mottle = fbm(res, mottle_freq, 4, seed + 211) - 0.5
    weather = fbm(res, weather_freq, 4, seed + 307)

    # ---- base colour: block tone dominates, grain sits under it -----------
    lo = np.array(col_lo, np.float32)
    hi = np.array(col_hi, np.float32)
    base = lo[None, None, :] + (hi - lo)[None, None, :] * tone[..., None]
    base *= (1.0 + mottle_amp * mottle)[..., None]
    base *= (1.0 + grain_amp * grain)[..., None]
    if weather_amp > 0:
        stain = np.clip((weather - 0.42) * 2.2, 0, 1) * weather_amp
        base *= (1.0 - stain * 0.55)[..., None]
        base += (stain * 0.02)[..., None]
    # arrises catch light: a whisper, not a bevel highlight
    base *= (1.0 + wear * edge)[..., None]
    # vary joint darkness so the coursing does not read as a printed grid
    jvar = 1.0 - 0.30 * (fbm(res, 9, 3, seed + 613) - 0.5) * 2.0
    jm = (joint * np.clip(jvar, 0.55, 1.25))[..., None]
    jm = np.clip(jm, 0.0, 1.0)
    base = base * (1 - jm) + (np.array(joint_col, np.float32)[None, None, :]
                              * joint_mul) * jm

    # ---- height -> normal: masonry relief, not gravel ---------------------
    h = np.ones((res, res), np.float32)
    h -= joint * recess
    h += 0.030 * (fbm(res, 26, 3, seed + 401) - 0.5)      # block face waviness
    h += 0.012 * grain                                     # fine tooth
    h -= 0.035 * edge                                      # arris softening
    if weather_amp > 0:
        h -= 0.02 * np.clip((weather - 0.5) * 2, 0, 1)
    h = blur(h, 1)
    nrm = height_to_normal(h, normal_strength)

    # ---- roughness: per-block, joints rougher ----------------------------
    rough = rough_lo + (rough_hi - rough_lo) * brough
    rough += 0.05 * grain
    rough = rough * (1 - joint) + joint_rough * joint
    if weather_amp > 0:
        rough += 0.10 * np.clip((weather - 0.5) * 2, 0, 1) * weather_amp * 4
    rough = np.clip(rough, 0.18, 0.98)

    files = {
        "basecolor": save_rgb("%s_basecolor.png" % key, to_srgb(base)),
        "normal":    save_rgb("%s_normal.png" % key, nrm),
        "roughness": save_l("%s_roughness.png" % key, rough),
    }
    px_mm = tile_m / res * 1000.0
    return {"key": key, "tile_m": tile_m, "courses": courses,
            "course_m": round(tile_m / courses, 3) if coursed else None,
            "joint_mm": round(joint_px * px_mm, 1) if coursed else None,
            "mm_per_px": round(px_mm, 2),
            "block_len_m": [round(c * tile_m / res, 2) for c in choices] if coursed else None,
            "files": files}


# ------------------------------------------------------------------ sets ---
# Warm cream limestone, linear values. Trim sits a touch lighter and cleaner,
# the rusticated base a touch darker and dirtier - that is the hierarchy.
CREAM_LO = (0.452, 0.374, 0.258)
CREAM_HI = (0.668, 0.578, 0.404)
JOINT_C = (0.300, 0.262, 0.198)

def main():
    """Build every set. Guarded so P4B can IMPORT the machinery above without
    re-running (and overwriting) the shipped v5 stone sources."""
    report = []

    # 1. MAIN WALL - 8 courses of 405mm over a 3.24m tile, 16mm joints
    report.append(build_set(
        "wall", tile_m=3.24, courses=8, joint_px=7,
        choices=[256, 320, 384, 448], seed=7,
        col_lo=CREAM_LO, col_hi=CREAM_HI, joint_col=JOINT_C, joint_mul=0.88,
        rough_lo=0.54, rough_hi=0.78, recess=0.44, chamfer=4,
        normal_strength=1.05, wear=0.050,
        grain_amp=0.105, grain_freq=120, mottle_amp=0.135, mottle_freq=7))

    # 2. RUSTICATED BASE - the 96 rustic_* blocks are each ONE physical block
    #    (~0.7 x 0.34m), so the coursing is already geometric. Printing a coursed
    #    pattern on top would give every block its own sub-courses, which is the
    #    classic tell of a wall texture dragged onto masonry. This is therefore a
    #    stone SURFACE: darker than the wall, rougher, more weathered, with the
    #    joint definition coming from the geometry gaps and the baked contact AO.
    report.append(build_set(
        "rustic", tile_m=1.10, courses=1, joint_px=0, choices=[1024], seed=23,
        col_lo=(0.322, 0.266, 0.184), col_hi=(0.486, 0.414, 0.288),
        joint_col=JOINT_C, joint_mul=1.0,
        grain_amp=0.115, grain_freq=105, mottle_amp=0.105, mottle_freq=6,
        rough_lo=0.66, rough_hi=0.90, recess=0.0, chamfer=1,
        normal_strength=1.10, wear=0.0,
        weather_amp=0.15, weather_freq=6, coursed=False))

    # 3. ARCHITECTURAL TRIM - dressed and carved, NOT coursed. A cornice is not the
    #    wall extruded, so it gets no block pattern at all: finer, cleaner, smoother.
    report.append(build_set(
        "trim", tile_m=1.20, courses=1, joint_px=0, choices=[1024], seed=41,
        col_lo=(0.528, 0.452, 0.330), col_hi=(0.690, 0.602, 0.446),
        joint_col=JOINT_C, joint_mul=1.0,
        grain_amp=0.052, grain_freq=150, mottle_amp=0.075, mottle_freq=9,
        rough_lo=0.40, rough_hi=0.58, recess=0.0, chamfer=1,
        normal_strength=0.55, wear=0.0, coursed=False))

    # 4. PAVING - large-format slabs, 900mm, restrained joints, flatter
    report.append(build_set(
        "paving", tile_m=3.60, courses=4, joint_px=4,
        choices=[256, 341, 427], seed=59,
        col_lo=(0.402, 0.362, 0.290), col_hi=(0.570, 0.520, 0.418),
        joint_col=(0.190, 0.186, 0.176), joint_mul=0.88,
        grain_amp=0.075, grain_freq=95, mottle_amp=0.10,
        rough_lo=0.48, rough_hi=0.70, recess=0.26, chamfer=3,
        normal_strength=0.75, wear=0.030, weather_amp=0.10, weather_freq=3))

    # 5. STEPS / ENTRANCE - cleanest stone, tread wear, darker contact at arrises
    report.append(build_set(
        "steps", tile_m=2.40, courses=4, joint_px=4,
        choices=[341, 512], seed=83,
        col_lo=(0.492, 0.432, 0.328), col_hi=(0.662, 0.590, 0.448),
        joint_col=(0.200, 0.194, 0.180), joint_mul=0.86,
        grain_amp=0.062, grain_freq=125, mottle_amp=0.085,
        rough_lo=0.36, rough_hi=0.56, recess=0.24, chamfer=3,
        normal_strength=0.70, wear=0.055, weather_amp=0.06, weather_freq=4))

    print("###STONE###")
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
