'use client';

// apps/public/src/components/site/SiteHeader.tsx
//
// The chrome that was never built. Twenty content routes existed with no way to
// move between them except links buried in body copy, and the logo was
// referenced by zero pages.
//
// Three decisions worth stating, because each was the harder option:
//
// 1. THE BAR IS THE MARK, ENQUIRE AND "MENU", ON EVERY PAGE. A buyer arrives
//    wanting one of a few things — see the land, take the plans, read up, or
//    talk to someone — and a bar with twenty items answers none of them
//    faster. So the bar carries the one control a buyer reaches for when they
//    are ready, and everything else is one press away in the panel, which is
//    the whole site set out as a contents page (siteMap.ts).
//
// 2. IT DOES NOT HIDE ON SCROLL. Auto-hiding chrome is a common flourish and it
//    costs a buyer the one control they reach for on a phone when they are
//    ready: the way to contact somebody. It stays, and earns its space by being
//    short.
//
// 3. ONE HEADER, NOT TWO (the client, 2026-10-06: "make sure everything gives
//    the same vibe / no page must feel left out"). The film had this header;
//    every other page had another — a frosted navy bar on a centred grid, with
//    four links set across it. A visitor who left the film arrived somewhere
//    with a different masthead, which is what a different website is. Every
//    page has the film's now: the mark off the frame's own edge, the controls
//    off the other, in the frame's unit. Over a picture (the film, a page's
//    opening plate) it is air; over a page's reading sheets it stands on the
//    sheets' own dark (folio.css, `data-folio`).
//
// The bar sits above the persistent WebGL canvas and never remounts — the
// (site) layout survives navigation inside the experience segment, which is
// the whole point of that segment.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { lenisInstance } from '@/components/experience/SmoothScroll';
import { Logo } from './Logo';
import { ResumeResidence } from './ResumeResidence';
import { FILM_PAGE, SITE_PARTS } from './siteMap';

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
      {/* OVER A PICTURE THE HEADER IS AIR, NOT A BAR. Over the film it is
          nothing at all — not a band, and since the second art-direction
          audit (2026-09-30) not the soft fall of shade that replaced one
          either: "artificial darkness ... brute-forced onto the screen". The
          navigation sits on the top of the picture, which the film keeps dark
          on purpose — a deep zenith outside, the unlit vault of a gallery
          hall inside. The same over a page's opening plate, whose own density
          comes down from the frame's top. Over a page's reading sheets it
          takes the sheets' own dark, so a line of text scrolling under the
          mark is not read through it (folio.css).

          AND IT STANDS ON THE FILM'S STAGE (globals.css) ON EVERY PAGE: on a
          wide frame the film's copy is set in the frame's own unit, and the
          header is on that grid — the mark on the copy's left edge, the
          controls the size of the type below them — at every size of frame.
          A page's title stands under the mark exactly as the cover's does. */}
      <header className={'site-header film-stage fixed inset-x-0 top-0 z-40' + (overFilm ? ' is-film' : '')}>
        {/* ON THE SITE GRID (globals.css): the logo stands on the copy's left
            edge and the controls end on the frame's right. On a phone it is a
            plain row, logo left and the controls right: twelve columns and
            eleven gutters do not fit 390px round a badge and a button, and
            the grid's minimum width widened the whole page to 484px
            (measured). */}
        <div className="site-grid h-[var(--bar)] items-center max-md:!flex max-md:justify-between">
          <div className="col-span-6 flex items-center gap-6 md:col-span-5 lg:col-span-6">
            <Logo size={30} />

            {/* The way back into the film. Renders nothing on the film itself,
                and nothing until this session has reached a chapter — see
                ResumeResidence. Sits beside the logo rather than in the nav
                because it is not a destination, it is a resume. */}
            <ResumeResidence className="hidden md:inline-block" />
          </div>

          {/* THE NAVIGATION IS IN THE MENU. The third art-direction critique
              (2026-09-30): "There is no top navigation, just a delicate,
              beautifully kerned logo and a single, tiny menu icon" — "the top
              navigation ... should be hidden behind a single, elegant menu
              toggle until explicitly needed." So the bar is the mark, Enquire
              (the one control a buyer reaches for when they are ready, which
              is why it never hides — note 2 above) and "Menu"; every page of
              the site is one press away in the panel. */}
          <div className="col-span-6 flex items-center justify-end gap-7 md:col-span-7 lg:col-span-6">
            <Link href="/contact" className="cta-enquire on-film tap-target">
              Enquire
            </Link>

            {/* The one menu control: the word, set like the masthead, and two
                hairlines that close into a cross. */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="site-menu"
              className="menu-toggle on-film tap-target group"
            >
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
              {/* BOTH WORDS, ONE OVER THE OTHER, so the control is as wide as
                  the wider of them whichever is showing. It was one word or
                  the other, and "Close" is five pixels wider than "Menu":
                  "Enquire" beside it jumped left as the menu opened (the
                  forensic audit of 2026-10-09, #102). */}
              <span aria-hidden className="menu-toggle-label">
                <span className={open ? 'is-off' : undefined}>Menu</span>
                <span className={open ? undefined : 'is-off'}>Close</span>
              </span>
              <span aria-hidden className={'menu-toggle-lines' + (open ? ' is-open' : '')}>
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
        {/* UNDER THE CONTROLS, OVER THE FILM: WHERE, AND THE SOUND (the
            concept the user asked to be built 1:1, 2026-10-27). The
            co-ordinates are Vizianagaram's, the town the first office and the
            cover's first district are named for — not a claim about the house
            in the film, which is a picture, and said so to a screen reader.
            Under them the sound control (AmbientSound, a portal into this
            slot): a waveform and a switch. Empty, and nothing, on every other
            page. */}
        {overFilm ? (
          <div className="film-locator">
            <p className="film-coords">
              <span className="sr-only">Vizianagaram, </span>
              <span aria-hidden title="Vizianagaram">18.114° N, 83.402° E</span>
              <span className="sr-only">18.114 degrees north, 83.402 degrees east</span>
            </p>
            <span id="film-sound" className="film-sound-slot" />
            {/* And the hour: Day, Golden, Night (HourChoice.tsx, a portal into this slot). */}
            <span id="film-hours" className="film-hours-slot" />
          </div>
        ) : null}
      </header>

      {open ? (
        <div
          id="site-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          data-lenis-prevent
          // OPAQUE. At 97% the page behind it was a ghost under the list: on
          // /about the founder's portrait, with the links' text crossing it
          // (the forensic audit of 2026-10-09, #103). The hall's own dark,
          // as every page's ground is (folio.css).
          className="menu-panel film-stage fixed inset-0 z-30 overflow-y-auto bg-[#0E0B08] px-6 pb-16 pt-[96px] md:px-0 md:pt-[calc(138*var(--u))]"
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
          {/* At the frame's own edge, under the mark: it stood a 24px gutter in
              from the window on every wide frame, three inches left of the
              header it hangs from. */}
          <div className="site-grid !px-0 md:!px-[var(--edge)]">
            {/* First item in the panel, above the route groups: on a phone the
                header has no room for it, so this is where the same affordance
                lives. Renders nothing when there is nothing to resume, so the
                menu is unchanged on a first visit. */}
            <div className="col-span-12">
              <ResumeResidence className="mb-10 block" />
            </div>
            {SITE_PARTS.map((g) => (
              <section key={g.title} className="col-span-12 mb-10 md:col-span-3 md:mb-0">
                {/* (No numerals. The parts were numbered I to IV "like a
                    contents page", and the five points of /why-us are 01 to
                    05: two ways of numbering on a site that numbers nothing
                    else — the forensic audit of 2026-10-09, #79. The five
                    points are counted because there are five of them; the
                    menu's parts are not a sequence.) */}
                <h2 className="t-eyebrow text-[#E8B98A]">{g.title}</h2>
                <span aria-hidden className="mt-4 block h-px w-10 bg-[#E8B98A]/40" />
                <ul className="mt-4 md:mt-6">
                  {g.pages.map((l) => {
                    const here = pathname === l.href;
                    return (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          aria-current={here ? 'page' : undefined}
                          // Real height rather than a pseudo element here: these
                          // are stacked, so an invisible overlay would overlap its
                          // neighbours. 44px of actual row is also just better in
                          // a full-screen menu.
                          className={
                            'flex min-h-[44px] items-center text-step-2 transition-colors hover:text-[#E8B98A] focus-visible:text-[#E8B98A] md:min-h-0 md:py-[calc(var(--bl)*1.5)] ' +
                            (here ? 'text-[#E8B98A]' : 'text-[#F2EDE4]/90')
                          }
                        >
                          {l.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {/* THE ONE PAGE THE PARTS DO NOT HOLD. This row also said "Enter
                the hall" and "Enquire", both of which are in the last part
                above it: with the header's own "Enquire" that was one action
                three times on one screen (the forensic audit of 2026-10-09,
                #61). */}
            <div className="col-span-12 mt-2 flex flex-wrap items-baseline gap-x-10 gap-y-4 border-t border-white/10 pt-6 md:mt-14">
              <Link href={FILM_PAGE.href} className="cta-quiet">
                <span className="cta-quiet-label">{FILM_PAGE.name}</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
