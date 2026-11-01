// apps/public/src/components/experience/lensFilter.test.ts
//
// Where the lens's filter falls: across the copy, never on the plan, and only
// while its chapter is on screen.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APPROACH_ND,
  CODA_FADE,
  ESTABLISH_ND,
  HEADER_BAND,
  COVER_SKY_SHORT,
  EDGE,
  LAYOUT_SKY,
  LAND_BOX,
  LAND_ND,
  COVER_GRADE,
  COVER_SKY,
  coverGrade,
  coverSkyStops,
  HOLDINGS_ND,
  PHONE_HOLDINGS_BOOST,
  PHONE_HOLDINGS_MIST,
  PHONE_ROOM,
  PHONE_SKY,
  PHONE_SKY_ND,
  ROOM_ND,
  STATION_ND,
  STATION_ND_MODEL,
  STATION_ND_SHORT,
  TABLE_BAND,
  TABLE_BAND_MODEL,
  approachFilter,
  codaFilter,
  codaFilterClear,
  colophonCover,
  headerBandApproach,
  headerBandOutside,
  headerBandReach,
  HEADER_APPROACH,
  holdingsFilter,
  layoutSkyStops,
  lensFilter,
  phoneRoomFilter,
  phoneSkyFilter,
  skyRide,
  stationFilter,
  tableBandFilter,
} from './lensFilter';
import { HOURS, twilightAt } from './filmHours';

/** The shader's density at a point of the frame, in stops (FilmGrade's
 *  ndFilter, restated). */
function stopsAt(u: number, v: number): number {
  const [cx, cy, rx, ry] = lensFilter.shape.toArray();
  const l = Math.hypot((u - cx) / rx, (v - cy) / ry);
  const t = Math.min(1, Math.max(0, (l - lensFilter.inner) / (1 - lensFilter.inner)));
  return lensFilter.stops * (1 - t * t * (3 - 2 * t));
}

/** A wide frame (copyZone.filmIsWide): the copy has a column down the left. */
const WIDE = true;

describe('the tables', () => {
  it('holds the whole copy column at full density, top to bottom', () => {
    stationFilter({ S1: 1, S2: 0, S3: 0 }, WIDE);
    // The copy column runs from the grid's margin to a third of the frame, and
    // the station copy stands between 40% and 65% of the height.
    for (const u of [0.02, 0.12, 0.2, 0.28]) {
      for (const v of [0.35, 0.5, 0.65]) expect(stopsAt(u, v)).toBeCloseTo(STATION_ND.S1, 2);
    }
  });

  it('is gone before the plan begins', () => {
    stationFilter({ S1: 0, S2: 0, S3: 1 }, WIDE);
    // The hologram's left edge stands at 46-49% of the width at the first and
    // third tables.
    for (const v of [0.1, 0.3, 0.5, 0.7, 0.9]) expect(stopsAt(0.47, v)).toBeLessThan(0.01);
    expect(stopsAt(0.75, 0.5)).toBe(0);
  });

  it("burns the same edge for the portrait's copy on a wide frame", () => {
    stationFilter({ S1: 0, portrait: 1 }, WIDE);
    expect(lensFilter.stops).toBeCloseTo(STATION_ND.portrait, 5);
    expect(stopsAt(0.2, 0.5)).toBeCloseTo(STATION_ND.portrait, 2);
    expect(stopsAt(0.6, 0.5)).toBe(0);
  });

  it('follows the emphasis, and the second table wears an edge of its own', () => {
    stationFilter({ S1: 0.5, S2: 0, S3: 0 }, WIDE);
    expect(lensFilter.stops).toBeCloseTo(STATION_ND.S1 * 0.5, 5);
    // The second table wore none, in a room taken down to 0.15 instead; the
    // client had the room brought up (2026-10-01), and its copy has a light
    // edge in its place.
    // (under a projected plan, in the dim room that goes with it)
    stationFilter({ S1: 0, S2: 1, S3: 0 }, WIDE, undefined, false);
    expect(lensFilter.stops).toBe(STATION_ND.S2);
    expect(STATION_ND.S2).toBeGreaterThan(0.8);
    expect(STATION_ND.S2).toBeLessThan(STATION_ND.S3);
    // Under a site model its room is lit like the others (hallLight,
    // HALL_LEVEL_S2_MODEL: the forensic audit of 2026-10-09, #42), and its
    // words have the edge the first table's have, for the same pilaster.
    stationFilter({ S1: 0, S2: 1, S3: 0 }, WIDE);
    expect(lensFilter.stops).toBe(STATION_ND_MODEL.S2);
    expect(STATION_ND_MODEL.S2).toBeGreaterThan(STATION_ND.S2);
    expect(STATION_ND_MODEL.S2).toBeLessThanOrEqual(2.4);
    // the other tables are what they were, under either
    stationFilter({ S1: 1, S2: 0, S3: 0 }, WIDE);
    expect(lensFilter.stops).toBe(STATION_ND.S1);
    stationFilter({ S1: 0, S2: 0, S3: 1 }, WIDE, undefined, false);
    expect(lensFilter.stops).toBe(STATION_ND.S3);
  });

  it('is no denser at any table than its ivory copy needs', () => {
    // 2.4 stops was "a bit too much" (the client, of the first table). Ivory
    // capitals want a ground under a luma of 105; small gilt wanted 80, and
    // the numeral that was gilt is ivory now (site-home). The first table's
    // small lines stand on the pilaster's foot and set its floor.
    expect(STATION_ND.S1).toBeLessThan(2.4);
    expect(STATION_ND.S1).toBeGreaterThanOrEqual(2.0);
    // The third was lightened to 1.8 with the first, and the hall's panelling
    // then put a lit pilaster behind its place line (the second forensic
    // audit, 2026-10-24, #8: 3.6:1). It is back at the density it had before,
    // and no denser.
    expect(STATION_ND.S3).toBeGreaterThanOrEqual(2.2);
    expect(STATION_ND.S3).toBeLessThanOrEqual(2.3);
  });

  it('is denser on a phone held sideways only where that frame puts a line on the pilaster', () => {
    const short = 844 / 390;
    stationFilter({ S1: 1, S2: 0, S3: 0 }, WIDE, short, true, true);
    expect(lensFilter.stops).toBe(STATION_ND_SHORT.S1);
    expect(STATION_ND_SHORT.S1).toBeGreaterThan(STATION_ND.S1);
    expect(STATION_ND_SHORT.S1).toBeLessThanOrEqual(2.6);
    // every other frame keeps the client's lighter shade
    stationFilter({ S1: 1, S2: 0, S3: 0 }, WIDE, short, true, false);
    expect(lensFilter.stops).toBe(STATION_ND.S1);
    // and the other tables are what they are everywhere
    stationFilter({ S1: 0, S2: 0, S3: 1 }, WIDE, short, true, true);
    expect(lensFilter.stops).toBe(STATION_ND.S3);
    const stage = readFileSync(join(__dirname, 'InteriorStage.tsx'), 'utf8');
    expect(stage).toContain('filmIsShort(window.innerWidth, window.innerHeight),');
  });

  it('puts nothing on the lens on a frame that is not wide: there is no column beside the plan', () => {
    // A filter here lay across the plan itself (seen at 390x844).
    const all: Record<string, number>[] = [{ S1: 1 }, { S3: 1 }, { S1: 0, portrait: 1 }, { S1: 1, S2: 1, S3: 1 }];
    for (const weights of all) {
      lensFilter.stops = 3;
      stationFilter(weights, false);
      expect(lensFilter.stops).toBe(0);
    }
  });
});

describe("the establishing shot's half stop", () => {
  it('is under the copy in the lower left, and never as far as the stair', () => {
    stationFilter({ establish: 1 }, WIDE);
    expect(lensFilter.stops).toBe(ESTABLISH_ND.stops);
    expect(lensFilter.inner).toBe(ESTABLISH_ND.inner);
    // the statement: 12 to 42% of the width, 77 to 93% of the way down
    expect(stopsAt(0.2, 0.15)).toBeCloseTo(ESTABLISH_ND.stops, 2);
    expect(stopsAt(0.42, 0.15)).toBeGreaterThan(ESTABLISH_ND.stops * 0.8);
    // the stair's foot, at the middle of the frame, all but clear; the windows above, clear
    expect(stopsAt(0.5, 0.15)).toBeLessThan(ESTABLISH_ND.stops * 0.35);
    expect(stopsAt(0.2, 0.6)).toBe(0);
    expect(ESTABLISH_ND.stops).toBeLessThanOrEqual(0.6);
  });

  it("gives way to a table's edge, and is nothing on a frame that is not wide", () => {
    stationFilter({ establish: 1, S1: 1 }, WIDE);
    expect(lensFilter.stops).toBe(STATION_ND.S1);
    expect(lensFilter.inner).toBe(0.83);
    lensFilter.stops = 3;
    stationFilter({ establish: 1 }, false);
    expect(lensFilter.stops).toBe(0);
  });
});

describe("the tables, on a frame that is not wide: the header's band comes down over the copy", () => {
  /** The band's density at a height from the top, as a share of its stops
   *  (FilmGrade's ndFilter, restated). */
  const band = (yFromTop: number) => {
    const t = Math.min(1, Math.max(0, (yFromTop - lensFilter.topFull) / (lensFilter.topZero - lensFilter.topFull)));
    return 1 - t * t * (3 - 2 * t);
  };
  const settle = (panes: Parameters<typeof tableBandFilter>[0]) => {
    for (let i = 0; i < 180; i += 1) tableBandFilter(panes, 1 / 60);
  };

  it("is the header's own reach when no table's copy is up", () => {
    headerBandReach();
    expect(lensFilter.topFull).toBe(HEADER_BAND.full);
    expect(lensFilter.topZero).toBe(HEADER_BAND.zero);
    settle([{ id: 'portrait', weight: 1, top: 0.7, bottom: 0.9 }]);
    expect(lensFilter.topFull).toBeCloseTo(HEADER_BAND.full, 6);
    expect(lensFilter.topZero).toBeCloseTo(HEADER_BAND.zero, 6);
  });

  it('holds every line of the copy at full density, and is gone before the plan begins', () => {
    // A 390x844 phone: the block stands from 80px to 172px under the header,
    // and the first table's pane begins at 29% of the height.
    headerBandReach();
    settle([{ id: 'station-1', weight: 1, top: 80 / 844, bottom: 172 / 844 }]);
    for (const y of [0.02, 0.095, 0.15, 172 / 844]) expect(band(y)).toBe(1);
    expect(band(0.29)).toBe(0);
    expect(lensFilter.topZero).toBeLessThanOrEqual(0.29);
    // the first table's own marker, at 25.5% to 28% of the height, all but clear
    expect(band(0.26)).toBeLessThan(0.15);
  });

  it('stops short of the plan on a short screen rather than follow the copy onto it', () => {
    // 360x640: the same block's foot is at 27% of the height.
    headerBandReach();
    settle([{ id: 'station-2', weight: 1, top: 80 / 640, bottom: 172 / 640 }]);
    expect(lensFilter.topFull).toBeCloseTo(TABLE_BAND.fullMax, 6);
    expect(lensFilter.topZero).toBeCloseTo(TABLE_BAND.zeroMax, 6);
    expect(band(172 / 640)).toBeGreaterThan(0.6);
  });

  it('follows a taller block further down over a site model, which stands lower than a projected plan did', () => {
    // 390x664, the third table: the name, a place that takes two lines and
    // the count, from 80px to 212px under the header. The model's board
    // begins 42% of the way down that frame.
    const panes = [{ id: 'station-3', weight: 1, top: 80 / 664, bottom: 212 / 664 }];
    const model = () => {
      for (let i = 0; i < 180; i += 1) tableBandFilter(panes, 1 / 60, true);
    };
    headerBandReach();
    model();
    // the count's line, 189 to 207px, is under the whole of it
    expect(band(207 / 664)).toBe(1);
    expect(lensFilter.topFull).toBeLessThanOrEqual(TABLE_BAND_MODEL.fullMax + 1e-9);
    // and it is all but gone at the board: a soft fall, not a line (the
    // forensic audit of 2026-10-09, #55, "a hard horizontal line across the
    // whole frame")
    expect(band(0.42)).toBeLessThan(0.12);
    expect(band(0.44)).toBe(0);
    expect(lensFilter.topZero - lensFilter.topFull).toBeGreaterThan(0.1);
    // a projected plan keeps the caps it was measured for
    headerBandReach();
    settle(panes);
    expect(lensFilter.topFull).toBeCloseTo(TABLE_BAND.fullMax, 6);
    expect(lensFilter.topZero).toBeCloseTo(TABLE_BAND.zeroMax, 6);
    // and on a tall phone, where the block ends a quarter of the way down,
    // the model's cap changes nothing to speak of: the band rides the foot
    headerBandReach();
    for (let i = 0; i < 180; i += 1) {
      tableBandFilter([{ id: 'station-1', weight: 1, top: 80 / 844, bottom: 180 / 844 }], 1 / 60, true);
    }
    expect(lensFilter.topFull).toBeCloseTo(180 / 844 + TABLE_BAND.margin, 3);
    // and there it falls over the whole of the wall between the words and
    // the board (which begins 42% of the way down): gone before it
    expect(lensFilter.topZero).toBeCloseTo(180 / 844 + TABLE_BAND.margin + TABLE_BAND_MODEL.fall, 3);
    expect(lensFilter.topZero).toBeLessThan(0.42);
    expect(TABLE_BAND_MODEL.fall).toBeGreaterThan(3 * TABLE_BAND.fall);
    headerBandReach();
  });

  it('is whole while a quarter of the copy is still there, and eases rather than steps', () => {
    headerBandReach();
    settle([{ id: 'station-3', weight: 0.25, top: 80 / 844, bottom: 172 / 844 }]);
    expect(lensFilter.topFull).toBeCloseTo(172 / 844 + TABLE_BAND.margin, 3);
    headerBandReach();
    tableBandFilter([{ id: 'station-3', weight: 1, top: 80 / 844, bottom: 172 / 844 }], 1 / 60);
    expect(lensFilter.topFull).toBeGreaterThan(HEADER_BAND.full);
    expect(lensFilter.topFull).toBeLessThan(HEADER_BAND.full + 0.03);
  });

  it('never reaches below its caps, and never inverts', () => {
    headerBandReach();
    settle([{ id: 'station-1', weight: 1, top: 0.1, bottom: 0.9 }]);
    expect(lensFilter.topFull).toBeLessThanOrEqual(TABLE_BAND.fullMax + 1e-9);
    expect(lensFilter.topZero).toBeLessThanOrEqual(TABLE_BAND.zeroMax + 1e-9);
    expect(lensFilter.topZero).toBeGreaterThan(lensFilter.topFull);
    headerBandReach();
  });
});

describe('the layout', () => {
  // The founder's frame (2026-10-28): chapter three's title stands in the top
  // left of the frame, as the cover's does, and the lens wears the cover's
  // kind of grad for it (LAYOUT_SKY), where the figures' ellipse stood.
  const aspect = 1920 / 945;

  it('is a grad from the top edge, leaning to the title, for as long as the words are up', () => {
    holdingsFilter(0.62, aspect);
    expect(lensFilter.stops).toBeCloseTo(LAYOUT_SKY.stops * (1 - LAYOUT_SKY.duskOff * twilightAt(0.62)), 9);
    expect(layoutSkyStops(0.62)).toBeCloseTo(LAYOUT_SKY.stops * (1 - LAYOUT_SKY.duskOff * twilightAt(0.62)), 9);
    expect(lensFilter.shape.x).toBeCloseTo(LAYOUT_SKY.lean.cx + (LAYOUT_SKY.dusk.cx - LAYOUT_SKY.lean.cx) * twilightAt(0.62), 9);
    expect(lensFilter.shape.y).toBeGreaterThan(1);
    // whole behind the title, down to its foot
    expect(stopsAt(EDGE + 0.05, 1 - 0.12)).toBeCloseTo(lensFilter.stops, 1);
    // and gone over the house's roofline and the land under it
    expect(stopsAt(0.4, 1 - (LAYOUT_SKY.zero + 0.02))).toBe(0);
    expect(stopsAt(0.6, 1 - 0.8)).toBe(0);
    // (down to the title's foot while the mist behind it is golden and bright)
    holdingsFilter(HOURS.twilight[0], aspect);
    expect(stopsAt(EDGE + 0.1, 1 - (LAYOUT_SKY.full - 0.02))).toBeGreaterThan(lensFilter.stops * 0.95);
  });

  it('leans to the title in the golden light and stands off the afterglow by the blue hour', () => {
    holdingsFilter(HOURS.twilight[0], aspect);
    expect(lensFilter.shape.x).toBe(LAYOUT_SKY.lean.cx);
    expect(lensFilter.shape.z).toBe(LAYOUT_SKY.lean.rx);
    holdingsFilter(HOURS.twilight[1], aspect);
    expect(lensFilter.shape.x).toBe(LAYOUT_SKY.dusk.cx);
    expect(lensFilter.shape.z).toBe(LAYOUT_SKY.dusk.rx);
    // whole behind the title, as it was; nothing over the afterglow, the frame's middle
    expect(stopsAt(EDGE + 0.05, 1 - 0.12)).toBeCloseTo(lensFilter.stops, 1);
    expect(stopsAt(0.28, 1 - 0.12)).toBeCloseTo(lensFilter.stops, 1);
    expect(stopsAt(0.58, 1 - 0.05)).toBe(0);
    // and its colour is the golden hour's alone
    expect(coverGrade(HOURS.twilight[0])).toBeGreaterThan(0);
    expect(coverGrade(HOURS.twilight[1])).toBe(0);
  });

  it('wears the soft density under its line and its cue, for as long as they are up', () => {
    holdingsFilter(0.62, aspect, 0, 0, false, 1);
    expect(lensFilter.second.stops).toBeCloseTo(LAND_ND.stops, 9);
    expect(1 - lensFilter.second.shape.y).toBeCloseTo((LAND_BOX.layout.top + LAND_BOX.layout.foot) / 2, 9);
    holdingsFilter(0.62, aspect, 0, 0, false, 0);
    expect(lensFilter.second.stops).toBe(0);
  });

  it('keeps its soft edge after the tables have set a hard one', () => {
    stationFilter({ S1: 1 }, WIDE);
    holdingsFilter(0.62, aspect);
    expect(lensFilter.inner).toBeGreaterThan(0);
    expect(lensFilter.inner).toBeLessThan(1);
    expect(lensFilter.stops).toBeCloseTo(LAYOUT_SKY.stops * (1 - LAYOUT_SKY.duskOff * twilightAt(0.62)), 9);
  });

  it('is off outside its chapter, and comes and goes without a step', () => {
    // (before it, the lens wears the cover's sky grad until the orbit's line
    // has gone: off by COVER_SKY.off[1])
    holdingsFilter(COVER_SKY.off[1], aspect);
    expect(lensFilter.stops).toBe(0);
    holdingsFilter(0.5, aspect);
    expect(lensFilter.stops).toBe(0);
    holdingsFilter(0.9, aspect);
    expect(lensFilter.stops).toBe(0);
    let last = layoutSkyStops(0.5);
    for (let s = 0.5; s <= 0.75; s += 0.002) {
      const now = layoutSkyStops(s);
      // (a smoothstep's steepest is 1.5 times its mean: 1.3 stops over 0.04)
      expect(Math.abs(now - last)).toBeLessThan(1.6 * LAYOUT_SKY.stops * (0.002 / (LAYOUT_SKY.from[1] - LAYOUT_SKY.from[0])));
      last = now;
    }
  });
});

describe("the cover's sky", () => {
  it("is a grad across the whole sky from the first frame, held through the orbit's line and ridden off before the figures", () => {
    expect(coverSkyStops(0)).toBe(COVER_SKY.stops);
    // the day's density through the cover and the first of the orbit
    expect(coverSkyStops(COVER_SKY.ride.from)).toBe(COVER_SKY.stops);
    // ridden up seven-tenths of a stop as the camera comes round to the evening, while
    // the orbit's line still stands in it
    const evening = COVER_SKY.stops + COVER_SKY.ride.stops;
    expect(coverSkyStops(COVER_SKY.ride.to)).toBeCloseTo(evening, 9);
    expect(coverSkyStops(COVER_SKY.off[0])).toBeCloseTo(evening, 9);
    expect(COVER_SKY.ride.to).toBeLessThan(COVER_SKY.off[0]);
    // (2.2 until the cover's own density rose to 1.6 for the concept's forest
    // behind its gilt line, 2026-10-27)
    expect(evening).toBeLessThanOrEqual(2.3);
    expect(coverSkyStops(COVER_SKY.off[1])).toBe(0);
    // off before the holdings' own grad begins: the two never trade places
    expect(COVER_SKY.off[1]).toBeLessThanOrEqual(HOLDINGS_ND.from[0]);
    // without a step, up or down
    let last = coverSkyStops(COVER_SKY.ride.from - 0.01);
    for (let q = COVER_SKY.ride.from; q <= COVER_SKY.off[1] + 0.01; q += 0.001) {
      const v = coverSkyStops(q);
      expect(Math.abs(last - v)).toBeLessThan(evening * 0.06);
      last = v;
    }
  });

  it('holds its density over the words and is gone before the roofline', () => {
    holdingsFilter(0, 1.6);
    // whole across the title's side of the frame, and leaning off toward the
    // sun's side, where the concept (built 1:1 at the user's word, 2026-10-27)
    // keeps its sky bright: it was across the whole width
    for (const x of [0.05, 0.3, 0.45]) {
      expect(stopsAt(x, 1 - 0.12)).toBeCloseTo(COVER_SKY.stops, 1);
    }
    expect(stopsAt(0.95, 1 - 0.12)).toBeLessThan(stopsAt(0.3, 1 - 0.12));
    // full to the foot of the title
    expect(stopsAt(0.3, 1 - (COVER_SKY.full - 0.02))).toBeCloseTo(COVER_SKY.stops, 1);
    // and gone under the horizon, above the house's parapet
    expect(stopsAt(0.6, 1 - (COVER_SKY.zero + 0.02))).toBe(0);
    // a grad a photographer would use on a sky, not a blackout (1.6 since the
    // concept built 1:1 put the forest's haze behind the gilt line)
    expect(COVER_SKY.stops).toBeLessThanOrEqual(1.65);
    // a phone on its side: whole to its own title's foot
    holdingsFilter(0, 844 / 390, 0, 0, true);
    expect(stopsAt(0.3, 1 - (COVER_SKY_SHORT.full - 0.02))).toBeCloseTo(COVER_SKY.stops, 1);
  });

  it("gives way to nothing, and then to the layout's grad", () => {
    // (the holdings' ellipse round the figures went with them: between the
    // orbit's line and the layout's title the lens wears no grad)
    holdingsFilter(0.5, 1.6);
    expect(lensFilter.stops).toBe(0);
    holdingsFilter(0.62, 1.6);
    expect(lensFilter.stops).toBeCloseTo(LAYOUT_SKY.stops * (1 - LAYOUT_SKY.duskOff * twilightAt(0.62)), 9);
    expect(lensFilter.shape.y).toBeGreaterThan(1);
  });

  it("wears a soft density under the small type on the land, on a second ellipse, while that copy is up", () => {
    const aspect = 1920 / 945;
    const x = (units: number) => EDGE + units / 900 / aspect;
    /** The second ellipse's own density at a point (uv, origin bottom-left). */
    const secondAt = (u: number, v: number) => {
      const sh = lensFilter.second.shape;
      const d = Math.hypot((u - sh.x) / sh.z, (v - sh.y) / sh.w);
      const t = Math.min(1, Math.max(0, (d - lensFilter.second.inner) / (1 - lensFilter.second.inner)));
      return lensFilter.second.stops * (1 - t * t * (3 - 2 * t));
    };
    holdingsFilter(0, aspect, 1);
    expect(lensFilter.second.stops).toBe(LAND_ND.stops);
    // the sky grad is still the first ellipse's
    expect(lensFilter.stops).toBe(COVER_SKY.stops);
    // whole under the cover's line (63.8% of the way down since the forensic
    // audit of 2026-10-09, #31; 430 units wide)
    expect(secondAt(x(10), 1 - 0.67)).toBeGreaterThan(LAND_ND.stops * 0.95);
    expect(secondAt(x(420), 1 - 0.73)).toBeGreaterThan(LAND_ND.stops * 0.8);
    // and gone before the house
    expect(secondAt(0.55, 1 - 0.69)).toBe(0);
    holdingsFilter(0.05, aspect, 0.5);
    expect(lensFilter.second.stops).toBeCloseTo(LAND_ND.stops * 0.5, 9);
    // then under the orbit's line, which stands lower on the lawn (76% of the
    // way down since the forensic audit of 2026-10-09, #119) and is narrower
    holdingsFilter(0.22, aspect, 0, 1);
    expect(lensFilter.second.stops).toBe(LAND_ND.stops);
    expect(1 - lensFilter.second.shape.y).toBeCloseTo((LAND_BOX.revolution.top + LAND_BOX.revolution.foot) / 2, 9);
    expect(secondAt(x(10), 1 - 0.8)).toBeGreaterThan(LAND_ND.stops * 0.95);
    // wider on a phone on its side, where that line runs further across
    const desk = lensFilter.second.shape.z * aspect;
    holdingsFilter(0.22, 844 / 390, 0, 1, true);
    expect(lensFilter.second.shape.z * (844 / 390)).toBeGreaterThan(desk);
    // leaving with the copy
    holdingsFilter(0.3, aspect, 0, 0.25);
    expect(lensFilter.second.stops).toBeCloseTo(LAND_ND.stops * 0.25, 9);
    holdingsFilter(0.3, aspect, 0, 0);
    expect(lensFilter.second.stops).toBe(0);
    // never a filter a visitor could name
    expect(LAND_ND.stops).toBeLessThanOrEqual(1);
  });
});

describe("the cover's grad, in its own colour", () => {
  it('is the haze’s own umber over the title and warm at the horizon, on the cover and gone by the orbit', () => {
    // The forensic audit of 2026-10-09 (#6): "a flat grey-brown overcast with
    // almost no colour ... Expected: a cover sky with a readable light
    // direction and some colour, while keeping the headline legible." It was a
    // slate for that; the concept built 1:1 (the user, 2026-10-27) is a golden
    // haze over a forest valley, and the grad over its title takes that colour.
    const [r, g, b] = COVER_GRADE.cool;
    // warm: red over green over blue, and no lighter than the neutral grad it colours
    expect(r).toBeGreaterThanOrEqual(g);
    expect(g).toBeGreaterThan(b);
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeLessThanOrEqual(1);
    // and never a blue (the client's rule against saturated blue)
    expect(b / r).toBeLessThan(1);
    // warm where it lets go: red over green over blue, and no change of exposure
    const [wr, wg, wb] = COVER_GRADE.warm;
    expect(wr).toBeGreaterThan(wg);
    expect(wg).toBeGreaterThan(wb);
    expect(Math.abs(0.2126 * wr + 0.7152 * wg + 0.0722 * wb - 1)).toBeLessThan(0.03);
    // the slate reaches down to the title's foot and no further than the grad itself
    expect(COVER_GRADE.coolReach[1]).toBeGreaterThan(COVER_SKY.full);
    expect(COVER_GRADE.coolReach[1]).toBeLessThanOrEqual(COVER_SKY.zero);
    // the warmth is where the grad falls away: across its foot
    expect(COVER_GRADE.warmBand[1]).toBeLessThanOrEqual(COVER_SKY.full);
    expect(COVER_GRADE.warmBand[3]).toBeGreaterThanOrEqual(COVER_SKY.zero);
    // whole on the film's first frame, by the place on the leg and not by the words
    expect(coverGrade(0)).toBe(1);
    holdingsFilter(0, 1920 / 945, 0, 0);
    expect(lensFilter.sky).toEqual({ cool: 1, warm: 1 });
    // ...and off before the orbit's clouds and the evening's gold are in the frame
    expect(coverGrade(COVER_GRADE.off[1])).toBe(0);
    expect(COVER_GRADE.off[1]).toBeLessThan(COVER_SKY.ride.from);
    holdingsFilter(COVER_GRADE.off[1], 1920 / 945, 1, 0);
    expect(lensFilter.sky).toEqual({ cool: 0, warm: 0 });
    // a page that only holds the film's frame (the end of the leg) wears none
    holdingsFilter(1);
    expect(lensFilter.sky).toEqual({ cool: 0, warm: 0 });
  });
});

describe('the phone', () => {
  // Settle the grad's easing (a 0.2 s time constant): three seconds of frames.
  const settle = (panes: Parameters<typeof phoneSkyFilter>[0], legS = 0) => {
    for (let i = 0; i < 180; i += 1) phoneSkyFilter(panes, legS, 1 / 60);
  };
  /** Density at a height measured from the top of the frame. */
  const at = (yFromTop: number) => stopsAt(0.5, 1 - yFromTop);

  it("holds the hero's copy under the full grad and leaves the house below it", () => {
    settle([{ id: 'hero', weight: 1, top: 0.1, bottom: 0.46 }]);
    expect(lensFilter.stops).toBeCloseTo(PHONE_SKY_ND.hero, 1);
    for (const y of [0.02, 0.1, 0.3, 0.46]) expect(at(y)).toBeGreaterThan(PHONE_SKY_ND.hero * 0.95);
    expect(at(0.46 + PHONE_SKY.margin + PHONE_SKY.fall + 0.01)).toBe(0);
    expect(at(0.9)).toBe(0);
  });

  it('is whole while a quarter of the copy is still there, and gone with the last of it', () => {
    settle([{ id: 'hero', weight: 0.25, top: 0.1, bottom: 0.46 }]);
    expect(lensFilter.stops).toBeCloseTo(PHONE_SKY_ND.hero, 1);
    settle([{ id: 'hero', weight: 0.1, top: 0.1, bottom: 0.46 }]);
    expect(lensFilter.stops).toBeCloseTo(PHONE_SKY_ND.hero * 0.4, 1);
  });

  it('leaves copy entering from below, and the residence, alone', () => {
    settle([{ id: 'revolution', weight: 1, top: 0.9, bottom: 1 }]);
    expect(lensFilter.stops).toBe(0);
    settle([{ id: 'approach', weight: 1, top: 0.74, bottom: 0.89 }]);
    expect(lensFilter.stops).toBe(0);
  });

  it("rides the orbit's grad up into the evening, as a wide frame's is ridden", () => {
    const orbit = [{ id: 'revolution', weight: 1, top: 0.1, bottom: 0.3 }];
    // the day's density where its line comes up
    settle(orbit, 0.19);
    expect(lensFilter.stops).toBeCloseTo(PHONE_SKY_ND.revolution, 2);
    // and the whole of the ride where it leaves, into the sunset
    settle(orbit, COVER_SKY.ride.to);
    expect(lensFilter.stops).toBeCloseTo(PHONE_SKY_ND.revolution + COVER_SKY.ride.stops, 2);
    expect(skyRide(COVER_SKY.ride.to)).toBe(COVER_SKY.ride.stops);
    expect(skyRide(COVER_SKY.ride.from)).toBe(0);
    // the cover's own grad is not ridden: its sky is the morning's
    settle([{ id: 'hero', weight: 1, top: 0.1, bottom: 0.46 }], COVER_SKY.ride.to);
    expect(lensFilter.stops).toBeCloseTo(PHONE_SKY_ND.hero, 2);
    settle([]);
  });

  it('eases rather than steps when a chapter arrives', () => {
    settle([]);
    phoneSkyFilter([{ id: 'hero', weight: 1, top: 0.1, bottom: 0.46 }], 0, 1 / 60);
    expect(lensFilter.stops).toBeGreaterThan(0);
    expect(lensFilter.stops).toBeLessThan(0.3);
  });

  it("rides the holdings' density, opened denser into the sunset and given back as it settles", () => {
    // (and held PHONE_HOLDINGS_MIST denser throughout, for the concept's mist
    // under the figures, 2026-10-27)
    settle([{ id: 'holdings', weight: 1, top: 0.3, bottom: 0.7 }], 0.44);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.open + PHONE_HOLDINGS_BOOST + PHONE_HOLDINGS_MIST, 1);
    expect(at(0.69)).toBeGreaterThan((HOLDINGS_ND.open + PHONE_HOLDINGS_BOOST + PHONE_HOLDINGS_MIST) * 0.95);
    settle([{ id: 'holdings', weight: 1, top: 0.3, bottom: 0.7 }], 0.6);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.stops + PHONE_HOLDINGS_MIST, 1);
  });
});

describe('the phone, in the hall', () => {
  const settle = (panes: Parameters<typeof phoneRoomFilter>[0]) => {
    for (let i = 0; i < 180; i += 1) {
      lensFilter.stops = 0;
      phoneRoomFilter(panes, 1 / 60);
    }
  };
  const at = (yFromTop: number) => stopsAt(0.5, 1 - yFromTop);

  it("rises from the floor over the portrait's copy, and leaves the portrait above it", () => {
    settle([{ id: 'portrait', weight: 1, top: 0.7, bottom: 0.92 }]);
    expect(lensFilter.stops).toBeCloseTo(ROOM_ND.portrait.stops, 1);
    for (const y of [0.98, 0.92, 0.8, 0.7]) expect(at(y)).toBeGreaterThan(ROOM_ND.portrait.stops * 0.95);
    expect(at(0.7 - PHONE_ROOM.margin - PHONE_ROOM.fall - 0.01)).toBe(0);
  });

  it("falls from the top over the map's list", () => {
    settle([{ id: 'city', weight: 1, top: 0.13, bottom: 0.55 }]);
    expect(at(0.05)).toBeGreaterThan(ROOM_ND.city.stops * 0.95);
    expect(at(0.55)).toBeGreaterThan(ROOM_ND.city.stops * 0.95);
    expect(at(0.55 + PHONE_ROOM.margin + PHONE_ROOM.fall + 0.01)).toBe(0);
  });

  it("leaves the tables to the header's band", () => {
    settle([{ id: 'station-1', weight: 1, top: 0.095, bottom: 0.2 }]);
    expect(lensFilter.stops).toBe(0);
  });
});

describe("the header's band", () => {
  it('is the day\'s by day and lets go as the sky goes dark: the blue hour\'s, then midnight\'s', () => {
    expect(headerBandOutside(0)).toBe(HEADER_BAND.day);
    expect(headerBandOutside(1)).toBeCloseTo(HEADER_BAND.evening, 6);
    expect(headerBandOutside(1, 1)).toBeCloseTo(HEADER_BAND.night, 6);
    // down at each step of the way: a band over a dark sky is a dark band
    let last = Infinity;
    for (const [e, n] of [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1]] as const) {
      const v = headerBandOutside(e, n);
      expect(v).toBeLessThan(last);
      last = v;
    }
    expect(HEADER_BAND.day).toBeGreaterThanOrEqual(1);
  });

  it('rides between them without a step', () => {
    let last = headerBandOutside(0);
    for (let e = 0.02; e <= 1.0001; e += 0.02) {
      const v = headerBandOutside(e);
      expect(Math.abs(v - last)).toBeLessThan(0.06);
      last = v;
    }
    for (let n = 0.02; n <= 1.0001; n += 0.02) {
      const v = headerBandOutside(1, n);
      expect(Math.abs(v - last)).toBeLessThan(0.06);
      last = v;
    }
  });

  it('comes back lightly while the lit house passes behind the header at night', () => {
    // off through the dusk, when the sky behind the header is dark
    for (const s of [0, 0.4, 0.6, 0.75, 0.8]) expect(headerBandApproach(s)).toBe(0);
    // whole where the cupola stood behind ENQUIRE on a phone (measured 0.85..0.9)
    for (const s of [0.84, 0.85, 0.88, 0.9, 0.91]) expect(headerBandApproach(s)).toBeCloseTo(HEADER_APPROACH.stops, 6);
    // and gone before the door
    for (const s of [0.95, 0.97, 1]) expect(headerBandApproach(s)).toBe(0);
    // a light band: under the dusk's own, which now holds through these
    // frames (HEADER_BAND.night) — this one is the floor it once was
    expect(HEADER_APPROACH.stops).toBeLessThan(HEADER_BAND.night);
    // without a step
    let last = headerBandApproach(0.78);
    for (let s = 0.782; s <= 0.97; s += 0.002) {
      const v = headerBandApproach(s);
      expect(Math.abs(v - last)).toBeLessThan(HEADER_APPROACH.stops * 0.1);
      last = v;
    }
  });

  it('covers the header and stops well above the middle of the frame', () => {
    // The header is 62px of a 900px frame.
    expect(HEADER_BAND.full).toBeGreaterThanOrEqual(62 / 900);
    expect(HEADER_BAND.zero).toBeLessThan(0.3);
  });
});

describe('the approach', () => {
  const at = (yFromTop: number) => stopsAt(0.5, 1 - yFromTop);

  it('burns in the foot of the frame while the portico passes, and nothing above the copy', () => {
    lensFilter.stops = 0;
    approachFilter(0.85);
    expect(lensFilter.stops).toBeCloseTo(APPROACH_ND.stops, 5);
    // The copy stands from 75% to 89% of the height.
    for (const y of [0.75, 0.82, 0.89, 0.99]) expect(at(y)).toBeGreaterThan(APPROACH_ND.stops * 0.95);
    expect(at(0.59)).toBe(0);
    expect(at(0.3)).toBe(0);
  });

  it('is off before the flank and once the camera is on the axis', () => {
    for (const s of [0.5, 0.78, 0.92, 0.99]) {
      lensFilter.stops = 0;
      approachFilter(s);
      expect(lensFilter.stops).toBe(0);
    }
  });

  it('never weakens a denser filter already on the lens', () => {
    lensFilter.stops = 3;
    lensFilter.shape.set(0.2, 0.5, 0.3, 0.2);
    approachFilter(0.85);
    expect(lensFilter.stops).toBe(3);
    expect(lensFilter.shape.x).toBe(0.2);
  });
});

describe("the colophon over the film's last light", () => {
  // The map table's top at the coda's end (codaFrame.test.ts has where it
  // comes from): on a desk beside the sign-off, on a phone above it.
  const DESK = { l: 0.542, t: 0.216, r: 0.828, b: 0.509 };
  const PHONE = { l: 0.122, t: 0.21, r: 0.877, b: 0.43 };
  const line = (l: number, t: number, r: number, h = 0.016) => ({ l, t, r, b: t + h });
  // The colophon on a 1440x900 frame at the page's end, as measured: the
  // sign-off's column, then the rows that run the grid's width.
  const signOff = [
    line(0.117, 0.184, 0.145),
    line(0.117, 0.223, 0.392, 0.123),
    line(0.117, 0.371, 0.351, 0.048),
    line(0.153, 0.472, 0.369),
  ];
  const rows = (top: number) => [
    line(0.117, top, 0.205),
    line(0.51, top, 0.583),
    line(0.603, top, 0.677),
    line(0.117, top + 0.14, 0.353, 0.057),
    line(0.639, top + 0.14, 0.87, 0.057),
    line(0.117, top + 0.246, 0.883),
  ];

  it('asks for nothing where there is no table, or no colophon', () => {
    expect(colophonCover(rows(0.3), null)).toBe(0);
    expect(colophonCover([], DESK)).toBe(0);
  });

  it('leaves the land lit on a desk: the sign-off is beside it and the rows end under it', () => {
    expect(colophonCover([...signOff, ...rows(0.667)], DESK)).toBe(0);
    // a laptop's 1536x730, and a 13-inch one's 1280x593 (its rows 4.5% under the rim)
    expect(colophonCover([...signOff, ...rows(0.626)], DESK)).toBe(0);
    expect(colophonCover(rows(0.554), DESK)).toBe(0);
    // the sign-off alone, at any height: beside it, never over it
    for (let dy = -0.3; dy <= 0.6; dy += 0.05) {
      expect(colophonCover(signOff.map((b) => ({ ...b, t: b.t + dy, b: b.b + dy })), DESK)).toBe(0);
    }
  });

  it('closes the lens as the first row that will cross the table comes to its foot', () => {
    let prev = 0;
    for (let top = DESK.b + CODA_FADE.reach; top >= DESK.b - 0.001; top -= 0.002) {
      const c = colophonCover(rows(top), DESK);
      expect(c).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = c;
    }
    expect(colophonCover(rows(DESK.b + CODA_FADE.reach), DESK)).toBe(0);
    expect(colophonCover(rows(DESK.b), DESK)).toBe(1);
    expect(colophonCover(rows(0.3), DESK)).toBe(1);
    // whole before any of a row's words is over the rim
    expect(colophonCover(rows(DESK.b + 0.001), DESK)).toBeGreaterThan(0.99);
  });

  it('counts a line that reaches across any part of the table, and not one beside it', () => {
    const mid = (DESK.t + DESK.b) / 2;
    expect(colophonCover([line(0.2, mid, DESK.l - CODA_FADE.beside - 0.01)], DESK)).toBe(0);
    expect(colophonCover([line(0.2, mid, DESK.l + 0.01)], DESK)).toBe(1);
    expect(colophonCover([line(DESK.r - 0.01, mid, 0.95)], DESK)).toBe(1);
    expect(colophonCover([line(DESK.r + CODA_FADE.beside + 0.01, mid, 0.97)], DESK)).toBe(0);
  });

  it('stays closed from the first line on the table to the last: no letting go in the gaps', () => {
    // A phone: every line crosses. The colophon comes up from the foot of the
    // frame; from the moment its first line touches the table until the
    // page's end the lens is closed — through the sixth of a viewport of
    // nothing between the sign-off and the links.
    const colophon = (top: number) => [
      line(0.062, top, 0.2),
      line(0.062, top + 0.05, 0.86, 0.09),
      line(0.062, top + 0.18, 0.88, 0.05),
      line(0.062, top + 0.3, 0.36),
      // ...the gap...
      line(0.062, top + 0.56, 0.74),
      line(0.062, top + 0.62, 0.71),
      line(0.062, top + 0.9, 0.87),
      line(0.062, top + 1.2, 0.94),
    ];
    // (what ChapterFade publishes: the lines in the frame, under the header)
    const seen = (top: number) => colophon(top).filter((b) => b.t > 0.09 && b.t < 1);
    expect(colophonCover(seen(0.75), PHONE)).toBe(0);
    expect(colophonCover(seen(PHONE.b + CODA_FADE.reach + 0.001), PHONE)).toBe(0);
    for (let top = PHONE.b; top >= -0.28; top -= 0.01) {
      expect(colophonCover(seen(top), PHONE), `top ${top.toFixed(2)}`).toBe(1);
    }
  });

  it('opens again once the last of them has cleared the top of the table', () => {
    const above = [line(0.2, DESK.t - CODA_FADE.reach - 0.03, 0.7)];
    expect(colophonCover(above, DESK)).toBe(0);
    expect(colophonCover([line(0.2, DESK.t - 0.02, 0.7)], DESK)).toBeGreaterThan(0.9);
  });

  it('is density over the whole frame, eased, and touches nothing else on the lens', () => {
    codaFilterClear();
    lensFilter.stops = 1.1;
    lensFilter.top = 2.2;
    const shape = lensFilter.shape.toArray();
    codaFilter(rows(0.3), DESK, 1 / 60);
    expect(lensFilter.all).toBeGreaterThan(0);
    expect(lensFilter.all).toBeLessThan(CODA_FADE.stops * 0.2);
    for (let i = 0; i < 240; i += 1) codaFilter(rows(0.3), DESK, 1 / 60);
    expect(lensFilter.all).toBeCloseTo(CODA_FADE.stops, 3);
    expect(lensFilter.stops).toBe(1.1);
    expect(lensFilter.top).toBe(2.2);
    expect(lensFilter.shape.toArray()).toEqual(shape);
    // and opens the same way, to exactly nothing
    for (let i = 0; i < 600; i += 1) codaFilter([], DESK, 1 / 60);
    expect(lensFilter.all).toBe(0);
    codaFilter(rows(0.3), DESK, 1 / 60);
    codaFilterClear();
    expect(lensFilter.all).toBe(0);
    lensFilter.stops = 0;
    lensFilter.top = 0;
  });

  it('is dense enough for the quietest line on the lit relief, and no denser than keeps the land in the picture', () => {
    // Measured on the phone's last frames with the lens closed by this much:
    // the relief under the links at a p90 luma of 64 at 3.0 stops and 46 at
    // 3.5 — ivory at 85% on either is past 6.9:1.
    expect(CODA_FADE.stops).toBeGreaterThanOrEqual(3);
    expect(CODA_FADE.stops).toBeLessThanOrEqual(3.5);
  });
});
