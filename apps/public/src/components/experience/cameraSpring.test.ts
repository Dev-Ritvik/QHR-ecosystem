// apps/public/src/components/experience/cameraSpring.test.ts
//
// The camera's follow as a contract: it accelerates out of rest (a lag does
// not), it arrives, and it does the same thing at any frame rate.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { springTo } from './cameraSpring';

const TAU = 3.1;

function run(fps: number, seconds: number) {
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const goal = new THREE.Vector3(10, 0, 0);
  const dt = 1 / fps;
  for (let i = 0; i < Math.round(seconds * fps); i += 1) springTo(pos, vel, goal, TAU, dt);
  return { pos, vel };
}

describe('the camera spring', () => {
  it('eases out of rest, where a first-order lag jumps to full speed', () => {
    const dt = 1 / 60;
    const spring = run(60, dt).pos.x;
    const lag = 10 * (1 - Math.exp(-dt / TAU));
    // A lag moves at its top speed on the first frame; the spring has to
    // build its velocity first.
    expect(spring).toBeLessThan(lag * 0.1);
    expect(run(60, 0.5).vel.x).toBeGreaterThan(run(60, 0.05).vel.x);
  });

  it('arrives without overshooting', () => {
    let peak = 0;
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();
    const goal = new THREE.Vector3(10, 0, 0);
    for (let i = 0; i < 60 * 20; i += 1) {
      springTo(pos, vel, goal, TAU, 1 / 60);
      peak = Math.max(peak, pos.x);
    }
    expect(pos.x).toBeCloseTo(10, 2);
    expect(peak).toBeLessThanOrEqual(10.0001);
    // 95% inside ~2.4 tau, sooner than the lag's 3 tau
    expect(run(60, 2.5 * TAU).pos.x).toBeGreaterThan(9.5);
  });

  it('is frame-rate independent', () => {
    expect(run(120, 2).pos.x).toBeCloseTo(run(60, 2).pos.x, 1);
    expect(run(30, 2).pos.x).toBeCloseTo(run(60, 2).pos.x, 1);
  });
});
