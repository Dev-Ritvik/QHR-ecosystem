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
// GEOMETRY THIS PATH MUST RESPECT is estateBounds.ts: measured from
// exterior_estate_v7.glb by tools/gltf/estate_bounds_v7.py, one box per solid
// and one per palm and tree, and asserted against the whole path in
// cameraPath.test.ts. In outline (three space, metres):
//
//   house + podium  x -15.5..15.5  y 0..12.5 (a flat roof behind the parapet
//                   since 2026-10-01; a hip, a cupola and a spire rose to
//                   20.34 before it)  z -10.3..13.25
//   fountain        centre (0, ·, 30), radius 3.95, 3.4 m tall
//   palm avenue     x +/-7.6 from z 47 to 208; forecourt palms at r 17.5
//   compound wall   x +/-72, z -84..215, a planted belt beyond it
//
// Every keyframe below, and the interpolated path between them, is rendered and
// scored by tools/blender/audit_camera_path.py before it ships. Three cameras
// have already reached a client aimed at a wall, at nothing, and at the outside
// of a building — all three were hand-converted coordinates nobody looked
// through. A curve is worse than a pose in that respect: it can pass through
// solid geometry BETWEEN two perfectly good keyframes.

import * as THREE from 'three';
import { twilightAt } from './filmHours';
import { FILM_SHARE } from './filmShares';
import { ld, lookdevOn } from './lookdev';

/**
 * THE ESTATE GREW, AND THE FILM GREW WITH IT.
 *
 * The client review asked for the mansion to be "bigger, taller, wider, and
 * importantly longer", keeping its features. exterior_estate_v7.glb is that
 * house: 31 m of podium where there were 19, 20.3 m to the spire tip where there
 * were 11.7, the same pedimented centre, portico, arched windows, parapet and
 * spire, now nine bays long.
 *
 * Every approved beat below is written in the coordinates it was signed off in
 * and grown by this factor about the estate's centre. Scaling a camera's
 * position, its aim, its fog and its frame offset by the same factor as the
 * subject reproduces the same picture of a larger subject exactly, so the hero,
 * the revolution and the constellation keep their approved compositions rather
 * than being re-guessed. The approach to the door is NOT grown: the door is the
 * same door, 3.4 m tall, and those beats are re-authored on it (see below).
 */
export const ESTATE_SCALE = 1.6;
/** Where the two high beats (the crane, the holdings) aim: just under the
 *  flat roof's parapet, so the roofline stands at the middle of the frame. */
export const ROOFLINE_AIM = 12.0;
const grow = (v: readonly [number, number, number]): [number, number, number] => [
  v[0] * ESTATE_SCALE,
  v[1] * ESTATE_SCALE,
  v[2] * ESTATE_SCALE,
];
const growFog = (f: readonly [number, number]): [number, number] => [
  f[0] * ESTATE_SCALE,
  f[1] * ESTATE_SCALE,
];

export interface CameraBeat {
  /** A name for the shot, so a test or a note can point at one beat without
   *  counting array indices that move whenever a beat is added. */
  id: string;
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

/*
 * THE CONSTELLATION IS GONE. It crowned the spire from Phase 6B (placement,
 * clearance and size history are in git: cameraPath.ts before 2026-09-30), and
 * the second art-direction audit asked for it to be removed outright — "the
 * single most out-of-place element in the entire experience". Its chapter,
 * HOLDINGS, keeps its beat: the rear three-quarter at dusk, the spire against
 * the evening sky, the figures beside it.
 */

/**
 * Where the holdings' held frame (once the constellation's) sits on the
 * exterior leg.
 *
 * ADDED WITH THE APPROACH, BY CLIENT REVIEW. The film used to end on the
 * constellation and close a black veil over that frame — so the visitor passed
 * from a crane shot forty-eight metres behind the house straight into the hall,
 * and the review put it plainly: the transition "opens here in the site", and it
 * must open from the actual door. The exterior leg therefore gained a fourth
 * chapter after the constellation: the camera comes down the left flank as the
 * light goes, swings onto the entry axis over the fountain, and stops square on
 * the front door. doorway.ts takes it through that door.
 *
 * The first three chapters are NOT re-authored. Their beats keep their exact
 * positions, targets, lenses and relative spacing; they are compressed into the
 * first FILM_SHARE of the leg, and the page grows by the same factor (journey.ts)
 * so every one of them keeps the scroll distance it was paced against. Two
 * separate curves meet at the constellation beat rather than one curve through
 * all ten points: a Catmull-Rom through a point bends the segments on BOTH sides
 * of it, so a single curve would have reshaped the approved crane move to suit
 * the new descent. The camera slows almost to rest at the join (see
 * exteriorSwing), so the change of direction there is a crane that settles and
 * then sets off again, not a kink.
 *
 * 0.625 is 1 / 1.6: the approach gets 0.6 of the page the first three chapters
 * share. Sampled on the two curves through the swing ease, that is the share at
 * which the approach's fastest moment sweeps around the house at 63 degrees per
 * viewport of scroll against the film's 53 — a finale a little quicker than the
 * orbit it follows, not a whip-pan.
 */
export { FILM_SHARE };

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
export const FILM_BEATS: readonly CameraBeat[] = [
  {
    id: 'hero',
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
    //
    // LOWERED AND PULLED BACK for the "make it look expensive" pass, and it is a
    // composition change rather than a taste one. At 15.5m over a 4.1m aim the
    // camera looked DOWN onto the roof and the tree belt closed the top of
    // frame: no sky at all, and the building's silhouette — parapet, cupola,
    // spire, the three most expensive lines on it — read against foliage the
    // same value as itself. 12.2m over a 5.0m aim at 31m out is 13 degrees
    // rather than 18.7: the roofline now stands against the golden-hour sky,
    // the fountain enters the bottom of frame as a foreground, and the pool
    // terrace still holds the left third. The azimuth, the lens and the frame
    // offset are untouched, so the type keeps its gutter.
    //
    // A LONGER LENS, FROM FURTHER BACK (the paid audit of 2026-10-04, pass 2:
    // "make every shot feel like an architectural photograph, not a camera
    // travelling through a model ... reveal one architectural idea
    // beautifully ... is the building too small?"). At [-32, 19.5, 49.6] on 41
    // degrees the frame was an inventory: the whole pool terrace, its cabana
    // and loungers, the car, the fountain, the helipad's windsock and sixty
    // metres of lawn, with the house at two-fifths of the width. The subject
    // is the ENTRANCE FRONT. So the same three-quarter bird's eye, from the
    // same side and a hair lower in angle, is taken from further back on a long
    // lens (26 degrees, 82 m): the house is half the frame, its front and its portico the lit
    // thing in it; the park's trees stand up behind the parapet in layers of
    // evening haze, as a long lens stacks them; the pool is a corner of water
    // at the frame's foot and the rest of the terrace is left out; and the
    // top third is sky, where the cover's words now stand (site-home).
    // Was: position grow([-20.0, 12.2, 31.0]), target grow([0.0, 5.0, 0.0]),
    // fov 41, frameOffset 6.2 * ESTATE_SCALE.
    position: [-46.0, 20.0, 66.0],
    target: [0.0, 12.6, 0.0],
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
    fog: growFog([26, 105]),
    keyIntensity: 2.3,
    // 44 -> 41. A longer lens compresses the facade, which is what
    // architectural photography does and what a wide angle undoes: at 44 the
    // near corner ran away from the far one and the building read as a model.
    fov: 26,
    roll: 0.0,
    // 7.4 -> 6.0 -> 6.2 (x 1.6), and 8.5 for the long lens: the house stands
    // right of the middle, its west corner at two-fifths of the frame's width.
    frameOffset: 8.5,
  },
  {
    id: 'quarter',
    // REVOLUTION, QUARTER. Swung onto the left flank and dropped four metres,
    // banking into the turn. Widest lens here because this is the fastest leg
    // and a wide lens exaggerates the parallax between the near colonnade and
    // the far cypresses, which is what the eye reads as speed.
    //
    // Every `at` in this list is its approved value times FILM_SHARE — see the
    // note there. 0.3 of the old leg is 0.3 of the film.
    at: 0.3 * FILM_SHARE,
    position: grow([-26.0, 9.0, 2.0]),
    target: grow([0.0, 4.6, 0.0]),
    fog: growFog([30, 136]),
    keyIntensity: 2.5,
    // 56 until the paid audit (pass 2): the widest lens on the fastest leg was
    // there to exaggerate parallax, "what the eye reads as speed" — and speed
    // through a model is exactly what the audit read. 48 holds the flank as
    // an elevation rather than a fly-by.
    fov: 48,
    roll: -0.048,
    frameOffset: 8.2 * ESTATE_SCALE,
  },
  {
    id: 'three-quarter',
    // REVOLUTION, THREE-QUARTER. Behind the left shoulder of the building, the
    // lowest and closest point of the orbit. 8.40m of altitude against a 6.80m
    // roof and 5.40m cypresses.
    at: 0.58 * FILM_SHARE,
    position: grow([-15.0, 8.4, -19.0]),
    target: grow([0.0, 4.8, 0.0]),
    fog: growFog([24, 120]),
    keyIntensity: 2.7,
    // (52 until the paid audit: see the quarter.)
    fov: 46,
    roll: -0.036,
    frameOffset: 6.4 * ESTATE_SCALE,
  },
  {
    id: 'layout',
    // THE LAYOUT (the founder's frame, 2026-10-28: "Elevated Drone-Sweep View
    // ... the camera has been lifted significantly higher and is sweeping back
    // ... The villa and pool are now positioned in the mid-left"). Where the
    // crane and the holdings stood, behind the house at dusk, the chapter is
    // now the land the house stands in, laid out in plots (exteriorLayout.ts):
    // from over the west lawn, the house and its pool left of the middle, the
    // avenue running from its forecourt to the frame's right foot, and the
    // plotted lawns either side of it filling the foot of the frame, under
    // the forest and the hills.
    //
    // The pose was fitted to the founder's frame (scratchpad layout/fit8.py):
    // the house's four parapet corners and two of its feet, the pool, the
    // avenue on his road's middle, the first cross road on his, and the horizon
    // a sixth of the way down, his hills' foot. His frame stands the house 43
    // degrees round from the axis and the roads square with it; the avenue on
    // the axis then lies within a road's width of his road. Thirty-seven metres
    // up over the west lawn, on a 48-degree lens. (Fitted first with the house
    // left out of the angle: 34 degrees round, the house too square-on.)
    at: FILM_SHARE,
    position: [-62.4, 37.2, 95.8],
    target: [20.0, 1.2, 7.5],
    fog: growFog([60, 150]),
    keyIntensity: 2.6,
    fov: 48,
    roll: 0.0,
    // The house is left of the middle by the aim alone.
    frameOffset: 0,
  },
];

/**
 * THE SWEEP, from the three-quarter to the layout: up behind the house's left
 * shoulder (the crane, where the approved film rose to), round over the trees
 * beyond the west wall, and in over the west lawn, the aim on the house the
 * whole way until it settles right of it.
 *
 * These are waypoints, not beats: the curve passes through them but no lens or
 * light is set at them (the lens runs from the three-quarter straight to the
 * layout, lensAt). The first is the crane as it was, so the
 * revolution's last stretch, which a Catmull-Rom shapes by the point after it,
 * is the stretch that was approved (cameraPath.test.ts).
 */
export const SWEEP_WAYPOINTS: readonly { position: [number, number, number]; target: [number, number, number] }[] = [
  { position: grow([-21.0, 15.0, -32.0]), target: [0.0, ROOFLINE_AIM, 0.0] },
  { position: [-80.0, 36.0, -20.0], target: [0.0, 9.0, 0.0] },
  { position: [-94.0, 34.0, 64.0], target: [6.0, 8.0, 4.0] },
];

/**
 * THE APPROACH — from the layout down to the front door, as night falls.
 *
 * DOWN OVER THE PLOTS, not back round the house (the founder's layout,
 * 2026-10-28). It used to leave the holdings beat, behind the house, and come
 * back down the left flank; the layout stands far out to the south-west, so
 * the way to the door is over the land it has just shown: down across the
 * west lawn's plots as the light goes, in round the head of the avenue's
 * first palms, onto the axis over the fountain, and square on the door. The
 * last three beats are the approved ones, unchanged (the doorway continues
 * their push).
 *
 * GEOMETRY. Clearances are in cameraPath.test.ts against the same hulls as the
 * rest of the path. The last two beats are ON the entry axis (x = 0), so the
 * final stretch is a straight push toward the door rather than a slide onto it
 * — which matters, because the doorway move continues that push.
 *
 * AT VALUES are on the whole exterior leg. The first entry is the layout beat
 * itself: this curve starts where the film's ends.
 */
const APPROACH_SPAN = 1 - FILM_SHARE;

export const APPROACH_BEATS: readonly CameraBeat[] = [
  FILM_BEATS[FILM_BEATS.length - 1],
  {
    id: 'descent',
    // Down off the layout over the west lawn's plots, the house ahead with its
    // lamps on, and the twilight going to night (filmHours.ts).
    at: FILM_SHARE + APPROACH_SPAN * 0.33,
    position: [-44.0, 19.0, 80.0],
    target: [0.0, 6.0, 10.0],
    fog: growFog([40, 160]),
    keyIntensity: 2.5,
    fov: 42,
    roll: 0.02,
    frameOffset: 2.4 * ESTATE_SCALE,
  },
  {
    id: 'forecourt',
    // In over the forecourt's west lawn, round the head of the avenue's palms
    // (the first pair stands at z 41 to 53, crowns to 13.5 m), the lit front
    // raking away to the right, and on toward the axis.
    at: FILM_SHARE + APPROACH_SPAN * 0.64,
    position: [-27.0, 12.0, 44.0],
    target: [0.0, 5.4, 7.2],
    fog: growFog([32, 150]),
    keyIntensity: 2.45,
    fov: 41,
    roll: 0.025,
    frameOffset: 1.4 * ESTATE_SCALE,
  },
  {
    id: 'axis-far',
    // Swinging onto the axis beyond the fountain. The copy column is closing out
    // here — the offset falls toward zero — because the subject is about to be a
    // doorway on the centre line and an off-centre doorway reads as a mistake.
    at: FILM_SHARE + APPROACH_SPAN * 0.86,
    // V7: onto the axis over the fountain, short of the palm avenue. The four
    // approach beats were searched against estateBounds.ts for the pose nearest
    // the intended shots that clears every palm by more than a metre and keeps
    // the descent under the path's vertical-kink bound.
    // (11.7 m up until the forecourt beat came down to 10.6: the descent is
    // one way all the way to the door.)
    position: [-5.3, 10.0, 38.1],
    target: [0.0, 3.4, 8.2],
    fog: growFog([30, 145]),
    keyIntensity: 2.4,
    fov: 36,
    roll: 0.008,
    frameOffset: 0.5,
  },
  {
    id: 'axis',
    at: FILM_SHARE + APPROACH_SPAN * 0.95,
    position: [0.0, 9.3, 36.7],
    target: [0.0, 2.9, 8.2],
    fog: growFog([30, 140]),
    keyIntensity: 2.4,
    fov: 32,
    roll: 0.0,
    frameOffset: 0.15,
  },
  {
    id: 'door',
    // THE FRONT DOOR, square on, from beyond the fountain.
    //
    // Everything about this frame is decided by the move that follows it. The
    // doorway (doorway.ts) flies straight down the camera's own view axis and
    // through the opening, so the door must sit on that axis: camera and aim
    // both at x = 0, frame offset zero. 17 m back with a 40-degree lens holds
    // the whole portico and most of the elevation, with the door at a quarter of
    // frame height — large enough to be the unmistakable subject, small enough
    // that the flight toward it is a flight and not a lurch.
    //
    // 4.6 m up puts the sight line to the door over the fountain: the bowl and
    // cap sit below the threshold in frame, and only the thin jet crosses the
    // foot of the doors. The straight line from here to the doorway clears the
    // jet by 0.7 m — asserted in doorway.test.ts, not assumed.
    at: 1.0,
    // V7: the same door, set in a portico twice as deep and a fountain 22 m out
    // rather than 8. 25.4 m back on a 30-degree lens keeps the door at a quarter
    // of frame height and the whole portico in shot, and 6 m up keeps the
    // straight flight to the doorway 1.5 m over the fountain (doorway.test.ts).
    position: [0.0, 6.0, 33.6],
    target: [0.0, 2.6, 8.2],
    fog: growFog([30, 140]),
    keyIntensity: 2.4,
    fov: 30,
    roll: 0.0,
    frameOffset: 0.0,
  },
];

/** Every beat on the exterior leg, in order, each once. The lens and the
 *  atmosphere read this; the camera reads the two curves below. */
export const BEATS: readonly CameraBeat[] = [...FILM_BEATS, ...APPROACH_BEATS.slice(1)];

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
export const SUBJECT: [number, number, number] = grow([0, 4.0, 0]);

const [HERO, QUARTER, THREE_QUARTER, LAYOUT] = FILM_BEATS;
const CRANE = SWEEP_WAYPOINTS[0];

/**
 * The approved film, the hero to the three-quarter: through the crane as well,
 * which it no longer reaches, because a Catmull-Rom segment is shaped by the
 * point after it and the revolution's last stretch was approved with the crane
 * there. Read up to the three-quarter only (exteriorPoseAtSwing).
 */
export const FILM_POSITION_CURVE = curveThrough([HERO, QUARTER, THREE_QUARTER].map((b) => b.position).concat([CRANE.position]));
export const FILM_TARGET_CURVE = curveThrough([HERO, QUARTER, THREE_QUARTER].map((b) => b.target).concat([CRANE.target]));
/** The revolution's beats as its curve has them (the crane's `at` is never
 *  reached: the curve is read only as far as the three-quarter). */
const REVOLUTION = [HERO, QUARTER, THREE_QUARTER, { ...THREE_QUARTER, at: LAYOUT.at }];

/**
 * The sweep, from the three-quarter through its waypoints to the layout. Drawn
 * from the quarter, so it leaves the three-quarter on the revolution's own
 * tangent (a segment's tangent at its start is shaped by the point before it),
 * and read from the three-quarter on.
 */
export const SWEEP_POSITION_CURVE = curveThrough(
  [QUARTER.position, THREE_QUARTER.position, ...SWEEP_WAYPOINTS.map((w) => w.position), LAYOUT.position],
);
export const SWEEP_TARGET_CURVE = curveThrough(
  [QUARTER.target, THREE_QUARTER.target, ...SWEEP_WAYPOINTS.map((w) => w.target), LAYOUT.target],
);
/** Where on the sweep's curves the three-quarter is. */
const SWEEP_FROM_U = 1 / (SWEEP_WAYPOINTS.length + 2);

/**
 * THE LAYOUT ON AN UPRIGHT SCREEN. The layout's aim is right of the house, for
 * a wide frame whose left is the chapter's words; a phone's frame is the
 * middle two-fifths of that, and held the house cut by its left edge. Upright,
 * the chapter's words stand over the top half of the frame (as the cover's
 * do), so the aim comes onto the house and above it: the house in the lower
 * middle of the frame with its pool to the left, the fountain and the avenue
 * to the right, the plots under them (seen at 390x844). Taken on over the
 * sweep's second half and given back over the descent's first stretch
 * (`swing`: whole between, none outside), by how upright the frame is.
 */
export const LAYOUT_UPRIGHT = {
  target: [-6.0, 15.0, 8.0] as [number, number, number],
  swing: [0.45, 0.58, FILM_SHARE, FILM_SHARE + (1 - FILM_SHARE) * 0.33] as const,
} as const;
const layoutUprightAim = new THREE.Vector3(...LAYOUT_UPRIGHT.target);

/** How much of the layout's upright aim a frame takes at this point of swing
 *  space, before its uprightness. */
export function layoutUpright(swing: number): number {
  const [a, b, c, d] = LAYOUT_UPRIGHT.swing;
  const s = (e0: number, e1: number) => {
    const t = Math.min(1, Math.max(0, (swing - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return s(a, b) * (1 - s(c, d));
}

/** The approach, from the layout to the front door. */
export const APPROACH_POSITION_CURVE = curveThrough(APPROACH_BEATS.map((b) => b.position));
export const APPROACH_TARGET_CURVE = curveThrough(APPROACH_BEATS.map((b) => b.target));

/**
 * Map progress to a parameter on one curve.
 *
 * NOT the identity. The beats sit at uneven `at` values so each lands under its
 * section, but the curve is parameterised 0..1 across its control points. This
 * remaps so that scrolling to a beat's `at` puts the camera exactly on that
 * beat rather than near it — otherwise the vantage that was rendered and
 * approved is never actually the one on screen.
 */
export function curveTOver(beats: readonly CameraBeat[], swing: number): number {
  const n = beats.length - 1;
  const s = Math.min(beats[n].at, Math.max(beats[0].at, swing));
  for (let i = 0; i < n; i += 1) {
    const a = beats[i].at;
    const b = beats[i + 1].at;
    if (s <= b) {
      const local = b === a ? 0 : (s - a) / (b - a);
      return (i + local) / n;
    }
  }
  return 1;
}

/**
 * The swing: power2.inOut plus a linear pedestal, applied to the CURVE
 * parameter only. Moved here from WorldCanvas so the path and its tests read the
 * same function; gsap's power2.inOut is the quadratic below, written out so this
 * module does not need gsap to be tested.
 *
 * Raw scroll progress is linear, so a linear read of it moves the camera at a
 * constant rate along the whole curve — which is why the dive had no weight.
 * Momentum is the DERIVATIVE of position, and a linear map has a constant one.
 * Atmosphere and lens read raw scroll, so fog and FOV stay tied to where the
 * visitor is on the page rather than lurching with the camera.
 *
 * power2.inOut, not power4. Across a single continuous track power4 spends so
 * much of the range near zero velocity that the middle beats blur past in a
 * fraction of the scroll and never read; power2 accelerates and decelerates
 * over the whole journey while still crossing the centre at a real clip.
 *
 * PLUS A LINEAR PEDESTAL, because an inOut ease has zero derivative at zero and
 * the head of the exterior leg is the first thing anyone touches.
 *
 * MEASURED at 1440x900 against a 14,014px track, camera travel from rest:
 *
 *                        power2.inOut     +0.20 pedestal
 *   quarter viewport        0.01 m           0.54 m
 *   half viewport           0.10 m           1.15 m
 *   one full viewport       0.83 m           2.82 m
 *
 * One centimetre. A visitor could scroll a quarter of a screen — the first
 * flick of a wheel — and the image was pixel-identical, which is the one thing
 * a camera on a scroll track must never do. It is not a pacing preference; at
 * 34m from the subject a 1cm dolly is 0.03% of the frame.
 *
 * The pedestal is a weighted sum rather than a different ease because it fixes
 * the derivative at the ends without changing the shape in between: E'(0) is
 * now LEAD instead of 0, and the mid-leg whip actually calms slightly (peak
 * 24.8 -> 22.9 m per viewport) because the linear term carries some of the
 * distance the eased term was cramming into the centre.
 *
 * The non-zero derivative at the end of the approach costs nothing: that is the
 * front door, where a hand-made crossing hands the camera to the doorway.
 */
const SWING_LEAD = 0.2;
function power2InOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
}
export function SWING(s: number): number {
  const x = Math.min(1, Math.max(0, s));
  return SWING_LEAD * x + (1 - SWING_LEAD) * power2InOut(x);
}

/**
 * Leg progress to "swing space", where the beats' `at` values live.
 *
 * ONE EASE PER CURVE, not one across the leg. The film keeps exactly the ease it
 * was approved with — the same curve, rescaled into FILM_SHARE — so every frame
 * of the first three chapters is the frame it was. The approach gets its own,
 * leaving the constellation from near rest: the camera settles onto the sphere
 * above the house, all but holds, and only then sets off for the door. (Not
 * from a dead stop — the pedestal keeps a slow drift through the join, for the
 * same reason it exists at the top of the page: a stretch of scroll that moves
 * nothing on screen reads as a broken page.)
 */
export function exteriorSwing(legProgress: number): number {
  const s = Math.min(1, Math.max(0, legProgress));
  if (s <= FILM_SHARE) return FILM_SHARE * SWING(s / FILM_SHARE);
  return FILM_SHARE + APPROACH_SPAN * SWING((s - FILM_SHARE) / APPROACH_SPAN);
}

/** Back from swing space to leg progress, on the film's second half (where
 *  the sweep is): the ease above, solved for x >= 0.5. */
function filmLegOf(swing: number): number {
  const s = Math.min(1, Math.max(0.5, swing / FILM_SHARE));
  const y = (-SWING_LEAD + Math.sqrt(SWING_LEAD * SWING_LEAD + 8 * (1 - SWING_LEAD) * (1 - s))) / (4 * (1 - SWING_LEAD));
  return FILM_SHARE * (1 - y);
}

/**
 * THE SWEEP'S PACE, which is not the film's ease's.
 *
 * Some two hundred metres from the three-quarter to the layout, where the
 * revolution flew forty, in the same stretch of the film's ease: read on its
 * beats as the rest of the film is, the camera would leave the three-quarter at
 * five times the speed it arrived at and whip round the house at 120 degrees a
 * viewport. So the sweep keeps its own clock:
 *
 *   BY ANGLE, NOT BY METRE. Its length is measured as the eye sees it, each
 *   metre of path divided by how far from the house it is flown, so the camera
 *   goes fast where it is far out and slowly where it is close: what turns on
 *   the screen is what is paced.
 *   ON THE PAGE, NOT ON THE EASE. Its progress is eased over the leg's own
 *   scroll, from the three-quarter's place on the page to the layout's, so the
 *   film's ease (which has all but finished by then) does not crowd it into
 *   the first viewport.
 *   AND JOINED. It leaves the three-quarter at the speed and on the line the
 *   revolution arrives at (the tangent through the quarter, the speed read off
 *   the film's curve), and settles onto the layout at a drift (SWEEP_ARRIVE),
 *   the speed the film's ease had at its end.
 *
 * MEASURED on the curves (cameraPath.test.ts): never more than 72 degrees of
 * turn a viewport of scroll, the approach's own 63 near enough.
 */
const SWEEP_TABLE = 2048;
/** How near the house a metre of the sweep is counted at, at most (metres). */
const SWEEP_NEAR = 20;
/** The drift it arrives at, in angle (radians) per unit of leg. */
const SWEEP_ARRIVE = 0.2;
const sweepFrom = filmLegOf(THREE_QUARTER.at);
const sweepSpan = FILM_SHARE - sweepFrom;
/** The sweep's length by angle, sampled along its curve from the three-quarter. */
const sweepLength = (() => {
  const out = new Float64Array(SWEEP_TABLE + 1);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  SWEEP_POSITION_CURVE.getPoint(SWEEP_FROM_U, a);
  for (let i = 1; i <= SWEEP_TABLE; i += 1) {
    SWEEP_POSITION_CURVE.getPoint(SWEEP_FROM_U + (1 - SWEEP_FROM_U) * (i / SWEEP_TABLE), b);
    const far = Math.max(SWEEP_NEAR, Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2 - SUBJECT[1], (a.z + b.z) / 2));
    out[i] = out[i - 1] + a.distanceTo(b) / far;
    a.copy(b);
  }
  return out;
})();
/** The angle a unit of leg turns as the sweep leaves the three-quarter: the
 *  revolution's own speed there, off the film's curve. */
const sweepLeave = (() => {
  const u = 2 / 3;
  const e = 1e-5;
  const p = FILM_POSITION_CURVE.getPoint(u);
  const metresPerSwing = p.distanceTo(FILM_POSITION_CURVE.getPoint(u - e)) / e / (3 * (THREE_QUARTER.at - QUARTER.at));
  const swingPerLeg = SWING_LEAD + (1 - SWING_LEAD) * 4 * (1 - sweepFrom / FILM_SHARE);
  return (metresPerSwing * swingPerLeg) / Math.max(SWEEP_NEAR, Math.hypot(p.x, p.y - SUBJECT[1], p.z));
})();

/** Where on the sweep's curves the camera is at this leg progress. */
function sweepU(leg: number): number {
  const t = Math.min(1, Math.max(0, (leg - sweepFrom) / sweepSpan));
  const t2 = t * t;
  const t3 = t2 * t;
  const total = sweepLength[SWEEP_TABLE];
  const s =
    (-2 * t3 + 3 * t2) * total + (t3 - 2 * t2 + t) * sweepLeave * sweepSpan + (t3 - t2) * SWEEP_ARRIVE * sweepSpan;
  let lo = 0;
  let hi = SWEEP_TABLE;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (sweepLength[m] < s) lo = m;
    else hi = m;
  }
  const k = (s - sweepLength[lo]) / Math.max(1e-12, sweepLength[hi] - sweepLength[lo]);
  return SWEEP_FROM_U + (1 - SWEEP_FROM_U) * ((lo + Math.min(1, Math.max(0, k))) / SWEEP_TABLE);
}

/**
 * Position and aim at a point in swing space. Picks the curve: the
 * revolution's to the three-quarter, the sweep's to the layout, the
 * approach's to the door. Where two meet, the pose is the same on both.
 */
export function exteriorPoseAtSwing(
  swing: number,
  outPosition: THREE.Vector3,
  outTarget: THREE.Vector3,
  /** How upright the frame is, 0..1 (phoneFraming.phoneWeight): an upright
   *  frame aims at the house at the layout (LAYOUT_UPRIGHT). */
  upright = 0,
): void {
  pose(swing, outPosition, outTarget);
  const k = Math.min(1, Math.max(0, upright)) * layoutUpright(swing);
  if (k > 0) outTarget.lerp(layoutUprightAim, k);
}

function pose(swing: number, outPosition: THREE.Vector3, outTarget: THREE.Vector3): void {
  if (swing <= THREE_QUARTER.at) {
    const u = curveTOver(REVOLUTION, swing);
    FILM_POSITION_CURVE.getPoint(u, outPosition);
    FILM_TARGET_CURVE.getPoint(u, outTarget);
  } else if (swing <= FILM_SHARE) {
    const u = sweepU(filmLegOf(swing));
    SWEEP_POSITION_CURVE.getPoint(u, outPosition);
    SWEEP_TARGET_CURVE.getPoint(u, outTarget);
  } else {
    const u = curveTOver(APPROACH_BEATS, swing);
    APPROACH_POSITION_CURVE.getPoint(u, outPosition);
    APPROACH_TARGET_CURVE.getPoint(u, outTarget);
  }
}

/** Where the camera stands, and what it looks at, for exterior leg progress. */
export function exteriorPoseAt(
  legProgress: number,
  outPosition: THREE.Vector3,
  outTarget: THREE.Vector3,
  upright = 0,
): void {
  exteriorPoseAtSwing(exteriorSwing(legProgress), outPosition, outTarget, upright);
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

/**
 * AN UPRIGHT SCREEN'S LENS, OUTSIDE.
 *
 * A perspective camera keeps its vertical field whatever the screen, so a
 * phone held upright sees the middle two-fifths of a landscape frame's width.
 * The paid audit's lenses (2026-10-04) are a landscape frame's: the cover on
 * 26 degrees is a slice of the west corner on a phone, twelve degrees across,
 * with the entrance it is a picture of out of the frame; and the revolution's
 * two beats, taken in from 56 and 52 to 48 and 46, are tighter there than the
 * frames a phone's copy was set against.
 *
 * So on an upright screen the lens opens (`widen` multiplies the tangent of
 * the half-angle, as phoneFraming's does indoors) and the aim's offset comes
 * in (`offset` multiplies the beat's frameOffset): at the cover, wide enough
 * to hold the whole front with the house nearly centred under the sky the
 * copy stands in; at the revolution's beats, back to exactly the lens they
 * had (tan 28 / tan 24, tan 26 / tan 23). Linear between beats, as the lens
 * is; a beat not listed is as it stands.
 *
 * THE COVER ON A PHONE, WHOLE (the forensic audit of 2026-10-09, #114: "The
 * house is cut by the right edge of the screen: its right wing and part of
 * the portico are out of frame ... Expected: the whole front in frame"). At
 * 1.75, with a fifth of the wide frame's offset, a 390x844 screen lost the
 * front's last bay and its corner. Tried on the running build at 390x844: the
 * aim's offset all the way in (0) and the lens a little wider (1.9) hold the
 * front from corner to corner, the copy over it where it was. A tablet held
 * upright already held the whole front at the old lens, and keeps it
 * (UPRIGHT_TABLET_LENS).
 */
export const UPRIGHT_LENS: Readonly<Record<string, { widen: number; offset: number }>> = {
  hero: { widen: 1.9, offset: 0 },
  quarter: { widen: 1.194, offset: 1 },
  'three-quarter': { widen: 1.149, offset: 1 },
  // the house, its pool and the avenue's head across a phone's width, under
  // the chapter's words (LAYOUT_UPRIGHT)
  layout: { widen: 1.35, offset: 1 },
};

/** A tablet held upright's cover: the paid audit's upright lens, which holds
 *  the whole front on a frame half as wide again for its height (seen at
 *  820x1180). Between a phone's width and a tablet's, mixed (`uprightTablet`). */
export const UPRIGHT_TABLET_LENS: Readonly<Record<string, { widen: number; offset: number }>> = {
  hero: { widen: 1.75, offset: 0.2 },
};

/** How much of a tablet's upright lens a screen this wide (CSS px) takes: the
 *  same widths as the hall's (phoneFraming.tabletWeight). */
export function uprightTablet(width: number): number {
  const t = Math.min(1, Math.max(0, (width - 640) / 100));
  return t * t * (3 - 2 * t);
}

const UPRIGHT_NONE = { widen: 1, offset: 1 } as const;

/** Look-dev (?debug=1): a beat's upright lens tried on the running build before
 *  it is written into UPRIGHT_LENS (`upright:<beat>:widen`, `:offset`). */
function uprightOf(id: string, width: number): { widen: number; offset: number } {
  const phone = UPRIGHT_LENS[id] ?? UPRIGHT_NONE;
  const tab = UPRIGHT_TABLET_LENS[id];
  const t = tab ? uprightTablet(width) : 0;
  const u =
    t <= 0
      ? phone
      : { widen: phone.widen + (tab.widen - phone.widen) * t, offset: phone.offset + (tab.offset - phone.offset) * t };
  if (!lookdevOn()) return u;
  return { widen: ld(`upright:${id}:widen`, u.widen), offset: ld(`upright:${id}:offset`, u.offset) };
}

/** An upright screen's lens at this much of the exterior leg, on a screen
 *  `width` CSS px wide (a phone's, unless it is wide enough to be a tablet's). */
export function uprightLensAt(scroll: number, width = 0): { widen: number; offset: number } {
  const s = Math.min(1, Math.max(0, scroll));
  for (let i = 0; i < BEATS.length - 1; i += 1) {
    const a = BEATS[i];
    const b = BEATS[i + 1];
    if (s <= b.at) {
      const k = b.at === a.at ? 0 : (s - a.at) / (b.at - a.at);
      const ua = uprightOf(a.id, width);
      const ub = uprightOf(b.id, width);
      return { widen: ua.widen + (ub.widen - ua.widen) * k, offset: ua.offset + (ub.offset - ua.offset) * k };
    }
  }
  return { widen: 1, offset: 1 };
}

export function atmosphereAt(scroll: number): {
  near: number;
  far: number;
  key: number;
  evening: number;
} {
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
        evening: twilightAt(s),
      };
    }
  }
  const last = BEATS[BEATS.length - 1];
  return { near: last.fog[0], far: last.fog[1], key: last.keyIntensity, evening: twilightAt(s) };
}
