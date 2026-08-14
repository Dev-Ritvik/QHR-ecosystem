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
    // HERO. The establishing shot: full elevation, fountain in the foreground,
    // building right-of-centre so the headline has the left. Verified 0.2247.
    at: 0.0,
    position: [0.0, 1.65, 30.0],
    target: [-7.0, 4.2, 0.0],
    fog: [34, 190],
    keyIntensity: 2.3,
  },
  {
    // KARTIKEYA. Dolly forward and left, swinging the facade across frame. The
    // camera is now off-axis, so the portico reads in three-quarter and the
    // depth between the near cypress and the far wing opens up.
    at: 0.22,
    position: [-11.0, 2.2, 23.0],
    target: [-1.5, 3.8, 0.0],
    fog: [30, 170],
    keyIntensity: 2.45,
  },
  {
    // LUCKY GARDEN. Rise and orbit. The elevation change is the point: from
    // 6.5m the roofline, cupola and spire stack against the sky instead of
    // being read edge-on, and the hedging reads as a plan below.
    at: 0.48,
    position: [-14.5, 6.8, 16.0],
    target: [0.0, 4.6, 0.0],
    fog: [24, 150],
    keyIntensity: 2.6,
  },
  {
    // VSR GAYATRI. Drop to a low, dramatic angle looking UP at the portico.
    // Kept at x -7 so the path stays clear of the fountain cylinder, which
    // spans x -2.7..2.7 around z 13.2.
    at: 0.74,
    position: [-7.0, 1.15, 12.0],
    target: [0.0, 5.6, 0.0],
    fog: [18, 120],
    keyIntensity: 2.75,
  },
  {
    // FOOTER. Pedestal up as the dark UI layer arrives. Ends left of the axis
    // rather than on it: a straight run from the previous beat to x 0 would
    // clip the fountain bowl on the way in.
    at: 1.0,
    position: [-2.5, 3.4, 9.0],
    target: [0.0, 4.2, 0.0],
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
