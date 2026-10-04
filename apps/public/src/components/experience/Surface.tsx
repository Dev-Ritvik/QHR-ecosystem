'use client';

// apps/public/src/components/experience/Surface.tsx
//
// A surface is a real, server-rendered route presented over the held frame.
// It is NOT a modal that replaces a page — the URL is real, the HTML is real,
// and it is indexable. The 3D is an enhancement layer over routes that stand
// on their own, which is what keeps SEO, deep links and the no-WebGL fallback
// working for free.
//
// The reason there is no travel: the world is mounted by the layout, so opening
// this changes nothing about the scene except which way the camera faces. A
// visitor who wants the FAQ gets the FAQ, from anywhere, immediately. That is
// the whole answer to "26 routes without making anyone impatient".

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SurfaceProps {
  title: string;
  eyebrow?: string;
  lede?: string;
  /** Where the close control goes when there is no history to return to —
   *  a deep link from search or an ad has nothing behind it. */
  fallbackHref?: string;
  children: React.ReactNode;
}

export function Surface({
  title,
  eyebrow,
  lede,
  fallbackHref = '/hall',
  children,
}: SurfaceProps) {
  const router = useRouter();
  const panel = useRef<HTMLElement>(null);
  const hadHistory = useRef(false);

  useEffect(() => {
    // Captured on mount: a deep-linked surface has no in-app history, so its
    // close control must lead somewhere real rather than out of the site.
    hadHistory.current =
      typeof window !== 'undefined' && window.history.length > 1;
    panel.current?.focus();
  }, []);

  const close = useCallback(() => {
    if (hadHistory.current) router.back();
    else router.push(fallbackHref);
  }, [router, fallbackHref]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="relative min-h-screen">
      {/* Scrim, not a solid page. The room stays visible behind the text — the
          difference between reading somewhere and reading on a white page, at
          no extra cost. Deliberately not a backdrop-blur on the whole viewport:
          blurring a live WebGL canvas every frame is one of the most expensive
          things a mid-tier phone can be asked to do.

          86% AT ITS LIGHTEST, so the page's quietest small text (ivory at
          55%) reads at AA over anything the world can put behind it: a white
          wall under 86% of this navy is a luma of 48, and 55% ivory on that is
          4.6:1. It was 70% at the top, where a daylit facade behind the
          testimonials left their captions at 4.0 to 4.4:1 — and every line of
          a page scrolls through the top of the frame. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#0A1120]/[0.86] via-[#0A1120]/90 to-[#0A1120]/95"
      />

      <article
        ref={panel}
        tabIndex={-1}
        aria-labelledby="surface-title"
        className="relative z-10 mx-auto w-full max-w-3xl px-6 py-16 outline-none sm:px-8 md:py-24"
      >
        <header className="border-b border-white/10 pb-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              {eyebrow && (
                <p className="text-step--2 uppercase tracking-[0.3em] text-[#F2EDE4]/[0.68]">
                  {eyebrow}
                </p>
              )}
              <h1
                id="surface-title"
                className="mt-3 font-serif text-step-3 text-[#F2EDE4] md:text-step-4"
              >
                {title}
              </h1>
            </div>

            <button
              type="button"
              onClick={close}
              aria-label="Close and return"
              className="shrink-0 rounded border border-white/15 px-4 py-2 text-step--2 uppercase tracking-[0.3em] text-[#F2EDE4]/70 transition hover:border-amber-200/50 hover:text-[#F2EDE4] focus:outline-none focus:ring-2 focus:ring-amber-200/50"
            >
              Close
            </button>
          </div>

          {lede && (
            <p className="mt-5 max-w-2xl text-step-0 text-[#F2EDE4]/70">
              {lede}
            </p>
          )}
        </header>

        <div className="prose-surface mt-10 space-y-6 text-step-0 text-[#F2EDE4]/80">
          {children}
        </div>

        <footer className="mt-16 border-t border-white/10 pt-6">
          <Link
            href={fallbackHref}
            className="text-step--2 uppercase tracking-[0.3em] text-[#F2EDE4]/[0.62] underline-offset-4 transition hover:text-[#F2EDE4] hover:underline"
          >
            Back to the hall
          </Link>
        </footer>
      </article>
    </div>
  );
}
