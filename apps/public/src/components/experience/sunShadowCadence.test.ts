// apps/public/src/components/experience/sunShadowCadence.test.ts
//
// The sun's shadow map is drawn when what is in it can have changed, not on
// every frame (softSunShadows.ts, SUN_SHADOW_CADENCE).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUN_SHADOW_CADENCE, sunShadowDue, type SunShadowState } from './softSunShadows';

const fresh = (): SunShadowState => ({ owed: SUN_SHADOW_CADENCE.onMount, frame: 0 });
const run = (st: SunShadowState, frames: number, moving = false, noMap = false) => {
  let drawn = 0;
  for (let i = 0; i < frames; i += 1) if (sunShadowDue(st, moving, noMap)) drawn += 1;
  return drawn;
};

describe("the sun's shadow map", () => {
  it('is drawn on every frame while the estate may still be arriving, then twice a second', () => {
    const st = fresh();
    expect(run(st, SUN_SHADOW_CADENCE.onMount)).toBe(SUN_SHADOW_CADENCE.onMount);
    // a still estate: ten seconds at sixty frames a second
    const drawn = run(st, 600);
    expect(drawn).toBe(600 / SUN_SHADOW_CADENCE.every);
    // a thirtieth of the work it was
    expect(drawn / 600).toBeLessThan(0.05);
  });

  it("is drawn on every frame of a passage through the door, and until the leaves have settled", () => {
    const st = fresh();
    run(st, 200);
    // the passage: every frame
    expect(run(st, 240, true)).toBe(240);
    // and for half a second after it
    expect(run(st, SUN_SHADOW_CADENCE.afterDoor - 1)).toBe(SUN_SHADOW_CADENCE.afterDoor - 1);
    // then back to the net
    expect(run(st, 300)).toBeLessThanOrEqual(300 / SUN_SHADOW_CADENCE.every + 1);
  });

  it('is drawn at once when the light has no map (a change of tier disposes it)', () => {
    const st = fresh();
    run(st, 200);
    // settle onto a frame the net does not fall on
    while ((st.frame + 1) % SUN_SHADOW_CADENCE.every === 0) sunShadowDue(st, false, false);
    expect(sunShadowDue(st, false, true)).toBe(true);
    expect(sunShadowDue(st, false, false)).toBe(true);
  });

  it('is held by the light itself, in a loop that runs on a still page too', () => {
    const src = readFileSync(join(__dirname, 'WorldCanvas.tsx'), 'utf8');
    expect(src).toContain('light.shadow.autoUpdate = false;');
    expect(src).toContain(
      "if (sunShadowDue(sunShadow.current, doorwayState.mode === 'running', light.shadow.map === null)) {",
    );
    // before the scroll-driven loop's early return, not inside it
    expect(src.indexOf('sunShadowDue(sunShadow.current')).toBeLessThan(src.indexOf('if (!driveByScroll) return;'));
    // and no depth pass runs the wind: a swaying tree would need its shadow redrawn
    const dir = __dirname;
    for (const f of ['exteriorFoliage.ts', 'ExteriorModel.tsx', 'softSunShadows.ts']) {
      expect(readFileSync(join(dir, f), 'utf8')).not.toMatch(/customDepthMaterial\s*=/);
    }
  });
});
