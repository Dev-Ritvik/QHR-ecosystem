// apps/public/src/components/experience/windowLight.test.ts
//
// The clerestory's shafts are drawn by their back faces against the room's
// depth, so they must end above everything that lies on the floor.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(__dirname, 'WindowLight.tsx'), 'utf8');
const num = (name: string) => {
  const m = new RegExp('const ' + name + ' = ([0-9.]+);').exec(src);
  if (!m) throw new Error(`${name} not found`);
  return Number(m[1]);
};

describe("the clerestory's shafts", () => {
  it('stop clear of the rug: no part of a shaft is under anything that lies on the floor', () => {
    // The rug in interior_hall.glb: dress_rug_border's top at y 0.03,
    // dress_rug_field's at 0.04.
    const RUG_TOP = 0.04;
    const clear = num('SHAFT_FLOOR_CLEAR');
    expect(clear).toBeGreaterThan(RUG_TOP);
    // ...and the prism's length is the one that ends there: the sill's edge,
    // carried along the light, comes down to exactly that height.
    expect(src).toContain('const LENGTH = (SILL - SHAFT_FLOOR_CLEAR) / -DIR.y;');
    const sill = num('SILL');
    const dir = /const DIR = new THREE\.Vector3\(([-\d.]+), ([-\d.]+), ([-\d.]+)\)\.normalize\(\);/.exec(src)!;
    const d = [Number(dir[1]), Number(dir[2]), Number(dir[3])];
    const len = Math.hypot(d[0], d[1], d[2]);
    const dy = d[1] / len;
    const length = (sill - clear) / -dy;
    expect(sill + dy * length).toBeCloseTo(clear, 9);
    // a shaft that still comes all but down to the floor
    expect(clear).toBeLessThan(0.1);
  });

  it('are still drawn by their back faces, against the depth of the room', () => {
    expect(src).toContain('side: THREE.BackSide,');
    expect(src).toContain('depthWrite: false,');
  });
});
