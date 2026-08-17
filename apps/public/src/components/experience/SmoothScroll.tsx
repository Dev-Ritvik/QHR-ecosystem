'use client';

// apps/public/src/components/experience/SmoothScroll.tsx
//
// Lenis, configured to the reference build's numbers: lerp 0.1, smoothWheel on.
//
// This is the single largest difference in FEEL between this build and
// vertex3d.asia, and it is about 3KB. Native scroll moves the document in
// discrete wheel steps; the camera then damps toward a target that is itself
// jumping, so the motion inherits the staircase no matter how much smoothing
// the rig applies. Lenis interpolates the scroll POSITION, so the camera is
// damping toward something that is already continuous.
//
// Touch is left on native. Lenis smooths wheel and keyboard; hijacking momentum
// scrolling on a phone fights the OS and is the fastest way to make a site feel
// broken on the device most of this audience will use.
//
// Deliberately NOT wired to GSAP ScrollTrigger. ScrollTrigger's job is to read
// scroll and drive tweens on a raf loop; r3f already owns a raf loop and the
// camera is driven inside useFrame. Running both means two loops racing to set
// the same camera each frame, and whichever writes last wins - which is a
// stutter that only appears under load. The camera rig applies its own damping
// (see CameraRig), which is what `scrub` is: a first-order lag between input
// and output. The scrub NUMBER is honoured; the plugin is not needed to get it.

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';

/** Exposed so useScrollProgress can read the smoothed value rather than
 *  window.scrollY, which Lenis leaves lagging behind its own transform. */
export let lenisInstance: Lenis | null = null;

export function SmoothScroll() {
  useEffect(() => {
    // Respect the OS setting. Someone who has asked for reduced motion should
    // not be given inertia they cannot stop.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      // Native momentum on touch, for the reason above.
      syncTouch: false,
    });
    lenisInstance = lenis;

    // ONE TICKER. Lenis previously drove itself from its own
    // requestAnimationFrame while r3f drove the camera from a second one. Two
    // independent loops reading and writing the same scroll position in the
    // same frame have no defined order, so on any frame where r3f ran first the
    // camera sampled last frame's scroll and the canvas lagged the DOM by one
    // frame — intermittently, which is what "floaty and uncoordinated" is.
    //
    // gsap.ticker is a single shared rAF, and r3f's loop is downstream of the
    // same frame, so Lenis is now guaranteed to have advanced before the camera
    // samples it.
    //
    // lagSmoothing(0) because GSAP otherwise CLAMPS delta after a slow frame to
    // avoid a visible jump. That is right for a tween and wrong for a scroll
    // position: clamping it makes Lenis integrate less than the real elapsed
    // time and drift permanently behind the actual scrollbar.
    const drive = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(drive);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(drive);
      // Restore the default. Leaving lag smoothing off globally would change
      // the behaviour of every GSAP tween in the app after this unmounts.
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);

  return null;
}
