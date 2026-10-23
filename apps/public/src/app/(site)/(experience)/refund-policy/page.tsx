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
//
// A FOLIO since 2026-10-06; its clauses are word for word what they were.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { Pending, PendingNotice, pendingRobots } from '@/components/experience/Pending';
import { Folio, Gilt, NextPage, Note, Plate, Prose, Sheet } from '@/components/folio/Folio';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { pageTitle, smallPrintAfter } from '@/components/site/siteMap';

export const metadata: Metadata = withShare('/refund-policy', {
  title: pageTitle('/refund-policy'),
  description:
    'How booking amounts are treated if a purchase does not proceed.',
  ...pendingRobots,
});

export default function RefundPolicyPage() {
  const next = smallPrintAfter('/refund-policy');
  return (
    <>
      <RouteTelemetry routeId="refund-policy" />
      <Folio>
        <Plate
          short
          long
          kicker="Refunds"
          title={
            <>
              If a purchase <Gilt>does not go ahead.</Gilt>
            </>
          }
          lede="What happens to a booking amount, in which circumstances, and how long it takes."
          cue={{ label: 'Before agreement', href: '#before-agreement' }}
        />

        <Sheet id="before-agreement" rail="Before agreement" first title="If you cancel before agreement">
          <PendingNotice what="Every figure and period here is a commercial commitment, for Quality Homes Reality to set. These are the questions buyers ask." />
          <Prose>
            <p>
              Whether the booking amount is refundable at this stage, and any deduction applied:{' '}
              <Pending>PRE-AGREEMENT CANCELLATION TERMS</Pending>. Period within which cancellation
              must be requested: <Pending>COOLING-OFF OR NOTICE PERIOD</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet id="after-agreement" rail="After agreement" raised title="If you cancel after agreement">
          <Prose>
            <p>
              Treatment of amounts already paid, and any forfeiture:{' '}
              <Pending>POST-AGREEMENT CANCELLATION TERMS</Pending>. Where those terms sit in the sale
              agreement itself: <Pending>CLAUSE REFERENCE</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet id="if-we-cannot" rail="If we cannot proceed" title="If we cannot proceed">
          <Prose>
            <p>
              Where the sale does not complete for reasons attributable to Quality Homes Reality
              &mdash; including a failure of title, approval or delivery &mdash; the amount returned
              and any interest or compensation: <Pending>SELLER-SIDE CANCELLATION TERMS</Pending>.
              This is the clause buyers weigh most heavily, and it is worth stating generously and
              plainly.
            </p>
          </Prose>
        </Sheet>

        <Sheet id="how" rail="How a refund is made" raised title="How a refund is made">
          <Prose>
            <p>
              Refunds are returned to the account the payment came from. Time taken from an approved
              request: <Pending>PROCESSING PERIOD</Pending>. Documents required to start a request:{' '}
              <Pending>REQUIRED DOCUMENTS</Pending>. Deductions for taxes or statutory charges
              already paid: <Pending>TAX AND STATUTORY TREATMENT</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet id="request" rail="How to request one" title="How to request one">
          <Prose>
            <p>
              Write to the branch handling your purchase &mdash; Visakhapatnam, Vizianagaram or
              Srikakulam &mdash; with your booking reference. Named contact for refund requests:{' '}
              <Pending>REFUND CONTACT AND EMAIL</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet id="not-satisfied" rail="If you are not satisfied" raised title="If you are not satisfied">
          <Prose>
            <p>
              Escalation route inside the company, and the external forum available to you:{' '}
              <Pending>GRIEVANCE AND ESCALATION ROUTE</Pending>. Nothing in this policy limits
              rights you have under the Real Estate (Regulation and Development) Act 2016 or
              consumer protection&nbsp;law.
            </p>
          </Prose>
          <Note className="mt-10">
            These terms sit alongside the <Link href="/terms">terms of use</Link> and are subordinate
            to your signed sale agreement, which prevails if the two differ.
          </Note>
          <Note className="mt-4">
            Last updated: <Pending>DATE ON PUBLICATION</Pending>.
          </Note>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
