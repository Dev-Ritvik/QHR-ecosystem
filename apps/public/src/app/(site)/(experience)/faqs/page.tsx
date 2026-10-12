// apps/public/src/app/(site)/(experience)/faqs/page.tsx
//
// A FOLIO with a short plate, read from the study.
//
// Content note: answers are drawn from the client's own printed collateral
// (the Kartikeya and Gayatri brochures) or are procedural facts. Nothing about
// price, timeline or approval status is invented — those need the client's
// sign-off before they can be stated.
//
// THREE ANSWERS BROUGHT INTO LINE WITH THE SHEETS (2026-10-06):
//   - the sizes left Lucky Garden's out (15′×60′ and 18′×60′, on its plan);
//   - the approvals left Lucky Garden out, and say now what can be said of it;
//   - Kartikeya's roads were "40′ and 33′ wide": its sheet marks the roads
//     inside it at 40′ and 30′ and the road it is entered from at 33′.
// The facts are lib/layouts.ts's, so this page cannot drift from the others.
//
// THE QUESTIONS ARE ALSO PUBLISHED AS DATA (schema.org FAQPage), which is the
// same text and nothing more: a search engine may show an answer under the
// page's result, and what it shows is what the page says.
//
// A BUYER'S QUESTIONS, IN A BUYER'S WORDS (the forensic audit of 2026-10-09,
// #93: "'Do I need a WebGL-capable device to use this site?' ... No land buyer
// asks this; it is the build talking about itself. Expected: 'Will this work
// on my phone?' or nothing"; and #85, on "No price is published on this site
// ..."). The price question says where a rate comes from, which is the answer
// a buyer wants; this is the one place the site says it.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { Actions, Folio, Gilt, Go, NextPage, Plate, QA, Sheet } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { LAYOUTS } from '@/lib/layouts';

export const metadata: Metadata = withShare('/faqs', {
  title: pageTitle('/faqs'),
  description:
    'Plot sizes, approvals, documentation and site visits across Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
});

const [K, L, G] = LAYOUTS;
const sizes = (l: (typeof LAYOUTS)[number]) => {
  const s = l.sizes.map((x) => x.label.replace(/\s/g, ''));
  return s.length > 1 ? `${s.slice(0, -1).join(', ')} and ${s[s.length - 1]}` : s[0];
};

interface Faq {
  q: string;
  /** Plain text: what is published as data. */
  a: string;
  /** The same answer with its links, where it has any. */
  rich?: React.ReactNode;
}

const ABOUT_THE_LAND: Faq[] = [
  {
    q: 'Where are the three layouts?',
    a: 'Kartikeya Water Front is at Poosapatirega in Vizianagaram district. Lucky Garden is at Kumaram Village, Garividi, also Vizianagaram. VSR Gayatri Township is at Bayyannapeta, Pedaraopalle, near Allinagaram in Srikakulam district.',
  },
  {
    q: 'What plot sizes are available?',
    a: `${K.name} is laid out in ${sizes(K)} plots. ${L.name} is laid out in ${sizes(L)} plots. ${G.name} is laid out in ${sizes(G)} plots. How many are open today is counted on each layout’s own page.`,
  },
  {
    q: 'Are the layouts approved?',
    a: 'Kartikeya Water Front is a VMRDA RERA layout. VSR Gayatri Township is SUDA approved under F.L.P. No. 10/2025/1178/DTCP/DPMS. Lucky Garden is a Panchayat layout plan: ask the Vizianagaram branch for its approval reference. Ask us for the current approval documents for any plot you are considering.',
  },
  {
    q: 'What is provided inside the layouts?',
    a: 'At Kartikeya Water Front, as its brochure lists them: a grand entrance arch, children’s playground, jogging and walking tracks, cricket practice nets, a basketball court, a swimming pool, a future commercial zone and utility spaces. Its sheet marks the roads inside it at 40 ft and 30 ft, blacktop with street lighting, and the road it is entered from at 33 ft; underground drainage and water connections are listed, and the layout is gated, with CCTV round the clock. Lucky Garden’s sheet marks 20 ft roads and VSR Gayatri Township’s 40 ft roads throughout.',
  },
];

const ABOUT_BUYING: Faq[] = [
  {
    q: 'What does a plot cost?',
    a: 'Rates change, so they are quoted by the branch that holds the layout. Ask, and you get the rate for the size you want on that day, with the plots that are free.',
  },
  {
    q: 'Which office will I be dealing with?',
    a: 'Quality Homes Reality has a head office in Visakhapatnam and branches in Vizianagaram and Srikakulam. Enquiries are routed to whichever office holds the layout you are looking at, so you are speaking to the people who know that site.',
  },
  {
    q: 'Can I visit a layout?',
    a: 'Yes. Ask for a site visit through the form or by phone, and the branch that holds that layout will arrange it.',
    rich: (
      <>
        Yes. <Link href="/book-a-site-visit">Ask for a site visit</Link> through the form or by
        phone, and the branch that holds that layout will arrange it.
      </>
    ),
  },
];

const ABOUT_THE_SITE: Faq[] = [
  {
    q: 'Will this work on my phone?',
    a: 'Yes. The plans, the plot sizes and the ways to reach an office are ordinary pages that open on any phone. The film and the walk round the hall are extras, for devices that can draw them.',
  },
  {
    q: 'What do you record about my visit?',
    a: 'Only what you agree to. Until you choose, the one record is what keeps your visit together. You can change your mind at any time from the Privacy control, and delete this visit’s data from the same panel.',
  },
];

const ALL = [...ABOUT_THE_LAND, ...ABOUT_BUYING, ...ABOUT_THE_SITE];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: ALL.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const items = (list: Faq[]) => list.map((f) => ({ q: f.q, a: f.rich ?? f.a }));

export default function FaqsPage() {
  const next = pageAfter('/faqs');
  return (
    <>
      <RouteTelemetry routeId="faqs" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <Folio>
        <Plate
          short
          kicker="Before you buy"
          title={
            <>
              The things people <Gilt>ask first.</Gilt>
            </>
          }
          lede="For anything else, ask the branch that holds the layout: they know that ground."
          cue={{ label: 'About the land', href: '#the-land' }}
        />

        <Sheet
          id="the-land"
          rail="About the land"
          first
          kicker="About the land"
          title={
            <>
              Where, how large, <Gilt>and on whose approval.</Gilt>
            </>
          }
        >
          <QA items={items(ABOUT_THE_LAND)} />
        </Sheet>

        <Sheet
          id="buying"
          rail="About buying"
          raised
          kicker="About buying"
          title={
            <>
              Price, people, <Gilt>and seeing it.</Gilt>
            </>
          }
        >
          <QA items={items(ABOUT_BUYING)} />
        </Sheet>

        <Sheet
          id="the-website"
          rail="The website"
          kicker="The website"
          title={
            <>
              What it needs, <Gilt>and what it keeps.</Gilt>
            </>
          }
        >
          <QA items={items(ABOUT_THE_SITE)} />
          <Actions>
            <Go href="/contact">Ask something else</Go>
            <Go href="/privacy">The privacy notice</Go>
          </Actions>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
