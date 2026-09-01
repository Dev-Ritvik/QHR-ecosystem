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

import { useEffect, useMemo } from 'react';
import type { Grade } from './WorldCanvas';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachLoaders } from './HallModel';
import { guardAnisotropy } from './materialGuards';

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
 */
export const EXTERIOR_MODEL_URL = '/models/exterior_mansion_v5.glb';
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
  v5: EXTERIOR_MODEL_URL,
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
  spireTop: 11.72,
  // The delivered terrain spans +/-120m and undulates from y -2.97 to +0.97.
  // It was a flat 450m plane; the camera far plane and the fog are tuned
  // against this number, so it is measured rather than assumed.
  groundHalfSpan: 120,
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
const PAVING_TINT: Record<Grade, number> = { dusk: 0.48, daylight: 0.32 };

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
    const isGround = mesh.name === 'ground_plane';
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
export function ExteriorModel({
  onReady,
  grade = 'daylight',
}: {
  onReady?: (info: { meshes: number; tris: number }) => void;
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

  useEffect(() => {
    // BEFORE the grade, and before anything reads the frame: an anisotropic
    // material with no tangents writes NaN, and one NaN fragment takes the
    // whole bloom chain — and therefore the whole screen — to black.
    const disarmed = guardAnisotropy(root);
    const graded = applyGrade(root, grade);
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
      '[exterior_ready] url=%s meshes=%d tris=%d graded=[%s] anisotropyDisarmed=[%s] | size %sx%sx%s | y %s..%s',
      url, meshes, Math.round(tris), graded.join(','), disarmed.join(','),
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
  }, [root, onReady, grade]);

  return <primitive object={root} />;
}
