// apps/public/src/components/experience/stills.ts
//
// THE PICTURE BEFORE THE PICTURE.
//
// The forensic audit of 2026-10-09 (#1, #2, #3, #4), MEASURED through a public
// address: a first-time visitor looked at a dark curtain for 12 to 17 seconds
// on every page, the film's and a page of small print alike, because the two
// models are 15 MB and 26 MB and nothing was shown until one was in and built.
// On a slower line the curtain reached its ceiling first and lifted on words
// over an empty frame.
//
// So every frame a visitor can OPEN ON has a still of itself: each page's
// plate, and each chapter of the film at the place its copy is whole. They are
// the build's own frames, shot from the running scene with nothing over them
// (scripts/stills/shoot.mjs; the list it wrote is stills.manifest.json), a
// hundred kilobytes each. A still is in the page's first paint, the scene
// arrives under it, and the still dissolves once the scene has been built and
// drawn (sceneWarm.ts) — the same moment the dark used to lift.
//
// This module is the arithmetic: which still a view is, and which cut of it a
// screen takes. No DOM, no React.

import { placeForRoute, type PlaceId } from '@estate/domain/experience/places';
import { JOURNEY_END, chapters } from './journey';
import manifest from './stills.manifest.json';

/**
 * THE CUTS. A perspective camera keeps its vertical field whatever the
 * screen, so a frame shot wide and shown on a narrower screen of the same
 * height loses only its sides: a cut is right for every screen up to its own
 * width over height, and a screen takes the narrowest cut that is at least as
 * wide as it is. (Exactly right for a page's plate, whose words and their
 * ground are the page's own. The film's frames carry the lens's density under
 * their copy, which is placed from the frame's edge, so the film has a cut for
 * each band of screens.) Upright screens are framed by their own rules
 * (phoneFraming.ts, plateBand.ts) and have their own three.
 */
export interface StillCut {
  id: string;
  /** The least width over height, in thousandths, of a screen that takes it. */
  from: number;
}

/** Widest first: the order a <picture> lists its sources in. */
export const CUTS: readonly StillCut[] = [
  { id: 'w27', from: 2210 },
  { id: 'w22', from: 1860 },
  { id: 'w18', from: 1610 },
  { id: 'w16', from: 1340 },
  { id: 'w13', from: 860 },
  { id: 'u70', from: 640 },
  { id: 'u59', from: 520 },
  { id: 'u46', from: 0 },
];

const UPRIGHT = /^u/;

export interface StillManifest {
  /** The folder under /stills the set is in: new with every shoot. */
  v: string;
  /** Each still's cuts. */
  keys: Record<string, string[]>;
}

const MANIFEST = manifest as StillManifest;

/** The film's own address (the middleware serves `/` from /site-home). */
export function isFilmPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/site-home';
}

/** The still of a page's opening frame. */
export function placeKey(place: PlaceId): string {
  return `place-${place}`;
}

/** The still of a chapter of the film. */
export function chapterKey(id: string): string {
  return `film-${id}`;
}

/**
 * Which chapter's frame a place on the film is: the chapter the scroll is in.
 * Past the film's end there is none — the last frame under the colophon is the
 * dark one (hallLight, HALL_CODA), and a lit still under those lines would be
 * the one thing the ending was set against.
 */
export function chapterAt(progress: number, stations: number): string | null {
  if (!(progress <= JOURNEY_END + 0.002)) return null;
  const p = Math.max(0, progress);
  const list = chapters(stations);
  for (const c of list) if (p < c.to) return c.id;
  return list.length ? list[list.length - 1].id : null;
}

/** The still a route opens on: its place's, or the film's cover. */
export function stillKeyForRoute(pathname: string): string {
  return isFilmPath(pathname) ? chapterKey('hero') : placeKey(placeForRoute(pathname));
}

/** The cuts a still has, widest first. */
export function cutsOf(key: string, m: StillManifest = MANIFEST): StillCut[] {
  const have = m.keys[key];
  if (!have) return [];
  return CUTS.filter((c) => have.includes(c.id));
}

/** The cut that is a screen's own, whether or not a still has it. */
export function ownCut(width: number, height: number): StillCut {
  const aspect = Math.round((width / Math.max(1, height)) * 1000);
  return CUTS.find((c) => aspect >= c.from) ?? CUTS[CUTS.length - 1];
}

/** Whether a cut is one of the upright screens'. */
export function isUprightCut(id: string): boolean {
  return UPRIGHT.test(id);
}

/**
 * The cut a screen takes: its own, or failing that the nearest wider one the
 * still has; and the widest there is for a screen wider than them all.
 */
export function cutFor(key: string, width: number, height: number, m: StillManifest = MANIFEST): string | null {
  const have = cutsOf(key, m);
  if (have.length === 0) return null;
  const own = CUTS.indexOf(ownCut(width, height));
  for (let i = own; i >= 0; i -= 1) {
    if (have.some((c) => c.id === CUTS[i].id)) return CUTS[i].id;
  }
  return have[0].id;
}

export function stillUrl(key: string, cut: string, m: StillManifest = MANIFEST): string {
  return `/stills/${m.v}/${key}.${cut}.webp`;
}

/** The still a screen takes for a view, or null where there is none. */
export function stillFor(key: string, width: number, height: number, m: StillManifest = MANIFEST): string | null {
  const cut = cutFor(key, width, height, m);
  return cut ? stillUrl(key, cut, m) : null;
}

/**
 * A still as a <picture> lists it: a source for each cut but the narrowest,
 * each taken from its own least proportion up, and the narrowest as the
 * image. The browser chooses before any script has run, and by the same rule
 * `cutFor` chooses by afterwards — a cut the still has not got is simply not
 * listed, and the screens that would have taken it fall to the next wider,
 * which is the rule.
 */
export function pictureOf(
  key: string,
  m: StillManifest = MANIFEST,
): { sources: { media: string; src: string }[]; src: string } | null {
  const have = cutsOf(key, m);
  if (have.length === 0) return null;
  const sources: { media: string; src: string }[] = [];
  for (let i = 0; i < have.length - 1; i += 1) {
    // A cut is taken down to the floor of the last cut ABOVE the next one the
    // still has: where cuts between the two are missing, it has their
    // screens as well.
    const next = CUTS.findIndex((c) => c.id === have[i + 1].id);
    const floor = CUTS[next - 1].from;
    sources.push({ media: `(min-aspect-ratio: ${floor}/1000)`, src: stillUrl(key, have[i].id, m) });
  }
  return { sources, src: stillUrl(key, have[have.length - 1].id, m) };
}

export const STILLS_VERSION = MANIFEST.v;
