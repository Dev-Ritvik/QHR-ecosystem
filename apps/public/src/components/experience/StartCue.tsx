'use client';

// apps/public/src/components/experience/StartCue.tsx
//
// THE COVER'S ONE CUE.
//
// The cover used to carry two things at its foot: an action, "Start here",
// that left the film for another page, and beside it — once a visitor had sat
// still for three seconds — the word "Scroll" and a hairline with a bar
// falling down it. The audit of 2026-10-05 (P2) saw them as what they were on
// the frame: "both 'START HERE' and 'SCROLL' plus a stray vertical tick. Done
// when there is one designed cue."
//
// They are one thing now. The words are the cover's own — "Start here" — and
// what they start is the film: a real link to the film's next chapter, so it
// works with no script and no canvas, which with the scene running carries the
// page down to where that chapter's copy is whole, at the film's own pace
// instead of jumping there. The falling bar is drawn as part of it, on a hairline that
// leads into the words, so there is no second mark for it to be a stray of.
// (The page it used to open is still one press away, in the menu and at the
// foot of every page.)

import { lenisInstance } from './SmoothScroll';
import { measureFilmSpan } from './filmTrack';

/** How long the glide to the next chapter takes, seconds: a walk, not a jump. */
const GLIDE_S = 4.2;

export function StartCue({ href, className = '' }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      className={'start-cue' + (className ? ` ${className}` : '')}
      onClick={(e) => {
        // Modified clicks keep their browser meaning.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const lenis = lenisInstance;
        const pane = document.querySelector<HTMLElement>(`${href} [data-copy]`);
        const whole = Number(pane?.dataset.copy?.split(',')[1]);
        if (!lenis || !(whole > 0)) return; // no smooth scroll: the fragment does it
        e.preventDefault();
        // Where that chapter's copy is whole (journey.ts, COPY_SPAN).
        const y = Math.round(whole * measureFilmSpan()) + 2;
        lenis.scrollTo(y, { duration: GLIDE_S, easing: (t: number) => t * t * (3 - 2 * t) });
      }}
    >
      <span aria-hidden className="start-cue-line">
        <i />
      </span>
      <span>Start here</span>
    </a>
  );
}
