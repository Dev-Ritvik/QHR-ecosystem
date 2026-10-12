// apps/public/src/app/(site)/(experience)/locations/page.tsx
//
// A FOLIO, read from the map table. Every landmark, road and distance below is
// printed on one of the three brochures — the Kartikeya sheet carries its own
// access map and nearby temples, the Gayatri brochure lists the institutions
// around it and its distance to the National Highway. (lib/layouts.ts keeps
// them, with the account of where each came from.)
//
// No distance, travel time or price has been estimated. Where a brochure states
// a figure it is quoted; where it does not, nothing is claimed.
//
// THE ONE PLACE THE ROADS TO A LAYOUT ARE SET OUT (the forensic audit of
// 2026-10-09, #86: this page and each layout's own printed the same lists and
// the same branch address, word for word; #85: a band that read "No distance
// on this page has been estimated."). Each layout's page points here for how
// it is reached; this page points to the offices for an address, and says
// what is here without a band on what is not.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { BRANCHES } from '@estate/domain/leads/branches';
import {
  Actions,
  Folio,
  Gilt,
  Go,
  List,
  NextPage,
  Plate,
  Prose,
  Sheet,
} from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { LAYOUTS } from '@/lib/layouts';

export const metadata: Metadata = withShare('/locations', {
  title: pageTitle('/locations'),
  description:
    'Where the three layouts sit: Poosapatirega and Garividi in Vizianagaram district, and Bayyannapeta near Allinagaram in Srikakulam.',
});

export default function LocationsPage() {
  const next = pageAfter('/locations');
  return (
    <>
      <RouteTelemetry routeId="locations" />
      <Folio>
        <Plate
          kicker="The land"
          title={
            <>
              Where the ground <Gilt>actually is.</Gilt>
            </>
          }
          lede="Poosapatirega and Garividi in Vizianagaram district. Bayyannapeta, near Allinagaram, in Srikakulam."
          cue={{ label: LAYOUTS[0].where, href: `#${LAYOUTS[0].slug}` }}
        />

        {LAYOUTS.map((l, i) => {
          const office = BRANCHES[l.branch];
          return (
            <Sheet
              key={l.slug}
              id={l.slug}
              rail={l.where.split(',')[0]}
              first={i === 0}
              raised={i % 2 === 1}
              kicker={`${l.district} district`}
              title={
                <>
                  {l.where.split(',')[0]}
                  <Gilt>.</Gilt>
                </>
              }
              note={
                <>
                  {l.name}
                  {l.where.includes(',') ? <>, {l.where.split(',').slice(1).join(',').trim()}</> : null}.
                </>
              }
            >
              <h3 className="folio-sub" data-reveal>
                Getting there
              </h3>
              <List items={[...l.access]} />

              {l.near.map((group) => (
                <div key={group.label} className="mt-12">
                  <h3 className="folio-sub" data-reveal>
                    {group.label} nearby, as the brochure names them
                  </h3>
                  <ul className="folio-run" data-reveal>
                    {group.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="mt-12">
                <h3 className="folio-sub" data-reveal>
                  Held by
                </h3>
                <p className="folio-standfirst is-small" data-reveal>
                  <Link className="folio-link" href={`/branches#${l.branch}`}>
                    The {office.name} {office.role === 'head_office' ? 'head office' : 'branch'}
                  </Link>
                  , which gives its open plot numbers and the day&rsquo;s rate.
                </p>
              </div>

              <Actions>
                <Go href={`/projects/${l.slug}`}>The layout</Go>
                <Go href="/book-a-site-visit">Go and see it</Go>
              </Actions>
            </Sheet>
          );
        })}

        <Sheet
          id="the-airport"
          rail="The airport"
          kicker="What is changing nearby"
          title={
            <>
              The new airport, <Gilt>at Bhogapuram.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              Bhogapuram &mdash; Alluri Sitarama Raju International Airport &mdash; is in Vizianagaram
              district, and all three layouts sit in the two districts around it.
            </p>
            <p>
              <Link href="/investment-guide">The guide</Link> sets out what it changes for a buyer
              on this stretch of coast, with its sources.
            </p>
          </Prose>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
