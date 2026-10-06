// apps/public/src/components/experience/doorway.ts
//
// THE DOORWAY — how the film goes through the front door.
//
// WHAT THE FIRST CLIENT REVIEW REJECTED. The exterior used to end on the
// constellation, forty-eight metres behind the house and eighteen up, and a
// black veil closed over that frame while the models swapped. The review: the
// transition "must open from the actual door", with "acceleration and
// calculated deceleration", so the visitor feels "he is entering a new world".
// So the exterior film ends square on the front door (cameraPath.ts, the
// approach), and this module takes the camera through it.
//
// WHAT THE FOURTH ART-DIRECTION CRITIQUE (2026-09-30) REJECTED, AND WHAT THE
// PASSAGE IS NOW. The doorway used to pour light: a panel of unlit white behind
// the leaves, then a white DOM layer over the whole frame at the swap. The
// critique: "a harsh, blinding white flash ... like a stock video transition
// masking a loading state", and its premium version, word for word: "The camera
// pushes into the actual dark threshold of the door, using depth-of-field and
// exposure adjustments (like a real camera iris adjusting to indoors) to reveal
// the interior smoothly." And its principle: if a cinematographer could not do
// it practically, do not force it digitally. A white-out cannot be shot; a dark
// doorway can. So:
//
//   1. the two door leaves swing inward onto the house's unlit vestibule — dark,
//      with only a far glimmer in it (DoorwayRig);
//   2. the camera ACCELERATES down its own view axis, over the fountain and
//      into the doorway, the lens holding focus on the door frame so the dark
//      beyond it is soft, and widening a little as it reaches the door;
//   3. the vestibule's dark fills the frame — the camera is inside the
//      threshold — and in that dark the models swap. A near-black DOM layer
//      covers exactly the frames the render is already black on, so the swap
//      is never a visible frame even if the hall's first draw stalls;
//   4. inside, the camera is still moving and the exposure is where the night
//      outside left it — five stops too dark for the room. It DECELERATES onto
//      the threshold frame while the iris opens: the windows and the chandelier
//      come up first, then the walls, as an eye adjusts on walking indoors, and
//      the focus racks from the door at its back out to the far wall.
//
// Scrolling back up plays the same passage the other way, shorter: the camera
// backs toward the doors as the room goes dark round it, and outside the
// exposure opens onto the night as the leaves close in front of it.
//
// WHY IT IS TIMED AND NOT SCRUBBED. Everything else in the film is bound to the
// scroll position, and this is the one move that must not be. An acceleration
// is a shape in TIME; tied to a wheel it becomes whatever the visitor's hand
// did, and a visitor who stops halfway is left standing in the dark. So a
// crossing made by hand starts a fixed, authored move, the page holds still for
// it, and it hands back to the scroll-driven camera at exactly the pose the
// scroll would have produced.
//
// WHAT IS NOT ANIMATED. A crossing the visitor did not make by hand — a deep
// link, a chapter address, a test harness jumping the scroll — is a cut: the
// camera is placed rather than flown (flying would carry it through the walls
// of two models), under a brief dip from black. Reduced motion keeps the
// scrubbed veil it always had.
//
// THE REFINEMENT BRIEF (2026-10-03), AND THE PASSAGE INWARD AS IT IS NOW. Two
// audits, one sentence: "the current black-void transition should be replaced
// with a continuous physical/cinematic entry through the architecture"; "avoid
// anything that makes the user think a new 3D scene is loading". The dark
// threshold was a cut with a reason, and it was still a cut. The hall has
// always stood where a hall would: its front wall half a metre behind the
// exterior's door leaves, on the same axis, its floor 55 cm under the door's
// sill (the two models were laid out to one origin). So going in is now ONE
// MOVE THROUGH ('through', below):
//
//   1. the leaves open, and what stands behind them is the hall itself, lit —
//      drawn through the doorway from where it is (HallPortal: the room is
//      rendered from the camera's own eye into a buffer, and the opening shows
//      that buffer), not a card of dark;
//   2. the camera makes one eased move down its axis, over the fountain,
//      through the opening and on to the threshold frame: it is slowing as it
//      crosses the sill, at a walking pace, and comes to rest a second later.
//      No rush, no widening lens beyond what the room wants, no dark;
//   3. once the opening fills the frame the sets change behind it — the frame
//      before and the frame after are the same picture — and the print, which
//      has been easing from the night's grade to the room's as the camera
//      closed on the door, is the room's by then.
//
// The dark threshold remains as the fallback ('threshold'): a phone on the low
// tier, a hall that has not finished loading when the visitor reaches the door,
// and the way OUT, which is a return and keeps its shorter ceremony.
//
// Module-level state, for the reason journeyState and diveState are: this
// changes every frame during the move, and it is read inside useFrame by the
// rig, the door leaves, the lens and the print.

import { CROSSOVER, DOOR_IN, DOOR_OUT } from './journey';

export type DoorwayDirection = 'enter' | 'exit';
type Vec3 = [number, number, number];

/** Length of the passage inward. Long enough to be a passage, and for an eye
 *  to adjust; short enough that a visitor who has decided to go in is not made
 *  to wait. */
export const ENTER_MS = 3000;
/** Backing out is a return, not an arrival, and gets less ceremony. */
export const EXIT_MS = 2200;

/**
 * The passage inward, on a 0..1 clock. Every threshold is a fraction of
 * ENTER_MS so the choreography scales as one piece.
 */
export const ENTER = {
  /** The leaves part before the camera moves: the door opens for you. */
  doorsTo: 0.3,
  /** The acceleration, from rest to the far side of the door plane. */
  moveFrom: 0.07,
  moveTo: 0.5,
  aimTo: 0.36,
  /**
   * The lens widens only in the last stretch of the rush.
   *
   * MEASURED IN THE BROWSER, the first version widened it across the whole
   * move, and the first half of the passage read as the camera PULLING BACK:
   * an ease-in covers almost no distance early, so a lens widening from the
   * start shrinks the door faster than the travel grows it. The door's size on
   * screen goes as 1 / (distance x tan(fov / 2)); starting the warp once the
   * camera is within eight metres keeps that product falling at every frame
   * (asserted in doorway.test.ts), so the door only ever grows.
   */
  warpFrom: 0.415,
  /** The lens finds the door frame as the camera sets off, and holds it. */
  focusFrom: 0.1,
  focusTo: 0.42,
  /** The vestibule's dark covers the frame, from the doorway outward. */
  darkFrom: 0.43,
  darkTo: 0.5,
  /** Model swap and scroll landing, in the dark. */
  swap: 0.52,
  /** The dark layer lifts while the room is still five stops under — so what
   *  it uncovers is the render's own dark, not the room. */
  clearFrom: 0.54,
  clearTo: 0.66,
  /** The iris opens: the room comes up from the dark. */
  irisFrom: 0.54,
  irisTo: 0.95,
  /** And the focus racks from the door behind the camera to the far wall. */
  rackFrom: 0.56,
  rackTo: 0.93,
  /** The page accepts scrolling again. */
  release: 0.9,
} as const;

/** How a passage is made: one move through the open door onto the lit hall,
 *  or the dark threshold that covers a swap. */
export type DoorwayStyle = 'through' | 'threshold';

/** Length of the continuous passage inward. Longer than the threshold's: it
 *  is a walk in, not a rush at a dark doorway, and every frame of it is seen. */
export const THROUGH_MS = 4600;

/**
 * The continuous passage inward, on a 0..1 clock.
 *
 * ONE EASE OVER THE WHOLE DISTANCE. The camera's travel is a single
 * ease-in-out from where it stood to the threshold frame inside, and the door
 * is `doorShare` of the way along it (26.4 m of 27.2: the forecourt, then
 * eighty centimetres of hall). So the sill is crossed late in the ease-out,
 * slowing — measured in doorThrough.test.ts: about three metres a second — and
 * the sets change at that moment, with the opening filling the frame. A SINE,
 * not the cubic the rush used: over this distance a cubic's middle is seventy
 * kilometres an hour, and a sine's is half that — a dolly on a long track.
 */
export const THROUGH = {
  /** The leaves part first, onto the lit hall. */
  doorsTo: 0.24,
  moveFrom: 0.05,
  /** The share of the move that lies outside the door plane. */
  doorShare: 0.9705,
  aimTo: 0.5,
  /** The lens opens toward the room's own over the last of the approach, as a
   *  fraction of the travel OUTSIDE (so the door never shrinks: see ENTER). */
  lensFrom: 0.72,
  /** The print eases from the night's grade to the hall's, over the same. */
  gradeFrom: 0.8,
  gradeTo: 0.985,
  /** The lens at the sill, degrees: between the door beat's 30 and the room's. */
  sillFov: 46,
  /** How soft the far land goes while the lens holds the door (0..1). */
  defocus: 0.3,
  release: 0.9,
} as const;

/**
 * THE WAY OUT, BY THE SAME DOOR (the refinement brief, 2026-10-04: "Transitions
 * should feel continuous. Avoid anything that makes the user think a new 3D
 * scene is loading" — and the way out still went by the dark). The continuous
 * passage, run backwards: the camera backs out of the room along the line it
 * came in by, the sets change as it crosses the sill with the opening still
 * filling the frame, the hall stays where it is behind the open leaves
 * (HallPortal), and the leaves close on it as the camera comes to rest on the
 * forecourt. Every frame of it is a frame of the way in. Shorter than the way
 * in: a visitor leaving has seen the walk.
 */
export const THROUGH_OUT_MS = 3800;

/** The passage outward, by the dark threshold (a low-tier device, an estate
 *  not yet drawn, `?door=threshold`). */
export const EXIT = {
  moveTo: 0.45,
  aimTo: 0.3,
  /** Backing out, the widening is what sells the speed; the doorway is behind
   *  the camera, so there is no subject for it to shrink. */
  warpFrom: 0.1,
  /** The room goes dark round the camera as it backs into the threshold. */
  dimFrom: 0.08,
  dimTo: 0.42,
  darkFrom: 0.36,
  darkTo: 0.44,
  swap: 0.47,
  clearFrom: 0.49,
  clearTo: 0.6,
  irisFrom: 0.49,
  irisTo: 0.92,
  rackFrom: 0.5,
  rackTo: 0.88,
  doorsCloseFrom: 0.55,
  doorsCloseTo: 1.0,
  release: 0.9,
} as const;

/**
 * The fixed points of the move, each in the coordinates of the model it
 * belongs to. The live ends — where the camera was when the move began, and
 * where the scroll says it should be when the move ends — come from the rig.
 *
 * Measured from the shipped GLBs (exterior: estateBounds.ts, generated from
 * exterior_estate_v7.glb; hall: a live-scene bounds dump):
 *
 *   exterior  mansion_doors  x -1.35..1.35  y 0.55..3.95  z 8.17..8.25
 *             door_relief                                 z 8.25..8.31
 *             door surround  x +/-1.30..1.59 (frontispiece face z 8.40)
 *             portico        entablature underside y 4.40, z 8.40..11.25;
 *                            inner columns x +/-1.29..2.21 at z 10.39..11.31
 *             fountain       y 0..3.38 over z 26.05..33.95
 *   hall      int_doors      x -1.50..1.50  y 0..4.26     z 7.57..7.69
 *             int_wall_front                              z 7.70..8.00
 */
export const DOORWAY = {
  /** Exterior: where the camera is when the frame is fully dark — through the
   *  opening and 0.66 m past the door plane, still 0.8 m short of the
   *  vestibule panel behind it (the near plane outside is 0.5 m). */
  exteriorPass: [0, 2.2, 7.5] as Vec3,
  /** Straight in through the door, level. */
  exteriorGaze: [0, 2.15, -21] as Vec3,
  /** Hall: where the camera is at the swap — INSIDE the room, a pace in from
   *  the doors at its back (int_doors z 7.57), on the axis. The white passage
   *  started this outside the front wall and needed a hole cut in it to fly
   *  through; in the dark there is nothing to fly through for, and the camera
   *  simply is in the room when the eye begins to adjust. */
  hallStart: [0, 1.72, 7.3] as Vec3,
  hallGaze: [0, 1.9, -24] as Vec3,
  /** Exit, near side: backed up to the same place, in the dark. */
  hallPass: [0, 1.72, 7.3] as Vec3,
  /** Exit, far side: just outside the front doors, under the portico and short
   *  of its inner columns, at a height whose line back to the door beat passes
   *  under the entablature and over the fountain (doorway.test.ts). */
  exteriorStart: [0, 2.4, 9.6] as Vec3,
  /** The lens at full rush. Wide enough that the door frame streams past the
   *  edges of the image; not so wide that the hall arrives as a fisheye. */
  warpFov: 66,
  /** How far the leaves swing, radians. Short of 90 so they read as opened
   *  doors rather than as panels folded flat against the reveal. */
  leafSwing: 1.45,
  /** The exposure the room is first seen at, as a multiplier: 2^-5.3, five
   *  and a third stops under — what a lens metered for the night forecourt
   *  makes of a lamplit hall before its iris opens. */
  exposureFloor: 1 / 40,
  /** Where the focus rack starts and ends, metres: the door frame at the
   *  camera's back, then the far wall of the room. */
  rackNear: 0.8,
  rackFar: 40,
  /** The door plane outside (mansion_doors' outer face), which the lens holds
   *  while the camera rushes it. */
  doorPlaneZ: 8.25,
} as const;

/**
 * THE DOOR STANDS OPEN BEFORE ANYONE WALKS THROUGH IT (the audit of 2026-10-05,
 * P1: "'The door is open.' appears while the door is visibly shut; it opens
 * only after the text has faded. Done when the door opens while the line is on
 * screen").
 *
 * The leaves used to part as the first act of the passage, and the passage
 * takes the copy off the picture as it begins (globals.css): the line said
 * the door was open over a shut door, and the door opened once the line had
 * gone. Now the leaves answer to the scroll over the last of the approach:
 * they begin to swing as the camera comes onto the door's axis — its line is
 * already up (journey.ts, COPY_SPAN) — and stand open, onto the lit hall
 * behind them (HallPortal), before the camera is square on the door, with the
 * line still on the picture. Scrolling back closes them. The passage then
 * starts from an open door and only has to walk through it.
 *
 * The camera does not stop for it (the client, 2026-10-06: the path is the
 * continuous one): `from` and `to` are places on the exterior leg, where the
 * camera turns onto the axis and where it has all but arrived.
 */
export const DOOR_AJAR = { from: 0.92, to: 0.985 } as const;

/** How far the leaves stand open, 0..1, at this place on the exterior leg. */
export function doorAjar(legProgress: number): number {
  const t = clamp01((legProgress - DOOR_AJAR.from) / (DOOR_AJAR.to - DOOR_AJAR.from));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** The layer that covers the swap. The vestibule's own near-black, a breath
 *  warm, so a frame that shows it and a frame of the render's dark doorway are
 *  the same frame. */
export const THRESHOLD_DARK = '#040405';

/** How recently the visitor must have scrolled by hand for a crossing to count
 *  as theirs. Lenis keeps easing for most of a second after the last wheel
 *  event, so this is comfortably longer than that tail. */
export const INPUT_WINDOW_MS = 1500;

/** Both ends of a hand-made crossing must be this close to the doorway band,
 *  in track progress. A keyboard End from the forecourt is a jump, not a step
 *  through a doorway. */
export const DOOR_ZONE = 0.05;

/** How far outside the doorway band the page is held and landed. Small: the
 *  held frame outside is the door and the landing inside is the threshold, and
 *  both are the ends of their legs — and their chapters' panes are pinned
 *  there (journey.ts, DOOR_BAND). */
export const EDGE = 0.0006;

/** If the hall has not finished loading when the dark is full, the dark holds
 *  — for at most this long, after which the passage completes regardless. */
export const MAX_HOLD_MS = 12_000;

/** A programmatic crossing's dip from black. */
export const CUT_MS = 420;

/**
 * Frames the far model must have been ON SCREEN, under the dark, before the
 * dark may begin to lift.
 *
 * MEASURED (with the white this replaced), on a machine rendering the scene at
 * under two frames a second: the clock ran from the peak straight past the
 * clearing in one frame, and the first clear frame showed the EXTERIOR model
 * around a camera already standing in hall coordinates. The swap is a React
 * commit, and a commit lands a frame or more after the scroll that asks for
 * it; on a phone that frame is also the one that compiles the hall's shaders.
 * So the dark holds, with the clock stopped at the peak, until the scene
 * reports the far model and has drawn it twice.
 */
export const FAR_FRAMES = 2;

/** A scene that never reports the swap must not strand a visitor in the dark. */
export const MAX_FAR_WAIT_MS = 1500;

// ── easing ──────────────────────────────────────────────────────────────────

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const inQuad = (t: number) => t * t;
const inCubic = (t: number) => t * t * t;
const outCubic = (t: number) => 1 - (1 - t) ** 3;
const outQuart = (t: number) => 1 - (1 - t) ** 4;
const inOutSine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Stops under at the floor (negative): the iris works in stops, so the room
 *  comes up at an even perceptual pace rather than all at the end. */
const FLOOR_STOPS = Math.log2(DOORWAY.exposureFloor);

/** The clock at which the continuous passage crosses the door plane: where its
 *  ease reaches THROUGH.doorShare (inOutSine, inverted). */
export const THROUGH_SWAP =
  THROUGH.moveFrom + ((1 - THROUGH.moveFrom) * Math.acos(1 - 2 * THROUGH.doorShare)) / Math.PI;

/**
 * The hall, in the exterior's coordinates: the two models share an origin and
 * an axis, and the hall's floor lies this far under the exterior's door sill
 * (exterior mansion_doors y 0.55.., hall int_doors y 0..). A pose in the hall
 * is the same eye in the exterior's space plus this.
 */
export const HALL_IN_EXTERIOR: Vec3 = [0, 0.55, 0];

// ── channels ────────────────────────────────────────────────────────────────

/**
 * Everything the passage drives, at one instant. Plain numbers so a reader in
 * the frame loop pays for nothing but a property read.
 */
export interface DoorwayChannels {
  /** Which model the camera is in: 'near' before the swap, 'far' after. */
  side: 'near' | 'far';
  /** Near side: 0..1 travel from where the camera was toward the pass point. */
  leave: number;
  /** Near side: 0..1 swing of the aim onto the doorway axis. */
  aim: number;
  /** Far side: 0..1 travel from the start point onto the live scroll pose. */
  arrive: number;
  /** Far side: 0..1 settle of the aim onto the live scroll aim. */
  settle: number;
  /** 0..1 lens warp toward DOORWAY.warpFov. */
  warp: number;
  /** 0..1 coverage of the threshold's dark layer (THRESHOLD_DARK). */
  dark: number;
  /** Exposure multiplier on the print, 1 at rest (passageLight, FilmGrade). */
  exposure: number;
  /** 0..1 how far the lens is thrown out of focus beyond `focus`. */
  defocus: number;
  /** Where the lens is focused, metres; 0 means "on the door plane". */
  focus: number;
  /** 0..1 how far the exterior door leaves are open. */
  exteriorDoors: number;
  /** 0..1 presence of the dark vestibule behind the leaves. */
  vestibule: number;
  /** 0..1 the hall itself behind the leaves, drawn through the doorway
   *  (HallPortal). The continuous passage only. */
  portal: number;
  /** 0..1 how far the print has gone from the night's grade to the hall's
   *  (passageLight.grade, FilmGrade). The continuous passage only. */
  grade: number;
}

export function restingChannels(): DoorwayChannels {
  return {
    side: 'near',
    leave: 0,
    aim: 0,
    arrive: 0,
    settle: 0,
    warp: 0,
    dark: 0,
    exposure: 1,
    defocus: 0,
    focus: 0,
    exteriorDoors: 0,
    vestibule: 0,
    portal: 0,
    grade: 0,
  };
}

/** The far side's shared shape: the dark lifts, the iris opens, the focus
 *  racks out, whichever way the camera came. */
function farSide(
  t: number,
  T: { clearFrom: number; clearTo: number; irisFrom: number; irisTo: number; rackFrom: number; rackTo: number },
  out: DoorwayChannels,
) {
  out.dark = 1 - outCubic(span(t, T.clearFrom, T.clearTo));
  out.exposure = 2 ** (FLOOR_STOPS * (1 - inOutSine(span(t, T.irisFrom, T.irisTo))));
  const r = smooth(span(t, T.rackFrom, T.rackTo));
  out.focus = DOORWAY.rackNear * (DOORWAY.rackFar / DOORWAY.rackNear) ** r;
  out.defocus = 1 - r;
}

/** The continuous passage inward (THROUGH). */
function throughChannels(t: number, out: DoorwayChannels): DoorwayChannels {
  const T = THROUGH;
  const travel = inOutSine(span(t, T.moveFrom, 1));
  const near = t < THROUGH_SWAP;
  out.side = near ? 'near' : 'far';
  out.leave = Math.min(1, travel / T.doorShare);
  out.arrive = near ? 0 : clamp01((travel - T.doorShare) / (1 - T.doorShare));
  out.aim = inOutSine(span(t, T.moveFrom, T.aimTo));
  // The aim rises to the room's own once the camera is in it.
  out.settle = near ? 0 : inOutSine(span(t, THROUGH_SWAP, 1));
  // The lens: toward the sill's as the door comes close, then on to the room's.
  out.warp = near ? smooth(span(out.leave, T.lensFrom, 1)) : 1 - smooth(span(t, THROUGH_SWAP, 1));
  out.dark = 0;
  out.exposure = 1;
  // The lens holds the door, a little soft beyond it, then finds the room.
  if (near) {
    out.focus = 0;
    out.defocus = T.defocus * smooth(span(t, 0.1, 0.45)) * (1 - smooth(span(out.leave, 0.9, 1)));
  } else {
    out.focus = DOORWAY.rackFar;
    out.defocus = 0;
  }
  // The leaves stay open: they are still in the picture until the sets change.
  out.exteriorDoors = inOutCubic(span(t, 0, T.doorsTo));
  out.vestibule = 0;
  out.portal = t > 0 ? 1 : 0;
  out.grade = near ? smooth(span(out.leave, T.gradeFrom, T.gradeTo)) : 1;
  return out;
}

/**
 * The continuous passage outward: THROUGH on a clock run backwards. `near` is
 * the hall (the camera backs from where it stood to the point inside the
 * door), `far` the estate (from that same point out to the pose the scroll
 * gives), and each channel is the way in's at the mirrored instant.
 */
function throughOutChannels(t: number, out: DoorwayChannels): DoorwayChannels {
  const T = THROUGH;
  const r = 1 - t;
  const travel = inOutSine(span(r, T.moveFrom, 1));
  const near = r >= THROUGH_SWAP;
  // How far out along the forecourt's share of the line the camera has come
  // (1 at the door, 0 where it will rest).
  const outside = Math.min(1, travel / T.doorShare);
  out.side = near ? 'near' : 'far';
  out.leave = near ? 1 - clamp01((travel - T.doorShare) / (1 - T.doorShare)) : 1;
  out.aim = near ? 1 - inOutSine(span(r, THROUGH_SWAP, 1)) : 1;
  out.arrive = near ? 0 : 1 - outside;
  out.settle = near ? 0 : 1 - inOutSine(span(r, T.moveFrom, T.aimTo));
  out.warp = near ? 1 - smooth(span(r, THROUGH_SWAP, 1)) : smooth(span(outside, T.lensFrom, 1));
  out.dark = 0;
  out.exposure = 1;
  if (near) {
    out.focus = DOORWAY.rackFar;
    out.defocus = 0;
  } else {
    out.focus = 0;
    out.defocus = T.defocus * smooth(span(r, 0.1, 0.45)) * (1 - smooth(span(outside, 0.9, 1)));
  }
  // The leaves stand open until the camera is well out, then close on the room.
  out.exteriorDoors = inOutCubic(span(r, 0, T.doorsTo));
  out.vestibule = 0;
  out.portal = r > 0 ? 1 : 0;
  out.grade = near ? 1 : smooth(span(outside, T.gradeFrom, T.gradeTo));
  return out;
}

/** The whole passage as a pure function of the clock. Writes into `out`. */
export function doorwayChannels(
  dir: DoorwayDirection,
  u: number,
  out: DoorwayChannels = restingChannels(),
  style: DoorwayStyle = 'threshold',
): DoorwayChannels {
  const t = clamp01(u);
  out.portal = 0;
  out.grade = 0;
  if (style === 'through') return dir === 'enter' ? throughChannels(t, out) : throughOutChannels(t, out);
  if (dir === 'enter') {
    const T = ENTER;
    const near = t < T.swap;
    out.side = near ? 'near' : 'far';
    out.leave = inCubic(span(t, T.moveFrom, T.moveTo));
    out.aim = inOutSine(span(t, T.moveFrom, T.aimTo));
    out.arrive = near ? 0 : outQuart(span(t, T.swap, 1));
    out.settle = near ? 0 : inOutSine(span(t, T.clearFrom, 1));
    out.warp = near ? inQuad(span(t, T.warpFrom, T.moveTo)) : 1 - outCubic(span(t, T.swap, 1));
    if (near) {
      out.dark = inQuad(span(t, T.darkFrom, T.darkTo));
      out.exposure = 1;
      out.focus = 0;
      out.defocus = 0.75 * smooth(span(t, T.focusFrom, T.focusTo));
    } else {
      farSide(t, T, out);
    }
    out.exteriorDoors = near ? inOutCubic(span(t, 0, T.doorsTo)) : 0;
    out.vestibule = near && t > 0 ? 1 : 0;
  } else {
    const T = EXIT;
    const near = t < T.swap;
    out.side = near ? 'near' : 'far';
    out.leave = inCubic(span(t, 0, T.moveTo));
    out.aim = inOutSine(span(t, 0, T.aimTo));
    out.arrive = near ? 0 : outQuart(span(t, T.swap, 1));
    out.settle = near ? 0 : inOutSine(span(t, T.clearFrom, 1));
    out.warp = near ? inQuad(span(t, T.warpFrom, T.moveTo)) : 1 - outCubic(span(t, T.swap, 1));
    if (near) {
      out.dark = inQuad(span(t, T.darkFrom, T.darkTo));
      out.exposure = 2 ** (FLOOR_STOPS * inOutSine(span(t, T.dimFrom, T.dimTo)));
      out.focus = 0;
      out.defocus = 0;
    } else {
      farSide(t, T, out);
    }
    out.exteriorDoors = near ? 0 : 1 - inOutCubic(span(t, T.doorsCloseFrom, T.doorsCloseTo));
    out.vestibule = near ? 0 : out.exteriorDoors > 0.001 ? 1 : 0;
  }
  return out;
}

// ── the director ────────────────────────────────────────────────────────────

/** What the director needs from the page. Registered by WorldCanvas, so this
 *  module never imports the scroll library or the DOM. */
export interface DoorwayHost {
  /** Published document progress, 0..1. */
  progress(): number;
  /** Move the document to a progress value at once, and republish it. */
  jumpTo(progress: number): void;
  /** Stop, or resume, the visitor's own scrolling. */
  hold(on: boolean): void;
  /** Smoothly scroll to a progress value, then call `done`. */
  glideTo(progress: number, seconds: number, done: () => void): void;
  /** Whether the animated passage may run at all. */
  canAnimate(): boolean;
  /** Whether this machine can draw the hall through the doorway (HallPortal):
   *  not the low tier. Absent means no. */
  canGoThrough?(): boolean;
}

export interface DoorwayState {
  mode: 'idle' | 'running';
  dir: DoorwayDirection;
  /** How this passage is being made (decided when it begins). */
  style: DoorwayStyle;
  /** Clock origin, performance.now(). */
  t0: number;
  u: number;
  swapped: boolean;
  released: boolean;
  /** When the dark began holding for a hall that had not loaded, or -1. */
  holdingSince: number;
  /** Set by the rig on the first frame of a run. */
  captured: boolean;
  fromPos: Vec3;
  fromLook: Vec3;
  fromFov: number;
  channels: DoorwayChannels;
  /** A programmatic crossing: the rig places the camera instead of flying it. */
  snap: boolean;
  /** performance.now() of the last cut, for the dip from black. */
  cutAt: number;
  /** The hall model is parsed, in the scene, and its programs are compiled
   *  (WorldCanvas, HallReadiness). */
  hallReady: boolean;
  /** Which model the scene is actually showing, as React last committed it. */
  sceneLeg: 'exterior' | 'interior';
  /** The estate has been on screen in this visit: its programs are compiled
   *  and it can be shown again at once (a visit that opened inside the hall
   *  leaves it by the dark threshold the first time). */
  estateSeen: boolean;
  /** Frames drawn with the far model since the swap; -1 when not waiting. */
  farFrames: number;
  /** performance.now() of the swap. */
  swappedAt: number;
  /** Progress on the previous frame, or -1 before the first. */
  lastProgress: number;
  /** performance.now() of the visitor's last scroll gesture. */
  lastInput: number;
  /** A passage asked for by a control rather than by a crossing. */
  request: DoorwayDirection | null;
  /** 0..1 how far the leaves stand open by the scroll at the door's rest
   *  (doorAjar). Written by the journey's driver while the page is outside;
   *  it keeps its last value while the page is inside. */
  ajar: number;
  /** The hall can be drawn through the doorway now: it has loaded, and this
   *  machine can draw it twice (the host's canGoThrough). */
  throughOk: boolean;
}

export const doorwayState: DoorwayState = {
  mode: 'idle',
  dir: 'enter',
  style: 'threshold',
  t0: 0,
  u: 0,
  swapped: false,
  released: false,
  holdingSince: -1,
  captured: false,
  fromPos: [0, 0, 0],
  fromLook: [0, 0, 0],
  fromFov: 45,
  channels: restingChannels(),
  snap: false,
  cutAt: -Infinity,
  hallReady: false,
  sceneLeg: 'exterior',
  estateSeen: false,
  farFrames: -1,
  swappedAt: 0,
  lastProgress: -1,
  lastInput: -Infinity,
  request: null,
  ajar: 0,
  throughOk: false,
};

let host: DoorwayHost | null = null;

export function setDoorwayHost(next: DoorwayHost | null) {
  host = next;
}

/** Record a scroll gesture. Wheel, touch and the scroll keys call this. */
export function noteDoorwayInput(now: number) {
  doorwayState.lastInput = now;
}

function rest(st: DoorwayState) {
  const c = restingChannels();
  Object.assign(st.channels, c);
}

function begin(dir: DoorwayDirection, now: number, h: DoorwayHost) {
  const st = doorwayState;
  st.mode = 'running';
  st.dir = dir;
  // Through the open door onto the lit hall, where the hall is there to be
  // seen and the machine can draw it twice; the dark threshold otherwise. And
  // out by the same door, where the estate has already been seen.
  const through = st.hallReady && h.canGoThrough?.() === true && (dir === 'enter' || st.estateSeen);
  st.style = through ? 'through' : 'threshold';
  st.t0 = now;
  st.u = 0;
  st.swapped = false;
  st.released = false;
  st.holdingSince = -1;
  st.farFrames = -1;
  st.captured = false;
  st.snap = false;
  h.hold(true);
  // Hold the page on the NEAR edge of the doorway band for the first half, so
  // the leg does not flip under a camera that is still outside — and so the
  // near side's copy stays pinned while it happens.
  h.jumpTo(dir === 'enter' ? DOOR_OUT - EDGE : DOOR_IN + EDGE);
  st.lastProgress = h.progress();
}

function finish(h: DoorwayHost | null, now: number) {
  const st = doorwayState;
  if (!st.released) h?.hold(false);
  st.mode = 'idle';
  st.style = 'threshold';
  st.released = true;
  st.holdingSince = -1;
  st.farFrames = -1;
  rest(st);
  st.lastProgress = h ? h.progress() : -1;
  // The page is released a moment before the move ends. If the visitor used
  // that moment to scroll straight back across the door, the leg the scroll
  // now names is not the one the camera arrived in — so place the camera on
  // it, as any other crossing that was not a passage.
  if (h && st.swapped) {
    const inside = st.lastProgress >= CROSSOVER;  // the models swap mid-band
    if (inside !== (st.dir === 'enter')) {
      st.snap = true;
      st.cutAt = now;
    }
  }
}

/**
 * Advance one frame. Call BEFORE the journey is read from the scroll, because
 * this can move the scroll: it holds the page at the door when a passage
 * starts, and lands it on the far side at the swap.
 */
export function stepDoorway(now: number): void {
  const st = doorwayState;
  const h = host;
  if (!h) return;

  st.throughOk = st.hallReady && h.canGoThrough?.() === true;

  if (st.mode === 'idle') {
    const s = h.progress();
    const prev = st.lastProgress;
    st.lastProgress = s;
    if (st.sceneLeg === 'exterior') st.estateSeen = true;

    let dir: DoorwayDirection | null = null;
    let requested = false;
    if (st.request) {
      dir = st.request;
      st.request = null;
      requested = true;
    } else if (prev >= 0) {
      // A passage starts on entering the doorway band from either side. The
      // models swap in the middle of the band, so a crossing that reaches the
      // band's edge by hand never shows a swap without a passage.
      if (prev < DOOR_OUT && s >= DOOR_OUT) dir = 'enter';
      else if (prev > DOOR_IN && s <= DOOR_IN) dir = 'exit';
    }

    const byHand = now - st.lastInput <= INPUT_WINDOW_MS;
    const atTheDoor =
      dir === 'enter'
        ? prev >= DOOR_OUT - DOOR_ZONE && s <= DOOR_IN + DOOR_ZONE
        : prev <= DOOR_IN + DOOR_ZONE && s >= DOOR_OUT - DOOR_ZONE;
    if (dir && h.canAnimate() && (requested || (byHand && atTheDoor))) {
      begin(dir, now, h);
    } else {
      // Anything else that changes which model the scroll names is a cut.
      if (!requested && prev >= 0 && (prev < CROSSOVER) !== (s < CROSSOVER)) {
        st.snap = true;
        st.cutAt = now;
      }
      return;
    }
  }

  // ── running ──
  if (st.style === 'through') {
    stepThrough(st, h, now);
    return;
  }
  const T = st.dir === 'enter' ? ENTER : EXIT;
  const duration = st.dir === 'enter' ? ENTER_MS : EXIT_MS;
  let u = (now - st.t0) / duration;

  if (!st.swapped && u >= T.swap) {
    const ready = st.dir === 'enter' ? st.hallReady : true;
    if (st.holdingSince < 0) st.holdingSince = now;
    if (!ready && now - st.holdingSince < MAX_HOLD_MS) {
      // Hold the dark. The clock is re-based so that when the hall arrives the
      // passage resumes from the peak instead of jumping to wherever the wall
      // clock has got to.
      st.t0 = now - T.swap * duration + 1;
      u = T.swap - 1 / duration;
    } else {
      h.jumpTo(st.dir === 'enter' ? DOOR_IN + EDGE : DOOR_OUT - EDGE);
      st.lastProgress = h.progress();
      st.swapped = true;
      st.swappedAt = now;
      st.farFrames = 0;
    }
  }

  // Hold the peak until the far model has actually been drawn (FAR_FRAMES).
  if (st.swapped && st.farFrames >= 0) {
    const far = st.dir === 'enter' ? 'interior' : 'exterior';
    if (st.sceneLeg === far) st.farFrames += 1;
    const waited = now - st.swappedAt;
    if (st.farFrames > FAR_FRAMES || waited >= MAX_FAR_WAIT_MS) {
      st.farFrames = -1;
    } else {
      st.t0 = now - T.swap * duration;
      u = T.swap;
    }
  }

  st.u = clamp01(u);
  doorwayChannels(st.dir, st.u, st.channels);

  if (!st.released && st.u >= T.release) {
    h.hold(false);
    st.released = true;
  }
  if (st.u >= 1) finish(h, now);
}

/**
 * One frame of the continuous passage. Nothing holds and nothing waits: the
 * page lands inside as the camera crosses the door plane, the opening shows the
 * hall for as long as the scene still shows the exterior (HallPortal), and the
 * move ends when its clock does — or, on a machine so slow the sets have not
 * changed by then, as soon as they have.
 */
function stepThrough(st: DoorwayState, h: DoorwayHost, now: number): void {
  const entering = st.dir === 'enter';
  const u = (now - st.t0) / (entering ? THROUGH_MS : THROUGH_OUT_MS);
  // The sill is crossed at the same place on the line either way.
  if (!st.swapped && u >= (entering ? THROUGH_SWAP : 1 - THROUGH_SWAP)) {
    h.jumpTo(entering ? DOOR_IN + EDGE : DOOR_OUT - EDGE);
    st.lastProgress = h.progress();
    st.swapped = true;
    st.swappedAt = now;
  }
  st.u = clamp01(u);
  doorwayChannels(st.dir, st.u, st.channels, 'through');
  if (!st.released && st.u >= THROUGH.release) {
    h.hold(false);
    st.released = true;
  }
  const far = entering ? 'interior' : 'exterior';
  if (st.u >= 1 && (st.sceneLeg === far || now - st.swappedAt >= MAX_FAR_WAIT_MS)) finish(h, now);
}

/**
 * Abandon a passage — the route changed, or the canvas is going away. The page
 * must never be left unscrollable or dark behind a navigation.
 */
export function cancelDoorway() {
  const st = doorwayState;
  if (st.mode === 'running') finish(host, performance.now());
  st.request = null;
  st.snap = false;
  st.lastProgress = -1;
  st.ajar = 0;
}

/**
 * Go in, from a control rather than from the wheel.
 *
 * Returns false when there will be no passage (reduced motion, no smooth
 * scroll, a passage already running), so the caller can let its link do the
 * ordinary thing. Otherwise the page glides to the door first — the camera
 * cannot fly through the front door from the far side of the house — and the
 * passage starts when it arrives.
 */
export function enterResidence(): boolean {
  const h = host;
  const st = doorwayState;
  if (!h || !h.canAnimate() || st.mode === 'running') return false;
  const s = h.progress();
  if (s >= DOOR_OUT) return false;
  const door = DOOR_OUT - EDGE;
  const distance = door - s;
  if (distance <= 0.002) {
    st.request = 'enter';
    return true;
  }
  // Paced like the film: about a second per chapter's worth of page, bounded so
  // a click from the top of the page is not a tour.
  const seconds = Math.min(4.5, Math.max(1.1, distance * 14));
  h.glideTo(door, seconds, () => {
    if (doorwayState.mode === 'idle') doorwayState.request = 'enter';
  });
  return true;
}
