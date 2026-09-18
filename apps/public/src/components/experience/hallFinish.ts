// apps/public/src/components/experience/hallFinish.ts
//
// The hall's finishes: what each surface is made of, stated once.
//
// THE BRIEF. The client review called the interior "cheap" and "worn out" and
// asked for "old money, modern and elegant". The approved Cycles renders of this
// same room (C:/dev/Blender/out/FINAL, cycles/) already are that: ivory plaster,
// white painted mouldings and balusters, polished walnut rails and panelling,
// white marble underfoot, gilt that reads as gilt. The web build had drifted a
// long way from them, and not because of the lighting. Three texture sets were
// doing it:
//
//   MAT_Trim_Cream(_LM)   a 1024 px GRANITE — every pilaster, stair side,
//                         baluster and capital speckled like terrazzo
//   MAT_Wall_Plaster_LM   a mottled grey plaster that reads as damp
//   MAT_Wood_Dark         a near-black grain, so the panelling rendered as
//                         black slabs (the "TV screens" on the side walls)
//
// Those maps are cleared and the surfaces given their intended colour instead.
// Painted plaster and lacquered joinery are smooth at the scale anyone sees
// them; a texture was never what made them look expensive.
//
// COLOURS ARE TWO KINDS. A hex string is an sRGB paint colour for a surface
// whose texture is cleared. An RGB triple is LINEAR and multiplies a texture
// that is KEPT — the marble keeps its veining, and its multiplier may exceed 1
// to lift a dark atlas to white stone.
//
// Materials are matched by name and changed in place. drei caches the parse and
// HallModel's clone shares materials, so this runs once per material however
// many times the hall mounts; every assignment is absolute, so running twice
// would change nothing anyway.

import * as THREE from 'three';

export type TextureSlot = 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap';

export interface Finish {
  /** sRGB hex for a cleared surface, or linear RGB multiplying a kept map. */
  color?: string | readonly [number, number, number];
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  clear?: readonly TextureSlot[];
}

const ALL: readonly TextureSlot[] = ['map', 'normalMap', 'roughnessMap', 'metalnessMap'];

/**
 * Tuned on the production build against the approved renders, frame by frame
 * at the threshold, establishing, first-station, stair-foot and portrait beats.
 *
 * The lightmapped (_LM) variants of a finish are a step darker than their
 * unbaked twins on purpose: they receive the bake AND the ambient, and at the
 * same colour the stair stringer blew to paper white.
 */
export const HALL_FINISHES: Readonly<Record<string, Finish>> = {
  MAT_Wall_Plaster_LM: { clear: ALL, color: '#efe7da', roughness: 0.92 },
  MAT_Ceiling_Plaster_LM: { color: '#f6f1e8' },
  MAT_Trim_Cream_LM: { clear: ALL, color: '#e6ddcc', roughness: 0.5 },
  MAT_Trim_Cream: { clear: ALL, color: '#f3ecdf', roughness: 0.45 },
  // Panelling and newels. No bake reaches them, so their light is the
  // environment; 9 against the hall's environmentIntensity is what lets a
  // polished walnut read as wood rather than as a hole in the wall.
  MAT_Wood_Dark: { clear: ALL, color: '#7b4d2b', roughness: 0.28, metalness: 0, envMapIntensity: 9 },
  // Handrails and the inner doors, which the bake does reach.
  MAT_Wood_Dark_LM: { clear: ALL, color: '#80552f', roughness: 0.3, metalness: 0, envMapIntensity: 3 },
  // Polished marble. The veining map stays; its roughness map goes, because a
  // hall floor is honed flat and the map was scattering every reflection.
  MAT_MarbleFloor_LM: { clear: ['roughnessMap'], color: [1.4, 1.36, 1.3], roughness: 0.12, envMapIntensity: 2.6 },
  MAT_MarbleFloor: { clear: ['roughnessMap'], color: [1.9, 1.85, 1.78], roughness: 0.16 },
  // Gilt. Metalness 0.6, not 1: a pure metal is only ever as bright as what it
  // reflects, and the small side-facing pieces (sconce plates, picture-light
  // arms) reflect the darker half of the room and went black. A little diffuse
  // keeps them gold from every side.
  MAT_Gold: { clear: ALL, color: '#e2bd72', roughness: 0.4, metalness: 0.6, envMapIntensity: 9 },
  MAT_Table_Brass: { color: '#e9c77e', roughness: 0.3, metalness: 0.9 },
};

type Finishable = THREE.MeshStandardMaterial & { __hallFinish?: boolean };

export function applyFinish(mat: Finishable, finish: Finish): void {
  for (const slot of finish.clear ?? []) mat[slot] = null;
  if (typeof finish.color === 'string') mat.color.set(finish.color);
  else if (finish.color) mat.color.setRGB(finish.color[0], finish.color[1], finish.color[2], THREE.LinearSRGBColorSpace);
  if (finish.roughness !== undefined) mat.roughness = finish.roughness;
  if (finish.metalness !== undefined) mat.metalness = finish.metalness;
  if (finish.envMapIntensity !== undefined) mat.envMapIntensity = finish.envMapIntensity;
  mat.needsUpdate = true;
}

/** Apply HALL_FINISHES to every matching material under root. Returns the
 *  names finished, for the hall_ready log. */
export function finishHall(root: THREE.Object3D): string[] {
  const done: string[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as Finishable;
      if (!mat || mat.__hallFinish || !mat.isMeshStandardMaterial) continue;
      const finish = HALL_FINISHES[mat.name];
      if (!finish) continue;
      applyFinish(mat, finish);
      mat.__hallFinish = true;
      done.push(mat.name);
    }
  });
  return done;
}
