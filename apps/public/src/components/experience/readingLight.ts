// apps/public/src/components/experience/readingLight.ts
//
// THE WORLD AT A READING LIGHT.
//
// The film is lit for its pictures, and its copy is placed, chapter by
// chapter, on the quiet ground of each one. The site's other pages are for
// reading — a column of copy down the middle of the same world — and five of
// them stood that copy straight on the picture at the film's own light.
// Measured on clean plates (the glyphs made transparent, every panel kept):
// /properties, /locations, /branches and /hall over the ivory hall at full
// house lights, and /start-here over the daylit house, with their copy at
// 1.1 to 1.9:1 against a p90 luma of 190 to 217.
//
// The fourth art-direction critique names the fix first in its list:
// "dynamically dim the 3D lighting behind the text". So on a reading page the
// world comes down to a reading light, the way a room's lights are lowered for
// a lecture and the lamps left on:
//
//   INSIDE, the house lights go to HALL_READING (hallLight.ts): the plaster
//   falls to the dim grey the film's own establishing shot stands its copy on,
//   and the room is carried by its chandelier, its sconces and the tables'
//   plans, which keep their print.
//
//   OUTSIDE, on a page that shares the film's place without being the film
//   (/start-here), the camera holds the film's first frame and the estate
//   stands at the film's own night (READING_TIME): the sky gone down, the
//   rooms lit, their light pooled on the terrace — a picture that is dark
//   where the copy stands because it is night there, not because a daylight
//   plate was printed down. READING_STOPS trims the print under that, if the
//   lit house still needs it — and its lit windows, which no trim brings
//   down, are held under a ceiling (READING_CEILING).
//
// The film itself (the home page) is not a reading page, and none of this
// touches it.

export const readingLight = {
  /** Stops under, wanted for this route (WorldCanvas writes it). */
  want: 0,
  /** Stops under, now (FilmGrade eases toward `want`). */
  stops: 0,
};

/** A film-path page that is not the film: where on the exterior leg its time
 *  of day is held (past NIGHT_TO in WorldCanvas: full night). */
export const READING_TIME = 0.97;
/** And the print this many stops under, on top of the night: the lit facade
 *  stands behind the list of layouts (measured at 390x844: its place lines
 *  over a p90 luma of 107 at the night's own print, 2.8:1; clear at one stop
 *  under). */
export const READING_STOPS = 1;
/**
 * AND ITS HIGHLIGHTS HELD. A lit window is a light source: at one stop under
 * it still printed at a luma of 111 behind the third layout's place line at
 * 1440x900 (2.7:1), and which line a window stands behind changes with the
 * size of the screen. So on that page the print has a ceiling, in its own
 * gamma, over the whole frame — the shoulder the header's band already puts
 * on a window behind the controls (lensFilter.ts, HEADER_BAND.ceiling):
 * nothing prints above it, and below its knee nothing moves. At 0.3 (a luma
 * of 77) the page's quietest line — ivory at 75% — stands at 4.9:1 on the
 * brightest thing the picture can put behind it, on every screen.
 */
export const READING_CEILING = 0.3;

/** Is this route the film itself? */
export function isFilmRoute(pathname: string): boolean {
  return pathname === '/' || pathname === '/site-home';
}
