# PHASE 3 — HERO ARCHITECTURAL DETAILING — REPORT

**Status: COMPLETE.** Phase 3's architecture is in the production model as
`exterior_mansion_v6_p3f.glb`, promoted over `p5m` on 2026-09-14. `p5m` stays on
disk and addressable as `?model=p5m`.

Phase 3 was authored on 2026-09-01 and never reached production. This report
covers both halves: what Phase 3 is, and the pass that finished it. That pass
found three defects in the Phase 3 asset that nobody had seen, because it had
never been reviewed in the runtime. The biggest was that 52 of its 56 pieces
were inside out.

---

## 1. Why Phase 3 was still open

`352dd3b` (2026-09-01) closed Phase 3 with the words *"Adds the p34 candidate;
production stays on v5."* Phase 2.5B, Phase 4 and Phase 5 then all branched from
the 27 August locked source, not from P3.4, so Phase 3 was left behind. Counted
in the shipped files:

| file | `P3_` nodes | quoin-named nodes |
| --- | --- | --- |
| `p34` (Phase 3's own candidate) | 8 | 50 |
| `p25b3` | 0 | 2 |
| `p4e` | 0 | 2 |
| `p5m` (production until this pass) | **0** | 2 |

The two quoin-named nodes in every file are the rusticated base's kit meshes.
Production had no Phase 3 geometry at all: the ashlar ran 5.07 m up to the
cornice with a strip of bare wall at every corner, the columns met their plinths
on a bare cut, and the door opening met raw wall.

## 2. What Phase 3 is

The P3.4 set, after P3.4 removed the pieces P3.1 had wrongly added:

| piece | tris | material | what it does |
| --- | --- | --- | --- |
| `P3_col_base_L` / `_R` | 284 each | MAT_Stone_Trim | base torus where each column shaft met its plinth on a bare cut |
| `P3_doorjamb_L` / `_R` | 12 each | MAT_Stone_Trim | a door surround; the opening met raw wall |
| `P3_step_2` | 12 | MAT_Stone_Steps | a third tread, so the approach reads as steps rather than two kerbs |
| `P3_cornice_crown` | 64 | MAT_Stone_Trim | a readable crown; the 4-step band projected 25 mm and was buried behind its own ashlar |
| `P3_portico_bedmould` | 14 | MAT_Stone_Trim | closes the bare step between the frieze face and the portico cornice |
| `P3_architrave_fillet` | 12 | MAT_Stone_Trim | divides the flat 0.22 m architrave fascia |
| `quoin_{NE,NW,SE,SW}_00..11` | 12 each (576) | MAT_Stone_Wall | 48 corner blocks, 40 mm proud, filling the 0.665 m strip the ashlar layout reserved and never used |

1,270 triangles in total. P3.4's own correction still stands: the capitals,
abaci and door head that P3.1 added sat inside gilded geometry already in
`mansion_gold`, so it removed them (−892 triangles).

## 3. What was wrong with p34, measured before anything was changed

The 56 objects were appended from `mansion_exterior_P3.4-CORRECTION.blend` into
the production source (`mansion_exterior_P5K.blend`) in memory, then compared
with what production carries.

**3a. Tone.** P4A gave each of the 267 ashlar blocks its own tone in COLOR_0
(0.90–1.08, mean 0.9991, sd 0.0447). The 48 quoins carried a flat StoneAO of 1.0
and no `p4_blocktone`. Every corner would have been the only untoned stone on
the building.

**3b. AO.** Every production trim and step surface carries a per-vertex raycast
AO (e.g. `fount_wall` 0.40–0.71, `fountain_cap` 0.56–0.98). The seven trim pieces
and the tread each carried one hand-set constant, between 0.451 and 0.823,
matched by eye in P3.1/P3.2 and never baked.

**3c. Winding: 52 of 56 pieces were inside out.** The architrave fillet, both
door jambs, the tread and all 48 quoins are closed boxes with a negative signed
volume, and `recalc_face_normals` would flip every one of their triangles. The
column bases (closed, positive volume) and the crown (open, consistent) were
correct. three culls back faces, so an inside-out box draws its own far inner
walls from outside:

* the quoins read as recessed rather than 40 mm proud;
* the tread read as a dark slab sticking out past the cheek walls;
* the AO bake sent every ray into the piece itself, so the first bake put the
  tread, the jambs and the fillet on the 0.40 floor.

`tools/capture/out3f/portico-p34-pieces-INSIDE-OUT.png` shows the portico in
that state. The bed mould is an open strip. Its only reversed triangles are the
far fan triangle of each end cap, about 5 cm², where the fan covers a non-convex
S-shaped (cyma) section. That is a triangulation artefact rather than an export
error, and it was left alone.

**3d. Encoding, and a silent draw-call regression waiting in the runtime.** p34
stores StoneAO as BYTE_COLOR, production as FLOAT_COLOR. That part is easy. The
part that is not: in `p5m`, the 267 ashlar blocks carry COLOR_0 as UNSIGNED_SHORT
normalised VEC4, because they arrived through P4A's transplant.
`export_web.py`, the donor path for everything else, writes FLOAT VEC3. The
runtime merge grouped MAT_Stone_Wall meshes by material and attribute NAME only.
Tested against this repo's own three:

```
mergeGeometries([ashlar, ashlar])  -> merged
mergeGeometries([ashlar, quoin])   -> null
  "mergeAttributes() failed. BufferAttribute.array must be of consistent array
   types across matching attributes."
```

A null result skips the whole group. The first grafted quoin would have left
every ashlar block unmerged, undoing Phase 6B's merge of 955 draw calls down to
233, with nothing on screen to show it.

## 4. How it was integrated

### Stage 1 — `tools/blender/p3f_integrate.py`, on P5K, saving a new file

Run against `mansion_exterior_P5K.blend`; it refuses to overwrite its input.

* **Append.** The 56 objects are appended and linked into `COL_Exterior`, so a
  future full `export_web.py` run ships them. Their `MAT_Stone_*.001` copies are
  folded onto production's Phase 4 materials (56 slots remapped). Then only what
  the append itself introduced is removed: 3 materials and the 9 pre-Phase-4
  images they pulled in (`m026_*`, `steps_*`, `trim_*`).
* **Winding.** The 52 inside-out closed pieces are turned the right way out, and
  the script asserts that none is still inverted afterwards.
* **UVs.** The world-box UV rule of the stone system holds: maximum error 0.0.
* **Colour layer.** StoneAO is rebuilt as a single FLOAT_COLOR corner layer.
* **Quoin tone.** Same distribution as `blocktone_stoneao.py`. The seed is
  crc32 of the object name, because that tool's `hash()` seed reproduced only 1
  of the 267 stored ashlar tones in a fresh interpreter (§8.5). Result: 48
  tones, 0.900–1.080, mean 0.9941, sd 0.0485.
* **AO bake.** The P3 pieces are baked with `bake_ao_raycast.py`'s ARCH occluder
  set: 111 occluders, 115,352 triangles. The quoins count as masonry, the same
  rule the ashlar follows.

  | piece | min | median | max | mean |
  | --- | --- | --- | --- | --- |
  | `P3_architrave_fillet` | 0.404 | 0.887 | 0.994 | 0.784 |
  | `P3_col_base_L` / `_R` | 0.400 | 0.575 | 0.894 / 0.900 | 0.600 |
  | `P3_cornice_crown` | 0.406 | 0.852 | 0.974 | 0.763 |
  | `P3_doorjamb_L` / `_R` | 0.400 | 0.428 / 0.479 | 0.799 / 0.795 | 0.500 / 0.507 |
  | `P3_portico_bedmould` | 0.431 | 0.744 | 1.000 | 0.691 |
  | `P3_step_2` | 0.400 | 0.444 | 0.970 | 0.580 |

* **Neighbours.** The script measures what the new pieces do to the AO of every
  surface within 1.6 m. Each exposed sample is baked with the P3 pieces hidden,
  then present, and samples the new geometry covers are skipped.

### Stage 2 — `tools/blender/p3f_neighbours.py`

**Rule:** re-bake an object if the new architecture moves any exposed sample by
more than 0.05 of the AO multiply.

| object | samples > 0.05 | worst | re-baked |
| --- | --- | --- | --- |
| `lion_frieze` | 2,619 | −0.45 (where the bed mould closes the step) | yes |
| `mansion_walls` | 307 | −0.34 (the column foot) | yes |
| `entry_cheek_-1` / `_1` | 5 / 6 | −0.14 | yes |
| `entry_step_0` | 1 | −0.16 | yes |
| portico architrave / cornice / cymatium | 0 | ≤ 0.035 | no |
| urns, terraces | 0 | ≤ 0.019 | no |

**Is the baseline right?** A bake of each re-baked object without the P3 pieces
reproduces the AO production already ships:

| object | mean abs difference | p95 |
| --- | --- | --- |
| `lion_frieze` | 0.0000 | 0.0000 |
| `mansion_walls` | 0.0001 | 0.0000 |
| `entry_cheek_-1` / `_1` | 0.0033 / 0.0034 | 0.0125 |
| `entry_step_0` | 0.0004 | 0.0048 |

So re-running the bake with the new pieces present changes what those pieces
cause, and nothing else. `entry_step_1` is a neighbour but is left alone: its
shipped AO does not reproduce (mean 0.020, p95 0.078, because the P5H urns were
added beside it without a re-bake), and Phase 3 moves it by at most 0.001.

**Two classes of change are put back after the re-bake:**

1. **Changes Phase 3 did not cause.** 6 loops of `mansion_walls`, more than 5 m
   from any P3 piece, moved by at most 0.019, all at z 0.0 on the east wall
   base. That is where P5C's ground-level edging now sits as an occluder that
   did not exist when the walls were baked. The staleness is real, but it
   belongs to Phase 5, so those loops are restored to their shipped values.
2. **Vertices the new pieces bury.** AO lives on vertices, and a covered vertex
   still shades every visible face it belongs to. The column shaft's bottom ring
   sits inside the new base torus and re-baked to the floor. With no ring
   between the foot and the capital, that darkened the whole visible shaft on a
   straight gradient: on screen, **0.743** of its old luminance at the foot and
   **0.90** at mid-height. Buried loops are restored to their shipped values:
   114 on `mansion_walls`, 39 on `lion_frieze`, 1 on each cheek. After the
   restore the shaft reads **0.938** at the foot and **0.98** at mid-height.

### Stage 3 — `tools/blender/export_web.py`

A full exterior export of `P3F.blend` (539 objects, 180,952 triangles), exactly
how every Phase 5 donor was made. It writes one FLOAT VEC3 COLOR_0 per mesh. An
earlier direct export with `export_image_format='NONE'` wrote a stray second
colour layer (UNSIGNED_BYTE COLOR_0 plus UNSIGNED_SHORT COLOR_1), the failure
`p5_fix_color_attrs.py` records for P5A, and was discarded.

### The graft — three steps, each waiver scoped to one node

| step | nodes | check |
| --- | --- | --- |
| A | add 56; replace `entry_cheek_-1`, `entry_cheek_1`, `entry_step_0` | strict: counts, bounds and transforms identical |
| B | replace `lion_frieze` | re-split: 22,379 → 22,267 vertices on identical 24,117 indices and identical bounds |
| C | replace `mansion_walls` | `--allow-growth`: 151,836 → 151,869 indices |

* **B, lion_frieze.** The re-bake put 407 more corners on the AO floor (2,156 →
  2,563), so the exporter welds more. Distinct corner signatures went from
  20,511 to 20,412 in the source.
* **C, mansion_walls.** The source mesh holds exactly 11 zero-area triangles,
  counted in both P5K and P3F. The 27 August export dropped them; Blender 5.2
  keeps them. They add +33 indices and draw nothing.

Every pre-existing bufferView and material comes out byte- or structurally
identical, as the tool asserts. No material, texture or image is added: 17 / 40
/ 40 before and after.

**Replacement audit.** Each replaced primitive was Draco-decoded from both files,
corners were matched on (position, normal, uv), and colour differences were
classified by distance to the nearest P3 piece:

| replaced | donor corners matched | colour changed within 1.6 m | beyond 1.6 m |
| --- | --- | --- | --- |
| `entry_cheek_-1` | 96 / 96 | 21 (max 0.217) | **0** |
| `entry_cheek_1` | 96 / 96 | 19 (max 0.225) | **0** |
| `entry_step_0` | 96 / 96 | 19 (max 0.159) | **0** |
| `lion_frieze` | 22,267 / 22,267 | 7,557 (max 0.413) | **0** |
| `mansion_walls` | 90,013 / 90,017 | 1,843 (max 0.306) | 7 (max **0.0078**) |

The 4 unmatched `mansion_walls` corners belong to the 11 degenerate triangles.
The 7 changes beyond 1.6 m are below 1 % of the AO multiply.

## 5. Runtime changes — `ExteriorModel.tsx`

* **`MERGE_FAMILIES`** now includes `quoin_`. Left out, the quoins would be 48
  more meshes and about 96 more calls at the hero.
* **The merge key includes each attribute's array type, item size and
  normalisation.** Mismatched encodings become two batches instead of none; §3d
  is the reason.
* `p3f` is registered as a candidate, and `EXTERIOR_MODEL_URL` is promoted to
  it, with a promotion note beside the one for `p5m`.

## 6. Tool changes

* **`bake_ao_raycast.py`** classifies `quoin_` as masonry, alongside `ashlar_`
  and `rustic_`.
* **`graft_draco_nodes.py`** now admits a seam re-split in either direction.
  Welding lowers a vertex count on the same triangles just as splitting raises
  it, and the rule only allowed the P5D direction. A re-split is also no longer
  routed through the growth checks, which is what had made it one-directional.
  The log label now says "re-split or re-welded".
* **New:** `p3f_integrate.py` and `p3f_neighbours.py`.

## 7. Measurements

**At the hero, 1440×900, production build.** Two independent probes agree
(`frame_probe.mjs` and a named-mesh world-pass probe):

| | p5m | p3f |
| --- | --- | --- |
| draw calls | 233 | **251** |
| drawn triangles | 367,558 | **370,120** |
| meshes in the world pass | 122 | 131 |
| `[exterior_batched]` merged / meshes removed | 2 / 363 | **3 / 411** |
| shader programs / textures (`gl.info`) | 16 / 62 | 16 / 62 |
| console errors | 0 | 0 |

The +18 calls are the 8 P3 pieces and one quoin batch, each drawn in the colour
pass and the shadow pass.

**The file:**

| | p5m | p3f |
| --- | --- | --- |
| bytes | 16,694,368 | 17,644,200 |
| nodes | 483 | 539 |
| triangles referenced by nodes | 186,007 | 187,288 (+1,270, +11 zero-area) |
| materials / textures / images | 17 / 40 / 40 | 17 / 40 / 40 |
| dead (unreferenced) bytes | 84,863 | 576,976 |
| sha256 | `5de32404…` | `2de5ff6a…` |

**Film frames against a same-build control.** `p5m` was captured twice and
`p3f` once, compared with `imgdiff.py`:

| frame | control mean / px > 8 | candidate mean / px > 8 |
| --- | --- | --- |
| hero | 0.0161 / 918 | 0.2535 / 9,823 |
| revolution | 0.0161 / 822 | 0.1985 / 7,271 |
| turn | 0.0402 / 1,935 | 0.1425 / 6,047 |

All three are above noise, as added geometry must be. The pixels that change
beyond the control sit on the four corners (quoins), the crown line, the
entrance, and the edges of the shadows those pieces cast on the terrace. See
`tools/capture/out3f/hero-CHANGES-beyond-control.png`.

**Close-ups** in the site's look-dev mode (`?free=1`): the portico, the column
foot and a corner, before and after, are in `tools/capture/out3f/`. The quoins
read as proud blocks at every corner, the tread as a lit first step, the jambs
as a door surround, and the fillet divides the architrave.

## 8. Known residuals

1. **+492 KB of dead bytes** (577 KB in total). The graft never removes a
   bufferView, which is how it proves the survivors byte-identical, and the five
   superseded payloads stay in the buffer. A compaction pass would reclaim them.
   Not attempted.
2. **The column shafts still darken by up to 6 % toward the base** (0.938 at the
   foot). That is contact occlusion spread over a 2.35 m shaft with no vertex
   ring between the foot and the capital. The real fix is geometry (a ring at
   the torus top) or texture-space AO.
3. **The bed mould's end caps** keep two reversed fan triangles of about 5 cm²
   each over the cyma section.
4. **The third tread projects 0.30 m in front of the cheek walls**, between
   them. This is P3.1's authored design. Now that it is lit correctly it reads
   as a low first step. It is a design question, not a defect, and was not
   changed.
5. **`blocktone_stoneao.py` claims to be deterministic and is not.** Its
   `hash()` seed reproduced 1 of 267 stored tones in a fresh interpreter. The
   shipped tones are safe, because they are stored per object and the tool
   never re-applies, but `--reset` followed by a re-run would re-roll them. Not
   changed.
6. **Stale AO from Phase 5** that this pass measured but did not ship: the east
   wall base behind P5C's edging (restored to shipped, at most 0.019) and
   `entry_step_1` beside the P5H urns (mean 0.020, p95 0.078).
7. **`mansion_walls` now ships its 11 zero-area triangles.** They are invisible.
8. **Phase 6B's hero figure of 233 calls is superseded** by 251 with Phase 3 in
   the model.

## 9. Files

* `apps/public/public/models/exterior_mansion_v6_p3f.glb` (new, LFS)
* `apps/public/src/components/experience/ExteriorModel.tsx` (candidate, merge
  family, merge key, promotion)
* `tools/blender/p3f_integrate.py`, `tools/blender/p3f_neighbours.py` (new)
* `tools/blender/bake_ao_raycast.py`, `tools/gltf/graft_draco_nodes.py`
* `tools/capture/out3f/*.png` (new, LFS), `.gitattributes`, `.gitignore`
* `docs/PHASE3_REPORT.md`, `FIXLOG.md`

Outside the repository: `C:\dev\Blender\mansion_exterior_P3F.blend` is the new
source. `P5K.blend` and `P3.4-CORRECTION.blend` were read and never written. The
two superseded attempts are kept in `C:\dev\Blender\_p3fout\attempt1` and
`attempt2`.

## 10. Regression

On the production build with `p3f` promoted:

| gate | result |
| --- | --- |
| typecheck | 5 / 5 workspaces, clean |
| lint | 5 / 5, 0 errors |
| unit tests | 188 + 30 + 61 = **279 passed** |
| production build | `✓ Compiled successfully`, `✓ Generating static pages (33/33)` |
| default route | requests `/models/exterior_mansion_v6_p3f.glb`, 0 console errors |
| experience E2E (27 cases, `next start`) | **27 passed (11.2m)** |

**Memory.** The loop is film → hall → district field → project page (the canvas
is torn down) → back, repeated three times:

| sample | geometries | textures | programs | canvases | heap |
| --- | --- | --- | --- | --- | --- |
| lap 1 | 399 | 101 | 58 | 1 | 237 MB |
| lap 2 | 380 | 100 | 65 | 1 | 237 MB |
| lap 3 | **143** | 62 | 20 | 1 | 236 MB |

Lap 3 settles at 143 geometries. `p5m`'s steady state is 134, and the
difference of 9 is exactly the 8 P3 pieces plus the merged quoin batch. Heap is
flat and there is one canvas throughout. Lap 2's sample landed while the hall
was still being released, the same transitional state lap 1 shows on both
builds.

## 11. Verdict

**PHASE 3 COMPLETE.** The Phase 3 architecture is in the production model,
re-authored to the Phase 4 and Phase 5 conventions it had missed, turned the
right way out, and baked against the scene it sits in. Every change it makes
elsewhere in the file is measured and bounded, and the runtime is protected
against the encoding mismatch that would otherwise have undone Phase 6B's
draw-call work.
