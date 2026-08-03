// apps/public/src/lib/telemetry/collector.ts
//
// Buffered, consent-gated telemetry collector. Spec §4.3.
//
// The hard constraint is that this must never cost frames — it runs alongside a
// WebGL scene targeting mid-tier phones. So: no work on the hot path beyond an
// array push, aggregation done at flush time, and dispatch via sendBeacon where
// available so unload is never blocked.

import { isCritical, type TelemetryEvent, type TelemetryEventName } from './events';

const ENDPOINT = '/api/telemetry';
const FLUSH_MS = 10_000;
const MAX_BATCH = 40;
/** Camera position at 2Hz would be a fire-hose; the spec aggregates it into 5s
 *  buckets before anything is dispatched. */
const CAMERA_BUCKET_MS = 5_000;

type Sink = (batch: TelemetryEvent[]) => void;

class Collector {
  private buffer: TelemetryEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private enabled = false;
  private started = false;
  private cameraBucket: {
    placeId?: string;
    startedAt: number;
    samples: number;
    sx: number; sy: number; sz: number;
  } | null = null;

  /** Test seam — lets the flush path be asserted without a network. */
  sink: Sink | null = null;

  setEnabled(on: boolean) {
    if (this.enabled === on) return;
    this.enabled = on;
    if (on) {
      this.startTimer();
    } else {
      // Withdrawal must be immediate and must not ship what is already queued.
      // Anything buffered was gathered under a consent that no longer exists.
      this.buffer = [];
      this.cameraBucket = null;
      this.stopTimer();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  push(event: TelemetryEventName, placeId?: string, payload?: TelemetryEvent['payload']) {
    if (!this.enabled) return;
    this.buffer.push({ event, placeId, payload, ts: Date.now() });
    // Never let a runaway producer grow the buffer without bound; drop oldest
    // non-critical entries first so a parcel selection is never the thing lost.
    if (this.buffer.length > MAX_BATCH * 3) {
      const keep = this.buffer.filter((e) => isCritical(e.event));
      this.buffer = [...keep, ...this.buffer.slice(-MAX_BATCH)].slice(-MAX_BATCH * 2);
    }
  }

  /** Called at up to 2Hz from the render loop. Accumulates; emits one averaged
   *  event per bucket. */
  sampleCamera(placeId: string, x: number, y: number, z: number) {
    if (!this.enabled) return;
    const now = Date.now();
    const b = this.cameraBucket;
    if (!b || b.placeId !== placeId || now - b.startedAt >= CAMERA_BUCKET_MS) {
      if (b && b.samples > 0) this.emitCameraBucket(now);
      this.cameraBucket = { placeId, startedAt: now, samples: 1, sx: x, sy: y, sz: z };
      return;
    }
    b.samples += 1;
    b.sx += x; b.sy += y; b.sz += z;
  }

  private emitCameraBucket(now: number) {
    const b = this.cameraBucket;
    if (!b || b.samples === 0) return;
    const n = b.samples;
    this.buffer.push({
      event: 'camera_dwell',
      placeId: b.placeId,
      payload: {
        x: +(b.sx / n).toFixed(2),
        y: +(b.sy / n).toFixed(2),
        z: +(b.sz / n).toFixed(2),
        dwellMs: now - b.startedAt,
        samples: n,
      },
      ts: now,
    });
    this.cameraBucket = null;
  }

  private startTimer() {
    if (this.timer || typeof window === 'undefined') return;
    this.timer = setInterval(() => this.flush(false), FLUSH_MS);
  }

  private stopTimer() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  flush(final: boolean) {
    if (!this.enabled) return;
    this.emitCameraBucket(Date.now());
    if (this.buffer.length === 0) return;

    const batch = this.buffer.slice(0, MAX_BATCH);
    this.buffer = this.buffer.slice(MAX_BATCH);

    if (this.sink) {
      this.sink(batch);
      return;
    }
    if (typeof window === 'undefined') return;

    const body = JSON.stringify({ events: batch });
    // sendBeacon survives unload and never blocks it. It is also the only
    // reliable option on mobile Safari when the tab is being backgrounded.
    if (final && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      // Cookies carry the session id; nothing identifying is in the body.
      credentials: 'same-origin',
    }).catch(() => {
      /* telemetry must never surface an error to the visitor */
    });
  }

  /** Idempotent: the provider may re-run on consent changes. */
  attachLifecycle() {
    if (this.started || typeof document === 'undefined') return;
    this.started = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
    window.addEventListener('pagehide', () => this.flush(true));
  }
}

export const telemetry = new Collector();

/** Convenience wrapper so call sites read as intent, not plumbing. */
export function track(
  event: TelemetryEventName,
  placeId?: string,
  payload?: TelemetryEvent['payload'],
) {
  telemetry.push(event, placeId, payload);
}
