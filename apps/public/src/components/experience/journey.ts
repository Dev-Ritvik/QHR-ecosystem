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

import { CHAPTER_WEIGHTS, FILM_SHARE } from './filmShares';

export type Leg = 'exterior' | 'interior';

export interface JourneyState {
  leg: Leg;
  /** 0..1 within the active leg. */
  legProgress: number;
  /** 0..1 blackout. 1 at the crossover, 0 outside the band. */
  veil: number;
  /** True once the interior should be mounted, whether or not it is visible. */
  armed: boolean;
  /** 0..1 how far the page has scrolled on past the film into its footer —
   *  the coda, in which the house lights go down round the map table and the
   *  camera rises off it (WorldCanvas). Written by the journey driver. */
  coda: number;
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
  coda: 0,
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
  const out: JourneyState = { leg: 'exterior', legProgress: 0, veil: 0, armed: false, coda: 0 };
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
  /** The stretch of scroll this chapter's copy is up for (ChapterFade, which
   *  develops it in place): nothing before in[0], whole from in[1]; whole
   *  until out[0], gone from out[1]. Document scroll, like `from` and `to`. */
  copy: { in: [number, number]; out: [number, number] };
}

/** One notch of a mouse's wheel, as a fraction of the track: a third of a
 *  viewport. What the copy's windows below are given in. */
const NOTCH = 100 / 3 / TRACK_VH;

/**
 * WHEN EACH CHAPTER'S COPY IS UP, on the camera that never stops.
 *
 * THE CAMERA IS THE ONE THE CLIENT APPROVED (2026-10-06: "change the cam path
 * keep it like the one before this one is slow and laggy also why this cam
 * stop for a brief moment? the client didn't like it"). For two days the film
 * was scored in rests and moves, for an audit that asked every chapter to
 * "arrive, then speak": the camera stood still while each chapter's copy was
 * read. On a wheel that is a page that scrolls and a picture that does not
 * answer, and then lags into a move from a standing start. It is one
 * continuous move per leg again (cameraPath.ts, interiorPath.ts), on the
 * track it was approved on.
 *
 * What is kept from that audit is how the copy comes and goes: it does not
 * ride up the frame and away any more. Each chapter's pane is pinned for its
 * whole chapter (site-home) and its words develop in place and dissolve in
 * place, over half a notch each way, while the camera goes on behind them.
 *
 * So a chapter's copy is up for the stretch of its chapter in which the
 * picture behind it is the one it was set on, given here per chapter in
 * notches: how long after the chapter begins its copy starts to come up, and
 * how long before the chapter ends it has gone. The default is a pinned
 * pane's old life — up as the chapter begins, gone a viewport before it ends,
 * which is when the camera has left for the next.
 */
const COPY_RISE = 0.5;
const COPY_FALL = 0.5;
const COPY_SPAN: Readonly<Record<string, { after: number; before: number; rise?: number }>> = {
  default: { after: 0.1, before: 3 },
  // The orbit's line stands in the sky, and the sky it stands in is the
  // morning's: by leg 0.29 the camera has come round far enough for the
  // sunset to stand behind it (measured at 1920x945 on the restored path:
  // its gilt word on a ground of 127 at 0.29, 147 at 0.305, under a grad the
  // lens is already riding up: lensFilter.ts, COVER_SKY.ride). Gone before.
  revolution: { after: 0.1, before: 3.9 },
  // The figures stand on the evening's land from the crane's first slowing to
  // the frame it all but rests on, and go as the descent gathers way.
  holdings: { after: 0.5, before: 0.6 },
  // "The door is open." comes up as the camera turns onto the door's axis
  // (leg 0.86), not while it is still coming down the west side; the passage
  // takes it (the window's end is set in `chapters`).
  approach: { after: 6.7, before: 0 },
  // The hall's line: up once the door has landed the page, gone before the
  // turn to the first table (leg 0.10).
  establish: { after: 0.3, before: 2.5 },
  // A table's name, for as long as the camera dwells on it.
  station: { after: 0.1, before: 1.5 },
  // The last table has no dwell: the camera withdraws from it at once, and
  // its name leaves with the camera, as it always did.
  // (Up in a quarter of a notch: the camera is on this table for one.)
  'station-last': { after: 0, before: 2.5, rise: 0.25 },
  // The portrait's line stands through the climb and for the beat the camera
  // holds on the picture, which outlasts the chapter (its pane lingers:
  // site-home, `track`).
  portrait: { after: 0.3, before: -0.5 },
  // The index: up once the camera is over the table, and for a notch after
  // the film's last frame has landed, before the house lights go down.
  city: { after: 1.5, before: -1.2 },
};

/** The copy's window for a chapter laid out `from`..`to`. */
function copyWindow(id: string, from: number, to: number, last = false): Chapter['copy'] {
  const kind = /^station-/.test(id) ? (last ? 'station-last' : 'station') : id;
  const span = COPY_SPAN[kind] ?? COPY_SPAN.default;
  const start = from + span.after * NOTCH;
  const whole = start + (span.rise ?? COPY_RISE) * NOTCH;
  const gone = Math.max(whole + COPY_FALL * NOTCH, to - span.before * NOTCH);
  return { in: [start, whole], out: [gone - COPY_FALL * NOTCH, gone] };
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
    // (The cover's copy is up when the page opens: nothing to come in.)
    { id: 'hero', from: 0, to: film * 0.3, copy: { in: [-2 * NOTCH, -NOTCH], out: copyWindow('hero', 0, film * 0.3).out } },
    { id: 'revolution', from: film * 0.3, to: film * 0.62, copy: copyWindow('revolution', film * 0.3, film * 0.62) },
    { id: 'holdings', from: film * 0.62, to: holdEnd, copy: copyWindow('holdings', film * 0.62, holdEnd) },
    {
      id: 'approach',
      from: holdEnd,
      to: DOOR_IN,
      // The door's copy is not let go by the scroll at all: the passage takes
      // it (globals.css, THROUGH THE FRONT DOOR). Its window closes inside the
      // doorway's own viewport, which only a visitor with reduced motion
      // scrolls.
      copy: { in: copyWindow('approach', holdEnd, DOOR_IN).in, out: [DOOR_OUT + 0.2 * NOTCH, DOOR_OUT + 0.9 * NOTCH] },
    },
  ];

  // Interior: establish, one per station, the portrait, then the threshold.
  // Matches the proportions buildInteriorBeats lays out.
  // The SAME weights the camera path uses, imported rather than restated. They
  // were duplicated once and immediately drifted; see the note on
  // CHAPTER_WEIGHTS.
  const span = W.establish + n * W.station + W.portrait + W.city;
  let cursor = DOOR_IN;
  const push = (id: string, frac: number, last = false) => {
    const width = (frac / span) * int;
    out.push({ id, from: cursor, to: cursor + width, copy: copyWindow(id, cursor, cursor + width, last) });
    cursor += width;
  };
  push('establish', W.establish);
  for (let i = 0; i < n; i += 1) push(`station-${i + 1}`, W.station, i === n - 1);
  push('portrait', W.portrait);
  // THE DISTRICT FIELD, seen through the entry doors. The last chapter of the
  // film and the one Phase 6 recorded as missing entirely.
  push('city', W.city);

  // Floating-point drift over eight additions lands a few thousandths short;
  // the last chapter owns the remainder so the track always closes exactly on
  // JOURNEY_END.
  if (out.length > 0) {
    const end = out[out.length - 1];
    end.to = JOURNEY_END;
    end.copy = copyWindow(end.id, end.from, JOURNEY_END);
  }
  return out;
}


/**
 * HOW LONG A TABLE'S COPY OUTLASTS ITS BEAT, as a fraction of the interior
 * leg. A station's chapter begins on its beat, and its copy is up for the
 * window `chapters` gives it (COPY_SPAN: as long as the camera dwells on the
 * table). The house lights and the lens's edge hold for exactly that long
 * (hallLight.ts).
 */
export function tableCopyHold(stations: number): number {
  const list = chapters(Math.max(1, stations));
  const table = list.find((c) => c.id === 'station-1');
  if (!table) return 0;
  return Math.max(0, table.copy.out[1] - table.from) / (JOURNEY_END - DOOR_IN);
}

/**
 * WHERE THE ESTABLISHING COPY HAS GONE, as a fraction of the interior leg (its
 * window's end: COPY_SPAN). The house lights come up from here (hallLight.ts):
 * the turn to the first table is made in a lit room.
 */
export function establishCopyGone(stations: number): number {
  const hall = chapters(stations).find((c) => c.id === 'establish');
  if (!hall) return 0;
  return Math.max(0, hall.copy.out[1] - DOOR_IN) / (JOURNEY_END - DOOR_IN);
}
