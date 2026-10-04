// apps/public/src/components/experience/codaFrame.ts
//
// THE FILM'S LAST FRAME: where the camera goes when the page scrolls on past
// the film's end, into the colophon.
//
// The coda was written as a move — the house lights go down round the map
// table, the camera rises off it and eases back — and its last frame was left
// to fall where the move ended: the table in the middle of the frame, a third
// of the way up from its foot. The colophon is set on that picture with no
// ground of its own (SiteFooter, FilmColophon), and that is where its links,
// its offices and its legal line stand. Measured on the clean plates at the
// page's end: at 1440x900 `About` on the table's rim at a p90 luma of 115
// (3.4:1); at 1536x730 `Gallery` on the lit relief at 207 (1.3:1); at 390x844
// ten lines on it at 178 to 207, down to 1.15:1.
//
// "Position the camera so the text naturally sits over darker areas" (the
// fourth art-direction critique). So the coda's last frame is COMPOSED, for
// the colophon that will stand on it:
//
//   ON A WIDE FRAME the camera turns off the table as it rises, down and to
//   the left, and the table goes up the frame and across it: it ends beside
//   the sign-off, in the same band of the frame's height, with the right-hand
//   half of that band to itself — and under both of them the court's dark
//   stone, the foot of the frame, for the links, the offices and the legal
//   line. Measured on a frame of the design's proportions, the rim from 54 to
//   83% across and 22 to 51% down: clear of the sign-off's column (which ends
//   at 39%) and of the first row of links, which at the page's end stands at
//   67% of a 1440x900 frame, 63% of a laptop's 1536x730 and 55% of a 13-inch
//   one's 1280x593.
//
//   ON A PHONE HELD UPRIGHT the colophon runs the frame's whole width, so
//   there is no beside. The camera keeps the aim it had and the phone's lens
//   (phoneFraming.ts) does the placing instead, as it does for every other
//   chapter of the hall: the front shifts the other way and the field closes,
//   and the table rises from under the list of layouts to the upper part of
//   the frame, the width of the screen, with the sign-off coming to stand
//   beneath it (PHONE_CODA). A tablet held upright is laid out as a phone is
//   but has the room: there the same lens puts the table on the right, beside
//   the sign-off (TABLET_CODA).
//
// What neither can do — a colophon taller than the frame still rides up
// through the place the table stands — the lens does (lensFilter.codaFilter).

import type { Vector3 } from 'three';

/**
 * WHEN: the coda against the page's scroll past the film's end, in viewports
 * (of 1.1 of the frame's height, the journey driver's unit). It begins a third
 * of one late, so the list of layouts has left before the lights go, and is
 * over three-quarters of one later.
 *
 * It ran over nine-tenths. The colophon's sign-off comes up the frame while
 * the camera moves, and at nine-tenths the camera was still travelling when
 * the sign-off stood whole in the frame — on a phone it came to rest at the
 * very moment the sign-off's first line reached the table (measured at
 * 390x844: the move done with the eyebrow at 43% of the height, the table's
 * foot at 43%). At three-quarters the frame is composed first and the words
 * arrive in it: the move is done with the eyebrow at 59% on that phone and on
 * a laptop's 1536x730 alike, the whole sign-off in view under or beside a
 * table that has stopped.
 */
export const CODA_SCROLL = { from: 0.3, over: 0.75 } as const;

/** The coda's progress, 0..1, for a page scrolled `past` the film's end. */
export function codaProgress(past: number): number {
  return Math.min(1, Math.max(0, (past - CODA_SCROLL.from) / CODA_SCROLL.over));
}

/** How far left of its target the hall's camera aims, metres along its own
 *  right vector: the subject right of centre, the copy's column over what is
 *  left of it (WorldCanvas). The coda's aim starts from here. */
export const HALL_AIM_OFFSET = 0.55;

/** The camera's move through the coda, metres: up off the table, back from
 *  it, and a little across. */
export const CODA_CAMERA = { x: 0.5, y: 1.25, z: 1.4 } as const;

/**
 * Where the aim goes through the coda: what is added to the path's own target
 * (metres), and the aim's offset at the end.
 *
 * `wide` was solved for the rim's place on the design's frame (above) and
 * looked at on the built hall at 1440x900, 1536x730, 1366x657, 1280x593 and
 * 1024x768. `upright` is the aim the coda always had: on a phone the lens
 * places the table, not the aim.
 */
export const CODA_AIM = {
  wide: { y: -2.1, z: -0.4, offset: 1.83 },
  upright: { y: 0.2, z: -0.4, offset: HALL_AIM_OFFSET },
} as const;

/** The coda's progress (journeyState.coda, 0..1), eased: the move comes to
 *  rest at both ends. */
export function codaEase(coda: number): number {
  const c = Math.min(1, Math.max(0, coda));
  return c * c * (3 - 2 * c);
}

/**
 * Carry the path's last pose `e` of the way through the coda (0..1, eased):
 * `position` and `look` are moved in place, and the aim's offset is returned.
 * `upright` is how much of a phone's lens this frame takes (phoneFraming's
 * phoneWeight: 1 on a phone held upright, 0 on anything landscape).
 */
export function codaPose(e: number, upright: number, position: Vector3, look: Vector3): number {
  const u = Math.min(1, Math.max(0, upright));
  position.x += CODA_CAMERA.x * e;
  position.y += CODA_CAMERA.y * e;
  position.z += CODA_CAMERA.z * e;
  look.y += (CODA_AIM.upright.y * u + CODA_AIM.wide.y * (1 - u)) * e;
  look.z += (CODA_AIM.upright.z * u + CODA_AIM.wide.z * (1 - u)) * e;
  const offset = CODA_AIM.upright.offset * u + CODA_AIM.wide.offset * (1 - u);
  return HALL_AIM_OFFSET + (offset - HALL_AIM_OFFSET) * e;
}
