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
//
// AND UNDER THE CARS (the creative director's audit, 2026-10-27: "the black car
// appears to float slightly on the driveway"). A car stands on four hand-wide
// patches of rubber with its body a span off the ground: the sun's shadow falls
// to one side of it, and the ground under it, which sees almost no sky, goes
// dark right to the tyres. The lens's contact shadow finds a sill but not the
// ground in under it, and the bake was laid before the cars were. So each car
// is given a shade of its own, the size of its body and turned with it, found
// by name on the model as it stands (CAR_RE): a car can be moved in the build
// without anything here being measured again.

import * as THREE from 'three';

interface Footprint {
  /** Centre on the plan (x, z) and the height of the surface it stands on. */
  at: readonly [number, number];
  y: number;
  /** Half its size on the plan. */
  half: readonly [number, number];
  /** Turned about the vertical, radians (three's rotation.y). */
  yaw?: number;
  /** Its own reach and darkness, where they are not CONTACT_SHADOW's. */
  reach?: number;
  dark?: number;
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

/** The forecourt's cars (build_estate_v7.py: tripo_object, "court_car_..."). */
const CAR_RE = /^court_car_/;
/**
 * A car's shade: drawn in from its body's outline by `inset` (the body
 * overhangs its wheels), reaching `reach` past that, and `dark` under it.
 */
export const CAR_SHADOW = { inset: 0.86, reach: 0.75, dark: 0.82 } as const;

const NAME = 'estate_contacts';

/**
 * Each car on the model, as a footprint in `root`'s space: its body's own
 * box (in the car's frame, so turned with it), standing on the lowest point
 * of its wheels.
 */
export function carFootprints(root: THREE.Object3D): Footprint[] {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const found: Footprint[] = [];
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const centre = new THREE.Vector3();
  root.traverse((o) => {
    if (!CAR_RE.test(o.name) || (o.parent && CAR_RE.test(o.parent.name))) return;
    // The body's box in the car's own frame.
    const toCar = o.matrixWorld.clone().invert();
    box.makeEmpty();
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      mesh.geometry.computeBoundingBox();
      part.copy(mesh.geometry.boundingBox!).applyMatrix4(m.multiplyMatrices(toCar, mesh.matrixWorld));
      box.union(part);
    });
    if (box.isEmpty()) return;
    const frame = m.multiplyMatrices(toRoot, o.matrixWorld);
    frame.decompose(pos, quat, scale);
    box.getCenter(centre).applyMatrix4(frame);
    const yaw = new THREE.Euler().setFromQuaternion(quat, 'YXZ').y;
    found.push({
      at: [centre.x, centre.z],
      // (its lowest point in the estate's space: the wheels on the drive)
      y: new THREE.Box3().copy(box).applyMatrix4(frame).min.y,
      half: [
        ((box.max.x - box.min.x) / 2) * Math.abs(scale.x) * CAR_SHADOW.inset,
        ((box.max.z - box.min.z) / 2) * Math.abs(scale.z) * CAR_SHADOW.inset,
      ],
      yaw,
      reach: CAR_SHADOW.reach,
      dark: CAR_SHADOW.dark,
    });
  });
  return found;
}

/**
 * Lay the contact shadows under `root` (the estate's own space). Once: a root
 * that already has them is left alone. Returns the mesh, or null if it was
 * already there.
 */
export function groundObjects(root: THREE.Object3D): THREE.Mesh | null {
  if (root.getObjectByName(NAME)) return null;
  const position: number[] = [];
  const local: number[] = [];
  const half: number[] = [];
  const shade: number[] = [];
  const index: number[] = [];
  for (const f of [...FOOTPRINTS, ...carFootprints(root)]) {
    const base = position.length / 3;
    const R = f.reach ?? CONTACT_SHADOW.reach;
    const ex = f.half[0] + R;
    const ez = f.half[1] + R;
    const c = Math.cos(f.yaw ?? 0);
    const s = Math.sin(f.yaw ?? 0);
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const lx = sx * ex;
      const lz = sz * ez;
      // (turned as three turns a thing about y)
      position.push(f.at[0] + c * lx + s * lz, f.y + 0.006, f.at[1] - s * lx + c * lz);
      local.push(lx, lz);
      half.push(f.half[0], f.half[1]);
      shade.push(R, f.dark ?? CONTACT_SHADOW.dark);
    }
    // facing up: counter-clockwise seen from above
    index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('contactLocal', new THREE.Float32BufferAttribute(local, 2));
  g.setAttribute('contactHalf', new THREE.Float32BufferAttribute(half, 2));
  g.setAttribute('contactShade', new THREE.Float32BufferAttribute(shade, 2));
  g.setIndex(index);

  const material = new THREE.MeshBasicMaterial({
    name: 'MAT_Contact_Shadow',
    color: '#000000',
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    // The colour darkened as by any shade, and the frame's alpha LEFT ALONE:
    // it holds the scene's depth for the lens (LensFocus.installFocusDepth),
    // and a normal blend wrote the shade's own alpha into it, so the lens read
    // the ground under a shade as a few metres from the eye.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        'attribute vec2 contactLocal;\nattribute vec2 contactHalf;\nattribute vec2 contactShade;\nvarying vec2 vContactLocal;\nvarying vec2 vContactHalf;\nvarying vec2 vContactShade;\nvoid main() {',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvContactLocal = contactLocal;\nvContactHalf = contactHalf;\nvContactShade = contactShade;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying vec2 vContactLocal;\nvarying vec2 vContactHalf;\nvarying vec2 vContactShade;\nvoid main() {')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
	{
		// distance from the foot's outline, 0 under it; its reach and darkness
		float d = length( max( abs( vContactLocal ) - vContactHalf, 0.0 ) );
		float k = 1.0 - smoothstep( 0.0, vContactShade.x, d );
		diffuseColor.a *= vContactShade.y * k * k;
	}`,
      );
  };
  material.customProgramCacheKey = () => 'estate-contact-shadow-2';

  const mesh = new THREE.Mesh(g, material);
  mesh.name = NAME;
  mesh.renderOrder = 1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  root.add(mesh);
  return mesh;
}
