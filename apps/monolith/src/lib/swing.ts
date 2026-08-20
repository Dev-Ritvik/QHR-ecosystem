// apps/monolith/src/lib/swing.ts
//
// Easing — MASTER_SPEC §3.1, and one correction to it.
//
// THE CAMERA NO LONGER USES AN EASE ON q, and that is deliberate.
//
// The spec called for one continuous ease across the track, which was itself a
// correction of a worse bug (Appendix B failure 3: power4.inOut applied per leg
// drove velocity to zero at every waypoint — five brakes in one sweep).
//
// But scripts/rig-check.mjs showed the global ease has its own defect: it
// REMAPS q, so a beat declared at `at: 0.75` does not arrive at 75% of scroll.
// The Act IV pause was landing at q 0.646–0.700 instead of 0.75–0.82, and every
// other beat was displaced the same way. `at` had silently stopped meaning
// "the scroll position where this vantage appears."
//
// The ease existed to prevent constant-velocity motion. Beat spacing already
// prevents it: 0.04→0.10 covers 226m while 0.75→0.82 covers zero. The beats ARE
// the velocity design — explicit, inspectable, and editable one number at a
// time. Catmull-Rom is C1-continuous, so nothing was needed to smooth the
// corners either.
//
// Removing it also fixed the distribution: travel had been 97% concentrated in
// q 0.15–0.60 with a dead final third. It is now spread across the whole track,
// never below 12.8% of viewing distance outside the designed pause.
//
// swing() is retained for DOM transitions, where a timed ease is the right tool
// and there are no beats to displace.

import gsap from 'gsap';

/**
 * power2.inOut, not power4.
 *
 * Across a SINGLE continuous track, power4 spends so much of its range near
 * zero velocity that the middle beats blur past in a fraction of the scroll and
 * never read. power2 accelerates and decelerates over the whole journey while
 * still crossing the centre at a real clip.
 */
const EASE = gsap.parseEase('power2.inOut');

/** For DOM transitions only. Do NOT apply this to the camera's q — see above. */
export function swing(q: number): number {
  return EASE(Math.min(1, Math.max(0, q)));
}

/**
 * The house ease for discrete UI motion — MASTER_SPEC §5 Act I.
 *
 * Slow-building anticipation in the first third, then a heavy non-linear
 * deceleration. Asymmetric on purpose: symmetric eases read as "animated,"
 * asymmetric ones read as physical. Registered once and reused site-wide so
 * every transition in the build shares one sense of mass.
 */
export const MONOLITH_EASE =
  'M0,0 C0.1,0.02 0.15,0.35 0.3,0.55 0.55,0.85 0.75,0.97 1,1';
