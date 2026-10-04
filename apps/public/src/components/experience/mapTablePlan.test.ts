// apps/public/src/components/experience/mapTablePlan.test.ts
//
// Where the map table's pins stand: in their own district, on the plain, apart
// from each other, and in the same place on every visit.

import { describe, expect, it } from 'vitest';
import {
  DISTRICT,
  MAP_SUN,
  MAP_TABLE,
  MAP_TOP,
  PIN_GAP,
  PIN_MAX,
  PIN_MIN,
  PIN_RADIUS,
  districtOf,
  placePins,
  reliefAt,
  type MapMeta,
} from './mapTablePlan';

/** A made-up land: sea below the diagonal, Vizianagaram west, Srikakulam east,
 *  a ridge of hills across the top. */
function syntheticMeta(): MapMeta {
  const n = 128;
  const height = new Uint8Array(n * n);
  const district = new Uint8Array(n * n);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const k = j * n + i;
      const sea = j > n - i * 0.5 - 10; // south-east
      if (sea) {
        district[k] = DISTRICT.sea;
        height[k] = 0;
        continue;
      }
      district[k] = i < n / 2 ? DISTRICT.vizianagaram : DISTRICT.srikakulam;
      height[k] = j < 30 ? 200 : 8; // hills in the north, plain elsewhere
    }
  }
  return { size: n, height, district };
}

const PROJECTS = [
  { slug: 'kartikeya', name: 'Kartikeya', city: 'Vizianagaram', totalUnits: 180 },
  { slug: 'lucky-garden', name: 'Lucky Garden', city: 'Srikakulam', totalUnits: 120 },
  { slug: 'vsr-gayatri', name: 'VSR Gayatri', city: 'Srikakulam', totalUnits: 107 },
];

describe('the map table', () => {
  it('stands in the court of the stair, clear of the landing', () => {
    // The horseshoe's centre is (0, -3.1) and the court's inner radius 2.6 m:
    // the top must leave a walk round it.
    const clearance = 2.6 - (Math.hypot(MAP_TABLE.x, MAP_TABLE.z + 3.1) + MAP_TABLE.radius);
    expect(clearance).toBeGreaterThan(1.2);
  });

  it('is lit by the clerestory sun', () => {
    expect(Math.hypot(...MAP_SUN)).toBeCloseTo(1, 9);
    // From the east and above, 37 degrees up (WindowLight.DIR reversed).
    expect(MAP_SUN[0]).toBeGreaterThan(0.7);
    expect((Math.asin(MAP_SUN[1]) * 180) / Math.PI).toBeCloseTo(37.2, 0);
  });
});

describe('the pins', () => {
  const meta = syntheticMeta();

  it('reads a district from a published city', () => {
    expect(districtOf('Vizianagaram')).toBe(DISTRICT.vizianagaram);
    expect(districtOf('srikakulam')).toBe(DISTRICT.srikakulam);
    expect(districtOf('Visakhapatnam')).toBeNull();
    expect(districtOf(null)).toBeNull();
  });

  it('stands each layout in its own district, on the plain, apart', () => {
    const pins = placePins(PROJECTS, meta);
    expect(pins).toHaveLength(3);
    const n = meta.size;
    for (const [i, p] of pins.entries()) {
      const col = Math.floor(((p.x + MAP_TOP.half) / (2 * MAP_TOP.half)) * n);
      const row = Math.floor(((p.z + MAP_TOP.half) / (2 * MAP_TOP.half)) * n);
      const d = meta.district[row * n + col];
      expect(d, p.slug).toBe(districtOf(PROJECTS[i].city));
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(PIN_RADIUS + 1e-9);
      expect(p.base).toBeLessThan(0.02);
      expect(p.base).toBeCloseTo(reliefAt(meta, p.x, p.z), 9);
    }
    for (let i = 0; i < pins.length; i += 1) {
      for (let j = i + 1; j < pins.length; j += 1) {
        expect(Math.hypot(pins[i].x - pins[j].x, pins[i].z - pins[j].z)).toBeGreaterThanOrEqual(PIN_GAP);
      }
    }
  });

  it('is the same place on every visit, and a new layout does not move the others', () => {
    const a = placePins(PROJECTS, meta);
    const b = placePins(PROJECTS, meta);
    expect(b).toEqual(a);
    const c = placePins(
      [...PROJECTS, { slug: 'new-one', name: 'New', city: 'Vizianagaram', totalUnits: 60 }],
      meta,
    );
    // The first three, placed first, keep their places (the fourth yields).
    expect(c.slice(0, 3)).toEqual(a);
  });

  it('is as long as its layout is large', () => {
    const pins = placePins(PROJECTS, meta);
    const byUnits = [...PROJECTS].sort((p, q) => q.totalUnits - p.totalUnits);
    const len = (slug: string) => pins.find((p) => p.slug === slug)!.length;
    expect(len(byUnits[0].slug)).toBeCloseTo(PIN_MAX, 9);
    expect(len(byUnits[2].slug)).toBeLessThan(len(byUnits[0].slug));
    for (const p of pins) expect(p.length).toBeGreaterThanOrEqual(PIN_MIN);
    for (const p of pins) expect(p.href).toBe(`/projects/${p.slug}`);
  });
});
