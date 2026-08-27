# Blender handoff — one consolidated session

Every change the web build needs from the source `.blend` files, in one list, so
this can be a single commissioned session rather than five rounds.

Everything below was derived by parsing the shipped GLBs
(`apps/public/public/models/exterior_mansion.glb`,
`interior_hall.glb`) — node names, world transforms, accessor bounds, material
definitions and triangle counts are quoted from the files themselves, not from
screenshots.

**Coordinates** in this document are THREE-space metres as they arrive in the
web build (glTF Y-up). Blender's exporter writes `blender(x, y, z) →
three(x, z, -y)`; convert accordingly.

---

## Priority 1 — blocks a brief requirement

### 1.1 The project tables are the wrong object

**Objects:** `pedestal_base_S1..S4`, `pedestal_drum_S1..S4`,
`pedestal_collar_S1..S4`, `pedestal_cap_S1..S4`, `pedestal_inlay_S1..S4`
(5 meshes × 4 stations, ~1,124 tri per station).

**Station centres (three-space):**

| id | x | z | cap top y |
|----|------|-------|------|
| S1 | −5.95 | +1.90 | 0.96 |
| S2 | −4.60 | −3.80 | 0.96 |
| S3 | +5.95 | −0.90 | 0.96 |
| S4 | +5.95 | +3.40 | 0.96 |

**Current problem — three separate ones:**

1. **Scale.** The pedestal is a Ø0.58 m drum. The brief asks for a *vintage
   royal circular table*. At 58 cm this reads as a plant stand, and the
   hologram above it (`holo3d_S1_blocks` measures 0.76 × 1.02 m) **overhangs
   the table by ~20 cm on every side** — the plan appears to float off the
   furniture.
2. **Rotational symmetry.** `drum`, `collar` and `cap` are lathe forms. The
   brief requires the visitor to grab the table and turn it. Rotating a
   rotationally-symmetric solid about its own axis changes **not one pixel**.
   The web build currently works around this by drawing a marquetry rosette
   onto `pedestal_inlay_S*` at runtime; that is a stopgap, not the fix.
3. **Height.** A table top at 0.96 m is bar height. Console/centre tables sit
   at 0.75–0.82 m.

**Required:**

- A turned circular table, **Ø1.10–1.20 m**, top surface at **y 0.78–0.82**.
- Carved, **radially asymmetric** detail that reads at 2.5 m: marquetry
  segments, gadrooning on the edge, carved apron, or a compass inlay. This is
  what makes the rotation legible, so it is not decoration — it is the
  interaction.
- Period: European royal estate, restrained. Walnut/rosewood with brass
  banding. Not gilt-heavy.

**Pivot / origin:** at the table's vertical axis, on the floor plane
(local origin at world `y = 0`, `x`/`z` at the station centre above).

**Hierarchy — this is the important part.** The projector and the hologram must
NOT turn with the table. Please deliver:

```
STATION_S1                 (empty, at the station centre, y = 0)
├── TURNTABLE_S1           (empty, same transform — the rotating root)
│   └── table_S1           (the whole table, single object or a few)
└── projector_S1           (stays put)
    └── projlens_S1
```

Keep `projector_S1..S4` and `projlens_S1..S4` **outside** `TURNTABLE_*`.

**Materials:** the rotating top must **not** be lightmapped — a baked lightmap
on an object that rotates is wrong by construction, and it is why the table
currently has to keep its lightmap UVs. Give it a real albedo / roughness /
normal set on **UV0** instead. The fixed base may keep its lightmap on UV1.

**Naming:** keep the `_S1..S4` suffix convention exactly; the web build binds
stations by that suffix.

**Export:** must remain four separate station hierarchies, not joined.

**Why the web layer cannot do this:** it can re-parent (and does), but it cannot
invent carved geometry, and no shader can make a surface of revolution appear to
rotate about its own axis.

---

### 1.2 Stations S3 and S4 have no hologram

**Present:** `holo3d_S1_*` (19 objects) and `holo3d_S2_*` (15 objects) — an
extruded plot-block volume, a base plate carrying the site plan as an emissive
texture, and title/leader/card/rule annotation geometry.

**Missing:** any `holo3d_S3_*` or `holo3d_S4_*`. Those two stations have a
projector and a lens and nothing above them.

**Required:** build `holo3d_S3_*` and `holo3d_S4_*` to the same recipe and the
same local dimensions, anchored at the S3/S4 centres above, occupying
**y 1.20 → 1.85**.

**Also — rename these materials.** Project identity is currently baked into
material names, which prevents the web build from binding whichever project is
published to whichever station:

| current | required |
|---------|----------|
| `MAT_Holo_Kartikeya` | `MAT_Holo3D_Plate_S1` |
| `MAT_Holo_LuckyGarden` | `MAT_Holo3D_Plate_S2` |
| *(new)* | `MAT_Holo3D_Plate_S3`, `MAT_Holo3D_Plate_S4` |
| `MAT_Holo3D_Top_S1/S2` | keep, add `_S3`, `_S4` |

There are **three** published projects today and four stations, so S4 will
correctly stay dark until a fourth is released. Build it anyway — the web build
lights whichever stations have data.

---

### 1.3 The stair runner has no texture UVs

**Objects:** `runner_tread_0..11`, `runner_riser_0..11`,
`runner_binding_1`, `runner_binding_-1`, `stair_landing_runner` (36 meshes,
900 tri).

**Current problem:** `MAT_Runner_LM` ships with baseColorFactor `[1,1,1,1]`,
**no** baseColorTexture, **no** normalTexture, **no** roughnessTexture. It is a
pure white, perfectly smooth surface with a baked shadow on it — which is
precisely why the review said the stair carpeting looks cheap.

The reason is visible in the same parse: the runner's **only** UV set is the
lightmap atlas coordinate (the occlusion texture is declared on `TEXCOORD_0`).
There was nowhere to put a tiling carpet.

**Interim:** the web build now generates a planar UV1 and applies the
`Carpet013` maps already in the file, dyed to a deep oxblood. It works, but a
planar projection is not a real unwrap.

**Required:**

- A tiling **UV0** that runs *along the flight*: `V` following the rise+going so
  the weave is continuous from the bottom tread to the landing, `U` across the
  1.90 m width. The binding strips run vertically up the flight edges.
- Move the lightmap to **UV1**.
- Assign a real wool carpet set (albedo / roughness / normal). Deep red or
  deep green; it must be materially darker than the cream limestone treads or
  the staircase has no value contrast.

---

### 1.4 `founder_portrait` is a blank placeholder

**Object:** `portrait_canvas` (2.0 × 2.8 m, back wall at z −5.17, above the
landing). Material `MAT_Portrait`, texture `founder_portrait`, 763 × 1024, KTX2,
11 mips, sRGB — verified bound and sampled across the full 0..1 UV range.

**It renders as a flat olive-brown field.** The texture itself carries no image.

**Required:** the actual founder photograph, ≥1024 × 1365, sRGB, colour-graded
for a warm interior. This is the emotional anchor of the entire interior
sequence and the click target for the About page; it is currently a blank
canvas in a gold frame.

---

## Priority 2 — cost, with a visible payoff

### 2.1 Triangle budget on objects nobody sees closely

| object | current | suggested | note |
|--------|---------|-----------|------|
| `finial_tip_0..3` | 15,000 **each** (60,000 total) | ≤1,500 each | 30 cm gold caps at 9.2 m, never nearer than 20 m |
| `lion_frieze` | 60,000 | ≤8,000, or bake to normal | a 5.6 × 0.52 m band |
| `rustic_b/f/l/r_*` | 95 objects, 1,111–1,428 each (~127,000) | join to 4 objects, or bake the rustication to a normal map on the plinth | this is the single largest triangle cost in the exterior |
| `Metal_Gold_Karat.001` (chandelier) | 42,552 | ≤12,000 | one primitive, no UVs |
| `Glass_Crystal_Kognaq_Simple.001` | 14,455 @ transmission 1.0 | ≤5,000 | see 2.2 |

### 2.2 Transmission is charged per frame, not per object

Any material with `KHR_materials_transmission` forces three.js to render the
whole opaque scene a **second time** into a buffer. Present transmissive
materials:

- `Glass_Crystal_Kognaq_Simple.001` — chandelier crystal, factor **1.0**
- `MAT_PortraitGlass` — factor **1.0**, on a pane 1 cm in front of an opaque
  painting. It refracts nothing and costs a full pass. **Set to 0** and use a
  low-roughness specular sheen instead.
- `MAT_Glass_Window` (exterior) — factor **0.12**. At 12 % this is visually
  indistinguishable from a dark opaque pane; consider dropping transmission and
  using alpha.
- `MAT_Water` (fountain) — factor 0.8. Keep; this one earns it.

### 2.3 The roof is 10 triangles

`mansion_roof` is 10 tri and `roof_peak` is 12. In every exterior frame the roof
reads as a flat blue-grey plane — the weakest surface in the hero shot. Either
model real tile/slate courses, or give it its own material with a tiled
normal + roughness set (it currently shares `MAT_Roof` with the spire, so they
cannot be tuned apart).

---

## Priority 3 — correctness and hygiene

| # | Issue | Where | Fix |
|---|-------|-------|-----|
| 3.1 | `texCoord: -1` on baseColorTexture **and** normalTexture — invalid glTF (spec minimum is 0) | exterior `MAT_Stone_Cream` (material index 2) | set to `0` |
| 3.2 | Two different materials both named `MAT_Stone_Cream` (indices 2 and 6, different `KHR_texture_transform`) | exterior | merge into one |
| 3.3 | `roughnessFactor: 1.25` — out of spec (max 1.0) | exterior `MAT_Wood_Dark` | clamp to 1.0 |
| 3.4 | baseColorTexture on `TEXCOORD_3` | interior `material_0.001` (the two urns) | move to `TEXCOORD_0` |
| 3.5 | `doubleSided: true` on **all** 34 interior and 10 exterior materials | both | leave on only where needed (glass, foliage cards); it doubles fragment cost on the ornament |
| 3.6 | `MAT_Hedge` and `MAT_Ground` ship baseColorFactor `[1,1,1,1]` with no texture — they arrive **white** | exterior | authored colour is currently restored in code; if real foliage/ground maps are ever made they will take precedence automatically |
| 3.7 | `MAT_Ceiling_Plaster_LM` and `MAT_StoneDark_LM` have no albedo/normal at all | interior | optional; the bake carries them acceptably at current camera distances |
| 3.8 | One primitive carries a `TEXCOORD_1` its material never samples | interior | harmless; noted in the existing manifest |

---

## Not requested — deliberately

**A shared exterior/interior doorway.** The exterior door sits at z 5.02–5.16,
x ±1.25, y 0.55–3.85; the interior doors at z 5.19–5.29, x ±1.30, y 0–3.70.
They are close but they are different openings in different files at different
levels of detail. Making them one continuous space would mean merging the two
models, which is a much larger job than this session. The web build handles the
transition as a match cut through a blackout on the same axis at the same eye
height, which is the correct film solution and needs nothing from Blender.

**Extra lights.** The interior's ten punctual lamps are already baked into the
lightmap and are stripped on load; adding more would double-count again. If the
bake is ever redone, `interior_hall.manifest.json` records the exact command
chain and the 4.6597 normalisation divisor.
