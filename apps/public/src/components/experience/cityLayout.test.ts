// apps/public/src/components/experience/cityLayout.test.ts
//
// The city layout is DERIVED, and a derivation is only worth anything if it is
// reproducible. These are the properties the report claims about it, asserted
// rather than described.

import { describe, expect, it } from 'vitest';
import { buildBeacons, districtBands, FIELD, type CityProject } from './cityLayout';

/** The three published projects, exactly as projection.projects_pub returns
 *  them — queried live, not invented. Their order here is publication order. */
const PUBLISHED: CityProject[] = [
  {
    slug: 'kartikeya-water-front',
    name: 'Kartikeya Water Front',
    locality: 'Poosapatirega',
    city: 'Vizianagaram',
    totalUnits: 113,
    availableUnits: 113,
    soldOut: false,
  },
  {
    slug: 'lucky-garden',
    name: 'Lucky Garden',
    locality: 'Kumaram Village, Garividi',
    city: 'Vizianagaram',
    totalUnits: 181,
    availableUnits: 118,
    soldOut: false,
  },
  {
    slug: 'vsr-gayatri-township',
    name: 'VSR Gayatri Township',
    locality: 'Bayyannapeta, near Allinagaram',
    city: 'Srikakulam',
    totalUnits: 113,
    availableUnits: 113,
    soldOut: false,
  },
];

describe('city layout', () => {
  it('places every published project and invents none', () => {
    const beacons = buildBeacons(PUBLISHED);
    expect(beacons).toHaveLength(PUBLISHED.length);
    expect(beacons.map((b) => b.slug).sort()).toEqual(PUBLISHED.map((p) => p.slug).sort());
  });

  it('routes every beacon to a project route that exists', () => {
    for (const b of buildBeacons(PUBLISHED)) {
      // app/(site)/projects/[projectSlug]/page.tsx. Verified against the route
      // tree, not assumed: /projects (the index) is registered but unbuilt, and
      // linking a beacon there would be a 404.
      expect(b.href).toBe(`/projects/${b.slug}`);
      expect(b.slug).not.toBe('');
    }
  });

  it('is deterministic across calls', () => {
    const a = buildBeacons(PUBLISHED);
    const b = buildBeacons(PUBLISHED);
    expect(a.map((x) => [x.slug, x.x.toFixed(6), x.z.toFixed(6)])).toEqual(
      b.map((x) => [x.slug, x.x.toFixed(6), x.z.toFixed(6)]),
    );
  });

  it('is independent of the order it is handed the projects', () => {
    // Publication order decides which district band comes first, so a REVERSED
    // input legitimately mirrors the bands. What must not change is the shape:
    // the same projects, the same districts, the same relative placement inside
    // each band.
    const forward = buildBeacons(PUBLISHED);
    const reversed = buildBeacons([...PUBLISHED].reverse());
    for (const f of forward) {
      const r = reversed.find((x) => x.slug === f.slug)!;
      expect(r.district).toBe(f.district);
      expect(r.weight).toBeCloseTo(f.weight, 10);
      expect(r.z).toBeCloseTo(f.z, 6);
    }
  });

  it('keeps each district in its own band', () => {
    const bands = districtBands(PUBLISHED);
    expect(bands.map((b) => b.district)).toEqual(['Vizianagaram', 'Srikakulam']);
    for (const b of buildBeacons(PUBLISHED)) {
      const band = bands.find((x) => x.district === b.district)!;
      expect(b.x).toBeGreaterThanOrEqual(band.from);
      expect(b.x).toBeLessThanOrEqual(band.to);
    }
  });

  it('keeps every beacon inside the field the doorway frames', () => {
    for (const b of buildBeacons(PUBLISHED)) {
      expect(Math.abs(b.x)).toBeLessThanOrEqual(FIELD.halfWidth);
      expect(b.z).toBeGreaterThanOrEqual(FIELD.near);
      expect(b.z).toBeLessThanOrEqual(FIELD.far);
    }
  });

  it('never overlaps two beacons', () => {
    const beacons = buildBeacons(PUBLISHED);
    for (let i = 0; i < beacons.length; i += 1) {
      for (let j = i + 1; j < beacons.length; j += 1) {
        const d = Math.hypot(beacons[i].x - beacons[j].x, beacons[i].z - beacons[j].z);
        expect(d).toBeGreaterThan(6);
      }
    }
  });

  it('weights by real unit counts', () => {
    const beacons = buildBeacons(PUBLISHED);
    const lucky = beacons.find((b) => b.slug === 'lucky-garden')!;
    const kart = beacons.find((b) => b.slug === 'kartikeya-water-front')!;
    // 181 units against 113 — the largest layout is the heaviest beacon, and
    // the ratio is the data's, not a designer's.
    expect(lucky.weight).toBe(1);
    expect(kart.weight).toBeCloseTo(113 / 181, 6);
  });

  it('survives an empty and a single-project set', () => {
    expect(buildBeacons([])).toEqual([]);
    const one = buildBeacons([PUBLISHED[0]]);
    expect(one).toHaveLength(1);
    expect(one[0].weight).toBe(1);
    expect(Math.abs(one[0].x)).toBeLessThanOrEqual(FIELD.halfWidth);
  });

  it('scales past the published three without collapsing', () => {
    // A layout that only works for three is a hardcoded arrangement wearing a
    // function's clothes.
    const many: CityProject[] = Array.from({ length: 24 }, (_, i) => ({
      slug: `project-${i}`,
      name: `Project ${i}`,
      locality: 'Somewhere',
      city: ['Vizianagaram', 'Srikakulam', 'Visakhapatnam'][i % 3],
      totalUnits: 40 + i * 7,
      availableUnits: 10,
      soldOut: false,
    }));
    const beacons = buildBeacons(many);
    expect(beacons).toHaveLength(24);
    for (const b of beacons) {
      expect(Math.abs(b.x)).toBeLessThanOrEqual(FIELD.halfWidth);
      expect(b.z).toBeGreaterThanOrEqual(FIELD.near);
      expect(b.z).toBeLessThanOrEqual(FIELD.far);
    }
  });
});
