# PHASE 5 — FINAL REPORT

**Verdict: PASS for P5A–P5J.** P5H is authored in part: the entrance urns are
**accepted on measurement**, the dusk arrival lighting is **rejected on
measurement**. P5F remains a justified no-op; P5I and P5J are evaluation and
revalidation passes, not authored candidates.

**Recommended candidate: `p5h`.** Default resolver untouched at `v5`.

Starting commit `cd592aa` · P5H revalidation started from `5e17ac4` · branch
`main`. Final commit in §16.

> **This revision corrects two claims made by the previous revision of this
> report.** §5 said P5C's stone edging "reads as construction"; it renders
> **1 pixel at HERO and 0 at WEST and NW** and is inside-out (§12). §16 counted
> "materials 15 → 17"; one of those two is not a material but an accidental
> **fork** of `MAT_Stone_Trim` caused by the same P5C object (§12). Both were
> found by P5H's own material and coverage analysis and are corrected below.

---

## 1. Executive summary

Phase 5 changed the property, not the building. Eleven things moved or were
settled, every one of them because a measurement said so:

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
5. **Hardscape was given a built edge** — 498 triangles of flush stone edging
   which, it turns out, **does not render at all**: it is wound inside-out
   against a single-sided material and measures 1 px at HERO. Found by the P5H
   revalidation, diagnosed, and left in place with a fix specified (§12).
6. **The planting has a surface.** Hedge and cypress were bare
   `baseColorFactor`s with no map of any kind.
7. **The fountain water was opaque, not dark** — its transmission tint passed 3–7%
   of a basin floor that renders at L 116. Water **L 16.4 → 84.1**.
8. **A locked P4A source had silently drifted** and gitignore hid it; found,
   restored byte-for-byte, and the tooling defect that caused it fixed.
9. **The entrance had two pedestals with nothing on them.** `entry_cheek_±1`
   are step cheeks built to carry something; a pair of campana urns in the
   estate's own existing urn vocabulary now do, at 35 px and 0.07 % of the HERO
   frame for +856 triangles and **zero** texture, material or light cost.
10. **The dusk arrival did not need a light, and a light would have hurt it.**
   Swept live and restored: two step lamps raise the terrace 6.0 and the urns
   15.2 luma while moving the building 1.7, widening the terrace-over-masonry gap
   by 73 % and putting two sourceless pools on the paving. Rejected.
11. **Four of my own decisions were reversed by measurement** — the first lawn
   albedo, P5J's ETC1S optimisation, P5H's dusk lighting, and a Draco-quantisation
   diagnosis of the edging defect that a discriminating test proved wrong.

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

## 5. P5C — Transitions — **AUTHORED, BUT IT DOES NOT RENDER**

498 triangles of 280 mm flush stone edging around `terrace_lower` (entirely
outside its footprint, so nothing is coplanar) and along the forecourt's arc and
approach flanks, 30 mm above the ground and 110 mm below the terrace top.
`MAT_Stone_Trim` reused by name. Max residual against the sampled ground
**0.000 mm**.

**The previous revision of this report claimed it "reads as construction rather
than as ornament". It does not read at all.** Isolated in an id pass by the P5H
revalidation, `edging_hardscape` measures **1 px at HERO, 0 at WEST, 0 at NW**,
against a working control in the same pass (terrace 81,222 px) and against the
~3,800 px its geometry predicts. It is **inside-out** — see §12 for the
diagnosis, the discriminating test that ruled out the alternative explanation,
the root cause in the authoring script, and the recommended fix. It is left
in place: it is a P5C defect, not P5H's subject, and fixing it changes an
accepted candidate's appearance.

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

## 10. P5H — Secondary detail: one element accepted, one rejected

P5H was run as two independent hypotheses, each measured on its own.

### 10.1 Entrance urns — **ACCEPTED**

**The problem was not "the scene is sparse".** The entrance already had two
pedestals with nothing on them. `entry_cheek_-1` and `entry_cheek_1` are the
flanking blocks either side of the entry steps — x ±2.500..3.000, z 5.600..6.800,
flat top at y 0.600 — step cheeks built to carry something. A classical entrance
whose cheeks are bare is unfinished, and at HERO those cheeks project to x 970
and 1138 of a 1425 px frame, unoccluded, 30.6 m from the eye.

**No new visual language was introduced**, because the estate already has an urn
vocabulary: `finial_urn_0..3` stand on `finial_plinth_0..3` at the spire base in
`MAT_Stone_Trim`. This is the same idea at ground-floor scale in the same
material.

**Measured BEFORE anything was modelled.** `tools/gltf/p5h_visibility.py`
projects a proposal through the runtime's own five cameras:

| beat | dist | m/px | H px | W px | in frame | occluded |
|---|---|---|---|---|---|---|
| HERO | 30.65 | 0.02451 | **35.1** | 18.8 | yes | no |
| WEST | 24.93 | 0.02485 | **34.6** | 18.5 | yes | no |
| NW | 28.97 | 0.02788 | 30.8 | 16.5 | yes | by the mansion |
| TURN / CONSTELLATION | — | — | — | — | **behind the camera** | — |

The same tool measured, and thereby **rejected**, two other candidates before any
effort went into them: a gate pier at the drive mouth misses the frame by
1862 / 2528 / 120 px, and a forecourt-kerb path lamp by 96 / 561 / 63 px. That
also independently confirms **P5F's no-op was correct**.

**35 px decided the design.** No surface ornament — gadrooning, fluting, handles,
an acanthus collar are all 1–2 px here and would buy sparkle. The silhouette
carries the read, so the form is a **campana urn** (widest at the mouth, read
against the terrace and sky rather than lost against the pedestal) with a lidded
top that closes the geometry with no interior to model. **16 radial segments,
from the silhouette error rather than habit**: an n-gon deviates from its circle
by R(1−cos(π/n)), which at R = 8.5 px is 0.65 px at n=8, 0.29 at n=12 and 0.16 at
n=16 — against the ~0.3 px anti-aliasing resolves. Bedded 8 mm into the cheek so
no two faces are coplanar; the script asserts the die sits inside the cheek's
**flat top** (it is a chamfered box, so "inside the bbox" is not sufficient),
that nothing is coplanar, and that the pair is symmetric about x = 0.

**COLOR_0 was not optional.** `MAT_Stone_Trim` multiplies base colour by the
`StoneAO` attribute through a `ShaderNodeMix` (RGBA / MULTIPLY / Factor 1), and
three's `GLTFLoader` carries `vertex-colors:` in its material cache key — so a
primitive without the attribute both renders unmultiplied and forks a second
material instance. The urns are baked with `tools/blender/bake_ao_raycast.py` at
the same 0.40 floor as the rest of the stone. Verified in the live scene: **16
material names → 17 instances on p5g and on p5h**, so the urns joined the
39-primitive vertex-coloured side and forked nothing.

The bake lands at mean **0.714**, which is where it belongs in its own family:

| object | mean StoneAO |
|---|---|
| `finial_plinth_0..3` | 0.812 |
| `finial_urn_0..3` (the estate's own urns) | 0.786 |
| `portico_cymatium` | 0.753 |
| `terrace_lower` | 0.726 |
| **`urn_entry_±1`** | **0.714** |
| `terrace_upper` | 0.702 |
| `portico_cornice` | 0.630 |
| `entry_cheek_±1` (what they stand on) | 0.595 |

**Measured through the page, pose-verified to sub-millimetre** (p5h 0.0000 /
0.0072 / 0.0073 / 0.0000 m against p5g 0.0000 / 0.0079 / 0.0074 / 0.0000):

| | HERO | WEST | NW | HERO dusk |
|---|---|---|---|---|
| urn coverage | **0.07 %** | 0.04 % | **0.00 %** | 0.07 % |
| urn L | **100.85** | 79.76 | — | **132.03** |
| urn sd | 23.93 | 22.97 | — | 30.66 |

Isolated against a working control, the pair renders **938 px at HERO** and
**546 at WEST**, and is **completely occluded by the building at NW** — exactly
what the pre-authoring audit predicted, so nothing was spent on a camera that
cannot see it.

**Subordinate, which is the acceptance test and not an opinion.** At HERO:
masonry 133.02 > terrace 116.10 > steps 109.88 > **urn 100.85** > drive 94.91 >
lawn 70.52 > hedge 53.55 > cypress 44.87. **Every unrelated class moved ≤ 0.14
at HERO and ≤ 0.11 at dusk.** The two that moved are the two that should:
`steps` −0.27 L and −0.02 pp at HERO, because the urns stand on the cheeks and
shade them. At WEST `steps` reads −6.83 — that is a **masking artefact, not a
darkening**: the class is only 0.10 % of frame there and the urns occlude its
brightest 30 %, leaving a darker remainder.

**Cost:** +2 nodes, +856 triangles, +2 geometries, +4 HERO draw calls (2 objects
× the transmission pass), +1,712 submitted triangles, **+15.3 KB** on the wire.
Materials 17 → 17, textures 47 → 47, **GPU texture residency 62.65 → 62.65 MB —
exactly zero**. Lights 9 and shadow casters 1, unchanged.

### 10.2 Dusk arrival lighting — **REJECTED on measurement**

The report's own second hypothesis: at dusk there is no exterior lighting beyond
window glow, so the arrival should get a restrained source. **Tested the way the
fog stop-condition was tested** — swept on the live scene by
`tools/capture/p5h_lightsweep.mjs` and restored, verified (9 lights before, 9
after, baseline re-measured to ±0.11) — rather than by editing a shared lighting
rig on a hypothesis. A lighting change cannot live in a candidate GLB; it lives
in `WorldCanvas` and would apply to v5 and p4e too.

Two warm point lights at the foot of the steps — the only in-frame lamp station
of the three tested. Δ luminance at HERO dusk:

| class | i = 2.0 | i = 4.4 | i = 8.0 |
|---|---|---|---|
| **urn** | +7.38 | **+15.23** | **+26.01** |
| terrace | +2.92 | +5.99 | +10.05 |
| steps | +1.96 | +4.28 | +7.98 |
| masonry | +1.28 | +2.83 | +5.22 |
| **mansion** | +0.76 | **+1.67** | +3.12 |

**It brightens the ground and the ornament, not the architecture.** The terrace
already outruns the masonry at dusk (130.53 vs 126.21); the lamp widens that gap
by **73 %** at i = 4.4. The urns — a secondary detail — gain **four times** what
the building does, reaching 158 at i = 8.0, second only to the steps. That is
§14's failure exactly: a new focal point competing with the building. The frame
confirms it — **two circular pools on the paving with no fixture to explain
them**, the "sticker" read this rig's own source comments already document for
point lights on flat surfaces.

**And the cost lands on the shipping look.** Daylight ships; `?grade=dusk` is the
rollback. three's `WebGLLights.setup()` increments `pointLength` unconditionally
— there is no `intensity === 0` skip, verified in the installed source — so a
dusk-only light still costs a per-fragment loop iteration **in daylight**, where
it contributes nothing. Paying that, plus a fixture mesh, a new emissive material
and a new program, to make a non-shipping grade worse is not a trade worth
making.

**The urns already deliver the dusk arrival at zero lighting cost:** L **132.03**
at dusk against **100.85** in daylight, because they stand 2.75 m from the
entrance rectAreaLight and catch the wash that is already there. What the
hypothesis wanted was geometry, not light.

---

## 11. P5I — Composition, revalidated after P5H

Evaluation, not authoring; re-run because P5H could have moved the hierarchy.

- **Architectural dominance holds.** Lawn/mansion value ratio **0.70**, unchanged
  from p4e and p5g. Masonry 133.02 and terrace 116.10 remain the brightest large
  surfaces; the urns at 100.85 sit under both.
- **The mandate's hierarchy is present in the numbers at HERO:** masonry >
  terrace > steps > urn > drive > lawn > hedge > cypress. Mansion coverage
  8.48 → 8.46 %, terrain 43.76 → 43.76 %, sky 21.71 → 21.71 % — the building's
  share of frame is unchanged to a hundredth.
- **The new detail reinforces rather than competes.** 0.07 % of frame, a
  symmetric pair on the entry axis, below both large stone surfaces in value.
- **Dusk is coherent and improved without a new light** (§10.2).
- **NW spends nothing on the invisible**: the urns are 0.00 % there, as predicted
  before they were built.
- **No camera change was needed to make anything work.** No candidate file.

---

## 12. P5J — Performance, revalidated: the ETC1S rejection stands, and P5C does not render

**The ETC1S optimisation is not resurrected.** The two foliage normal maps remain
UASTC. The earlier measurement stands and was not re-litigated: ETC1S took hedge
WEST 48.10 → 32.24 (−15.9), cypress WEST 56.74 → 43.54 (−13.2), cypress NW
66.44 → 40.91 (−25.5) with sd rising 10.95 → 22.85. 1.3 MB is not worth 25 luma
on the largest soft mass in the NW frame.

**The revalidation found something else, and it is in P5C.**

`edging_hardscape` renders **1 px at HERO and 0 at WEST and NW**, against a
working control in the same isolated pass (terrace 81,222 / 81,551 / 83,477 px)
and against the ~3,800 px its geometry predicts at HERO.

**Diagnosis, with the wrong answer ruled out first.** The obvious hypothesis was
depth: the ground plane's 520 m extent gives a Draco 14-bit position quantum of
**31.74 mm**, and P5C lifts the edging **30 mm** — the clearance is smaller than
the ground's own quantisation step. That is true and it is **not the cause**.
Re-rendering the object with `depthTest` disabled returns **0 px**, where the
same switch moves the urns 938 → 950. The pixels are not losing a depth fight;
they are never drawn.

**The cause is winding.** `edging_hardscape` has 249 polygons of which **229
carry a normal pointing at the ground** (mean normal z **−0.839**), and
`MAT_Stone_Trim` is `doubleSided: false`. Nine tenths of the object is
backface-culled. `tools/blender/p5c_transitions.py` builds each ribbon quad from
a point order that depends on the traverse direction and **never calls
`bmesh.ops.recalc_face_normals`**; its own assertion checks vertex Z against the
sampled ground to 1e-4, which is a **position** check and says nothing about
winding. An assertion that was true in the authoring space and meaningless in the
shipped one.

**What it costs the shipped candidate:** 498 triangles that draw nothing, plus a
**fork of `MAT_Stone_Trim`** — the object is also the only one of 37 trim
primitives in p5g with no `COLOR_0`, and three's `GLTFLoader` caches a second
material instance for it. Measured in the live scene: p4e 15 names / **15
instances**, p5g and p5h 16 names / **17 instances**, the extra one being
`edging_hardscape`. So the "+2 materials" the previous revision attributed to
Phase 5 is really **one real material (`MAT_Gravel`) and one accidental fork**.

**Not fixed here, deliberately.** It is a P5C defect, not P5H's subject; the fix
would make a kerb line **appear** that has never been seen, which is a visual
change to an accepted candidate needing its own four-camera acceptance pass. It
is pre-existing in p5g and affects no p5h measurement. **Recommended follow-up:**
add `bmesh.ops.recalc_face_normals` to `p5c_transitions.py`, give the object a
`StoneAO` attribute so it stops forking the material, re-export and re-verify at
all four cameras — and while there, raise the 30 mm lift clear of the ground's
31.74 mm quantum.

**Load, cold context, `[exterior_ready]`:** p5g **1181 ms** / 16,537,194 B;
p5h **1168 ms** / 16,552,855 B. The 13 ms is run-to-run noise on localhost with
no throttling and **is not claimed as an improvement**; the honest number is
**+15.3 KB on the wire for no measurable load cost**.

**Frame timing is still not reported.** The headless rAF rate ran 62–101 /s with
vsync off, which is not what a visitor's device does.

---

## 13. Candidate matrix

| | change | GLB | tris | HERO calls | GPU tex | status |
|---|---|---|---|---|---|---|
| p4e | Phase 4 baseline | 11.04 MB | 179,397 | 947 | 49.32 MB | baseline |
| **p5a** | ground surface + COLOR_0 + forecourt | 15.38 / 14.28 pruned | 181,357 | 949 | 54.65 MB | superseded |
| **p5b** | + 260 m ground extension | 14.35 MB | 184,429 | 949 | 54.65 MB | superseded |
| **p5c** | + 498 tri stone edging — **does not render, §12** | 14.35 MB | 184,927 | 951 | 54.65 MB | superseded |
| **p5d** | + hedge surface | 15.48 MB | 184,927 | 951 | ~58 MB | superseded |
| **p5e** | + cypress surface (+224 tri retriangulation) | 16.60 MB | 185,151 | 951 | 62.65 MB | superseded |
| p5f | — | — | — | — | — | **no-op, justified, re-confirmed §10.1** |
| **p5g** | + water transmission tint | 16.60 MB | 185,151 | 951 | 62.65 MB | superseded |
| **p5h** | + two entrance urns | **16.62 MB** | **186,007** | **955** | **62.65 MB** | **RECOMMENDED** |
| p5h (lighting) | dusk arrival lamps | — | — | — | — | **rejected on measurement, §10.2** |
| p5i | — | — | — | — | — | evaluation only, re-run |
| p5j | ETC1S foliage normals | 15.27 MB | — | — | — | **rejected on measurement** |

Candidate files on disk: `p5a`, `p5b`, `p5c`, `p5d`, `p5e`, `p5g`, `p5h`. No
`p5f`, `p5i` or `p5j` file exists, and none should — those passes produced
findings, not assets. No duplicate or byte-identical candidate is retained.

`p5h` sha256 `1fbafd0929699de67456912045f82491c5e5bb6eb8a8c4cedb50ed07b0f34c4b`.

---

## 14. Camera validation

All captures **pose-verified**, and the verification itself was corrected during
this pass. The old test — 12 consecutive frames moving under 4 mm — is
**frame-rate dependent**: the rig is a first-order lag, so per-frame movement is
proportional to frame time, and a faster run takes smaller steps and trips a
fixed threshold *earlier*, further from the beat. The first p5h run did exactly
that: 94–101 rAF/s and a settled pose **0.157 / 0.174 / 0.164 m** from the beat
against p5g's 0.000 / 0.014 / 0.024. At HERO's 0.0245 m/px that is a **six-pixel
shift between the two frames being differenced** — larger than the 0.07 % object
under test, and it moved sky and terrain coverage by 0.35 points on its own.
**Those numbers were discarded and the run repeated**; `SETTLE` now converges on
the pose error itself.

| beat | p5h | p5g | stop reason |
|---|---|---|---|
| HERO daylight | **0.0000 m** | 0.0000 m | onBeat |
| WEST daylight | 0.0072 m | 0.0079 m | onBeat |
| NW daylight | 0.0073 m | 0.0074 m | onBeat |
| HERO dusk | **0.0000 m** | 0.0000 m | onBeat |

The residual floor is scroll quantisation: `window.scrollTo` takes integer
pixels, so a derived fraction lands a pixel off and WEST/NW bottom out near
0.007 m while HERO, at scroll 0, is exact. **The two candidates are compared at
poses differing by ≤ 0.0007 m.**

Coverage, p5g → p5h:

| class | HERO | WEST | NW |
|---|---|---|---|
| terrain | 43.76 → 43.76 | 31.00 → 31.00 | 24.87 → 24.87 |
| mansion | 8.48 → 8.46 | 7.17 → 7.17 | 10.14 → 10.14 |
| sky | 21.71 → 21.71 | 40.58 → 40.58 | 41.12 → 41.12 |
| **urn** | — → **0.07** | — → **0.04** | — → **0.00** |
| steps | 0.38 → 0.36 | 0.10 → 0.07 | — |

---

## 15. Regression validation

| | result |
|---|---|
| typecheck | **5/5 successful** |
| tests | **266 passing** (188 domain, 30 db, 48 public) |
| lint | **5/5 successful, 0 errors** (pre-existing warnings only) |
| production build | clean, on a deleted `.next`, twice |
| console errors, all four exterior captures | **0** |
| console errors, `/hall` | **0** |
| interior | untouched — no Phase 5 change reaches it |
| `EXTERIOR_MODEL_URL` | `'/models/exterior_mansion_v5.glb'` — **unchanged** |
| v5 sha256 | `d7a7e945…87bc87c3` — **unchanged** |
| p4e sha256 | `88d46e24…7ef66ee` — **unchanged** |
| p5g sha256 | `4addfaa8…aafd55b0` — **unchanged** |
| p25b/p25b2/p25b3, p31–p34, p4a–p4d, p5a–p5e, interior | **all byte-identical** |
| 42 material source PNGs (`_stone`, `_ground`, `_foliage`) | **all byte-identical** |
| locked Blender source | mtime 2026-08-27 22:43:35, size 249,247,228 — **unchanged** |
| Phase 4 stone sources vs shipped p4e | **5/5 MATCH byte-for-byte** |
| graft controls | every pre-existing bufferView byte-identical, every pre-existing material structurally identical |

The graft is the narrowest of the whole phase: **replaced 0, added 2**, materials
17 → 17, textures 40 → 40, images 40 → 40, nodes 481 → 483. `MAT_Stone_Trim` was
matched **by name** so the urns could not fork it.

**Frame timing is not reported.** The headless rAF rate ran 62–101 /s with vsync
off, which is not what a visitor's device does.

---

## 16. Performance, baseline vs final

| | p4e | p5g | **p5h** | Δ p4e→p5h |
|---|---|---|---|---|
| GLB | 11.04 MB | 16.60 MB | **16.62 MB** | +5.58 MB |
| unique triangles | 179,397 | 185,151 | **186,007** | +6,610 (+3.7 %) |
| HERO draw calls | 947 | 951 | **955** | +8 |
| HERO submitted triangles | 354,562 | 365,846 | **367,558** | +12,996 |
| material names | 15 | 16 | **16** | +1 |
| material instances (runtime) | 15 | 17 | **17** | +2, **one of which is a fork** |
| textures | 37 | 47 | **47** | +10 |
| geometries | — | 385 | **387** | +2 |
| lights / shadow casters | 9 / 1 | 9 / 1 | **9 / 1** | **0** |
| GPU texture residency (BC7) | 49.32 MB | 62.65 MB | **62.65 MB** | **+13.33 MB** |
| cold `[exterior_ready]` | — | 1181 ms | **1168 ms** | noise |

P5H's whole cost is **+856 triangles, +4 draw calls, +2 geometries and +15.3 KB**
with **zero** texture, material or light cost. The texture residency is still the
honest headline number and it is entirely Phase 5A–5E's: the four new 1024²
normal maps at ~1.3 MB each, whose only compression lever was measured and
rejected (§12).

Final commit: see §18. Six Phase 5 commits precede this pass
(`cd592aa` → `5e17ac4`); this pass adds three.

---

## 17. Known residuals

1. **The ground/backdrop seam is improved 14 %, not solved.** The residual is the
   fog colour standing against a photographic backdrop whose horizon brightness
   varies 60–75 luma with azimuth. No single fog colour fixes all three cameras;
   the shipped value is optimal for HERO. Closing it properly needs per-direction
   haze — a shader change to a locked system. **P5H did not change it and does
   not claim to.**
2. **P5C's edging does not render** (§12): 498 triangles and a forked material for
   an object measuring 1 px at HERO and 0 elsewhere, because 229 of its 249
   polygons are wound inside-out against a single-sided material. Diagnosed, root
   cause identified in `p5c_transitions.py`, **not fixed** — it is a P5C defect
   whose fix changes an accepted candidate's appearance and needs its own
   acceptance pass. This is the highest-value follow-up in the list.
3. **Phase 5 costs +13.33 MB of GPU texture residency** and the only compression
   lever was rejected on measurement. A 512² normal for the cypress (never nearer
   than 40 m) remains an untested option.
4. **The cypress geometry gained 224 triangles** from Blender 5.2 fanning the
   cone's n-gon base differently. Shape identical to 5 mm; waived deliberately.
5. **The per-class luminance instrument is repaired and the repair is measured.**
   The visible frame is now read with `readPixels` on the back buffer rather than
   `drawImage` through a 2D canvas, which removed the dependency on where the
   probe's rAF landed. Both paths are taken every capture and compared:
   **8 of 8 captures succeeded on both, agreeing to `visAgreeMAD` 0.000**, against
   6 of 8 succeeding before. The guard that reports `shadeUnavailable` rather than
   zeros is retained. **No number in this report comes from a failed read.**
6. **The lawn is greener than the backdrop's meadow** (R/G 0.83 vs the plate's own
   hue). Deliberate — a maintained lawn should differ from rough pasture — but it
   is part of why the seam persists.
7. **Dusk lawn is +4.2 luma** over p4e, a side effect of the daylight-solved
   albedo. Small, reported, not separately corrected.
8. **The urns are a small detail and the report does not pretend otherwise:**
   0.07 % of the HERO frame, 938 px. They are accepted because they are visible,
   architecturally required by pedestals that already existed, subordinate in
   value, and cost essentially nothing — not because they transform the frame.

---

## 18. Final recommendation

**PASS for P5A–P5J**, with the scope of each pass stated exactly: P5A–P5E and
P5G authored and accepted; P5F a justified no-op, independently re-confirmed;
**P5H authored in part — urns accepted, dusk lighting rejected**; P5I an
evaluation; P5J a revalidation that produced a finding rather than an
optimisation. **P5A–P5J is not "fully authored", and this report does not say
it is.**

The success criterion was: *the mansion no longer looks like a 3D building placed
inside an environment.* The evidence is not a screenshot — it is that the largest
surface in every frame went from carrying no information at its own sampling rate
to being correctly sampled at all of them; that the arrival, the boundary and the
planting have material and construction where they had constants; that the water
shows its basin; that the entrance now finishes the pedestals the architecture
already built; and that the mansion's dominance is numerically **unchanged**
(lawn/mansion 0.70 across p4e, p5g and p5h).

**Promote `p5h`** — the last candidate carrying every accepted change and none of
the three rejected ones (P5A's first albedo, P5J's ETC1S, P5H's dusk lamps).

```
?model=p5h   →   EXTERIOR_MODEL_URL = '/models/exterior_mansion_v6_p5h.glb'
```

Three things to know before promoting:

1. **p5h is built on p4e, which is itself not yet promoted.** Promoting p5h
   promotes the whole Phase 4 surface system with it. That is a single decision,
   not two, and should be taken as one.
2. **It carries P5C's dead edging** (§12) — 498 triangles and a material fork
   that render nothing. Promoting is still the right call (the defect is
   pre-existing and costs ~0.3 % of triangles), but the follow-up is worth
   scheduling.
3. **The production resolver was NOT changed.** `EXTERIOR_MODEL_URL` remains
   `'/models/exterior_mansion_v5.glb'`, and nothing was pushed.

**PRODUCTION RESOLVER: v5 — unchanged.**
**RECOMMENDED CANDIDATE: p5h** (`1fbafd09…b0f34c4b`).
