// apps/public/src/app/(site)/(experience)/start-here/page.tsx
//
// A FOLIO with a short plate. The deliberate way OUT of the cinematic.
//
// This route exists because the visitors who convert fastest are the ones the
// experience annoys most: somebody who already knows they want a 30×60 in
// Vizianagaram does not want a camera flight, they want the plan and a phone
// number. Without this, the 3D costs the client exactly the leads it was built
// to win.
//
// So: the shortest possible path to a plan, a price conversation, or a site
// visit. Its plate is the film's own cover, held still and by day — the page
// begins where the film does and then does not make anyone watch it — and the
// three layouts are the first thing under it. Nothing below needs the scene.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { Folio, Gilt, IndexList, NextPage, Plate, Prose, Sheet } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { COMPANY } from '@/lib/company';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';
import { LAYOUTS } from '@/lib/layouts';
import { countLine, publishedLayouts } from '@/lib/published';

export const metadata: Metadata = withShare('/start-here', {
  title: pageTitle('/start-here'),
  description:
    'The short version: three approved layouts in Vizianagaram and Srikakulam, the plans to download, and how to reach the office that holds each one.',
});

const PATHS = [
  {
    href: '/properties',
    label: 'I know the size I want',
    blurb: 'Plot sizes and road widths across all three layouts, side by side.',
  },
  {
    href: '/downloads',
    label: 'Give me the plans',
    blurb: 'All three approved layout plans as PDFs, ready to print or send on.',
  },
  {
    href: '/book-a-site-visit',
    label: 'I want to walk the land',
    blurb: 'Name a layout and a day, and its branch arranges the visit.',
  },
  {
    href: '/contact',
    label: 'I want to speak to someone',
    blurb: 'One enquiry, routed to the office that holds the layout you ask about.',
  },
  {
    href: '/investment-guide',
    label: 'I am checking this out first',
    blurb: 'What to verify before money moves, and what the new Bhogapuram airport changes.',
  },
];

export default async function StartHerePage() {
  const next = pageAfter('/start-here');
  const live = await publishedLayouts();
  return (
    <>
      <RouteTelemetry routeId="start-here" />
      <Folio>
        <Plate
          kicker="Before you buy"
          title={
            <>
              The short <Gilt>version.</Gilt>
            </>
          }
          lede="Plotted land in the northern coastal districts of Andhra Pradesh, sold from offices in Visakhapatnam, Vizianagaram and Srikakulam. Three layouts are open."
          cue={{ label: 'The three layouts', href: '#layouts' }}
        />

        <Sheet
          id="layouts"
          rail="The layouts"
          first
          kicker="What is open"
          title={
            <>
              The three <Gilt>approved layouts.</Gilt>
            </>
          }
          note="Each is shown by its approved drawing."
        >
          <IndexList
            items={LAYOUTS.map((l) => ({
              href: `/projects/${l.slug}`,
              name: l.name,
              line: (
                <>
                  {l.where}, {l.district} district. {l.sizes.map((s) => s.label).join(', ')}.
                </>
              ),
              meta: countLine(live.find((p) => p.slug === l.slug)),
            }))}
          />
        </Sheet>

        <Sheet
          id="ways"
          rail="Where to go"
          kicker="From here"
          title={
            <>
              Where do you <Gilt>want to go?</Gilt>
            </>
          }
        >
          <IndexList two items={PATHS.map((p) => ({ href: p.href, name: p.label, line: p.blurb }))} />
        </Sheet>

        <Sheet
          id="directly"
          rail="Directly"
          kicker="Or directly"
          title={
            <>
              Telephone <Gilt>or write.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              Telephone <a href={COMPANY.phone.href}>{COMPANY.phone.display}</a>, or write to{' '}
              <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.
            </p>
            <p>
              Prefer to look around? The three layouts stand as raised models in{' '}
              <Link href="/hall">the hall</Link>, and <Link href="/">the film</Link> walks you up
              to them.
            </p>
          </Prose>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
