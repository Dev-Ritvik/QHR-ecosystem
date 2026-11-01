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

export function StartCue({
  href,
  className = '',
  mark = 'compass',
}: {
  href: string;
  className?: string;
  /** The mark at its end: the cover's surveyor's rose, or (the layout's,
   *  the founder's frame, 2026-10-28) a mouse before the words and nothing
   *  after them. */
  mark?: 'compass' | 'survey';
}) {
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
      {mark === 'survey' ? (
        <svg aria-hidden className="start-cue-mouse" viewBox="-7 -11 14 22" fill="none">
          <rect x="-5.6" y="-9.6" width="11.2" height="19.2" rx="5.6" stroke="currentColor" strokeWidth="1.1" />
          <path className="start-cue-wheel" d="M0-5.6v3.2" stroke="#e8b98a" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <span aria-hidden className="start-cue-line">
          <i />
        </span>
      )}
      <span>Start here</span>
      {/* AND A COMPASS AT ITS END (the concept the user asked to be built 1:1,
          2026-10-27): the words lead along a hairline to a surveyor's rose, the
          cover's survey in one mark. It turns a point when the cue is pointed
          at. (Not the layout's: the user took the crosshairs off the site.) */}
      {mark === 'compass' && (
        <>
          <span aria-hidden className="start-cue-rule" />
          <svg aria-hidden className="start-cue-compass" viewBox="-16 -16 32 32" fill="none">
            <circle r="9.2" stroke="currentColor" strokeWidth="0.9" opacity="0.8" />
            <path d="M0-15.5V-11M0 11v4.5M-15.5 0H-11M11 0h4.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.8" />
            <g className="start-cue-rose">
              <path d="M0-12.2L1.5-1.5 0 0-1.5-1.5Z" fill="#e8b98a" />
              <path d="M0 12.2L1.5 1.5 0 0-1.5 1.5ZM12.2 0L1.5 1.5 0 0 1.5-1.5ZM-12.2 0L-1.5 1.5 0 0-1.5-1.5Z" fill="currentColor" opacity="0.88" />
              <path d="M5.6-5.6L1 0 0 0 0-1ZM5.6 5.6L0 1 0 0 1 0ZM-5.6 5.6L-1 0 0 0 0 1ZM-5.6-5.6L0-1 0 0-1 0Z" fill="currentColor" opacity="0.55" />
            </g>
            <circle r="1.1" fill="#0a0806" stroke="currentColor" strokeWidth="0.6" />
          </svg>
        </>
      )}
    </a>
  );
}
