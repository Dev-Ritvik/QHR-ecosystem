'use client';

// apps/public/src/components/site/SiteHeader.tsx
//
// The chrome that was never built. Twenty content routes existed with no way to
// move between them except links buried in body copy, and the logo was
// referenced by zero pages.
//
// Two decisions worth stating, because both were the harder option:
//
// 1. FOUR LINKS, NOT TWENTY. The route registry has twenty-odd entries and the
//    instinct is to surface them. But a buyer arrives wanting one of four
//    things — see the land, take the plans, read up, or talk to someone — and a
//    bar with twenty items answers none of them faster. Everything else is
//    reachable from the footer and from the pages themselves.
//
// 2. IT DOES NOT HIDE ON SCROLL. Auto-hiding chrome is a common flourish and it
//    costs a buyer the one control they reach for on a phone when they are
//    ready: the way to contact somebody. It stays, and earns its space by being
//    short.
//
// The bar sits above the persistent WebGL canvas, so it is deliberately thin,
// blurred rather than opaque, and never remounts — the (site) layout survives
// navigation inside the experience segment, which is the whole point of that
// segment.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { ResumeResidence } from './ResumeResidence';

const PRIMARY = [
  { href: '/properties', label: 'Plots' },
  { href: '/downloads', label: 'Plans' },
  { href: '/knowledge', label: 'Knowledge' },
  { href: '/branches', label: 'Offices' },
];

const ALL = [
  { group: 'The land', links: [
    { href: '/properties', label: 'Plots and sizes' },
    { href: '/downloads', label: 'Approved layout plans' },
    { href: '/locations', label: 'Where the sites are' },
    { href: '/gallery', label: 'Gallery' },
  ]},
  { group: 'The company', links: [
    { href: '/about', label: 'About' },
    { href: '/why-us', label: 'How we work' },
    { href: '/testimonials', label: 'What buyers say' },
    { href: '/careers', label: 'Careers' },
  ]},
  { group: 'Before you buy', links: [
    { href: '/investment-guide', label: 'Investment guide' },
    { href: '/knowledge', label: 'Knowledge' },
    { href: '/faqs', label: 'Questions' },
    { href: '/start-here', label: 'Start here' },
  ]},
];

export function SiteHeader() {
  const pathname = usePathname() || '/';
  // The home page is the film (the middleware rewrites "/" to /site-home).
  const overFilm = pathname === '/' || pathname === '/site-home';
  const [open, setOpen] = useState(false);

  // Close on navigation. The panel is not unmounted by the route change —
  // that is what a persistent layout means — so it would otherwise stay open
  // over the page the visitor just asked for.
  useEffect(() => setOpen(false), [pathname]);

  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * While the panel is open it is the only thing on screen, so it has to be the
   * only thing reachable.
   *
   * It already closed on Escape and locked body scroll, but Tab walked straight
   * out of it into the page underneath — which is still rendered, still
   * focusable, and completely obscured. A keyboard or screen-reader user ended
   * up driving a page they could not see. Focus now enters the panel on open,
   * cycles inside it, and returns to the button that opened it on close.
   */
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const returnTo = document.activeElement as HTMLElement | null;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      );

    focusable()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      returnTo?.focus?.();
    };
  }, [open]);

  return (
    <>
      {/* OVER THE FILM THE HEADER IS AIR, NOT A BAR. Everywhere else it keeps
          its frosted navy band; on the home page it sits over a lit ivory hall
          and a sunlit estate, where a cold, blurred strip across the top of
          every frame read as an app's toolbar laid over a photograph. There it
          is a soft fall of shade, just enough to hold the navigation. */}
      <header
        className={
          'fixed inset-x-0 top-0 z-40 transition-colors duration-500 ' +
          (overFilm
            ? // No border at all: a background gradient is sized to the padding
              // box and REPEATS into the border box, so even a transparent 1px
              // border repainted the gradient's darkest row as a hairline.
              'bg-gradient-to-b from-[#120d09]/55 via-[#120d09]/22 to-transparent bg-no-repeat'
            : 'border-b border-white/[0.07] bg-[#0A1120]/72 backdrop-blur-md')
        }
      >
        {/* ON THE SITE GRID (globals.css): the same twelve columns as the
            hero, so the logo stands on the copy's left edge, the nav is set
            justified across columns 7-10 (first link on column 7's line, last
            ending on column 10's), and Enquire ends on the right edge of the
            frame. On a phone it is a plain row, logo left and Enquire right:
            twelve columns and eleven gutters do not fit 390px round a badge and
            a button, and the grid's minimum width widened the whole page to
            484px (measured). */}
        <div className="site-grid h-[62px] items-center max-md:!flex max-md:justify-between">
          <div className="col-span-6 flex items-center gap-6 md:col-span-5 lg:col-span-6">
            <Logo size={30} />

            {/* The way back into the film. Renders nothing on the film itself,
                and nothing until this session has reached a chapter — see
                ResumeResidence. Sits beside the logo rather than in the nav
                because it is not a destination, it is a resume. */}
            <ResumeResidence className="hidden md:inline-block" />
          </div>

          <nav aria-label="Primary" className="hidden md:col-span-5 md:block lg:col-span-4">
            <ul className="flex items-center justify-between">
              {PRIMARY.map((l) => {
                const active = pathname === l.href;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={
                        // tap-target: these render 18px tall, which is fine for
                        // a mouse and not for the tablets that also get this
                        // bar. The hit area grows; the type does not.
                        'tap-target group relative text-[11px] font-normal uppercase tracking-[0.22em] transition-colors duration-300 ' +
                        (active
                          ? 'text-[#F2EDE4]'
                          : 'text-[#F2EDE4]/80 hover:text-[#F2EDE4]')
                      }
                    >
                      {/* NO BRACKETS. The client's art-direction review named
                          them outright: "[ PLOTS ]" reads as code, a
                          wireframe, a terminal — "aggressively anti-luxury".
                          What is left is the word, set small, tracked wide and
                          quiet, with a hairline that draws in under it on hover
                          and stays under the page you are on. That is the whole
                          vocabulary an editorial masthead uses. */}
                      {l.label}
                      <span
                        aria-hidden
                        className={
                          'pointer-events-none absolute -bottom-[5px] left-0 h-px w-full origin-left bg-[#E8B98A]/70 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
                          (active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100')
                        }
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="col-span-6 flex items-center justify-end gap-3 md:col-span-2">
            <Link href="/contact" className="cta-enquire tap-target">
              Enquire
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="site-menu"
              className="tap-target -mr-2 flex h-10 w-10 items-center justify-center text-[#F2EDE4]/70 hover:text-[#F2EDE4] md:hidden"
            >
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
                <path
                  d={open ? 'M1 1 L17 11 M17 1 L1 11' : 'M0 1 H18 M0 6 H18 M0 11 H18'}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div
          id="site-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-30 overflow-y-auto bg-[#060A14]/97 px-6 pb-16 pt-[78px] backdrop-blur-sm md:hidden"
        >
          <div className="mx-auto max-w-md">
            {/* First item in the panel, above the route groups: on a phone the
                header has no room for it, so this is where the same affordance
                lives. Renders nothing when there is nothing to resume, so the
                menu is unchanged on a first visit. */}
            <ResumeResidence className="mb-8 block" />
            {ALL.map((g) => (
              <section key={g.group} className="mb-9">
                <h2 className="text-[10px] uppercase tracking-[0.22em] text-[#F2EDE4]/50">
                  {g.group}
                </h2>
                <ul className="mt-3 space-y-1">
                  {g.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        // Real height rather than a pseudo element here: these
                        // are stacked, so an invisible overlay would overlap its
                        // neighbours. 44px of actual row is also just better in
                        // a full-screen menu.
                        className="flex min-h-[44px] items-center font-serif text-lg text-[#F2EDE4]/85 hover:text-[#F2EDE4]"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <Link
              href="/hall"
              className="inline-block border-t border-white/10 pt-6 text-[11px] uppercase tracking-[0.18em] text-[#C08A5D]"
            >
              Enter the hall
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
