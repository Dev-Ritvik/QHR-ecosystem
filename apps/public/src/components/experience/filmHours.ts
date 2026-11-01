// apps/public/src/components/experience/filmHours.ts
//
// THE FILM'S HOURS, ON ONE CLOCK: THE CAMERA'S.
//
// The user, 2026-11-01, with three references (the layout at golden hour, the
// same frame at twilight, the door at midnight): "Here we will transition from
// Golden hour to Twilight blue hour then from there we will transition to
// midnight night state. The transition must be smooth and seamless."
//
// So the light goes while the film goes, and nothing else keeps time: every
// part of the picture that changes with the hour (the sky, the air, the sun and
// the sky's light, the print, the lit rooms, the lamps, the pool) is a function
// of these two numbers, which are a function of where the camera is on the
// exterior leg. Scroll back and the sun comes up again. There is no moment at
// which anything is switched: only ends of smooth curves.
//
//   twilight   0 golden hour .. 1 the blue hour, the sun gone. It goes over the
//              layout's own words (they stand over leg 0.585 to 0.672: journey.ts,
//              COPY_SPAN), so the frame the visitor arrives on is the golden one
//              and, whole just before the words go, the frame they leave is the
//              blue.
//   midnight   0 the blue hour .. 1 midnight. It goes over the descent and the
//              forecourt, and is whole when "The door is open." comes up (leg
//              0.86: journey.ts).
//
// Everything before the first of these is the approved golden film, untouched:
// the cover and the revolution have both at exactly 0. So has every page of the
// site, which holds the film's first frame (readingLight.ts, READING_TIME).

export const HOURS = {
  twilight: [0.565, 0.655],
  midnight: [0.69, 0.86],
} as const;

function smooth(from: number, to: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** How far the golden hour has gone to twilight, at this point of the exterior leg. */
export function twilightAt(leg: number): number {
  return smooth(HOURS.twilight[0], HOURS.twilight[1], leg);
}

/** How far the twilight has gone to midnight, at this point of the exterior leg. */
export function midnightAt(leg: number): number {
  return smooth(HOURS.midnight[0], HOURS.midnight[1], leg);
}

/**
 * FROM THE ORBIT'S END TO THE LAYOUT, THE HEADER'S BAND IS THE SKY'S OWN FALL (lensFilter.ts,
 * HEADER_BAND). The frame of the user's reference (2026-11-01) comes straight after the
 * orbit's line: no words in the sky, and its bright horizon the brightest thing there is.
 * Across it the band was a lid with an edge, a grey bar; opened over the middle it was a storm
 * cloud in each corner. Let out to the horizon it is what a sky does at this hour, deep
 * overhead and cream at its foot. (Here because the hour control reads it too, and that is in
 * the page's own bundle, where the lens's module would bring three.)
 */
export const BAND_SKY = { full: 0.02, zero: 0.28, on: [0.285, 0.32], off: [0.53, 0.58] } as const;

export function bandSkyAt(legS: number): number {
  return smooth(BAND_SKY.on[0], BAND_SKY.on[1], legS) * (1 - smooth(BAND_SKY.off[0], BAND_SKY.off[1], legS));
}

/**
 * The sky's light at each hour against the golden hour's, by the plates' own
 * mean (tools/gltf/grade_sky_hours_v12.py). A reflection is a photograph taken
 * every so often as the hour moves (exteriorWater.ts, HOUR_STEP), and between
 * takes it is held at the sky's strength, by the ratio of this now to this when
 * it was taken: without it, each new take would be a step down.
 */
export const SKY_LIGHT = { twilight: 0.24, midnight: 0.03 } as const;

export function skyLightAt(twilight: number, midnight: number): number {
  return 1 - twilight + twilight * (SKY_LIGHT.twilight + (SKY_LIGHT.midnight - SKY_LIGHT.twilight) * midnight);
}

/**
 * THE VISITOR'S OWN HOUR (the brief of 2026-11-01; HourChoice.tsx). 'film' is the two
 * curves above, and nothing here touches them: the whole of the film for anyone who
 * never presses. Any other holds the estate at that hour, wherever the camera is, until
 * it is pressed again. It stands over the film's hour by `held`, so going to it and
 * coming back are one dissolve, and a third number, `noon`, takes the golden hour on to
 * the middle of the day: every part of the picture that follows the hour follows these.
 */
export type HourChoice = 'film' | 'day' | 'golden' | 'night';

/** The dissolve's time constant, seconds: about three of them to arrive. */
export const HOUR_TURN_S = 0.5;

export const hourChoice = {
  want: 'film' as HourChoice,
  /** How far the asked hour stands over the film's, 0..1. */
  held: 0,
  evening: 0,
  night: 0,
  noon: 0,
  /** Whether the day's plate is in (SkyHours.tsx): the sky has nothing to go to till it is. */
  noonReady: false,
  /** Whether the light is on its way, so the sun's shadow is drawn as it moves. */
  moving: false,
};

const hourListeners = new Set<() => void>();

export function setHourChoice(c: HourChoice): void {
  if (hourChoice.want === c) return;
  hourChoice.want = c;
  hourListeners.forEach((fn) => fn());
}

export function onHourChoice(fn: () => void): () => void {
  hourListeners.add(fn);
  return () => {
    hourListeners.delete(fn);
  };
}

const hourNow = { evening: 0, night: 0, noon: 0 };

/** The hour the picture is at here, for what stands over it (the lens's grads were each
 *  ridden to the film's hour, and a held hour is a different picture under them). */
export function twilightHeld(leg: number): number {
  const t = twilightAt(leg);
  return t + (hourChoice.evening - t) * hourChoice.held;
}

export function midnightHeld(leg: number): number {
  const m = midnightAt(leg);
  return m + (hourChoice.night - m) * hourChoice.held;
}

/** How much brighter than dusk a held hour is: 1 at Day and Golden, 0 at Night and with
 *  the film's own hours. */
export function heldBright(): number {
  return hourChoice.held * (1 - hourChoice.evening);
}

/**
 * One frame of it: the film's own hour in, the hour to light the estate at out. `own`
 * is false on a page that holds the film's frame: the choice is the film's alone.
 * Pure of everything but hourChoice, for the test.
 */
export function stepHourChoice(dt: number, filmEvening: number, filmNight: number, own: boolean): typeof hourNow {
  const c = hourChoice;
  const want = own ? c.want : 'film';
  const k = 1 - Math.exp(-Math.max(0, dt) / HOUR_TURN_S);
  const to = (v: number, t: number) => (Math.abs(t - v) < 1e-3 ? t : v + (t - v) * k);
  const was = { held: c.held, evening: c.evening, night: c.night, noon: c.noon };
  c.held = to(c.held, want === 'film' ? 0 : 1);
  if (want === 'film') {
    // (the sun comes back from noon as it goes)
    c.noon = to(c.noon, 0);
    if (c.held === 0) {
      c.evening = filmEvening;
      c.night = filmNight;
    }
  } else {
    c.evening = to(c.evening, want === 'night' ? 1 : 0);
    c.night = to(c.night, want === 'night' ? 1 : 0);
    c.noon = to(c.noon, want === 'day' && c.noonReady ? 1 : 0);
  }
  c.moving = c.held !== was.held || c.noon !== was.noon || (c.held > 0 && (c.evening !== was.evening || c.night !== was.night));
  hourNow.evening = filmEvening + (c.evening - filmEvening) * c.held;
  hourNow.night = filmNight + (c.night - filmNight) * c.held;
  hourNow.noon = c.noon;
  return hourNow;
}
