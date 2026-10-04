'use client';

// apps/public/src/components/experience/Preloader.tsx
//
// A quiet cover that holds the page until the scene has actually arrived.
//
// THE ART-DIRECTION AUDIT (2026-09-30) saw it as "a clunky black '100%'
// loading screen" after a jump to a flat page — it was: a counter in 8rem
// figures, shown again on every return to the film. It is now the house's name
// in micro capitals over a hairline that fills, and it dissolves slowly. And it
// is not shown at all on a return to the film within the same document, when
// the scene is already in memory (see `sceneInMemory`).
//
// THE SECOND AUDIT (2026-09-30) caught what the first fix did on a RELOAD. The
// "warm" test read sessionStorage, which survives a reload — so a reloaded page
// started with the cover clear, showed half a second of the empty canvas (a
// blurred sky, white over the copy), then faded a translucent navy veil in over
// it and out again: exactly the "massive, heavy black gradients" the audit saw
// at 00:08. A reload has nothing in memory. The flag is now a module variable,
// which a reload resets and a client-side return keeps, and a cold load is
// covered from its very first paint.
//
// The reference build does this and we did not, which is why every review so
// far has been written against a half-hydrated frame: the exterior is 2.3MB and
// the hall is 15MB, both Draco-compressed, so there is a real window where the
// canvas is live and empty. Reviewers saw that window and reported it as a
// broken render. They were describing a loading state nobody had built.
//
// Reads drei's useProgress, which is a subscription to three's
// DefaultLoadingManager — so it counts the GLB, its textures and the transcoded
// KTX2 payloads, not a timer pretending to be progress.
//
// Two details that matter more than they look:
//
//   * It waits for `active` to go false, not for `progress` to hit 100. The
//     manager reports 100% the moment the last item STARTS its final step, and
//     Draco decode plus KTX2 transcode happen after that on worker threads. On
//     a phone that gap is long enough to show the exact empty canvas this
//     exists to hide.
//
//   * It fades rather than cuts, and it unmounts after the fade. A cover left
//     mounted at opacity 0 still sits over the canvas swallowing the first
//     scroll gesture, which reads as the page being frozen.

import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { coverState } from './coverState';

/**
 * drei's progress store, read at most once per animation frame.
 *
 * ---------------------------------------------------------------------------
 * THIS EXISTS TO FIX A REAL PRODUCTION CRASH, NOT TO SAVE RENDERS
 * ---------------------------------------------------------------------------
 *
 * Reading `useProgress()` directly threw React error #185 — "Maximum update
 * depth exceeded" — on roughly one in every four Tier-2 page loads in a
 * production build. Measured, not inferred: 5 walks of
 * /downloads -> /properties -> /faqs -> /terms produced 5 uncaught errors, and
 * the stack named the mechanism outright:
 *
 *   at onProgress            <- drei's store setter
 *   at hT.itemEnd            <- three's LoadingManager
 *   at Set.forEach           <- zustand notifying every subscriber
 *
 * drei's useProgress is a zustand store whose `set()` is called once per LOADED
 * ITEM by DefaultLoadingManager.onProgress. This build loads two GLBs with
 * roughly ninety Draco and KTX2 dependencies between them, so that is ~90
 * synchronous store writes, each one scheduling a React update. Enough of them
 * land while React is already committing that the nested-update counter passes
 * its limit of 50 and React gives up on the tree.
 *
 * It is NOT a Phase 6 regression. The same measurement against the pre-Phase-6
 * build (src at ed7e3e7) produced a HIGHER rate — 8 errors across 5 walks
 * against 5 — so the defect predates every Phase 6 commit and simply had no
 * test looking for it until the experience suite ran.
 *
 * ---------------------------------------------------------------------------
 * WHY COALESCING FIXES IT RATHER THAN MERELY REDUCING IT
 * ---------------------------------------------------------------------------
 *
 * The counter only climbs for updates scheduled DURING a commit. A
 * requestAnimationFrame callback is a fresh task, so an update scheduled from
 * one starts a new cycle and the counter resets. Coalescing therefore removes
 * the nesting, not just most of it — and as a side effect turns ~90 renders of
 * the cover into one per frame.
 *
 * The cost is that the counter is at most one frame stale, which for a loading
 * percentage is not a cost at all.
 */
function useCoalescedProgress() {
  const [snapshot, setSnapshot] = useState(() => useProgress.getState());

  useEffect(() => {
    let raf = 0;
    let latest: ReturnType<typeof useProgress.getState> | null = null;

    const flush = () => {
      raf = 0;
      if (latest) {
        setSnapshot(latest);
        latest = null;
      }
    };

    const unsubscribe = useProgress.subscribe((state) => {
      latest = state;
      if (!raf) raf = requestAnimationFrame(flush);
    });

    // The store can advance between the initial getState above and this
    // subscribe — the models start loading the moment the canvas mounts. One
    // catch-up read, so a fast load cannot leave the cover reading 0 forever.
    latest = useProgress.getState();
    raf = requestAnimationFrame(flush);

    return () => {
      unsubscribe();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return snapshot;
}


export function Preloader({ onMount }: { onMount?: () => void }) {
  const { progress, active } = useCoalescedProgress();
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  // A return within the document: the scene is already built, so there is
  // nothing to cover and the cover is never drawn. Read once, at mount; on the
  // server and on a cold load it is false, so the markup the server sends and
  // the first client render agree, and the cover is up from the first paint.
  const [warm] = useState(() => coverState.sceneInMemory);
  // The server-rendered cover (ExperienceCanvasHost) held the frame until this
  // chunk arrived; this one is identical and above it, so it can go.
  useEffect(() => {
    onMount?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Never runs backwards. The manager's total climbs as new dependencies are
  // discovered mid-load, so a raw percentage visibly drops — which looks like
  // a fault to the one person we most need to trust it.
  const [peak, setPeak] = useState(0);

  useEffect(() => {
    setPeak((p) => (progress > p ? progress : p));
  }, [progress]);

  // Live mirrors for the mount-only failsafe below to read.
  const activeRef = useRef(active);
  const peakRef = useRef(peak);
  activeRef.current = active;
  peakRef.current = peak;

  useEffect(() => {
    if (active || peak < 100) return;
    // One frame past the last decode, so the first painted frame is the room
    // rather than the clear colour.
    const t = setTimeout(() => setDone(true), 220);
    return () => clearTimeout(t);
  }, [active, peak]);

  // FAILSAFE. This cover locks page scroll, so anything that stops progress
  // reaching 100 locks the site — not degrades it, locks it.
  //
  // Three real ways that happens, none of them exotic:
  //   * WebGL unsupported, so WorldCanvas renders SceneFallback and no GLTF is
  //     ever requested. DefaultLoadingManager never fires, progress stays 0.
  //   * The GLB 404s or the CSP blocks a decoder. onError fires, onLoad never
  //     does, and `active` can stay true forever.
  //   * A route in the segment with no 3D on it at all.
  //
  // A visitor stuck on a counter reading 0% has no way out but to leave, and it
  // would be indistinguishable from the site being down. The scene is
  // decorative; the words behind it are the product. So the cover always lifts,
  // and a slow connection sees the page slightly early rather than never.
  useEffect(() => {
    const ceiling = setTimeout(() => setDone(true), 12000);
    // Nothing had even started after a beat: there is nothing to wait for.
    // Read through refs — this effect is mount-only, so a closure over `active`
    // and `peak` would capture their initial false/0 and dismiss the cover at
    // 2.5s for EVERY visitor, including the ones mid-download.
    const idle = setTimeout(() => {
      if (!activeRef.current && peakRef.current === 0) setDone(true);
    }, 2500);
    return () => {
      clearTimeout(ceiling);
      clearTimeout(idle);
    };
    // Intentionally mount-only: these are wall-clock deadlines from first
    // paint, and restarting them on every progress tick would mean a load that
    // trickles never trips the ceiling at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!done) return;
    coverState.sceneInMemory = true;
    const t = setTimeout(() => setGone(true), 1400);
    return () => clearTimeout(t);
  }, [done]);

  // Release the scroll lock as soon as the fade begins, not when it ends.
  useEffect(() => {
    // Never on a warm return: there is no cover to wait for.
    document.documentElement.style.overflow = done || warm ? '' : 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [done, warm]);

  if (gone || warm) return null;

  return (
    <div
      // aria-hidden with a live region below: a screen reader should hear
      // "loading" once, not a progress bar.
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#0A1120] transition-opacity duration-[1400ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ opacity: done ? 0 : 1 }}
    >
      <span className="sr-only" role="status">
        Loading the scene
      </span>

      <span aria-hidden className="t-micro text-[#F2EDE4]/[0.62]">
        Quality Homes Reality
      </span>

      {/* A hairline that fills with the load — the only motion on the cover.
          No figures: a number counting to a hundred is a progress report, and
          this is a curtain. */}
      <span aria-hidden className="relative mt-6 block h-px w-28 bg-[#F2EDE4]/[0.12]">
        <span
          className="absolute inset-y-0 left-0 block w-full origin-left bg-[#E8B98A]/70"
          style={{
            transform: `scaleX(${peak / 100})`,
            transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </span>
    </div>
  );
}
