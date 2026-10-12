// apps/public/src/components/experience/hallLight.test.ts
//
// The house lights follow the copy: down while the ivory room's copy is up, up
// through the turn once it has gone, held at each table for as long as its copy
// stands, and down again before the portrait's copy develops.

import { describe, expect, it } from 'vitest';
import { buildInteriorBeats } from './interiorPath';
import {
  HALL_CODA,
  HALL_DIM,
  HALL_DOWN,
  HALL_LEVEL_S2,
  HALL_LEVEL_S2_MODEL,
  HALL_PLATE,
  HALL_READING,
  HALL_READING_ROOM,
  HALL_WALK,
  hallReadingLevel,
  houseKeys,
  houseLevelAt,
} from './hallLight';
import { DOOR_IN, JOURNEY_END, chapters, establishCopyGone, tableCopyHold } from './journey';

const beats = buildInteriorBeats(3);
const hold = tableCopyHold(3);
const gone = establishCopyGone(3);
const keys = houseKeys(beats, hold, gone);
const at = (id: string) => beats.find((b) => b.id === id)!.at;
const level = (s: number) => houseLevelAt(keys, s);

describe('the house lights along the path', () => {
  it('lights the tables: full at the first and third, and the second no longer in the dark', () => {
    // The second stood at 0.15 until the client had it brought up (2026-10-01:
    // "this also looks too dark"); its copy has the lens's edge instead. Not
    // to full under a PROJECTED plan: that is light in the air, in front of an
    // ivory wall.
    expect(HALL_LEVEL_S2).toBeGreaterThanOrEqual(0.3);
    expect(HALL_LEVEL_S2).toBeLessThanOrEqual(0.4);
    const projected = houseKeys(beats, hold, 0, HALL_LEVEL_S2);
    expect(houseLevelAt(projected, at('station-S2'))).toBeCloseTo(HALL_LEVEL_S2, 6);
    // Under a site model, which is what the tables carry, the room is lit:
    // a model is a solid thing and there is nothing left to wash out (the
    // forensic audit of 2026-10-09, #42: "the wall behind the model is a
    // muddy grey, not ivory ... this is the darkest of the three tables").
    expect(HALL_LEVEL_S2_MODEL).toBeGreaterThanOrEqual(0.7);
    expect(HALL_LEVEL_S2_MODEL).toBeLessThanOrEqual(1);
    expect(level(at('station-S1'))).toBeCloseTo(1, 6);
    expect(level(at('station-S2'))).toBeCloseTo(HALL_LEVEL_S2_MODEL, 6);
    expect(level(at('station-S3'))).toBeCloseTo(1, 6);
  });

  it('stays down until the establishing copy has gone, and no longer', () => {
    // The establishing pane is released a viewport before its chapter ends
    // and its copy is gone a quarter of a viewport later.
    expect(gone).toBeGreaterThan(at('establish'));
    expect(gone).toBeLessThan(at('turn-left'));
    for (const s of [0, at('establish'), gone]) expect(level(s)).toBeCloseTo(HALL_DOWN.establish, 6);
  });

  it('gives the ivory room the light the sun used to: each of its beats a level of its own', () => {
    // With the shafts a quarter of what they were and the panes at dusk, a
    // twentieth of the house lights was a fifth of the old frame's light.
    // Above the floor at every beat, never near the tables' levels, and the
    // portrait and the map table - whose frames are their own lamps' - the
    // lowest of them.
    for (const [beat, v] of Object.entries(HALL_DOWN)) {
      expect(v, beat).toBeGreaterThan(HALL_DIM);
      expect(v, beat).toBeLessThan(0.2);
      expect(beats.some((b) => b.id === beat), beat).toBe(true);
    }
    expect(HALL_DOWN.portrait).toBeLessThan(HALL_DOWN.establish);
    expect(HALL_DOWN.map).toBeLessThanOrEqual(HALL_DOWN.portrait);
    // The establishing statement stands on that light: 0.20 left it 3.6:1 on
    // a monitor, and 0.14 one of its words 4.21:1 on a laptop.
    expect(HALL_DOWN.establish).toBeLessThanOrEqual(0.12);
  });

  it('makes the turn to the first table in a lit room', () => {
    // It was made at HALL_DIM, with nothing on screen to read: "the darkness
    // is much more than required and it gives out creepy vibes" (the client,
    // 2026-10-01, of the frame at leg 0.13).
    expect(HALL_WALK).toBeGreaterThan(0.5);
    expect(level(at('turn-left'))).toBeCloseTo(HALL_WALK, 6);
    expect(level(0.13)).toBeGreaterThan(0.3);
    // And it only rises from there to the table.
    let last = level(gone);
    for (let s = gone; s <= at('station-S1'); s += 0.002) {
      expect(level(s)).toBeGreaterThanOrEqual(last - 1e-9);
      last = level(s);
    }
    expect(level(at('station-S1'))).toBeCloseTo(1, 6);
  });

  it("holds each table's light for as long as its copy is up", () => {
    // (the name is up for as long as the camera dwells on the table: about
    // two notches of the wheel at the first two — journey.ts, COPY_SPAN)
    expect(hold).toBeGreaterThan(0.04);
    expect(hold).toBeLessThan(0.095);
    expect(level(at('station-S1') + hold)).toBeCloseTo(1, 6);
    expect(level(at('station-S2') + hold)).toBeCloseTo(HALL_LEVEL_S2_MODEL, 6);
    // the last table has no dwell and its name leaves with the camera: its
    // light holds for that name's own stretch
    const last = chapters(3).find((c) => c.id === 'station-3')!;
    const lastHold = (last.copy.out[1] - last.from) / (JOURNEY_END - DOOR_IN);
    expect(lastHold).toBeLessThan(hold);
    expect(level(at('station-S3') + lastHold)).toBeCloseTo(1, 6);
  });

  it("is down before the portrait's copy develops, and stays down to the end", () => {
    // The portrait's pane is held from the foot of the stair; its copy
    // develops over the stretch before it.
    for (const id of ['withdraw', 'stair-foot', 'stair-rise', 'portrait', 'court']) {
      expect(level(at(id)), id).toBeCloseTo(HALL_DOWN[id], 6);
    }
    // ...and between those beats and to the end, nowhere near a table's light.
    for (let s = at('withdraw'); s <= 1; s += 0.004) expect(level(s)).toBeLessThan(0.15);
  });

  it('never steps', () => {
    let last = level(0);
    for (let s = 0.002; s <= 1; s += 0.002) {
      const v = level(s);
      expect(Math.abs(v - last)).toBeLessThan(0.08);
      last = v;
    }
  });

  it('is in order, with no two keys at one place', () => {
    for (let i = 1; i < keys.length; i += 1) expect(keys[i][0]).toBeGreaterThan(keys[i - 1][0]);
  });
});

describe('the house lights behind a page', () => {
  it('lights the hall behind every page: a plate is a picture, not a ground for copy', () => {
    // Since the folios no page stands a column of copy on the room: a page
    // opens on a plate — one title, on a density of its own — and is read on
    // opaque sheets. So the room behind it is lit to be looked at, the same
    // for every page.
    for (const route of ['/hall', '/hall/', '/hall?debug=1', '/properties', '/locations', '/gallery', '/faqs', '/projects/lucky-garden', '/nonsense']) {
      expect(hallReadingLevel(route), route).toBe(HALL_PLATE);
    }
    // Well above both of the levels copy used to need under it…
    expect(HALL_PLATE).toBeGreaterThan(HALL_READING_ROOM * 4);
    expect(HALL_READING_ROOM).toBeGreaterThan(HALL_READING);
    // …and above the film's own dimmed shots of the same room, whose copy
    // does stand on the plaster; but not the room at full, where the ivory
    // is at the top of the print and the sconces are lost in it.
    expect(HALL_PLATE).toBeGreaterThan(HALL_DOWN.establish * 3);
    expect(HALL_PLATE).toBeLessThanOrEqual(HALL_WALK);
  });
});

describe("the house lights under the film's last frame", () => {
  it('go down round the map table until the floor is only just there, and not to nothing', () => {
    // The client, 2026-10-06: "make this dark like this" — the lit court of
    // the first restored build beside the ending he wanted, where the room is
    // gone and the table is lit. Measured against that picture, the share of
    // the map's level that matches it lies between 0.15 and 0.20.
    expect(HALL_CODA).toBeGreaterThanOrEqual(0.15);
    expect(HALL_CODA).toBeLessThanOrEqual(0.2);
    // (a tenth is the table afloat on black, which is what was there before)
    expect(HALL_CODA).toBeGreaterThan(0.1);
  });
});
