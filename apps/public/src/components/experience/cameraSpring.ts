// apps/public/src/components/experience/cameraSpring.ts
//
// The camera's follow: a critically damped spring, not a first-order lag.
// See "A SPRING, NOT A LAG" in WorldCanvas's CameraRig.

import type * as THREE from 'three';

/**
 * One step of a critically damped spring toward `goal` (Unity's SmoothDamp,
 * the closed form of a critically damped oscillator), time constant `tau`.
 * `vel` carries the velocity between frames. Frame-rate independent.
 */
export function springTo(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  goal: THREE.Vector3,
  tau: number,
  dt: number,
): void {
  const omega = 2 / Math.max(1e-4, tau);
  const x = omega * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const cx = pos.x - goal.x;
  const cy = pos.y - goal.y;
  const cz = pos.z - goal.z;
  const tx = (vel.x + omega * cx) * dt;
  const ty = (vel.y + omega * cy) * dt;
  const tz = (vel.z + omega * cz) * dt;
  vel.set((vel.x - omega * tx) * e, (vel.y - omega * ty) * e, (vel.z - omega * tz) * e);
  pos.set(goal.x + (cx + tx) * e, goal.y + (cy + ty) * e, goal.z + (cz + tz) * e);
}
