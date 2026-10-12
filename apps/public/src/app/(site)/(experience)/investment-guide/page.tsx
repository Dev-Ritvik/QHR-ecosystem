// apps/public/src/app/(site)/(experience)/investment-guide/page.tsx
//
// A FOLIO, read from the study.
//
// Every external fact here is sourced and linked. Two rules held while writing:
// no price, yield or appreciation figure is stated, because none exists in
// anything supplied and an invented one is the single most damaging thing a
// property site can publish; and the due-diligence section is written to be
// useful even to someone who then buys from a competitor. A guide that only
// works as a sales pitch is not a guide.
//
// THE AIRPORT'S TENSE (2026-10-06). The page was written before it opened and
// said commercial operations were "expected to begin from 17 August 2026". By
// October that sentence was two months stale and read as if nobody were
// keeping the page. Checked against the airline's own announcement and the
// airport's entry (both in Sources): inaugurated 1 August 2026, scheduled
// flights from 17 August 2026. It says so in the past tense, and the airline's
// notice is added to the sources.
//
// THE ROADS. This page gave Kartikeya's as "40′ and 33′ blacktop"; the sheet
// marks its internal roads at 40′ and 30′, and the road it is entered from at
// 33′ (lib/layouts.ts).
//
// SAID PLAINLY (the forensic audit of 2026-10-09, #84: seven "this, not that"
// and "rather than" turns on this page, among them its first heading, "The
// airport is a real change, not a talking point."). One is kept, the note
// that this is guidance and not advice, which is a thing a guide has to say.
// The rest say what to do.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import {
  Folio,
  Gilt,
  IndexList,
  List,
  NextPage,
  Note,
  Plate,
  Prose,
  Sheet,
  Step,
  Steps,
  Window,
} from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = withShare('/investment-guide', {
  title: pageTitle('/investment-guide'),
  description:
    'What to check before buying a plot in Vizianagaram or Srikakulam: RERA registration, title, approvals, and what the new Bhogapuram airport changes.',
});

const SOURCES = [
  {
    href: 'https://en.wikipedia.org/wiki/Alluri_Sitarama_Raju_International_Airport',
    name: 'Alluri Sitarama Raju International Airport (Bhogapuram)',
    line: 'An overview: where it is, who runs it, what its first phase is built for.',
  },
  {
    href: 'https://www.airindia.com/in/en/newsroom/press-release/Air-India-to-commence-operations-from-Alluri-Sitarama-Raju-International-Airport-at-Bhogapuram-from-17-August.html',
    name: 'Air India: operations from Bhogapuram from 17 August',
    line: 'The airline’s own notice of the move across from Visakhapatnam.',
  },
  {
    href: 'https://bhogapuramairport.com.in/opening-dates/',
    name: 'Bhogapuram Airport: opening date and status',
    line: 'The dates of inauguration and of first scheduled flights.',
  },
  {
    href: 'https://www.ujjivansfb.bank.in/banking-blogs/personal-finance/ap-rera-project-agent-verification',
    name: 'AP RERA: verifying a project and an agent',
    line: 'How a registration is looked up, step by step.',
  },
  {
    href: 'https://mypatta.in/blog/rera-certificate-in-andhra-pradesh-how-to-check-rera-registered-projectsits-purpose-faqs/',
    name: 'RERA certificates in Andhra Pradesh',
    line: 'What a certificate is for, and how to check one.',
  },
];

export default function InvestmentGuidePage() {
  const next = pageAfter('/investment-guide');
  return (
    <>
      <RouteTelemetry routeId="investment-guide" />
      <Folio>
        <Plate
          kicker="Before you buy · A guide"
          long
          title={
            <>
              Buying land in <Gilt>north coastal Andhra.</Gilt>
            </>
          }
          lede="What to check before money moves, and what the new airport changes."
          cue={{ label: 'The airport', href: '#airport' }}
        />

        <Sheet
          id="airport"
          rail="The airport"
          first
          kicker="What has changed"
          title={
            <>
              What the airport <Gilt>changes.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              Bhogapuram &mdash; officially Alluri Sitarama Raju International Airport &mdash; sits
              in Vizianagaram district and is Andhra Pradesh&rsquo;s newest greenfield international
              airport.
            </p>
            <p>
              It was inaugurated on 1 August 2026 and has carried scheduled commercial flights since
              17 August 2026, when airlines moved across from Visakhapatnam. Its first phase is
              built to handle around six million passengers a year.
            </p>
            <p>
              That matters to this stretch of coast, and all three of our layouts sit in the two
              districts around it. An airport does not set a price: treat any guaranteed
              appreciation figure quoted off the back of one as a guess.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="registered"
          rail="Registration"
          kicker="First"
          title={
            <>
              Check the layout <Gilt>is registered.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              Plotted developments come under the Real Estate (Regulation and Development) Act 2016,
              administered in this state by AP-RERA.
            </p>
            <p>
              A registered project must publish accurate details on the AP-RERA portal, including
              approved plans, land details and timelines. You can search the portal by project or
              promoter name and confirm the registration is live before you commit.
            </p>
            <p>
              Two practical consequences: most banks will only sanction a loan against a
              RERA-registered project, and registration gives you a forum to complain to if
              something goes wrong. Both are reasons to wait for the registration itself when you
              are told it is &ldquo;in process&rdquo;.
            </p>
          </Prose>
        </Sheet>

        <Window>
          Compare the plan you are shown <Gilt>with the plan that was approved.</Gilt>
        </Window>

        <Sheet
          id="documents"
          rail="Four documents"
          kicker="Then"
          title={
            <>
              The four documents <Gilt>worth reading yourself.</Gilt>
            </>
          }
        >
          <Steps>
            <Step title="The approved layout plan">
              <p>
                It shows plot positions, dimensions, road widths and common areas. Compare it
                against whatever site map you have been shown. If the two differ, the approved plan
                is the one that counts.
              </p>
            </Step>
            <Step title="The title documents">
              <p>
                These establish that the seller actually holds title or development rights, and
                that the land carries no dispute or encumbrance. Have a lawyer trace the whole
                chain.
              </p>
            </Step>
            <Step title="The approval reference">
              <p>
                A layout is approved by a named authority under a numbered order. Ours are a VMRDA
                RERA layout at Kartikeya Water Front, and SUDA approval under F.L.P. No.
                10/2025/1178/DTCP/DPMS at VSR Gayatri Township. Ask for the equivalent anywhere you
                buy, and look the number up in the authority&rsquo;s own records.
              </p>
            </Step>
            <Step title="The encumbrance certificate">
              <p>
                It records registered transactions against the property. Pull it for the whole
                period your lawyer advises.
              </p>
            </Step>
          </Steps>
        </Sheet>

        <Sheet
          id="questions"
          rail="Five questions"
          raised
          kicker="On the ground"
          title={
            <>
              Questions that separate a good plot <Gilt>from a cheap one.</Gilt>
            </>
          }
        >
          <List
            items={[
              <>
                How wide is the road at the plot, and is it laid or promised? Our sheets mark 40&prime;
                and 30&prime; roads at Kartikeya Water Front, 40&prime; at VSR Gayatri Township, and
                20&prime; at Lucky Garden.
              </>,
              'Is drainage underground, and is a water connection provided to the plot boundary?',
              'Are the plots physically demarcated on site with numbers, or only on paper?',
              'What is committed on amenities, and in writing? A brochure list is a statement of intent; the agreement is the commitment.',
              'Who maintains the common areas after sales complete, and how is it funded?',
            ]}
          />
        </Sheet>

        <Sheet
          id="before-you-transfer"
          rail="Before you pay"
          kicker="Last"
          title={
            <>
              Before you <Gilt>transfer anything.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">Register the sale deed and keep the receipts.</p>
            <p>
              Pay by traceable instrument into a named account. If any figure quoted to you
              verbally does not appear in the written agreement, treat it as not having been said
              &mdash; including timelines, amenity commitments and refund terms.
            </p>
            <p>
              Our own cancellation terms are set out in the{' '}
              <Link href="/refund-policy">refund policy</Link>.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="sources"
          rail="Sources"
          kicker="Sources"
          title={
            <>
              Where each outside fact <Gilt>comes from.</Gilt>
            </>
          }
          note="Each opens in its own tab, on its publisher’s site."
        >
          <IndexList two items={SOURCES.map((s) => ({ ...s, external: true }))} />
          <Note className="mt-10">
            This is general guidance, not legal or financial advice. Approval references and
            registration numbers change; verify current status on the AP-RERA portal and take your
            own legal advice before buying.
          </Note>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
