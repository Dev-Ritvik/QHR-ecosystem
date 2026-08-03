// apps/public/src/app/(site)/(experience)/refund-policy/page.tsx
//
// Every number in a refund policy is a promise. A cancellation window, a
// deduction percentage or a processing period invented here would be a
// representation to a consumer that Quality Homes Reality never made and might
// then be held to.
//
// So this page carries the questions a buyer actually asks, in the order they
// ask them, and each answer is left for the client. It is the most useful thing
// that can honestly be produced without their commercial terms.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { Pending, PendingNotice, pendingRobots } from '@/components/experience/Pending';

export const metadata: Metadata = {
  title: 'Cancellation & Refunds — Quality Homes Reality',
  description:
    'How booking amounts are treated if a purchase does not proceed.',
  ...pendingRobots,
};

export default function RefundPolicyPage() {
  return (
    <>
      <RouteTelemetry routeId="refund-policy" />
      <Surface
        eyebrow="Cancellation &amp; refunds"
        title="If a purchase does not go ahead"
        lede="What happens to a booking amount, in which circumstances, and how long it takes."
      >
        <PendingNotice what="Every figure and period on this page is a commercial commitment, so none has been assumed. These are the questions buyers ask; the answers belong to Quality Homes Reality." />

        <h2 className="font-serif text-xl text-[#F2EDE4]">
          If you cancel before agreement
        </h2>
        <p>
          Whether the booking amount is refundable at this stage, and any
          deduction applied: <Pending>PRE-AGREEMENT CANCELLATION TERMS</Pending>.
          Period within which cancellation must be requested:{' '}
          <Pending>COOLING-OFF OR NOTICE PERIOD</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          If you cancel after agreement
        </h2>
        <p>
          Treatment of amounts already paid, and any forfeiture:{' '}
          <Pending>POST-AGREEMENT CANCELLATION TERMS</Pending>. Where those
          terms sit in the sale agreement itself:{' '}
          <Pending>CLAUSE REFERENCE</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          If we cannot proceed
        </h2>
        <p>
          Where the sale does not complete for reasons attributable to Quality
          Homes Reality — including a failure of title, approval or delivery —
          the amount returned and any interest or compensation:{' '}
          <Pending>SELLER-SIDE CANCELLATION TERMS</Pending>. This is the clause
          buyers weigh most heavily, and it is worth stating generously and
          plainly.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          How a refund is made
        </h2>
        <p>
          Refunds are returned to the account the payment came from. Time taken
          from an approved request: <Pending>PROCESSING PERIOD</Pending>.
          Documents required to start a request:{' '}
          <Pending>REQUIRED DOCUMENTS</Pending>. Deductions for taxes or
          statutory charges already paid:{' '}
          <Pending>TAX AND STATUTORY TREATMENT</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          How to request one
        </h2>
        <p>
          Write to the branch handling your purchase — Visakhapatnam,
          Vizianagaram or Srikakulam — with your booking reference. Named
          contact for refund requests:{' '}
          <Pending>REFUND CONTACT AND EMAIL</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          If you are not satisfied
        </h2>
        <p>
          Escalation route inside the company, and the external forum available
          to you: <Pending>GRIEVANCE AND ESCALATION ROUTE</Pending>. Nothing in
          this policy limits rights you have under the Real Estate (Regulation
          and Development) Act 2016 or consumer protection law.
        </p>

        <p className="mt-12 text-sm text-[#F2EDE4]/60">
          These terms sit alongside the{' '}
          <Link className="underline underline-offset-4" href="/terms">
            terms of use
          </Link>{' '}
          and are subordinate to your signed sale agreement, which prevails if
          the two differ.
        </p>
        <p className="mt-4 text-sm text-[#F2EDE4]/50">
          Last updated: <Pending>DATE ON PUBLICATION</Pending>.
        </p>
      </Surface>
    </>
  );
}
