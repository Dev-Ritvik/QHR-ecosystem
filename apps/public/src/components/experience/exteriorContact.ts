// apps/public/src/components/experience/exteriorContact.ts
//
// WHAT STANDS ON THE TERRACE TOUCHES IT.
//
// The audit of 2026-10-05 (P2): "Ground objects. Planters and urns on the
// porch look set down rather than sitting in place. Done when every object
// visibly touches the surface beneath it."
//
// The house's own stone carries a baked occlusion (ExteriorModel,
// strengthenOcclusion), and the lens draws a contact shadow in screen space
// for anything steep and near (LensFocus, contactAO). The terrace's planters
// fall between the two: they were set out after the bake, on flags whose map
// knows nothing of them, and at the door's distance the foot of a box 84 cm
// square is a line a pixel deep — under what the lens's disc can find. So at
// dusk, with no sun to give them a cast shadow, eight white boxes stood on a
// lit pavement with nothing under them.
//
// A box on stone under an evening sky leaves a soft dark margin round its
// foot, deepest at the joint. That is drawn here, on the surface, for the few
// things the frame shows at rest and the bake does not hold: the terrace's
// eight planters, the two blocks the steps' urns stand on, and the parterre's
// urn. Footprints as measured on the model (centre, half-size, the height of
// what it stands on); nothing is searched for at runtime.

import * as THREE from 'three';

interface Footprint {
  /** Centre on the plan (x, z) and the height of the surface it stands on. */
  at: readonly [number, number];
  y: number;
  /** Half its size on the plan. */
  half: readonly [number, number];
}

const PLANTER_HALF = [0.42, 0.42] as const;
/** The terrace's flags (terrace_upper) and the forecourt's gravel. */
const TERRACE_Y = 0.45;
const GROUND_Y = 0.01;

export const FOOTPRINTS: readonly Footprint[] = [
  // garden_planters: four to the front of the house, four to the garden
  ...([-10.15, -7.45, 7.45, 10.15] as const).flatMap((x) =>
    ([-9.35, 9.35] as const).map((z) => ({ at: [x, z] as const, y: TERRACE_Y, half: PLANTER_HALF })),
  ),
  // the blocks at the foot of the portico's steps (portico_trim), on the gravel
  { at: [-4.92, 12.3], y: GROUND_Y, half: [0.3, 0.9] },
  { at: [4.92, 12.3], y: GROUND_Y, half: [0.3, 0.9] },
  // the parterre's urn, on its gravel
  { at: [-26.5, 25], y: 0.02, half: [0.62, 0.62] },
];

/** How far the margin reaches from the foot, metres, and how dark it is at
 *  the joint. */
export const CONTACT_SHADOW = { reach: 0.34, dark: 0.74 } as const;

const NAME = 'estate_contacts';

/**
 * Lay the contact shadows under `root` (the estate's own space). Once: a root
 * that already has them is left alone. Returns the mesh, or null if it was
 * already there.
 */
export function groundObjects(root: THREE.Object3D): THREE.Mesh | null {
  if (root.getObjectByName(NAME)) return null;
  const R = CONTACT_SHADOW.reach;
  const position: number[] = [];
  const local: number[] = [];
  const half: number[] = [];
  const index: number[] = [];
  for (const f of FOOTPRINTS) {
    const base = position.length / 3;
    const ex = f.half[0] + R;
    const ez = f.half[1] + R;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      position.push(f.at[0] + sx * ex, f.y + 0.006, f.at[1] + sz * ez);
      local.push(sx * ex, sz * ez);
      half.push(f.half[0], f.half[1]);
    }
    // facing up: counter-clockwise seen from above
    index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('contactLocal', new THREE.Float32BufferAttribute(local, 2));
  g.setAttribute('contactHalf', new THREE.Float32BufferAttribute(half, 2));
  g.setIndex(index);

  const material = new THREE.MeshBasicMaterial({
    name: 'MAT_Contact_Shadow',
    color: '#000000',
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        'attribute vec2 contactLocal;\nattribute vec2 contactHalf;\nvarying vec2 vContactLocal;\nvarying vec2 vContactHalf;\nvoid main() {',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvContactLocal = contactLocal;\nvContactHalf = contactHalf;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying vec2 vContactLocal;\nvarying vec2 vContactHalf;\nvoid main() {')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
	{
		// distance from the foot's outline, 0 under it
		float d = length( max( abs( vContactLocal ) - vContactHalf, 0.0 ) );
		float k = 1.0 - smoothstep( 0.0, ${R.toFixed(3)}, d );
		diffuseColor.a *= ${CONTACT_SHADOW.dark.toFixed(3)} * k * k;
	}`,
      );
  };
  material.customProgramCacheKey = () => 'estate-contact-shadow';

  const mesh = new THREE.Mesh(g, material);
  mesh.name = NAME;
  mesh.renderOrder = 1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  root.add(mesh);
  return mesh;
}
