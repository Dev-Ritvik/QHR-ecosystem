// apps/public/src/components/experience/railMath.ts
//
// THE RAIL, AS ARITHMETIC: where its marker stands and which of its stops is
// the current one, for a place on the page. Pure, so the rail's one promise —
// that it says where you are — is tested without a browser.

/** For a stop's `at`: the end of the page (on the film, its colophon). Said as
 *  a number the page can pass to the rail, and resolved there against the
 *  document. */
export const RAIL_END = -1;

/** One stop on the rail: a chapter of the film, or a section of a page. */
export interface RailStop {
  /** The id of the element it stands for (and the fragment its link carries). */
  id: string;
  /** What it is called, in the rail and to a screen reader. */
  label: string;
  /** Where it becomes the current stop. */
  from: number;
  /** Where a press on it lands — and where the marker sits exactly on its dot. */
  at: number;
}

/**
 * Where the marker stands along the rail, in stops: 0 on the first dot, 1 on
 * the second, 1.5 half-way between the second and the third.
 *
 * It is measured between the places a press LANDS (`at`), not between the
 * places chapters begin: so the marker is on a dot exactly when the page is
 * where that dot would have taken it, and a visitor who presses a dot sees the
 * marker arrive on it.
 */
export function railPosition(stops: readonly Pick<RailStop, 'at'>[], place: number): number {
  const n = stops.length;
  if (n === 0) return 0;
  if (!(place > stops[0].at)) return 0;
  for (let i = 0; i < n - 1; i += 1) {
    const a = stops[i].at;
    const b = stops[i + 1].at;
    if (place < b) return b > a ? i + (place - a) / (b - a) : i;
  }
  return n - 1;
}

/** Which stop is the current one: the last whose `from` has been reached. */
export function railCurrent(stops: readonly Pick<RailStop, 'from'>[], place: number): number {
  let current = 0;
  for (let i = 0; i < stops.length; i += 1) {
    if (place >= stops[i].from) current = i;
  }
  return current;
}

/**
 * How a press on a stop should be answered on the film.
 *
 * `glide` for a neighbour on the same side of the front door: the page scrolls
 * there and the camera follows its path, as under the wheel. `cut` for
 * anything else: the camera is sprung toward where the scroll says it should
 * be, and a scroll that jumped eight chapters would spring it there in a
 * straight line, through the house.
 */
export function railMove(
  fromIndex: number,
  toIndex: number,
  fromPlace: number,
  toPlace: number,
  crossover: number,
): 'glide' | 'cut' {
  const sameSide = fromPlace < crossover === toPlace < crossover;
  return sameSide && Math.abs(toIndex - fromIndex) <= 1 ? 'glide' : 'cut';
}

/** How long a glide takes, seconds, for a distance in notches (thirds of a
 *  viewport): the film's own pace under an unhurried wheel, never a lurch and
 *  never a tour. */
export function railGlideSeconds(notches: number): number {
  return Math.min(4.2, Math.max(1.1, Math.abs(notches) * 0.42));
}
