// apps/public/src/app/(site)/(experience)/properties/page.tsx
//
// A FOLIO, read from the first table.
//
// Plot SIZES are published here because they are printed on the approved layout
// plans and do not change. How many plots each layout has, and how many are
// open, is read from the offices' register as the film reads it
// (lib/published.ts). Which plots those are, and what they cost, is not here,
// and the page says why.
//
// NOT PER SIZE. The register's split of a layout's plots by size is a
// placeholder until the client's plot register arrives, so no count stands
// against a size: a size is offered by a layout, and the layout has a count.
//
// The areas are arithmetic on the printed dimensions (nine square feet to the
// square yard), given because a buyer compares in square yards and the sheets
// print feet.
//
// WHAT A ROAD'S WIDTH DECIDES IS THE ARTICLE'S (the forensic audit of
// 2026-10-09, #86: three sentences of this page's "the road in front" stood
// word for word in "How to read a layout plan"; #85: "Why the width is on this
// page.", "Neither is published on this site."). This page keeps the table
// and says where the reasoning is.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import {
  Actions,
  Folio,
  Gilt,
  Go,
  IndexList,
  NextPage,
  Note,
  Plate,
  Prose,
  Sheet,
  Table,
  Window,
} from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { LAYOUTS, plotArea } from '@/lib/layouts';
import { countLine, publishedLayouts } from '@/lib/published';

export const metadata: Metadata = withShare('/properties', {
  title: pageTitle('/properties'),
  description:
    'Every plot size across Kartikeya Water Front, Lucky Garden and VSR Gayatri Township, with its area and the road it stands on, off the approved plans.',
});

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

/** Every size on offer, smallest first, with the layout that offers it. */
const SIZES = LAYOUTS.flatMap((l) =>
  l.sizes.map((s) => ({ ...s, ...plotArea(s), layout: l })),
).sort((a, b) => a.sqFt - b.sqFt || a.layout.name.localeCompare(b.layout.name));

const yd = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default async function PropertiesPage() {
  const next = pageAfter('/properties');
  const live = await publishedLayouts();
  return (
    <>
      <RouteTelemetry routeId="properties" />
      <Folio>
        <Plate
          kicker="The land"
          title={
            <>
              {WORDS[SIZES.length] ?? SIZES.length} plot sizes, <Gilt>measured off the plans.</Gilt>
            </>
          }
          lede="Sizes and road widths are taken from the approved layout plans, so they are exact."
          cue={{ label: 'Every size', href: '#sizes' }}
        />

        <Sheet
          id="sizes"
          rail="Every size"
          first
          layout="full"
          kicker="Every size"
          title={
            <>
              From 100 sq yd <Gilt>to 200.</Gilt>
            </>
          }
        >
          <Table
            head={['Plot', 'Sq ft', 'Sq yd', 'Layout', 'On']}
            numeric={[1, 2]}
            rows={SIZES.map((s) => [
              s.label,
              s.sqFt.toLocaleString('en-IN'),
              yd(s.sqYd),
              <Link key="l" className="folio-link" href={`/projects/${s.layout.slug}`}>
                {s.layout.name}
              </Link>,
              <>{s.layout.roadWidths.map((w) => `${w}′`).join(' and ')} roads</>,
            ])}
            caption="Frontage by depth, in feet, as each sheet prints it. Areas are worked from those figures."
          />
          <Note className="mt-10">
            These are the regular plots. Where a layout meets its boundary the plots take the
            boundary&rsquo;s line, each with a size of its own: read those off{' '}
            <Link href="/gallery">the plan itself</Link>.
          </Note>
        </Sheet>

        <Sheet
          id="by-layout"
          rail="By layout"
          kicker="By layout"
          title={
            <>
              Where each size <Gilt>is to be had.</Gilt>
            </>
          }
          note="And how many plots the layout has, from the offices’ register."
        >
          <IndexList
            items={LAYOUTS.map((l) => ({
              href: `/projects/${l.slug}`,
              name: l.name,
              line: (
                <>
                  {l.sizes.map((s) => s.label).join(', ')}, on{' '}
                  {l.roadWidths.map((w) => `${w} ft`).join(' and ')} roads.
                </>
              ),
              meta: countLine(live.find((p) => p.slug === l.slug)),
            }))}
          />
        </Sheet>

        <Window gloss="Its width is printed on the plan, in the road itself.">
          Read the road <Gilt>before the plot.</Gilt>
        </Window>

        <Sheet
          id="the-road"
          rail="The road in front"
          kicker="The road in front"
          title={
            <>
              Why the road&rsquo;s width <Gilt>is in the table.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              Every internal road on a sanctioned plan carries a stated width, and it is worth as
              much attention as the plot.
            </p>
            <p>
              <Link href="/knowledge/reading-a-layout-plan">How to read a layout plan</Link> sets
              out what a road&rsquo;s width decides, and why two plots of the same area can differ
              in what may be built on them.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="what-is-free"
          rail="What is free"
          raised
          kicker="Which plots, and what price"
          title={
            <>
              Ask the branch <Gilt>that holds the layout.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              They will tell you which plot numbers are open that day, with the current price for
              the size you want.
            </p>
            <p>Both change from week to week, so the branch gives them for the day you ask.</p>
          </Prose>
          <Actions>
            <Go href="/contact">Ask about availability</Go>
            <Go href="/book-a-site-visit">Arrange a site visit</Go>
          </Actions>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
