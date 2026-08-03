// apps/public/src/app/(site)/(experience)/terms/page.tsx
//
// Structure only. Almost every operative clause in a terms page for plot sales
// is a commercial or legal decision the seller makes — jurisdiction, what a
// booking actually reserves, what the site's figures commit to. Writing a
// plausible default for any of those would be inventing a term the client never
// agreed and a buyer might rely on.
//
// So the shape is here and the substance is marked pending. The page is
// noindex until it is filled in.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { Pending, PendingNotice, pendingRobots } from '@/components/experience/Pending';

export const metadata: Metadata = {
  title: 'Terms — Quality Homes Reality',
  description:
    'The terms on which this website and the information in it are provided.',
  ...pendingRobots,
};

export default function TermsPage() {
  return (
    <>
      <RouteTelemetry routeId="terms" />
      <Surface
        eyebrow="Terms"
        title="Terms of use"
        lede="The terms on which this website, and the layout information shown in it, are provided."
      >
        <PendingNotice what="This is a structural draft. The operative clauses are commercial decisions rather than technical ones, so they are left for Quality Homes Reality and its legal advisers rather than assumed." />

        <h2 className="font-serif text-xl text-[#F2EDE4]">Who these terms are with</h2>
        <p>
          This website is operated by Quality Homes Reality, head office at
          D.No. 50-92-36, 2nd Floor, Opp. Canara Bank, Shantipuram, Shankara
          Matam Road, Visakhapatnam 530 016, Andhra Pradesh. Registered entity
          and identifiers: <Pending>REGISTERED NAME, CIN / GST</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          What the information here is, and is not
        </h2>
        <p>
          The layouts shown in the hall are drawn from the approved layout plans
          for each project. Plot numbers, sizes and availability are indicative
          and change as plots are sold. Nothing on this website is an offer or a
          binding commitment to sell, and no figure shown here forms part of any
          agreement unless it is repeated in a signed document.
        </p>
        <p>
          Approval references currently published: Kartikeya Water Front, VMRDA
          RERA layout; VSR Gayatri Township, SUDA approved under F.L.P. No.
          10/2025/1178/DTCP/DPMS. RERA registration numbers to be published in
          full: <Pending>RERA REGISTRATION NUMBERS PER PROJECT</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          Enquiries and bookings
        </h2>
        <p>
          Submitting an enquiry places no obligation on you and creates no
          reservation. What a booking amount reserves, for how long, and on what
          conditions: <Pending>BOOKING TERMS</Pending>. Payment terms and
          schedule: <Pending>PAYMENT TERMS</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">Images and plans</h2>
        <p>
          Renders, elevations and the three-dimensional hall are illustrative.
          They show layout and arrangement, not a guarantee of finish,
          landscaping or surroundings. Amenities described are those planned for
          each project; delivery timelines and current construction status:{' '}
          <Pending>AMENITY DELIVERY AND STATUS COMMITMENTS</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">Using this site</h2>
        <p>
          You may browse, and share links to, any page here. You may not copy the
          layout drawings, renders or written content for commercial use without
          written permission, or attempt to interfere with the site or the data
          of other visitors.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          Liability and governing law
        </h2>
        <p>
          Limitation of liability: <Pending>LIABILITY CLAUSE</Pending>.
          Governing law and jurisdiction:{' '}
          <Pending>GOVERNING LAW AND COURTS</Pending>. Dispute resolution
          mechanism: <Pending>ARBITRATION OR COURTS</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">Your data</h2>
        <p>
          How your information is handled is set out in the{' '}
          <Link className="underline underline-offset-4" href="/privacy">
            privacy notice
          </Link>{' '}
          and the{' '}
          <Link className="underline underline-offset-4" href="/cookie-policy">
            cookie policy
          </Link>
          , which form part of these terms.
        </p>

        <p className="mt-12 text-sm text-[#F2EDE4]/50">
          Last updated: <Pending>DATE ON PUBLICATION</Pending>.
        </p>
      </Surface>
    </>
  );
}
