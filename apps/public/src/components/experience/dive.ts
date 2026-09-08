// apps/public/src/components/experience/dive.ts
//
// THE CAMERA DIVE — the move a selected beacon makes before the page changes.
//
// A module-level mutable object, read once per frame by the rig, for the same
// reason journeyState is one: this changes every frame during the move and a
// context value that did the same would re-render the entire canvas tree at
// frame rate. One writer, one reader, no allocation.
//
// WHAT IT IS NOT
//
// It is not a second navigation transition. The route veil is this site's only
// one, and the dive is timed to hand over to it: the camera travels for
// DIVE_MS, the veil is asked to close at HANDOFF_MS, and the two overlap so the
// last stretch of travel happens behind a closing screen rather than ending in
// a cut. Selecting a beacon and clicking the same project's link in the copy
// beside it both end in the same veiled client-side push to the same route.
//
// It is also not a teleport. The camera leaves from wherever it actually is
// when the beacon is chosen — captured at that instant, not assumed — so an
// interrupted scroll, a pointer parallax offset or a mid-move selection all
// start from the frame the visitor was looking at.
//
// REDUCED MOTION
//
// There is no dive at all. `start` returns false, the caller routes
// immediately, and the visitor gets the same destination with no camera
// animation — which is the contract: same information, less motion.

export interface DiveState {
  active: boolean;
  /** Where the camera was when the beacon was chosen. */
  fromPos: [number, number, number];
  fromTarget: [number, number, number];
  /** Where it is going: a stand-off short of the beacon, aimed at it. */
  toPos: [number, number, number];
  toTarget: [number, number, number];
  /** performance.now() at the start. */
  t0: number;
  /** The project this dive is for, so a second selection replaces rather than
   *  fights the first. */
  slug: string;
}

/** Travel time. Long enough to read as a move toward a point in the field,
 *  short enough that a visitor who has decided is not made to wait. */
export const DIVE_MS = 620;

/**
 * When the veil is asked to close, measured from the same start.
 *
 * RouteVeil closes over 280ms, so asking at 300 puts full black at 580 — just
 * before the dive ends at 620. The camera is therefore still travelling when
 * the screen is covered, which is what makes the cut land on movement rather
 * than on a held frame.
 */
export const HANDOFF_MS = 300;

export const diveState: DiveState = {
  active: false,
  fromPos: [0, 0, 0],
  fromTarget: [0, 0, 0],
  toPos: [0, 0, 0],
  toTarget: [0, 0, 0],
  t0: 0,
  slug: '',
};

/** True when the visitor has asked for less motion. Read at call time rather
 *  than cached: the setting can change while the page is open. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Begin a dive. Returns false when there is to be no animation — reduced
 * motion, or a caller with nothing to travel from — and the caller should then
 * route straight away.
 */
export function startDive(arg: {
  slug: string;
  fromPos: [number, number, number];
  fromTarget: [number, number, number];
  toPos: [number, number, number];
  toTarget: [number, number, number];
}): boolean {
  if (prefersReducedMotion()) return false;
  diveState.active = true;
  diveState.slug = arg.slug;
  diveState.fromPos = arg.fromPos;
  diveState.fromTarget = arg.fromTarget;
  diveState.toPos = arg.toPos;
  diveState.toTarget = arg.toTarget;
  diveState.t0 = performance.now();
  return true;
}

/** Stop a dive. Called when the canvas unmounts, when the visitor scrolls, and
 *  when a route change lands — the camera must never be left held off its own
 *  path by an animation nobody can see the end of. */
export function cancelDive() {
  diveState.active = false;
  diveState.slug = '';
}

/** Cubic ease-out. Fast off the mark, settling into the destination — the shape
 *  of a move that has somewhere to be, rather than a symmetric tween. */
function easeOut(t: number): number {
  const x = 1 - t;
  return 1 - x * x * x;
}

/**
 * Progress 0..1, or null when no dive is running.
 *
 * Past 1 the dive stays ACTIVE and pinned at 1 rather than clearing itself: the
 * navigation is in flight behind a closed veil, and releasing the camera back
 * onto the scroll path at that moment would snap it across the room one frame
 * before the canvas unmounts.
 */
export function diveProgress(now: number): number | null {
  if (!diveState.active) return null;
  return easeOut(Math.min(1, (now - diveState.t0) / DIVE_MS));
}
