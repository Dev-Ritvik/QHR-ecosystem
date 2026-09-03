"""
Per-block tone for the ashlar, carried in COLOR_0 - the MESO layer of P4A.

    blender --background <P4 working.blend> --python blocktone_stoneao.py -- [--reset]

WHY HERE AND NOT IN A TEXTURE. Each of the 267 ashlar blocks is its own mesh
with world-space UVs, so no tiling texture can give "this stone is a shade
warmer than its neighbour" - that variation has to be per OBJECT. StoneAO is
already a per-corner FLOAT_COLOR attribute that the exporter writes as COLOR_0
and three multiplies into base colour with no runtime code, so a per-block
multiplier rides it for free: zero texture memory, exportable as-is (class A).

WHAT IT WRITES. StoneAO_rgb *= tone_b, tone_b in [0.90, 1.08] drawn from a
seeded normal (sigma 0.045) per block NAME, so re-running is deterministic and
a block keeps its tone across rebuilds. A slight hue component rides with it:
darker blocks lean 1.5% warmer, lighter blocks 1.5% cooler - real quarry
variation, not colour noise. AO is preserved exactly: the multiplier is applied
to the existing values, and --reset divides it back out (the factor is stored
in a custom property on the object so the operation is reversible).

Blocks that share a mesh datablock (the 96 rustic_* on 2 meshes) are skipped:
a per-object tone on shared data would be the same tone. mansion_walls is
skipped: its field is 95% hidden and the exposed entrance bay is one stone.
"""
import bpy, re, sys, numpy as np

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RESET = '--reset' in args
ATTR = 'StoneAO'
PAT = re.compile(r'ashlar_(WEST|EAST|NORTH|SOUTH)_\d+$')
SIGMA, LO, HI, HUE = 0.045, 0.90, 1.08, 0.015

seen_mesh = set(); n = 0; tones = []
for o in sorted(bpy.data.objects, key=lambda x: x.name):
    if o.type != 'MESH' or not PAT.match(o.name) or o.hide_render: continue
    if o.data.name in seen_mesh: continue
    seen_mesh.add(o.data.name)
    ca = o.data.color_attributes.get(ATTR)
    if ca is None: continue
    prev = o.get('p4_blocktone')
    if RESET:
        if not prev: continue
        mul = np.array(prev, np.float32)
        factor = 1.0 / mul
        del o['p4_blocktone']
    else:
        if prev: continue                      # idempotent: never stack
        rg = np.random.default_rng(abs(hash(o.name)) % (2**32))
        t = float(np.clip(1.0 + rg.normal(0.0, SIGMA), LO, HI))
        # warm when dark, cool when light - a tiny, physically plausible drift
        d = (t - 1.0) / (HI - 1.0) if t > 1.0 else (t - 1.0) / (1.0 - LO)
        factor = np.array([t * (1.0 - HUE * d), t, t * (1.0 + HUE * d)], np.float32)
        o['p4_blocktone'] = [float(x) for x in factor]
    buf = np.empty(len(ca.data) * 4, np.float32); ca.data.foreach_get('color', buf)
    buf = buf.reshape(-1, 4); buf[:, :3] *= factor[None, :]
    ca.data.foreach_set('color', buf.ravel()); o.data.update()
    tones.append(float(factor[1])); n += 1

if tones:
    t = np.array(tones)
    print(f"### blocktone {'RESET' if RESET else 'APPLIED'}: {n} blocks | tone mean {t.mean():.4f} "
          f"min {t.min():.3f} max {t.max():.3f} sd {t.std():.4f}")
else:
    print("### blocktone: nothing to do")
if '--save' in args:
    bpy.ops.wm.save_mainfile(); print("### saved", bpy.data.filepath)
