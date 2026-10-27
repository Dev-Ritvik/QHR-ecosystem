// apps/public/src/app/(site)/(experience)/why-us/page.tsx
//
// A FOLIO, read from the approach.
//
// The placeholder this replaces promised two things the site does not do:
// "status is drawn live from our records — what you see is what remains", and
// "rates are computed from a published basis". Neither was true, and a
// differentiators page that describes features we decided against is worse
// than no page, because every one of those claims is checkable in about four
// seconds.
//
// So each claim below is one this build actually keeps, and can be verified
// from the site itself without asking anyone.
//
// WHAT CHANGED ON 2026-10-11 (the forensic audit of 2026-10-09, #84 and #85).
// The page was the heaviest on the site in one construction: "Proof, not
// persuasion.", "The approved plan, not an impression", "Offices in the
// district, not a call centre", "Not a starting price, not a range, not a rate
// per sq yd." — eight of them in five hundred words ("one is a voice;
// thirty-seven is a tic") — and it ended in a whole section on what the site
// leaves out ("What this site does not say."), which the audit read as "written
// to a brief about trust instead of by a company with things to show". Each of
// the five is said plainly now, as what the company does; the one turn kept is
// the band's, which is advice a buyer can use anywhere. The section of
// absences is gone: the count is on the layouts' page, where a rate comes from
// is the third of the five and the price question in the FAQ, and the airport
// is the guide's.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import { plotSize } from '@/lib/units';
import { Folio, Gilt, Go, NextPage, Plate, Sheet, Step, Steps, Window } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = withShare('/why-us', {
  title: pageTitle('/why-us'),
  description:
    'Approved plans published in full, offices in the districts where the land is, and a rate quoted by the branch for the day you ask.',
});

interface Claim {
  title: string;
  body: string;
  proof: { label: string; href: string };
}

const CLAIMS: Claim[] = [
  {
    title: 'The approved plan, published in full',
    body:
      'Each layout is published as its sanctioned drawing, with its approval beside it: SUDA F.L.P. No. 10/2025/1178/DTCP/DPMS for VSR Gayatri Township, a VMRDA layout for Kartikeya Water Front. Download the full sheet and take it to the sub-registrar’s office before you speak to anyone.',
    proof: { label: 'Download the plans', href: '/downloads' },
  },
  {
    title: 'Offices in the districts',
    body:
      'Visakhapatnam, Vizianagaram and Srikakulam. An enquiry about a layout goes to the branch that holds it, and is answered by the people who work on that ground.',
    proof: { label: 'See the offices', href: '/branches' },
  },
  {
    title: 'A rate quoted for the day',
    body:
      'Land rates move. The branch that holds a layout quotes the rate for the size you want on the day you ask, with the plots that are free.',
    proof: { label: 'Ask about a layout', href: '/contact' },
  },
  {
    title: 'Sizes stated exactly',
    body:
      `Plot dimensions and road widths come off the approved plan, so ${plotSize(30, 60)} means thirty feet by sixty, and the road in front of your plot is the width the sanction gives it.`,
    proof: { label: 'Compare the sizes', href: '/properties' },
  },
  {
    title: 'We develop what we sell',
    body:
      'The layouts are Quality Homes Reality’s own, developed and managed directly. When something needs fixing, the company that sold you the plot is the one that answers.',
    proof: { label: 'About the company', href: '/about' },
  },
];

export default function WhyUsPage() {
  const next = pageAfter('/why-us');
  return (
    <>
      <RouteTelemetry routeId="why-us" />
      <Folio>
        <Plate
          kicker="The company"
          title={
            <>
              Five things <Gilt>you can check.</Gilt>
            </>
          }
          lede="How this company sells land, in five points. Each can be checked before you give anybody your telephone number."
          cue={{ label: 'The five', href: '#five' }}
        />

        <Sheet
          id="five"
          rail="The five"
          first
          kicker="How we work"
          title={
            <>
              Where to check <Gilt>each of them.</Gilt>
            </>
          }
        >
          <Steps>
            {CLAIMS.map((c) => (
              <Step key={c.title} title={c.title}>
                <p>{c.body}</p>
                <p className="mt-3">
                  <Go href={c.proof.href}>{c.proof.label}</Go>
                </p>
              </Step>
            ))}
          </Steps>
        </Sheet>

        <Window gloss="An approval is a numbered order from a named authority, and the number can be looked up.">
          Check the number, <Gilt>not the logo.</Gilt>
        </Window>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
