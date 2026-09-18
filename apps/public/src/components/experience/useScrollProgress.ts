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
//
// ONE DRIVER, MANY READERS
//
// This used to do all of the above once PER CALLER, and it had three callers
// inside the canvas — CameraRig, ExteriorLighting and Terrain. VERIFIED at
// runtime by reading r3f's subscriber list: three byte-identical useFrame
// callbacks, plus three scroll listeners, three resize listeners and three
// ResizeObservers on document.body — on a document that is ~11,800px tall.
// All three computed the same number from the same source in the same frame.
//
// So the work moved into a single <ScrollProgressDriver>, mounted once, and the
// hook became a plain accessor for the value it publishes. The semantics above
// are unchanged: same source of truth, same guards, same once-per-frame sample,
// still a ref so reading it cannot re-render.

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { lenisInstance } from './SmoothScroll';
import { measureFilmSpan } from './filmTrack';

/** Published 0..1 scroll progress. Written only by <ScrollProgressDriver>. */
const progress = { current: 0 };

/** The scroll distance progress 1.0 stands for — the film's track on the film,
 *  the document's travel elsewhere (filmTrack.ts). Remeasured on layout changes. */
const maxScroll = { current: 1 };

/**
 * Lenis's smoothed position when it is running, the raw scrollbar when it is
 * not (reduced-motion, or before it mounts). window.scrollY lags Lenis's own
 * transform by design, so reading it while Lenis runs would hand the camera the
 * staircase Lenis exists to remove.
 */
function scrollY(): number {
  return (
    lenisInstance?.scroll ??
    (window.scrollY || document.documentElement.scrollTop || 0)
  );
}

function publish() {
  progress.current = Math.min(1, Math.max(0, scrollY() / maxScroll.current));
}

/**
 * Mount exactly ONCE, inside the r3f <Canvas> and before anything that reads
 * the value — r3f runs same-priority subscribers in registration order, so
 * mounting this first means every consumer reads a figure sampled earlier in
 * the same frame rather than one frame stale.
 *
 * It samples inside useFrame rather than from the scroll event on purpose. The
 * value previously updated only from 'scroll', which made correctness depend on
 * Lenis emitting native scroll events while it animates. If that ever stopped —
 * a Lenis option change, a version bump, a wrapper element instead of window —
 * the value would freeze and the camera would sit perfectly still while the
 * page scrolled underneath it, with nothing in the console to say why.
 */
export function ScrollProgressDriver() {
  useFrame(publish);

  useEffect(() => {
    const measure = () => {
      // Guarded to 1 so a page shorter than the viewport reports 0 rather than
      // dividing by zero and pinning the camera at the end of its path.
      //
      // Measured against the FILM on the page that is one, not against the
      // document — see filmTrack.ts for the desync the document measure caused.
      maxScroll.current = Math.max(1, measureFilmSpan());
      publish();
    };

    measure();
    window.addEventListener('scroll', publish, { passive: true });
    window.addEventListener('resize', measure);

    // Route changes swap the page under a canvas that never unmounts, so the
    // document height changes without a resize event. Watching the body covers
    // it, and ResizeObserver batches on its own frame rather than on scroll.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);

    return () => {
      window.removeEventListener('scroll', publish);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  return null;
}

/**
 * Read-only handle on the published value. Safe to call anywhere in the canvas
 * tree; it registers nothing and costs nothing.
 */
export function useScrollProgress() {
  return progress;
}

/**
 * Re-sample NOW, outside the frame's own publish.
 *
 * For the one writer that moves the scroll inside a frame — the doorway, which
 * holds the page at the door and lands it inside — so that everything later in
 * the same frame reads where the page is rather than where it was.
 */
export function syncScrollProgress() {
  publish();
}

/** The published value, for code outside the canvas tree. */
export function readScrollProgress(): number {
  return progress.current;
}

/** The scroll distance progress 1.0 stands for, in pixels, as last measured. */
export function scrollExtent(): number {
  return maxScroll.current;
}
