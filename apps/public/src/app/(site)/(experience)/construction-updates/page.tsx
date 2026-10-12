// apps/public/src/app/(site)/(experience)/construction-updates/page.tsx
//
// ON THE GROUND: the "construction updates" of the plan of twenty-six pages.
//
// It was dropped by agreement on 2026-08-03, for a good reason: there is not
// one dated record of work on any of the three sites in anything supplied — no
// photograph, no completion note, no handover date — and a page of progress
// written from a brochure is the exact invention this codebase refuses. The
// client asked on 2026-10-06 for every page of the plan to be built, so it is
// built as the thing it can honestly be:
//
//   WHAT IS RECORDED TODAY   the register's count for each layout, and the
//                            branch that holds it
//   THE RECORD               dated photographs taken on the sites, when there
//                            are any (ENTRIES)
//   GO AND SEE               the visit, and where what to look at is set out
//
// NOTHING HERE SAYS WORK IS DONE, UNDER WAY OR DUE. "Laid", "completed",
// "handed over" and every date are words for a dated entry, and there are
// none. When the client supplies site photographs with their dates, they go in
// ENTRIES below and the page prints them, newest first, with no other change.
//
// AND IT DOES NOT SAY THAT IT SAYS NOTHING (the forensic audit of 2026-10-09,
// #85: "the pages talk about themselves ... and about what is missing ...
// 'None has been made yet.'"; #86: the roads, the approval and the five
// questions were each on three other pages word for word). A section with no
// entries is not on the page, as on every other page of the site; each
// layout's roads, approval and brochure list are on its own page, and the five
// things to look at are the guide's and the visit's. What is left is what only
// this page has: today's count, and the way to go and look.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { BRANCHES } from '@estate/domain/leads/branches';
import { Actions, Folio, Gilt, Go, Ledger, NextPage, Plate, Sheet, Window } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { LAYOUTS } from '@/lib/layouts';
import { countLine, publishedLayouts } from '@/lib/published';

export const metadata: Metadata = withShare('/construction-updates', {
  title: pageTitle('/construction-updates'),
  description:
    'How many plots Kartikeya Water Front, Lucky Garden and VSR Gayatri Township have and how many are open today, and how to walk each with its branch.',
});

/** A dated record from a site. Empty until the client supplies the first. */
interface Entry {
  /** ISO date the photograph was taken. */
  date: string;
  slug: string;
  note: string;
  photo: { src: string; w: number; h: number; alt: string };
}
const ENTRIES: Entry[] = [];

function day(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default async function OnTheGroundPage() {
  const next = pageAfter('/construction-updates');
  const live = await publishedLayouts();
  const entries = [...ENTRIES].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <RouteTelemetry routeId="construction-updates" />
      <Folio>
        <Plate
          kicker="The land"
          title={
            <>
              On the ground, <Gilt>today.</Gilt>
            </>
          }
          lede="How many plots each layout has and how many are open today, from the offices’ register. The roads and the plots themselves are best judged on a visit."
          cue={{ label: 'Today', href: '#today' }}
        />

        <Sheet
          id="today"
          rail="Today"
          first
          layout="full"
          kicker="In the register today"
          title={
            <>
              Three layouts, <Gilt>counted.</Gilt>
            </>
          }
        >
          <div className="folio-trio">
            {LAYOUTS.map((l) => {
              const count = countLine(live.find((p) => p.slug === l.slug));
              return (
                <section key={l.slug} aria-labelledby={`today-${l.slug}`}>
                  <h3 id={`today-${l.slug}`} className="folio-trio-name" data-reveal>
                    <Link href={`/projects/${l.slug}`}>{l.name}</Link>
                  </h3>
                  <p className="folio-kicker" data-reveal>
                    {l.where}
                  </p>
                  <div className="mt-6">
                    <Ledger
                      rows={[
                        ...(count ? [{ term: 'Plots', value: count }] : []),
                        {
                          term: 'Held by',
                          value: (
                            <Link className="folio-link" href={`/branches#${l.branch}`}>
                              The {BRANCHES[l.branch].name} branch
                            </Link>
                          ),
                        },
                      ]}
                    />
                  </div>
                </section>
              );
            })}
          </div>
        </Sheet>

        {entries.length > 0 ? (
          <Sheet
            id="record"
            rail="The record"
            raised
            kicker="The record"
            title={
              <>
                A date, and a photograph <Gilt>taken on the site.</Gilt>
              </>
            }
          >
            <ol className="folio-entries">
              {entries.map((e) => {
                const l = LAYOUTS.find((x) => x.slug === e.slug);
                return (
                  <li key={`${e.date}-${e.slug}`} data-reveal>
                    <p className="folio-kicker">
                      <time dateTime={e.date}>{day(e.date)}</time>
                      {l ? ` · ${l.name}` : ''}
                    </p>
                    <div className="folio-paper mt-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.photo.src} width={e.photo.w} height={e.photo.h} alt={e.photo.alt} loading="lazy" />
                    </div>
                    <p className="folio-caption">{e.note}</p>
                  </li>
                );
              })}
            </ol>
          </Sheet>
        ) : null}

        <Window gloss="Each open layout can be walked with the branch that holds it.">
          The quickest update <Gilt>is the land itself.</Gilt>
        </Window>

        <Sheet
          id="go-and-see"
          rail="Go and see"
          kicker="Go and see"
          title={
            <>
              Take the plan, <Gilt>and walk it.</Gilt>
            </>
          }
        >
          <Actions>
            <Go href="/book-a-site-visit">Arrange a site visit</Go>
            <Go href="/book-a-site-visit#on-the-day">What to look at on the day</Go>
            <Go href="/investment-guide#questions">Five questions to ask there</Go>
          </Actions>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
