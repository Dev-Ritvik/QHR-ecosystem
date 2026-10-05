// apps/public/src/components/experience/paidAudit.test.ts
//
// The paid audit of 2026-10-04 (light, camera, type): what its passes rest on.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BEATS, FILM_SHARE, UPRIGHT_LENS, lensAt, uprightLensAt } from './cameraPath';
import { HEADER_BAND, headerBandReach, lensFilter } from './lensFilter';
import { ld, ldColour, ldQuery, lookdevOn } from './lookdev';
import { SKY_HAZE_BINS, setSkyHaze, skyHazeReady, skyHazeToward } from './skyHaze';
import { PCSS_SAMPLES, PCSS_SEARCH } from './softSunShadows';

describe("the land's air, read from the sky", () => {
  it('is the foot of the sky the camera is looking at', () => {
    // A plate that is red toward +x (u = 0.5) and blue toward -x (u = 0 / 1).
    const table = new Float32Array(SKY_HAZE_BINS * 3);
    for (let b = 0; b < SKY_HAZE_BINS; b += 1) {
      const u = (b + 0.5) / SKY_HAZE_BINS;
      const towardX = Math.abs(u - 0.5) < 0.25;
      table[b * 3] = towardX ? 1 : 0;
      table[b * 3 + 2] = towardX ? 0 : 1;
    }
    setSkyHaze(table);
    expect(skyHazeReady()).toBe(true);
    const c = new THREE.Color();
    skyHazeToward(1, 0, 0.2, c);
    expect(c.r).toBeCloseTo(1, 5);
    expect(c.b).toBeCloseTo(0, 5);
    // ...and across the seam at u = 0 | 1 the average wraps rather than stops
    skyHazeToward(-1, 0, 0.2, c);
    expect(c.b).toBeCloseTo(1, 5);
    expect(c.r).toBeCloseTo(0, 5);
    // a wide slice across the join of the two is a mix of both
    skyHazeToward(0, 1, 0.6, c);
    expect(c.r).toBeGreaterThan(0.2);
    expect(c.b).toBeGreaterThan(0.2);
    setSkyHaze(null);
    expect(skyHazeReady()).toBe(false);
  });
});

describe('look development', () => {
  it('is off without the flag: every reader returns what ships', () => {
    expect(lookdevOn()).toBe(false);
    expect(ld('fill', 1.25)).toBe(1.25);
    expect(ldQuery('soften', 3.5)).toBe(3.5);
    const shipped = new THREE.Color('#42424A');
    expect(ldColour('hazeNight', shipped)).toBe(shipped);
  });
});

describe("an upright screen's lens, outside", () => {
  it('opens the cover to hold the whole front, and gives the revolution the lens it had', () => {
    const hero = BEATS.find((b) => b.id === 'hero')!;
    const quarter = BEATS.find((b) => b.id === 'quarter')!;
    const threeQuarter = BEATS.find((b) => b.id === 'three-quarter')!;
    expect(uprightLensAt(0)).toEqual(UPRIGHT_LENS.hero);
    // the revolution's beats were 56 and 52 degrees before the audit's lenses
    const widened = (fov: number, widen: number) =>
      (Math.atan(Math.tan((fov * Math.PI) / 360) * widen) * 360) / Math.PI;
    expect(widened(quarter.fov, uprightLensAt(quarter.at).widen)).toBeCloseTo(56, 0);
    expect(widened(threeQuarter.fov, uprightLensAt(threeQuarter.at).widen)).toBeCloseTo(52, 0);
    // and the cover on a phone is a real wide shot, not the long lens's slice
    expect(widened(hero.fov, UPRIGHT_LENS.hero.widen)).toBeGreaterThan(40);
  });

  it('is none from the crane on, and never steps', () => {
    const crane = BEATS.find((b) => b.id === 'crane')!;
    expect(uprightLensAt(crane.at)).toEqual({ widen: 1, offset: 1 });
    expect(uprightLensAt(FILM_SHARE)).toEqual({ widen: 1, offset: 1 });
    expect(uprightLensAt(1)).toEqual({ widen: 1, offset: 1 });
    let last = uprightLensAt(0);
    for (let s = 0.005; s <= 1; s += 0.005) {
      const now = uprightLensAt(s);
      expect(Math.abs(now.widen - last.widen)).toBeLessThan(0.03);
      expect(Math.abs(now.offset - last.offset)).toBeLessThan(0.03);
      last = now;
    }
  });

  it("leaves a landscape frame's lens as the beats give it", () => {
    // (the rig only applies it by phoneWeight: this is the lens it starts from)
    expect(lensAt(0).fov).toBe(26);
    expect(lensAt(0).frameOffset).toBe(8.5);
  });
});

describe("the header's band outside", () => {
  it('is shorter than in the hall, and eases to its reach instead of stepping', () => {
    expect(HEADER_BAND.zeroOutside).toBeLessThan(HEADER_BAND.zero);
    headerBandReach();
    expect(lensFilter.topZero).toBe(HEADER_BAND.zero);
    // a frame's worth of time moves it a little, not all the way
    headerBandReach(true, 1 / 60);
    expect(lensFilter.topZero).toBeLessThan(HEADER_BAND.zero);
    expect(lensFilter.topZero).toBeGreaterThan(HEADER_BAND.zeroOutside + 0.06);
    for (let i = 0; i < 240; i += 1) headerBandReach(true, 1 / 60);
    expect(lensFilter.topZero).toBeCloseTo(HEADER_BAND.zeroOutside, 3);
    // and at once where no time is given (the hall's own reach)
    headerBandReach();
    expect(lensFilter.topZero).toBe(HEADER_BAND.zero);
  });
});

describe("the sun's softer edge", () => {
  it('is searched widely enough to find its penumbra, at a cost that is counted', () => {
    // the filter's radius is capped by the search radius: a wider penumbra
    // needs a wider search, and more taps to keep it from breaking into noise
    expect(PCSS_SEARCH).toBeGreaterThanOrEqual(24);
    expect(PCSS_SAMPLES).toBeGreaterThanOrEqual(16);
    // two loops of taps a shadowed pixel: held to what an integrated GPU pays
    expect(PCSS_SAMPLES * 2).toBeLessThanOrEqual(40);
  });
});
