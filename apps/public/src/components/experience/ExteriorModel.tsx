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
//   EXTERIOR   no lightmap at all. Plain PBR with JPEG maps, transmission on
//              the glass and the fountain water, an emissive factor on the
//              interior window panes. It needs a real key light and renders at
//              roughly unit exposure.
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

export const EXTERIOR_MODEL_URL = '/models/exterior_mansion.glb';

/**
 * The ground plane is 450m square, which is far larger than the building and
 * exists to give the approach somewhere to stand. Its far edge has to be fogged
 * out or the scene reads as a diorama on a table.
 *
 * Measured from the GLB: mansion x -9.55..9.55, three z -5.55..6.10, roof 6.80,
 * spire tip 11.72. Fountain centre at three z 13.2, entry step at 6.15.
 */
export const EXTERIOR_BOUNDS = {
  spireTop: 11.72,
  groundHalfSpan: 225,
} as const;

/**
 * Colour that the glTF export lost, restored on load.
 *
 * Two materials in this GLB carry baseColorFactor [1,1,1,1] and NO base colour
 * texture, because their colour lived in Blender shader nodes the exporter
 * cannot write. They therefore arrive as pure white:
 *
 *   MAT_Ground   a 450m plane. This is the bright plate the building was
 *                sitting on — read in review as "a primitive grey plane", and
 *                correctly so. It was white.
 *   MAT_Hedge    the cypresses and the box hedging. White cones flanking the
 *                portico, which is why the trees read as traffic cones.
 *
 * Overriding here rather than re-exporting because the values are a grade, not
 * geometry: they are the difference between a night lawn and a lit one, and
 * that is a decision to make against the rendered frame rather than in Blender.
 * If the exterior is ever re-baked with real ground and foliage maps, delete
 * this — a texture on those slots must win.
 *
 * Keyed by material name and applied to the shared material instances, so it
 * runs once per parse rather than per mount.
 */
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

const GRADE: Record<string, { color: string; roughness?: number }> = {
  // Deep and desaturated, a shade off the #0A1120 sky so the ground reads as
  // ground and not as a hole. Anything lighter puts a bright horizon band
  // behind the building at exactly the height the hero copy sits.
  MAT_Ground: { color: '#0F1520', roughness: 1 },
  // Cypress and box at dusk: green, but most of the way to black. These are
  // silhouette, not subject.
  MAT_Hedge: { color: '#16281B', roughness: 0.95 },
};

/**
 * A tiling high-frequency roughness map, generated rather than shipped.
 *
 * The stone materials carry a base colour texture but a CONSTANT roughness, so
 * every point on the facade scatters light identically and the specular
 * response smears evenly across the elevation — the plastic look. Real
 * limestone varies at the millimetre scale, and that variation is what breaks
 * a highlight into something that reads as mineral.
 *
 * 256x256 of value noise at three octaves, wrapped, ~65KB in memory and zero
 * bytes over the wire. Built once and shared by every material that takes it.
 */
let ROUGHNESS_TEX: THREE.DataTexture | null = null;

function microRoughness(): THREE.DataTexture {
  if (ROUGHNESS_TEX) return ROUGHNESS_TEX;

  const N = 256;
  const data = new Uint8Array(N * N);

  // Integer hash rather than sin() — the sin trick loses precision at these
  // coordinates and bands visibly in an 8-bit target.
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number, period: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth(x - ix), fy = smooth(y - iy);
    // Wrap the lattice so the texture tiles without a seam.
    const w = (v: number) => ((v % period) + period) % period;
    const a = hash(w(ix), w(iy)), b = hash(w(ix + 1), w(iy));
    const c = hash(w(ix), w(iy + 1)), d = hash(w(ix + 1), w(iy + 1));
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  };

  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const u = x / N, v = y / N;
      const n =
        noise(u * 16, v * 16, 16) * 0.5 +
        noise(u * 48, v * 48, 48) * 0.32 +
        noise(u * 128, v * 128, 128) * 0.18;
      // Centred near the material's own roughness so the map modulates it
      // rather than replacing it: 0.62..1.0, never mirror-smooth.
      data[y * N + x] = Math.round((0.62 + n * 0.38) * 255);
    }
  }

  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Tight repeat: the point is grain at the scale of the stone, not a pattern.
  tex.repeat.set(14, 14);
  tex.needsUpdate = true;
  ROUGHNESS_TEX = tex;
  return tex;
}

/** Materials that are stone or metal and should scatter light unevenly. */
const MICRO_SURFACE = new Set(['MAT_Stone_Cream', 'MAT_Roof', 'MAT_Gold', 'MAT_Wood_Dark']);

function applyGrade(root: THREE.Object3D): string[] {
  const touched: string[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;

    // Shadow participation, opted in per object because three defaults both
    // flags to false and a shadow-casting light over a scene that casts nothing
    // just costs a depth pass for no image.
    //
    // The ground RECEIVES but does not CAST: it is a 450m plane, so including
    // it in the shadow camera's render would stretch the depth range across the
    // whole world and quantise the building's own shadows into steps.
    const isGround = mesh.name.startsWith('ground_plane');
    mesh.castShadow = !isGround;
    mesh.receiveShadow = true;

    // The flat exported plane is superseded by <Terrain />, which displaces
    // karst relief on the GPU. Hidden rather than deleted so the GLB stays the
    // single source of truth and turning the terrain off restores the old
    // ground by changing one prop.
    if (isGround) mesh.visible = false;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial & { __graded?: boolean };
      if (!mat || mat.__graded) continue;

      // Emissive first, and on its own flag — a material can be emissive
      // without being colour-graded, and MAT_Gold is exactly that case: it has
      // a real texture, so the GRADE pass below skips it.
      const e = EMISSIVE[mat.name];
      if (e && mat.emissive) {
        mat.emissive.set(e.color);
        mat.emissiveIntensity = e.intensity;
        mat.needsUpdate = true;
        if (!touched.includes(mat.name + ':emit')) touched.push(mat.name + ':emit');
      }

      // Micro-surface roughness on the stone and metal. Only applied where the
      // material has no roughnessMap of its own — a real baked map always wins.
      if (MICRO_SURFACE.has(mat.name) && !mat.roughnessMap) {
        mat.roughnessMap = microRoughness();
        // A roughnessMap multiplies roughnessFactor, so a factor of 1.0 would
        // read the map straight and a factor of 0 would cancel it entirely.
        // Lift anything very low so the map has something to modulate.
        if (mat.roughness < 0.35) mat.roughness = 0.55;
        mat.needsUpdate = true;
      }

      const g = GRADE[mat.name];
      if (!g) continue;
      // Never override a real texture — a map means the export succeeded and
      // this workaround should stay out of the way.
      if (mat.map) continue;

      mat.color.set(g.color);
      if (g.roughness !== undefined) mat.roughness = g.roughness;
      mat.__graded = true;
      mat.needsUpdate = true;
      touched.push(mat.name);
    }
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
      '[exterior_ready] meshes=%d tris=%d graded=[%s] | size %sx%sx%s | y %s..%s',
      meshes,
      Math.round(tris),
      graded.join(','),
      size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2),
      box.min.y.toFixed(2), box.max.y.toFixed(2),
    );

    onReady?.({ meshes, tris: Math.round(tris) });
  }, [root, onReady]);

  return <primitive object={root} />;
}
