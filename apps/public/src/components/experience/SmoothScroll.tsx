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

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);

  return null;
}
