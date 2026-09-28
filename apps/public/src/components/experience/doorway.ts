// apps/public/src/components/experience/doorway.ts
//
// THE DOORWAY — how the film goes through the front door.
//
// WHAT THE CLIENT REVIEW REJECTED. The exterior used to end on the
// constellation, forty-eight metres behind the house and eighteen up, and a
// black veil closed over that frame while the models swapped. The review's
// words: the transition "opens here in the site, this is not acceptable — it
// must open from the actual door", with "a proper animation like acceleration
// and calculated deceleration with white screen", so that the visitor feels
// "he is wearing a VR headset and he is entering a new world".
//
// So the exterior film now ends square on the front door (cameraPath.ts, the
// approach), and this module takes the camera through it:
//
//   1. the two door leaves swing inward and light pours out of the opening;
//   2. the camera ACCELERATES down its own view axis, over the fountain and
//      through the doorway, the lens widening as it reaches the door;
//   3. the light fills the frame — the white is a DOM layer over everything,
//      so it is exactly white, not white-through-a-tone-curve — and under it
//      the models swap and the page lands on the first chapter inside;
//   4. the camera is already moving when the white begins to clear: it comes
//      through the hall's own doorway and DECELERATES onto the threshold frame,
//      the lens narrowing and the exposure settling as the eye adjusts.
//
// Scrolling back up plays the same passage in reverse, shorter: backing out
// through the hall doors into the light, and out of the front doors onto the
// forecourt as they close.
//
// WHY IT IS TIMED AND NOT SCRUBBED. Everything else in the film is bound to the
// scroll position, and this is the one move that must not be. An acceleration
// is a shape in TIME; tied to a wheel it becomes whatever the visitor's hand
// did, and a visitor who stops halfway is left standing in a white screen. So a
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
// Module-level state, for the reason journeyState and diveState are: this
// changes every frame during the move, and it is read inside useFrame by the
// rig, the door leaves, the district field and the lighting.

import { CROSSOVER, DOOR_IN, DOOR_OUT } from './journey';

export type DoorwayDirection = 'enter' | 'exit';
type Vec3 = [number, number, number];

/** Length of the passage inward. Long enough to be a passage, short enough
 *  that a visitor who has decided to go in is not made to wait. */
export const ENTER_MS = 2800;
/** Backing out is a return, not an arrival, and gets less ceremony. */
export const EXIT_MS = 2000;

/**
 * The passage inward, on a 0..1 clock. Every threshold is a fraction of
 * ENTER_MS so the choreography scales as one piece.
 */
export const ENTER = {
  /** The leaves part before the camera moves: the door opens for you. */
  doorsTo: 0.3,
  glowFrom: 0.02,
  glowTo: 0.28,
  /** The acceleration, from rest to the far side of the door plane. */
  moveFrom: 0.07,
  moveTo: 0.47,
  aimTo: 0.35,
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
  warpFrom: 0.39,
  /** Exposure lifts with the light, not before it — lifted early it greyed the
   *  whole facade while the doors were still opening. */
  exposureFrom: 0.4,
  /** Light fills the frame, growing out of the doorway. */
  whiteFrom: 0.28,
  whiteTo: 0.47,
  /** Model swap and scroll landing, under full white. */
  swap: 0.49,
  /** The white clears from the centre outward while the camera decelerates. */
  clearFrom: 0.55,
  clearTo: 0.9,
  /** The hall's doorway closes behind the camera once it is through. */
  hallCloseFrom: 0.7,
  hallCloseTo: 0.78,
  /** The page accepts scrolling again. */
  release: 0.9,
} as const;

/** The passage outward. */
export const EXIT = {
  moveTo: 0.45,
  aimTo: 0.3,
  /** Backing out, the widening is what sells the speed; the doorway is behind
   *  the camera, so there is no subject for it to shrink. */
  warpFrom: 0.1,
  exposureFrom: 0.3,
  whiteFrom: 0.25,
  whiteTo: 0.45,
  swap: 0.47,
  clearFrom: 0.53,
  clearTo: 0.82,
  doorsCloseFrom: 0.62,
  doorsCloseTo: 1.0,
  glowFadeFrom: 0.58,
  glowFadeTo: 0.92,
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
 *
 * V7 moved the front door from z 5.1 to 8.2 with the larger house; the
 * exterior points below moved with it, 0.7 m past the leaves as before.
 */
export const DOORWAY = {
  /** Exterior: where the camera is when the frame is fully white — through the
   *  opening and 0.66 m past the door plane, still 0.8 m short of the light
   *  panel behind it (the near plane outside is 0.5 m). */
  exteriorPass: [0, 2.2, 7.5] as Vec3,
  /** Straight in through the door, level. */
  exteriorGaze: [0, 2.15, -21] as Vec3,
  /** Hall: where the camera is at the swap — outside the front wall, square on
   *  its doorway, which the district field's wall shader holds open while the
   *  camera comes through (CityField.tsx, doorwayState.channels.hallOpen). */
  hallStart: [0, 1.95, 10.6] as Vec3,
  hallGaze: [0, 1.9, -24] as Vec3,
  /** Exit, near side: backing out of the hall through its doorway. */
  hallPass: [0, 1.95, 10.3] as Vec3,
  /** Exit, far side: just outside the front doors, under the portico and short
   *  of its inner columns, at a height whose line back to the door beat passes
   *  under the entablature and over the fountain (doorway.test.ts). */
  exteriorStart: [0, 2.4, 9.6] as Vec3,
  /** The lens at full rush. Wide enough that the door frame streams past the
   *  edges of the image; not so wide that the hall arrives as a fisheye. */
  warpFov: 76,
  /** How far the leaves swing, radians. Short of 90 so they read as opened
   *  doors rather than as panels folded flat against the reveal. */
  leafSwing: 1.45,
  /** Exposure multiplier at the peak — the eye adjusting to the light. */
  exposureBoost: 0.9,
  /** Blur at the peak, CSS pixels, on devices that can afford a filter. */
  blurPx: 7,
} as const;

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

/** If the hall has not finished loading when the white peaks, the white holds
 *  — for at most this long, after which the passage completes regardless. */
export const MAX_HOLD_MS = 12_000;

/** A programmatic crossing's dip from black. */
export const CUT_MS = 420;

/**
 * Frames the far model must have been ON SCREEN, under full white, before the
 * white may begin to clear.
 *
 * MEASURED, on a machine rendering the scene at under two frames a second: the
 * clock ran from the peak straight past the clearing in one frame, and the
 * first clear frame showed the EXTERIOR model around a camera already standing
 * in hall coordinates — the shell of the house from inside, under the hall's
 * copy. The swap is a React commit, and a commit lands a frame or more after
 * the scroll that asks for it; on a phone that frame is also the one that
 * compiles the hall's shaders. So the white holds, with the clock stopped at
 * the peak, until the scene reports the far model and has drawn it twice.
 */
export const FAR_FRAMES = 2;

/** A scene that never reports the swap must not strand a visitor in white. */
export const MAX_FAR_WAIT_MS = 1500;

// ── easing ──────────────────────────────────────────────────────────────────

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const inQuad = (t: number) => t * t;
const inCubic = (t: number) => t * t * t;
const outQuad = (t: number) => 1 - (1 - t) * (1 - t);
const outCubic = (t: number) => 1 - (1 - t) ** 3;
const outQuart = (t: number) => 1 - (1 - t) ** 4;
const inOutSine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (t: number) => t * t * (3 - 2 * t);

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
  /** 0..1 white coverage, and how it is shaped. 'bloom' grows from the centre
   *  of the frame outward; 'iris' is clear at the centre and closes in from the
   *  edges. */
  white: number;
  whiteShape: 'bloom' | 'iris';
  /** 0..1 of DOORWAY.blurPx. */
  blur: number;
  /** Exposure multiplier, 1 at rest. */
  exposure: number;
  /** 0..1 how far the exterior door leaves are open. */
  exteriorDoors: number;
  /** 0..1 light pouring from the exterior doorway. */
  exteriorGlow: number;
  /** 0..1 how far the hall's front wall is held open for the camera. */
  hallOpen: number;
}

export function restingChannels(): DoorwayChannels {
  return {
    side: 'near',
    leave: 0,
    aim: 0,
    arrive: 0,
    settle: 0,
    warp: 0,
    white: 0,
    whiteShape: 'bloom',
    blur: 0,
    exposure: 1,
    exteriorDoors: 0,
    exteriorGlow: 0,
    hallOpen: 0,
  };
}

/** The whole passage as a pure function of the clock. Writes into `out`. */
export function doorwayChannels(
  dir: DoorwayDirection,
  u: number,
  out: DoorwayChannels = restingChannels(),
): DoorwayChannels {
  const t = clamp01(u);
  if (dir === 'enter') {
    const T = ENTER;
    const near = t < T.swap;
    out.side = near ? 'near' : 'far';
    out.leave = inCubic(span(t, T.moveFrom, T.moveTo));
    out.aim = inOutSine(span(t, T.moveFrom, T.aimTo));
    out.arrive = near ? 0 : outQuart(span(t, T.swap, 1));
    out.settle = near ? 0 : inOutSine(span(t, T.clearFrom, 1));
    out.warp = near ? inQuad(span(t, T.warpFrom, T.moveTo)) : 1 - outCubic(span(t, T.swap, 1));
    if (t < T.clearFrom) {
      out.whiteShape = 'bloom';
      out.white = t < T.whiteTo ? inQuad(span(t, T.whiteFrom, T.whiteTo)) : 1;
    } else {
      out.whiteShape = 'iris';
      out.white = 1 - outCubic(span(t, T.clearFrom, T.clearTo));
    }
    out.blur = near
      ? inQuad(span(t, 0.32, T.whiteTo))
      : 1 - outQuad(span(t, T.clearFrom, T.clearFrom + 0.2));
    out.exposure =
      1 +
      DOORWAY.exposureBoost *
        (near ? inQuad(span(t, T.exposureFrom, T.whiteTo)) : 1 - outCubic(span(t, T.clearFrom, 0.95)));
    out.exteriorDoors = near ? inOutCubic(span(t, 0, T.doorsTo)) : 0;
    out.exteriorGlow = near ? smooth(span(t, T.glowFrom, T.glowTo)) : 0;
    out.hallOpen = near ? 0 : 1 - smooth(span(t, T.hallCloseFrom, T.hallCloseTo));
  } else {
    const T = EXIT;
    const near = t < T.swap;
    out.side = near ? 'near' : 'far';
    out.leave = inCubic(span(t, 0, T.moveTo));
    out.aim = inOutSine(span(t, 0, T.aimTo));
    out.arrive = near ? 0 : outQuart(span(t, T.swap, 1));
    out.settle = near ? 0 : inOutSine(span(t, T.clearFrom, 1));
    out.warp = near ? inQuad(span(t, T.warpFrom, T.moveTo)) : 1 - outCubic(span(t, T.swap, 1));
    if (t < T.clearFrom) {
      // Backing out into the light: it closes in from the edges of the frame,
      // the way a doorway's light surrounds you as you pass through it.
      out.whiteShape = 'iris';
      out.white = t < T.whiteTo ? inQuad(span(t, T.whiteFrom, T.whiteTo)) : 1;
    } else {
      // And outside it retreats INTO the doorway you have just left.
      out.whiteShape = 'bloom';
      out.white = 1 - outCubic(span(t, T.clearFrom, T.clearTo));
    }
    out.blur = near
      ? inQuad(span(t, 0.3, T.whiteTo))
      : 1 - outQuad(span(t, T.clearFrom, T.clearFrom + 0.2));
    out.exposure =
      1 +
      DOORWAY.exposureBoost *
        (near ? inQuad(span(t, T.exposureFrom, T.whiteTo)) : 1 - outCubic(span(t, T.clearFrom, 0.95)));
    out.exteriorDoors = near ? 0 : 1 - inOutCubic(span(t, T.doorsCloseFrom, T.doorsCloseTo));
    out.exteriorGlow = near ? 0 : 1 - smooth(span(t, T.glowFadeFrom, T.glowFadeTo));
    out.hallOpen = near ? 1 : 0;
  }
  return out;
}

/**
 * The white layer's background for a coverage and a shape.
 *
 * A radial gradient rather than an opacity, because a flat fade is a screen
 * going white and a gradient is LIGHT: it grows out of the doorway at the
 * centre of the frame, and on arrival it opens from the centre like an eye.
 * `circle` sizes to the farthest corner, so 120% is past every pixel.
 */
export function whiteGradient(shape: 'bloom' | 'iris', coverage: number): string {
  const c = clamp01(coverage);
  const W = '255,248,238';
  if (shape === 'bloom') {
    const r = -60 + 180 * c;
    return `radial-gradient(circle at 50% 50%, rgba(${W},1) ${r.toFixed(1)}%, rgba(${W},0) ${(r + 60).toFixed(1)}%)`;
  }
  const h = 120 - 180 * c;
  return `radial-gradient(circle at 50% 50%, rgba(${W},0) ${h.toFixed(1)}%, rgba(${W},1) ${(h + 60).toFixed(1)}%)`;
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
}

export interface DoorwayState {
  mode: 'idle' | 'running';
  dir: DoorwayDirection;
  /** Clock origin, performance.now(). */
  t0: number;
  u: number;
  swapped: boolean;
  released: boolean;
  /** When the white began holding for a hall that had not loaded, or -1. */
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
}

export const doorwayState: DoorwayState = {
  mode: 'idle',
  dir: 'enter',
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
  farFrames: -1,
  swappedAt: 0,
  lastProgress: -1,
  lastInput: -Infinity,
  request: null,
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

  if (st.mode === 'idle') {
    const s = h.progress();
    const prev = st.lastProgress;
    st.lastProgress = s;

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
  const T = st.dir === 'enter' ? ENTER : EXIT;
  const duration = st.dir === 'enter' ? ENTER_MS : EXIT_MS;
  let u = (now - st.t0) / duration;

  if (!st.swapped && u >= T.swap) {
    const ready = st.dir === 'enter' ? st.hallReady : true;
    if (st.holdingSince < 0) st.holdingSince = now;
    if (!ready && now - st.holdingSince < MAX_HOLD_MS) {
      // Hold the white. The clock is re-based so that when the hall arrives the
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
 * Abandon a passage — the route changed, or the canvas is going away. The page
 * must never be left unscrollable or white behind a navigation.
 */
export function cancelDoorway() {
  const st = doorwayState;
  if (st.mode === 'running') finish(host, performance.now());
  st.request = null;
  st.snap = false;
  st.lastProgress = -1;
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
