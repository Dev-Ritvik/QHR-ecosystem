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
// film's closing picture (FilmColophon, below), in the film's own type.
//
// AND EVERY OTHER PAGE ENDS AS THE FILM DOES (the client, 2026-10-06: "make
// sure everything gives the same vibe / no page must feel left out"). They
// kept the plain footer for a long time: a navy block, a logo, three columns
// of links, three addresses — the bottom of a website, under pages that had
// meanwhile become rooms of a house. A page's footer is its colophon now
// (PageColophon): the film's own sign-off and its one action, the three
// offices under their roles, and then the whole site set out as a contents
// page (siteMap.ts), in the film's type on the hall's dark.


import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PrivacyControl } from '@/components/consent/ConsentPanel';
import { BRANCHES } from '@estate/domain/leads/branches';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';
import { withPin } from '@/lib/units';
import { SITE_PARTS, SITE_SMALL_PRINT } from './siteMap';

/**
 * ONE FOOTER, IN TWO SETTINGS (the forensic audit of 2026-10-09, #58 and
 * #91). The film's colophon kept a list of its own — twelve pages of the
 * eighteen, under names of its own ("Layout plans", "Gallery", "Investment
 * guide", "Testimonials"), with four of the five pages of small print — so
 * the one component a visitor meets on every page was a different component
 * on the home page, with no way from it to the layouts, the offices, the
 * hall, the enquiry or the sitemap. Both colophons are made from the one
 * list now (siteMap.ts): the same four parts, the same eighteen pages by the
 * same names, the same five of small print, the same three offices under the
 * same labels. What differs is the setting, and only that: the film's is its
 * last frame, set over the picture in the film's own measure, its sign-off
 * the largest line on the site and held; a page's is its last sheet.
 */

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
 *
 * AND A HIERARCHY IN THE SMALL MATTER (the audit of 2026-10-05, P1: "the
 * footer is one size and weight throughout. Done when ... the footer uses the
 * same hierarchy, gold accent and spacing as the rest (office names clearly
 * above addresses; links clearly secondary)"). One voice had become one
 * level: a town, its street and a link to the gallery all weighed the same.
 * The film's own three levels now, and nothing new: each office is a NAME at
 * the supporting line's size under its role as a gilt label in the tracked
 * capitals of the figures' labels, with the address small beneath it; the
 * links are the small size at a lower strength, a clear step under the
 * offices; the legal line is the least. The sign-off is still the largest
 * type on the site (--end), and the spaces are the film's baselines.
 */
function FilmColophon({ year }: { year: number }) {
  return (
    <footer id="visit" className="film-stage relative z-10">
      <div data-chapter-fade="lines" className="px-[var(--edge)] pb-14 pt-[26vh] low:pb-6">
        <h2 className="sr-only">Visit</h2>
        {/* THE SIGN-OFF IS HELD ON A WIDE FRAME (the audit of 2026-10-05, P0:
            "arrive, then speak"; P1: "the table stays grounded on its floor
            as the lights go down ... 'The land is best seen from the land.'
            is the largest type on the site"). Made the largest, its first
            line reaches three-fifths of the way across a 1920x945 frame and
            three-quarters of a 16:10 one, and the map table stands from 54
            to 83% (codaFrame.ts): it rode up through the table, and the lens
            closed over the whole picture for as long as that took (measured:
            from the line's top at 57% of the height to the header, a notch
            and a half of black with the table a ghost in it).

            So it comes to rest UNDER the table instead — pinned with its top
            three-fifths of the way down the frame, clear of the table's foot
            (at 52%) by more than the lens's reach — and holds there for
            seven-tenths of a frame of scroll, the last frame of the film as
            it was composed: the table lit on its floor above, the line
            below. It dissolves in place over the hold's last half notch
            (ChapterFade, HOLD_ATTR), as every chapter's copy does, and the
            small matter comes up after it. The lens never closes on a wide
            frame now.

            AND ON A TABLET HELD UPRIGHT (`held:` is both: tailwind.config).
            It is laid out as a phone is, but the table stands beside the
            sign-off there, and at the larger size the sign-off's first line
            reaches two-thirds of the way across: the page ENDED with the
            line on the table and the lens closed (the suite's last-frame
            test caught it). A phone is as it was: the table above, the lines
            riding through, the lens their credits. */}
        <div>
          <p data-line data-hold data-reveal className="t-end text-[#F2EDE4] held:sticky held:top-[60vh]">
            The land is best seen
            <br />
            <span className="t-gilt">from the land.</span>
          </p>
          <div aria-hidden className="hidden held:block held:h-[70vh]" />
        </div>
        <p data-line className="t-hero-lede mt-6 max-w-[40ch] text-[#F2EDE4]/90">
          Every open layout can be walked. The branch that holds it will take
          you there.
        </p>
        <div data-line className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
          {/* To the page for it (2026-10-06). It went to /contact, whose form
              asked for neither a layout nor a day: the film's one action led
              to a page that could not take it. */}
          <Link href="/book-a-site-visit" className="cta-primary">
            Arrange a site visit
          </Link>
          <a
            href="tel:+919553513366"
            className="t-small tap-target press-row text-[#F2EDE4]/90 transition-colors hover:text-[#F2EDE4]"
          >
            +91 95535 13366
          </a>
        </div>

        {/* THE SMALL MATTER, IN ONE VOICE, a long way under the sign-off. */}
        <div className="mt-[24vh] grid gap-x-[calc(var(--bl)*14)] gap-y-8 sm:grid-cols-3">
          {(['visakhapatnam', 'vizianagaram', 'srikakulam'] as const).map((id) => {
            const b = BRANCHES[id];
            return (
              <div data-line key={b.id}>
                <p className="t-eyebrow t-gilt">{b.role === 'head_office' ? 'Head office' : 'Branch'}</p>
                <p className="t-support mt-2 text-[#F2EDE4]">{b.name}</p>
                <address className="t-small mt-2 max-w-[34ch] not-italic text-[#F2EDE4]/90">
                  {withPin(b.address, b.pincode)}
                </address>
              </div>
            );
          })}
        </div>

        {/* EVERY PAGE, BY ITS PART: the four parts the menu and every other
            page's colophon have, each a line here — its name, then its
            pages — where a page's colophon sets them as four columns. A line
            a part, because this is a picture's last frame and not a sheet:
            four lines stand under the offices in the dark of the court's
            floor, where four columns six rows deep would have climbed into
            the lit table beside the sign-off. (It was two rows of six links
            with no parts, and six pages short.) */}
        {/* (On a low frame — tailwind's `low:`, a 13-inch laptop's window —
            the spaces under the offices close up, so the offices stand under
            the map table's foot and not at it.) */}
        <nav aria-label="Every page" className="colophon-parts mt-[calc(var(--bl)*12)] low:mt-[calc(var(--bl)*7)]">
          {SITE_PARTS.map((part) => (
            <div key={part.title} className="colophon-part">
              <h3 data-line className="t-eyebrow t-gilt colophon-part-title">
                {part.title}
              </h3>
              <ul className="colophon-part-pages">
                {part.pages.map((l) => (
                  <li data-line key={l.href}>
                    <Link href={l.href} className="colophon-link">
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* (The control at its row's own strength: at 60% it was the one line
            of the colophon under AA where the stone is at its lightest —
            measured at 390x844: 3.98:1 on a p90 luma of 72.) */}
        <LegalRow year={year} className="t-small mt-4 text-[#F2EDE4]/[0.72]" line />
      </div>
    </footer>
  );
}

/**
 * THE LEGAL LINE, the same in both colophons: whose site it is and the
 * address the offices read; the five pages of small print; and the control
 * that reopens a visitor's own choices. One row on a wide frame, the control
 * at its far end. On a phone, three lines — who, the small print, the choices
 * — where the row used to wrap wherever its words happened to run out (the
 * forensic audit of 2026-10-09, #116: "three uneven lines"), and every word
 * that can be pressed is a row a thumb is sure of (#117).
 */
function LegalRow({ year, className, line }: { year: number; className: string; line?: boolean }) {
  return (
    <div data-line={line ? '' : undefined} className={'colophon-legal ' + className}>
      <span className="colophon-legal-own">
        <span>&copy; {year} Quality Homes Reality</span>
        <a className="colophon-legal-link" href={CONTACT_MAILTO}>
          {CONTACT_EMAIL}
        </a>
      </span>
      <span className="colophon-legal-print">
        {SITE_SMALL_PRINT.map((l) => (
          <Link key={l.href} href={l.href} className="colophon-legal-link">
            {l.name}
          </Link>
        ))}
      </span>
      <span className="colophon-legal-choices">
        <PrivacyControl className="colophon-legal-link" />
      </span>
    </div>
  );
}

/**
 * A PAGE'S COLOPHON. The film's ending without the film: the sign-off a step
 * under the film's (it is a page's last line here, not a picture's), the one
 * action and the telephone number beside it; the three offices, each a name
 * under its role; then every page of the site by its part, as the menu has
 * them; and the legal line. On the sheets' own ground, off the frame's own
 * edge, so it is the page's last sheet and not a block under the page.
 */
function PageColophon({ year, pathname }: { year: number; pathname: string }) {
  return (
    <footer className="folio folio-colophon relative z-10">
      <div className="folio-colophon-sign">
        <p className="t-d2 text-[#F2EDE4]">
          The land is best seen
          <br />
          <span className="t-gilt">from the land.</span>
        </p>
        <p className="folio-next-line">
          Every open layout can be walked. The branch that holds it will take
          you there.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
          <Link href="/book-a-site-visit" className="cta-primary">
            Arrange a site visit
          </Link>
          <a
            href="tel:+919553513366"
            className="tap-target press-row text-step-0 text-[#F2EDE4]/90 transition-colors hover:text-[#E8B98A]"
          >
            +91 95535 13366
          </a>
        </div>
      </div>

      <div className="folio-colophon-offices">
        {(['visakhapatnam', 'vizianagaram', 'srikakulam'] as const).map((id) => {
          const b = BRANCHES[id];
          return (
            <div key={b.id}>
              <p className="folio-kicker">{b.role === 'head_office' ? 'Head office' : 'Branch'}</p>
              <p className="mt-1 text-step-2 text-[#F2EDE4]">{b.name}</p>
              <address className="mt-2 max-w-[34ch] not-italic text-step-0 text-[#F2EDE4]/[0.8]">
                {withPin(b.address, b.pincode)}
              </address>
            </div>
          );
        })}
      </div>

      <nav aria-label="Every page" className="folio-colophon-map">
        {SITE_PARTS.map((part) => (
          <div key={part.title}>
            <h3 className="folio-kicker">{part.title}</h3>
            {/* Real 44px rows on a touch screen rather than an invisible
                expander: these are stacked, so a pseudo element would overlap
                its neighbours and the wrong link would take the tap. */}
            <ul className="mt-2">
              {part.pages.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={pathname === l.href ? 'page' : undefined}
                    className={
                      'flex min-h-[44px] items-center text-step-0 transition-colors hover:text-[#E8B98A] md:min-h-[2.1rem] ' +
                      (pathname === l.href ? 'text-[#E8B98A]' : 'text-[#F2EDE4]/[0.8]')
                    }
                  >
                    {l.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <LegalRow year={year} className="folio-colophon-legal" />
    </footer>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  const pathname = usePathname() || '/';
  const overFilm = pathname === '/' || pathname === '/site-home';
  if (overFilm) return <FilmColophon year={year} />;
  return <PageColophon year={year} pathname={pathname} />;
}
