import { describe, it, expect } from 'vitest';
import { ConcurrencyGate, RateLimiter } from './guard';

// These two are the whole of the brochure route's protection against resource
// exhaustion, so they are tested against the specific ways they could fail open
// rather than against their happy path.

describe('RateLimiter', () => {
  /** Controllable clock so a 60s window does not cost 60s to test. */
  function at(t: { now: number }) {
    return () => t.now;
  }

  it('allows exactly the limit within a window, then refuses', () => {
    const t = { now: 1_000 };
    const rl = new RateLimiter(3, 60_000, at(t));

    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);
    expect(rl.take('a')).toBe(false);
  });

  it('reopens once the window has passed', () => {
    const t = { now: 1_000 };
    const rl = new RateLimiter(1, 60_000, at(t));

    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);

    t.now += 59_999;
    expect(rl.take('a')).toBe(false);

    t.now += 1;
    expect(rl.take('a')).toBe(true);
  });

  it('keeps callers independent', () => {
    const t = { now: 0 };
    const rl = new RateLimiter(1, 1_000, at(t));

    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);
    // b must not inherit a's exhaustion.
    expect(rl.take('b')).toBe(true);
  });

  it('reports a Retry-After that is never zero while blocked', () => {
    const t = { now: 0 };
    const rl = new RateLimiter(1, 10_000, at(t));

    rl.take('a');
    expect(rl.retryAfter('a')).toBe(10);

    // Even at the very last millisecond the client must be told to wait, not
    // told to retry immediately.
    t.now = 9_999;
    expect(rl.retryAfter('a')).toBeGreaterThanOrEqual(1);
  });

  it('does not grow without bound across many one-shot callers', () => {
    const t = { now: 0 };
    const rl = new RateLimiter(1, 1_000, at(t));

    for (let i = 0; i < 600; i += 1) rl.take(`ip-${i}`);
    t.now += 5_000;
    // Opening a new window triggers the sweep; the old keys must not survive.
    rl.take('fresh');

    const size = (rl as unknown as { hits: Map<string, unknown> }).hits.size;
    expect(size).toBeLessThan(600);
  });
});

describe('ConcurrencyGate', () => {
  it('admits up to max immediately and queues the rest', async () => {
    const gate = new ConcurrencyGate(2);

    const a = await gate.acquire(1_000);
    const b = await gate.acquire(1_000);
    expect(gate.inFlight).toBe(2);

    let admitted = false;
    const pending = gate.acquire(1_000).then((r) => {
      admitted = true;
      return r;
    });

    // Still queued while both slots are held.
    await Promise.resolve();
    expect(admitted).toBe(false);
    expect(gate.waiting).toBe(1);

    a();
    const c = await pending;
    expect(admitted).toBe(true);

    b();
    c();
  });

  it('rejects with GateTimeout rather than queueing forever', async () => {
    const gate = new ConcurrencyGate(1);
    const held = await gate.acquire(1_000);

    await expect(gate.acquire(20)).rejects.toMatchObject({ name: 'GateTimeout' });

    // A timed-out waiter must not leave a slot reserved behind it.
    expect(gate.waiting).toBe(0);
    held();
    expect(gate.inFlight).toBe(0);
  });

  it('treats a double release as one release', async () => {
    const gate = new ConcurrencyGate(1);
    const release = await gate.acquire(1_000);

    release();
    release();

    // If the second call had also freed a slot, inFlight would go negative and
    // the gate would admit two renders at once forever after.
    expect(gate.inFlight).toBe(0);

    const next = await gate.acquire(1_000);
    expect(gate.inFlight).toBe(1);
    next();
  });

  it('hands a released slot to the longest waiter, not a new caller', async () => {
    const gate = new ConcurrencyGate(1);
    const held = await gate.acquire(1_000);

    const order: string[] = [];
    const first = gate.acquire(1_000).then((r) => {
      order.push('first');
      return r;
    });
    const second = gate.acquire(1_000).then((r) => {
      order.push('second');
      return r;
    });

    held();
    const r1 = await first;
    r1();
    const r2 = await second;
    r2();

    expect(order).toEqual(['first', 'second']);
  });

  it('never exceeds max under a burst', async () => {
    const gate = new ConcurrencyGate(3);
    let peak = 0;

    await Promise.all(
      Array.from({ length: 12 }, async () => {
        const release = await gate.acquire(2_000);
        peak = Math.max(peak, gate.inFlight);
        await new Promise((r) => setTimeout(r, 1));
        release();
      }),
    );

    expect(peak).toBeLessThanOrEqual(3);
    expect(gate.inFlight).toBe(0);
  });
});
