'use client';

// apps/public/src/components/site/ResumeResidence.tsx
//
// The way back INTO the film, from anywhere else on the site.
//
// ---------------------------------------------------------------------------
// WHY IT IS NOT ALWAYS THERE
// ---------------------------------------------------------------------------
//
// The instinct is a permanent "The Residence" button on every page, matching
// the brief's wording. That would be a fifth item in a header that deliberately
// carries four, and on a first visit it would promise to return somebody to a
// film they have not started — which is just a second home link wearing a
// costume.
//
// So it appears only when both halves are true: the visitor is NOT on the film,
// and this session has actually reached a chapter. Nothing that has nothing to
// do is ever on screen. That is the same restraint the header applies to its
// twenty-route registry, and it makes the affordance mean something when it
// does appear: it is not navigation, it is a bookmark.
//
// ---------------------------------------------------------------------------
// WHY IT RENDERS NOTHING ON THE SERVER
// ---------------------------------------------------------------------------
//
// The remembered chapter lives in sessionStorage, which the server cannot see.
// Rendering a guess and correcting it on hydration is a mismatch; rendering
// nothing and revealing it in an effect is not. The cost is that it appears one
// frame late, which for a control nobody is reaching for in the first 16 ms is
// the right trade.
//
// It is a real <Link>, so it goes through the route veil like every other
// navigation, and it resumes rather than resets — the fragment ChapterUrl reads
// on arrival puts the camera back at the chapter it was left on.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { chapterLabel, rememberedChapter, residenceHref } from './residence';

export function ResumeResidence({ className = '' }: { className?: string }) {
  const pathname = usePathname() || '/';
  const [chapter, setChapter] = useState<string | null>(null);

  // Re-read on every navigation, not just on mount: the header never unmounts
  // (that is the point of the persistent layout), so a mount-only read would
  // show whatever was remembered when the tab opened for the rest of the visit.
  useEffect(() => {
    setChapter(pathname === '/' ? null : rememberedChapter());
  }, [pathname]);

  if (!chapter) return null;

  return (
    <Link
      href={residenceHref(chapter)}
      className={
        'tap-target whitespace-nowrap text-step--2 text-[#E8B98A]/75 ' +
        'transition-colors hover:text-[#E8B98A] ' +
        className
      }
    >
      {/* Set like the primary nav — small, tracked, no brackets — so it reads
          as part of the bar rather than as a badge stuck onto it. The arrow is
          aria-hidden: a screen reader should hear the sentence, not the
          furniture. */}
      <span aria-hidden className="mr-[0.5em]">&larr;</span>
      <span className="uppercase tracking-[0.3em]">The residence</span>
      <span className="sr-only"> — resume at {chapterLabel(chapter)}</span>
    </Link>
  );
}
