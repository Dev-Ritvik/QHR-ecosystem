// apps/public/src/components/experience/hallLight.ts
//
// THE HALL'S HOUSE LIGHTS, ON A DIMMER.
//
// The second art-direction audit (2026-09-30) found the interior "flat and
// overly warm/yellow" and asked for it "moodier, mood-lit, and museum-like";
// it also had the scrims behind the copy removed, and the hall is ivory
// plaster — at the print the tables were approved at, the establishing shot
// measured luma 182, with the copy over it unreadable.
//
// The tables were approved as they are, and stay exactly so: the film's
// exposure is untouched. What dims is the ROOM'S OWN LIGHT — the bake that
// lights its walls, stair and ceiling, and the reflections of that room on its
// joinery — the way a gallery lowers its house lights. Everything that makes
// light rather than receiving the room's keeps its print: the chandelier and
// the sconces, the portrait's picture light and its beam, the clerestory's
// shafts, and the stations' plans, beams and lettering. So in the ivory room
// (the threshold, the establishing shot, the climb, the portrait, the doors)
// the plaster falls to a dim grey the copy can stand on and the room is carried
// by its lamps; at the tables against the walnut panelling the house lights
// are up, and those frames are exactly the frames that were approved.
//
// AND NO DARKER THAN THE COPY NEEDS (the client, 2026-10-01: "the darkness is
// much more than required and it gives out creepy vibes", of the turn to the
// first table; "this also looks too dark", of the second). The dim is for the
// copy that stands on the plaster and for nothing else: where no copy is up
// the lights are up (HALL_WALK), and the second table is lit as the others
// are.
//
// The level is written each frame by InteriorStage from the camera's place on
// the path; HallModel applies it. Uniform writes only: nothing recompiles.

import type * as THREE from 'three';
import type { InteriorBeat } from './interiorPath';

export const hallLight = {
  /** 0..1 of the room's own light. */
  level: 1,
};

/** The ivory room's level on a reading page, and the floor of the film's. */
// Low, because ivory at full is far up the curve's shoulder: at 0.14 the
// establishing shot still measured luma 144 behind the copy (under the sun's
// shafts, which were then the room's fill: see HALL_DOWN).
export const HALL_DIM = 0.05;
/**
 * THE IVORY ROOM'S LEVELS ON THE FILM, BEAT BY BEAT.
 *
 * One level did for all of them (HALL_DIM) while the clerestory was the sun's:
 * with the house lights at a twentieth, what lit the room was the shafts, a
 * warm haze over the whole frame, and the white of the panes. The refinement
 * brief (2026-10-03, "reduce beam/glowing windows") took both away — the panes
 * are the sky after sunset and the shafts a fifth of what they were
 * (HallModel.DUSK_GLASS, WindowLight.SHAFT) — and at a twentieth the room
 * without them MEASURED a fifth of its old light at the establishing shot and
 * a third on the climb: the dark the client had already sent back once ("the
 * darkness is much more than required and it gives out creepy vibes").
 *
 * So each of the ivory room's beats has the level at which its frame carries
 * the light it had, now from the room's own lamps: measured on the clean plate
 * at 1920x1080 against build 48, in the copy's part of the frame and over the
 * whole of it, with every line of its copy still at AA. The establishing
 * shot stood at 0.14 for a day's frame of 1920 (its statement 5.4:1; 3.6:1
 * at 0.20), and on a laptop's 1536x730 — where the statement is small text
 * and one of its words stands on the stair's pale foot — that word measured
 * 4.21:1; at 0.11 the stone under it is back under a luma of 105. The
 * portrait's beat is all but where it was: its frame is the picture lamp's.
 */
export const HALL_DOWN: Readonly<Record<string, number>> = {
  threshold: 0.11,
  establish: 0.11,
  withdraw: 0.11,
  'stair-foot': 0.11,
  'stair-rise': 0.11,
  portrait: 0.08,
  court: 0.09,
  // The table is the last frame's light and its copy stands on the dim room
  // beside it: at 0.10 the wall under the list was twice what it had been, and
  // a place's name measured 4.45:1 on a 1280 laptop.
  map: 0.07,
};
/**
 * THE COURT'S FLOOR THROUGH THE CODA. Past the film's end the house lights go
 * down round the map table (InteriorStage) — to this share of the map's own
 * level, and not to nothing. They went to a tenth of it, and the audit of
 * 2026-10-05 (P1) saw what that left: "the hall dims to black and the round
 * table floats in empty space with no floor. Done when the table stays
 * grounded on its floor as the lights go down, lit by one remaining source."
 * The table's lamp is that source; at this level the stone it stands on is
 * still there to stand on.
 *
 * AND NO BRIGHTER THAN THAT (the client, 2026-10-06, with two pictures: "make
 * this dark like this"). When the lit room came back, this share was set at
 * 0.45 of it, and the last frame was a grey marble court with the stair
 * beside it and the colophon lying across both. His picture of how it should
 * be was that audit's own ending: the room gone, the table lit, the floor
 * only just there. Measured on its last frame at 1920x945: a median luma of
 * 4.0, the brightest tenth from 13, the floor right of the table 7.9. Dialled
 * on the running build (`window.__estateHall.level`): 0.45 gave 12.6, 38.5
 * and 18.3; 0.20 gives 3.9, 16.9 and 8.4; 0.15 gives 2.1, 12.0 and 6.9. So
 * 0.18. (A tenth, where it stood before either, is 1.1, 7.0 and 5.3: the
 * table afloat.)
 */
export const HALL_CODA = 0.18;
/**
 * THE WALK TO THE FIRST TABLE, with no copy up. It was made at HALL_DIM — the
 * key was simply "down at the turn" — and a room at a twentieth of its light
 * with nothing to read in it is not a gallery, it is a house with the power
 * off: the client, 2026-10-01, of the frame at leg 0.13: "the darkness is much
 * more than required and it gives out creepy vibes". The lights come up as the
 * establishing copy leaves, to this at the turn and to full at the table.
 */
export const HALL_WALK = 0.62;
/**
 * THE SECOND TABLE'S LEVEL. It stood at 0.15 with no filter on the lens: the
 * whole room taken down for the sake of its copy's column ("this also looks
 * too dark kindly reduce it", the client, 2026-10-01). Its copy has the lens's
 * edge now (lensFilter.STATION_ND) and the room is brought up as far as the
 * plan allows: this table alone stands against ivory and its plan is light in
 * the air. Seen at four levels on the clean plate: at 0.35 the wall behind it
 * prints at a luma of 137 and the plan's own title still reads; at 0.5 (166)
 * the title is a ghost, and by 0.7 it has left the frame.
 *
 * 0.36 -> 0.34 with the hall's re-mixed light (2026-10-04; HallModel,
 * LIGHTMAP_INTENSITY): the lamps lead a little more, and the sconce by this
 * table put the wall behind its copy a sixth up.
 */
export const HALL_LEVEL_S2 = 0.34;
/** The room on a reading page (readingLight.ts): the ivory room's own level,
 *  because those pages stand a column of copy across the plaster. */
export const HALL_READING = HALL_DIM;
/**
 * THE HALL'S OWN PAGE (/hall) IS THE ROOM, not a column of copy across it: one
 * small block at the foot of a wide frame of the whole hall. At the reading
 * level that frame was lit as the film's establishing shot was, by the sun's
 * shafts and the white of the panes, and without them (HALL_DOWN, above) it
 * MEASURED two-thirds of its light: a frame mean of 22.0 against 32.3 on a
 * laptop's 1536x730, its brightest tenth 42 against 70. At 0.07 the frame
 * carries what it did (30.0, and 57), from the room's own lamps; at 0.08
 * (33.7) the caption's small lines, which on a phone and a tablet stand over
 * the lit marble, were down to 4.6:1, and a district's name on a phone held
 * sideways to 4.43:1. Every other reading page looks at a wall or stands a
 * surface over the room and measured as it had (0.81 to 0.98 of its old
 * frame): those keep HALL_READING.
 */
export const HALL_READING_ROOM = 0.07;

/** The house lights on a reading page that holds the hall (the route with
 *  its query, fragment and trailing slash taken off). */
export function hallReadingLevel(pathname: string): number {
  const route = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return route === '/hall' ? HALL_READING_ROOM : HALL_READING;
}

/**
 * THE HOUSE LIGHTS ALONG THE PATH, as [leg position, level] keys.
 *
 * They were keyed to the beats alone — up at each table, down at the ivory
 * room's own shots, eased freely in between — and the copy outlives the beat.
 * A sweep of the whole leg (26 frames, not the six the camera rests on) found
 * what that left: the room already coming up behind the establishing copy
 * (its note on a p90 luma of 142 at leg 0.10), each table's light and filter
 * falling away with its copy still up (142 at 0.25, 128 at 0.41, 143 at
 * 0.57), and the portrait's copy — pinned for the whole climb, from the foot
 * of the stair — developing over the hall at FULL house lights, 214 to 237
 * behind it at 0.67 and 0.72.
 *
 * So the lights follow the COPY, not only the beat:
 *   - down until the establishing copy has gone (`establishGone`,
 *     journey.ts establishCopyGone), then up through the turn to the first
 *     table (HALL_WALK at the turn, full on arrival);
 *   - at each table, held at that table's level for as long as its copy is up
 *     (`hold`, journey.ts tableCopyHold), then eased on;
 *   - down again by the time the portrait's copy develops — the withdrawal
 *     from the last table is the house lights going down — and down through
 *     the foot of the stair, the climb, the portrait and the map.
 * The tables' own frames: full at the first and the last, S2's level at the
 * second.
 */
export function houseKeys(
  beats: readonly InteriorBeat[],
  hold: number,
  establishGone = 0,
): [number, number][] {
  const keys: [number, number][] = [];
  const DOWN = /^(threshold|establish|withdraw|stair-foot|stair-rise|portrait|court|map)$/;
  const SETS = /^(threshold|establish|turn-left|withdraw|stair-foot|stair-rise|portrait|court|map)$/;
  for (let i = 0; i < beats.length; i += 1) {
    const b = beats[i];
    if (b.station) {
      const level = b.station === 'S2' ? HALL_LEVEL_S2 : 1;
      keys.push([b.at, level]);
      // Held while the copy is up — never past the next beat that sets a level.
      const next = beats.slice(i + 1).find((x) => x.station || SETS.test(x.id));
      const until = next ? Math.min(b.at + hold, b.at + (next.at - b.at) * 0.6) : b.at + hold;
      keys.push([until, level]);
    } else if (b.id === 'turn-left') {
      // The walk to the first table (HALL_WALK): the room held down until the
      // establishing copy has gone, then up.
      const establish = beats.find((x) => x.id === 'establish');
      if (establish && establishGone > establish.at && establishGone < b.at) {
        keys.push([establishGone, HALL_DOWN.establish]);
      }
      keys.push([b.at, HALL_WALK]);
    } else if (DOWN.test(b.id)) {
      keys.push([b.at, HALL_DOWN[b.id] ?? HALL_DIM]);
    }
  }
  return keys.sort((x, y) => x[0] - y[0]);
}

/** The level the keys ask for at `s`, eased between them. */
export function houseLevelAt(keys: readonly [number, number][], s: number): number {
  if (!keys.length) return 1;
  if (s <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    const [a0, v0] = keys[i];
    const [a1, v1] = keys[i + 1];
    if (s >= a0 && s <= a1) {
      const t = (s - a0) / Math.max(1e-6, a1 - a0);
      return v0 + (v1 - v0) * t * t * (3 - 2 * t);
    }
  }
  return keys[keys.length - 1][1];
}

type Base = { lightMap: number; env: number };
const tracked = new Map<THREE.MeshStandardMaterial, Base>();
let applied = -1;

/** Put a hall material on the dimmer, at its current strengths as full. */
export function trackHallMaterial(mat: THREE.MeshStandardMaterial): void {
  if (tracked.has(mat)) return;
  tracked.set(mat, { lightMap: mat.lightMapIntensity, env: mat.envMapIntensity });
  applied = -1;
}

/** A clone of a hall material goes on the
 *  dimmer at its ORIGINAL's full strengths — cloned mid-dim, its own current
 *  values would be the dimmed ones. */
export function trackHallClone(clone: THREE.MeshStandardMaterial, original: THREE.MeshStandardMaterial): void {
  const b = tracked.get(original);
  if (!b) {
    trackHallMaterial(clone);
    return;
  }
  tracked.set(clone, { ...b });
  applied = -1;
}

/** Take materials off the dimmer, restoring their full strengths. */
export function untrackHallMaterials(mats: Iterable<THREE.MeshStandardMaterial>): void {
  for (const m of mats) {
    const b = tracked.get(m);
    if (!b) continue;
    m.lightMapIntensity = b.lightMap;
    m.envMapIntensity = b.env;
    tracked.delete(m);
  }
}

/** Write a level to every tracked material (skipped when nothing changed). */
export function applyHallLevel(level: number, force = false): void {
  if (!force && Math.abs(level - applied) < 1e-4) return;
  applied = level;
  for (const [m, b] of tracked) {
    m.lightMapIntensity = b.lightMap * level;
    m.envMapIntensity = b.env * level;
  }
}

/** Run a render with the house lights full (the room's probe is photographed
 *  at full, since the dimmer scales what it reflects as well). */
export function withFullHall<T>(fn: () => T): T {
  const was = hallLight.level;
  applyHallLevel(1, true);
  try {
    return fn();
  } finally {
    applyHallLevel(was, true);
  }
}
