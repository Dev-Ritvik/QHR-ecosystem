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
//
// A FOLIO since 2026-10-06; its clauses are word for word what they were.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { Pending, PendingNotice, pendingRobots } from '@/components/experience/Pending';
import { Folio, Gilt, NextPage, Note, Plate, Prose, Sheet } from '@/components/folio/Folio';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { pageTitle, smallPrintAfter } from '@/components/site/siteMap';

export const metadata: Metadata = withShare('/terms', {
  title: pageTitle('/terms'),
  description:
    'The terms on which this website and the information in it are provided.',
  ...pendingRobots,
});

export default function TermsPage() {
  const next = smallPrintAfter('/terms');
  return (
    <>
      <RouteTelemetry routeId="terms" />
      <Folio>
        <Plate
          short
          kicker="Terms"
          title={
            <>
              Terms <Gilt>of use.</Gilt>
            </>
          }
          lede="The terms on which this website, and the layout information shown in it, are provided."
          cue={{ label: 'Who these are with', href: '#who' }}
        />

        <Sheet
          id="who"
          rail="Who these are with"
          first
          title="Who these terms are with"
        >
          <PendingNotice what="This is a structural draft. Its operative clauses are commercial decisions, for Quality Homes Reality and its legal advisers to make." />
          <Prose>
            <p>
              This website is operated by Quality Homes Reality, head office at D.No. 50-92-36, 2nd
              Floor, Opp. Canara Bank, Shantipuram, Shankara Matam Road, Visakhapatnam&nbsp;530016,
              Andhra Pradesh. Registered entity and identifiers:{' '}
              <Pending>REGISTERED NAME, CIN / GST</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="information"
          rail="The information"
          raised
          title={
            <>
              The information <Gilt>on this site.</Gilt>
            </>
          }
        >
          <Prose>
            <p>
              The layouts shown in the hall are drawn from the approved layout plans for each
              project. Plot numbers, sizes and availability are indicative and change as plots are
              sold. Nothing on this website is an offer or a binding commitment to sell, and no
              figure shown here forms part of any agreement unless it is repeated in a signed
              document.
            </p>
            <p>
              Approval references currently published: Kartikeya Water Front, VMRDA RERA layout;
              VSR Gayatri Township, SUDA approved under F.L.P. No. 10/2025/1178/DTCP/DPMS. RERA
              registration numbers to be published in full:{' '}
              <Pending>RERA REGISTRATION NUMBERS PER PROJECT</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="bookings"
          rail="Enquiries and bookings"
          title="Enquiries and bookings"
        >
          <Prose>
            <p>
              Submitting an enquiry places no obligation on you and creates no reservation. What a
              booking amount reserves, for how long, and on what conditions:{' '}
              <Pending>BOOKING TERMS</Pending>. Payment terms and schedule:{' '}
              <Pending>PAYMENT TERMS</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="images"
          rail="Images and plans"
          raised
          title="Images and plans"
        >
          <Prose>
            <p>
              Renders, elevations and the three-dimensional hall are illustrative. They show layout
              and arrangement, not a guarantee of finish, landscaping or surroundings. Amenities
              described are those planned for each project; delivery timelines and current
              construction status: <Pending>AMENITY DELIVERY AND STATUS COMMITMENTS</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="using"
          rail="Acceptable use"
          title="Acceptable use"
        >
          <Prose>
            <p>
              You may browse, and share links to, any page here. You may not copy the layout
              drawings, renders or written content for commercial use without written permission,
              or attempt to interfere with the site or the data of other visitors.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="law"
          rail="Liability and law"
          raised
          title="Liability and governing law"
        >
          <Prose>
            <p>
              Limitation of liability: <Pending>LIABILITY CLAUSE</Pending>. Governing law and
              jurisdiction: <Pending>GOVERNING LAW AND COURTS</Pending>. Dispute resolution
              mechanism: <Pending>ARBITRATION OR COURTS</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="data"
          rail="Your data"
          title="Your data"
        >
          <Prose>
            <p>
              How your information is handled is set out in the{' '}
              <Link href="/privacy">privacy notice</Link> and the{' '}
              <Link href="/cookie-policy">cookie policy</Link>, which form part of these terms.
            </p>
          </Prose>
          <Note className="mt-10">
            Last updated: <Pending>DATE ON PUBLICATION</Pending>.
          </Note>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
