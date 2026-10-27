// apps/public/src/app/(site)/(experience)/book-a-site-visit/page.tsx
//
// BOOK A SITE VISIT: the page the whole site points at, and did not have.
//
// The film ends on "The land is best seen from the land" and one action,
// "Arrange a site visit"; the FAQ answers "Can I visit the site?" with "ask
// through the enquiry form"; the route registry has named this page since the
// surface system was written. All three led to /contact, whose form asked for
// neither a layout nor a day.
//
// IT IS THE ENQUIRY FORM, ASKED DIFFERENTLY (enquiry-form.tsx, `visit`): which
// layout, which day, what time of day, then a name and a number. It goes down
// the same signed path to the same CRM, as an enquiry whose first line says it
// is a visit and for when (enquiryMessage.ts) — the CRM has no separate record
// for a visit, and inventing one here would be a second system to keep true.
//
// WHAT THE PAGE PROMISES IS WHAT THE SITE ALREADY DID: that the branch which
// holds the layout arranges the visit and takes you over it. No time to reply
// in, no transport, no hours: none of those is in anything the client has
// supplied. The day a visitor names is a request, and the page says so.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { BRANCHES } from '@estate/domain/leads/branches';
import {
  Actions,
  Folio,
  Gilt,
  Go,
  IndexList,
  NextPage,
  Plate,
  Prose,
  Sheet,
  Step,
  Steps,
  Window,
} from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { COMPANY } from '@/lib/company';
import { LAYOUTS, layoutBySlug } from '@/lib/layouts';
import { publishedLayouts } from '@/lib/published';
import { EnquiryForm } from '../../enquiry-form';

export const metadata: Metadata = withShare('/book-a-site-visit', {
  title: pageTitle('/book-a-site-visit'),
  description:
    'Name a layout and a day. The branch that holds it — Vizianagaram or Srikakulam — arranges the visit and walks you over the land.',
});

export default async function BookASiteVisitPage() {
  const next = pageAfter('/book-a-site-visit');
  const live = await publishedLayouts();
  const choices = live
    .filter((p) => !p.soldOut)
    .map((p) => {
      const l = layoutBySlug(p.slug);
      return { id: p.projectId, name: p.name, where: l ? `${l.where}, ${l.district}` : '' };
    });
  return (
    <>
      <RouteTelemetry routeId="book-a-site-visit" />
      <Folio>
        <Plate
          kicker="Come and see"
          title={
            <>
              Walk it <Gilt>before you decide.</Gilt>
            </>
          }
          lede="Name a layout and a day. The branch that holds it will take you there."
          cue={{ label: 'Ask for a day', href: '#ask' }}
        />

        <Sheet
          id="ask"
          rail="Ask for a day"
          first
          kicker="The visit"
          title={
            <>
              Ask for <Gilt>a visit.</Gilt>
            </>
          }
          note="The day you name is a request. The branch telephones to fix it."
        >
          <EnquiryForm visit layouts={choices} />
        </Sheet>

        <Sheet
          id="on-the-day"
          rail="On the day"
          raised
          kicker="On the day"
          title={
            <>
              What to do <Gilt>on the ground.</Gilt>
            </>
          }
        >
          <Steps>
            <Step title="Take the plan">
              <p>
                Print the layout&rsquo;s sheet, or have it on your telephone. It is the document the
                ground is to be checked against.
              </p>
              <p className="mt-3">
                <Go href="/downloads">The three plans</Go>
              </p>
            </Step>
            <Step title="Find your plot by its number">
              <p>
                Look for its number marked on the ground. Stand on the plot you are considering,
                and pace its frontage.
              </p>
            </Step>
            <Step title="Stand in the road">
              <p>
                Pace it against the width printed in it on the sheet, and see how much of it is
                laid.
              </p>
            </Step>
            <Step title="Ask what is in writing">
              <p>
                Drainage, the water connection, the amenities, and who maintains the common areas
                afterwards: ask which of them the agreement commits to.
              </p>
              <p className="mt-3">
                <Go href="/investment-guide#questions">The five questions, in the guide</Go>
              </p>
            </Step>
          </Steps>
        </Sheet>

        <Window gloss="Every open layout can be walked.">
          The land is best seen <Gilt>from the land.</Gilt>
        </Window>

        <Sheet
          id="where"
          rail="Where you will go"
          kicker="Where you will go"
          title={
            <>
              The layouts <Gilt>you can walk.</Gilt>
            </>
          }
          note="Each layout is shown by the branch that holds it."
        >
          <IndexList
            items={LAYOUTS.map((l) => ({
              href: `/locations#${l.slug}`,
              name: l.name,
              line: (
                <>
                  {l.where}, {l.district} district
                </>
              ),
              meta: `${BRANCHES[l.branch].name} branch`,
            }))}
          />
          <div className="mt-12">
            <Prose>
              <p>
                Rather telephone? The head office is on{' '}
                <a href={COMPANY.phone.href}>{COMPANY.phone.display}</a>, and will pass you to the
                branch. The addresses of all three offices are on{' '}
                <Link href="/branches">the offices page</Link>.
              </p>
            </Prose>
          </div>
          <Actions>
            <Go href="/locations">How each site is reached</Go>
          </Actions>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
