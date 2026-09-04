# PHASE 5 — FINAL REPORT

**Verdict: PASS for P5A–P5G and P5I–P5J, with P5H not authored and stated as an omission.**
**Recommended candidate: `p5g`.** Default resolver untouched at `v5`.

Starting commit `cd592aa` · final commit see §16 · branch `main`.

---

## 1. Executive summary

Phase 5 changed the property, not the building. Nine things moved, every one of
them because a measurement said so:

1. **The ground was a sampling-rate defect, not a look.** One 1024 map clamped
   across 240 m (0.2344 m/texel) against cameras that need 0.0197 m/pixel — a
   **12–15× magnification** across 25–47% of every frame, with no normal map and
   no AO. Replaced with tiling turf and gravel at 6.0 m, correctly sampled at
   every distance the sequence uses.
2. **A meso layer in COLOR_0** carrying what a tile cannot know about this site:
   damp hollows off the real height field, a wear halo against every hardscape
   footprint, and a 20–60 m mottle that breaks the 6 m tile.
3. **An arrival exists.** 1,960 triangles of gravel turning circle and approach
   where the drive was previously 1.2% of a zone mask at 0.23 m/texel.
4. **The ground's edge dies inside the fog** — extended to a 260 m circular rim.
5. **Hardscape meets lawn on a built edge**, 498 triangles of flush stone edging.
6. **The planting has a surface.** Hedge and cypress were bare
   `baseColorFactor`s with no map of any kind.
7. **The fountain water was opaque, not dark** — its transmission tint passed 3–7%
   of a basin floor that renders at L 116. Water **L 16.4 → 84.1**.
8. **A locked P4A source had silently drifted** and gitignore hid it; found,
   restored byte-for-byte, and the tooling defect that caused it fixed.
9. **Two of my own decisions were reversed by measurement** — the first lawn
   albedo, and the whole of P5J's optimisation.

Nothing locked moved. `v5` is `d7a7e945…`, `p4e` is `88d46e24…`, the locked
blend's mtime is unchanged, and all five Phase 4 stone sources re-verify
byte-identical against the shipped p4e.

---

## 2. Starting state

From [PHASE5_INVENTORY.md](PHASE5_INVENTORY.md), measured not assumed: p4e at
11.04 MB, 479 mesh nodes, 15 materials, 179,397 triangles, 947 HERO draw calls,
49.32 MB GPU texture residency (BC7, verified compressed). Environment: one
`ground_plane`, three hedge boxes, 14 cypress cones, three paving slabs, two
steps, a ten-part fountain. **No driveway, no lawn geometry, no props, and no
exterior vegetation asset anywhere in the library.**

Screen coverage, from an emissive-id render (occlusion and silhouette included):

| | HERO | WEST | NW |
|---|---|---|---|
| ground plane | **47.07 %** | **31.87 %** | **25.24 %** |
| whole mansion (shell+roof+masonry) | 15.5 % | 13.9 % | 20.0 % |

The ground held **1.9–3.0× the screen area of the entire building**.

---

## 3. P5A — Ground surface

**Problem.** 0.2344 m/texel against a ray-cast requirement of 0.0197 m/px at
HERO and 0.0153 at NW. Below mip 0 there is nothing to sample.

**Diagnosis.** A frequency problem, so re-baking a better 240 m map cannot fix
it. Only a *tiling* set can.

**Implementation.** 6.0 m tile = 0.00586 m/texel — a 3.4× *minification* at the
near HERO ground (mip ~1.75) instead of a 12× magnification, still correctly
sampled at the horizon. Both sets normalised so their linear mean equals the
authored target, which makes the mip tail — the far field — the intended colour
by construction. The tile lives in the **mesh UVs** (world x,y / 6.0), not a
Mapping node, because P4A lost a tile change to `KHR_texture_transform`. Plus
COLOR_0 meso and `drive_forecourt`.

**The albedo was solved, and my first attempt was wrong.** v1 rendered the lawn
at **L 81.3 against the mansion's 100.4 — ratio 0.81**, where the shipped ground
sat at 0.70. A surface holding 43.7% of the frame at 81% of the hero's value is
the mansion losing dominance. A two-point fit of the runtime's own response over
two real renders gives `rendered = a·source + c`, **a = (0.431, 0.465, 0.491),
c = (0.0341, 0.0304, 0.0195)** — half the albedo survives on top of a large
additive fill, and that `c` is exactly why a textbook grass green renders as
neutral olive.

**Measured (HERO daylight, id-mask basis, pose error 0.000 m):**

| | p4e | p5a |
|---|---|---|
| lawn L | 70.56 | **70.51** |
| lawn R/G | 0.929 (olive) | **0.828 (green)** |
| lawn sd | 14.36 | **15.75** |
| drive | — | L 94.93, sd 33.64 |

Identical luminance, materially greener, real surface variation. **Every other
class moved ≤ 0.02.** Coverage: terrain 47.07 → 43.73 with drive 3.29 — the
drive occupies exactly the lawn it replaced.

**Performance.** +1,960 triangles, +2 draw calls (the drive is drawn twice
because `MAT_Water`'s transmission pass re-renders the opaque scene — **not**
the shadow map; `drive_forecourt` is verified `castShadow:false` in the live
scene), 16 materials, 54.65 MB GPU.

---

## 4. P5B — Atmospheric continuity

**Problem.** The plane's far edge at rows 359–431 of 900 at WEST, against a
photographic backdrop. P5A made it *more* visible.

**Diagnosis.** Not a fog problem. The plane is ±120 m so its edge sits ~146 m
from the WEST camera, where `Fog(60, 220)` has reached **54%**. Two ways to close
it — move the fog in, or move the edge out. The fog is locked and tuned so the
building renders unfogged; the edge is not locked and is simply too close.

**Implementation.** The ground's own boundary extruded to a **260 m circular
rim** — same object, same material, **no new draw call**. Both radius and shape
are derived, and the first attempt was wrong in a way the authoring script's own
assertion caught: a ±320 m *square* rim clears the fog (nearest 266 m) but throws
its corners to **486 m, past the 400 m far plane**, where the clip would draw a
fresh hard edge. A circular rim varies only by the camera's own offset, so r=260
clears both: nearest **226/234/236 m**, farthest **294/286/284 m**. Asserted per
camera over 720 directions.

**The right acceptance measurement is the STEP, not the edge's position** —
ground at 146 m and 260 m both project within a few pixels of the horizon, and
extending the plane moved the WEST silhouette's top row by **two pixels**.
`phase5_seam.mjs` measures the luminance and hue step across the edge; **its
first version was contaminated** (the five worst WEST columns were the mansion
standing above the far ground) and it now rejects any column whose outside band
is not true backdrop — 137 of 356 at WEST.

| mean step | p4e | p5b |
|---|---|---|
| HERO | 18.59 | **16.02 (−13.8 %)** |
| WEST | 26.47 | **22.84 (−13.7 %)** |
| NW | 20.08 | **19.18 (−4.5 %)** |
| WEST hue step | 0.0972 | **0.0526 (−46 %)** |

**Stop condition discharged: the locked fog stays.** The residual has a different
cause — the fully-fogged ground reads L 81.6 at WEST against a backdrop of 60.1.
A live sweep of five haze values (original restored and verified afterwards)
shows the backdrop's own horizon varies **74.7 / 60.1 / 69.3** by camera because
it is a photograph, so darkening the fog trades cameras: `#3E4238` takes WEST to
14.57 and NW to 16.08 but HERO to **21.16**, monotonically worse. The shipped
value is already optimal for the frame the site opens on. **Not changed.**

---

## 5. P5C — Transitions

498 triangles of 280 mm flush stone edging around `terrace_lower` (entirely
outside its footprint, so nothing is coplanar) and along the forecourt's arc and
approach flanks. A real construction detail — it stops gravel migrating into
turf and gives the mower a wheel to run on — sitting 30 mm above the ground and
110 mm below the terrace top, so it reads as the kerb the terrace sits behind.
`MAT_Stone_Trim` reused by name: **no new texture, image, material or program.**
Max residual against the sampled ground **0.000 mm**.

---

## 6–7. P5D / P5E — Hedge and cypress

Both were bare `baseColorFactor`s with no map of any kind, holding 3.8 % of HERO
and 5.8 % of NW and rendering as near-black cutouts. Both move to 1.5 m tiling
sets with box-projected world-scale UVs.

**The tile carries clumps, not leaves, and that is a measurement.** The hedge
stands 13 m from HERO at 0.010 m/px, so a 40 mm box leaf is **0.4 px**. Leaf
detail would sit below every camera's Nyquist limit and buy sparkle. The sets
carry 150–400 mm clump structure, the shear plane a clipped hedge shows, and —
for the cypress — a noise lattice stretched **3:1 along v** because its sprays
run up the tree.

| HERO daylight | p5c | p5e |
|---|---|---|
| hedge L / sd / R/G | 52.30 / 20.25 / 0.810 | **53.61 / 21.73 / 0.851** |
| cypress L / sd / R/G | 44.19 / 15.81 / 0.816 | **44.88 / 15.58 / 0.845** |

At NW where the cypress is largest, sd **10.94 → 14.95 (+37 %)**; at dusk
**9.14 → 12.16 (+33 %)**. **Every unrelated class ≤ 0.04** at every camera.

**Deliberately not changed, with the reason measured.** The hedge geometry: a
clipped hedge's batter is ~40 mm over a 1.0 m height — **four pixels**. The open
front of the boundary: that gap is the arrival.

---

## 8. P5F — Arrival: a justified no-op

The arrival was delivered by P5A and P5C. What remained — gate piers at z 19, a
treatment where the approach meets the far field at z 34 — fails the mandate's
own visibility test: the HERO camera stands at z 27 looking toward the origin,
so both sit behind or below its frame, and the drive measures 0.92 % at WEST and
0.41 % at NW. **Nothing added.** Recorded rather than silently skipped.

---

## 9. P5G — Fountain water

**The water was not dark, it was opaque.** In glTF a transmissive material's
`baseColorFactor` is its *transmission tint*. `MAT_Water` carried
(0.03, 0.06, 0.07), passing 3–7 % of a basin floor that renders at L 116.

**Derived, not chosen.** Water at y 0.40 over a floor at 0.05–0.14 → **0.26 m**
depth, light path twice that. Clear-water absorption (0.270/0.050/0.020 per m at
600/500/450 nm) → transmittance **(0.869, 0.974, 0.990)**; ×0.86 for a stone
basin's turbidity → **(0.747, 0.858, 0.851)**. The shipped value was **25×/14×/12×
too dark**.

**Roughness untouched, and that is a measurement too:** at ~30° incidence an
ior 1.333 surface reflects **2.5 %**, so 97 % of what the water shows is
transmission. P4D's 0.07 stands.

| | p5e | p5g |
|---|---|---|
| water L (HERO) | 16.41 | **84.05** |
| water sd (HERO) | 3.54 | **13.23** |
| water L (WEST) | 30.85 | **100.68** |

**Every other class ≤ 0.04.** Cost: **zero** — one factor.

---

## 10. P5H — Secondary detail: NOT AUTHORED

**This is an omission, not a decision, and the difference matters.**

- **BLOCKER:** scope/effort budget exhausted before this pass could be authored
  and validated to the standard the rest of Phase 5 was held to.
- **CAUSE:** P5A consumed disproportionate effort (two albedo iterations, a
  drifted locked source, two Blender exporter defects) and the measurement
  instrument itself needed three corrections.
- **EVIDENCE:** the one candidate that passes the visibility test is a pair of
  entrance urns — the entry steps sit 29 m from HERO at 0.024 m/px, so a 0.8 m
  urn is ~33 px tall, which is visible. It would also need a modelled asset (the
  library holds no exterior prop) and a material.
- **ATTEMPTED:** nothing. It was not started rather than started and abandoned.
- **WHY IT CANNOT SAFELY PROCEED HERE:** authoring geometry and a material
  without the measure→author→compare loop the other eight passes used would put
  an unvalidated object into a candidate chain whose whole value is that every
  element in it is accounted for.

**Recommendation: run P5H as a short follow-up.** Two entrance urns and dusk
path lighting are the two items with a real case.

---

## 11. P5I — Composition

Evaluation, not authoring. Judged at the four validated cameras against §14 of
the mandate.

- **Architectural dominance holds.** Lawn/mansion value ratio **0.70** (p4e was
  0.70; P5A v1 would have compressed it to 0.81 and was corrected). The masonry
  at 132.9 and the terrace at 116.1 remain the brightest large surfaces; the
  lawn at 70.5 and the drive at 94.9 sit under both.
- **The hierarchy the mandate asks for is present in the numbers:** mansion >
  terrace > drive > lawn > hedge > cypress at HERO.
- **Arrival is readable** — 3.29 % of HERO, a turning circle around the fountain
  with a kerbed edge, reaching the terrace on the entry axis.
- **NW spends nothing on the invisible**: fountain and steps are 0.00 % there and
  no Phase 5 work was directed at them.
- **Nothing found that needed correcting** which was not already a P5J item.
  No candidate file.

---

## 12. P5J — Performance: one optimisation, measured and REJECTED

The two foliage normal maps are Phase 5's largest single cost (~1 MB each on the
wire). ETC1S instead of UASTC took them to 336,783 and 297,246 bytes — **−67 %
and −71 %**, 16.60 → 15.27 MB. The repository's own earlier finding said this
should be safe: ETC1S was rejected for v5 because it facets across large *flat*
surfaces, and foliage has none.

**It was not safe.** Masked against p5g at the same poses:

| | p5g | p5j (ETC1S) |
|---|---|---|
| hedge L, WEST | 48.10 | **32.24 (−15.9)** |
| cypress L, WEST | 56.74 | **43.54 (−13.2)** |
| cypress L, NW | 66.44 | **40.91 (−25.5)** |
| cypress sd, NW | 10.95 | **22.85** |

Luminance falls and deviation nearly doubles together — the codec quantises the
normal erratically enough to tilt whole clumps away from the key, so the planting
darkens *and* goes blotchy. **1.3 MB is not worth 25 luma on the largest soft
mass in the NW frame. Reverted.** A pruned p5j came out byte-identical to p5g
(every candidate was pruned as it was built) and was deleted rather than shipped
as a duplicate.

---

## 13. Candidate matrix

| | change | GLB | tris | HERO calls | GPU tex | status |
|---|---|---|---|---|---|---|
| p4e | Phase 4 baseline | 11.04 MB | 179,397 | 947 | 49.32 MB | baseline |
| **p5a** | ground surface + COLOR_0 + forecourt | 15.38 / 14.28 pruned | 181,357 | 949 | 54.65 MB | superseded |
| **p5b** | + 260 m ground extension | 14.35 MB | 184,429 | 949 | 54.65 MB | superseded |
| **p5c** | + 498 tri stone edging | 14.35 MB | 184,927 | 951 | 54.65 MB | superseded |
| **p5d** | + hedge surface | 15.48 MB | 184,927 | 951 | ~58 MB | superseded |
| **p5e** | + cypress surface (+224 tri retriangulation) | 16.60 MB | 185,151 | 951 | 62.65 MB | superseded |
| p5f | — | — | — | — | — | **no-op, justified** |
| **p5g** | + water transmission tint | 16.60 MB | 185,151 | 951 | 62.65 MB | **RECOMMENDED** |
| p5h | — | — | — | — | — | **not authored** |
| p5i | — | — | — | — | — | evaluation only |
| p5j | ETC1S foliage normals | 15.27 MB | — | — | — | **rejected on measurement** |

---

## 14. Camera validation

All captures **pose-verified**: the rig is held until 12 consecutive frames move
< 4 mm and the settled position is asserted against the beat.

| beat | pose error | settled |
|---|---|---|
| HERO daylight | **0.0000 m** | yes |
| WEST daylight | 0.0187 m | yes |
| NW daylight | 0.0238 m | yes |
| HERO dusk | **0.0000 m** | yes |

Coverage, p4e → p5g:

| class | HERO | WEST | NW |
|---|---|---|---|
| terrain | 47.07 → 43.76 | 31.87 → 31.00 | 25.24 → 24.87 |
| drive | — → 3.29 | — → 0.92 | — → 0.42 |
| mansion / terrace / roof / masonry | unchanged to ±0.01 | unchanged | unchanged |

---

## 15. Regression validation

| | result |
|---|---|
| typecheck | **5/5 successful** |
| tests | **266 passing** (188 domain, 30 db, 48 public) |
| lint | **0 errors** (pre-existing warnings only) |
| production build | clean, on a deleted `.next` |
| console errors, all four exterior captures | **0** |
| console errors, `/hall` | **0** |
| interior | untouched — no Phase 5 change reaches it |
| `EXTERIOR_MODEL_URL` | `'/models/exterior_mansion_v5.glb'` — **unchanged** |
| v5 sha256 | `d7a7e945…87bc87c3` — **unchanged** |
| p4e sha256 | `88d46e24…7ef66ee` — **unchanged** |
| p25b/p25b2/p25b3, p31–p34, p4a–p4d, interior | all unchanged |
| locked Blender source | mtime 2026-08-27, unchanged |
| Phase 4 stone sources vs shipped p4e | **5/5 MATCH byte-for-byte** |
| Phase 4 controls inside every patch run | passed byte-for-byte every time |

**Frame timing is not reported.** The headless rAF rate ran 73–102 /s with vsync
off, which is not what a visitor's device does.

---

## 16. Performance, baseline vs final

| | p4e | p5g | Δ |
|---|---|---|---|
| GLB | 11.04 MB | 16.60 MB | +5.56 MB |
| unique triangles | 179,397 | 185,151 | +5,754 (+3.2 %) |
| HERO draw calls | 947 | 951 | +4 |
| HERO submitted triangles | 354,562 | 365,846 | +11,284 |
| materials | 15 | 17 | +2 |
| textures | 37 | 47 | +10 |
| GPU texture residency (BC7) | 49.32 MB | 62.65 MB | **+13.33 MB** |

The texture residency is the honest cost, and it is concentrated: the four new
1024² normal maps (turf, gravel, hedge, cypress) are ~1.3 MB each. The one
optimisation available for them was measured and rejected (§12).

---

## 17. Known residuals

1. **The ground/backdrop seam is improved 14 %, not solved.** The residual is
   the fog colour standing against a photographic backdrop whose horizon
   brightness varies 60–75 luma with azimuth. No single fog colour fixes all
   three cameras; the shipped value is optimal for HERO. Closing it properly
   needs per-direction haze — a shader change to a locked system.
2. **P5H was not authored** (§10). Two entrance urns and dusk path lighting have
   a real case and were not built.
3. **Phase 5 costs +13.33 MB of GPU texture residency** and the only compression
   lever was rejected on measurement. A 512² normal for the cypress (which is
   never nearer than 40 m) is an untested option.
4. **The cypress geometry gained 224 triangles** from Blender 5.2 fanning the
   cone's n-gon base differently from the build that produced v5. Shape identical
   to 5 mm; waived deliberately.
5. **The per-class luminance instrument is fragile.** Reading the WebGL canvas
   under `preserveDrawingBuffer:false` depends on rAF ordering; the probe now
   reports `shadeUnavailable` rather than zeros, and two of eight final captures
   hit that path. Every number in this report comes from a capture where the
   guard passed. A durable fix is to render the composited frame to a render
   target the probe owns.
6. **The lawn is greener than the backdrop's meadow** (R/G 0.83 vs the plate's
   own hue). Deliberate — a maintained lawn should differ from rough pasture —
   but it is part of why the seam persists.
7. **Dusk lawn is +4.2 luma** over p4e, a side effect of the daylight-solved
   albedo. Small, reported, not separately corrected.

---

## 18. Final recommendation

**PASS**, for P5A–P5G and P5I–P5J, with P5H stated as an omission rather than a
completed pass.

The success criterion was: *the mansion no longer looks like a 3D building placed
inside an environment.* The evidence that it is met is not a screenshot — it is
that the largest surface in every frame went from carrying no information at its
own sampling rate to being correctly sampled at all of them; that the arrival,
the boundary and the planting all now have material and construction where they
had constants; that the water shows its basin; and that the mansion's dominance
is numerically **unchanged** (lawn/mansion 0.70 before and after) because the
one change that would have compressed it was caught and corrected.

**Promote `p5g`** — the last candidate that carries every accepted change and
none of the rejected one.

```
?model=p5g   →   EXTERIOR_MODEL_URL = '/models/exterior_mansion_v6_p5g.glb'
```

Before promoting, note that p5g is built on **p4e**, which is itself not yet
promoted — promoting p5g therefore promotes the whole Phase 4 surface system
with it. That is a single decision, not two, and it should be taken as one.
