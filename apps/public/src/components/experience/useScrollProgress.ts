'use client';

// apps/public/src/components/experience/useScrollProgress.ts
//
// Document scroll as a 0..1 number, cheap enough to drive a camera every frame.
//
// Three things this deliberately does NOT do:
//
//   * It does not setState on every scroll event. That would re-render the React
//     tree at scroll frequency, and the tree above the canvas includes every
//     page. The value lives in a ref and is read inside useFrame, so scrolling
//     costs one number write and zero renders.
//
//   * It does not read scrollHeight on every event. Layout reads inside a
//     scroll handler are the classic way to turn a smooth page into a janky
//     one; the document height is measured on mount and on resize only.
//
//   * It does not use a scroll listener to schedule work. The listener writes a
//     number, useFrame reads it. There is no rAF chain to leak and nothing to
//     unsubscribe beyond the listener itself.
//
// Returns a ref, not a value, precisely so that reading it cannot re-render.

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { lenisInstance } from './SmoothScroll';

/**
 * MUST be called inside the r3f <Canvas> tree — it samples inside useFrame.
 *
 * That is deliberate. It previously updated only from the window 'scroll'
 * event, which made correctness depend on Lenis emitting native scroll events
 * while it animates. If that ever stopped — a Lenis option change, a version
 * bump, a wrapper element instead of window — the value would freeze and the
 * camera would sit perfectly still while the page scrolled underneath it, with
 * nothing in the console to say why. That is an entire class of silent failure
 * for no benefit: the consumers all live inside useFrame anyway, so sampling
 * there costs one subtraction per frame and cannot desynchronise.
 */
export function useScrollProgress() {
  const progress = useRef(0);
  const maxRef = useRef(1);

  // Sampled every frame from whichever scroller is authoritative. No listener
  // timing, no event coalescing, no dependency on Lenis's emit behaviour.
  useFrame(() => {
    const y =
      lenisInstance?.scroll ??
      (window.scrollY || document.documentElement.scrollTop || 0);
    progress.current = Math.min(1, Math.max(0, y / maxRef.current));
  });

  useEffect(() => {
    let max = 1;

    const measure = () => {
      // The distance the document can actually travel. Guarded to 1 so a page
      // shorter than the viewport reports 0 rather than dividing by zero and
      // pinning the camera at the end of its path.
      max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      maxRef.current = max;
      read();
    };

    const read = () => {
      // Lenis's smoothed position when it is running, the raw scrollbar when it
      // is not (reduced-motion, or before it mounts). window.scrollY lags
      // Lenis's own transform by design, so reading it here would hand the
      // camera the staircase Lenis exists to remove.
      const y =
        lenisInstance?.scroll ??
        (window.scrollY || document.documentElement.scrollTop || 0);
      progress.current = Math.min(1, Math.max(0, y / max));
    };

    measure();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', measure);

    // Route changes swap the page under a canvas that never unmounts, so the
    // document height changes without a resize event. Watching the body covers
    // it, and ResizeObserver batches on its own frame rather than on scroll.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);

    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  return progress;
}
