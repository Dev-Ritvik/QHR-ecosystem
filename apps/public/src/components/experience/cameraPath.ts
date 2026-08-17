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
  /** Vertical FOV in degrees. Widening during the fast legs exaggerates
   *  parallax and reads as speed; narrowing on arrival compresses the facade
   *  and settles the shot. This is the single cheapest source of kinetic
   *  energy available — it costs one projection matrix update per frame. */
  fov: number;
  /** Bank, in radians, applied about the camera's own view axis. Leaning into
   *  a turn is what makes a sweep feel flown rather than driven. Small: past
   *  ~0.09 the horizon tilt reads as a broken camera rather than as momentum. */
  roll: number;
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
    // HERO. High above the roofline (spire tops out at 11.72) looking down on
    // the whole forecourt. The building reads as a plan before it reads as an
    // elevation, and the descent from here is what the rest of the page is.
    at: 0.0,
    position: [2.5, 12.5, 22.0],
    target: [0.0, 3.6, 0.0],
    fog: [40, 210],
    keyIntensity: 2.3,
    fov: 50,
    roll: 0.0,
  },
  {
    // KARTIKEYA. The dive begins: 12m of elevation dropped while swinging
    // right. Widest FOV of the sequence — this is the fastest leg and the one
    // that should feel like falling.
    at: 0.22,
    position: [12.0, 14.0, 26.0],
    target: [0.0, 4.0, 0.0],
    fog: [32, 175],
    keyIntensity: 2.45,
    fov: 68,
    roll: -0.052,
  },
  {
    // LUCKY GARDEN. Levelling into the turn at roof height, still banked.
    at: 0.48,
    position: [17.0, 7.5, 15.0],
    target: [0.0, 4.5, 0.0],
    fog: [26, 150],
    keyIntensity: 2.6,
    fov: 62,
    roll: -0.068,
  },
  {
    // VSR GAYATRI. Down into the courtyard and across the front of the
    // fountain. Camera is 7.7m from the bowl centre (radius 3.1) at 2.2m of
    // height, so the water passes close in the foreground without the camera
    // entering it. Tightest FOV: the shot slows here.
    at: 0.74,
    position: [7.0, 2.2, 16.5],
    target: [0.0, 4.5, 4.0],
    fog: [18, 120],
    keyIntensity: 2.75,
    fov: 44,
    roll: 0.030,
  },
  {
    // FOOTER. Rise and unbank onto the side elevation as the dark UI arrives.
    at: 1.0,
    position: [15.5, 5.2, 6.4],
    target: [0.0, 4.0, 0.0],
    fog: [14, 95],
    keyIntensity: 2.5,
    fov: 48,
    roll: 0.0,
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
/** FOV and bank between the surrounding beats. Same linear read as the
 *  atmosphere: the curve is already easing, and layering a second easing on
 *  the lens produces motion nobody asked for. */
export function lensAt(scroll: number): { fov: number; roll: number } {
  const s = Math.min(1, Math.max(0, scroll));
  for (let i = 0; i < BEATS.length - 1; i += 1) {
    const a = BEATS[i];
    const b = BEATS[i + 1];
    if (s <= b.at) {
      const k = b.at === a.at ? 0 : (s - a.at) / (b.at - a.at);
      return {
        fov: a.fov + (b.fov - a.fov) * k,
        roll: a.roll + (b.roll - a.roll) * k,
      };
    }
  }
  const last = BEATS[BEATS.length - 1];
  return { fov: last.fov, roll: last.roll };
}

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
