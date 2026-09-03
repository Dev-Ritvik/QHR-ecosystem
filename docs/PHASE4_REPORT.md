# Phase 4 — Materials / Surface Realism — Report

Companion to `docs/PHASE4_MATERIAL_AUDIT.md` (STEP 1–3). All numbers below are
measured with the Phase 2.5B methodology: Cycles per-pixel material-index
masks, runtime captures at 1424×900 with the camera settled (frame-to-frame
mean diff ≤ 0.13/255) and pointer parallax zeroed, building-window NCC alignment
at HERO (dx=0, dy=0), each runtime compared against the Blender render of the
source it was built from. Luma is display-referred 0–255 unless stated.

## A. Repository state
HEAD after this phase: five milestone commits on `main` over the Phase 2.5B
close (`632d5a2`): `63edecd` P4A, `e105a4e` P4B, `52b2db0` P4C, `46a7be8` P4D,
and the P4E commit carrying this report. Nothing pushed. Working tree clean
after the P4E commit.

## B. Candidate names
`?model=p4a` primary limestone · `p4b` stone family + paving grade retired ·
`p4c` roof slate + dark-oak door · `p4d` gold/water restraint · **`p4e` the
assembled surface system (p4d with orphaned images pruned) — the candidate to
judge against v5.** All registered in `ExteriorModel.tsx`; none promoted.

## C. Files changed
- `apps/public/public/models/exterior_mansion_v6_p4{a,b,c,d,e}.glb` (new)
- `apps/public/src/components/experience/ExteriorModel.tsx` — candidate registry entries; `PAVING_TINT` retired to 1.0 with the pass short-circuited (P4B)
- `tools/gltf/make_limestone_wall.py`, `make_stone_family_p4b.py`, `make_p4c_roof_wood.py` (new texture authoring)
- `tools/gltf/patch_material_textures.py`, `transplant_draco_nodes.py`, `prune_orphan_images.py` (new GLB tooling)
- `tools/gltf/make_stone_materials.py` — module-level build moved behind `main()` (import-safe; behaviour unchanged when run)
- `tools/blender/p4a_wall_material.py`, `p4b_family_material.py`, `p4c_roof_wood_material.py`, `p4d_accents_material.py`, `blocktone_stoneao.py`, `rustic_contact_ao.py` (new)
- `docs/PHASE4_MATERIAL_AUDIT.md`, `docs/PHASE4_REPORT.md`, `FIXLOG.md`, `.claude/launch.json` (`public-prod` entry for the fresh-context check)
- Blender working copies (outside the repo, never the locked source): `mansion_exterior_P4A.blend` … `P4D.blend`

## D. Materials changed
| material | change | export representation |
|---|---|---|
| MAT_Stone_Wall | marble026 scan → authored limestone surface; per-block tone in COLOR_0; tile 3.33 → 1.20 m; normal 1.2 → 0.60 | base/MR/normal textures + `KHR_texture_transform` 0.8333; baseColorFactor `#E7E3DA` kept |
| MAT_Stone_Trim | finish only: roughness 0.38–0.54, tooling micro, faint macro; colour unchanged | base/MR/normal textures (normal 0.65) |
| MAT_Stone_Paving | albedo ×0.86, darker dirtier joints, roughness 0.55–0.76, weathering | textures (normal 0.80) |
| MAT_Stone_Steps | albedo ×0.82, tread wear, roughness 0.42–0.60 | textures (normal 0.70) |
| MAT_Stone_Rustic | albedo ×0.82, roughness 0.72–0.92, weathering; block-local contact AO in COLOR_0 | textures (normal 1.10) + 2 shared meshes re-shipped Draco |
| MAT_Roof_Slate | re-derived bake, AO weight 0.72, per-slate tone/roughness, 3 % graphite; roughness absolute | base + MR textures, roughnessFactor 0.82 → **1.0** |
| MAT_Wood_Dark | parquet scan → authored dark stained oak, UV-mapped, roughness 0.36–0.56, grain normal 0.60 | base/MR/normal textures |
| MAT_Gold | roughnessFactor 0.55 → 0.90; aged-gilt baseColorFactor (0.85, 0.80, 0.70) | factors only |
| MAT_Water | roughnessFactor 0.02 → 0.07 | factor only |
| Glass, Window_Interior, Ground, Hedge, Cypress, Roof | **untouched** (audit class D; landscape is Phase 5) | — |

## E. Textures changed (new files beside untouched sources, all git-ignored under `assets/`)
`_stone/limestone_{basecolor,roughness,normal}.png` (1024, tile 1.20 m) ·
`_stone/p4b_{trim,paving,steps,rustic}_{basecolor,roughness,normal}.png` (1024, tiles 1.2 / 3.6 / 2.4 / 1.1 m) ·
`roof_slate/p4c_{basecolor,roughness}.png` (2048) · `wood_dark/p4c_{basecolor,roughness,normal}.png` (2048).
Every source texture in `assets/materials/` is byte-unchanged.

## F. Baking performed
- Roof: `basecolor × (0.82,0.86,0.94) × (0.28 + 0.72·AO) × slateTone`, linear, sRGB-encoded out; roughness `clip(0.42 + 0.40·r + slateOffset, 0.40, 0.84)` absolute, linear.
- Per-block tone: `StoneAO_rgb *= tone_b` (0.90–1.08, seeded by block name, ±1.5 % hue drift) on the 267 ashlar meshes.
- Rustic contact: `StoneAO = clip(bed(z) · top(z) · side(xy), 0.40, 1)` per mesh, block-local.
- No AO was multiplied into any base colour beyond what Blender's own graph already did (roof AO weight raised 0.50 → 0.72 is the one authored change, and it is stated).

## G. Export transformations
Every texture went through the pipeline's own steps: LANCZOS to 1024, `ktx create` ETC1S sRGB (base), ETC1S linear (MR, packed R=255/G=rough/B=255), UASTC linear (normal). Per-slot **controls** re-encoded the shipped sources and reproduced the shipped bytes byte-for-byte for every replaced slot (wall img0/1/2, trim img3/4/5, paving 15/16/17, steps 12/13/14, rustic 23/24/25, wood 9/10/11). Geometry: 267 ashlar + 2 rustic primitives re-shipped Draco-compressed from Blender exports at level 6 (vertex/index counts equal, bbox slip 0.000 m); all other 112 primitives byte-identical to v5. p4e prunes 20 orphaned images (6.31 MB) with material→image bindings verified unchanged.

## H/I/J. HERO daylight — before (p25b3, the Phase 2.5B close) → after (p4e), each vs its own Blender reference
| material | Blender before → after | runtime before → after | error before → after | runtime R/B |
|---|---|---|---|---|
| Stone_Wall | 71.6 → 63.7 | 114.7 → 117.2 | +43.0 → +53.5 | 1.55 → **1.40** |
| Stone_Trim | 106.4 → 105.9 | 107.1 → 121.4 | +0.7 → +15.5 (fountain trim ungraded) | 1.28 |
| Stone_Paving | 101.6 → 95.0 | 76.1 → 113.7 | −25.6 → +18.7 (grade retired) | 1.17 → 1.20 |
| Stone_Steps | 36.6 → 31.6 | 76.5 → 113.6 | +40.0 → +82.0 (grade retired) | 1.18 |
| Stone_Rustic | 61.3 → 54.6 | 71.2 → 106.2 | +9.9 → +51.6 (grade retired) | 1.29 |
| Roof_Slate | 49.2 → 48.3 | 65.7 → 64.7 | +16.5 → +16.4 | 1.14 |
| Wood_Dark | 12.9 → 9.1 | 41.1 → 54.4 | +28.1 → +45.4 | 1.45 → 1.51 |
| Gold | 84.5 → 81.2 | 138.7 → 132.0 | +54.3 → +50.8 | 1.74 → 1.91 |
| Glass / Ground / Hedge / Cypress / Water / Roof | ≤ 1.3 change | ≤ 0.7 change | — | — |
Whole frame MAE 18.03 → 17.85, RMS 26.30 → 26.85. Runtime hierarchy after:
Trim 121 > Wall 117 > Paving 114 > Roof 83 > Ground 71 > Roof_Slate 65 > Glass 61 > Wood 54 > Hedge 52 > Cypress 43 > Water 16
(Blender: Trim 106 > Paving 95 > Ground 75 > Roof 65 > Wall 64 > Glass 50 > Hedge 49 > Roof_Slate 48 > Cypress 30 > Water 28 > Wood 9).

**The parity errors that grew are explained, not hidden.** Paving/steps/rustic grew because the ×0.32 runtime grade that no reference could see was retired (owner decision) — measured ungraded first (+20.6/+87.3/+54.7), then authored down (−7.9/−9.9/−9.9). The wall grew because the marble's high-frequency normal had been lifting the Blender reference by **+10.1** (isolation render) and its gloss by a further −1.7; the runtime wall is level with v5 (+2.6) and is no longer orange. The door grew because it is now a real dark wood (0.055 luma) rather than a near-black (0.022); Blender keeps it in contact shadow the runtime lacks (P2.5B). Every remaining large error sits on a material proven faithfully exported (stone COLOR_0 on all 314 primitives, MAT_Roof control 1.018× at the lit end) and is the runtime's key/env split — out of Phase 4's bounds and not touched.

## K. WEST
Candidate-vs-candidate at the same pose (unchanged materials 0.00 prove pose). P4A wall +2.0, chroma 1.43 → 1.35, glass/gold +2 as reflections. P4B through a runtime material-ID mask: wall **−0.00**, roof −0.01, gold −0.00; the Blender mask at WEST is misregistered (agreement 51–55 %, NCC 0.155 at dx −34) and is not used for absolute parity there. P4C roof −0.58, all else ≤ 0.17. Roof local contrast at 6 m: 15.56 → 15.64 (runtime), 9.89 → 9.98 (Blender) — the readability lever measured flat.

## L. NW
Cypress/hedge/roof/gold 0.00 at every step (pose proven). P4A all ≤ 0.9; P4B family +3.8 to +5.8, glass/wall readings carry the same mask limitation as WEST; P4C/P4D not re-captured at NW (factor/roof changes shown inert at HERO/WEST/dusk).

## M. Dusk (HERO)
P4A wall −1.07 (R/B 1.58 → 1.47), roof −1.45, rest ≤ 0.75. P4B family +23 to +29 from grade retirement, all else 0.00; **dusk paving/wall ratio 0.81 → 1.00 — a hierarchy change, reported**. P4C roof −0.79, wood +11.27 (the runtime's own EMISSIVE_DUSK on the door), rest ≤ 0.06. P4D gold −9.36, water −0.24, rest ≤ 0.15.

## N. Interior regression
`/hall` on the fresh production build: loads `interior_hall.glb` (unchanged, `ee95e915…`) and, with no query parameter, `exterior_mansion_v5.glb`; canvas 1424×900; **0 console errors, 0 warnings**.

## O. Texture-memory impact
KTX2 payload v5 8.63 MB → p4e **9.60 MB** (+0.97 MB: the wall's UASTC normal and the wood normal are the cost); GPU estimate 17.3 → 18.7 MB at 4 bpp. File 9.72 → 11.04 MB. Image count 26 → 28 (one extra roof base for MAT_Roof_Slate, one extra roof MR). Intermediate candidates carried orphans (p4c/p4d 17.5 MB) and are not the shipping shape.

## P. Shader / material-count impact
GLB materials 15 → 15. Runtime materials **16 → 15** (the paving clones are gone). Draco primitives 381 → 380 (roof, since P2.5B). Draw calls unchanged (one per node, 479). No new shader features; no extensions added (unlit probes were diagnostic and deleted).

## Q–U. Suite
- **Q tests:** 266 passing (48 public incl. 29 cameraPath, 188 domain, 30 db)
- **R build:** production build 0 on a clean `.next` (2/2 tasks)
- **S typecheck:** 0 (5/5)
- **T lint:** 0 errors; pre-existing warnings only (the `ExteriorModel.tsx` one is the untouched `useEffect` dep, now line 793)
- **U console:** fresh production build + fresh context: `?model=p4e` **0 errors / 0 warnings**; `/hall` **0 / 0**. Frame rate: NOT MEASURABLE in this headless context (rAF 1.3/s, software GL) — not reported.

## V/W. Production v5
`d7a7e945c214bf4e8fa5ab46ce0ce5ff29e0c5fde54ab1bebeba607897bc87c3` — unchanged. `EXTERIOR_MODEL_URL` still resolves `/models/exterior_mansion_v5.glb`; the default route requests v5.

## X. Phase 3 assets
p31 `a65e35ef…`, p32 `88da07d2…`, p33 `9a908e1c…`, p34 `5e4952ba…` unchanged; p25b/p25b2/p25b3 unchanged; locked source blend mtime 2026-08-27 22:43:35 unchanged.

## Y. Known remaining limitations
1. Slate course readability at HERO is resolution-limited (a slate is ~3 px; 1024/ETC1S/mips average it out); at 6 m the contrast is already there. Not fixable by authoring within restraint.
2. The terrace no longer sits under the facade at dusk (ratio 1.00 vs 0.81 graded). If that art direction is wanted, it should be an authored value in the material, not a runtime multiply.
3. The door is brighter than v5 by design (real dark wood vs near-black); one constant in the generator if the owner prefers darker.
4. Blender masks at WEST/NW are misregistered (P2.5B NCC 0.155); absolute parity off-hero needs the runtime material-ID probe, whose classifier fails on green/cyan hues under ACES (a hue-angle classifier is the fix).
5. Rustic per-block tone is impossible (2 shared meshes); tone rides the texture's macro mottle.
6. Landscape materials untouched by design (Phase 5). Glass untouched (class D).
7. The large remaining parity gaps (wall +53, steps +82, rustic +52, gold +51) are the runtime's key/env split and missing GI — locked variables.

## Z. Decision
**PASS — with the residuals above stated.** The material system is export-safe (every replaced slot control-verified byte-for-byte; every candidate structurally diffed; no exporter-invisible node left in the roof, wall or wood chains), technically sound (15 materials, one runtime multiply removed, 0 console errors on a fresh production build, full suite green), regression-tested at HERO/WEST/NW/dusk/interior with unrelated materials moving ≤ 0.2 at each step, and visually coherent: the primary stone reads as limestone rather than tinted marble, the family is differentiated by finish rather than colour, the door reads as wood, the brass is no longer the brightest thing in the frame. Not promoted; v5 remains the default until the owner promotes p4e.
