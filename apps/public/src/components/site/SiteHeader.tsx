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
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.07] bg-[#0A1120]/72 backdrop-blur-md">
        <div className="mx-auto flex h-[62px] max-w-6xl items-center gap-6 px-5">
          <Logo size={30} />

          <nav aria-label="Primary" className="ml-auto hidden md:block">
            <ul className="flex items-center gap-5">
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
                        'tap-target text-[13px] tracking-[0.04em] transition-colors ' +
                        (active
                          ? 'text-[#F2EDE4]'
                          : 'text-[#F2EDE4]/55 hover:text-[#F2EDE4]')
                      }
                    >
                      {/* Bracketed micro-navigation. The brackets are
                          aria-hidden so a screen reader hears "Plots", not
                          "left bracket Plots right bracket" — they are a
                          typographic device, not part of the link's name. They
                          brighten on hover with the label, so the whole token
                          reads as one target rather than a word inside
                          furniture. */}
                      <span aria-hidden className="mr-[0.35em] opacity-45">[</span>
                      <span className="uppercase tracking-[0.14em]">{l.label}</span>
                      <span aria-hidden className="ml-[0.35em] opacity-45">]</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <Link
            href="/contact"
            className="tap-target ml-auto rounded-[3px] border border-[#C08A5D]/45 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-[#E8B98A] transition-colors hover:border-[#C08A5D] hover:text-[#F2EDE4] md:ml-0"
          >
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
