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
import { lenisInstance } from '@/components/experience/SmoothScroll';
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
    // The page's copy steps out behind the panel (globals.css, THE MENU OVER
    // THE FILM): the menu's lines never stand on the page's.
    document.documentElement.setAttribute('data-menu-open', '');
    // On the film the page scrolls through Lenis, which a hidden overflow does
    // not stop: the wheel over the open menu would run the film underneath it.
    // Held while the menu is open — unless something else (a door passage)
    // already holds it, in which case that is left to release it.
    const held = lenisInstance && !lenisInstance.isStopped ? lenisInstance : null;
    held?.stop();

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
      document.documentElement.removeAttribute('data-menu-open');
      held?.start();
      window.removeEventListener('keydown', onKey);
      returnTo?.focus?.();
    };
  }, [open]);

  return (
    <>
      {/* OVER THE FILM THE HEADER IS AIR, NOT A BAR. Everywhere else it keeps
          its frosted navy band; on the home page it is nothing at all — not
          the band, and since the second art-direction audit (2026-09-30) not
          the soft fall of shade that replaced it either: "artificial darkness
          ... brute-forced onto the screen". The navigation sits on the top of
          the picture, which the film keeps dark on purpose — a deep zenith
          outside, the unlit vault of a gallery hall inside.

          AND OVER THE FILM IT STANDS ON THE FILM'S STAGE (globals.css): on a
          wide frame the film's copy is set in the frame's own unit, on a grid
          that scales with the picture, and the header is on that grid — the
          mark on the copy's left edge, the controls the size of the type
          below them — at every size of frame, not only the one it was drawn
          at. Everywhere else the unit is a pixel and the bar is its 62. */}
      <header
        className={
          'fixed inset-x-0 top-0 z-40 transition-colors duration-500 ' +
          (overFilm
            ? 'film-stage bg-transparent'
            : 'border-b border-white/[0.07] bg-[#0A1120]/80 backdrop-blur-md')
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
        <div className="site-grid h-[var(--bar)] items-center max-md:!flex max-md:justify-between">
          <div className="col-span-6 flex items-center gap-6 md:col-span-5 lg:col-span-6">
            <Logo size={30} />

            {/* The way back into the film. Renders nothing on the film itself,
                and nothing until this session has reached a chapter — see
                ResumeResidence. Sits beside the logo rather than in the nav
                because it is not a destination, it is a resume. */}
            <ResumeResidence className="hidden md:inline-block" />
          </div>

          {/* OVER THE FILM THE NAVIGATION FOLDS INTO THE MENU. The third
              art-direction critique (2026-09-30): "There is no top navigation,
              just a delicate, beautifully kerned logo and a single, tiny menu
              icon" — "the top navigation ... should be hidden behind a single,
              elegant menu toggle until explicitly needed." So on the film the
              bar is the mark, Enquire (the one control a buyer reaches for
              when they are ready, which is why it never hides — note 2 above)
              and "Menu"; every page the four links led to is one press away in
              the panel. Every other page keeps the links. */}
          <nav
            aria-label="Primary"
            className={overFilm ? 'hidden' : 'hidden md:col-span-5 md:block lg:col-span-4'}
          >
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
                        // 10px at 0.32em: the audit's "microscopic, perfectly
                        // tracked" masthead, quieter than the film under it.
                        'tap-target group relative text-step--2 font-medium uppercase tracking-[0.3em] transition-colors duration-300 ' +
                        (active
                          ? 'text-[#F2EDE4]'
                          : 'text-[#F2EDE4]/[0.72] hover:text-[#F2EDE4]')
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

          <div
            className={
              'col-span-6 flex items-center justify-end ' +
              (overFilm ? 'gap-7 md:col-span-7 lg:col-span-6' : 'gap-3 md:col-span-2')
            }
          >
            {/* The film's sound control is set here (AmbientSound, a portal
                into this slot): on the header's ground, which the lens holds
                dark, rather than in a corner of the picture, which nothing
                does. Empty, and no width, on every other page. */}
            {overFilm ? <span id="film-sound" className="flex items-center" /> : null}
            <Link href="/contact" className={'cta-enquire tap-target' + (overFilm ? ' on-film' : '')}>
              Enquire
            </Link>

            {overFilm ? (
              // The film's one menu control: the word, set like the masthead,
              // and two hairlines that close into a cross.
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="site-menu"
                className="menu-toggle on-film tap-target group"
              >
                <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
                <span aria-hidden className="menu-toggle-label">
                  {open ? 'Close' : 'Menu'}
                </span>
                <span aria-hidden className={'menu-toggle-lines' + (open ? ' is-open' : '')}>
                  <i />
                  <i />
                </span>
              </button>
            ) : (
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
            )}
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
          data-lenis-prevent
          className={
            // /[0.97], not /97: Tailwind 3 only generates the opacity steps in
            // its scale, and /97 generated nothing — the panel had no ground at
            // all, the page and the film showing straight through its links.
            'menu-panel fixed inset-0 z-30 overflow-y-auto bg-[#060A14]/[0.97] px-6 pb-16 pt-[96px]' +
            (overFilm ? ' film-stage md:px-0 md:pt-[calc(152*var(--u))]' : ' md:hidden')
          }
        >
          {/* THE PANEL IS SET ON THE HEADER'S OWN GRID (the fourth
              art-direction critique, 2026-09-30: "The grid is loose. The
              typography sizing feels arbitrary rather than rooted in a strict
              mathematical scale"). The same twelve columns, gutter and frame
              as the bar above it and the film's copy, so the first group
              stands on the logo's line; three groups of four columns each,
              numbered like a contents page; group heads at the scale's
              smallest step, links at step 3 on a ten-baseline leading, and
              nothing between them but the grid's own air. On a phone it is
              one column, links at step 2. */}
          <div className="site-grid !px-0 md:!px-6">
            {/* First item in the panel, above the route groups: on a phone the
                header has no room for it, so this is where the same affordance
                lives. Renders nothing when there is nothing to resume, so the
                menu is unchanged on a first visit. */}
            <div className="col-span-12">
              <ResumeResidence className="mb-10 block" />
            </div>
            {ALL.map((g, i) => (
              <section
                key={g.group}
                className={'col-span-12 mb-10 ' + (overFilm ? 'md:col-span-4 md:mb-0' : '')}
              >
                <h2 className="t-eyebrow flex items-baseline gap-4 text-[#D9B07A]/[0.78]">
                  <span aria-hidden>{['I', 'II', 'III'][i]}</span>
                  <span>{g.group}</span>
                </h2>
                <span aria-hidden className="mt-4 block h-px w-10 bg-[#D9B07A]/40" />
                <ul className={'mt-4 ' + (overFilm ? 'md:mt-6' : '')}>
                  {g.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        // Real height rather than a pseudo element here: these
                        // are stacked, so an invisible overlay would overlap its
                        // neighbours. 44px of actual row is also just better in
                        // a full-screen menu.
                        className={
                          'flex min-h-[44px] items-center text-step-2 text-[#F2EDE4]/[0.86] transition-colors duration-300 hover:text-[#E8B98A] focus-visible:text-[#E8B98A]' +
                          (overFilm ? ' md:min-h-0 md:text-step-3' : '')
                        }
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <div
              className={
                'col-span-12 mt-2 flex flex-wrap items-baseline gap-x-10 gap-y-4 border-t border-white/10 pt-6 ' +
                (overFilm ? 'md:mt-16' : '')
              }
            >
              <Link href="/hall" className="cta-quiet">
                <span className="cta-quiet-label">Enter the hall</span>
              </Link>
              <Link href="/contact" className="cta-quiet">
                <span className="cta-quiet-label">Enquire</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
