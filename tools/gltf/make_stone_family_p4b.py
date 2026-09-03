"""
P4B - the stone FAMILY around the P4A limestone: trim, paving, steps, rustic.

    python tools/gltf/make_stone_family_p4b.py

Reuses make_stone_materials.build_set (same seamless coursing, same noise,
same colour-space handling) and writes NEW keys, p4b_<key>_*, beside the
shipped v5 sources, which are never touched.

WHY THESE NUMBERS. The runtime paving grade (x0.32) is retired in P4B, so the
family is authored ONCE, in the material, and measured against Blender for the
first time. Ungraded at HERO: paving +20.6 over reference, steps +87, rustic
+55, fountain trim +15. Steps and rustic are shadow/contact-dominated (the
runtime has no GI), so albedo alone cannot close them - the targets below take
paving to reference level and move steps/rustic as far as an honest material
can (darker, rougher, weathered) without turning them black.

  trim     same colour as v5 (it matched Blender to +0.9 - left alone).
           FINISH differentiation only: a lower, tighter roughness band
           (0.38-0.54) than the wall's 0.55-0.81, fine directional tooling
           in the micro, and a whisper of macro so it stops reading as paint.
  paving   albedo x0.86; joints darker and dirtier; slab tone spread kept;
           roughness 0.55-0.76 with per-slab variation; weathering.
  steps    albedo x0.82; tread wear up; contact dirt at arrises; roughness
           0.42-0.60 (the cleanest, most-handled stone in the set).
  rustic   albedo x0.82; roughness 0.72-0.92; weathering amp up. Uncoursed
           (each block is geometry). No per-block tone here: the 96 blocks
           share 2 meshes, so tone rides the texture's macro mottle instead.
"""
import importlib.util, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('msm', os.path.join(HERE, 'make_stone_materials.py'))
msm = importlib.util.module_from_spec(spec); spec.loader.exec_module(msm)
build_set = msm.build_set
JOINT_C = (0.300, 0.262, 0.198)


def scale(c, k):
    return tuple(round(x * k, 4) for x in c)


report = []
# TRIM - colour kept, finish changed
report.append(build_set(
    "p4b_trim", tile_m=1.20, courses=1, joint_px=0, choices=[1024], seed=41,
    col_lo=(0.528, 0.452, 0.330), col_hi=(0.690, 0.602, 0.446),
    joint_col=JOINT_C, joint_mul=1.0,
    grain_amp=0.040, grain_freq=180, mottle_amp=0.060, mottle_freq=5,
    rough_lo=0.38, rough_hi=0.54, recess=0.0, chamfer=1,
    normal_strength=0.65, wear=0.0, coursed=False))
# PAVING
report.append(build_set(
    "p4b_paving", tile_m=3.60, courses=4, joint_px=4,
    choices=[256, 341, 427], seed=59,
    col_lo=scale((0.402, 0.362, 0.290), 0.86), col_hi=scale((0.570, 0.520, 0.418), 0.86),
    joint_col=(0.140, 0.135, 0.125), joint_mul=0.78,
    grain_amp=0.060, grain_freq=95, mottle_amp=0.11,
    rough_lo=0.55, rough_hi=0.76, joint_rough=0.92, recess=0.30, chamfer=3,
    normal_strength=0.80, wear=0.025, weather_amp=0.14, weather_freq=3))
# STEPS
report.append(build_set(
    "p4b_steps", tile_m=2.40, courses=4, joint_px=4,
    choices=[341, 512], seed=83,
    col_lo=scale((0.492, 0.432, 0.328), 0.82), col_hi=scale((0.662, 0.590, 0.448), 0.82),
    joint_col=(0.150, 0.145, 0.135), joint_mul=0.78,
    grain_amp=0.050, grain_freq=125, mottle_amp=0.080,
    rough_lo=0.42, rough_hi=0.60, joint_rough=0.88, recess=0.26, chamfer=3,
    normal_strength=0.70, wear=0.070, weather_amp=0.08, weather_freq=4))
# RUSTIC
report.append(build_set(
    "p4b_rustic", tile_m=1.10, courses=1, joint_px=0, choices=[1024], seed=23,
    col_lo=scale((0.322, 0.266, 0.184), 0.82), col_hi=scale((0.486, 0.414, 0.288), 0.82),
    joint_col=JOINT_C, joint_mul=1.0,
    grain_amp=0.115, grain_freq=105, mottle_amp=0.14, mottle_freq=6,
    rough_lo=0.72, rough_hi=0.92, recess=0.0, chamfer=1,
    normal_strength=1.10, wear=0.0, weather_amp=0.22, weather_freq=6, coursed=False))
print(json.dumps([{k: r[k] for k in ('key', 'tile_m', 'course_m', 'joint_mm', 'files')} for r in report], indent=1))
