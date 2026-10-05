// apps/public/src/components/experience/lensFilter.test.ts
//
// Where the lens's filter falls: across the copy, never on the plan, and only
// while its chapter is on screen.

import { describe, expect, it } from 'vitest';
import {
  APPROACH_ND,
  CODA_FADE,
  ESTABLISH_ND,
  HEADER_BAND,
  COVER_LAND_ND,
  REVOLUTION_SHORT_ND,
  COVER_SKY,
  coverSkyStops,
  HOLDINGS_ND,
  HOLDINGS_SHAPE,
  HOLDINGS_WIDE_OPEN,
  PHONE_HOLDINGS_BOOST,
  PHONE_ROOM,
  PHONE_SKY,
  PHONE_SKY_ND,
  ROOM_ND,
  STATION_ND,
  TABLE_BAND,
  approachFilter,
  codaFilter,
  codaFilterClear,
  colophonCover,
  headerBandApproach,
  headerBandOutside,
  headerBandReach,
  HEADER_APPROACH,
  holdingsFilter,
  lensFilter,
  phoneRoomFilter,
  phoneSkyFilter,
  stationFilter,
  tableBandFilter,
} from './lensFilter';

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
    stationFilter({ S1: 0, S2: 1, S3: 0 }, WIDE);
    expect(lensFilter.stops).toBe(STATION_ND.S2);
    expect(STATION_ND.S2).toBeGreaterThan(0.8);
    expect(STATION_ND.S2).toBeLessThan(STATION_ND.S3);
  });

  it('is no denser at any table than its ivory copy needs', () => {
    // 2.4 stops was "a bit too much" (the client, of the first table). Ivory
    // capitals want a ground under a luma of 105; small gilt wanted 80, and
    // the numeral that was gilt is ivory now (site-home). The first table's
    // small lines stand on the pilaster's foot and set its floor.
    expect(STATION_ND.S1).toBeLessThan(2.4);
    expect(STATION_ND.S1).toBeGreaterThanOrEqual(2.0);
    expect(STATION_ND.S3).toBeLessThan(STATION_ND.S1);
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

describe('the holdings', () => {
  it('keeps its soft ellipse after the tables have set a hard one', () => {
    stationFilter({ S1: 1 }, WIDE);
    holdingsFilter(0.6);
    expect(lensFilter.inner).toBe(0.35);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.stops, 5);
  });

  it('opens denser while the sunset is in the frame, and eases off after', () => {
    holdingsFilter(0.44);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.open + HOLDINGS_WIDE_OPEN, 5);
    holdingsFilter(0.51);
    expect(lensFilter.stops).toBeLessThan(HOLDINGS_ND.open + HOLDINGS_WIDE_OPEN);
    expect(lensFilter.stops).toBeGreaterThan(HOLDINGS_ND.stops);
    // ...and has given all of it back once the evening has settled
    holdingsFilter(0.56);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.stops, 5);
  });

  it('is off outside its chapter', () => {
    // (before it, the lens wears the cover's sky grad until the camera has
    // turned: off by COVER_SKY.off[1])
    holdingsFilter(0.32);
    expect(lensFilter.stops).toBe(0);
    holdingsFilter(0.9);
    expect(lensFilter.stops).toBe(0);
  });

  it('reaches down over the figures and their labels, and no further across than it did', () => {
    holdingsFilter(0.6);
    expect(lensFilter.shape.toArray()).toEqual([...HOLDINGS_SHAPE]);
    // the figures' row (67 to 73% of the way down) and the labels under it, to the row's far end
    expect(stopsAt(0.33, 0.3)).toBeGreaterThan(HOLDINGS_ND.stops * 0.9);
    expect(stopsAt(0.355, 0.245)).toBeGreaterThan(HOLDINGS_ND.stops * 0.6);
    // the eyebrow, at the top of the block, as before
    expect(stopsAt(0.15, 0.52)).toBeGreaterThan(HOLDINGS_ND.stops * 0.9);
    // and the house, from 42% of the width, all but clear
    expect(stopsAt(0.5, 0.4)).toBeLessThan(HOLDINGS_ND.stops * 0.15);
    expect(stopsAt(0.56, 0.4)).toBe(0);
  });
});

describe("the cover's sky", () => {
  it('is a grad across the whole sky from the first frame, ridden off as the camera turns to the sun', () => {
    expect(coverSkyStops(0)).toBe(COVER_SKY.stops);
    expect(coverSkyStops(COVER_SKY.off[0])).toBe(COVER_SKY.stops);
    expect(coverSkyStops(COVER_SKY.off[1])).toBe(0);
    // off before the holdings' own grad begins: the two never trade places
    expect(COVER_SKY.off[1]).toBeLessThanOrEqual(HOLDINGS_ND.from[0]);
    // without a step
    let last = coverSkyStops(0.19);
    for (let s = 0.192; s <= 0.32; s += 0.002) {
      const v = coverSkyStops(s);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      expect(last - v).toBeLessThan(COVER_SKY.stops * 0.06);
      last = v;
    }
  });

  it('holds its density over the words and is gone before the roofline', () => {
    holdingsFilter(0, 1.6);
    // across the whole width, not a shape behind the text
    for (const x of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      expect(stopsAt(x, 1 - 0.12)).toBeCloseTo(COVER_SKY.stops, 1);
    }
    // full to the foot of the title
    expect(stopsAt(0.3, 1 - (COVER_SKY.full - 0.02))).toBeCloseTo(COVER_SKY.stops, 1);
    // and gone at the horizon, well above the house's parapet
    expect(stopsAt(0.6, 1 - 0.4)).toBe(0);
    // a grad a photographer would use on a sky, not a blackout
    expect(COVER_SKY.stops).toBeLessThanOrEqual(1.4);
  });

  it("gives way to the holdings' grad", () => {
    holdingsFilter(0.5, 1.6);
    expect(lensFilter.inner).toBe(0.35);
    expect(lensFilter.stops).toBeGreaterThan(COVER_SKY.stops);
  });

  it("wears half a stop under the cover's small type, on a second ellipse, while that copy is up", () => {
    holdingsFilter(0, 1.6, 1);
    expect(lensFilter.second.stops).toBe(COVER_LAND_ND.stops);
    // the sky grad is still the first ellipse's
    expect(lensFilter.stops).toBe(COVER_SKY.stops);
    holdingsFilter(0.05, 1.6, 0.5);
    expect(lensFilter.second.stops).toBeCloseTo(COVER_LAND_ND.stops * 0.5, 9);
    holdingsFilter(0.1, 1.6, 0);
    expect(lensFilter.second.stops).toBe(0);
    // never a filter a visitor could name
    expect(COVER_LAND_ND.stops).toBeLessThanOrEqual(0.6);
  });

  it("and a stop under the revolution's copy on a short frame only", () => {
    // a wide frame that is not short asks for none
    holdingsFilter(0.22, 1.6, 0, 0);
    expect(lensFilter.second.stops).toBe(0);
    // a phone on its side, its copy up
    holdingsFilter(0.22, 844 / 390, 0, 1);
    expect(lensFilter.second.stops).toBe(REVOLUTION_SHORT_ND.stops);
    expect(lensFilter.second.inner).toBe(REVOLUTION_SHORT_ND.inner);
    // under the block (22 to 49% of that frame's width, 62 to 80% of the way
    // down), and off the house on the right
    expect(lensFilter.second.shape.x).toBeGreaterThan(0.3);
    expect(lensFilter.second.shape.x).toBeLessThan(0.42);
    expect(lensFilter.second.shape.x + lensFilter.second.shape.z).toBeLessThan(0.62);
    // leaving with the copy
    holdingsFilter(0.3, 844 / 390, 0, 0.25);
    expect(lensFilter.second.stops).toBeCloseTo(REVOLUTION_SHORT_ND.stops * 0.25, 9);
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

  it('eases rather than steps when a chapter arrives', () => {
    settle([]);
    phoneSkyFilter([{ id: 'hero', weight: 1, top: 0.1, bottom: 0.46 }], 0, 1 / 60);
    expect(lensFilter.stops).toBeGreaterThan(0);
    expect(lensFilter.stops).toBeLessThan(0.3);
  });

  it("rides the holdings' density, opened denser into the sunset and given back as it settles", () => {
    settle([{ id: 'holdings', weight: 1, top: 0.3, bottom: 0.7 }], 0.44);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.open + PHONE_HOLDINGS_BOOST, 1);
    expect(at(0.69)).toBeGreaterThan((HOLDINGS_ND.open + PHONE_HOLDINGS_BOOST) * 0.95);
    settle([{ id: 'holdings', weight: 1, top: 0.3, bottom: 0.7 }], 0.6);
    expect(lensFilter.stops).toBeCloseTo(HOLDINGS_ND.stops, 1);
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
  it('is the day\'s by day, the evening\'s under the lit sunset, and the night\'s at dusk', () => {
    expect(headerBandOutside(0)).toBe(HEADER_BAND.day);
    expect(headerBandOutside(1)).toBeCloseTo(HEADER_BAND.evening, 6);
    expect(headerBandOutside(1, 1)).toBeCloseTo(HEADER_BAND.night, 6);
    // never less than a stop: under that the band's ceiling is not fully down
    for (const [e, n] of [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1]] as const) {
      expect(headerBandOutside(e, n)).toBeGreaterThanOrEqual(1);
    }
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
