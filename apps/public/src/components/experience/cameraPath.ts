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
  /**
   * How far into evening this beat is, 0..1. Optional; absent means 0.
   *
   * WHY THE FILM CHANGES TIME OF DAY, AND WHY THAT IS NOT "DARKEN EVERYTHING"
   *
   * The exterior ships a DAYLIGHT grade fitted to the hero. The interior it
   * cuts to is a candlelit hall — wall sconces with visible flames, and a
   * lightmap baked for lamplight. So the film already crossed from noon to
   * night; the veil was hiding that cut rather than motivating it.
   *
   * Letting evening fall across the last exterior chapter motivates it, and
   * pays for itself twice. The constellation is ADDITIVE light, and additive
   * light over a sunlit equirect sky is invisible by construction: the shipped
   * frame put a 12m sphere over a bright cloud bank and the sphere read as
   * dust. Against a falling sky it reads as light, with no change to the
   * shader at all.
   *
   * It is ZERO for the hero, the quarter and the three-quarter, so every frame
   * the Phase 5 grade was fitted against is untouched.
   */
  evening?: number;
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
export const FILM_SHARE = 0.625;

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
    id: 'crane',
    // THE CRANE, which replaces what used to be THE TURN AWAY.
    //
    // The old beat swung the aim off the building and out into empty field, so
    // that by 0.82 the estate was already gone. This one keeps the building and
    // climbs: the camera rises from 8.4m to 15m while retreating from -19 to
    // -32, and the aim lifts from the mansion's centroid toward its roofline.
    // The move reads as pulling back to see what the house belongs to, which is
    // the sentence the chapter has to say.
    at: 0.82 * FILM_SHARE,
    position: grow([-21.0, 15.0, -32.0]),
    // The aim was 16 m up, for a house that rose 20 m to the tip of its spire.
    // The roof is flat now (the client, 2026-10-01) and the house ends at its
    // parapet's urns, 12.5 m up; the aim comes down 4 m with it, here and at
    // the holdings beat, so the house holds the place in the frame it held.
    target: [0.0, ROOFLINE_AIM, 0.0],
    fog: growFog([30, 165]),
    keyIntensity: 2.4,
    fov: 44,
    roll: -0.02,
    frameOffset: 4.6 * ESTATE_SCALE,
    // EVENING IS COMPLETE HERE, not at the last beat — the light changes DURING
    // the crane and has finished by the time the camera settles.
    //
    // Putting the 1 on the final beat instead was measured and was wrong for the
    // same structural reason the constellation's own reveal curve was wrong:
    // `at: 1.0` is the END of the leg, which is document scroll 0.46, which is
    // the middle of the crossover veil. The held frame of the chapter sits at
    // legProgress 0.81, and with the 1 on the last beat that frame photographed
    // at evening 0.72 — sky mean 75.4 where the fully fallen frame reads 58.7.
    // The chapter would have spent its whole held moment on the way to a look
    // it only reached behind a black screen.
    evening: 1,
  },
  {
    id: 'holdings',
    // HOLDINGS (the constellation's chapter until the second art-direction
    // audit removed the sphere). The rear three-quarter, craned high and far
    // out, holding the estate low-right with its parapet against the evening
    // land and the land beside it gone dark — the quiet ground the figures sit
    // on.
    //
    // The aim came DOWN 5.8 m with the sphere: it was lifted to leave room above
    // the spire for the ball, and with the ball gone that room was sky with
    // nothing in it and the house pushed into the foot of the frame.
    //
    // No longer the end of the leg: the approach to the door follows it. It is
    // still where the camera slows almost to rest, which is what makes it the
    // held frame of its chapter.
    at: FILM_SHARE,
    position: grow([-24.0, 18.0, -42.0]),
    // (And down again with the flat roof: see the crane, above.)
    target: [0.0, ROOFLINE_AIM, 0.0],
    // Fog is doing MORE work here than anywhere else on the path, not less. The
    // authored terrain stops dead at +/-120m, and from this vantage the far edge
    // is 149m away and lands at y 453 — a hard line straight across the frame,
    // the single artefact that most reads as a diorama on a table. 60..150
    // takes that edge to 89% haze while leaving the building, whose nearest
    // corner is 39.8m from the eye, completely untouched.
    fog: growFog([60, 150]),
    keyIntensity: 2.6,
    fov: 37,
    roll: 0.0,
    // Held open: the house sits in the right of frame, the figures in the
    // dark land to its left.
    frameOffset: 3.6 * ESTATE_SCALE,
    // Held, not still climbing. See the note on the beat above.
    evening: 1,
  },
];

/**
 * THE APPROACH — from the constellation down to the front door, as night falls.
 *
 * WHY THE LEFT FLANK, AND WHY THAT IS NOT A REWIND. The obvious route is on
 * round the right side, closing the circle. Measured on the curves, it is 122 m
 * and 210 degrees of azimuth from the constellation to the door, which at any
 * page length the film can afford sweeps the house twice as fast as the orbit it
 * follows. Back down the left is 99 m and 150 degrees. And it does not read as
 * the revolution played backwards, for two reasons the frame makes obvious: the
 * revolution flew that flank at noon and nine metres up, and this passes it at
 * dusk with every window lit, lower and wider; and it ends somewhere the
 * revolution never went — on the axis, at the door. The film opens on the front
 * of the house in daylight and comes back to it at night to go inside.
 *
 * GEOMETRY. Clearances are in cameraPath.test.ts against the same hulls as the
 * rest of the path; the tightest is 3.0 m, over the left cypress line at the
 * forecourt beat. The last two beats are ON the entry axis (x = 0), so the final
 * stretch is a straight push toward the door rather than a slide onto it —
 * which matters, because the doorway move continues that push.
 *
 * AT VALUES are on the whole exterior leg. The first entry is the constellation
 * beat itself: this curve starts where the film's ends.
 */
const APPROACH_SPAN = 1 - FILM_SHARE;

export const APPROACH_BEATS: readonly CameraBeat[] = [
  FILM_BEATS[FILM_BEATS.length - 1],
  {
    id: 'dusk-flank',
    // Down off the crane and out along the left flank, wider than the
    // revolution flew it and three metres lower. The aim drops from the roofline
    // to the first floor as the camera does, so the house comes back into the
    // middle of frame and the sphere rides up out of the top of it.
    at: FILM_SHARE + APPROACH_SPAN * 0.33,
    // V7: pulled in to x -46, 19 m up. Grown straight it stood at x -57.6, 20 m
    // up, inside the rain trees planted along the compound wall.
    position: [-45.7, 18.5, -12.9],
    target: grow([0.0, 6.4, 0.0]),
    fog: growFog([40, 160]),
    keyIntensity: 2.5,
    fov: 46,
    // Banking the OTHER way from the revolution: this turn runs the opposite
    // direction round the house.
    roll: 0.035,
    frameOffset: 2.4 * ESTATE_SCALE,
    evening: 1,
  },
  {
    id: 'forecourt',
    // Round the front-left corner above the hedge line, the lit facade raking
    // away to the right. 8.2 m clears the 5.4 m cypresses by 2.8 m.
    at: FILM_SHARE + APPROACH_SPAN * 0.64,
    // V7: round the front-left corner of the podium and into the forecourt
    // between the house and the ring of palms, which is planted only on the
    // fountain's far side, so the camera comes onto the axis inside the ring
    // rather than through it. The lit front rakes away to the right.
    //
    // LOWER, FURTHER OUT AND ON A LONGER LENS (the refinement brief,
    // 2026-10-04: "avoid camera distances that expose the limitations of the
    // model without providing photographic intimacy"). It stood at
    // [-11.8, 14.5, 20.5] aiming at [0, 4.5, 7.2] on 45 degrees: 20 m from the
    // corner and two and a half metres over the parapet, looking down — and a
    // third of the frame was the flat roof, the one plane of the house with
    // nothing on it, at the distance that shows it best. Under the parapet
    // (12.5 m) the roof is behind its balustrade; 27 m out on 41 degrees the
    // lit front is a three-quarter elevation against the evening sky, which
    // is the photograph a house like this is sold by.
    position: [-15.0, 10.6, 25.5],
    target: [0.0, 5.4, 7.2],
    fog: growFog([32, 150]),
    keyIntensity: 2.45,
    fov: 41,
    roll: 0.025,
    frameOffset: 1.4 * ESTATE_SCALE,
    evening: 1,
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
    evening: 1,
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
    evening: 1,
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
    evening: 1,
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

/** The approved film: hero, revolution, crane, constellation. */
export const FILM_POSITION_CURVE = curveThrough(FILM_BEATS.map((b) => b.position));
export const FILM_TARGET_CURVE = curveThrough(FILM_BEATS.map((b) => b.target));
/** The approach, from the constellation to the front door. */
export const APPROACH_POSITION_CURVE = curveThrough(APPROACH_BEATS.map((b) => b.position));
/**
 * THE APPROACH'S AIM IS DRAWN FROM WHERE IT WAS DRAWN: 16 m up at the holdings
 * beat. A Catmull-Rom segment is shaped by the point before it, so bringing
 * that beat's aim down for the flat roof (ROOFLINE_AIM) re-shaped the whole
 * stretch from the flank to the forecourt as well — measured, the picture 12
 * px lower at leg 0.8, which stood the approach's eyebrow on a lit window
 * (its ground from a p90 luma of 73 to 142). The curve keeps its old first
 * point, so every frame from the flank beat to the door is the frame it was;
 * the difference is taken up across the first segment alone (see
 * exteriorPoseAtSwing), where the camera is leaving the holdings beat anyway.
 */
export const APPROACH_AIM_FROM = 16.0;
export const APPROACH_TARGET_CURVE = curveThrough(
  APPROACH_BEATS.map((b, i) => (i === 0 ? [b.target[0], APPROACH_AIM_FROM, b.target[2]] : b.target)),
);
/**
 * AND AN UPRIGHT SCREEN KEEPS THE OLD AIM ALTOGETHER. The lowered aim is a
 * wide frame's composition: there the copy stands beside the house, and the
 * house wants the middle of the frame. On a phone the copy stands ABOVE the
 * house, and lifting the house 8% of the frame put the holdings' gloss across
 * its lit first-floor windows (seen at 390x844). So an upright frame aims
 * where it always did — the film's curve with the crane and the holdings at
 * 16 m — and every phone frame is the frame that was checked.
 */
const FILM_TARGET_CURVE_UPRIGHT = curveThrough(
  FILM_BEATS.map((b) => (b.id === 'crane' || b.id === 'holdings' ? [b.target[0], APPROACH_AIM_FROM, b.target[2]] : b.target)),
);
const uprightAim = new THREE.Vector3();

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

/**
 * Position and aim at a point in swing space. Picks the curve; the constellation
 * beat, where they meet, is the same point on both.
 */
export function exteriorPoseAtSwing(
  swing: number,
  outPosition: THREE.Vector3,
  outTarget: THREE.Vector3,
  /** How upright the frame is, 0..1 (phoneFraming.phoneWeight): an upright
   *  frame keeps the aim it had before the roof was made flat. */
  upright = 0,
): void {
  if (swing <= FILM_SHARE) {
    const u = curveTOver(FILM_BEATS, swing);
    FILM_POSITION_CURVE.getPoint(u, outPosition);
    FILM_TARGET_CURVE.getPoint(u, outTarget);
    if (upright > 0) outTarget.lerp(FILM_TARGET_CURVE_UPRIGHT.getPoint(u, uprightAim), Math.min(1, upright));
  } else {
    const u = curveTOver(APPROACH_BEATS, swing);
    APPROACH_POSITION_CURVE.getPoint(u, outPosition);
    APPROACH_TARGET_CURVE.getPoint(u, outTarget);
    // The aim leaves the holdings beat from where the flat roof put it and is
    // back on the approach's own curve by the flank beat (APPROACH_AIM_FROM):
    // the whole difference at the join, none of it by the first beat, and no
    // slope at either end.
    const k = Math.min(1, u * (APPROACH_BEATS.length - 1));
    const w = 1 - k * k * k * (k * (k * 6 - 15) + 10);
    outTarget.y += (ROOFLINE_AIM - APPROACH_AIM_FROM) * w * (1 - Math.min(1, Math.max(0, upright)));
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
 */
export const UPRIGHT_LENS: Readonly<Record<string, { widen: number; offset: number }>> = {
  hero: { widen: 1.75, offset: 0.2 },
  quarter: { widen: 1.194, offset: 1 },
  'three-quarter': { widen: 1.149, offset: 1 },
};

const UPRIGHT_NONE = { widen: 1, offset: 1 } as const;

export function uprightLensAt(scroll: number): { widen: number; offset: number } {
  const s = Math.min(1, Math.max(0, scroll));
  for (let i = 0; i < BEATS.length - 1; i += 1) {
    const a = BEATS[i];
    const b = BEATS[i + 1];
    if (s <= b.at) {
      const k = b.at === a.at ? 0 : (s - a.at) / (b.at - a.at);
      const ua = UPRIGHT_LENS[a.id] ?? UPRIGHT_NONE;
      const ub = UPRIGHT_LENS[b.id] ?? UPRIGHT_NONE;
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
      const ea = a.evening ?? 0;
      const eb = b.evening ?? 0;
      return {
        near: a.fog[0] + (b.fog[0] - a.fog[0]) * k,
        far: a.fog[1] + (b.fog[1] - a.fog[1]) * k,
        key: a.keyIntensity + (b.keyIntensity - a.keyIntensity) * k,
        evening: ea + (eb - ea) * k,
      };
    }
  }
  const last = BEATS[BEATS.length - 1];
  return { near: last.fog[0], far: last.fog[1], key: last.keyIntensity,
           evening: last.evening ?? 0 };
}
