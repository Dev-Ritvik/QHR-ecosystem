'use client';

// apps/public/src/components/experience/ExteriorModel.tsx
//
// The mansion seen from outside: the frame the site opens on.
//
// This set has existed in COL_Exterior since the scene was built and was
// exported to exterior_mansion_web.glb on 31 July. Nothing ever pointed at it,
// so the home page opened INSIDE the hall for weeks while the brief asked for
// an approach — and poses.ts carried a comment claiming "the exterior is not
// modelled", which was simply untrue.
//
// Deliberately a separate component from HallModel rather than one parameterised
// loader, because the two sets have genuinely different contracts:
//
//   INTERIOR   baked GI in the occlusion slot at 4.66x, KTX2 textures, lit
//              almost entirely by that lightmap, so exposure is its reciprocal.
//   EXTERIOR   no lightmap at all. Real PBR with KTX2 maps on every material,
//              an alpha-blended glass pane, transmission on the fountain water
//              alone, and an emissive factor on the interior window panes. It
//              needs a real key light and renders at roughly unit exposure.
//
// Promoting a lightmap that does not exist, or applying the interior's exposure
// here, would be a silent mis-grade of the kind this project has already paid
// for twice. The shared part — Draco and KTX2 loader wiring — is imported.

import { useEffect, useMemo, useRef } from 'react';
import type { Grade } from './WorldCanvas';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachLoaders } from './HallModel';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { guardAnisotropy } from './materialGuards';
import { markFocusDepth } from './LensFocus';
import { dressLawn, sharpenTextures } from './exteriorLawn';
import { dressFoliage, followSun } from './exteriorFoliage';
import { dressWindows } from './exteriorWindows';
import { dressSurfaces } from './exteriorSurfaces';
import { keepDepthAlpha } from './LensFocus';

/**
 * The shipped exterior.
 *
 * v5 is the first delivery that carries the Phase-2 masonry. The file it
 * replaces has 212 nodes against v5's 479 — a difference of exactly the 267
 * ashlar blocks — so everything shipped before this was the pre-masonry
 * building. Swapped after runtime QA through this page, not after a Blender
 * render: 267 blocks present, 408 vertex-coloured meshes carrying StoneAO,
 * wall colour #e7e3da, normalScale 1.2, bbox identical to the file it
 * replaces, zero console errors.
 *
 * The previous asset is deliberately still on disk and still addressable as
 * `?model=prod`. It is the rollback.
 *
 * ---------------------------------------------------------------------------
 * PROMOTED 2026-09-04, at the close of Phase 5: v5 -> p5m.
 *
 * This is ONE cumulative decision, not a stack of small ones. p5m carries the
 * whole Phase 4 surface system (p4e, which had never been promoted) plus every
 * accepted Phase 5 change, so promoting it promotes P4A-P4E and P5A-P5K
 * together. What it does NOT carry is the three things measurement rejected:
 * P5A's first lawn albedo, P5J's ETC1S foliage normals, and P5H's dusk lamps.
 *
 * Against the v5 it replaces: correctly sampled ground at every camera instead
 * of a 12-15x magnified single map, an arrival, a materialised hedge and
 * cypress, water that shows its basin, two entrance urns, and a stone edging
 * that renders. 186,007 triangles against 179,397, 61.65 MB of GPU texture
 * residency, 955 HERO draw calls, 9 lights and 1 shadow caster.
 *
 * v5 REMAINS ON DISK AND ADDRESSABLE AS `?model=v5` - it is the rollback, and
 * `v5` below is deliberately spelled as its own literal path rather than as
 * EXTERIOR_MODEL_URL, because binding it to the default would have silently
 * re-pointed the rollback at the promotion the moment this line changed.
 * ---------------------------------------------------------------------------
 * PROMOTED 2026-09-14, Phase 3 finished: p5m -> p3f.
 *
 * Phase 3 was authored on 2026-09-01 and never shipped: every later phase
 * branched from the 27 August source, so p5m had no P3_ node and bare wall at
 * every corner of the ashlar. p3f is p5m plus the P3.4 architecture - column
 * bases, door jambs, a third tread, the crowning cornice, the portico bed
 * mould, the architrave fillet and 48 corner quoins - re-authored for this
 * lineage rather than copied: the quoins toned like the ashlar beside them,
 * the trim baked instead of hand-matched, and 52 of the 56 pieces turned the
 * right way out (p34 shipped them inside out). Five neighbours whose AO the
 * new pieces move are re-baked; everything else in the file is byte-identical
 * to p5m.
 *
 * Against p5m at HERO: 251 draw calls against 233, 370,120 drawn triangles
 * against 367,558, 17 materials and 40 textures unchanged, zero console
 * errors. The quoins merge into their own MAT_Stone_Wall batch (merged 3,
 * meshes removed 411) - see the encoding note in mergeStaticFamilies for why
 * they could not join the ashlar's.
 *
 * p5m REMAINS ON DISK AND ADDRESSABLE AS `?model=p5m`, spelled as its own
 * literal path for the same reason v5's is. Full record: docs/PHASE3_REPORT.md.
 * ---------------------------------------------------------------------------
 * PROMOTED 2026-09-15, client review: p3f -> v7, the estate.
 *
 * The review asked for the house to be "bigger, taller, wider, and importantly
 * longer" with its features kept, and listed what was wrong with p3f: windows
 * whose black bleeds past the arches, upper windows with no glass (they were
 * blind panels), stone "like a skin disease", an unfinished back elevation, and
 * a background of Central European hills with a village in it.
 *
 * v7 is built by tools/blender/build_estate_v7.py rather than patched: a nine-bay
 * house (31 m of podium against 19, spire tip 20.34 m against 11.72) with the
 * same pedimented centre, portico, lion frieze, carved front doors, arched
 * windows, parapet, quoins, slate roof, cupola and pointed spire, glazed and
 * curtained on every elevation, in clean dressed limestone with geometric
 * rustication; set in an Indian estate — palm avenue, forecourt fountain,
 * parterres, a rear canal garden, a compound wall and a planted belt. 4.6 MB
 * against p3f's 17.6. Shipped by tools/gltf/ship_estate_v7.sh, which also
 * regenerates estateBounds.ts for the camera tests.
 *
 * p3f REMAINS ON DISK AND ADDRESSABLE AS `?model=p3f` — the rollback.
 * ---------------------------------------------------------------------------
 */
export const EXTERIOR_MODEL_URL = '/models/exterior_estate_v7.glb';
const EXTERIOR_MODEL_V5 = '/models/exterior_mansion_v5.glb';
const EXTERIOR_MODEL_PREVIOUS = '/models/exterior_mansion.glb';

/**
 * Candidate assets, addressable by query string: `?model=v5`.
 *
 * A new exterior delivery has to be judged through THIS page — its camera, its
 * key light, its grade, its post chain — not through a Blender viewport and not
 * through a bare glTF viewer. Both of those have signed off assets that then
 * failed here. So the candidate is loadable alongside production rather than
 * instead of it, and the default stays on the shipped file until the swap.
 *
 * The canvas is mounted `ssr: false` (ExperienceCanvasHost), so reading
 * location here cannot desynchronise a server render.
 */
const MODEL_CANDIDATES: Record<string, string> = {
  v5: EXTERIOR_MODEL_V5,
  /**
   * Same geometry and the same maps, normals re-encoded ETC1S rather than
   * UASTC. 3.63 MB against 9.72 MB — and NOT shipped, on measurement.
   *
   * Across the stone at REV_WEST6 the two are indistinguishable: mean absolute
   * difference 0.425/255. But the pixels that DO differ are not scattered, they
   * sit in one horizontal band at the bottom of the frame — the terrace paving,
   * the only large flat surface in shot. That is exactly the failure encode_ktx2
   * documents when it picks the codec: "ETC1S quantises the endpoints hard
   * enough to produce visible faceting across large flat walls."
   *
   * So the 6 MB is real and so is the reason not to take it. The saving worth
   * having is a MIXED policy — UASTC for paving_normal, ETC1S for the rest,
   * which is ~6.7 MB of normal maps down to well under 1 MB with the faceting
   * confined to a map that has no large flat surface to facet across. That is a
   * pipeline change, not a swap, so it is left as a measured recommendation.
   */
  v5etc1s: '/models/exterior_mansion_v5_etc1s.glb',
  prod: EXTERIOR_MODEL_PREVIOUS,
  /**
   * P3.1 CANDIDATE - hero entrance architecture. Not shipped; production stays
   * on v5 until this is reviewed.
   *
   * Adds 10 objects / 1,496 triangles at the entrance, all additive:
   * mansion_walls is not touched. The portico columns live INSIDE that merged
   * mesh, which is why no node in v5 carries a column name - and why a
   * name-based audit first concluded, wrongly, that the entablature was
   * unsupported. Measured off the actual vertices, the order is a square
   * plinth (z 0.54..0.70), a shaft tapering r 0.300 -> 0.245, and a capital
   * band topping out at z 3.05 - against an architrave underside at z 3.38.
   * The columns stop 330mm SHORT of the entablature they carry. The hero
   * angle hides it behind the projecting architrave; the journey orbits, so
   * it does not stay hidden.
   *
   * This closes that gap with a real capital (necking, astragal, echinus,
   * abacus), gives the shaft a base torus where it currently meets its plinth
   * on a bare cut, puts an architrave on a door that meets raw wall, and adds
   * a third tread so the approach reads as steps rather than two kerbs.
   *
   * Textures are JPEG, not KTX2 - this is a geometry candidate and has not
   * been through the ktx2 chain, so 6.4 MB here is not comparable to v5's
   * 9.7 MB and says nothing about shipping size.
   */
  p31: '/models/exterior_mansion_v6_p31.glb',
  /**
   * P3.2 CANDIDATE - P3.1 plus the classical moulding system. Not shipped.
   *
   * The facade already had a vocabulary and it is NOT duplicated: a 5-step
   * sill course (z 0.880..1.105) reused verbatim as the upper string course
   * (z 3.450..3.805), archivolts over the arched heads, and a 4-step band at
   * z 4.995..5.175. P3.2 adds 90 triangles in three places where the audit
   * found a real gap:
   *
   *   crowning cornice   the elevation had no readable crown. At cornice
   *                      height the wall core is x 7.575 and that 4-step band
   *                      reaches 7.600 - it projects 0.025, while the ashlar
   *                      cladding in front of it projects to 7.625. The
   *                      cornice was buried behind its own masonry. The new
   *                      corona sits ABOVE mansion_gold (z 4.95..5.29) rather
   *                      than in front of it, so that gilded band now reads as
   *                      the frieze and this as the cornice.
   *   portico bed mould  the frieze face (y -5.9592) met the portico cornice
   *                      (y -6.0600) on a bare step.
   *   architrave fascia  a single flat 0.22 slab, now divided by one fillet.
   *
   * No ashlar is entered: the corona spans z 5.30..5.51 outboard of the
   * masonry face. The vertical wallmould strips (top z 5.400) do run up into
   * it - a pilaster strip dying into the cornice bed is correct, not a defect.
   */
  p32: '/models/exterior_mansion_v6_p32.glb',
  /**
   * P3.3 CANDIDATE - corner quoins on the ashlar wall. Not shipped.
   *
   * MEASURED: 96 rustic blocks use the KIT_quoin meshes and every one sits at
   * z 0.14 - the rusticated base. ZERO ashlar blocks use a quoin mesh, so the
   * building was quoined on its 0.34m plinth and then ran 5.07m of wall to the
   * cornice with no corner articulation at all.
   *
   * The ashlar layout already RESERVED the space and never filled it: the
   * west/east runs stop at y -4.970/4.920 and the north/south runs at
   * x +/-6.960, leaving a 0.665m strip of bare wall at every corner over all
   * 12 courses. 48 blocks fill it, 40mm proud, with a 20mm joint to the
   * adjacent run - the same joint the locked masonry uses.
   *
   * Conventions come from the ASHLAR, not from P3.1/P3.2: MAT_Stone_Wall with
   * StoneAO 1.0. The portico trim those phases matched is MAT_Stone_Trim at
   * 0.55-0.76, and using that here would have made the quoins read as dirty.
   *
   * The 13th course is deliberately unquoined - it collides with mansion_gold
   * (band top z 5.29) and is where the P3.2 cornice sits; quoins die into the
   * entablature rather than running past it.
   */
  p33: '/models/exterior_mansion_v6_p33.glb',
  /**
   * P3.4 CANDIDATE - corrects P3.1. Not shipped.
   *
   * P3.1 measured mansion_walls ALONE, found the column shafts topping at
   * z 3.05 against an architrave underside at 3.38, and concluded the columns
   * stopped 330mm short of the entablature. That was WRONG. mansion_gold
   * carries a complete gilded Tuscan capital on each column - necking r 0.280
   * at z 3.050, echinus r 0.340 at 3.140, a 0.80 square abacus at 3.240
   * landing on the architrave at 3.380. The gap was never a gap.
   *
   * Same failure twice on one feature: first "no columns" (they live in
   * mansion_walls), then "no capitals" (they live in mansion_gold).
   *
   * Removed, all confirmed by volumetric test:
   *   P3_col_capital_L/R, P3_col_abacus_L/R - the gold capital is larger at
   *     every level, so these sat entirely inside it: invisible geometry and a
   *     z-fighting risk.
   *   P3_doorhead - there is a gilded keystone above the door at x +/-0.34,
   *     z 3.862..4.038, and the doorhead sat 130mm in front of it, hiding it.
   *
   * Kept, because the audit proves they are not duplicates: the base torus
   * (mansion_gold has ZERO vertices at the column base), the door jambs (clear
   * of the keystone and handles), the third tread, all of P3.2, and the 48
   * P3.3 quoins.
   *
   * Net: -892 triangles of dead geometry. Phase 3 is 1,270 tris / 0.73%.
   */
  p34: '/models/exterior_mansion_v6_p34.glb',
  /**
   * P2.5B CANDIDATE - the roof's lost base-colour multipliers. Not shipped.
   *
   * Built FROM v5 by substituting one texture, not by re-exporting: all 479
   * nodes, 1,785 accessors and the first 9,863,656 bytes of the buffer are
   * byte-identical, and MAT_Roof_Slate is the only material that differs.
   *
   * What was lost. In Blender the slate base colour is
   *
   *     texture x (0.82, 0.86, 0.94) x (0.5 + 0.5 x AO)
   *
   * written as two legacy ShaderNodeMixRGB nodes. The glTF exporter reads a
   * base-colour chain only through the newer ShaderNodeMix, so it walked past
   * both, took the raw texture and wrote baseColorFactor [1,1,1,1]. glTF has
   * nowhere to put the second one anyway: occlusionTexture is indirect light
   * only, not a base-colour multiply. So the roof shipped 1.31x too bright in
   * linear light. fix_stone_material_export.py had already converted the five
   * MAT_Stone_* materials for exactly this reason; the roof was not in its
   * hardcoded list.
   *
   * MEASURED at HERO, against a Cycles render framed by reproducing this
   * page's own camera maths and sampled through a per-pixel material-index
   * pass rather than hand-placed boxes: Blender 50.8 luma, v5 74.5. MAT_Roof
   * is the control - same slate texture, no multipliers in its graph, so its
   * export was already faithful - and at the lit end it matches Blender to
   * 1.02x, which is what says the remaining spread is lighting and not albedo.
   *
   * Fixed by baking both multipliers into a derived base colour, in linear
   * light, re-encoded through the same resize and `ktx create` the pipeline
   * uses. Re-encoding the ORIGINAL texture that way reproduces the bytes v5
   * ships exactly, sha256 and all, which is what makes this a like-for-like
   * substitution rather than a second opinion about the encoder.
   *
   * MAT_Roof deliberately keeps the original image, which is why a new one is
   * added rather than the shared one overwritten: its graph has neither
   * multiplier, so darkening it would introduce the error being removed.
   */
  p25b: '/models/exterior_mansion_v6_p25b.glb',
  /**
   * P2.5B.2 CANDIDATE - p25b plus the roof's lost ROUGHNESS remap. Not shipped.
   * Kept alongside p25b rather than replacing it so the two export losses stay
   * separately attributable.
   *
   * Blender feeds the slate roughness map through a Map Range, 0..1 ->
   * 0.42..0.82, LINEAR and clamped. Map Range is no more exportable than the
   * legacy MixRGB nodes were, so v5 shipped the raw map with the default
   * factor: 85.2% of the roof renders glossier than authored, floor 0.188
   * against 0.489, ceiling 1.000 against an authored hard limit of 0.82.
   *
   * A roughnessFactor alone is NOT the fix, and assuming it was would have been
   * the easy mistake here. glTF roughness is factor x texture.G, a pure
   * multiply; Blender's remap is affine. No factor produces the 0.42 floor, so
   * the offset has to be baked into the texture. That leaves where to put the
   * CEILING, and it is settled by measurement: baking the whole span with
   * factor 1.0 lets ETC1S noise reach 0.847, above a ceiling Map Range's clamp
   * makes hard, while normalising the texture and putting 0.82 in the factor
   * caps it by construction and keeps 104 levels of 8-bit instead of 85.
   * Against the float ideal, per texel: v5 mean |err| 0.11218 / max 0.309;
   * factor 1.0 0.00869 / 0.135; factor 0.82 0.00815 / 0.131.
   *
   * The remap is applied AFTER the pipeline's resize. It is affine and LANCZOS
   * is linear with unit-sum weights, so the orders agree in float - but
   * resizing first carries the full 8-bit range through the filter and only
   * then compresses it.
   *
   * MAT_Roof shares BOTH slate images and keeps both: its base colour has
   * neither multiplier and its roughness Math node is MULTIPLY by 1.0, an
   * identity, so it was already faithful in both slots. That is what makes it
   * the control this whole comparison leans on.
   */
  p25b2: '/models/exterior_mansion_v6_p25b2.glb',
  /**
   * P2.5B.3 CANDIDATE - p25b2 plus corrected roof face orientation. Not shipped.
   *
   * MEASURED, not inferred: an unlit-magenta probe of MAT_Roof_Slate showed the
   * runtime drawing that material over only 42,762 px of the 51,352 px Blender
   * assigns it at HERO. 8,684 px - 16.9% of the roof - were something else, and
   * a full material-ID probe identified 96.6% of them as MAT_Stone_Wall. The
   * viewer was seeing THROUGH the roof to the wall behind it.
   *
   * Not z-fighting: ray-casting those pixels in Blender puts the slate in front
   * by a median 4.83 m, and only 0.4% of the samples have a second surface
   * within a millimetre. 246 of 250 rays hit mansion_roof on a BACK-facing
   * polygon - which for a first intersection from outside a closed surface is
   * impossible unless the winding is wrong. Recalculate-outside flips 936 of
   * its 1873 faces, and the mesh carries 356 non-manifold edges.
   *
   * Cycles shades whichever side a ray lands on, so the Blender reference never
   * showed this. glTF carries `doubleSided`, and MAT_Roof_Slate's is false
   * because the Blender material has Backface Culling ON - so the exporter was
   * FAITHFUL and three.js was right to cull. The defect is in the mesh.
   *
   * Fixed in the source working copy, not by setting doubleSided: that would
   * hide the symptom and leave the tangent basis the normal map is sampled in
   * still mirrored across half the roof. It is not a no-op in Blender either -
   * the reference roof moves 50.80 -> 49.21 luma because tangent space follows
   * winding - and every other material moves by 0.000.
   *
   * Transplanted rather than re-exported: the shipped file is Draco-compressed
   * and gltf-transform warns a decode/re-encode round trip is lossy, so a full
   * re-export would perturb all 381 meshes to fix one. Here 380 of 381
   * primitives keep their original Draco payload byte for byte.
   */
  p25b3: '/models/exterior_mansion_v6_p25b3.glb',
  /**
   * P4A CANDIDATE - primary limestone. Not shipped.
   *
   * MAT_Stone_Wall sampled the marble026 scan tinted #E7E3DA: effective albedo
   * R/B 2.50 (an orange), roughness mean 0.33 with a 0.11 floor (polished),
   * and 69% of its tonal energy above 1/64 of the tile - pure micro, no meso.
   * Replaced by an authored limestone SURFACE (tools/gltf/make_limestone_wall.py):
   * bed mottle at 0.4-1.2 m, faint 80-110 mm bedding, sparse pores, roughness
   * 0.55-0.81, authored pale so the kept tint lands it on (0.54, 0.51, 0.44),
   * R/B 1.23. No printed coursing - each ashlar block is one physical stone
   * with world UVs, so a coursed tile would print sub-courses across it and its
   * 405 mm pitch would beat against the 360 mm geometry.
   *
   * The MESO layer rides COLOR_0 instead: tools/blender/blocktone_stoneao.py
   * multiplies each block's StoneAO by a seeded per-object tone (0.90-1.08,
   * darker blocks 1.5% warmer). Zero texture cost, exportable as-is. The 267
   * block primitives are therefore re-shipped Draco-compressed via
   * tools/gltf/transplant_draco_nodes.py; every other primitive is byte-identical.
   *
   * Textures via tools/gltf/patch_material_textures.py, whose per-slot control
   * re-encodes the marble sources and reproduces img0/1/2 of the shipped file
   * exactly. Normal strength 1.2 -> 0.85: the relief is geometry.
   */
  p4a: '/models/exterior_mansion_v6_p4a.glb',
  /**
   * P4B CANDIDATE - the stone family around P4A's limestone. Not shipped.
   *
   * Built on p4a. Trim keeps its colour (it matched Blender to +0.9) and gets
   * a FINISH: roughness 0.38-0.54 against the wall's 0.55-0.81, fine tooling in
   * the micro. Paving albedo x0.86 with darker, dirtier joints; steps x0.82
   * with tread wear; rustic x0.82, roughness 0.72-0.92, weathered. All from
   * tools/gltf/make_stone_family_p4b.py, written as p4b_* beside the untouched
   * v5 sources, same tiles, so the shipped KHR_texture_transforms stay valid.
   *
   * The rustic base had COLOR_0 = 1.0 flat because its 96 blocks share two
   * meshes and a positional bake would be wrong for 95 of them.
   * tools/blender/rustic_contact_ao.py writes a block-local contact term (bed,
   * top joint, side joints) into StoneAO instead - correct for every instance
   * - and the two meshes are re-shipped Draco-compressed.
   *
   * This is also the candidate where the runtime paving grade (PAVING_TINT
   * 0.32) is retired to 1.0, so the family is measured against Blender for
   * the first time. Ungraded at HERO before P4B: paving +20.6, steps +87,
   * rustic +55 over reference - steps and rustic are contact/GI-dominated.
   */
  p4b: '/models/exterior_mansion_v6_p4b.glb',
  /**
   * P4C CANDIDATE - roof slate readability and the dark-oak entrance. Not
   * shipped. Built on p4b.
   *
   * ROOF: the P2.5B bake (tint x half-AO, roughness remap) is re-derived from
   * the same sources with the AO weight at 0.72 so the courses survive the
   * 1024/ETC1S/mip chain at hero distance, a per-slate tone and roughness
   * offset keyed off the 16-bit height plateaus (7,535 slates), and a 3%
   * graphite shift. Mean linear luma is 0.944x the P2.5B bake - darker, not
   * black. Roughness now ships ABSOLUTE with roughnessFactor 1.0, and the
   * Blender graph reads the same two maps with no MapRange or MixRGB left in
   * the chain (tools/gltf/make_p4c_roof_wood.py, tools/blender/p4c_roof_wood_material.py).
   *
   * WOOD: the parquet scan, object-space mapping and legacy MIX are replaced by
   * an authored dark stained oak sampled through UV in both renderers: linear
   * albedo ~(0.078, 0.052, 0.034), roughness 0.36-0.56 following the grain
   * (the flat 0.33 was the plastic read), subtle open-grain normal at 0.60.
   * Blender's authored mix was 0.072 luma; this is 0.055; the shipped raw
   * texture was 0.022. The runtime door will read brighter than v5 as a
   * consequence and that is reported, not hidden - the P2.5B finding stands
   * that its +28 over reference is contact occlusion, not albedo.
   */
  p4c: '/models/exterior_mansion_v6_p4c.glb',
  /**
   * P4D CANDIDATE - restraint on the accents. Factors only, no textures, so
   * the buffer is byte-identical to p4c. Not shipped.
   *
   * MAT_Gold ran gilt_aged/roughness (mean 0.28) through a 0.55 scalar - an
   * effective ~0.15, a mirror - and was the brightest surface in the daylight
   * frame at 138.7 against Blender's 83.5. roughnessFactor 0.55 -> 0.90, and an
   * aged-gilt tint (0.85, 0.80, 0.70) as baseColorFactor. MAT_Water roughness
   * 0.02 -> 0.07 so the fountain stops being a mirror; ior and transmission
   * untouched. Glass deliberately left alone. Mirrored in Blender by
   * tools/blender/p4d_accents_material.py through nodes the exporter reads.
   */
  p4d: '/models/exterior_mansion_v6_p4d.glb',
  /**
   * P4E - the assembled Phase 4 surface system. Not shipped.
   *
   * p4d with the superseded images pruned (tools/gltf/prune_orphan_images.py):
   * the four milestone patches appended a new image and repointed the
   * material each time, leaving the old one in place so every candidate's
   * diff stayed attributable. This is the same materials, the same geometry
   * and the same bindings - verified material-by-material and slot-by-slot
   * before writing - with the dead payload removed. It is the candidate to
   * judge against v5.
   */
  p4e: '/models/exterior_mansion_v6_p4e.glb',
  /**
   * P5A CANDIDATE — the ground surface system. Built on p4e. Not shipped.
   *
   * THE DEFECT IT ADDRESSES IS A SAMPLING RATE, NOT A LOOK. The shipped ground
   * is one 1024 map clamped across 240 m — 0.2344 m per texel — and the
   * runtime probe ray-cast the real cameras at 0.0197 m per PIXEL at HERO and
   * 0.0153 at NW. The map is MAGNIFIED 12–15× across the nearest half of every
   * exterior frame, and that frame is 25–47% ground by the emissive-id
   * coverage pass. Below mip 0 there is nothing to sample, so half the picture
   * was a bilinear smear over a Lambert plane with no normal map and no AO.
   * Re-baking a prettier 240 m map cannot fix that; the frequency is not there.
   *
   * Three layers replace it:
   *   MICRO  tiling turf and gravel sets at 6.0 m — 0.00586 m/texel, which is
   *          a 3.4× MINIFICATION at the near HERO ground (mip ~1.75) instead
   *          of a 12× magnification, and still correctly sampled at the
   *          horizon. Both sets are normalised so their linear mean equals the
   *          authored target, which makes the mip tail — the far field — the
   *          intended colour by construction rather than by luck.
   *   MESO   COLOR_0 on the ground's own 2.5 m vertex grid: damp hollows and
   *          dry crests off the real height field, a wear halo against every
   *          hardscape footprint (the lawn-to-terrace contact the frame had
   *          none of), a broad falloff so the far field never outshines the
   *          estate, and a 20–60 m mottle that breaks the 6 m tile at a scale
   *          the tile cannot reach. Multiplies base colour with no runtime code.
   *   MACRO  `drive_forecourt`, 1,960 triangles: a gravel annulus around the
   *          fountain (r 3.9–10.6, inner edge tucked under the apron so there
   *          is no cut to stair-step) clipped at the terrace edge, plus an
   *          approach band running out between the hedge ends. The arrival was
   *          previously 1.2% of a zone mask at 0.23 m/texel — i.e. invisible.
   *
   * The tile size lives in the MESH UVs (world x,y / 6.0), not in a Mapping
   * node: P4A lost a tile change because the exporter expressed it as
   * KHR_texture_transform and the shipped file kept the old scale. UVs are
   * geometry and cannot be dropped.
   */
  p5a: '/models/exterior_mansion_v6_p5a.glb',
  /**
   * P5B CANDIDATE — atmospheric continuity. Built on p5a. Not shipped.
   *
   * THE DEFECT, AND WHY IT IS NOT A FOG PROBLEM. Rendering the ground alone in
   * white and reading back its silhouette put the plane's far edge at rows
   * 359–431 of 900 at WEST and 366–433 at NW: a hard line across mid-frame,
   * with a photographic backdrop of different hue and value immediately above
   * it. P5A made it *more* visible, because the lawn now differs from the plate
   * in structure and chroma as well as in value.
   *
   * Daylight fog is a static `Fog(#5E6147, 60, 220)` and it is a locked grade
   * value. The plane is ±120 m, so its far edge sits ~146 m from the WEST
   * camera — where that band has reached only (146−60)/(220−60) = **54%**. The
   * edge is half-dissolved when it stops. Dusk's `Fog(26, 105)` buries the same
   * edge completely, which is exactly why dusk composites and daylight does not.
   *
   * Two ways to close it: move the fog in, or move the edge out. The fog is
   * tuned so the building renders unfogged (its front face is 28 m out, inside
   * the 60 m near plane) and pulling it in would start fogging the subject. The
   * edge is not locked and is simply too close. So the edge moves: the ground's
   * own boundary loop is extruded outward in four rings to a **260 m circular
   * rim** — same object, same material, same UV convention, so there is no seam
   * to hide and no new draw call.
   *
   * 260 AND CIRCULAR ARE BOTH DERIVED, and the first attempt was wrong in a way
   * the authoring script's own assertion caught: a ±320 m SQUARE rim clears the
   * fog at its nearest point (266 m) but throws its corners to 486 m, past the
   * 400 m far plane — where the clip would have drawn a fresh hard edge. A
   * square cannot satisfy both bounds, its corners being √2 further out than
   * its sides. A circular rim's distance varies only by the camera's own offset
   * from the origin, so r = 260 clears both at all three cameras: nearest
   * 226–236 m against a fog that completes at 220, farthest 284–294 m against a
   * 400 m far plane. Asserted per camera over 720 directions.
   *
   * Cost: +3,072 triangles, +0 draw calls, +0 materials, +0 textures — all of
   * it at a distance where the 6 m tile has resolved to its own mean colour.
   */
  p5b: '/models/exterior_mansion_v6_p5b.glb',
  /**
   * P5C CANDIDATE — the hardscape/lawn transitions. Built on p5b. Not shipped.
   *
   * The terrace met grass on a hard line with nothing between them, and P5A's
   * gravel forecourt then met grass the same way. 498 triangles of 280 mm flush
   * edging — around terrace_lower's footprint (placed entirely outside it, so
   * there is nothing coplanar to fight) and along the forecourt's r 10.6 arc
   * and approach flanks.
   *
   * It is a real construction detail, not a decorative band: a flush edging is
   * what stops gravel migrating into turf, gives the mower a wheel to run on so
   * the cut reaches the paving, and holds the paving's bed. It sits 30 mm above
   * the sampled ground — 110 mm BELOW the terrace's own top — so it reads as
   * the kerb the terrace sits behind rather than as a second paving level.
   *
   * Costs nothing but geometry: `MAT_Stone_Trim` is reused by name, so no new
   * texture, image, material or shader program.
   */
  p5c: '/models/exterior_mansion_v6_p5c.glb',
  /**
   * P5D CANDIDATE — the hedge gets a surface. Built on p5c. Not shipped.
   *
   * `MAT_Hedge` was a bare `baseColorFactor (0.026, 0.052, 0.018)` with no map
   * of any kind, holding 2.3–3.8% of frame and rendering as a near-black paper
   * cutout (masked: L 52.3, sd 20.3 — essentially all of it the cast shadow
   * rather than surface). It moves to a 1.5 m tiling foliage set with
   * box-projected world-scale UVs, and the factor drops to (1,1,1) so the
   * colour lives where it can carry structure.
   *
   * THE TILE CARRIES CLUMPS, NOT LEAVES, and that is a measurement rather than
   * a style choice: the hedge stands 13 m from the HERO camera at 0.010 m per
   * pixel, so a 40 mm box leaf is 0.4 px. Authoring leaf detail would put all
   * the energy below every camera's Nyquist limit and buy sparkle. What
   * resolves is the 150–300 mm clump structure and the shear plane.
   *
   * Deliberately NOT changed: the geometry. A clipped hedge's batter is ~40 mm
   * over a 1.0 m height — four pixels — and buying it would cost a bounds
   * waiver and a re-ship for detail no camera resolves. The open FRONT between
   * the two runs' ends is also left alone: that gap is the arrival, and P5A's
   * forecourt runs through it.
   */
  p5d: '/models/exterior_mansion_v6_p5d.glb',
  /**
   * P5E CANDIDATE — the cypresses get a surface. Built on p5d. Not shipped.
   *
   * Same defect and same remedy as the hedge: `MAT_Cypress` was a bare
   * `baseColorFactor (0.019, 0.038, 0.015)`, masked at L 44.2 / sd 15.8, and it
   * is the largest single soft mass at NW (4.08%). It moves to a 1.5 m tiling
   * set whose structure runs VERTICALLY (the noise lattice is stretched 3:1
   * along v) because a cypress's sprays run up the tree.
   *
   * Two costs stated rather than buried. Re-shipping the 14 cones through
   * Blender 5.2 changed their triangulation — 304 → 320 triangles each, +224
   * total — because the exporter fans the cone's n-gon base differently from
   * the build that produced v5. Bounds are identical to 5 mm and the shape is
   * unchanged; the graft's `--allow-growth` waiver was passed deliberately for
   * this and the delta is reported, not absorbed. And the UASTC normal maps for
   * hedge and cypress are ~1 MB each, which is what takes the candidate from
   * 14.35 to 16.60 MB — P5J's ETC1S question, on the measured basis that ETC1S
   * only facets across large flat surfaces and foliage has none.
   */
  p5e: '/models/exterior_mansion_v6_p5e.glb',
  /**
   * P5F — ARRIVAL. **No candidate file: this pass is a deliberate no-op.**
   *
   * The arrival itself was delivered by p5a (the gravel turning circle and
   * approach) and p5c (its edging). What remained on the list — a threshold or
   * gate piers where the drive passes between the hedge runs' ends at z 19, and
   * a treatment where the approach meets the far field at z 34 — was tested
   * against the mandate's own visibility rule and **rejected**: the HERO camera
   * stands at z 27 looking toward the origin, so both sit behind or below its
   * frame, and the emissive-id coverage pass puts the drive at 0.92% at WEST
   * and 0.41% at NW. Geometry at z 19–34 is not visible at any of the four
   * validated cameras. Adding it would be decoration with no frame to improve.
   *
   * Recorded here rather than silently skipped, because "we built nothing" is a
   * result that needs its reasoning on the record as much as any other.
   */
  /**
   * P5G CANDIDATE — the fountain water. Built on p5e. Not shipped.
   *
   * The water read as a black hole in the forecourt at 4.1% of the HERO frame,
   * and the cause is arithmetic rather than taste. In glTF a transmissive
   * material's `baseColorFactor` is its TRANSMISSION TINT: it multiplies
   * whatever is seen through the surface. `MAT_Water` carried
   * (0.03, 0.06, 0.07), so it passed 3–7% of the light from the basin floor
   * beneath it — and that floor is `fount_floor` in `MAT_Stone_Paving`, which
   * renders at L 116 in the open. The basin was not dark; the water was opaque.
   *
   * The replacement is derived, not picked. The water surface sits at y 0.40
   * over a floor at 0.05–0.14, so the depth is 0.26 m and the light path is
   * twice that. Clear-water absorption (0.270 / 0.050 / 0.020 per metre at
   * 600 / 500 / 450 nm) gives a transmittance of (0.869, 0.974, 0.990) — water
   * over a quarter of a metre is very nearly colourless, with a faint cyan
   * cast. Multiplied by 0.86 for the suspended matter a stone basin actually
   * carries, and +2% green for the same reason, that is **(0.747, 0.858,
   * 0.851)**. The shipped value was 25× / 14× / 12× too dark.
   *
   * ROUGHNESS IS NOT TOUCHED, and that is a measurement too. P4D set it to
   * 0.07 and it is not the limiting factor here: the HERO camera looks down on
   * the basin at roughly 30° of incidence, where the Fresnel reflectance of an
   * ior 1.333 surface is about 2.5%. Ninety-seven per cent of what the water
   * shows is transmission, so the tint is the whole story and the P4D decision
   * stands untouched.
   */
  p5g: '/models/exterior_mansion_v6_p5g.glb',
  /**
   * P5H — SECONDARY DETAIL: two entrance urns, finishing a detail the
   * architecture already set up.
   *
   * THE ENTRANCE ALREADY HAD TWO PEDESTALS AND NOTHING ON THEM. `entry_cheek_-1`
   * and `entry_cheek_1` are the flanking blocks either side of the entry steps —
   * x ±2.500..3.000, z 5.600..6.800, flat top at y 0.600 — step cheeks built to
   * carry something. At HERO they project to x 970 and 1138 of 1425, unoccluded,
   * 30.6 m out. A classical entrance whose cheeks are bare is unfinished, and
   * that is what the frame showed.
   *
   * NOT A NEW VISUAL LANGUAGE. The estate already carries urns: `finial_urn_0..3`
   * on `finial_plinth_0..3` at the spire base, in MAT_Stone_Trim. This is the
   * same idea at the scale the ground floor needs, in the same material.
   *
   * DESIGNED TO THE PIXEL COUNT, NOT TO A CATALOGUE. tools/gltf/p5h_visibility.py
   * projected the proposal through the runtime's own cameras BEFORE anything was
   * modelled: 35.1 px tall and 18.8 px wide at HERO, 34.6 at WEST, occluded by
   * the building at NW, behind the camera at TURN and CONSTELLATION. So there is
   * no surface ornament — gadrooning, fluting, handles and an acanthus collar are
   * all 1–2 px here and would buy sparkle. The silhouette carries the read, so
   * the form is a campana urn (widest at the mouth, against the sky rather than
   * against the pedestal) with a lidded top that closes the geometry with no
   * interior to model. 16 radial segments, from the silhouette error and not from
   * habit: an n-gon deviates from its circle by R(1−cos(π/n)), which at R = 8.5 px
   * is 0.65 px at n=8, 0.29 at n=12 and 0.16 at n=16, against the ~0.3 px
   * anti-aliasing resolves.
   *
   * COST, STRUCTURALLY EXACT: +2 nodes, +856 triangles (428 each), +21 KB of GLB.
   * **Materials 17 → 17, textures 40 → 40, images 40 → 40** — MAT_Stone_Trim is
   * matched by name in the graft, so no new material, image or shader program.
   *
   * COLOR_0 WAS NOT OPTIONAL. MAT_Stone_Trim multiplies base colour by the
   * StoneAO attribute through a ShaderNodeMix (RGBA/MULTIPLY/Factor 1); a
   * primitive without it renders unmultiplied AND makes GLTFLoader cache a second
   * material instance for the same glTF material (its cache key carries
   * `vertex-colors:`). The urns are baked with tools/blender/bake_ao_raycast.py at
   * the same 0.40 floor as the rest of the stone and land at mean 0.714 — between
   * the roof finial urns (0.786) and the cheek they stand on (0.595), and level
   * with the terrace (0.702). MEASURED in the live scene: 16 material names →
   * 17 instances on p5g AND on p5h, so the urns joined the 39-primitive
   * vertex-coloured side and forked nothing.
   *
   * MEASURED THROUGH THIS PAGE, pose-verified, p5h against p5g at the same
   * camera to sub-millimetre (0.0000 / 0.0072 / 0.0073 / 0.0000 m):
   *
   *                       HERO      WEST      NW      HERO dusk
   *   urn coverage        0.07 %    0.04 %    0.00 %  0.07 %
   *   urn L               100.85    79.76     —       132.03
   *   urn sd               23.93    22.97     —        30.66
   *
   * Isolated against a working control (terrace 81,222 px), the pair renders
   * 938 px at HERO and 546 at WEST, and is completely occluded by the building
   * at NW — which is what the pre-authoring audit predicted, so no budget was
   * spent on a camera that cannot see it.
   *
   * SUBORDINATE, WHICH IS THE ACCEPTANCE TEST AND NOT AN OPINION. At HERO the
   * hierarchy reads masonry 133.02 > terrace 116.10 > steps 109.88 > **urn
   * 100.85** > drive 94.91 > lawn 70.52 > hedge 53.55 > cypress 44.87. The urns
   * sit below both large stone surfaces and above the ground: present, not
   * competing. EVERY unrelated class moved ≤ 0.14 at HERO and ≤ 0.11 at dusk.
   * The two that moved are the two that should: `steps` −0.27 L / −0.02 pp,
   * because the urns stand on the cheeks and shade them.
   *
   * COST: +2 draw calls per pass (+4 at HERO, since MAT_Water's transmission
   * re-renders the opaque scene), +1,712 submitted triangles, +2 geometries,
   * +15.3 KB on the wire. Textures 47 → 47 and GPU residency 62.65 → 62.65 MB —
   * exactly zero. 9 lights and 1 shadow caster, unchanged.
   */
  p5h: '/models/exterior_mansion_v6_p5h.glb',
  /**
   * P5K — the P5C CORRECTION CANDIDATE. Not a new pass: p5h with one object
   * repaired. See docs/PHASE5_REPORT.md §19.
   *
   * `edging_hardscape` shipped inside-out. `p5c_transitions.py` wound each
   * ribbon quad from the caller's traverse direction, which is not a fixed
   * sense: worked through, rect_run's four sides, the forecourt arc and the
   * side=-1 approach flank all come out normal −Z while the side=+1 flank alone
   * comes out +Z — predicting 229 down and 20 up over 132+77+40 = 249 polygons,
   * which is exactly what the shipped mesh measures. Against a single-sided
   * MAT_Stone_Trim that left the object rendering **1 px at HERO and 0 at WEST
   * and NW**.
   *
   * REPAIRED AT THE GENERATOR, NOT WITH A POST-HOC RECALC. These ribbons are an
   * OPEN surface, so `recalc_face_normals` only makes a component mutually
   * consistent — the global sense it settles on is arbitrary, which would trade
   * a reproducible bug for a coin toss. Every quad is a near-horizontal strip
   * whose visible face is its top, so orientation is knowable outright from the
   * quad's own XY shoelace area. Result asserted: **249/249 faces up, min
   * normal z 0.99925**, against 20/249 before.
   *
   * COLOR_0 added by the same AO bake the rest of the stone uses (mean 0.858 —
   * between fountain_bowl_lip 0.864 and finial_plinth 0.812, correctly high for
   * a strip lying in the open). That also retires the material fork: all 39
   * MAT_Stone_Trim primitives now carry COLOR_0, where p5g and p5h had 38 of 39.
   *
   * THE 30 mm LIFT IS UNCHANGED, AND THAT IS A MEASUREMENT. The ground's 520 m
   * extent gives a 31.74 mm Draco position quantum — confirmed on the decoded
   * mesh, whose 15,455 vertices carry only 218 distinct Y values exactly
   * 31.74 mm apart — so 30 mm of lift is under one step, which sounds fatal.
   * It is not: ray-casting all 568 edging vertices against the shipped
   * post-Draco ground gives clearance **min 17.71 mm, median 18.98, max 50.72,
   * with ZERO vertices at or below the ground and none under 5 mm**, against
   * ~0.54 mm of depth precision at 30 m. Raising it would only float a ribbon
   * that has no side wall.
   *
   * Geometry is otherwise untouched: 508 verts / 249 polys / 498 tris before and
   * after, and the sorted world vertex positions hash identically
   * (`b249072723c55974`). Graft: replaced 1, added 0, **no growth waiver
   * needed**; nodes 483 → 483, materials 17 → 17, textures 40 → 40, images
   * 40 → 40, triangles 186,007 → 186,007.
   */
  p5k: '/models/exterior_mansion_v6_p5k.glb',
  /**
   * P5M — the one performance hypothesis the report left untested: the cypress
   * normal map at 512² instead of 1024². Under evaluation; see §20 of the
   * report for the verdict.
   *
   * WHY IT SHOULD BE FREE, WHICH IS WHY IT WAS WORTH ONE CYCLE. The map is a
   * 1.5 m tile at 1024², so 1.46 mm per texel. The cypresses are never nearer
   * than ~40 m, where the NW camera resolves about 43 mm per pixel — a 30×
   * MINIFICATION, so the GPU is sampling around mip 5 (32×32). A 512² map's
   * mip 4 is that same 32×32 level built by the same box filter. The only level
   * this deletes is a base no camera in the sequence ever reaches. That is the
   * P5A sampling argument run in the opposite direction.
   *
   * This is NOT the rejected P5J experiment. That changed the CODEC (ETC1S),
   * which quantises normal endpoints and cost the cypress 25.5 luma at NW. This
   * changes RESOLUTION and keeps UASTC. The codec decision stands untouched.
   */
  p5m: '/models/exterior_mansion_v6_p5m.glb',
  /**
   * P3F — PHASE 3, FINISHED: the P3.4 architecture carried into the production
   * lineage. p5m plus 56 nodes, with 5 neighbours re-baked. Built by
   * tools/blender/p3f_integrate.py and p3f_neighbours.py, exported by
   * export_web.py and grafted with graft_draco_nodes.py; see docs/PHASE3_REPORT.md.
   *
   * WHY IT WAS NEVER IN PRODUCTION. Phase 3 (p31-p34) was authored on the 27
   * August source and committed with production left on v5. Phase 2.5B, 4 and 5
   * all branched from that same source, so p5m has zero P3_ nodes and the
   * ashlar still runs 5.07 m to the cornice with bare wall at every corner.
   *
   * WHAT IS ADDED: the column bases, door jambs, third tread, crowning cornice,
   * portico bed mould and architrave fillet (8 P3_ nodes, MAT_Stone_Trim /
   * MAT_Stone_Steps), and the 48 corner quoins (MAT_Stone_Wall) — 1,270
   * triangles, on the Phase 4 materials BY NAME, so no material, texture or
   * image is added.
   *
   * WHAT p34 HAD WRONG FOR THIS LINEAGE, and is re-authored rather than copied:
   * the quoins carried no per-block tone where every ashlar block carries one
   * (P4A), and the trim pieces carried a hand-matched AO constant each where
   * every production trim surface carries a raycast bake. Both are redone in
   * the production scene.
   *
   * WHAT IS REPLACED, AND WHY ONLY THESE: lion_frieze, mansion_walls,
   * entry_cheek_-1/1 and entry_step_0 — the objects whose AO the new pieces
   * move by more than 0.05 anywhere. Decoded against p5m, every replaced
   * vertex lands on a shipped (position, normal, uv), and colour changes
   * beyond 1.6 m of a P3 piece: 0 on four of them, 7 of 89,903 on
   * mansion_walls at <= 0.008.
   */
  p3f: '/models/exterior_mansion_v6_p3f.glb',
  /** The client-review estate; the default. See EXTERIOR_MODEL_URL. */
  v7: '/models/exterior_estate_v7.glb',
  /**
   * P5H, SECOND ELEMENT — DUSK ARRIVAL LIGHTING. **Tested and REJECTED on
   * measurement.** No candidate, and no light was added.
   *
   * The hypothesis was the report's own: at dusk there is no exterior lighting
   * beyond window glow, so the arrival should get a restrained source of its
   * own. It was tested the way the fog stop-condition was — swept on the LIVE
   * scene by tools/capture/p5h_lightsweep.mjs and restored (9 lights before,
   * 9 after, baseline re-measured to ±0.11) — rather than by editing a shared
   * lighting rig on a guess.
   *
   * IT BRIGHTENS THE GROUND AND THE ORNAMENT, NOT THE ARCHITECTURE. Two warm
   * point lights at the foot of the steps, at the only in-frame lamp station of
   * the three tested (the forecourt kerb at z 16 falls 96 px BELOW the HERO
   * frame and 561 below WEST). At HERO dusk, Δ luminance against baseline:
   *
   *                  i=2.0    i=4.4    i=8.0
   *     urn          +7.38   +15.23   +26.01
   *     terrace      +2.92    +5.99   +10.05
   *     steps        +1.96    +4.28    +7.98
   *     masonry      +1.28    +2.83    +5.22
   *     mansion      +0.76    +1.67    +3.12
   *
   * The terrace already outruns the masonry at dusk (130.53 vs 126.21); the
   * lamp widens that gap by 73% at i=4.4, and the urns — a secondary detail —
   * gain four times what the building does and reach 158 at i=8.0, second only
   * to the steps. That is §14's failure exactly: a new focal point competing
   * with the architecture. The visible frame confirms it: two circular pools on
   * the paving with NO fixture to explain them, which is the "sticker" read
   * this rig's own comments already document for point lights on flat surfaces.
   *
   * AND THE COST LANDS ON THE SHIPPING LOOK. Daylight ships; ?grade=dusk is the
   * rollback. three's WebGLLights increments `pointLength` unconditionally —
   * there is no `intensity === 0` skip — so a dusk-only light still costs a
   * per-fragment loop iteration in daylight, where it contributes nothing.
   * Paying that, plus a fixture mesh, a new emissive material and a new program,
   * to make a non-shipping grade worse is not a trade worth making.
   *
   * **The urns already deliver the dusk arrival at zero lighting cost**: they
   * measure L 132.03 at dusk against 100.85 in daylight, because they stand
   * 2.75 m from the entrance rectAreaLight and catch the wash that is already
   * there. The detail the hypothesis wanted is geometry, not light.
   *
   * P5I — COMPOSITION. No candidate file: the composition pass is evaluation.
   * Re-run after P5H, it found the hierarchy intact and nothing needing
   * correction. Its findings are in the report.
   */
  /**
   * P5J — PERFORMANCE. **No candidate file, and that is the finding.**
   *
   * One optimisation was attempted and REJECTED ON MEASUREMENT. The two
   * foliage normal maps are the largest single cost Phase 5 added (~1 MB each
   * on the wire, +8 MB of the GPU residency), and re-encoding them ETC1S
   * instead of UASTC took them to 336,783 and 297,246 bytes — **−67% and
   * −71%**, 16.60 → 15.27 MB. The repository's own earlier measurement said
   * this should be safe: ETC1S was rejected for v5 because it facets across
   * large FLAT surfaces, and foliage has none.
   *
   * It was not safe. Masked against p5g at the same poses, the hedge fell
   * **48.10 → 32.24 (−15.9)** at WEST and the cypress **56.74 → 43.54
   * (−13.2)**; at NW the cypress fell **66.44 → 40.91 (−25.5)** and the hedge
   * **61.82 → 45.77 (−16.1)**. Standard deviation rose at the same time
   * (cypress 10.95 → 22.85 at NW), which is the signature: the codec is
   * quantising the normal erratically enough to tilt whole clumps away from
   * the key, so the planting both darkens and goes blotchy. A 1.3 MB saving is
   * not worth 25 luma on the largest soft mass in the NW frame.
   *
   * Reverted. p5g carries no orphaned images (each candidate in the chain was
   * pruned as it was built), so a pruned p5j came out byte-identical to it and
   * has been deleted rather than shipped as a duplicate. **Not resurrected in
   * the P5H revalidation, and not re-tested: the measurement above stands.**
   *
   * P5J, RE-RUN AFTER P5H, FOUND SOMETHING ELSE — AND IT IS IN P5C, NOT P5H.
   *
   * `edging_hardscape` renders **1 pixel at HERO and 0 at WEST and NW**, against
   * a working control in the same pass (terrace 81,222 px) and against ~3,800 px
   * that its geometry predicts. It is INSIDE-OUT: 229 of its 249 polygons carry
   * a normal pointing at the ground (mean normal z −0.839) and MAT_Stone_Trim is
   * single-sided, so they are backface-culled. Disabling the depth test does not
   * bring the pixels back — they are not losing a depth fight, they are not
   * being drawn. (A Draco-quantisation hypothesis — the ground's 520 m extent
   * gives a 31.74 mm position quantum against the edging's 30 mm lift — was
   * tested by that same depth-test switch and is NOT the cause.)
   *
   * The cause is in tools/blender/p5c_transitions.py: it builds each ribbon quad
   * from a point order that depends on the traverse direction and never calls
   * `bmesh.ops.recalc_face_normals`. Its own assertion checks the vertex Z
   * against the sampled ground to 1e-4 — a POSITION check, which is true and
   * says nothing about winding. So p5g ships **498 triangles that draw nothing**,
   * plus the MAT_Stone_Trim material fork above, for an object no camera sees.
   *
   * NOT FIXED HERE, deliberately. It is a P5C defect, not P5H's subject; the fix
   * changes an accepted candidate's appearance (a kerb line would APPEAR that has
   * never been seen) and needs its own four-camera acceptance pass. It is
   * pre-existing in p5g and affects no p5h measurement. Recommended as a scoped
   * follow-up: recalc normals, add the StoneAO attribute, re-verify at all four
   * cameras. See docs/PHASE5_REPORT.md §12.
   *
   * **p5h is the Phase 5 candidate to judge.**
   */
};

export function resolveExteriorModelUrl(search?: string): string {
  const s = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  const key = new URLSearchParams(s).get('model');
  return (key && MODEL_CANDIDATES[key]) || EXTERIOR_MODEL_URL;
}

/**
 * Measured from the delivered GLB: mansion x -9.55..9.55, z -5.55..6.10, roof
 * 6.95, spire tip 11.72. Fountain centre at z 13.2, entry step at 6.15.
 *
 * The ground is authored terrain rather than a plane, so its far edge is a
 * silhouette against the sky and no longer needs fog to hide a hard boundary —
 * but fog still has to close before 120m or the terrain simply stops.
 */
export const EXTERIOR_BOUNDS = {
  // v7: estateBounds.ts is the measured source; restated here for the runtime.
  spireTop: 20.34,
  // The delivered terrain spans +/-120m and undulates from y -2.97 to +0.97.
  // It was a flat 450m plane; the camera far plane and the fog are tuned
  // against this number, so it is measured rather than assumed.
  // v7: flat inside the compound wall, a planted berm outside it, +/-330 m.
  groundHalfSpan: 330,
} as const;

/**
 * Emissive anchoring — the lights being ON inside the building.
 *
 * Bloom only ignites pixels above its luminance threshold, and every material
 * in this GLB is diffuse: lit by the key, never emitting. So the bloom pass was
 * running over a building that mathematically could not cross the threshold,
 * doing nothing but cost. It also meant the mansion read as ABANDONED — a
 * correctly lit exterior with dead black window openings is a house nobody is
 * in, which is the opposite of what this page is selling.
 *
 * Emissive is not affected by scene lighting, so these are what carry the
 * building through the dark end of the orbit where the key falls off.
 *
 * Applied to the window and door interiors rather than the glass: the glass is
 * transmissive and lighting IT makes a glowing pane, whereas lighting what sits
 * behind it reads as a lit room seen through a window.
 */
/**
 * THE PAVING, graded away from the elevation it shares a material with.
 *
 * MEASURED on the composited hero frame, sampling the framebuffer at projected
 * world points:
 *
 *   terrace_upper      158     <- the BRIGHTEST surface in the whole frame
 *   lit facade         144
 *   roof slate         140
 *   forecourt          127
 *   lawn                48
 *
 * The terrace was reading brighter than the building it supports. That is the
 * inverted value hierarchy behind "the hero feels game-like": the eye has
 * nowhere to land, because the largest, nearest, brightest object in frame is a
 * horizontal plate rather than the architecture.
 *
 * The cause is structural, not artistic. The delivery has exactly ONE stone
 * material, and 107 meshes share it — terrace_lower/upper, the 95 rusticated
 * base blocks, the entry steps and cheeks, and the whole fountain surround —
 * along with the walls. Identical albedo on a horizontal and a vertical
 * surface. The artist bevelled all of them at 12-14mm, which is why their EDGES
 * now catch light properly, but a bevel cannot change what a face is worth.
 *
 * Splitting them and multiplying to 0.48 is also what the light actually does:
 * at dusk a horizontal limestone terrace sees a near-black sky, while a wall
 * sees the warm key. Verified by sweeping the multiplier on the live material —
 * the paving moves (terrace 158 -> 116, forecourt 127 -> 92) while the facade
 * holds at 144, because they are now different materials.
 *
 * WHAT THIS REPLACES. A previous pass graded MAT_Ground here instead, on the
 * assumption that the bright band was the lawn. The sweep disproved it: tinting
 * the ground moved the lawn 48 -> 38 and left the forecourt at 127 untouched,
 * because the forecourt is not the ground. That grade is deleted rather than
 * left in as a second, unjustified darkening.
 */
const PAVING_RE = /^(terrace_|rustic_|entry_step|entry_cheek|fount_)/;

/**
 * Per grade, because the reason the tint exists is grade-dependent.
 *
 * The 0.48 above is argued from a DUSK sky: a horizontal plate sees a
 * near-black sky while a wall sees the warm key, so the plate is worth less.
 * Under daylight that argument still holds but the numbers move — the sky is
 * now a light source, the plate sees more of it, and 0.48 left the terrace at
 * 165.6 against the Blender reference's 134.6, i.e. the brightest thing in
 * frame again and the same inverted hierarchy in a brighter room.
 *
 * 0.37 is measured, not derived: swept on the live material against the
 * reference until the terrace sat under the facade rather than over it. The
 * facade is untouched by this — it is a different material after the split.
 */
/**
 * PHASE 4 (P4B): RETIRED TO 1.0. The multiply above was a runtime grade on
 * top of a Blender material that never had it, so paving, steps, the 96
 * rustic blocks and the fountain trim could not be measured against the
 * reference at all (P4 audit §1.5, §5). The owner's decision is that the GLB
 * is the material: the intended darkening is authored into the P4B materials
 * (albedo, roughness, COLOR_0 contact) and this stays at 1.0, which also
 * returns the runtime from 16 materials to the GLB's 15. The machinery is
 * kept, inert, so the rollback is a number and not a revert.
 */
const PAVING_TINT: Record<Grade, number> = { dusk: 1.0, daylight: 1.0 };

type EmissiveSpec = Record<string, { color: string; intensity: number }>;

/**
 * DUSK emissive. The building is lit from inside because outside it is dark.
 */
const EMISSIVE_DUSK: EmissiveSpec = {
  // Warm interior spill. This is the main event — 28 window and arch reveals
  // across the elevation, so the facade reads as occupied.
  // 2.6 -> 0.55. VERIFIED: every archback node in the GLB sits at translation
  // [0,0,0], so these meshes are NOT detached and no positional fix applies.
  // They are large flat planes filling each arch, and at 2.6 they crossed the
  // bloom threshold across their whole area — which is what read as floating
  // glowing orbs in front of the arches. At 0.55 they sit below the threshold
  // and read as a warm interior behind the opening. The LIGHT those windows
  // cast is now the RectAreaLights in WorldCanvas, which is where it belongs:
  // emissive was never going to illuminate the stone around it.
  MAT_Window_Interior: { color: '#FFAA55', intensity: 0.55 },
  // The gold finials, spire tip and door furniture catch a low amber so the
  // roofline has points of light against the sky at the top of the orbit.
  MAT_Gold: { color: '#FFC98A', intensity: 0.4 },
  // Faint: the door reveal should suggest a lit hall beyond, not a light box.
  MAT_Wood_Dark: { color: '#FF9A40', intensity: 0.35 },
};

/**
 * DAYLIGHT emissive — almost none of it, and that is the point.
 *
 * Every argument for the dusk values above is an argument about DARKNESS: the
 * bloom threshold, the dark end of the orbit, a facade that would otherwise
 * read as abandoned. At midday none of them apply. The approved Blender render
 * shows dark recessed glazing — glass in shadow, which is what glass looks like
 * from outside a lit exterior — and lit windows in that frame read as a house
 * with every lamp on at noon.
 *
 * Window interiors go to zero. They are large flat planes filling each arch and
 * any positive value paints them over the shadow the reveal is supposed to
 * cast.
 *
 * The gold keeps a token 0.08. Not for glow — at metalness 1 against a 0.7
 * environment it has plenty to reflect — but because the finials are 40mm
 * details at hero distance and dropping them to nothing loses the roofline
 * entirely. Measured: 0.4 -> 0.08 removes the bloom halo and keeps the points.
 */
const EMISSIVE_DAYLIGHT: EmissiveSpec = {
  MAT_Window_Interior: { color: '#FFAA55', intensity: 0.0 },
  MAT_Gold: { color: '#FFC98A', intensity: 0.08 },
  MAT_Wood_Dark: { color: '#FF9A40', intensity: 0.0 },
};

const EMISSIVE: Record<Grade, EmissiveSpec> = {
  dusk: EMISSIVE_DUSK,
  daylight: EMISSIVE_DAYLIGHT,
};

/**
 * WHAT THIS FILE NO LONGER DOES, AND WHY.
 *
 * Until the final Blender delivery this component carried four compensations
 * for an exterior GLB that shipped incomplete. Every one of them is now
 * deleted, because the delivered asset does the job properly and a
 * compensation layered on top of a correct asset is not a safety net — it is a
 * second, worse art direction fighting the first.
 *
 *   GRADE           MAT_Ground and MAT_Hedge both shipped baseColorFactor
 *                   [1,1,1,1] with NO texture, so the lawn and the hedging
 *                   rendered pure white. They were tinted here to a night
 *                   lawn and a box green. The delivery now ships MAT_Ground
 *                   with `ground_basecolor` + `ground_roughness` (a baked 4096
 *                   zone mask covering gravel forecourt, drive and parterres)
 *                   and MAT_Hedge as an authored [0.026, 0.052, 0.018], with a
 *                   separate MAT_Cypress for the trees.
 *
 *   PBR             Four real texture sets were fetched from /textures and
 *                   bolted onto MAT_Stone_Cream, MAT_Roof, MAT_Gold and
 *                   MAT_Wood_Dark because the GLB had normals and roughness
 *                   for none of them. All four now arrive with their own KTX2
 *                   sets, and the roof has been split onto MAT_Roof_Slate with
 *                   real slate courses so it can be tuned apart from the spire.
 *                   Loading JPEGs over KTX2 that already exists would cost a
 *                   second upload to look worse.
 *
 *   PAVING          The terrace, the 95 rusticated base blocks, the entry steps
 *                   and the fountain surround all shared MAT_Stone_Cream with
 *                   the walls, so the horizontal surfaces rendered as bright as
 *                   the elevation and the terrace read as a lit plate the
 *                   building sat on. They were cloned and multiplied down to
 *                   42%. The delivery bevels all of them at 12-14mm and
 *                   re-materials them, so the edges now catch light on their
 *                   own and the flat 42% multiply would just crush them.
 *
 *   HIDDEN GROUND   `ground_plane` was set invisible because <Terrain /> drew
 *                   procedural karst in its place. It is now 18,432 triangles
 *                   of authored terrain spanning +/-120m, and <Terrain /> has
 *                   been unmounted. Hiding it would leave the mansion standing
 *                   on nothing.
 *
 * What survives is EMISSIVE above — a grade, not a repair. Nothing in the GLB
 * makes the windows read as a house with people in it, and that is a lighting
 * decision to make against a rendered frame rather than in Blender.
 */

/**
 * THE POLISH PASS: what the golden hour needs from the materials that the
 * exporter cannot know.
 *
 * The client's verdict on the first estate was that it "looks like another 3D
 * build", and three material facts were doing most of that work:
 *
 *   THE ROOF WAS A BLACK VOID. MAT_Roof_Slate carries the P4C slate maps, which
 *   were authored against a scene with an environment and a fill that no longer
 *   exist; under a 13-degree sun the roof is the largest surface in the hero and
 *   it returned near-black, so the building read as a pale box with a hole cut
 *   out of the top of it. Real slate at this hour is a blue-grey that carries
 *   the sky — so it is lifted, and given the sky to carry.
 *
 *   NOTHING REFLECTED ANYTHING. Outside, scene.environment was a grey studio
 *   box (RoomEnvironment) until this pass; now that it is the estate's own sky,
 *   the surfaces that live on reflection — water, glass, gilt, chrome, polished
 *   stone — have to be told to take more of it than a wall does. envMapIntensity
 *   is per material, so this reaches exactly those and cannot touch the stone.
 *
 *   THE LAWN WAS A FLAT FIELD. Grass at a low sun has a strong forward sheen;
 *   at roughness 0.92 it had none, and read as painted card.
 *
 * Applied to the CLONED graph on load, like every other pass here, and keyed by
 * material name so a re-export that renames a material fails loudly (the count
 * in the ready log drops) rather than quietly rendering the old look.
 *
 * `env` IS A GAIN ON THE SKY, and until the AO pass it did nothing at all.
 * three r173 (WebGLRenderer.setProgram) overwrites envMapIntensity with
 * scene.environmentIntensity for every standard material that takes its
 * environment from the scene — so the pool, the glass, the gilt and the chrome
 * all reflected the sky at the global 0.25, exactly like the lawn. The override
 * only applies when material.envMap is null, so the polished materials are now
 * given the environment explicitly (useSkyReflections below) and their
 * intensity is set to env x the global: a gain relative to everything else,
 * which is what these numbers were always meant to be.
 */
const POLISH: Record<string, { colour?: number; rough?: number; env?: number; metal?: number; opacity?: number }> = {
  MAT_Roof_Slate: { colour: 1.85, rough: 0.82, env: 1.35 },
  MAT_Roof: { colour: 1.7, rough: 0.85, env: 1.3 },
  MAT_Lawn: { colour: 1.28, rough: 0.72, env: 1.0 },
  MAT_Water: { env: 2.0 },
  // A REFLECTING POOL, not a resort one (essence.md: old money is quiet). The
  // cyan sheet over a pale shell was the loudest colour in every frame it was
  // in, and the most "game" surface in the hero. Dark water mirrors the sky and
  // the house, and at evening its lights (MAT_Light_Pool) glow against it.
  MAT_Water_Pool: { colour: 0.32, env: 4.2 },
  // Clear glass, not smoked: at 0.55 over a dark tint the panes were the
  // review's "flat black voids". Thin, so the rooms behind show
  // (exteriorWindows.ts) and the sky rides on it by Fresnel.
  MAT_Glass_Window: { env: 2.8, opacity: 0.26 },
  MAT_Glass_Rail: { env: 2.4 },
  MAT_Car_Glass: { env: 2.4 },
  MAT_Car_Paint: { env: 2.2 },
  MAT_Car_Paint_Pale: { env: 2.0 },
  MAT_Chrome: { env: 2.2 },
  MAT_Steel: { env: 1.9 },
  MAT_Gold: { env: 1.9 },
  MAT_Stone_Terrace: { env: 1.5 },
  MAT_Stone_Paving: { env: 0.9 },
  // Dark slate under dark water: the reflecting pool above. At 0.45 the shell
  // still read cyan through the sheet.
  MAT_Pool_Shell: { colour: 0.16, env: 1.2 },
};

/**
 * MOVING WATER, WHICH IS THE POINT OF WATER.
 *
 * Every sheet of water on the estate — the fountain basins, the canal, the new
 * pool — was a mirror-flat plane, and a mirror that never moves does not read as
 * water. It reads as glass, or worse, as the painted blue rectangle a site plan
 * uses. Now that the sky is bound as the environment there is something in those
 * reflections worth disturbing, and disturbing them is what makes the surface
 * legible AS a surface.
 *
 * TWO CROSSED WAVE TRAINS, IN THE NORMAL ONLY. No vertex displacement (the sheet
 * is a flat quad with four corners — there is nothing to displace) and no
 * texture (a 1 KB shader chunk against a 300 KB normal map). Two sine trains at
 * different frequencies, angles and speeds sum into something that does not
 * visibly repeat at the distances the film holds; the amplitude is deliberately
 * tiny — 0.02 in the normal — because water at 40 m is a slight unsettling of
 * a reflection, not a choppy sea.
 *
 * ONE UNIFORM OBJECT, SHARED. Every water material gets the same `uTime`
 * reference, so the per-frame cost is a single assignment rather than a
 * traversal.
 */
const WATER_RE = /^MAT_Water/;
const POOL_RE = /^MAT_Water_Pool/;

/**
 * THE WATER, SECOND PASS — the art-direction review still read the pool as
 * "a solid, static blue plane ... painted plastic".
 *
 * Two sines of 0.02 were below what a 2880px frame can show. Now:
 *
 *   FOUR WAVE TRAINS, 2.3 m down to 0.27 m, each summed into the slope of the
 *   surface in WORLD space (the sheet is level) and turned into the view-space
 *   normal. Every train fades out as it shrinks toward a pixel (fwidth), so
 *   the far canal keeps its long swell and the pool at the lens gets its
 *   ripples, and nothing aliases into a shimmer. The sun's highlight breaks on
 *   them into glints; the sky and the house break in the reflection.
 *
 *   DEPTH, IN THE POOL. Water over a pale shell is light where it is shallow
 *   and deep where it is not. The pool is a single sheet, so the depth is
 *   read from the distance to its own edge (its world box, measured once):
 *   lighter over the first metre of the rim, the dark reflecting body beyond.
 *
 *   CAUSTICS where it is shallow: the network of light a rippled surface
 *   focuses onto the floor under it, drifting with the waves.
 */
function animateWater(root: THREE.Object3D, clock: { value: number }): number {
  const done = new Set<THREE.Material>();
  let count = 0;
  root.updateMatrixWorld(true);
  const poolBox = new THREE.Box3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.some((m) => m && POOL_RE.test(m.name))) poolBox.expandByObject(mesh);
  });
  const box = new THREE.Vector4(poolBox.min.x, poolBox.min.z, poolBox.max.x, poolBox.max.z);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial & { __ripple?: boolean };
      if (!mat || mat.__ripple || !WATER_RE.test(mat.name)) continue;
      mat.__ripple = true;
      const pool = POOL_RE.test(mat.name) && !poolBox.isEmpty();
      if (pool) mat.defines = { ...(mat.defines ?? {}), WATER_POOL: '' };
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.uniforms.uTime = clock;
        shader.uniforms.uPoolBox = { value: box };
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', `varying vec3 vRipplePos;
             void main() {`)
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vRipplePos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', `${WATER_FUNCTIONS}
             void main() {`)
          .replace('#include <color_fragment>', `#include <color_fragment>
${WATER_COLOUR}`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${WATER_NORMAL}`);
      };
      mat.customProgramCacheKey = () => `water-ripple-v2${pool ? '-pool' : ''}`;
      mat.needsUpdate = true;
      count += 1;
    }
  });
  return count;
}

const WATER_FUNCTIONS = /* glsl */ `
uniform float uTime;
uniform vec4 uPoolBox;
varying vec3 vRipplePos;
// One train's slope: amplitude x wavenumber x cos, along its direction, faded
// out before its wavelength shrinks to a couple of pixels.
vec2 waterTrain(vec2 p, float lambda, float angle, float slope, float speed, float fw) {
  float k = 6.2831853 / lambda;
  vec2 d = vec2(cos(angle), sin(angle));
  float keep = 1.0 - smoothstep(lambda * 0.18, lambda * 0.5, fw);
  return d * slope * keep * cos(dot(d, p) * k - uTime * speed);
}
float waterCaustic(vec2 p, float t) {
  float r1 = abs(sin(p.x * 3.1 + sin(p.y * 2.3 + t * 0.8) * 1.2 + t * 0.6));
  float r2 = abs(sin(p.y * 2.7 + sin(p.x * 1.9 - t * 0.7) * 1.3 - t * 0.5));
  return pow(1.0 - min(r1, r2), 6.0);
}
`;

const WATER_NORMAL = /* glsl */ `
{
  vec2 p = vRipplePos.xz;
  float fw = length(fwidth(p));
  vec2 g = waterTrain(p, 2.3, 0.3, 0.035, 1.3, fw)
         + waterTrain(p, 1.1, 2.1, 0.03, 1.9, fw)
         + waterTrain(p, 0.55, 4.0, 0.026, 2.6, fw)
         + waterTrain(p, 0.27, 5.3, 0.02, 3.7, fw);
  vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}
`;

const WATER_COLOUR = /* glsl */ `
#ifdef WATER_POOL
{
  vec2 size = max(uPoolBox.zw - uPoolBox.xy, vec2(0.01));
  vec2 q = clamp(vRipplePos.xz - uPoolBox.xy, vec2(0.0), size);
  float edge = min(min(q.x, size.x - q.x), min(q.y, size.y - q.y));
  float deep = smoothstep(0.25, 2.2, edge);
  // Toward green-black, not resort cyan: a still pool over dark stone.
  vec3 body = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), diffuseColor.rgb, 0.55);
  vec3 shallow = body * vec3(1.7, 1.65, 1.5);
  diffuseColor.rgb = mix(shallow, body * 0.5, deep);
  float fw = length(fwidth(vRipplePos.xz));
  float c = waterCaustic(vRipplePos.xz, uTime) * (1.0 - smoothstep(0.08, 0.25, fw));
  diffuseColor.rgb += c * (1.0 - 0.75 * deep) * vec3(0.05, 0.075, 0.07);
}
#endif
`;

/**
 * The name a material was authored under. The AO bake duplicates every material
 * it puts a map on (<name>_AO on the architecture atlas, <name>_AOG on the
 * ground map — tools/blender/bake_estate_ao_v7.py), and anything that looks a
 * material up by name means the authored one.
 */
export function authoredName(name: string): string {
  return name.replace(/_AOG?$/, '');
}

/**
 * THE BAKED OCCLUSION, and how hard it is allowed to bite.
 *
 * aoMap darkens indirect light only — the hemisphere and the sky's irradiance
 * and reflections — and never the sun, which has its shadow map. So 1.0 is not
 * "black crevices"; it is "the sky does not reach in there", which is true. The
 * architecture takes it at full strength. The ground map is eased a little,
 * because the lawn is the largest surface in every frame and the bake's
 * open-lawn normalisation (99th percentile) already reads the compound's tree
 * belt as a slight loss of sky everywhere.
 */
const AO_STRENGTH = { architecture: 1.0, ground: 0.85 } as const;

function strengthenOcclusion(root: THREE.Object3D): { architecture: number; ground: number } {
  const seen = new Set<THREE.Material>();
  const count = { architecture: 0, ground: 0 };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat || seen.has(mat) || !mat.aoMap) continue;
      seen.add(mat);
      const kind = mat.name.endsWith('_AOG') ? 'ground' : 'architecture';
      mat.aoMapIntensity = AO_STRENGTH[kind];
      count[kind] += 1;
    }
  });
  return count;
}

type SkyReflector = { mat: THREE.MeshStandardMaterial; gain: number };

/**
 * CAR PAINT IS TWO SURFACES. The review: the car "without realistic paint
 * shaders". A standard material is one layer, so the car's dark paint was a
 * matte-ish plastic with a sheen. Real paint is a metallic base coat under a
 * clear lacquer: the base gives the colour its depth, the lacquer a second,
 * mirror-sharp reflection of the sky and the house riding on top of it. Swapped
 * for a MeshPhysicalMaterial with a clearcoat, on the car only (a physical
 * program is the heaviest three has; a car is a few hundred triangles).
 */
const CAR_PAINT_RE = /^MAT_Car_Paint/;

function lacquerCars(root: THREE.Object3D): THREE.MeshPhysicalMaterial[] {
  const swapped = new Map<THREE.Material, THREE.MeshPhysicalMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    if (!src || !CAR_PAINT_RE.test(src.name)) return;
    let paint = swapped.get(src);
    if (!paint) {
      paint = new THREE.MeshPhysicalMaterial({
        name: src.name,
        color: src.color.clone(),
        metalness: 0.55,
        roughness: 0.32,
        clearcoat: 1.0,
        clearcoatRoughness: 0.035,
        envMap: src.envMap,
        envMapIntensity: src.envMapIntensity,
      });
      paint.defines = { ...(src.defines ?? {}) };
      swapped.set(src, paint);
    }
    mesh.material = paint;
  });
  return [...swapped.values()];
}


function polishSurfaces(root: THREE.Object3D): SkyReflector[] {
  const done = new Set<THREE.Material>();
  const reflectors: SkyReflector[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat || done.has(mat)) continue;
      const rule = POLISH[authoredName(mat.name)];
      if (!rule) continue;
      done.add(mat);
      if (rule.colour !== undefined) mat.color.multiplyScalar(rule.colour);
      if (rule.rough !== undefined) mat.roughness *= rule.rough;
      if (rule.metal !== undefined) mat.metalness = rule.metal;
      if (rule.opacity !== undefined) mat.opacity = rule.opacity;
      if (mat.transparent) keepDepthAlpha(mat);
      if (rule.env !== undefined) reflectors.push({ mat, gain: rule.env });
      mat.needsUpdate = true;
    }
  });
  return reflectors;
}

/**
 * Keep the polished materials on the scene's sky with their own gain. Run per
 * frame because both halves can change under it: SkyBackground swaps
 * scene.environment when the sky loads (and clears it at the threshold), and
 * EnvIntensity rewrites the global. A handful of materials and two compares
 * each — nothing, next to the frame.
 */
function useSkyReflections(reflectors: { current: SkyReflector[] }) {
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    const env = scene.environment;
    const base = scene.environmentIntensity;
    for (const r of reflectors.current) {
      if (r.mat.envMap !== env) {
        r.mat.envMap = env;
        r.mat.needsUpdate = true;
      }
      const want = r.gain * base;
      if (r.mat.envMapIntensity !== want) r.mat.envMapIntensity = want;
    }
  });
}

function applyGrade(root: THREE.Object3D, grade: Grade): string[] {
  const touched: string[] = [];

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;

    // Shadow participation, opted in per object because three defaults both
    // flags to false and a shadow-casting light over a scene that casts nothing
    // just costs a depth pass for no image.
    //
    // The ground RECEIVES but does not CAST. It is 240m across, so including it
    // in the shadow camera's render would stretch the depth range over the
    // whole world and quantise the building's own shadows into steps.
    //
    // P5A widened this from one hardcoded name to the ground SURFACES, because
    // it added a second one. `drive_forecourt` is a flat gravel apron sitting
    // 12 mm above the ground plane, and it inherited castShadow=true: measured,
    // that put its 1,960 triangles into the depth pass for a surface that can
    // only ever cast onto itself, and the draw-call delta at HERO was +2 rather
    // than the +1 the object is worth. Ground-level surfaces are named here
    // rather than matched on a heuristic (height, or "is it flat"), because a
    // heuristic that silently starts excluding the entry steps would be a much
    // worse bug than the one it fixed.
    const isGround = mesh.name === 'ground_plane' || mesh.name.startsWith('drive_');
    mesh.castShadow = !isGround;
    mesh.receiveShadow = true;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      // Keyed on the GRADE, not a boolean. useGLTF caches the parse and
      // scene.clone(true) SHARES materials with it, so this same material
      // object is revisited on every mount; a sticky boolean would pin
      // whichever grade happened to mount first.
      const mat = m as THREE.MeshStandardMaterial & { __gradedFor?: Grade };
      if (!mat || mat.__gradedFor === grade) continue;

      const e = EMISSIVE[grade][mat.name];
      if (!e || !mat.emissive) continue;
      mat.emissive.set(e.color);
      mat.emissiveIntensity = e.intensity;
      mat.__gradedFor = grade;
      mat.needsUpdate = true;
      touched.push(mat.name);
    }
  });

  // SECOND PASS for the paving. Separate from the traversal above because it
  // works on MESHES, not materials: the terrace and the walls are the same
  // material, so the only handle on them is the node name the export gives.
  //
  // One shared clone across all 107 meshes, so they stay on one shader program
  // and one uniform block. Cloning per mesh would turn a batched draw into a
  // hundred.
  //
  // ONE CLONE PER SOURCE MATERIAL, not one clone for all of them.
  //
  // The original wrote a single clone across every matched mesh, which was
  // right when there was a single stone material to clone and wrong the moment
  // there was more than one. A delivery that splits the stone puts
  // MAT_Stone_Paving on the terrace, MAT_Stone_Rustic on the 96 base blocks,
  // MAT_Stone_Steps on the entry and MAT_Stone_Trim on the fountain wall, and
  // the old loop took whichever it met first and painted all of them with it —
  // rustication wearing the paving texture.
  //
  // Keying the clone by source material fixes that and keeps the grade doing
  // the job it was measured into existence for. MEASURED on the hero frame at
  // the same world points, before and after:
  //
  //                        production      v5 ungraded     v5 graded
  //     facade_west            87              94             94
  //     terrace_left           69             110             83
  //     terrace_front          56              83             64
  //
  // Ungraded, the terrace climbs ABOVE the west elevation — the same inverted
  // hierarchy the tint was written to correct, just with a different asset
  // underneath it. The baked AO in COLOR_0 darkens the terrace but not nearly
  // enough on its own: AO answers "how enclosed is this surface", and the
  // question here is "what is a horizontal plate worth against a lit wall at
  // dusk", which no amount of occlusion can answer.
  //
  // Still one clone per material rather than per mesh, so 107 meshes stay on
  // four shader programs instead of a hundred.
  // P4B: at a tint of 1.0 the clone would be an identity, so skip the pass
  // entirely and leave the meshes on the GLB's own materials.
  if (PAVING_TINT[grade] === 1.0) return touched;

  const clones = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !PAVING_RE.test(mesh.name)) return;
    const current = mesh.material as THREE.MeshStandardMaterial;
    if (!current || Array.isArray(current)) return;
    // The name pattern predates the split and catches `fount_water`, which is
    // MAT_Water — transmissive, and not a horizontal stone plate. Grading it
    // darkened the fountain. The grade is about STONE paving, so say so.
    if (!current.name.startsWith('MAT_Stone')) return;
    let graded = clones.get(current);
    if (!graded) {
      graded = current.clone();
      graded.name = `${current.name}_paving_${grade}`;
      graded.color.multiplyScalar(PAVING_TINT[grade]);
      graded.needsUpdate = true;
      clones.set(current, graded);
      touched.push(graded.name);
    }
    mesh.material = graded;
  });

  return touched;
}
/**
 * Families of static masonry that are merged on load, and why these two.
 *
 * THE CENSUS DECIDED THIS, NOT AN INSTINCT. tools/capture/geometry_census.mjs
 * reads the live scene at the settled hero and groups every visible mesh by
 * family. At 1440x900:
 *
 *     family          in frame   triangles   materials
 *     ashlar_NORTH     101/101        2222   MAT_Stone_Wall
 *     ashlar_EAST       62/62         1364   MAT_Stone_Wall
 *     ashlar_WEST       62/62         1364   MAT_Stone_Wall
 *     ashlar_SOUTH      42/42          924   MAT_Stone_Wall
 *     rustic_b/f/l/r    96/96        57984   MAT_Stone_Rustic
 *     ------------------------------------------------------------
 *                      363 of 481 visible meshes, on TWO materials
 *
 * 363 of the 481 meshes the hero draws are static masonry sharing two
 * materials, and the ashlar blocks carry TWENTY-TWO TRIANGLES EACH. Every one
 * of them is a draw call in the colour pass and a second in the shadow pass, so
 * these two families alone account for roughly 726 of the frame's 955 calls
 * while contributing 64k of its 185k triangles. That is the highest-value
 * category by an enormous margin, and it is also the safest: nothing here is
 * interactive, nothing is raycast, nothing moves, and every block already casts
 * and receives shadow identically.
 *
 * WHAT IS DELIBERATELY NOT MERGED. The fountain (transmission, and the water
 * animates), the glass, the cypresses (their own material and a wind shader),
 * the terrain (one mesh already), `ground_plane` and `drive_*` (applyGrade
 * looks them up BY NAME), and `mansion_walls` (named, and read by the capture
 * probe as the composition's subject). Merging by name family rather than by
 * material is what keeps those out: a material-only rule would have swallowed
 * the trim and the named meshes with it.
 *
 * The cost of merging is per-block frustum culling, and the census answers that
 * too — 363 of 363 are in frame at the hero, so there was nothing to cull.
 */
//
// quoin_ is Phase 3's 48 corner blocks, laid into the strip the ashlar layout
// reserved at every corner: the same stone, the same material, the same static
// role. Left out, they are 48 more meshes and roughly 96 more calls at the hero.
const MERGE_FAMILIES = /^(ashlar|rustic|quoin)_/;

/**
 * Merge the static masonry into one mesh per material.
 *
 * Geometries are CLONED before they are transformed. `scene.clone(true)` shares
 * geometry by reference with drei's cached parse, so baking a world matrix into
 * the original would corrupt every later mount of the model — and for the same
 * reason the originals are removed from the graph but never disposed.
 */
function mergeStaticFamilies(root: THREE.Object3D): {
  merged: number;
  removed: number;
  owned: THREE.BufferGeometry[];
} {
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert();

  const groups = new Map<
    string,
    { material: THREE.Material; source: THREE.Mesh; parts: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }
  >();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!MERGE_FAMILIES.test(mesh.name || '')) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!material) return;

    const geometry = mesh.geometry as THREE.BufferGeometry;
    // mergeGeometries returns null unless every input has the SAME attributes,
    // so the signature is part of the key rather than a hope.
    //
    // AND THE SAME ENCODING, not just the same names. mergeAttributes refuses
    // inconsistent array types, and a null result skips the WHOLE group. The
    // 267 ashlar blocks in p5m carry COLOR_0 as UNSIGNED_SHORT normalised VEC4
    // (they arrived through P4A's transplant) while export_web.py writes FLOAT
    // VEC3 — so the first quoin grafted from a normal export would have put
    // every ashlar block back on its own draw call, with nothing but a
    // console.error to say so. Verified against this repo's three before the
    // key changed: Uint16/4/normalised + Float32/3 returns null. Keyed on type,
    // item size and normalisation, mismatched encodings become two batches
    // instead of none.
    const signature = Object.keys(geometry.attributes)
      .sort()
      .map((k) => {
        const a = geometry.attributes[k] as THREE.BufferAttribute;
        return `${k}:${a.array.constructor.name}/${a.itemSize}/${a.normalized ? 'n' : 'r'}`;
      })
      .join(',');
    const key = `${material.uuid}|${signature}|${geometry.index ? 'i' : 'n'}`;

    const clone = geometry.clone();
    clone.applyMatrix4(inverseRoot.clone().multiply(mesh.matrixWorld));

    const group = groups.get(key);
    if (group) {
      group.parts.push(clone);
      group.meshes.push(mesh);
    } else {
      groups.set(key, { material, source: mesh, parts: [clone], meshes: [mesh] });
    }
  });

  const owned: THREE.BufferGeometry[] = [];
  let merged = 0;
  let removed = 0;

  for (const [key, group] of groups) {
    // A family of one is already one draw call; merging it would only cost a
    // copy of its vertices.
    if (group.parts.length < 2) {
      for (const g of group.parts) g.dispose();
      continue;
    }
    const combined = mergeGeometries(group.parts, false);
    for (const g of group.parts) g.dispose();
    if (!combined) continue;

    const mesh = new THREE.Mesh(combined, group.material);
    mesh.name = `merged_${(group.material.name || 'material').replace(/\W+/g, '')}_${merged}`;
    mesh.castShadow = group.source.castShadow;
    mesh.receiveShadow = group.source.receiveShadow;
    mesh.renderOrder = group.source.renderOrder;
    mesh.frustumCulled = true;
    root.add(mesh);
    owned.push(combined);
    merged += 1;

    for (const m of group.meshes) {
      m.removeFromParent();
      removed += 1;
    }
    void key;
  }

  return { merged, removed, owned };
}

export function ExteriorModel({
  onReady,
  onRoot,
  grade = 'daylight',
}: {
  onReady?: (info: { meshes: number; tris: number }) => void;
  /** The mounted scene graph, handed up for the front doors to adopt — the same
   *  contract HallModel offers the hologram stations. Null on unmount. */
  onRoot?: (root: THREE.Object3D | null) => void;
  grade?: Grade;
}) {
  const gl = useThree((s) => s.gl);

  // Same drei trap as the interior: the second argument is `useDraco` and
  // leaving it undefined makes drei attach its own decoder from gstatic AFTER
  // the extendLoader callback runs, which our CSP blocks. This GLB lists
  // KHR_draco_mesh_compression in extensionsRequired, so that silently prevents
  // it from parsing at all. The path must be passed explicitly.
  const url = useMemo(() => resolveExteriorModelUrl(), []);
  const { scene } = useGLTF(url, '/draco/', undefined, (loader) => {
    attachLoaders(loader as unknown as GLTFLoader, gl);
  });

  const root = useMemo(() => scene.clone(true), [scene]);

  // The water's clock. One object, handed to every water material's shader, so
  // the per-frame cost of moving every sheet of water on the estate is a single
  // assignment. A ref rather than state: it is written sixty times a second and
  // must never re-render anything.
  const waterClock = useRef({ value: 0 });
  // The key light, found once: the foliage follows its direction and colour
  // (exteriorFoliage.ts) as the film's evening turns it.
  const world = useThree((s) => s.scene);
  const sun = useRef<THREE.DirectionalLight | null>(null);
  const sunSearch = useRef(0);
  useFrame((_, delta) => {
    waterClock.current.value += delta;
    // Looked for at most twice a second: a scene with no shadow-casting sun
    // (the dusk rollback) must not be traversed every frame.
    if ((!sun.current || !sun.current.parent) && (sunSearch.current -= delta) <= 0) {
      sunSearch.current = 0.5;
      sun.current = null;
      world.traverse((o) => {
        const l = o as THREE.DirectionalLight;
        if (!sun.current && l.isDirectionalLight && l.castShadow) sun.current = l;
      });
    }
    followSun(sun.current, delta);
  });
  const reflectors = useRef<SkyReflector[]>([]);
  useSkyReflections(reflectors);

  useEffect(() => {
    // BEFORE the grade, and before anything reads the frame: an anisotropic
    // material with no tangents writes NaN, and one NaN fragment takes the
    // whole bloom chain — and therefore the whole screen — to black.
    const disarmed = guardAnisotropy(root);
    const graded = applyGrade(root, grade);
    // Before the polish, so the lacquer is the material the polish reaches.
    const lacquered = lacquerCars(root);
    // AFTER the grade (which clones the paving materials) and BEFORE the merge
    // (which is by material identity): a pass that changed a material after the
    // merge keyed on it would be graded into one batch and not the other.
    reflectors.current = polishSurfaces(root);
    const polished = reflectors.current.length;
    const occluded = strengthenOcclusion(root);
    // Every estate material writes its depth for the exterior lens.
    markFocusDepth(root);
    const rippled = animateWater(root, waterClock.current);
    // The lawn's bands and macro field, and anisotropic filtering on every
    // estate texture (exteriorLawn.ts): the ground seen at a grazing angle is
    // most of every exterior frame.
    const lawns = dressLawn(root);
    const foliage = dressFoliage(root);
    const rooms = dressWindows(root);
    const aged = dressSurfaces(root);
    const sharpened = sharpenTextures(root, Math.min(8, gl.capabilities.getMaxAnisotropy()));

    // AFTER the grade, and that ordering is load-bearing: applyGrade swaps the
    // paving materials per grade and looks its targets up BY NAME, so merging
    // first would hide the meshes it is meant to find. See the note on
    // MERGE_FAMILIES for what is merged and what is deliberately left alone.
    const batched = mergeStaticFamilies(root);

    let meshes = 0;
    let tris = 0;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes += 1;
      // The glass and the water are doubleSided with transmission. Left alone
      // deliberately — the fountain reads as a bowl of nothing without it.
      const g = m.geometry as THREE.BufferGeometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());

    // Runtime census. Everything a swap can silently break is counted HERE, in
    // the browser, against the object graph three actually built — not against
    // the Blender scene and not against the glTF JSON. A masonry block that
    // failed to decode, a material the grade replaced, a COLOR_0 three declined
    // to bind: all of them are invisible upstream and all of them show up here.
    const census = {
      ashlar: 0, rustic: 0, vertexColored: 0, withMaps: 0, textures: new Set<string>(),
    };
    const mats = new Map<string, number>();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.name.startsWith('ashlar_')) census.ashlar += 1;
      if (m.name.startsWith('rustic_')) census.rustic += 1;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat || Array.isArray(mat)) return;
      mats.set(mat.name, (mats.get(mat.name) ?? 0) + 1);
      if (mat.vertexColors) census.vertexColored += 1;
      if (mat.map) { census.withMaps += 1; census.textures.add(mat.map.name || mat.name); }
    });
    const wall = [...mats.keys()].includes('MAT_Stone_Wall')
      ? (root.getObjectByName('mansion_walls') as THREE.Mesh | undefined)
      : undefined;
    const wallMatInfo = wall && !Array.isArray(wall.material)
      ? (() => {
          const w = wall.material as THREE.MeshStandardMaterial;
          const g = wall.geometry as THREE.BufferGeometry;
          return {
            color: '#' + w.color.getHexString(),
            roughness: w.roughness, metalness: w.metalness,
            normalScale: w.normalMap ? w.normalScale.x : null,
            vertexColors: w.vertexColors,
            hasColorAttr: !!g.attributes.color,
            colorItemSize: g.attributes.color ? g.attributes.color.itemSize : null,
          };
        })()
      : null;

    // eslint-disable-next-line no-console
    console.info(
      '[exterior_ready] url=%s meshes=%d tris=%d graded=[%s] polished=%d water=%d ao=%d/%d anisotropyDisarmed=[%s] | size %sx%sx%s | y %s..%s',
      url, meshes, Math.round(tris), graded.join(','), polished, rippled,
      occluded.architecture, occluded.ground, disarmed.join(','),
      size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2),
      box.min.y.toFixed(2), box.max.y.toFixed(2),
    );
    // eslint-disable-next-line no-console
    console.info('[exterior_census]', JSON.stringify({
      url,
      ashlar: census.ashlar, rustic: census.rustic,
      vertexColoredMeshes: census.vertexColored,
      meshesWithBaseMap: census.withMaps,
      materials: Object.fromEntries([...mats.entries()].sort()),
      wall: wallMatInfo,
      bbox: { min: box.min.toArray().map((v) => +v.toFixed(3)),
              max: box.max.toArray().map((v) => +v.toFixed(3)) },
    }));

    onReady?.({ meshes, tris: Math.round(tris) });

    // eslint-disable-next-line no-console
    console.info(
      '[exterior_batched] merged=%d meshesRemoved=%d lawn=%d foliage=%d sharpened=%d rooms=%d aged=%s lacquered=%d',
      batched.merged, batched.removed, lawns, foliage, sharpened, rooms, JSON.stringify(aged), lacquered.length,
    );

    // The merged geometries are the only ones this component OWNS — every other
    // geometry in the tree belongs to drei's cached parse and is shared with
    // every future mount, which is also why the originals are removed from the
    // graph and never disposed.
    return () => {
      for (const g of batched.owned) g.dispose();
      // The lacquer is made here, per mount; the scan's own paint stays with
      // drei's cached parse.
      for (const m of lacquered) m.dispose();
      reflectors.current = [];
    };
  }, [root, onReady, grade, gl]);

  // Its own effect, declared after the grade and the merge so a consumer never
  // receives a graph those passes have not finished with. The doors are not in
  // a merged family, so nothing here moves them.
  useEffect(() => {
    onRoot?.(root);
    return () => onRoot?.(null);
  }, [root, onRoot]);

  return <primitive object={root} />;
}
