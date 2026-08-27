// apps/public/src/components/site/SiteFooter.tsx
//
// Replaces the placeholder strip that held nothing but the privacy control.
//
// The offices are listed in full rather than linked to, because the single
// most common thing a buyer wants at the bottom of a page is a way to reach a
// human near the land — and making them click once more to find an address is
// a self-inflicted drop-off.
//
// PrivacyControl keeps its place here. Withdrawing consent has to be as easy as
// granting it, and a footer on every page is the only element that qualifies.

import Link from 'next/link';
import { PrivacyControl } from '@/components/consent/ConsentPanel';
import { Logo } from './Logo';
import { BRANCHES } from '@estate/domain/leads/branches';

const COLUMNS = [
  { title: 'The land', links: [
    { href: '/properties', label: 'Plots and sizes' },
    { href: '/downloads', label: 'Layout plans' },
    { href: '/locations', label: 'Locations' },
    { href: '/gallery', label: 'Gallery' },
  ]},
  { title: 'The company', links: [
    { href: '/about', label: 'About' },
    { href: '/why-us', label: 'How we work' },
    { href: '/testimonials', label: 'Testimonials' },
    { href: '/careers', label: 'Careers' },
  ]},
  { title: 'Before you buy', links: [
    { href: '/investment-guide', label: 'Investment guide' },
    { href: '/knowledge', label: 'Knowledge' },
    { href: '/faqs', label: 'Questions' },
    { href: '/start-here', label: 'Start here' },
  ]},
];

const LEGAL = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refund-policy', label: 'Refunds' },
  { href: '/cookie-policy', label: 'Cookies' },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-white/[0.08] bg-[#060A14]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.1fr_2fr]">
          <div>
            <Logo size={34} href={null} />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-[#F2EDE4]/55">
              Approved plotted layouts in the northern coastal districts of
              Andhra Pradesh, developed and sold directly.
            </p>
            <p className="mt-5 text-[14px] text-[#F2EDE4]/70">
              <a className="tap-target transition-colors hover:text-[#F2EDE4]" href="tel:+919553513366">
                +91 95535 13366
              </a>
              <span className="mx-2 text-[#F2EDE4]/50">·</span>
              <a
                className="tap-target transition-colors hover:text-[#F2EDE4]"
                href="mailto:qualityhomesreality@gmail.com"
              >
                qualityhomesreality@gmail.com
              </a>
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {COLUMNS.map((c) => (
              <div key={c.title}>
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#F2EDE4]/50">
                  {c.title}
                </h2>
                {/* Real 44px rows rather than an invisible expander: these are
                    stacked, so a pseudo element would overlap its neighbours and
                    the wrong link would take the tap. The extra height also
                    gives the footer a steadier rhythm than 19px rows with an
                    8px gap did. */}
                <ul className="mt-2">
                  {c.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="flex min-h-[44px] items-center text-[14px] text-[#F2EDE4]/62 transition-colors hover:text-[#F2EDE4]"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-8 border-t border-white/[0.08] pt-10 sm:grid-cols-3">
          {(['visakhapatnam', 'vizianagaram', 'srikakulam'] as const).map((id) => {
            const b = BRANCHES[id];
            return (
              <div key={b.id}>
                <p className="text-[13px] text-[#F2EDE4]/80">{b.name}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[#C08A5D]/70">
                  {b.role === 'head_office' ? 'Head office' : 'Branch'}
                </p>
                <address className="mt-2 not-italic text-[13px] leading-relaxed text-[#F2EDE4]/60">
                  {b.address} &ndash; {b.pincode}
                </address>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-white/[0.08] pt-8">
          <p className="text-[12px] text-[#F2EDE4]/60">
            &copy; {year} Quality Homes Reality
          </p>
          {/* Laid out horizontally, so the invisible expander is safe here —
              gap-y-6 keeps enough room between wrapped rows that the 44px hit
              areas cannot overlap. */}
          <ul className="flex flex-wrap gap-x-5 gap-y-6">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="tap-target text-[12px] text-[#F2EDE4]/60 transition-colors hover:text-[#F2EDE4]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ml-auto text-[12px] text-[#F2EDE4]/60">
            <PrivacyControl />
          </div>
        </div>
      </div>
    </footer>
  );
}
