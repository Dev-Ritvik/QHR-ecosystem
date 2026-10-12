// apps/public/src/app/(site)/(experience)/knowledge/page.tsx
//
// A FOLIO with a short plate, read from the study. The index for short factual
// pieces.
//
// Two are written and live, and the index is those two. (It also listed three
// that were not written, under "Three more, not yet good enough.": the forensic
// audit of 2026-10-09, #87, "four pages are, in substance, notices that the
// content is not there ... publish when there is something to publish". A
// piece is added to LIVE when it is written.)

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import { Folio, Gilt, IndexList, NextPage, Plate, Sheet } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = withShare('/knowledge', {
  title: pageTitle('/knowledge'),
  description:
    'Short, factual pieces on buying land in Vizianagaram and Srikakulam districts.',
});

const LIVE = [
  {
    href: '/investment-guide',
    title: 'Buying land in north coastal Andhra',
    blurb:
      'RERA registration, the four documents worth reading yourself, and what the new Bhogapuram airport changes.',
    minutes: 6,
  },
  {
    href: '/knowledge/reading-a-layout-plan',
    title: 'How to read a layout plan',
    blurb: 'Road widths, plot dimensions, open space and utility parcels: what to read on the drawing, and in what order.',
    minutes: 4,
  },
];

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const TENS = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty'];

export default function KnowledgePage() {
  const next = pageAfter('/knowledge');
  const minutes = LIVE.reduce((n, a) => n + a.minutes, 0);
  return (
    <>
      <RouteTelemetry routeId="knowledge" />
      <Folio>
        <Plate
          short
          kicker="Before you buy"
          title={
            <>
              Worth knowing <Gilt>before you buy.</Gilt>
            </>
          }
          lede="Short pieces on the parts of a land purchase that are easy to get wrong. Written to be useful even if you buy from someone else."
          cue={{ label: 'To read now', href: '#published' }}
        />

        <Sheet
          id="published"
          rail="To read now"
          first
          kicker="Published"
          title={
            <>
              {WORDS[LIVE.length] ?? LIVE.length} {LIVE.length === 1 ? 'piece' : 'pieces'},{' '}
              <Gilt>{minutes % 10 === 0 && TENS[minutes / 10] ? TENS[minutes / 10] : minutes} minutes.</Gilt>
            </>
          }
        >
          <IndexList
            items={LIVE.map((a) => ({
              href: a.href,
              name: a.title,
              line: a.blurb,
              meta: `${a.minutes} min read`,
            }))}
          />
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
