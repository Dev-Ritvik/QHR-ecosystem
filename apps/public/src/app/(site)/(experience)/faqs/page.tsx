// apps/public/src/app/(site)/(experience)/faqs/page.tsx
//
// The first SURFACE. Proves the pattern the other nineteen follow: a real,
// server-rendered, indexable route that happens to be presented over the held
// frame. Opening it involves no travel and no load — the world is already
// mounted by the layout and simply re-frames toward the study.
//
// Content note: answers are drawn from the client's own printed collateral
// (the Kartikeya and Gayatri brochures) or are procedural facts. Nothing about
// price, timeline or approval status is invented — those need the client's
// sign-off before they can be stated.

import type { Metadata } from 'next';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'Questions — Quality Homes Reality',
  description:
    'Plot sizes, approvals, documentation and site visits across Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
};

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Where are the three layouts?',
    a: 'Kartikeya Water Front is at Poosapatirega in Vizianagaram district. Lucky Garden is at Kumaram Village, Garividi, also Vizianagaram. VSR Gayatri Township is at Bayyannapeta, Pedaraopalle, near Allinagaram in Srikakulam district.',
  },
  {
    q: 'What plot sizes are available?',
    a: 'Kartikeya Water Front is laid out in 30′×50′, 30′×56′ and 30′×60′ plots. VSR Gayatri Township is laid out in 60′×30′ plots. Availability changes, so the tables in the hall show the current position rather than a printed list.',
  },
  {
    q: 'Are the layouts approved?',
    a: 'Kartikeya Water Front is a VMRDA RERA layout. VSR Gayatri Township is SUDA approved under F.L.P. No. 10/2025/1178/DTCP/DPMS. Ask us for the current approval documents for any plot you are considering.',
  },
  {
    q: 'What is provided inside the layouts?',
    a: 'At Kartikeya Water Front: a grand entrance arch, children’s playground, jogging and walking tracks, cricket practice nets, a basketball court, a swimming pool, a future commercial zone and utility spaces. Internal roads are 40′ and 33′ wide blacktop with street lighting, underground drainage and water connections, and the layout is gated with 24×7 CCTV.',
  },
  {
    q: 'Which office will I be dealing with?',
    a: 'Quality Homes Reality has a head office in Visakhapatnam and branches in Vizianagaram and Srikakulam. Enquiries are routed to whichever office holds the layout you are looking at, so you are speaking to the people who know that site.',
  },
  {
    q: 'Can I visit the site?',
    a: 'Yes. Ask for a site visit through the enquiry form or by phone, and the branch that holds that layout will arrange it.',
  },
  {
    q: 'Do I need a WebGL-capable device to use this site?',
    a: 'No. The hall is an enhancement. Every page works as ordinary text and images, and the layouts, plot sizes and contact routes are all available without it.',
  },
  {
    q: 'What do you record about my visit?',
    a: 'Only what you agree to. Nothing beyond what is needed to run the site is recorded until you choose, you can change your mind at any time from the Privacy control, and you can delete this visit’s data from the same panel.',
  },
];

export default function FaqsPage() {
  return (
    <>
      <RouteTelemetry routeId="faqs" />
      <Surface
        eyebrow="Questions"
        title="The things people ask first"
        lede="If something here is not answered, ask the branch that holds the layout — they will know the specifics for that site."
      >
        <dl className="space-y-8">
          {FAQS.map((f) => (
            <div key={f.q} className="border-t border-white/10 pt-6 first:border-0 first:pt-0">
              <dt className="font-serif text-lg text-[#F2EDE4]">{f.q}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-[#F2EDE4]/75">
                {f.a}
              </dd>
            </div>
          ))}
        </dl>
      </Surface>
    </>
  );
}
