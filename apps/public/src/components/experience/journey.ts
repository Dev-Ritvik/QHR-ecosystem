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
// way film does: the camera drives INTO the portico until the doorway fills the
// frame, the frame goes to black through the last metre, and it opens again
// standing inside on the threshold. Same axis, same direction of travel, same
// eye height either side of the cut. That is a match cut, not a hard cut, and
// it is the only construction available that does not require the two models to
// be one model.
//
// The model swap happens at the darkest instant, where nothing is on screen to
// see it. VEIL_HALF_BAND is deliberately wide enough that the swap cannot be
// caught by scrubbing the scrollbar quickly.

/**
 * Scroll progress at which the interior takes over.
 *
 * Slightly past half: the exterior carries the hero, the revolution and the
 * constellation — three chapters — while the interior carries the establishing
 * shot, the stations and the portrait. The interior needs more page per beat
 * because its beats are reading beats, where a visitor stops to look at a plan.
 */
export const CROSSOVER = 0.46;

/**
 * Half-width of the blackout, in scroll units.
 *
 * At 10,000px of track this is ~360px of scroll fully or partly veiled, which
 * is about a third of a viewport — long enough to read as a deliberate passage
 * through a doorway, short enough not to feel like a loading screen.
 */
export const VEIL_HALF_BAND = 0.036;

/**
 * How far before the crossover the interior model starts loading.
 *
 * interior_hall.glb is 15MB with Draco geometry and 28 KTX2 textures, so it is
 * seconds of work on a phone. Mounting it at the crossover would put that stall
 * exactly where the veil is meant to be a dissolve. Arming it a fifth of the
 * page early means the download, the transcode and the GPU upload all happen
 * while the visitor is watching the revolution.
 *
 * Once armed it stays armed. Scrolling back up hides the hall rather than
 * unmounting it — a visitor moving up and down across the crossover must not
 * re-pay for a 15MB parse each time.
 */
export const PRELOAD_LEAD = 0.2;

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
    out.legProgress = s / CROSSOVER;
  } else {
    out.leg = 'interior';
    // Clamped at JOURNEY_END, so scrolling into the footer holds the final
    // composition rather than pushing the camera past it.
    out.legProgress = Math.min(
      1,
      (s - CROSSOVER) / Math.max(1e-6, JOURNEY_END - CROSSOVER),
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
  const ext = CROSSOVER;
  const int = JOURNEY_END - CROSSOVER;
  const W = CHAPTER_WEIGHTS;

  // Exterior thirds: hero, revolution, constellation. The constellation gets
  // the largest share because it is the only chapter with an interaction the
  // visitor is meant to discover rather than watch.
  const out: Chapter[] = [
    { id: 'hero', from: 0, to: ext * 0.3 },
    { id: 'revolution', from: ext * 0.3, to: ext * 0.62 },
    { id: 'constellation', from: ext * 0.62, to: ext },
  ];

  // Interior: establish, one per station, portrait. Matches the proportions
  // buildInteriorBeats lays out — establish and the turn take the first 30%,
  // each station 15%, the portrait the last 16%.
  // The SAME weights the camera path uses, imported rather than restated. They
  // were duplicated once and immediately drifted; see the note on
  // CHAPTER_WEIGHTS.
  const span = W.establish + n * W.station + W.portrait;
  let cursor = CROSSOVER;
  const push = (id: string, frac: number) => {
    const width = (frac / span) * int;
    out.push({ id, from: cursor, to: cursor + width });
    cursor += width;
  };
  push('establish', W.establish);
  for (let i = 0; i < n; i += 1) push(`station-${i + 1}`, W.station);
  push('portrait', W.portrait);

  // Floating-point drift over eight additions lands a few thousandths short;
  // the last chapter owns the remainder so the track always closes exactly on
  // JOURNEY_END.
  if (out.length > 0) out[out.length - 1].to = JOURNEY_END;
  return out;
}
