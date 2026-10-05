'use client';

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
//
// ON THE FILM IT IS THE LAST FRAME, NOT A PAGE UNDER IT. The second client
// review: "the transition from the interactive 3D WebGL environment to the
// standard, dark-blue text footer is jarring ... a completely separate, basic
// HTML webpage appended to the bottom of a 3D application." It was: a solid
// navy slab with a rule across the top, arriving under the film's last frame.
// On the home page the footer has no ground of its own: it is set over the
// film's closing picture (FilmColophon, below), in the film's own type. Every
// other page keeps the plain footer it had.


import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

/**
 * THE FILM'S FOOTER IS A COLOPHON. The second art-direction audit (2026-09-30):
 * "a standard, heavy, multi-column web footer ... far too visually dense and
 * purely functional, breaking the immersive spell", and it should rest "gently"
 * in the last frame. By now the house lights have gone down round the map
 * table and the camera has risen off it (WorldCanvas, the coda), so the footer
 * is set over the court's darkened stone: the sign-off, then every link the
 * footer ever carried as one quiet
 * line of tracked capitals, the three offices as three short lines, and the
 * legal line — no logo block, no columns, no rules, no ground behind it.
 *
 * AND THAT LAST FRAME IS COMPOSED FOR IT (codaFrame.ts): the lit table ends
 * beside the sign-off on a wide frame and above it on a phone, with the dark
 * of the court's floor under both for the quiet lines. Where the colophon is
 * taller than the frame and its lines must still cross the table, the lens
 * closes down as they reach it, the way a cinema's picture goes when the
 * credits come (lensFilter.codaFilter) — never a ground laid behind the words.
 *
 * ON THE FILM'S STAGE (globals.css): it is the film's last frame, so it is set
 * in the film's unit and on the film's grid — its left edge under the mark's
 * and the copy's at every size of frame, not 72rem's.
 *
 * AND NO GROUND BEHIND IT MEANS EVERY LINE AT A STRENGTH THE STONE ALLOWS.
 * The quiet lines were ivory at 42 to 55% and gilt at 60%, and the court's
 * stone under them is not a navy slab: measured per line at 1440x900 and
 * 390x844, a p90 luma of 19 to 62 and the links, the offices and the legal
 * line at 4.0 to 4.4:1. They are 85 to 90% now, the gilt whole; what keeps
 * them quiet is their size.
 *
 * AND NO BAR ABOVE IT EITHER: over the film the header is air, so each of the
 * colophon's lines (`data-line`) dissolves as it comes to the header's edge
 * rather than ride up through the mark and the controls (ChapterFade,
 * LINES_MODE) — which is what they did on every frame shorter than the
 * colophon is: a phone, a small laptop.
 *
 * A CONCLUSION, NOT A FOOTER (the paid audit of 2026-10-04, pass 10: "the
 * final frame of the film, not the bottom of the website ... fewer competing
 * text sizes, stronger alignment, more empty space, stronger final object,
 * one clear final action, less footer furniture"). It spoke in seven voices:
 * a gilt label, the sign-off, its gloss, an action in capitals, a telephone
 * number dressed as a second action, twelve links in tracked capitals, three
 * offices each a capital name with a gilt role over a small address, and a
 * legal line with its own capitals. Now it is the sign-off and ONE action,
 * with the telephone number beside it as a number; then, a long way under
 * them, the small matter in a single quiet voice — the offices, the links
 * and the legal line all in the text's own small size, in sentences' case,
 * with no capitals and no gilt. The label is read, not drawn. Every link a
 * crawler or a reader could reach before is still there.
 */
function FilmColophon({ year }: { year: number }) {
  const links = COLUMNS.flatMap((c) => c.links);
  return (
    <footer className="film-stage relative z-10">
      <div data-chapter-fade="lines" className="mx-auto max-w-[var(--grid-max)] px-6 pb-14 pt-[26vh]">
        <h2 className="sr-only">Visit</h2>
        <p data-line data-reveal className="t-h1 max-w-[16ch] text-[#F2EDE4]">
          The land is best seen <span className="t-display-em">from the land.</span>
        </p>
        <p data-line className="t-hero-lede mt-6 max-w-[40ch] text-[#F2EDE4]/90">
          Every open layout can be walked. The branch that holds it will take
          you there.
        </p>
        <div data-line className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
          <Link href="/contact" className="cta-primary">
            Arrange a site visit
          </Link>
          <a
            href="tel:+919553513366"
            className="t-small tap-target text-[#F2EDE4]/90 transition-colors hover:text-[#F2EDE4]"
          >
            +91 95535 13366
          </a>
        </div>

        {/* THE SMALL MATTER, IN ONE VOICE, a long way under the sign-off. */}
        <div className="mt-[24vh] grid gap-x-10 gap-y-5 sm:grid-cols-3">
          {(['visakhapatnam', 'vizianagaram', 'srikakulam'] as const).map((id) => {
            const b = BRANCHES[id];
            return (
              <div data-line key={b.id} className="t-small text-[#F2EDE4]/90">
                <p>
                  {b.name}
                  {b.role === 'head_office' ? ', head office' : ''}
                </p>
                <address className="not-italic text-[#F2EDE4]/85">
                  {b.address} &ndash; {b.pincode}
                </address>
              </div>
            );
          })}
        </div>

        {/* TWO ROWS OF SIX, set that way: as one wrapped row the twelfth link
            stood alone on a second line on every frame narrower than 1700 px
            (seen at 1536x730). */}
        <nav aria-label="Footer" className="mt-6">
          {[links.slice(0, 6), links.slice(6)].map((row, i) => (
            <ul key={i} className="flex flex-wrap gap-x-6">
              {row.map((l) => (
                <li data-line key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="t-small flex min-h-[44px] items-center text-[#F2EDE4]/85 transition-colors hover:text-[#F2EDE4]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>

        <div data-line className="t-small mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 text-[#F2EDE4]/85">
          <span>&copy; {year} Quality Homes Reality</span>
          <a className="tap-target transition-colors hover:text-[#F2EDE4]" href="mailto:qualityhomesreality@gmail.com">
            qualityhomesreality@gmail.com
          </a>
          {LEGAL.map((l) => (
            <Link key={l.href} href={l.href} className="tap-target transition-colors hover:text-[#F2EDE4]">
              {l.label}
            </Link>
          ))}
          {/* At its row's own strength: at the control's 60% it was the one
              line of the colophon under AA where the stone is at its lightest
              (measured at 390x844: 3.98:1 on a p90 luma of 72). */}
          <span className="ml-auto">
            <PrivacyControl className="tap-target t-small text-[#F2EDE4]/85 underline-offset-4 transition hover:text-[#F2EDE4] hover:underline" />
          </span>
        </div>
      </div>
    </footer>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  const pathname = usePathname() || '/';
  const overFilm = pathname === '/' || pathname === '/site-home';
  if (overFilm) return <FilmColophon year={year} />;
  const rule = 'border-white/[0.08]';

  return (
    <footer className="relative z-10 border-t border-white/[0.08] bg-[#060A14]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.1fr_2fr]">
          <div>
            <Logo size={34} href={null} />
            <p className="mt-5 max-w-xs text-step--1 text-[#F2EDE4]/55">
              Approved plotted layouts in the northern coastal districts of
              Andhra Pradesh, developed and sold directly.
            </p>
            <p className="mt-5 text-step--1 text-[#F2EDE4]/70">
              <a className="tap-target transition-colors hover:text-[#F2EDE4]" href="tel:+919553513366">
                +91 95535 13366
              </a>
              <span className="mx-2 text-[#F2EDE4]/[0.62]">·</span>
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
                <h2 className="t-eyebrow text-[#F2EDE4]/60">
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
                        className="flex min-h-[44px] items-center text-step--1 text-[#F2EDE4]/[0.62] transition-colors hover:text-[#F2EDE4]"
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

        <div className={`mt-14 grid gap-8 border-t ${rule} pt-10 sm:grid-cols-3`}>
          {(['visakhapatnam', 'vizianagaram', 'srikakulam'] as const).map((id) => {
            const b = BRANCHES[id];
            return (
              <div key={b.id}>
                <p className="text-step--1 text-[#F2EDE4]/80">{b.name}</p>
                <p className="mt-0.5 text-step--2 uppercase tracking-[0.3em] text-[#D9B07A]/[0.78]">
                  {b.role === 'head_office' ? 'Head office' : 'Branch'}
                </p>
                <address className="mt-2 not-italic text-step--1 text-[#F2EDE4]/60">
                  {b.address} &ndash; {b.pincode}
                </address>
              </div>
            );
          })}
        </div>

        <div className={`mt-12 flex flex-wrap items-center gap-x-6 gap-y-4 border-t ${rule} pt-8`}>
          <p className="text-step--1 text-[#F2EDE4]/60">
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
                  className="tap-target text-step--1 text-[#F2EDE4]/60 transition-colors hover:text-[#F2EDE4]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ml-auto text-step--1 text-[#F2EDE4]/60">
            <PrivacyControl />
          </div>
        </div>
      </div>
    </footer>
  );
}
