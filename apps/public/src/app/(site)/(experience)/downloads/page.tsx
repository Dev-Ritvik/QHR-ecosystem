// apps/public/src/app/(site)/(experience)/downloads/page.tsx
//
// A FOLIO with a short plate, read from the study.
//
// Only the three layout plans are offered, because they are the only documents
// we hold. Brochures, price lists and approval certificates are deliberately
// absent rather than listed as "coming soon" — a download page whose links do
// not resolve is worse than a short one.
//
// Note the file sizes are stated. A buyer on a metered connection in
// Vizianagaram deserves to know before tapping, and it costs one line.
//
// (It said the plans were "sized to print at A3". They are not: the files are
// the sheets as supplied, on pages of their own sizes, the smallest under four
// inches across. They are small enough to send on, and that is what it says.)

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { Folio, Gilt, IndexList, NextPage, Plate, Prose, Sheet } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { LAYOUTS } from '@/lib/layouts';

export const metadata: Metadata = withShare('/downloads', {
  title: pageTitle('/downloads'),
  description:
    'The approved layout plans of Kartikeya Water Front, Lucky Garden and VSR Gayatri Township, as files small enough to send on.',
});

export default function DownloadsPage() {
  const next = pageAfter('/downloads');
  return (
    <>
      <RouteTelemetry routeId="downloads" />
      <Folio>
        <Plate
          short
          kicker="The land"
          title={
            <>
              Take the plans <Gilt>with you.</Gilt>
            </>
          }
          lede="The three approved layout plans, as files small enough to send on."
          cue={{ label: 'The files', href: '#files' }}
        />

        <Sheet
          id="files"
          rail="The files"
          first
          kicker="Three files"
          title={
            <>
              One sheet <Gilt>a layout.</Gilt>
            </>
          }
          note="Each is the sanctioned drawing, as a PDF. Its size is stated, for a metered connection."
        >
          <IndexList
            items={LAYOUTS.map((l) => ({
              href: l.plan.pdf,
              download: true,
              name: l.name,
              line: (
                <>
                  {l.where}, {l.district}. {l.approval.line}. Plots of{' '}
                  {l.sizes.map((s) => s.label).join(', ')}.
                </>
              ),
              meta: `PDF · ${l.plan.pdfSize}`,
            }))}
          />
        </Sheet>

        <Sheet
          id="on-request"
          rail="On request"
          kicker="Not here"
          title={
            <>
              The papers for <Gilt>one plot.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              Title documents, encumbrance certificates and the approval papers for a specific plot
              are shared on request, for the plot you are considering.
            </p>
            <p>
              Ask the branch handling your enquiry. What to check in them is in{' '}
              <Link href="/investment-guide">the guide</Link>.
            </p>
            <p>
              To read a sheet before you print it, <Link href="/gallery">the plans are set out at
              full size</Link>; and <Link href="/knowledge/reading-a-layout-plan">this short piece</Link>{' '}
              goes through one in the order worth reading it.
            </p>
          </Prose>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
