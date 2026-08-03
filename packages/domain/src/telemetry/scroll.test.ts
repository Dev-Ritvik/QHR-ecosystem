import { describe, it, expect } from 'vitest';
import { ScrollAccumulator } from './scroll';

describe('scroll accumulation', () => {
  it('records the deepest point reached, not the final position', () => {
    // Read to the bottom, then scroll back up to the top. Someone who reached
    // the end has read the page; where they happen to stop is irrelevant.
    const a = new ScrollAccumulator(0, 0, 1000);
    a.sample(1000, 1000);
    a.sample(0, 2000);
    expect(a.summary().maxScrollPct).toBe(100);
  });

  it('separates a reader from someone flinging the scrollbar', () => {
    // Both cover the same distance and both reach 100% depth. Only pacing
    // tells them apart, which is the whole reason this metric exists.
    const reader = new ScrollAccumulator(0, 0, 2000);
    for (let i = 1; i <= 20; i++) reader.sample(i * 100, i * 1000); // 100 px/s

    const skimmer = new ScrollAccumulator(0, 0, 2000);
    skimmer.sample(2000, 100); // 2000px in 100ms

    expect(reader.summary().maxScrollPct).toBe(100);
    expect(skimmer.summary().maxScrollPct).toBe(100);
    expect(reader.summary().consideredMs).toBeGreaterThan(0);
    expect(skimmer.summary().consideredMs).toBe(0);
    expect(reader.summary().pacingPxPerS).toBeLessThan(
      skimmer.summary().pacingPxPerS,
    );
  });

  it('counts distance in both directions', () => {
    const a = new ScrollAccumulator(0, 0, 1000);
    a.sample(500, 1000);
    a.sample(0, 2000);
    expect(a.summary().distancePx).toBe(1000);
  });

  it('reports zeroes for a visitor who never scrolled', () => {
    const a = new ScrollAccumulator(0, 0, 1000);
    const s = a.summary();
    expect(s.maxScrollPct).toBe(0);
    expect(s.pacingPxPerS).toBe(0);
    expect(s.consideredMs).toBe(0);
  });

  it('never exceeds 100% on a short page or an overscroll', () => {
    // Mobile rubber-banding can report a position past the bottom.
    const a = new ScrollAccumulator(0, 0, 100);
    a.sample(400, 1000);
    expect(a.summary().maxScrollPct).toBe(100);
  });

  it('does not divide by zero when the page does not scroll', () => {
    const a = new ScrollAccumulator(0, 0, 0);
    a.sample(0, 1000);
    expect(Number.isFinite(a.summary().maxScrollPct)).toBe(true);
  });

  it('handles a page that grows after load without reporting over 100', () => {
    const a = new ScrollAccumulator(0, 0, 500);
    a.sample(500, 1000);
    expect(a.summary().maxScrollPct).toBe(100);
    a.setScrollable(2000); // lazy content arrived
    a.sample(1000, 2000);
    expect(a.summary().maxScrollPct).toBeLessThanOrEqual(100);
  });

  it('ignores samples with no elapsed time', () => {
    // Two events in the same millisecond must not produce infinite velocity.
    const a = new ScrollAccumulator(0, 0, 1000);
    a.sample(100, 0);
    expect(Number.isFinite(a.summary().pacingPxPerS)).toBe(true);
  });
});
