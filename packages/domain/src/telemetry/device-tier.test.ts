import { describe, it, expect } from 'vitest';
import {
  decideTier,
  medianOf,
  HIGH_FRAME_MS,
  LOW_FRAME_MS,
} from './device-tier';

describe('device tiering', () => {
  it('drops to low when WebGL2 is unavailable', () => {
    expect(decideTier({ webgl2: false, medianFrameMs: 8, cores: 16 })).toBe('low');
  });

  it('honours reduced motion regardless of capability', () => {
    // Not a performance decision — a stated preference outranks the hardware.
    expect(
      decideTier({ reducedMotion: true, medianFrameMs: 6, cores: 16, deviceMemoryGb: 16 }),
    ).toBe('low');
  });

  it('starts at mid before any measurement exists', () => {
    // Starting high and dropping is a visible stutter on the devices least able
    // to absorb it; starting lighter and promoting is invisible.
    expect(decideTier({})).toBe('mid');
  });

  it('promotes to high only on good frame time AND adequate memory', () => {
    expect(decideTier({ medianFrameMs: 10, deviceMemoryGb: 8, cores: 8 })).toBe('high');
    // Early frames are cheap before the whole scene is resident, so a marginal
    // memory reading holds it at mid.
    expect(decideTier({ medianFrameMs: 10, deviceMemoryGb: 2.5, cores: 8 })).toBe('mid');
  });

  it('treats low memory or core count as a hard floor', () => {
    expect(decideTier({ medianFrameMs: 5, deviceMemoryGb: 2, cores: 8 })).toBe('low');
    expect(decideTier({ medianFrameMs: 5, deviceMemoryGb: 8, cores: 2 })).toBe('low');
  });

  it('maps measured frame time across the bands', () => {
    expect(decideTier({ medianFrameMs: HIGH_FRAME_MS, deviceMemoryGb: 8 })).toBe('high');
    expect(decideTier({ medianFrameMs: 25, deviceMemoryGb: 8 })).toBe('mid');
    expect(decideTier({ medianFrameMs: LOW_FRAME_MS, deviceMemoryGb: 8 })).toBe('low');
  });

  it('works when deviceMemory is absent, as it is on Safari and Firefox', () => {
    expect(decideTier({ medianFrameMs: 10, cores: 8 })).toBe('high');
  });

  it('uses the median so one stall cannot mis-tier a capable device', () => {
    // Nine good frames and one 400ms GC pause. A mean would land near 47ms and
    // wrongly demote; the median ignores it.
    const samples = [8, 9, 8, 10, 9, 8, 9, 10, 8, 400];
    const m = medianOf(samples)!;
    expect(m).toBeLessThan(HIGH_FRAME_MS);
    expect(decideTier({ medianFrameMs: m, deviceMemoryGb: 8 })).toBe('high');
  });

  it('returns undefined for an empty sample set', () => {
    expect(medianOf([])).toBeUndefined();
  });
});
