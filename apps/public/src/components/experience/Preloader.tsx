'use client';

// apps/public/src/components/experience/Preloader.tsx
//
// A typography-driven percentage counter that holds the page until the scene
// has actually arrived.
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

export function Preloader() {
  const { progress, active } = useProgress();
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
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
    const t = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(t);
  }, [done]);

  // Release the scroll lock as soon as the fade begins, not when it ends.
  useEffect(() => {
    document.documentElement.style.overflow = done ? '' : 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [done]);

  if (gone) return null;

  const shown = Math.round(peak);

  return (
    <div
      // aria-hidden with a live region below: a screen reader should hear
      // "loading" once, not a counter ticking a hundred times.
      className="fixed inset-0 z-[60] flex items-end justify-between bg-[#0A1120] px-6 pb-10 transition-opacity duration-[900ms] ease-out md:px-12 md:pb-14"
      style={{ opacity: done ? 0 : 1 }}
    >
      <span className="sr-only" role="status">
        Loading the scene
      </span>

      <span
        aria-hidden
        className="t-eyebrow text-[#F2EDE4]/60"
        style={{ letterSpacing: '0.18em' }}
      >
        Quality Homes Reality
      </span>

      {/* Tabular figures so the counter does not reflow as digits change —
          a number that jitters while it counts undoes the composure. */}
      <span
        aria-hidden
        className="text-[#F2EDE4]"
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: 'clamp(3rem, 11vw, 8rem)',
          lineHeight: 0.82,
          letterSpacing: '-0.03em',
        }}
      >
        {shown}
        <span className="text-[#E8B98A]" style={{ fontSize: '0.3em', verticalAlign: 'super' }}>
          %
        </span>
      </span>

      {/* A hairline that tracks the same number. The counter is the content;
          this is only there so the eye has something continuous to follow. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-[#E8B98A]/50"
        style={{
          transform: `scaleX(${peak / 100})`,
          transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}
