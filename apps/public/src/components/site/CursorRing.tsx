'use client';

// apps/public/src/components/site/CursorRing.tsx
//
// A trailing ring that snaps to interactive elements — the "magnetic cursor".
//
// Three constraints this respects, because a custom cursor is one of the
// easiest ways to make a site feel broken:
//
//   * The REAL cursor is never hidden. Replacing the system pointer with a
//     div means anyone whose JS is slow, whose tab is throttled, or who uses a
//     pointer accessibility setting loses track of where they are clicking.
//     This ring rides alongside the native arrow rather than replacing it.
//
//   * pointer: fine only. There is no cursor on a phone, and mounting this
//     there would put a ring in the middle of the screen and leave it there.
//
//   * prefers-reduced-motion disables it entirely. A lagging element chasing
//     the pointer is exactly the kind of motion that setting exists for.
//
// Implementation is a single rAF writing a transform. No React state per frame:
// the ring position is written directly to the node's style, so the tree never
// re-renders while the mouse moves.

import { useEffect, useRef } from 'react';

/** Elements the ring snaps to. Anything a visitor can act on. */
const MAGNETIC = 'a, button, [role="button"], input, select, textarea, summary';

export function CursorRing() {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const el = ring.current;
    if (!el) return;

    // Target (where the pointer is) and current (where the ring has got to).
    // The gap between them is the whole effect.
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;
    let scale = 1;
    let targetScale = 1;
    let visible = false;

    const onMove = (e: PointerEvent) => {
      const hit = (e.target as Element | null)?.closest?.(MAGNETIC) ?? null;

      if (hit) {
        // MAGNETISM. Snap to the centre of the element and grow to wrap it,
        // rather than merely enlarging in place. Pulling to the centre is what
        // makes small targets feel caught rather than merely hovered.
        const r = hit.getBoundingClientRect();
        tx = r.left + r.width / 2;
        ty = r.top + r.height / 2;
        targetScale = Math.max(1.6, Math.min(4.2, r.height / 13));
      } else {
        tx = e.clientX;
        ty = e.clientY;
        targetScale = 1;
      }

      if (!visible) {
        visible = true;
        el.style.opacity = '1';
      }
    };

    const onLeave = () => {
      visible = false;
      el.style.opacity = '0';
    };

    let raf = 0;
    const loop = () => {
      // Same first-order lag as the camera scrub, much faster. The ring should
      // trail the pointer enough to read as a following object, not so much
      // that it feels disconnected from the hand.
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      scale += (targetScale - scale) * 0.14;
      el.style.transform =
        'translate3d(' + (cx - 13) + 'px,' + (cy - 13) + 'px,0) scale(' + scale.toFixed(3) + ')';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={ring}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[70] hidden h-[26px] w-[26px] rounded-full border border-[#E8B98A]/60 opacity-0 transition-opacity duration-300 md:block"
      style={{ willChange: 'transform' }}
    />
  );
}
