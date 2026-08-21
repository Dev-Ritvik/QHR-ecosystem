'use client';

// apps/monolith/src/lib/motion.ts
//
// Camera speed, shared between the rig and the lens.
//
// WHY THIS IS A MODULE AND NOT THE STORE: this value changes every frame. L5
// keeps per-frame values out of Zustand because writing one re-renders the
// React tree at frame rate, and §9.1's 60 fps target is a hard gate. Same
// reasoning as `q` living on the ticker rather than in the store.
//
// WHAT IT IS FOR: chromatic aberration must be a MOTION artefact, not a
// permanent property of the image.
//
// A real lens disperses at every moment, but at rest the eye reads that
// dispersion as softness — as the image simply being less sharp. Applied
// statically to 1-pixel emissive survey lines it does something worse: it
// splits each line into red and blue ghosts, and the Act II plotting grid is
// the single most architectural image in the build. Crispness there is not a
// preference, it is the product; those lines ARE the plan being sold.
//
// So the offset is tied to how fast the camera is actually travelling. It is
// exactly zero whenever the camera is at rest — including the entire Act IV
// pause and every moment a reader stops scrolling to look at something — and
// reaches full strength only through the Act I punch, where the frame is
// moving so fast that nothing is legible anyway and the dispersion reads as
// speed rather than as a defect.

/** Metres per second along the camera path, already smoothed. */
let speed = 0;

export function setCameraSpeed(v: number): void {
  speed = v;
}

export function getCameraSpeed(): number {
  return speed;
}

/**
 * Below this, the lens is perfectly sharp. Not a fade — a hard zero.
 *
 * A deadband rather than a linear ramp from zero, because a slow drift would
 * otherwise carry a small permanent offset, and "small permanent offset" is
 * precisely the artefact this exists to remove.
 */
export const CA_DEADBAND = 8;

/** Speed at which dispersion reaches CA_MAX. Roughly the Act I punch. */
export const CA_FULL = 90;

/** Peak offset. MASTER_SPEC §5 caps this at 0.001 — above that it stops
 *  reading as a lens and starts reading as a broken display. */
export const CA_MAX = 0.0008;

/** The mapping, shared with scripts/motion-check.mjs. */
export function caOffsetFor(v: number): number {
  const k = Math.min(1, Math.max(0, (v - CA_DEADBAND) / (CA_FULL - CA_DEADBAND)));
  // Squared: the ramp leaves zero slowly, so ordinary reading speeds stay sharp
  // and only a genuine whip picks up visible dispersion.
  return CA_MAX * k * k;
}
