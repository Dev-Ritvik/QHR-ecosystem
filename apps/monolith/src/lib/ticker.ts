'use client';

// apps/monolith/src/lib/ticker.ts
//
// THE ONE CLOCK — MASTER_SPEC L1.
//
// Exactly one requestAnimationFrame exists in this application and it lives
// here. gsap.ticker owns it; Lenis is driven from it; R3F is invalidated from
// it. Nothing else may call requestAnimationFrame, ever.
//
// WHY THIS IS A LAW AND NOT A PREFERENCE
//
// On apps/public in this same repository, Lenis ran its own rAF while R3F ran
// another. Two loops that read and write the same scroll position within one
// frame have NO DEFINED ORDER — so on any frame where R3F happened to run
// first, the camera sampled the PREVIOUS frame's scroll and the canvas lagged
// the DOM by exactly one frame. Intermittently. It was invisible in code
// review and the client reported it as "floaty and uncoordinated."
//
// There is no way to fix that by tuning. There is only one clock or there is
// the bug.
//
// SHAPE
//
//        gsap.ticker  ← the only rAF
//             │
//     ┌───────┼────────────────┐
//     ▼       ▼                ▼
//  lenis.raf  subscribers   invalidate()
//             (camera, audio, atmosphere)
//
// Subscribers receive (q, dt) and must be pure readers of q. They must not
// schedule work of their own.

import gsap from 'gsap';
import Lenis from 'lenis';

export type TickFn = (q: number, dt: number) => void;

interface TickerState {
  lenis: Lenis | null;
  invalidate: (() => void) | null;
  subs: Set<TickFn>;
  running: boolean;
  q: number;
  maxScroll: number;
}

const state: TickerState = {
  lenis: null,
  invalidate: null,
  subs: new Set(),
  running: false,
  q: 0,
  maxScroll: 1,
};

/** Current normalised scroll progress, 0..1. Read-only outside this module. */
export function getQ(): number {
  return state.q;
}

/** The live Lenis instance, or null before start() / after stop(). */
export function getLenis(): Lenis | null {
  return state.lenis;
}

/**
 * R3F hands us its invalidate() once the canvas exists. Until then the ticker
 * runs and drives scroll, it simply has nothing to render — which is correct
 * during the consent gate and the [ ENTER ] screen.
 */
export function bindInvalidate(fn: (() => void) | null): void {
  state.invalidate = fn;
}

export function subscribe(fn: TickFn): () => void {
  state.subs.add(fn);
  return () => {
    state.subs.delete(fn);
  };
}

function measure(): void {
  const doc = document.documentElement;
  state.maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
}

function frame(time: number): void {
  // gsap.ticker reports seconds; Lenis wants milliseconds.
  state.lenis?.raf(time * 1000);

  // Read Lenis's smoothed position, not window.scrollY. window.scrollY lags
  // Lenis's own transform by design, so using it would hand every subscriber
  // the staircase Lenis exists to remove.
  const y = state.lenis?.scroll ?? window.scrollY ?? 0;
  state.q = Math.min(1, Math.max(0, y / state.maxScroll));

  // gsap.ticker exposes deltaRatio() relative to 60fps; convert to seconds so
  // subscribers can do frame-rate-independent damping without guessing.
  const dt = gsap.ticker.deltaRatio(60) / 60;

  for (const fn of state.subs) fn(state.q, dt);

  if (process.env.NODE_ENV !== 'production') {
    (window as unknown as { __ticker?: unknown }).__ticker = {
      running: state.running,
      subs: state.subs.size,
      q: +state.q.toFixed(4),
      maxScroll: state.maxScroll,
      lenis: !!state.lenis,
      lenisScroll: state.lenis ? Math.round(state.lenis.scroll) : null,
      hasInvalidate: !!state.invalidate,
      frames: (frames += 1),
    };
  }

  // Last, and only if the canvas is mounted and not frozen. Under
  // frameloop="demand" this is what actually produces a frame.
  state.invalidate?.();
}

export function startTicker(): void {
  if (state.running || typeof window === 'undefined') return;
  state.running = true;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduced) {
    state.lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      // Native momentum on touch. Hijacking a phone's scroll fights the OS and
      // is the fastest way to make a site feel broken — MASTER_SPEC §9.4.
      syncTouch: false,
    });
  }

  measure();
  window.addEventListener('resize', measure);

  // Route changes swap the page under a canvas that never unmounts, so the
  // document height changes with no resize event. ResizeObserver batches on
  // its own frame rather than on scroll.
  const ro = new ResizeObserver(measure);
  ro.observe(document.body);
  cleanup.push(() => ro.disconnect());
  cleanup.push(() => window.removeEventListener('resize', measure));

  gsap.ticker.add(frame);

  // lagSmoothing(0) is mandatory, not tuning. GSAP otherwise CLAMPS delta
  // after a slow frame to avoid a visible jump — right for a tween, wrong for
  // a scroll position, because clamping makes Lenis integrate less than the
  // real elapsed time and drift permanently behind the scrollbar.
  gsap.ticker.lagSmoothing(0);
}

const cleanup: Array<() => void> = [];

let frames = 0;

export function stopTicker(): void {
  if (!state.running) return;
  state.running = false;

  gsap.ticker.remove(frame);
  // Restore the default. Leaving lag smoothing off globally would silently
  // change the behaviour of every other GSAP tween in the application.
  gsap.ticker.lagSmoothing(500, 33);

  state.lenis?.destroy();
  state.lenis = null;
  state.subs.clear();
  state.invalidate = null;

  while (cleanup.length) cleanup.pop()!();
}

/** Pause/resume scroll input without tearing down the clock. Used by the
 *  consent gate, the [ ENTER ] screen, and the Command Overlay freeze. */
export function setScrollLocked(locked: boolean): void {
  if (!state.lenis) return;
  if (locked) state.lenis.stop();
  else state.lenis.start();
}
