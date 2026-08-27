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
  /**
   * Metres the aim is pushed LEFT of the subject, in CAMERA space, at this
   * beat.
   *
   * This used to be one module constant in WorldCanvas, applied to every frame
   * of the journey. That was right while the whole path orbited one building
   * with a headline over the left of frame, and wrong the moment the sequence
   * gained a chapter whose subject is not the building: at the constellation
   * the camera stands 22m from a 12m sphere, and a fixed 7.4m offset swings it
   * most of the way off the right edge.
   *
   * So the offset became part of the shot, like the FOV and the bank. Wide
   * while the copy column is competing with architecture, nearly closed when
   * the subject has to hold the frame on its own.
   */
  frameOffset: number;
}

/**
 * The constellation's centre, in exterior world metres.
 *
 * Beyond the back of the estate and well above it: the cypresses top out at
 * 5.40, the spire at 11.72, and the hedge line ends at z -11.80, so nothing in
 * the model comes near this. The revolution ends by turning away from the
 * mansion to face it, which is the only way to give it a frame of its own —
 * the brief asks for the sphere as a focal point with a text block beside it,
 * not for the sphere as an ornament above a house.
 */
export const CONSTELLATION: [number, number, number] = [0, 16.0, -46.0];

/** World radius of the constellation. Chosen against the arrival beat: at 22m
 *  with a 38-degree lens the frame is 15.1m tall, so a 12.4m sphere holds 82%
 *  of it — large enough to be the subject, small enough that the pointer can
 *  approach it from outside its silhouette and be felt doing so. */
export const CONSTELLATION_RADIUS = 6.2;

/**
 * The beats, in order. Three chapters: the hero, the revolution, and the
 * constellation.
 *
 * WHAT THESE REPLACE, AND WHY. The previous five beats were named for the three
 * published projects, because the exterior used to carry the commercial story:
 * layout plans hung in the forecourt as floating cards, and the camera was
 * spaced to land a vantage under each one. The story has moved indoors, to the
 * hologram tables the model has always had and the site never used. So the
 * exterior is now free to do the one job it is actually good at — presenting a
 * building — and the beats are spaced by the SHOT rather than by the copy.
 *
 * The revolution is genuinely a revolution: roughly 200 degrees around the
 * left flank, anticlockwise from a front-left three-quarter. Anticlockwise is
 * not arbitrary. The aim is offset to the left of the subject throughout, which
 * holds the mansion in the right of frame for the hero column; orbiting the
 * other way would sweep the building through the typography at the halfway
 * point.
 *
 * GEOMETRY EVERY BEAT AND THE CURVE BETWEEN THEM MUST CLEAR (measured, metres):
 *
 *   mansion shell   x -8.05..8.05   y 0..6.80    z -5.55..6.10
 *   rustic base     x -9.64..9.64                z -6.54..8.34
 *   spire tip                       y 11.72      (x, z within +/-0.18)
 *   corner finials                  y  9.19      x +/-2.15, z +/-2.15
 *   fountain basin  x -2.78..2.78   y 0..0.64    z 10.42..15.98
 *   fountain stem                   y 0.50..2.67 x +/-0.40, z 12.80..13.60
 *   hedges          x +/-15.49..16.31  y 0..0.96  z -11.81..19.00
 *   terrain         x/z +/-120.00      y -2.97..0.97  (18,432 tri, authored)
 *   cypresses       x +/-26.48..27.52  y 0..5.40  z at 20, 12, 4, -4, -12
 *   back cypresses  z -16.49..-15.51   y 0..5.40  x +/-18.0, +/-9.0
 *
 * The lowest point on this path is 8.40m, which clears the cypresses by three
 * metres and the roofline by 1.6. That is deliberate: the previous path dropped
 * to 2.2m to skim the fountain, and a camera at head height circling a house is
 * an estate-agent walkthrough. This one stays airborne, which is the register
 * the brief asks for.
 */
export const BEATS: readonly CameraBeat[] = [
  {
    // HERO. The three-quarter bird's eye the brief opens on, derived from the
    // measured bounds rather than taken literally from the reference numbers.
    //
    // The reference is camera (-11, 8, 11) aimed at (0, 2, 0): a front-LEFT
    // three-quarter, 15.6m out on the ground plane and 6m above the aim, so an
    // elevation of 21 degrees. Held at that distance the 11.72m spire and the
    // 26m of forecourt out to the fountain do not both fit. Same angle, same
    // side, pushed out to 27m on the ground plane and 8.5m above the aim — 19
    // degrees, which is the same shot at a scale that holds the estate.
    at: 0.0,
    // RE-FRAMED against the final asset. At 27m on the ground plane with a 7.4m
    // aim offset the mansion ran off the right edge: the delivered building is
    // the same size, but it now sits in a landscape rather than on an empty
    // plane, and an estate shot that crops its own subject reads as a close-up
    // of a wall. 34m out and 10.8m above the aim is the same 19-degree
    // elevation — the reference angle — at a distance that holds the building,
    // the forecourt, the drive and the hedge line in one frame.
    //
    // RE-FRAMED AGAIN, and this time the fountain decided it.
    //
    // At (-24, 15, 24) — a true 45-degree front-left three-quarter — the
    // mansion held 37.9% of frame width and the fountain BOWL's right rim
    // landed at x 1361 of 1425. Every way of making the building more dominant
    // from that azimuth pushes the bowl off the right edge: 15% closer put it
    // at 1522, a 40-degree lens put it at 1432. The fountain sits on the entry
    // axis at z 13.2, so at a 45-degree vantage it is thrown wide right, and
    // magnifying anything throws it wider.
    //
    // Swinging to a 36.5-degree azimuth solves both at once, because a more
    // frontal vantage brings an on-axis foreground object back toward the
    // centre while the building itself grows. MEASURED at 1440x900:
    //
    //                       45 deg / 44mm     36.5 deg / 41mm
    //   mansion width          37.9%              41.9%
    //   mansion left edge      x 629              x 631   (gutter unchanged)
    //   spire tip              y 216              y 195   (more sky above)
    //   fountain bowl, right   x 1361             x 1369  (56px of margin)
    //
    // The elevation is untouched at 18.7 degrees, and the left edge lands
    // within two pixels of where it was, so the column of type keeps exactly
    // the gutter it was composed against.
    position: [-20.0, 15.5, 27.0],
    target: [0.0, 4.1, 0.0],
    // ATMOSPHERIC PERSPECTIVE, tightened from [40, 150].
    //
    // The key is a directional light, so it lights all 240m of lawn at the same
    // intensity — MEASURED: with every other light forced to zero the lawn held
    // [73,73,48], so the broad wash across the left of the hero is the key on
    // uniform ground, not a bloom halo or a fog tint. A directional light cannot
    // fall off with distance; fog is the only thing in the scene that can.
    //
    // 26..105 leaves the building untouched (its front face is 28m from the
    // hero camera, so ~2% fog) while taking the middle distance to about a
    // third and burying the far edge of the terrain entirely. That is depth
    // recovered from a real optical effect rather than a gradient painted over
    // the problem.
    fog: [26, 105],
    keyIntensity: 2.3,
    // 44 -> 41. A longer lens compresses the facade, which is what
    // architectural photography does and what a wide angle undoes: at 44 the
    // near corner ran away from the far one and the building read as a model.
    fov: 41,
    roll: 0.0,
    // 7.4 -> 6.0 -> 6.2. The offset is what holds the architecture in the right
    // 60% for the hero column; the last 0.2 compensates the swing to a more
    // frontal azimuth so the left edge stays where the type was composed
    // against it.
    frameOffset: 6.2,
  },
  {
    // REVOLUTION, QUARTER. Swung onto the left flank and dropped four metres,
    // banking into the turn. Widest lens here because this is the fastest leg
    // and a wide lens exaggerates the parallax between the near colonnade and
    // the far cypresses, which is what the eye reads as speed.
    at: 0.3,
    position: [-26.0, 9.0, 2.0],
    target: [0.0, 4.6, 0.0],
    fog: [30, 136],
    keyIntensity: 2.5,
    fov: 56,
    roll: -0.048,
    frameOffset: 8.2,
  },
  {
    // REVOLUTION, THREE-QUARTER. Behind the left shoulder of the building, the
    // lowest and closest point of the orbit. 8.40m of altitude against a 6.80m
    // roof and 5.40m cypresses.
    at: 0.58,
    position: [-15.0, 8.4, -19.0],
    target: [0.0, 4.8, 0.0],
    fog: [24, 120],
    keyIntensity: 2.7,
    fov: 52,
    roll: -0.036,
    frameOffset: 6.4,
  },
  {
    // THE TURN AWAY. The aim leaves the building for the first time in the
    // sequence and starts travelling out into the dark behind the estate. This
    // beat exists so the pan is a MOVE rather than a cut: the camera is already
    // looking where it is going before it gets there.
    at: 0.82,
    position: [-6.0, 12.2, -14.0],
    target: [0.0, 12.0, -34.0],
    fog: [22, 120],
    keyIntensity: 2.4,
    fov: 46,
    roll: -0.012,
    frameOffset: 4.2,
  },
  {
    // CONSTELLATION. Level with the sphere and 22m out, unbanked, on the axis.
    //
    // The fog opens back up here on purpose. Everywhere else on this path fog
    // is doing compositional work — burying the far edge of a 450m ground
    // plane. Out here there is no ground in frame and the far value has to stay
    // low, or the constellation is read against a lifted grey instead of
    // against night.
    at: 1.0,
    position: [0.0, 16.0, -24.0],
    target: [0.0, 16.0, -46.0],
    fog: [30, 140],
    keyIntensity: 2.0,
    fov: 38,
    roll: 0.0,
    // Nearly closed. The sphere is the subject and has to hold the frame; the
    // text block sits beside it in the DOM, in the space this small offset
    // opens on the left.
    frameOffset: 2.6,
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
export function lensAt(scroll: number): {
  fov: number;
  roll: number;
  frameOffset: number;
} {
  const s = Math.min(1, Math.max(0, scroll));
  for (let i = 0; i < BEATS.length - 1; i += 1) {
    const a = BEATS[i];
    const b = BEATS[i + 1];
    if (s <= b.at) {
      const k = b.at === a.at ? 0 : (s - a.at) / (b.at - a.at);
      return {
        fov: a.fov + (b.fov - a.fov) * k,
        roll: a.roll + (b.roll - a.roll) * k,
        frameOffset: a.frameOffset + (b.frameOffset - a.frameOffset) * k,
      };
    }
  }
  const last = BEATS[BEATS.length - 1];
  return { fov: last.fov, roll: last.roll, frameOffset: last.frameOffset };
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
