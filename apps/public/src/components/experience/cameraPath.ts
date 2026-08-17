// apps/public/src/components/experience/cameraPath.ts
//
// The camera's journey across the home page, as a spline rather than a line.
//
// WHY THIS REPLACES A TWO-POINT LERP
//
// `arrival` used to interpolate between one start pose and one end pose. That
// worked while the page was 2,514px, because 12 metres of travel over 1,800px
// of wheel is obvious motion. Then the scroll track was stretched to 10,894px
// to fix the pacing — and the SAME 12 metres spread over 15 viewports became
// roughly 0.8m per screen. Correct pacing, no choreography: the camera was
// technically moving and visibly frozen. Fixing one axis broke the other.
//
// A path fixes both. The distance travelled now scales with the page, and more
// importantly it CHANGES DIRECTION — dolly, rise, orbit, drop, pedestal — so
// each beat reframes the building instead of creeping toward it.
//
// GEOMETRY THIS PATH MUST RESPECT (measured from exterior_mansion.glb, three
// space, metres):
//
//   mansion      x -9.55..9.55   y 0..6.80 (spire 11.72)   z -5.55..6.10
//   entry step   z 6.15
//   fountain     centre (0, ·, 13.2), bowl radius ~2.7  -> a solid cylinder
//                the camera must not fly through
//   hedges       x +/-15.9        cypress x +/-27
//
// Every keyframe below, and the interpolated path between them, is rendered and
// scored by tools/blender/audit_camera_path.py before it ships. Three cameras
// have already reached a client aimed at a wall, at nothing, and at the outside
// of a building — all three were hand-converted coordinates nobody looked
// through. A curve is worse than a pose in that respect: it can pass through
// solid geometry BETWEEN two perfectly good keyframes.

import * as THREE from 'three';

export interface CameraBeat {
  /** Scroll progress 0..1 where this beat lands. */
  at: number;
  position: [number, number, number];
  target: [number, number, number];
  /** Atmosphere at this beat. Fog and key intensity travel with the camera, so
   *  the mood evolves along the journey instead of sitting flat. */
  fog: [near: number, far: number];
  keyIntensity: number;
}

/**
 * The beats, in order. Named for the section of the page they sit under.
 *
 * The page is one hero plus three project sections plus a closing stretch, so
 * the beats are spaced to land a distinct vantage under each card rather than
 * at even intervals — the camera should be arriving somewhere as you begin
 * reading, not mid-move.
 */
export const BEATS: readonly CameraBeat[] = [
  {
    // HERO. theta -8, R 30. Wide establishing, building right of frame so the
    // headline has the left.
    at: 0.0,
    position: [-4.18, 1.65, 29.71],
    target: [0.0, 4.2, 0.0],
    fog: [34, 190],
    keyIntensity: 2.3,
  },
  {
    // KARTIKEYA. theta 20, R 25. The orbit begins and the radius closes: the
    // facade swings to three-quarter and the near corner starts to lead.
    at: 0.22,
    position: [8.55, 2.4, 23.49],
    target: [0.0, 4.1, 0.0],
    fog: [30, 170],
    keyIntensity: 2.45,
  },
  {
    // LUCKY GARDEN. theta 48, R 19. High point of the arc. Elevation and
    // rotation together - the roofline, cupola and spire stack against the sky
    // while the plan of the forecourt opens below.
    at: 0.48,
    position: [14.12, 6.8, 12.71],
    target: [0.0, 4.4, 0.0],
    fog: [24, 150],
    keyIntensity: 2.6,
  },
  {
    // VSR GAYATRI. theta 70, R 15. Drop low and keep sweeping. Near the side
    // elevation now, looking up the length of the building.
    at: 0.74,
    position: [14.1, 2.0, 5.13],
    target: [0.0, 4.8, 0.0],
    fog: [18, 120],
    keyIntensity: 2.75,
  },
  {
    // FOOTER. theta 90, R 13. Full broadside, pedestal up as the dark UI
    // arrives. A quarter-turn of travel from the opening frame.
    at: 1.0,
    position: [13.0, 4.2, 0.0],
    target: [0.0, 3.9, 0.0],
    fog: [14, 95],
    keyIntensity: 2.5,
  },
];

/**
 * Catmull-Rom through the beats, centripetal.
 *
 * Centripetal (three's default) rather than uniform specifically because the
 * beats are NOT evenly spaced in distance — the hero-to-Kartikeya leg is ~13m
 * and the Gayatri-to-footer leg is ~5m. Uniform Catmull-Rom on unevenly spaced
 * points overshoots on the long legs, and an overshoot here means the camera
 * bulging outward through a hedge or inward through the fountain between two
 * keyframes that are each individually fine.
 */
function curveThrough(points: readonly [number, number, number][]) {
  return new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'centripetal',
  );
}

/**
 * The mansion's centroid. The camera's aim stays locked here for the whole
 * orbit, and DOF focuses on it — one shared constant so the lens and the look
 * can never disagree about where the subject is.
 */
export const SUBJECT: [number, number, number] = [0, 4.0, 0];

export const POSITION_CURVE = curveThrough(BEATS.map((b) => b.position));
export const TARGET_CURVE = curveThrough(BEATS.map((b) => b.target));

/**
 * Map scroll progress to curve parameter.
 *
 * NOT the identity. The beats sit at uneven `at` values so each lands under its
 * section, but the curve is parameterised 0..1 across its control points. This
 * remaps so that scrolling to a beat's `at` puts the camera exactly on that
 * beat rather than near it — otherwise the vantage that was rendered and
 * approved is never actually the one on screen.
 */
export function curveT(scroll: number): number {
  const s = Math.min(1, Math.max(0, scroll));
  const n = BEATS.length - 1;
  for (let i = 0; i < n; i += 1) {
    const a = BEATS[i].at;
    const b = BEATS[i + 1].at;
    if (s <= b) {
      const local = b === a ? 0 : (s - a) / (b - a);
      return (i + local) / n;
    }
  }
  return 1;
}

/** Fog and key intensity, interpolated between the surrounding beats. Linear
 *  on purpose: atmosphere should track the journey, not have a life of its
 *  own on top of a curve that is already easing. */
export function atmosphereAt(scroll: number): { near: number; far: number; key: number } {
  const s = Math.min(1, Math.max(0, scroll));
  for (let i = 0; i < BEATS.length - 1; i += 1) {
    const a = BEATS[i];
    const b = BEATS[i + 1];
    if (s <= b.at) {
      const k = b.at === a.at ? 0 : (s - a.at) / (b.at - a.at);
      return {
        near: a.fog[0] + (b.fog[0] - a.fog[0]) * k,
        far: a.fog[1] + (b.fog[1] - a.fog[1]) * k,
        key: a.keyIntensity + (b.keyIntensity - a.keyIntensity) * k,
      };
    }
  }
  const last = BEATS[BEATS.length - 1];
  return { near: last.fog[0], far: last.fog[1], key: last.keyIntensity };
}
