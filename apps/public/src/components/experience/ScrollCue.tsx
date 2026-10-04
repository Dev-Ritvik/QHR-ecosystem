'use client';

// apps/public/src/components/experience/ScrollCue.tsx
//
// THE SCROLL CUE, ONLY WHEN IT IS NEEDED.
//
// The third art-direction critique (2026-09-30) counted the marks on the
// opening frame — the bar, the logo, the headline, the action, "a bottom-center
// scroll indicator", the sound control — and asked for "extreme restraint ...
// the UI whispers rather than shouts". Most visitors scroll without being told
// to, and for them the cue is one more thing on the cover. So it waits: it
// appears only if the visitor has sat on the opening frame for a few seconds
// without scrolling, and it goes the moment they do, for the rest of the visit.

import { useEffect, useState } from 'react';

/** How long the cover is left alone before the cue offers itself. */
const WAIT_MS = 3200;

export function ScrollCue({ className = '' }: { className?: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (!done && window.scrollY < 8) setShown(true);
    }, WAIT_MS);
    const onScroll = () => {
      if (window.scrollY < 8) return;
      done = true;
      window.clearTimeout(timer);
      setShown(false);
      window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={
        'pointer-events-none flex items-center gap-4 transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ' +
        (shown ? 'opacity-100' : 'opacity-0') +
        (className ? ` ${className}` : '')
      }
    >
      <span className="t-eyebrow text-[#F2EDE4]">Scroll</span>
      <span className="relative h-10 w-px overflow-hidden bg-[#F2EDE4]/15">
        <span className="absolute inset-x-0 top-0 h-4 animate-[scrollcue_2.2s_ease-in-out_infinite] bg-[#E8B98A]" />
      </span>
    </div>
  );
}
