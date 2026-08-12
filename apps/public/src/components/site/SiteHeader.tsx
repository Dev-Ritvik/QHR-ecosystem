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

import { useEffect, useState } from 'react';
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

  // Escape closes, and the page underneath must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.07] bg-[#0A1120]/72 backdrop-blur-md">
        <div className="mx-auto flex h-[62px] max-w-6xl items-center gap-6 px-5">
          <Logo size={30} />

          <nav aria-label="Primary" className="ml-auto hidden md:block">
            <ul className="flex items-center gap-7">
              {PRIMARY.map((l) => {
                const active = pathname === l.href;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={
                        'text-[13px] tracking-[0.04em] transition-colors ' +
                        (active
                          ? 'text-[#F2EDE4]'
                          : 'text-[#F2EDE4]/55 hover:text-[#F2EDE4]')
                      }
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <Link
            href="/contact"
            className="ml-auto rounded-[3px] border border-[#C08A5D]/45 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-[#E8B98A] transition-colors hover:border-[#C08A5D] hover:text-[#F2EDE4] md:ml-0"
          >
            Enquire
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            className="-mr-2 flex h-10 w-10 items-center justify-center text-[#F2EDE4]/70 hover:text-[#F2EDE4] md:hidden"
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
          className="fixed inset-0 z-30 overflow-y-auto bg-[#060A14]/97 px-6 pb-16 pt-[78px] backdrop-blur-sm md:hidden"
        >
          <div className="mx-auto max-w-md">
            {ALL.map((g) => (
              <section key={g.group} className="mb-9">
                <h2 className="text-[10px] uppercase tracking-[0.22em] text-[#F2EDE4]/35">
                  {g.group}
                </h2>
                <ul className="mt-3 space-y-1">
                  {g.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="block py-2 font-serif text-lg text-[#F2EDE4]/85 hover:text-[#F2EDE4]"
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
