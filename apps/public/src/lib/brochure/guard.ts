// apps/public/src/lib/brochure/guard.ts
//
// The two things that stop /api/brochure from being a way to kill the server.
//
// Both are deliberately pure and clock-injectable so they can be tested without
// launching a browser or waiting real seconds — the failure they exist to
// prevent is not something we want to discover in production.
//
// In-memory is the right scope here, not a cop-out: this endpoint already
// requires a long-lived Node process with a Chromium binary next to it, so
// there is exactly one instance holding this state and nothing to share.

/** Wall clock, injectable for tests. */
export type Clock = () => number;

/**
 * Fixed-window limiter, keyed by caller.
 *
 * A token bucket would be smoother, but the thing being limited costs hundreds
 * of milliseconds of CPU and tens of megabytes of RSS, so the useful property
 * is a hard ceiling per window rather than a pleasant burst curve.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: Clock = Date.now,
  ) {}

  /** True if this call is allowed. Counts the call when it is. */
  take(key: string): boolean {
    const t = this.now();
    const entry = this.hits.get(key);

    if (!entry || t >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
      this.sweep(t);
      return true;
    }

    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }

  /** Seconds until the caller's window resets, for Retry-After. */
  retryAfter(key: string): number {
    const entry = this.hits.get(key);
    if (!entry) return 0;
    return Math.max(1, Math.ceil((entry.resetAt - this.now()) / 1000));
  }

  /**
   * Drop expired keys so a stream of unique callers cannot grow this map
   * without bound — which would just be a slower version of the leak this
   * whole file exists to prevent. Amortised: only runs when a new window opens.
   */
  private sweep(t: number) {
    if (this.hits.size < 512) return;
    for (const [k, v] of this.hits) {
      if (t >= v.resetAt) this.hits.delete(k);
    }
  }
}

/**
 * A semaphore with a bounded wait.
 *
 * The point is not just to cap parallelism, it is to FAIL FAST when the queue
 * is deep. Without the timeout, load simply converts into an unbounded backlog
 * of pending requests, each holding a socket, and the server dies a slightly
 * more dignified death than it would have anyway.
 */
export class ConcurrencyGate {
  private active = 0;
  private queue: Array<{
    resolve: (release: () => void) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(private readonly max: number) {}

  get inFlight(): number {
    return this.active;
  }

  get waiting(): number {
    return this.queue.length;
  }

  /**
   * Resolves with a release function once a slot is free. Rejects with
   * `GateTimeout` if none becomes free within waitMs.
   */
  acquire(waitMs: number): Promise<() => void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve(this.releaser());
    }

    return new Promise((resolve, reject) => {
      const entry = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const i = this.queue.indexOf(entry);
          if (i >= 0) this.queue.splice(i, 1);
          const err = new Error('GateTimeout');
          err.name = 'GateTimeout';
          reject(err);
        }, waitMs),
      };
      this.queue.push(entry);
    });
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      // Idempotent: a release() reached from both a success path and a finally
      // must not hand out two slots.
      if (released) return;
      released = true;

      const next = this.queue.shift();
      if (next) {
        clearTimeout(next.timer);
        next.resolve(this.releaser());
        return;
      }
      this.active -= 1;
    };
  }
}
