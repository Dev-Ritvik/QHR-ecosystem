// packages/domain/src/telemetry/scroll.ts
//
// Pure scroll accumulation: depth, distance and reading pace.
//
// Extracted from the React hook deliberately. The maths is what feeds the
// content-consideration component of the lead score, and it could not be
// verified in a browser — the preview pane never dispatches scroll events, so
// every metric read back as zero and there was no way to tell a broken
// implementation from an environment that cannot exercise it. As a pure
// function it is covered by unit tests that run in CI on every push.

/** Below this, scrolling is reading rather than seeking. */
export const READING_PACE_PX_PER_S = 250;

export interface ScrollSummary {
  /** Deepest point reached, 0-100. */
  maxScrollPct: number;
  /** Mean velocity while actually moving. */
  pacingPxPerS: number;
  /** Time spent moving at reading pace — the signal that separates
   *  consideration from skimming, since both reach 100% depth. */
  consideredMs: number;
  /** Total distance travelled, px. */
  distancePx: number;
}

export class ScrollAccumulator {
  private maxPct = 0;
  private distance = 0;
  private movingMs = 0;
  private slowMs = 0;
  private lastY: number;
  private lastT: number;
  private scrollable: number;

  constructor(startY = 0, startT = 0, scrollable = 1) {
    this.lastY = startY;
    this.lastT = startT;
    this.scrollable = Math.max(1, scrollable);
  }

  /** Height changed (resize, lazy content). */
  setScrollable(scrollable: number) {
    this.scrollable = Math.max(1, scrollable);
    // Re-derive the ceiling: a page that grew makes the old percentage a lie.
    this.maxPct = Math.min(this.maxPct, 100);
  }

  /** One position sample. `t` is a monotonic clock in ms. */
  sample(y: number, t: number) {
    const dy = Math.abs(y - this.lastY);
    const dt = t - this.lastT;

    if (dt > 0 && dy > 0) {
      this.distance += dy;
      this.movingMs += dt;
      if (dy / (dt / 1000) < READING_PACE_PX_PER_S) this.slowMs += dt;
    }
    this.lastY = y;
    this.lastT = t;

    const pct = Math.round(Math.min(100, Math.max(0, (y / this.scrollable) * 100)));
    if (pct > this.maxPct) this.maxPct = pct;
  }

  summary(): ScrollSummary {
    return {
      maxScrollPct: this.maxPct,
      pacingPxPerS:
        this.movingMs > 0
          ? Math.round(this.distance / (this.movingMs / 1000))
          : 0,
      consideredMs: Math.round(this.slowMs),
      distancePx: Math.round(this.distance),
    };
  }
}
