// apps/public/src/components/experience/exteriorJungle.test.ts
//
// The jungle round the estate (the concept built 1:1, 2026-10-27) stands
// outside the walls, never in the drive's corridor, and never on another tree.

import { describe, expect, it } from 'vitest';
import {
  AVENUE,
  CANOPY,
  EMERGENT,
  FILL,
  GIANTS,
  GROW,
  WALLS,
  beltGrowth,
  canopyGeometry,
  canopyReach,
  fillTrees,
  onTheEstate,
} from './exteriorJungle';

describe('the jungle round the estate', () => {
  it('stands its great trees and its palms outside the walls', () => {
    for (const t of [...GIANTS, ...EMERGENT]) expect(onTheEstate(t.at[0], t.at[1])).toBe(false);
    // the two that frame the cover are giants; the third smaller
    expect(GIANTS[0].scale).toBeGreaterThanOrEqual(2.5);
    expect(GIANTS[1].scale).toBeGreaterThanOrEqual(2.5);
  });

  it('grows the belt with distance from the house, and only so far', () => {
    expect(beltGrowth(0, 60, false)).toBe(1);
    expect(beltGrowth(0, -400, false)).toBeCloseTo(GROW.max, 9);
    expect(beltGrowth(0, -400, true)).toBeCloseTo(GROW.palm, 9);
    expect(GROW.palm).toBeLessThan(GROW.max);
  });

  it('sows the gaps clear of the estate, the canopy and every stem', () => {
    const stems: [number, number][] = [
      [100, -120],
      [-110, -60],
      [130, 40],
    ];
    const trees = fillTrees(stems);
    expect(trees.length).toBeGreaterThan(20);
    expect(trees.length).toBeLessThanOrEqual(FILL.count);
    const all: (readonly [number, number])[] = [...stems, ...GIANTS.map((g) => g.at), ...EMERGENT.map((e) => e.at)];
    for (const t of trees) {
      expect(onTheEstate(t.at[0], t.at[1])).toBe(false);
      expect(canopyReach(t.at[0], t.at[1])).toBeLessThanOrEqual(0.02);
      for (const s of all) expect(Math.hypot(t.at[0] - s[0], t.at[1] - s[1])).toBeGreaterThanOrEqual(FILL.spacing);
      all.push(t.at);
    }
    // the same sowing every time
    expect(fillTrees(stems)).toEqual(trees);
  });

  it('roofs the forest beyond the belt, never over the walls or the drive', () => {
    const g = canopyGeometry();
    const p = g.getAttribute('position');
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < p.count; i += 1) {
      const x = p.getX(i);
      const z = p.getZ(i);
      expect(canopyReach(x, z)).toBeGreaterThan(-1e-6);
      expect(Math.abs(x) < WALLS.x && z > WALLS.z0 && z < WALLS.z1).toBe(false);
      expect(Math.abs(x) < AVENUE.x && z > AVENUE.z0 && z < CANOPY.cz + CANOPY.b * 0.99).toBe(false);
      low = Math.min(low, p.getY(i));
      high = Math.max(high, p.getY(i));
    }
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(CANOPY.height[1] + 1e-6);
    expect(g.getAttribute('uv').count).toBe(p.count);
  });
});
