# Phase 5 — Forensic inventory (STEP 1), before any authoring

Nothing in this document is an authoring decision. It is the measured state of
the property environment as shipped, taken through the **production build** at
the site's own resolution, and the ranking that follows from it.

**Instruments built for this step** (all new, all reviewable):

| tool | what it answers |
|---|---|
| [tools/gltf/phase5_inventory.py](../tools/gltf/phase5_inventory.py) | GLB structure by environment class: nodes, primitives, triangles, world bounding boxes, materials, per-image KTX2 payload |
| [tools/gltf/phase5_camera_coverage.py](../tools/gltf/phase5_camera_coverage.py) | analytic bbox projection through the exact beat cameras — a ranking pass, caveated in-file |
| [tools/capture/phase5_probe.mjs](../tools/capture/phase5_probe.mjs) | pose-verified capture, renderer census, **exact per-class screen coverage** by an emissive-id render + readback |
| [tools/capture/phase5_ground.mjs](../tools/capture/phase5_ground.mjs) | the ground plane's screen silhouette, its metres-per-texel at the real cameras, and its value statistics |
| [tools/capture/phase5_load.mjs](../tools/capture/phase5_load.mjs) | cold-context transfer and time-to-`[exterior_ready]` |

The runtime probe reaches the live scene through `window.__THREE_DEVTOOLS__`,
which three's `Scene` and `WebGLRenderer` already dispatch to. **No source
change was made to measure anything**, so every number below is the production
path, not a debug path.

Every capture is **pose-verified**: the rig is scrolled to a fraction derived by
inverting `SWING` over `CROSSOVER`, held until 12 consecutive frames move less
than 4 mm, and then asserted against the beat's authored position.

| beat | doc scroll | scrollY / 14014 | settled position | error |
|---|---|---|---|---|
| HERO | 0.000000 | 0 | (−20.0000, 15.5000, 27.0000) | **0.000 m** |
| WEST | 0.187952 | 2634 | (−25.9914, 9.0065, 2.0207) | **0.023 m** |
| NW | 0.245042 | 3434 | (−15.0087, 8.4019, −18.9760) | **0.026 m** |

---

## 1. Current environment inventory

Measured on `exterior_mansion_v6_p4e.glb` (11.04 MB, 479 mesh nodes, 381
meshes, 15 materials, 28 images, 179,397 triangles).

### Scene and resolvers
| | |
|---|---|
| default resolver | `EXTERIOR_MODEL_URL = '/models/exterior_mansion_v5.glb'` — **unchanged** |
| candidates | `?model=` → v5, v5etc1s, prod, p31–p34, p25b, p25b2, p25b3, p4a–p4e |
| Phase 4 baseline | `p4e` (validated, **not promoted**) |
| interior | `interior_hall.glb`, 16.14 MB, mounted early and hidden from `s ≥ 0.26` |
| cameras | 5 beats, centripetal Catmull-Rom, `frameOffset` applied to the AIM in camera space, roll after `lookAt` |
| background | `scene.background` = equirect `env_meadow_bg_2k.jpg` (2048×1024, 465 KB) — a bake of the same `199_hdrmaps_com_free_2K.exr` Blender's world uses. Daylight only; dusk is flat `#0A1120` |
| environment (lighting) | `RoomEnvironment` rendered to a 256 px cube — deliberately NOT the background |
| fog | daylight **static** `Fog(#5E6147, 60, 220)`; dusk `Fog(#0A1120, 34..190)` travelling with the camera per beat |
| lights | 9 in scene, **1 shadow caster** |
| `<Terrain />` | present in the tree, **deliberately not mounted** — the GLB carries authored terrain instead |

### Environment geometry, as it exists
| element | nodes | triangles | world extent (m) | material |
|---|---|---|---|---|
| **terrain** `ground_plane` | 1 | 18,432 | x/z ±120, y −2.97 … +0.97 | `MAT_Ground` |
| **hedges** `hedge_b/l/r` | 3 | 3,054 | x ±16.3, z −11.8 … 19.0, y 0 … 1.0 | `MAT_Hedge` |
| **trees** `cyp_0_*`, `cyp_1_*`, `cyp_b_*` | 14 | 4,256 | x ±27.5, y 0 … 5.40 | `MAT_Cypress` |
| **terrace / paving** `terrace_upper`, `terrace_lower`, `fount_apron` | 3 | 532 | x ±10.1, z −7.0 … 17.4 | `MAT_Stone_Paving` |
| **steps** `entry_step_0/1`, `entry_cheek*` | 4 | 176 | z 5.7 … 6.6 | `MAT_Stone_Steps` |
| **fountain** bowl, lip, cap, jet, stem×2, wall, cope, floor, water | 10 | ~772 | centre (0, ·, 13.2), r ≈ 2.7 | `MAT_Stone_Trim`, `MAT_Water` |
| **driveway / arrival** | **0** | **0** | — | — |
| **lawn geometry** | **0** | **0** | — | — |
| **props** (planters, benches, lamps, bollards, gates, urns at ground level) | **0** | **0** | — | — |

**There is no driveway object.** The forecourt and drive exist only as painted
regions in a 1024² zone mask baked into `ground_basecolor`
([assets/materials/ground_zones/zones.png](../assets/materials/ground_zones/zones.png)
is 95.3 % pure-green lawn, 1.2 % red/yellow drive, 1.5 % black). At the
measured texel density (below) neither is legible.

### The three environment materials, exactly
```
MAT_Ground    baseColorTexture ground_basecolor  (1024², ClampToEdge, repeat 1×1, 12.11 KB KTX2)
              metallicRoughnessTexture ground_roughness (1024², 3.11 KB KTX2)
              normalMap  NONE      aoMap NONE      COLOR_0 NONE
              roughness 1.0  metalness 0.0   receiveShadow yes / castShadow no
MAT_Hedge     baseColorFactor [0.026, 0.052, 0.018]  rough 0.90  doubleSided
              NO textures of any kind
MAT_Cypress   baseColorFactor [0.019, 0.038, 0.015]  rough 0.92  doubleSided
              NO textures of any kind
MAT_Water     baseColorFactor [0.03, 0.06, 0.07]  rough 0.07  ior 1.333
              KHR_materials_transmission 0.8   doubleSided
```

---

## 2. Existing asset inventory

### Shipped
- `apps/public/public/models/` — **187 MB on disk**, 17 GLBs: 13 exterior
  candidates, the interior, and a `_pre_ktx2fix_backup/` pair. Only two are
  reachable in a default session (v5 + interior).
- `apps/public/public/textures/` — 3.3 MB. One exterior-relevant file:
  `env_meadow_bg_2k.jpg`. Plus unused `gold/`, `limestone/`, `roof/`, `wood/`
  JPEG sets superseded by the in-GLB KTX2.
- KTX2 in p4e: **28 images, 9.60 MB payload**, every one 1024², 11 mip levels;
  colour maps `basis-lz`, normals `zstd`. Draco on all 381 meshes.

### Available to reuse (source library)
| | |
|---|---|
| `assets/models/ornament/` | baluster (STL), cornice, quoin block + maps, corinthian capital, carved tympanum, newel post, ceiling rosette, finial tip, wall panel moulding |
| `assets/models/props/` | chandeliers ×3, hologram projector, circular tables ×2 — **all interior** |
| `assets/New assets/` | bronze urn, console tables, upholstered bench, jade plant, orchid, carpet/fabric texture sets |
| `assets/hdri/` | 4 HDRIs incl. the reference `199_hdrmaps_com_free_2K.exr` |
| `assets/materials/` | 12 PBR sets (limestone_cream 88 MB, roof_slate 47 MB, wood_dark, plaster_wall, gilt_aged, 3× marble, metal_brushed_dark) |

**There is no exterior vegetation or landscape asset in the library** — no
grass, no tree, no hedge, no shrub, no lamp, no bollard, no bench, no gate, no
gravel or turf texture set. Phase 5 vegetation and hardscape detail must be
**authored**, not sourced. That is a scoping fact, not an obstacle: the same
generator approach that produced the P4A limestone and the P4B family applies.

### Duplicates / dead weight
- 17 exact-duplicate groups across `assets/` + `public/`, **4.0 MB total**, all
  inside the untracked `assets/New assets/` source library. Nothing shipped is
  duplicated.
- One worth naming: `_stone/p4b_rustic_normal.png` is byte-identical to
  `rustic_normal.png` — P4B reused the rustic normal unchanged. Correct, not waste.
- `_pre_ktx2fix_backup/` (22 MB) and 11 superseded exterior candidates are
  local-disk only, not served.

---

## 3. Camera visibility inventory

**Exact screen coverage**, from an emissive-id render read back at 1424×900 —
occlusion and silhouette included. Percent of the full frame.

| class | HERO | WEST | NW | HERO dusk |
|---|---|---|---|---|
| **terrain** `ground_plane` | **47.07** | **31.87** | **25.24** | 46.38 |
| sky / backdrop | 21.74 | 40.65 | 41.15 | 21.74 |
| mansion shell | 8.48 | 7.17 | 10.15 | 8.35 |
| terrace paving | 6.20 | 6.14 | 6.28 | 6.20 |
| roof + spire + finials | 5.04 | 3.52 | 4.76 | 5.04 |
| fountain | 4.10 | 0.61 | **0.00** | 4.10 |
| hedge | 2.32 | 3.83 | 1.74 | 2.32 |
| ashlar + rustic masonry | 1.99 | 3.17 | 5.11 | 1.99 |
| cypress | 1.50 | 1.68 | 4.08 | 1.49 |
| entry steps | 0.38 | 0.10 | **0.00** | 0.38 |
| unclassified (motes, constellation) | 1.19 | 1.26 | 1.48 | 2.01 |

Rolled up:

| | HERO | WEST | NW |
|---|---|---|---|
| building (shell + roof + masonry) | 15.5 % | 13.9 % | 20.0 % |
| hardscape (terrace + steps + fountain) | 10.7 % | 6.9 % | 6.3 % |
| soft landscape (terrain + hedge + cypress) | **50.9 %** | **37.4 %** | **31.1 %** |

**The ground plane alone holds 1.9–3.0× the screen area of the entire
mansion at every exterior camera.** That single fact sets the whole priority
order below.

Also established:
- The fountain and the entry steps are **completely absent from NW** and the
  fountain is ~0.6 % at WEST. It is a HERO-and-dusk element only.
- `TURN` (s 0.82) and `CONSTELLATION` (s 1.00) contain **no estate geometry at
  all** except ground plane bleed. Nothing authored for them will be seen.
- `p4e` vs `v5` at the same poses shows roof coverage **1.84 → 3.52 % (WEST)**
  and **2.07 → 4.76 % (NW)** with mansion shell falling correspondingly — the
  P2.5B roof-winding fix, visible as area. `v5` is still the resolver default,
  so **the live site currently renders the roof hole.**

---

## 4. Current performance baseline

Production build, `next start`, 1440×900 viewport → 1424×900 drawing buffer,
dpr 1.0, ANGLE / AMD Radeon / D3D11.

| | HERO | WEST | NW |
|---|---|---|---|
| **scene draw calls** | 947 | 939 | 931 |
| **triangles submitted** | 354,562 | 354,890 | 344,298 |
| scene triangles (unique) | 179,397 | 179,397 | 179,397 |
| geometries / GL textures / programs | 383 / 52 / 16 | 383 / 52 / 17 | 383 / 52 / 17 |

Triangles submitted are ≈2× the scene's own count because the single
shadow-casting light re-draws the estate into its depth map.

| | value |
|---|---|
| materials in scene | **15** (5 doubleSided, 1 transparent) |
| lights / shadow casters | 9 / 1 |
| GPU texture residency | **49.32 MB** over 37 texture bindings — `COMPRESSED_RGBA_BPTC_UNORM` (BC7), 11 mips, so this is genuinely compressed, not a headless RGBA fallback |
| GLB sizes | p4e 11.04 MB · v5 9.72 MB · interior 16.14 MB |
| KTX2 payload in p4e | 9.60 MB of the 11.04 |
| time to `[exterior_ready]` | **1120 ms** on localhost — a floor; excludes real-network transfer of 11 MB |
| `load` event | 370–403 ms |
| console errors | **0** across all four captures |
| headless rAF rate, settled | 91–104 /s with vsync off — **comparative only, not a user frame rate** |

Frame timing under load is **not** reported: headless with vsync off does not
measure what a visitor's device does, and manufacturing a number here would be
worse than having none.

---

## 5. Biggest environmental weaknesses, ranked by measured visual impact

**1. The ground carries no information at the frequency the frame needs.**
One 1024² albedo, ClampToEdge, `repeat 1×1`, stretched across 240 m →
**0.2344 m per texel**. Ray-cast against the real cameras:

| sample point | distance | m / screen pixel | **texels per pixel** |
|---|---|---|---|
| HERO, bottom of frame | 25.2 m | 0.0197 | **0.084** → 1 texel ≈ 12 px |
| HERO, lower third | 31.9 m | 0.0261 | 0.111 |
| HERO, centre | 49.0 m | 0.0407 | 0.174 |
| WEST, bottom of frame | 15.6 m | 0.0161 | **0.069** → 1 texel ≈ 15 px |
| NW, bottom of frame | 15.3 m | 0.0153 | **0.065** → 1 texel ≈ 15 px |

The map is magnified **12–15×** across the nearest half of every hero frame.
Consequence for authoring: **re-baking a better 1024² ground map is worthless.**
The only thing that can put detail there is a *tiling* detail set blended by the
zone mask. Measured lawn statistics confirm the read — mean RGB (79.7, 80.4,
61.6) at HERO, i.e. **R ≈ G**, a neutral olive rather than a green; the σ 31.7
is the mansion's cast shadow, not surface variation. And it has **no normal map
and no AO**, so 47 % of the frame is a Lambert plane.

**2. The ground plane ends in a visible edge across the middle of the frame at
WEST and NW — and the daylight fog band cannot reach it.**
Measured silhouette (topmost ground row, 89 columns):

| | HERO | WEST | NW |
|---|---|---|---|
| top row | 171 → 228 | **359 → 431** | **366 → 433** |
| ground present in | 89/89 columns | 89/89 | 89/89 |

Daylight fog is a static `Fog(60, 220)`. The plane's far edge sits ~146 m from
the WEST camera → fog factor **0.54**. It is only half-dissolved when it stops,
with a photographic alpine backdrop of different hue and value immediately
above it. Dusk's `Fog(26, 105)` fully buries the same edge, which is exactly why
dusk composites and daylight does not. This is a causal, measured diagnosis, not
an impression.

**3. There is no arrival.** Zero driveway geometry; the drive is 1.2 % of a zone
mask at 0.23 m/texel. Nothing in any frame answers "where does a car stop".

**4. Hedge and cypress are untextured constants.** Both are single
`baseColorFactor` values around 0.02–0.05 with no map of any kind. Together they
hold 3.8 % (HERO) to 5.8 % (NW) of frame and render as near-black paper cutouts
— confirmed in the NW crop. They are the second-largest soft-landscape mass
after the ground.

**5. The fountain water is a void.** `roughness 0.07` + `transmission 0.8` +
near-black base, against a `RoomEnvironment` cube at low intensity, reflects
essentially nothing. At 4.10 % of the HERO frame — the fourth-largest single
element — it reads as a hole in the forecourt. Worst at dusk.

**6. No lawn↔hardscape contact.** The terrace edge meets grass on a hard line
with no soil margin, no gravel verge, no contact darkening. The P4B kerb and
bead are good and are *undermined* by having nothing to sit into.

**7. No spatial definition beyond three hedge runs.** No perimeter, no
architectural hedge lines tied to the building's axes, no low garden boundary.
The estate has no edge, so it has no size.

**8. No secondary detail at all.** No planter, lamp, bollard, bench, urn or
gate. At dusk there is **no exterior lighting whatsoever** beyond window glow.

**9. Budget is being spent where nothing is seen.** 4,256 triangles of cypress
of which 5–8 of 14 are off-frame at any camera; the fountain's 772 triangles
are 0 % at NW. Meanwhile the element holding 47 % of the frame has 18,432
triangles and two 1024² maps.

**Deliberately NOT on this list** — measured, already correct, leave alone:
the P4B paving and its kerb/bead; the P4A limestone and per-block tone; the
roof after P2.5B/P4C; the terrain's 3.95 m of relief (it is present and reads at
NW); the equirect background's *derivation* (it is the Blender world, correctly
oriented, and parallaxes properly).

---

## 6. Proposed Phase 5 execution order

Reordered from the mandate's A–J against the measurements, and the reason for
each move is stated. The mandate's pass letters are kept so nothing is silently
dropped.

| # | pass | why here |
|---|---|---|
| **P5A** | **Ground surface system** (mandate PASS A + B) | 25–47 % of every frame, and the texel measurement says the fix is a tiling detail set + zone blend + normal + AO, not a re-bake. Nothing else changes the frame as much. Terrain *shape* is already acceptable, so this pass is surface, not landform. |
| **P5B** | **Atmospheric continuity** (mandate PASS H, moved up) | The plane edge is a *measured* defect with a *measured* cause. It is cheap (fog band + a ground-edge treatment) and every later pass is judged against a frame that currently has a seam through it. Must be fixed before composition can be judged. |
| **P5C** | **Lawn ↔ hardscape transitions** (rest of PASS B) | Contact, verges, soil margins. Depends on P5A existing. |
| **P5D** | **Hedge and boundary system** (PASS C) | Second-largest soft mass; needs real material + architectural alignment to the building axes. |
| **P5E** | **Tree system** (PASS D + G) | Cypress material and silhouette first, then distribution by zone. Explicitly not "more trees". |
| **P5F** | **Driveway and arrival** (PASS E) | Real geometry on the entry axis, relating drive → forecourt → fountain → steps. |
| **P5G** | **Fountain and water** (PASS F) | Water response, rim, basin, apron. HERO/dusk only — scoped by the coverage numbers. |
| **P5H** | **Secondary property detail** (PASS G) | Only what passes visibility + architectural + composition + performance. Expected to be a short list. |
| **P5I** | **Composition pass** (PASS I) | All four cameras, against the criteria in the mandate §14. |
| **P5J** | **Performance** (PASS J) | Instancing and shared materials audited against the 947-draw-call / 49 MB baseline. |

Each pass: **measure → author → export → compare → accept**, with the same
control discipline Phase 4 used — every replaced texture slot gets a
byte-identity control, every candidate a structural GLB diff, and unrelated
materials asserted unmoved at HERO/WEST/NW/dusk.

---

## 7. Proposed candidate structure

Candidates are cumulative and each is registered in `MODEL_CANDIDATES`
alongside production, exactly as p4a–p4e were:

```
p5a   ground surface system                (built on p4e)
p5b   p5a + atmospheric continuity
p5c   p5b + lawn/hardscape transitions
p5d   p5c + hedge & boundary
p5e   p5d + tree system
p5f   p5e + driveway & arrival
p5g   p5f + fountain & water
p5h   p5g + secondary detail
p5i   p5h, composition-corrected
p5j   p5i, pruned & optimised          <- the candidate to judge
```

Working copies of the Blender source per pass (`mansion_exterior_P5x.blend`),
never the locked file. `EXTERIOR_MODEL_URL` is untouched throughout.

Per candidate, documented: what changed, why, asset cost, visual benefit,
performance delta, regressions, screenshots at all four cameras, measurements.

---

## 8. What must remain locked

Restated from the mandate and from what the measurements confirm should not move:

**Camera** — all 5 beat positions/targets, `frameOffset`, `fov`, `roll`, the
centripetal Catmull-Rom, `SWING`, `curveT`, `CROSSOVER` 0.46, `JOURNEY_END`
0.90, `SCRUB`, `PARALLAX`, Lenis lerp 0.1.

**Lighting and grade** — key direction/energy/colour, hemisphere, ambient,
`RoomEnvironment` intensity, exposure (0.75 daylight / 1.0 dusk), ACES tone
mapping, `GRADE_LOOK`, `GRADE_RIG`, the equirect background's derivation and
orientation.

**Geometry and materials** — the locked Blender source (mtime 2026-08-27
22:43:35); production `v5` (`d7a7e945…`); p31–p34, p25b–p25b3, p4a–p4d; all 15
Phase 4 material definitions including the roof winding, roof base-colour, roof
roughness representation and the retired paving multiply; the interior asset and
route.

**Two items I will need to touch and will stop and report before doing so:**
1. The **daylight fog band** `Fog(#5E6147, 60, 220)`. Weakness 2 cannot be
   fixed without either changing it or adding a ground-edge treatment. It is a
   locked grade value, so P5B will present the measured case first.
2. `MAT_Water`'s roughness/transmission, set in **P4D**. Weakness 5 is inside a
   Phase 4 decision. P5G will present measurements before changing it.

Neither is changed in P5A.

---

*Instruments in `tools/capture/` and `tools/gltf/phase5_*.py`; captures in
`tools/capture/out/`. No authoring has been performed.*
