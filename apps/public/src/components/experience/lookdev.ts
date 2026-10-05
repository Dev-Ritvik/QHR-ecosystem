// apps/public/src/components/experience/lookdev.ts
//
// Look development on a running build.
//
// A look can only be judged on the real page, and a rebuild per guess is a loop
// measured in minutes. With `?debug=1` the values read through `ld` and
// `ldColour` can be moved from the console (or a capture script) while the film
// runs: `window.__estateLook = { fill: 1.6, hazeNight: '#3A3F4A' }`. Without the
// flag every read returns the value the code ships with, and the object does
// not exist.
//
// Constants that are compiled INTO a shader (the sun's penumbra, the cloud's
// shade) cannot move live — three would have to rebuild every program — so
// those are read once from the query string instead (`ldQuery`): reload to
// change one.

import * as THREE from 'three';

const search = (): URLSearchParams | null =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);

const enabled = search()?.get('debug') === '1';

/** The live values. Keys are whatever the readers ask for. */
export const lookdev: Record<string, number | string | undefined> = {};

if (enabled) (window as unknown as { __estateLook?: unknown }).__estateLook = lookdev;

/** Whether look development is on for this page (`?debug=1`). */
export function lookdevOn(): boolean {
  return enabled;
}

/** A number: the live value if one has been set, otherwise what ships. */
export function ld(key: string, fallback: number): number {
  if (!enabled) return fallback;
  const v = lookdev[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

const colours = new Map<string, { src: string; colour: THREE.Color }>();

/** A colour: the live one (a CSS colour string) if set, otherwise what ships.
 *  The returned object is shared; copy it, never write to it. */
export function ldColour(key: string, fallback: THREE.Color): THREE.Color {
  if (!enabled) return fallback;
  const v = lookdev[key];
  if (typeof v !== 'string') return fallback;
  let c = colours.get(key);
  if (!c || c.src !== v) {
    c = { src: v, colour: new THREE.Color(v) };
    colours.set(key, c);
  }
  return c.colour;
}

/** A constant compiled into a shader: from the query string under `?debug=1`
 *  (`&soften=3`), otherwise what ships. Read once, at module load. */
export function ldQuery(key: string, fallback: number): number {
  if (!enabled) return fallback;
  const v = parseFloat(search()?.get(key) ?? '');
  return Number.isFinite(v) ? v : fallback;
}
