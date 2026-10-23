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
  placeLabels,
  placePins,
  reliefAt,
  type MapMeta,
} from './mapTablePlan';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

describe("the pins' names (the forensic audit of 2026-10-09, #49)", () => {
  const frame = { width: 1920, height: 945, gap: 7, margin: 8, top: 94 };
  const plate = { w: 180, h: 20 };
  const box = (p: { x: number; y: number }) => ({ l: p.x, t: p.y, r: p.x + plate.w, b: p.y + plate.h });
  const meet = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
    Math.min(a.r, b.r) > Math.max(a.l, b.l) && Math.min(a.b, b.b) > Math.max(a.t, b.t);

  it('stand over their heads where there is room', () => {
    const [at] = placeLabels([{ x: 960, y: 500 }], [plate], frame);
    expect(at.x).toBeCloseTo(960 - plate.w / 2, 6);
    expect(at.y).toBeCloseTo(500 - frame.gap - plate.h, 6);
  });

  it('never stand on each other, nor on another pin, and keep inside the frame', () => {
    // three pins as the film's 89% has them, and as a phone's map has them
    for (const [pts, f] of [
      [[{ x: 930, y: 490 }, { x: 1030, y: 550 }, { x: 1230, y: 450 }], frame],
      [[{ x: 105, y: 672 }, { x: 157, y: 710 }, { x: 257, y: 655 }], { ...frame, width: 390, height: 844, top: 84 }],
      [[{ x: 600, y: 400 }, { x: 640, y: 405 }, { x: 680, y: 398 }], frame],
    ] as const) {
      const sizes = pts.map(() => ({ ...plate, w: f.width < 500 ? 150 : plate.w }));
      const at = placeLabels(pts, sizes, f);
      const boxes = at.map((p, i) => ({ l: p.x, t: p.y, r: p.x + sizes[i].w, b: p.y + sizes[i].h }));
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) expect(meet(boxes[i], boxes[j]), `${i} and ${j}`).toBe(false);
        pts.forEach((p, j) => {
          if (j === i) return;
          const head = { l: p.x - 5, t: p.y - 5, r: p.x + 5, b: p.y + 5 };
          expect(meet(boxes[i], head), `name ${i} on pin ${j}`).toBe(false);
        });
        expect(boxes[i].l).toBeGreaterThanOrEqual(f.margin);
        expect(boxes[i].r).toBeLessThanOrEqual(f.width - f.margin);
        expect(boxes[i].t).toBeGreaterThanOrEqual(f.top);
      }
    }
    expect(box({ x: 0, y: 0 }).r).toBe(plate.w);
  });

  it('end at a pin by the frame\u2019s edge, over it, and not run off the frame', () => {
    const [at] = placeLabels([{ x: 1900, y: 500 }], [plate], frame);
    expect(at.x + plate.w).toBeLessThanOrEqual(frame.width - frame.margin);
    expect(at.x + plate.w).toBeCloseTo(1910, 6);
    expect(at.y).toBeCloseTo(500 - frame.gap - plate.h, 6);
  });

  it('are drawn by the table, and styled as the hall\u2019s plates', () => {
    const table = readFileSync(join(__dirname, 'MapTable.tsx'), 'utf8');
    expect(table).toContain('placeLabels(pts, nameSizes.current');
    expect(table).toContain("el.className = 'map-pin-name'");
    // in the film only: a page's still frame has the table wherever its place puts it
    expect(table).toContain('mapStage.named && st && st.r - st.l >= PIN_NAMES.minWidth');
    const stage = readFileSync(join(__dirname, 'InteriorStage.tsx'), 'utf8');
    expect(stage).toContain("mapStage.named = mode !== 'still';");
    const css = readFileSync(join(__dirname, '..', '..', 'app', 'globals.css'), 'utf8');
    expect(css).toMatch(/\.map-pin-name \{[^}]*background: #15110c;[^}]*color: var\(--gilt\);/);
    // and the rim's highlight is drawn a pixel wide (MAP_SPECULAR)
    expect(table).toContain(".replace('#include <lights_physical_fragment>', MAP_SPECULAR_AA)");
  });
});
