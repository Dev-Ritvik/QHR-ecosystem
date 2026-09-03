# Phase 4 — Material Audit (STEP 1–3)

Forensic inventory of the exterior material system as shipped in
`exterior_mansion_v6_p25b3.glb` (production base v5 + the three Phase 2.5B roof
fixes), taken before any Phase 4 authoring. Source of truth for the Blender side
is `C:\dev\Blender\mansion_exterior_P25B2-NORMALS.blend` (locked source +
`mansion_roof` winding fix); the locked file itself is untouched.

Methodology carried over from Phase 2.5B: per-pixel Cycles material-index masks,
runtime captures at 1424×900 with the camera settled and pointer parallax zeroed,
building-window NCC alignment (HERO dx=0/dy=0), and unlit material-ID probes on
the runtime so a Blender mask is never trusted blind.

---

## 1. Inventory

### 1.1 Materials, meshes, attributes

| material | objs | tris | HERO % of frame | share of building (HERO) | UV | COLOR_0 | backface cull |
|---|---|---|---|---|---|---|---|
| MAT_Stone_Wall | 268 | 56,497 | 7.55 | **29.7 %** | UVMap (world box, 1 u/m) | StoneAO | on |
| MAT_Stone_Paving | 4 | 976 | 7.53 | **29.6 %** | UVMap | StoneAO | on |
| MAT_Roof_Slate | 2 | 3,758 | 4.01 | **15.8 %** | UVMap | – | on |
| MAT_Stone_Trim | 36 | 11,803 | 2.76 | 10.8 % | UVMap | StoneAO | on |
| MAT_Glass_Window | 17 | 2,824 | 1.26 | 5.0 % | UVMap | – | off (2-sided) |
| MAT_Stone_Rustic | 96 | 57,984 | 0.56 | 2.2 % | UVMap + UVMap.001 | StoneAO (=1.0 everywhere) | on |
| MAT_Wood_Dark | 2 | 1,188 | 0.49 | 1.9 % | UVMap (object-space in Blender) | – | on |
| MAT_Roof | 1 | 768 | 0.45 | 1.8 % | UVMap (object-space in Blender) | – | on |
| MAT_Gold | 12 | 8,272 | 0.40 | 1.6 % | UVMap (object-space BOX in Blender) | – | on |
| MAT_Stone_Steps | 4 | 176 | 0.40 | 1.6 % | UVMap | StoneAO | on |
| MAT_Window_Interior | 17 | 2,824 | 0.04 | 0.1 % | – | – | off |
| MAT_Ground | 1 | 18,432 | 47.09 | (landscape) | UVMap | – | on |
| MAT_Hedge | 3 | 3,054 | 2.57 | (landscape) | – | – | off |
| MAT_Cypress | 14 | 4,480 | 1.54 | (landscape) | – | – | off |
| MAT_Water | 2 | 260 | 1.58 | (landscape) | – | – | off |

Screen weight across the three validated beats (HERO / WEST / NW, % of frame):
wall 7.6/7.3/12.7 · paving 7.5/6.5/6.4 · roof slate 4.0/2.6/3.8 · trim 2.8/0.6/0.6
· glass 1.3/2.1/2.2 · rustic 0.6/0.7/0.8 · gold 0.4/0.4/0.7 · wood 0.5/0/0
· steps 0.4/0.1/0.

### 1.2 Textures (source on disk → shipped KTX2)

All 28 shipped images are 1024² ETC1S (UASTC for normals), 11 mips, 9.04 MB
payload; ~18.7 MB GPU at 4 bpp. Sources under `assets/materials/` (git-ignored).

| material | slot | source file | src size / mode | colour space | shipped |
|---|---|---|---|---|---|
| MAT_Stone_Wall | base | **marble026/color.png** | 2048 RGB | sRGB | img1 (mean sRGB 196,172,137 — verified = source) |
| | rough | **marble026/roughness.png** | 2048 L | Non-Color | img2 (G mean **0.332**, min 0.110 — verified = source) |
| | normal | marble026/normalgl.png | 2048 RGB | Non-Color | img0, strength 1.2 |
| MAT_Stone_Trim / Rustic / Paving / Steps | base/rough/normal | `_stone/<key>_*.png` (authored by `make_stone_materials.py`) | 1024 RGB / L / RGB | sRGB / NC / NC | img3–5, 12–17, 23–25 |
| MAT_Roof_Slate | base | roof_slate/basecolor.png × tint × ½AO → `basecolor_export.png` (P2.5B) | 2048 | sRGB | img26 |
| | rough | roof_slate/roughness.png → MapRange 0.42–0.82 baked, factor 0.82 (P2.5B) | 2048 L | NC | img27 |
| | normal | roof_slate/normal.png | 2048 | NC | img20 (shared with MAT_Roof), strength 0.9 |
| MAT_Roof | base/rough/normal | roof_slate/* raw | 2048 | | img21/22/20 |
| MAT_Wood_Dark | base/rough/normal | wood_dark/* | 2048 | | img10/11/9 |
| MAT_Gold | base/rough/metal/normal | gilt_aged/* | 2048 | | img7 / img8 (packed) / img6 |
| MAT_Ground | base/rough | `_baked/ground_basecolor.png` (4096) / `ground_roughness.png` | 4096 / 2048 | | img18/19 |
| Glass, Water, Hedge, Cypress, Window_Interior | – | constants only | | | – |

**Unused authored set:** `_stone/wall_basecolor|normal|roughness.png` — the
coursed-ashlar limestone `make_stone_materials.py` was written to produce for
the wall (405 mm courses, 22 mm joints, roughness mean 0.653) exists on disk and
is bound to nothing. `MAT_Stone_Wall` samples the **marble026** scan instead, at
Mapping 0.3003 (3.33 m tile), tinted `#E7E3DA`. FIXLOG 2026-08-27 refers to this
as "the locked 3.33 m tile of Marble026"; the substitution predates the repo's
first exterior commit and is not otherwise recorded.

### 1.3 Node graphs — exportability classification

Every Base Color and Roughness chain was walked from the BSDF back to its
sources (`classify.py`). Classes: **A** faithfully expressible in glTF · **B**
expressible with controlled baking · **C** not expressible without changing
representation · **D** already correct, do not touch.

| material | base-colour chain | roughness chain | class | shipped as |
|---|---|---|---|---|
| MAT_Stone_Wall | tex × COLOR_0 × const `#E7E3DA` (modern Mix ×2) | tex | **A / D** | factor [.80,.77,.70] + tex + COLOR_0 ✔ |
| MAT_Stone_Trim / Paving / Steps / Rustic | tex × COLOR_0 (modern Mix) | tex | **A / D** | factor 1 + tex + COLOR_0 ✔ |
| MAT_Roof_Slate | tex × const × (½+½AO) — 2× legacy MixRGB | MapRange 0.42–0.82 | **B — baked in P2.5B** | img26 / img27 + factor 0.82 ✔ |
| MAT_Roof | tex (object-space BOX mapping, scale 0.625) | Math ×1.0 (identity) | **C** (mapping) | UV0 + KHR_texture_transform 0.625 |
| MAT_Wood_Dark | lerp(const (.255,.165,.10), tex, 0.68) — legacy MixRGB MIX; object-space mapping | Math ×1.0 | **C** (affine mix + mapping) | raw tex, factor 1 — **known loss, direction-opposite** |
| MAT_Gold | tex (object-space BOX, scale 1.4286) | tex × 0.55 | **A** | factor 1 + tex, rough 0.55, metal 1.0 + metal tex ✔ |
| MAT_Ground | tex (EXTEND) | tex | **A / D** | ✔ |
| Glass / Water / Hedge / Cypress / Window_Interior | constants | constants | **A / D** | ✔ (glass BLEND α .55 + specular; water ior 1.333 + transmission) |

No legacy `ShaderNodeMixRGB` remains in the stone family (converted by
`fix_stone_material_export.py`). Two remain in the exterior set: both on
`MAT_Wood_Dark`'s base colour path (class C above); `MAT_Roof_Slate`'s were
resolved by baking in Phase 2.5B.

### 1.4 Baked AO (COLOR_0 = StoneAO, hemisphere raycast, floor 0.40)

| material | loops | mean | p05 | p50 | p95 |
|---|---|---|---|---|---|
| MAT_Stone_Wall | 111,359 | 0.579 | 0.400 | 0.475 | 1.000 |
| MAT_Stone_Trim | 31,141 | 0.626 | 0.400 | 0.606 | 0.938 |
| MAT_Stone_Paving | 1,760 | 0.599 | 0.400 | 0.487 | 0.938 |
| MAT_Stone_Steps | 384 | 0.551 | 0.400 | 0.450 | 0.918 |
| MAT_Stone_Rustic | 173,952 | **1.000 flat** | 1.000 | 1.000 | 1.000 |

The wall's median loop sits at 0.475 — the p50 of the primary stone is already
being multiplied by ~½ before any light hits it. The rustic base carries no AO
at all (shared kit meshes, reverted in the UV fix).

### 1.5 Runtime-side material layer (three.js, after GLB load)

Not in Blender, not in the GLB, and therefore invisible to the Blender reference:

* **`PAVING_TINT`** — `material.color × 0.32` (daylight) / `× 0.48` (dusk) on every
  `MAT_Stone*` material of meshes matching `/^(terrace_|rustic_|entry_step|entry_cheek|fount_)/`:
  4 paving, 4 steps, **all 96 rustic**, 2 fountain trim. Implemented as 4 cloned
  materials (`*_paving_daylight`), so the runtime runs **16** materials against
  the GLB's 15.
* **`EMISSIVE`** — grade-dependent emissive on `MAT_Window_Interior`
  (dusk 0.55, day 0), `MAT_Gold` (token 0.08), `MAT_Wood_Dark`.
* **`guardAnisotropy`** — disarms KHR_materials_anisotropy on tangent-less
  geometry (not currently declared on any material; guard is inert but stays).
* Scene: `environmentIntensity` 0.25 (daylight) / 1.0 (dusk), ACESFilmic,
  exposure 0.75 / 1.0. **All locked** for Phase 4.

Runtime census (p25b3, daylight): 479 meshes, 179,397 tris, 408 vertex-coloured
meshes, 426 meshes with a base map, wall `#e7e3da` / roughness 1 / normalScale
1.2 / `vertexColors: true`.

### 1.6 Source-texture character (macro / meso / micro)

| set | lin luma | σ | R/B | rough mean (min–max) | spectral energy micro/meso/macro |
|---|---|---|---|---|---|
| wall — marble026 (shipped) | 0.433 | 0.046 | **1.43** | **0.332 (0.11–0.90)** | **0.69 / 0.30 / 0.01** |
| wall — `_stone/wall_*` (authored, unused) | 0.459 | 0.068 | 1.27 | 0.653 (0.52–0.90) | 0.19 / 0.43 / 0.38 |
| trim | 0.530 | 0.021 | 1.22 | 0.474 (0.40–0.55) | 0.02 / 0.02 / 0.96 |
| rustic | 0.345 | 0.022 | 1.28 | 0.781 (0.66–0.92) | 0.02 / 0.05 / 0.93 |
| paving | 0.435 | 0.058 | 1.15 | 0.603 (0.50–0.92) | 0.24 / 0.28 / 0.48 |
| steps | 0.497 | 0.054 | 1.19 | 0.490 (0.42–0.92) | 0.33 / 0.36 / 0.31 |
| roof slate | 0.052 | 0.036 | 1.23 | 0.568 (0.18–1.00) → shipped 0.49–0.82 | 0.28 / 0.66 / 0.06 |
| wood dark | 0.022 | 0.009 | 1.92 | 0.328 (0.22–0.42) | 0.29 / 0.57 / 0.14 |
| gold (gilt_aged) | 0.752 | 0.058 | 1.63 | 0.281 (0.15–0.95) ×0.55 | 0.33 / 0.32 / 0.35 |

**Effective wall albedo** (marble026 × `#E7E3DA`, linear): (0.438, 0.321, 0.175),
**R/B = 2.50**. Real Portland/Bath limestone sits near (0.55, 0.52, 0.45), R/B
≈ 1.2–1.35. The primary stone is, numerically, an orange.

---

## 2. Measured state at HERO (p25b3 vs the corrected Blender reference)

Mask basis, 3 px eroded, daylight. Full table in FIXLOG 2026-09-03.

| material | Blender | runtime | Δ | ratio | note |
|---|---|---|---|---|---|
| MAT_Gold | 84.5 | 138.7 | +54.3 | 1.64 | faithfully exported; lighting |
| MAT_Stone_Wall | 71.6 | 114.7 | +43.0 | 1.60 | faithfully exported; lighting + p10 crush |
| MAT_Stone_Steps | 36.6 | 76.5 | +40.0 | 2.09 | brighter **despite** runtime ×0.32 |
| MAT_Wood_Dark | 12.9 | 41.1 | +28.1 | 3.18 | known export loss, opposite sign |
| MAT_Stone_Paving | 101.6 | 76.1 | −25.6 | 0.75 | darker **because of** runtime ×0.32 |
| MAT_Roof | 65.0 | 83.1 | +18.0 | 1.28 | control |
| MAT_Roof_Slate | 49.2 | 65.7 | +16.5 | 1.34 | after P2.5B fixes |
| MAT_Stone_Trim | 106.4 | 107.1 | +0.7 | 1.01 | matches |

---

## 3. Highest-value weaknesses (STEP 2)

Ordered by (screen weight × severity), each with its evidence.

1. **Primary limestone is a tinted marble scan.** 29.7 % of the building.
   Effective R/B 2.50 (orange), roughness mean 0.33 / floor 0.11 (polished),
   micro-dominated spectrum (0.69 of energy above 1/64 tile) with **no meso**
   structure — no courses, no joints, no per-block tone. The authored ashlar set
   that would supply exactly that meso layer is on disk and unbound. At the hero
   distance the wall reads as a flat warm plane; the only coursing the eye gets is
   the 25 mm relief of the 267 ashlar blocks, which the texture then contradicts.
   *Class: A (exportable) — a texture/roughness authoring problem, not an export one.*

2. **Roof slate readability.** 15.8 % of the building and the dominant dark mass.
   Export parity is now correct (P2.5B) but the shipped 1024² slate at hero
   distance shows weak course structure; Blender's reference shows courses the
   runtime softens (mip + ETC1S on a low-contrast map: base σ 0.036). The runtime
   still sits +16.5 over Blender, ~half of that the systemic GI deficit.
   *Class: B — base/roughness contrast authoring within the existing texture;
   the export path is proven and reproducible.*

3. **Paving / steps / rustic are graded twice.** Blender authors them at 0.60 /
   0.49 / 0.78 roughness with StoneAO; the runtime then multiplies base colour by
   0.32. Result at HERO: paving −25.6 vs reference, rustic base reads as grey
   concrete (crop 8), and the fountain cope/wall trim is also caught. Any Phase 4
   paving authoring done in Blender is measured against a reference the runtime
   does not honour. **Decision required (§5).**

4. **Trim is undifferentiated.** Spectrum 0.02/0.02/0.96 — the trim texture is
   essentially a flat colour with no meso or micro. Roughness 0.40–0.55 is the
   right *band* for dressed stone but there is no finish variation, so cornice,
   sills and archivolts read as painted rather than cut.

5. **Wood door.** Legacy MixRGB MIX at 0.68 + object-space mapping; the runtime
   samples the raw texture through UV0. Runtime +28.1 (3.18×) is dominated by
   missing contact occlusion in the portico (P2.5B). Needs a look-dev solution,
   not the naive bake. 1.9 % of building; focal point of the entrance.

6. **Gold.** +54.3 over Blender at HERO; gilt_aged base is R/B 1.63 with a 0.28
   roughness floor. Under the daylight rig it is the brightest surface in frame
   (138.7 mean). Restraint problem, not an export one.

7. **Rustic base has no AO** (COLOR_0 = 1.0 flat) and no course/joint meso
   (spectrum 0.02/0.05/0.93).

8. **Glass / water** — constants only; glass is BLEND α 0.55 with no roughness
   texture; water is a mirror (rough 0.02). Both export faithfully; both are
   look-dev only. Small screen weight.

9. **Landscape** — MAT_Ground 47 % of the HERO frame on a 4096 baked zone map
   with rough 0.855; hedge/cypress flat constants. Phase 5 owns composition;
   Phase 4 may touch material response only.

---

## 4. Priority ranking (STEP 3)

| rank | milestone | target | why now |
|---|---|---|---|
| 1 | **P4A** primary limestone | MAT_Stone_Wall: hue, roughness hierarchy, meso coursing | 29.7 % of building; numerically orange; polished-marble roughness |
| 2 | **P4B** stone family | Trim finish differentiation; paving/steps/rustic authored once, grade decision resolved | 44 % of building combined; double-grading |
| 3 | **P4C** roof slate + wood | Slate course contrast + roughness; door look-dev | 17.7 % combined; entrance focal point |
| 4 | **P4D** gold / glass / water | Restraint on gold; glass roughness; water response | accents |
| 5 | **P4E** AO/contact + landscape response | Rustic AO; final contact pass; ground/hedge roughness | after geometry-stable materials |

---

## 5. Decisions required before authoring (STOP items)

1. **Runtime `PAVING_TINT` (×0.32 / ×0.48).** It is a base-colour grade applied in
   `ExteriorModel.tsx` to 106 meshes, absent from Blender. Phase 4 cannot author
   paving, steps, rustic or the fountain trim against a reference that omits it.
   Options: (a) fold the intended darkening into the authored materials and
   remove the runtime multiply; (b) keep it and mirror it in the Blender
   reference for parity; (c) leave both as-is and accept the paving family is
   unmeasurable. Recommendation: **(a)** — it is the only option where the GLB
   is the material. This touches `ExteriorModel.tsx` material code, not lighting.
2. **`MAT_Stone_Wall` texture source.** The marble026 substitution is documented
   as "locked". Phase 4's objective (§6.1 of the mandate) cannot be met on a
   marble scan; the authored ashlar set is the intended source. Proceeding on the
   assumption that Phase 4 authorises replacing the wall's *texture set* while
   preserving the `#E7E3DA` tint intent, the COLOR_0 AO, the UV projection and the
   normal-strength convention. **Confirm.**

Everything in §1 classified **A / D** is left alone unless a §3 weakness names it.
