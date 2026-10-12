// apps/public/src/app/(site)/(experience)/sitemap/page.tsx
//
// THE SITEMAP A PERSON READS (the machine's is app/sitemap.ts, at
// /sitemap.xml).
//
// The plan of twenty-six pages has had it from the start and the route
// registry has named it; there was no page. It is the one place where the
// whole site is on a single sheet, in the order it is meant to be read, with a
// line about each page — which is also what a visitor who has lost a page
// wants, and what a screen-reader user can take in faster than a menu.
//
// NOTHING IS LISTED HERE BY HAND. The parts and their pages are siteMap.ts's
// (the menu's and the footer's own list), the layouts are lib/layouts.ts's,
// and the film's chapters are the anchors its page carries. A page added to
// the site map is on this page the same day; a test holds every address here
// to a page that exists.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import { Folio, Gilt, IndexList, Plate, Sheet } from '@/components/folio/Folio';
import { SITE_PARTS, SITE_SMALL_PRINT, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { LAYOUTS } from '@/lib/layouts';

export const metadata: Metadata = withShare('/sitemap', {
  title: pageTitle('/sitemap'),
  description: 'Every page of the site on one sheet, in the order it is meant to be read.',
});

/** The film's chapters a visitor can be sent to, by their anchors. */
const FILM = [
  { href: '/', name: 'The film', line: 'The whole site as one walk: up to the house, through its hall, to the map of the districts.' },
  { href: '/#holdings', name: 'The count', line: 'How many plots are drawn, and how many are open.' },
  { href: '/#establish', name: 'The hall', line: 'In at the door, and the three tables.' },
  { href: '/#portrait', name: 'The portrait', line: 'The Managing Director, above the stair.' },
  { href: '/#city', name: 'The districts', line: 'Where the three layouts are, on the map table.' },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export default function SitemapPage() {
  return (
    <>
      <RouteTelemetry routeId="sitemap" />
      <Folio>
        <Plate
          short
          kicker="Sitemap"
          title={
            <>
              Every page, <Gilt>on one sheet.</Gilt>
            </>
          }
          lede="Every page in the order it is meant to be read, with a line about each."
          cue={{ label: 'The film', href: '#film' }}
        />

        <Sheet
          id="film"
          rail="The film"
          first
          kicker="First"
          title={
            <>
              The film, <Gilt>and where to step into it.</Gilt>
            </>
          }
        >
          <IndexList two items={FILM} />
        </Sheet>

        {SITE_PARTS.map((part, i) => (
          <Sheet
            key={part.title}
            id={part.title.toLowerCase().replace(/[^a-z]+/g, '-')}
            rail={part.title}
            raised={i % 2 === 0}
            kicker={`Part ${ROMAN[i] ?? i + 1}`}
            title={part.title}
            note={part.line}
          >
            <IndexList
              two
              items={[
                ...part.pages.map((p) => ({ href: p.href, name: p.name, line: p.line })),
                // The three layouts' own pages belong to the land, under its index.
                ...(part.pages.some((p) => p.href === '/projects')
                  ? LAYOUTS.map((l) => ({
                      href: `/projects/${l.slug}`,
                      name: l.name,
                      line: `${l.where}, ${l.district} district.`,
                    }))
                  : []),
              ]}
            />
          </Sheet>
        ))}

        <Sheet
          id="small-print"
          rail="The small print"
          kicker="Last"
          title={
            <>
              The small print, <Gilt>in full.</Gilt>
            </>
          }
        >
          <IndexList
            two
            items={SITE_SMALL_PRINT.filter((p) => p.href !== '/sitemap').map((p) => ({
              href: p.href,
              name: p.name,
              line: p.line,
            }))}
          />
        </Sheet>
      </Folio>
    </>
  );
}
