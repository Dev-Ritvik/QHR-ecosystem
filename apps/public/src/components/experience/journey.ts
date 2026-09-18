// apps/public/src/components/experience/journey.ts
//
// The home page as ONE continuous cinematic timeline, across two models.
//
// WHAT WAS HERE BEFORE. The exterior and the interior were separate PLACES,
// selected by route: '/' loaded the mansion from outside, '/hall' loaded the
// hall, and the only way between them was a navigation. Scroll drove a camera
// inside whichever one was mounted. So the brief's central move — scrolling
// from the forecourt, through the door, into the room — did not exist, and
// could not, because nothing in the app related the two sets to each other.
//
// This module is that relation, and nothing else. It owns exactly one decision:
// given document scroll, which leg are we on, how far into it, and how dark is
// the veil between them. Both legs keep their own path module (cameraPath.ts
// outside, interiorPath.ts inside) with their own coordinates and their own
// verified poses; neither knows the other exists.
//
// THE CROSSOVER
//
// The two GLBs are separate assets with separate origins. There is no physical
// continuity to preserve because there is no shared space — the exterior's
// doorway at z 5.10 and the interior's doorway at z 5.24 are coincidentally
// close, but the rooms behind them are different models at different scales of
// detail, and pretending a camera flies from one into the other is a lie the
// first frame would expose.
//
// So the transition is honest about being a transition, and hides the seam the
// way film does — through the front door. The exterior leg ends square on the
// doors (cameraPath.ts, the approach); a crossing made by hand plays the
// doorway (doorway.ts): the leaves open, the camera accelerates through them
// into light, and under full white the models swap and the page lands inside,
// where the camera comes through the hall's own doorway and settles. Same axis,
// same direction of travel either side of the swap.
//
// WHAT THIS REPLACED, BY CLIENT REVIEW. The swap used to happen under a black
// veil scrubbed by scroll, closing over the constellation — a crane shot behind
// the house. The review rejected it in so many words: the transition must open
// from the actual door. The scrubbed veil survives only for visitors who have
// asked for reduced motion; everyone else gets the doorway, or, for a jump
// nobody made by hand, a placed camera under a brief dip from black.

/**
 * The scroll track's length, in viewport heights. Every fraction in this file
 * is a fraction of it, and the home page sizes its chapter sections from it.
 *
 * DERIVED, NOT CHOSEN. It was 1700 with the crossover at 0.46. The approach to
 * the front door added 0.6 of the first three chapters' page (FILM_SHARE in
 * cameraPath.ts), and the doorway takes one viewport of its own (DOOR_BAND
 * below). The track grew by exactly those two amounts, so no chapter that
 * existed before lost a pixel of the scroll it was paced against:
 *
 *   exterior leg   782vh x 1.6  = 1251.2vh    hero ... approach to the door
 *   the doorway                    100.0vh    one viewport, see DOOR_BAND
 *   interior leg                   748.0vh    (0.90 - 0.46) x 1700
 *   journey                       2099.2vh =  JOURNEY_END x 2332vh
 */
export const TRACK_VH = 2332;

/** The exterior leg in viewport heights: the approved 782vh of the first three
 *  chapters, grown by the approach (FILM_SHARE is their share of the leg). */
const EXTERIOR_VH = 782 / FILM_SHARE;

/**
 * THE DOORWAY'S OWN VIEWPORT OF SCROLL, between the last frame outside and the
 * first frame inside.
 *
 * WHY THE PAGE HAS A GAP THE CAMERA NEVER USES. Each chapter's copy is a pane
 * pinned for the length of its section, and a pinned pane takes a full viewport
 * of scroll to leave. Without this band the approach's pane — "The door is
 * open" — was still pinned, measured, when the doorway had already landed the
 * visitor inside the hall; and the hall's own copy was still below the fold.
 * With it, the approach pane is pinned up to the very frame the doors open
 * from, and the hall's pane pins on the very frame the passage lands on. The
 * passage jumps the page across the band; nobody scrolls through it except a
 * visitor who has asked for reduced motion, for whom it is the old dissolve.
 */
export const DOOR_BAND = 100 / TRACK_VH;

/** The last frame outside: the front door, square on. */
export const DOOR_OUT = EXTERIOR_VH / TRACK_VH;

/** The first frame inside: the threshold. */
export const DOOR_IN = DOOR_OUT + DOOR_BAND;

/**
 * Where the scene swaps models, for anything that crosses the band without a
 * passage — a deep link, a chapter address, reduced motion. The middle of the
 * band, so neither side's copy is on screen when it happens.
 */
export const CROSSOVER = (DOOR_OUT + DOOR_IN) / 2;

/**
 * Half-width of the blackout, in scroll units — REDUCED MOTION ONLY.
 *
 * Everyone else crosses through the doorway (doorway.ts). A visitor who has
 * asked the system for less motion gets no timed camera move at all, so for
 * them the swap is still hidden the old way: a black veil scrubbed by scroll,
 * about a third of a viewport either side of the crossover.
 */
export const VEIL_HALF_BAND = 0.036;

/**
 * How far before the crossover the interior model starts loading.
 *
 * interior_hall.glb is 16.4MB with Draco geometry and 37 KTX2 textures, so it is
 * seconds of work on a phone. Mounting it at the crossover would put that stall
 * exactly where the veil is meant to be a dissolve. Arming it a fifth of the
 * page early means the download, the transcode and the GPU upload all happen
 * while the visitor is watching the revolution.
 *
 * Once armed it stays armed. Scrolling back up hides the hall rather than
 * unmounting it — a visitor moving up and down across the crossover must not
 * re-pay for a 16MB parse each time.
 *
 * 0.2 -> 0.25 with the approach chapter. Measured in document progress the lead
 * was about to shrink as a share of the film, and the doorway now HOLDS its
 * white for a hall that has not arrived — so the earlier the parse starts, the
 * less likely a visitor ever sees that hold. Armed at 0.31, the hall loads
 * across the constellation and the whole approach.
 */
export const PRELOAD_LEAD = 0.25;

/**
 * Where the CAMERA journey finishes, as a fraction of document scroll.
 *
 * Not 1.0, and the reason is visible in a rendered frame: the site footer is
 * ~700px of dark UI at the bottom of every page, and it is part of the document
 * the camera measures itself against. With the journey mapped to the full
 * scroll range, the portrait — the emotional destination of the whole sequence
 * — only fully resolved when the page was scrolled to its absolute end, which
 * is exactly the position where the footer covers three quarters of the
 * viewport. The last shot of the film was playing behind the credits.
 *
 * Ending the journey at 0.90 gives the portrait a held frame of its own, and
 * leaves the last tenth of the page for the footer to arrive over a composition
 * that has already landed. Everything downstream — the chapter boundaries, the
 * interior leg, the veil — is expressed against this rather than against 1.
 */
export const JOURNEY_END = 0.9;

import { CHAPTER_WEIGHTS } from './interiorPath';
import { FILM_SHARE } from './cameraPath';

export type Leg = 'exterior' | 'interior';

export interface JourneyState {
  leg: Leg;
  /** 0..1 within the active leg. */
  legProgress: number;
  /** 0..1 blackout. 1 at the crossover, 0 outside the band. */
  veil: number;
  /** True once the interior should be mounted, whether or not it is visible. */
  armed: boolean;
}

/**
 * The published journey state, written once per frame by the driver in
 * WorldCanvas and read by everything else.
 *
 * Same shape as the scroll value in useScrollProgress.ts, and for the same
 * reason: the camera rig, the lighting, the veil, the constellation and the
 * interior stage all need this number every frame, and having each of them
 * derive it independently is five copies of the same arithmetic plus five
 * chances for them to disagree about which leg is active. One writer, many
 * readers, no allocation.
 *
 * Module-level mutable state is a deliberate choice here rather than context:
 * a context value that changes 60 times a second re-renders every consumer,
 * which is precisely what this must not do.
 */
export const journeyState: JourneyState = {
  leg: 'exterior',
  legProgress: 0,
  veil: 0,
  armed: false,
};

/** GLSL smoothstep, matching the one the shaders use so eases agree across the
 *  DOM, the camera and the material layer. */
function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Where the journey is, given raw document scroll.
 *
 * Pure and allocation-free apart from the returned object, so it is safe to
 * call once per frame. Callers that run in the frame loop pass a scratch object
 * to fill instead — see `readJourney`.
 */
export function journeyAt(scroll: number): JourneyState {
  const out: JourneyState = { leg: 'exterior', legProgress: 0, veil: 0, armed: false };
  readJourney(scroll, out);
  return out;
}

/** Fills `out` in place. The frame loop uses this so the journey costs no
 *  allocation per frame. */
export function readJourney(scroll: number, out: JourneyState): JourneyState {
  const s = Math.min(1, Math.max(0, scroll));

  if (s < CROSSOVER) {
    out.leg = 'exterior';
    // Holds the door frame through the first half of the doorway band.
    out.legProgress = Math.min(1, s / DOOR_OUT);
  } else {
    out.leg = 'interior';
    // Holds the threshold through the second half of the band, and is clamped
    // at JOURNEY_END, so scrolling into the footer holds the final composition
    // rather than pushing the camera past it.
    out.legProgress = Math.min(
      1,
      Math.max(0, (s - DOOR_IN) / Math.max(1e-6, JOURNEY_END - DOOR_IN)),
    );
  }

  // The veil. Symmetric around the crossover: the last stretch of the approach
  // dims down, the first stretch inside brings it back up.
  const d = Math.abs(s - CROSSOVER);
  out.veil = 1 - smoothstep(0, VEIL_HALF_BAND, d);

  out.armed = s >= CROSSOVER - PRELOAD_LEAD;
  return out;
}

/**
 * Named chapters, for the DOM to author its copy against.
 *
 * The page beneath the canvas has to know where each block of type belongs, and
 * hardcoding scroll fractions into a JSX file is how the copy and the camera
 * drift apart. These are the same numbers the camera uses.
 *
 * `from`/`to` are DOCUMENT scroll, not leg progress, so a section can be sized
 * in viewport heights directly from them.
 */
export interface Chapter {
  id: string;
  from: number;
  to: number;
}

export function chapters(stationCount: number): Chapter[] {
  const n = Math.max(0, Math.min(4, stationCount));
  const ext = DOOR_OUT;
  const int = JOURNEY_END - DOOR_IN;
  const W = CHAPTER_WEIGHTS;

  // Exterior: hero, revolution, constellation — their original proportions,
  // inside the first FILM_SHARE of the leg — then the approach to the door. The
  // constellation gets the largest share of the three because it is the only
  // chapter with an interaction the visitor is meant to discover rather than
  // watch.
  //
  // The constellation's chapter runs a little PAST its beat. The camera slows
  // almost to rest on the sphere at FILM_SHARE and the approach leaves it
  // slowly, so for the first stretch of that departure the frame is still the
  // constellation; the copy beside it stays until the house has visibly begun
  // to turn.
  const film = ext * FILM_SHARE;
  const holdEnd = ext * (FILM_SHARE + (1 - FILM_SHARE) * 0.15);
  // The approach's chapter INCLUDES the doorway band: its section is one
  // viewport longer than its camera move, which is what keeps its pane pinned
  // until the doors open (see DOOR_BAND).
  const out: Chapter[] = [
    { id: 'hero', from: 0, to: film * 0.3 },
    { id: 'revolution', from: film * 0.3, to: film * 0.62 },
    { id: 'constellation', from: film * 0.62, to: holdEnd },
    { id: 'approach', from: holdEnd, to: DOOR_IN },
  ];

  // Interior: establish, one per station, the portrait, then the threshold.
  // Matches the proportions buildInteriorBeats lays out.
  // The SAME weights the camera path uses, imported rather than restated. They
  // were duplicated once and immediately drifted; see the note on
  // CHAPTER_WEIGHTS.
  const span = W.establish + n * W.station + W.portrait + W.city;
  let cursor = DOOR_IN;
  const push = (id: string, frac: number) => {
    const width = (frac / span) * int;
    out.push({ id, from: cursor, to: cursor + width });
    cursor += width;
  };
  push('establish', W.establish);
  for (let i = 0; i < n; i += 1) push(`station-${i + 1}`, W.station);
  push('portrait', W.portrait);
  // THE DISTRICT FIELD, seen through the entry doors. The last chapter of the
  // film and the one Phase 6 recorded as missing entirely.
  push('city', W.city);

  // Floating-point drift over eight additions lands a few thousandths short;
  // the last chapter owns the remainder so the track always closes exactly on
  // JOURNEY_END.
  if (out.length > 0) out[out.length - 1].to = JOURNEY_END;
  return out;
}
