// apps/monolith/src/lib/swing.ts
//
// The narrative ease — MASTER_SPEC §3.1, Appendix B failure 3.
//
// ONE continuous ease across the whole 0..1 track. Not per-Act, not per-leg.
//
// This is not a style preference, it is the fix for a shipped bug. On
// apps/public, power4.inOut was applied to each spline leg individually. An
// inOut ease has ZERO DERIVATIVE AT BOTH ENDS, so easing each segment drove the
// camera's velocity to zero at every single waypoint — five brakes inside what
// was supposed to be one continuous sweep. The client reported it as
// "stop-and-go."
//
// Applied to the curve parameter only. Atmosphere and lens read RAW q, so fog
// and FOV stay tied to where the visitor is on the page rather than lurching
// with the camera.

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
