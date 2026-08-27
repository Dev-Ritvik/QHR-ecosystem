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
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachLoaders } from './HallModel';
import { guardAnisotropy } from './materialGuards';

export const EXTERIOR_MODEL_URL = '/models/exterior_mansion.glb';

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
const PAVING_TINT = 0.48;

const EMISSIVE: Record<string, { color: string; intensity: number }> = {
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

function applyGrade(root: THREE.Object3D): string[] {
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
      const mat = m as THREE.MeshStandardMaterial & { __graded?: boolean };
      if (!mat || mat.__graded) continue;

      const e = EMISSIVE[mat.name];
      if (!e || !mat.emissive) continue;
      mat.emissive.set(e.color);
      mat.emissiveIntensity = e.intensity;
      mat.__graded = true;
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
  let paving: THREE.MeshStandardMaterial | null = null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !PAVING_RE.test(mesh.name)) return;
    const current = mesh.material as THREE.MeshStandardMaterial;
    if (!current || Array.isArray(current)) return;
    if (!paving) {
      paving = current.clone();
      paving.name = 'MAT_Stone_Cream_paving';
      paving.color.multiplyScalar(PAVING_TINT);
      paving.needsUpdate = true;
      touched.push('paving');
    }
    mesh.material = paving;
  });

  return touched;
}
export function ExteriorModel({
  onReady,
}: {
  onReady?: (info: { meshes: number; tris: number }) => void;
}) {
  const gl = useThree((s) => s.gl);

  // Same drei trap as the interior: the second argument is `useDraco` and
  // leaving it undefined makes drei attach its own decoder from gstatic AFTER
  // the extendLoader callback runs, which our CSP blocks. This GLB lists
  // KHR_draco_mesh_compression in extensionsRequired, so that silently prevents
  // it from parsing at all. The path must be passed explicitly.
  const { scene } = useGLTF(EXTERIOR_MODEL_URL, '/draco/', undefined, (loader) => {
    attachLoaders(loader as unknown as GLTFLoader, gl);
  });

  const root = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    // BEFORE the grade, and before anything reads the frame: an anisotropic
    // material with no tangents writes NaN, and one NaN fragment takes the
    // whole bloom chain — and therefore the whole screen — to black.
    const disarmed = guardAnisotropy(root);
    const graded = applyGrade(root);
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
    // eslint-disable-next-line no-console
    console.info(
      '[exterior_ready] meshes=%d tris=%d graded=[%s] anisotropyDisarmed=[%s] | size %sx%sx%s | y %s..%s',
      meshes,
      Math.round(tris),
      graded.join(','),
      disarmed.join(','),
      size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2),
      box.min.y.toFixed(2), box.max.y.toFixed(2),
    );

    onReady?.({ meshes, tris: Math.round(tris) });
  }, [root, onReady]);

  return <primitive object={root} />;
}
