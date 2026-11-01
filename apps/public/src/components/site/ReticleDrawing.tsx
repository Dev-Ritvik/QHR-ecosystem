'use client';

// apps/public/src/components/site/ReticleDrawing.tsx
//
// THE CURSOR: A RING AND A POINT, AND NOTHING ELSE (the user's reference of 2026-11-01:
// "the pixelated yellow ring on the lawn becomes a sharp, minimal SVG reticle").
//
// It was the astrolabe of the sheet of the same day, and what made it read as pixels
// was what made it an astrolabe: its band turned on a compositor layer, which is a
// bitmap of the band rotated with a bilinear filter, at forty pixels across, under a
// baked glow. So nothing turns and nothing glows: an SVG stroke, drawn at the screen's
// own resolution wherever it stands, ivory with a dark hairline so it holds on bright
// stone and on dark lawn alike. The sheet's scan on hover, the box of words beside it
// and the turning band were built and taken off at the user's word.
//
// IT DOES NOT CHANGE WITH WHAT IT IS OVER. A page element and not a draw in the scene,
// because it is on every page, most of which have no scene, and it asks of the main
// thread one transform a pointer event. It is not eased behind the pointer: a reticle
// that trails is not pointing at anything.

import { useEffect, useRef } from 'react';
import { reticleOnField } from './reticle';

const IVORY = '#F7F3EA';
const HAIRLINE = 'rgba(6, 12, 16, 0.42)';

export function ReticleDrawing() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const maybeRoot = rootRef.current;
    if (!maybeRoot) return;
    const root: HTMLDivElement = maybeRoot;
    const html = document.documentElement;

    let target: Element | null = null;
    let W = html.clientWidth;

    function aim(next: EventTarget | null) {
      const el = next instanceof Element ? next : null;
      if (el === target) return;
      target = el;
      root.dataset.state = reticleOnField(el) ? 'text' : 'idle';
    }

    /** A finger, on a machine that has both: the system's way, until the mouse is back. */
    function touched() {
      root.classList.remove('is-seen');
      html.classList.remove('reticle-on');
    }

    function move(e: PointerEvent) {
      if (e.pointerType !== 'mouse') {
        touched();
        return;
      }
      const { clientX: x, clientY: y } = e;
      root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      html.classList.add('reticle-on');
      // (on the scrollbar the system's own arrow is drawn whatever the sheet says)
      root.classList.toggle('is-seen', x < W);
      aim(e.target);
    }

    // (the boundary event, not only the move: the page scrolled or changed under a
    // pointer that is still, and the browser says so with this alone)
    const over = (e: MouseEvent) => aim(e.target);

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') touched();
      else if (e.button === 0) root.dataset.down = '';
    };

    const up = () => {
      delete root.dataset.down;
    };

    const away = () => root.classList.remove('is-seen');

    const measure = () => {
      W = html.clientWidth;
    };

    window.addEventListener('pointermove', move, { capture: true, passive: true });
    window.addEventListener('mouseover', over, { capture: true, passive: true });
    window.addEventListener('pointerdown', down, { capture: true, passive: true });
    window.addEventListener('pointerup', up, { capture: true, passive: true });
    window.addEventListener('pointercancel', up, { capture: true, passive: true });
    window.addEventListener('blur', up);
    window.addEventListener('resize', measure, { passive: true });
    html.addEventListener('mouseleave', away);
    return () => {
      window.removeEventListener('pointermove', move, { capture: true });
      window.removeEventListener('mouseover', over, { capture: true });
      window.removeEventListener('pointerdown', down, { capture: true });
      window.removeEventListener('pointerup', up, { capture: true });
      window.removeEventListener('pointercancel', up, { capture: true });
      window.removeEventListener('blur', up);
      window.removeEventListener('resize', measure);
      html.removeEventListener('mouseleave', away);
      html.classList.remove('reticle-on');
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden className="reticle" data-reticle="" data-state="idle">
      <div className="reticle-body">
        <svg className="reticle-ring" viewBox="-18 -18 36 36" fill="none">
          <circle r="15.5" stroke={HAIRLINE} strokeWidth="2.6" />
          <circle r="15.5" stroke={IVORY} strokeWidth="1.25" />
          <circle r="1.25" fill={IVORY} stroke={HAIRLINE} strokeWidth="0.9" />
        </svg>
      </div>
    </div>
  );
}
