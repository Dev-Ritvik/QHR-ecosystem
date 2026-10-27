// apps/public/src/components/experience/fishLeap.test.ts
//
// The fountain's fish (fishLeap.ts, FountainFish.tsx): where it leaps, how
// high, and that it is hidden where it waits.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOUNTAIN } from './exteriorWater';
import { FISH, FISH_NAME, chord, leapPose, surfaceTimes } from './fishLeap';

const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');
const fromCentre = (x: number, z: number) => Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z);

describe("the fountain's fish", () => {
  it('leaps inside the lower basin, outside the upper bowl, on the side the first frames see', () => {
    for (let k = 0; k < 12; k += 1) {
      const [a, b] = chord(k);
      for (const [x, z] of [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]] as const) {
        // the fish's half length (0.3 m) clear of the basin's rim
        expect(fromCentre(x, z)).toBeLessThan(FOUNTAIN.r - 0.3);
        // and of the upper bowl's (radius 1.95), which stands over the arc
        expect(fromCentre(x, z)).toBeGreaterThan(2.0);
      }
      // the film comes from the south-west: the arcs are on that side (x < 0)
      expect((a[0] + b[0]) / 2).toBeLessThan(FOUNTAIN.x - 1.5);
    }
  });

  it('comes up out of the water and goes back in, its body along its path', () => {
    const c = chord(0);
    const start = leapPose(0, c);
    const top = leapPose(0.5, c);
    const end = leapPose(1, c);
    expect(start.y).toBeCloseTo(FOUNTAIN.level - FISH.under, 6);
    expect(end.y).toBeCloseTo(FOUNTAIN.level - FISH.under, 6);
    expect(top.y).toBeCloseTo(FOUNTAIN.level + FISH.peak, 6);
    // nose up going up, level at the top, down coming down (less the model's own tilt)
    expect(start.pitch + FISH.tilt).toBeGreaterThan(0.8);
    expect(top.pitch + FISH.tilt).toBeCloseTo(0, 6);
    expect(end.pitch + FISH.tilt).toBeLessThan(-0.8);
    const [up, down] = surfaceTimes();
    expect(leapPose(up, c).y).toBeCloseTo(FOUNTAIN.level, 6);
    expect(leapPose(down, c).y).toBeCloseTo(FOUNTAIN.level, 6);
    expect(up).toBeGreaterThan(0);
    expect(down).toBeLessThan(1);
  });

  it('waits under the water, its fins under the surface', () => {
    // the generated betta is 0.35 m from fin to fin, its middle at its origin
    expect(FISH.restDepth).toBeGreaterThan(0.35 / 2);
  });

  it("is the estate's own object, made to leap on a scroll in view, and never in a still", () => {
    const gen = read('../../../../../tools/blender/build_estate_v7.py');
    expect(gen).toContain('ob = bpy.data.objects.new("fountain_fish", me)');
    expect(FISH_NAME).toBe('fountain_fish');
    const comp = read('FountainFish.tsx');
    expect(comp).toContain('__estateStillShoot === true');
    expect(comp).toContain('prefers-reduced-motion: reduce');
    expect(comp).toContain('inView(f, s.k + 1)');
    expect(read('WorldCanvas.tsx')).toContain('<FountainFish root={exteriorRoot} />');
  });
});
