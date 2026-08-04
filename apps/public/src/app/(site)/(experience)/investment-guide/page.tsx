// apps/public/src/app/(site)/(experience)/investment-guide/page.tsx
//
// A SURFACE read from the study.
//
// Every external fact here is sourced and linked. Two rules held while writing:
// no price, yield or appreciation figure is stated, because none exists in
// anything supplied and an invented one is the single most damaging thing a
// property site can publish; and the due-diligence section is written to be
// useful even to someone who then buys from a competitor. A guide that only
// works as a sales pitch is not a guide.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'Buying land in north coastal Andhra — Quality Homes Reality',
  description:
    'What to check before buying a plot in Vizianagaram or Srikakulam: RERA registration, title, approvals, and what the new Bhogapuram airport changes.',
};

export default function InvestmentGuidePage() {
  return (
    <>
      <RouteTelemetry routeId="investment-guide" />
      <Surface
        eyebrow="Guide"
        title="Buying land in north coastal Andhra"
        lede="What actually needs checking before money moves, and what the new airport does and does not change."
      >
        <h2 className="font-serif text-xl text-[#F2EDE4]">
          The airport is a real change, not a talking point
        </h2>
        <p>
          Bhogapuram — officially Alluri Sitarama Raju International Airport —
          sits in Vizianagaram district and is Andhra Pradesh&rsquo;s newest
          greenfield international airport. It was inaugurated on 1 August 2026,
          with scheduled commercial operations expected to begin from 17 August
          2026 as airlines move across from Visakhapatnam. Its first phase is
          built to handle around six million passengers a year.
        </p>
        <p>
          That matters to this stretch of coast because all three of our layouts
          sit in the two districts around it. What it does <em>not</em> do is
          set a price. Anyone quoting you a guaranteed appreciation figure off
          the back of an airport is guessing, and you should treat the number as
          marketing rather than analysis.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          Check the layout is registered
        </h2>
        <p>
          Plotted developments come under the Real Estate (Regulation and
          Development) Act 2016, administered in this state by AP-RERA. A
          registered project must publish accurate details on the AP-RERA
          portal, including approved plans, land details and timelines. You can
          search the portal by project or promoter name and confirm the
          registration is live before you commit.
        </p>
        <p>
          Two practical consequences: most banks will only sanction a loan
          against a RERA-registered project, and registration gives you a forum
          to complain to if something goes wrong. Both are reasons to insist on
          it rather than accept a promise that it is &ldquo;in process&rdquo;.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          The four documents worth reading yourself
        </h2>
        <ol className="list-decimal space-y-3 pl-5 marker:text-[#F2EDE4]/40">
          <li>
            <strong className="text-[#F2EDE4]">The approved layout plan.</strong>{' '}
            It shows plot positions, dimensions, road widths and common areas.
            Compare it against whatever site map you have been shown. If the two
            differ, the approved plan is the one that counts.
          </li>
          <li>
            <strong className="text-[#F2EDE4]">The title documents.</strong>{' '}
            These establish that the seller actually holds title or development
            rights, and that the land carries no dispute or encumbrance. Have a
            lawyer trace the chain rather than accepting a summary.
          </li>
          <li>
            <strong className="text-[#F2EDE4]">The approval reference.</strong>{' '}
            A layout is approved by a named authority under a numbered order.
            Ours are a VMRDA RERA layout at Kartikeya Water Front, and SUDA
            approval under F.L.P. No. 10/2025/1178/DTCP/DPMS at VSR Gayatri
            Township. Ask for the equivalent anywhere you buy, and check the
            number rather than the logo.
          </li>
          <li>
            <strong className="text-[#F2EDE4]">The encumbrance certificate.</strong>{' '}
            It records registered transactions against the property. Pull it for
            the period your lawyer advises, not just the last year.
          </li>
        </ol>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          Questions that separate a good plot from a cheap one
        </h2>
        <ul className="list-disc space-y-2 pl-5 marker:text-[#F2EDE4]/40">
          <li>
            How wide is the road at the plot, and is it laid or promised? Our
            layouts state 40&prime; and 33&prime; blacktop at Kartikeya Water
            Front, and 40&prime; at VSR Gayatri Township.
          </li>
          <li>
            Is drainage underground, and is a water connection provided to the
            plot boundary?
          </li>
          <li>
            Are the plots physically demarcated on site with numbers, or only on
            paper?
          </li>
          <li>
            What is committed on amenities, and in writing? A brochure list is a
            statement of intent; the agreement is the commitment.
          </li>
          <li>
            Who maintains the common areas after sales complete, and how is it
            funded?
          </li>
        </ul>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          Before you transfer anything
        </h2>
        <p>
          Register the sale deed and keep the receipts. Pay by traceable
          instrument into a named account. If any figure quoted to you verbally
          does not appear in the written agreement, treat it as not having been
          said — including timelines, amenity commitments and refund terms. Our
          own cancellation terms are set out in the{' '}
          <Link className="underline underline-offset-4" href="/refund-policy">
            refund policy
          </Link>
          .
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">Sources</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm marker:text-[#F2EDE4]/40">
          <li>
            <a
              className="underline underline-offset-4"
              href="https://en.wikipedia.org/wiki/Alluri_Sitarama_Raju_International_Airport"
              target="_blank"
              rel="noreferrer noopener"
            >
              Alluri Sitarama Raju International Airport (Bhogapuram) — overview
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-4"
              href="https://bhogapuramairport.com.in/opening-dates/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Bhogapuram Airport — opening date and current status
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-4"
              href="https://www.ujjivansfb.bank.in/banking-blogs/personal-finance/ap-rera-project-agent-verification"
              target="_blank"
              rel="noreferrer noopener"
            >
              AP RERA — verifying project and agent registration
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-4"
              href="https://mypatta.in/blog/rera-certificate-in-andhra-pradesh-how-to-check-rera-registered-projectsits-purpose-faqs/"
              target="_blank"
              rel="noreferrer noopener"
            >
              RERA certificates in Andhra Pradesh — how to check a project
            </a>
          </li>
        </ul>

        <p className="mt-10 text-sm leading-relaxed text-[#F2EDE4]/55">
          This is general guidance, not legal or financial advice. Approval
          references and registration numbers change; verify current status on
          the AP-RERA portal and take your own legal advice before buying.
        </p>
      </Surface>
    </>
  );
}
