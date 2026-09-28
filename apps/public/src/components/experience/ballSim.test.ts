// apps/public/src/components/experience/ballSim.test.ts
//
// The ball's body as a contract: it holds together at rest, a pass of the hand
// moves it and it settles back by itself, neighbours move with each other,
// and it is stable at any frame rate.

import { describe, expect, it } from 'vitest';
import { createBallSim, stepBall, NEIGHBOURS, type BallPointer } from './ballSim';

function lattice(n: number): Float32Array {
  const out = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i += 1) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    out[i * 3] = Math.cos(golden * i) * r;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(golden * i) * r;
  }
  return out;
}

const still: BallPointer = { gain: 0, at: [0, 0, 1], vel: [0, 0, 0] };

function maxRadiusError(sim: ReturnType<typeof createBallSim>) {
  let worst = 0;
  for (let i = 0; i < sim.n; i += 1) {
    const r = Math.hypot(sim.pos[i * 3], sim.pos[i * 3 + 1], sim.pos[i * 3 + 2]);
    worst = Math.max(worst, Math.abs(r - 1));
  }
  return worst;
}

function run(sim: ReturnType<typeof createBallSim>, seconds: number, fps: number, p: BallPointer) {
  for (let i = 0; i < Math.round(seconds * fps); i += 1) stepBall(sim, 1 / fps, p);
}

describe('the ball, simulated', () => {
  it("knows each bead's nearest neighbours", () => {
    const sim = createBallSim(lattice(400));
    expect(sim.nbr.length).toBe(400 * NEIGHBOURS);
    // A neighbour is near: on a 400-point lattice, well inside a tenth of the sphere.
    for (let i = 0; i < sim.n; i += 37) {
      const j = sim.nbr[i * NEIGHBOURS];
      const d = Math.hypot(sim.home[i * 3] - sim.home[j * 3], sim.home[i * 3 + 1] - sim.home[j * 3 + 1], sim.home[i * 3 + 2] - sim.home[j * 3 + 2]);
      expect(d).toBeLessThan(0.3);
    }
  });

  it('holds together at rest, breathing only a little', () => {
    const sim = createBallSim(lattice(400));
    run(sim, 6, 60, still);
    expect(maxRadiusError(sim)).toBeLessThan(0.12);
  });

  it('moves under a pass of the hand, and settles back by itself', () => {
    const sim = createBallSim(lattice(400));
    run(sim, 2, 60, still);
    const hand: BallPointer = { gain: 1, at: [0, 0, 1], vel: [2, 0, 0] };
    run(sim, 0.4, 60, hand);
    const disturbed = maxRadiusError(sim);
    let moved = 0;
    for (let i = 0; i < sim.n; i += 1) moved = Math.max(moved, Math.hypot(sim.vel[i * 3], sim.vel[i * 3 + 1], sim.vel[i * 3 + 2]));
    expect(moved).toBeGreaterThan(0.3);
    run(sim, 6, 60, still);
    expect(maxRadiusError(sim)).toBeLessThan(Math.max(0.12, disturbed));
    expect(maxRadiusError(sim)).toBeLessThan(0.12);
  });

  it('moves a patch, not a bead: neighbours travel together', () => {
    const sim = createBallSim(lattice(600));
    run(sim, 1, 60, still);
    run(sim, 0.3, 60, { gain: 1, at: [0, 0, 1], vel: [2, 0, 0] });
    // The bead nearest the hand, and its neighbours, move in the same direction.
    let near = 0;
    for (let i = 0; i < sim.n; i += 1) if (sim.home[i * 3 + 2] > sim.home[near * 3 + 2]) near = i;
    const vx = sim.vel[near * 3];
    for (let k = 0; k < NEIGHBOURS; k += 1) {
      const j = sim.nbr[near * NEIGHBOURS + k];
      expect(Math.sign(sim.vel[j * 3])).toBe(Math.sign(vx));
    }
  });

  it('is stable and alike at 30, 60 and 144 frames a second', () => {
    const hand: BallPointer = { gain: 1, at: [0, 0, 1], vel: [1.5, 0.5, 0] };
    const out = [30, 60, 144].map((fps) => {
      const sim = createBallSim(lattice(300));
      run(sim, 1.5, fps, hand);
      for (const v of sim.pos) expect(Number.isFinite(v)).toBe(true);
      return maxRadiusError(sim);
    });
    expect(Math.abs(out[0] - out[1])).toBeLessThan(0.05);
    expect(Math.abs(out[2] - out[1])).toBeLessThan(0.05);
  });
});
