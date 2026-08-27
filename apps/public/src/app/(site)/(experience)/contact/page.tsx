// apps/public/src/app/(site)/(experience)/contact/page.tsx
//
// A SURFACE read from the desk. Reuses the existing enquiry form rather than a
// second one: that form already carries the honeypot, the E.164 normalisation
// and the form telemetry, and a duplicate would drift from it.
//
// The switchboard number and address come from the client's own site at
// qualityhomesreality.com; the brochures leave their "For More Details" boxes
// blank, so nothing here is inferred from them.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { EnquiryForm } from '../../enquiry-form';
import { BRANCHES } from '@estate/domain/leads/branches';

export const metadata: Metadata = {
  title: 'Contact — Quality Homes Reality',
  description:
    'Ask about any of the three layouts. Your enquiry reaches the office that holds that site.',
};

export default function ContactPage() {
  return (
    <>
      <RouteTelemetry routeId="contact" />
      <Surface
        eyebrow="Contact"
        title="Ask about a layout"
        lede="One enquiry, routed to whichever office holds the site you were looking at. No call centre in between."
      >
        <div className="rounded border border-white/10 bg-white/[0.03] p-6">
          <EnquiryForm />
        </div>

        <h2 className="mt-14 font-serif text-xl text-[#F2EDE4]">
          Or write to an office directly
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-3">
          {(['visakhapatnam', 'vizianagaram', 'srikakulam'] as const).map((id) => {
            const b = BRANCHES[id];
            return (
              <div key={b.id}>
                <p className="font-serif text-lg text-[#F2EDE4]">{b.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#F2EDE4]/60">
                  {b.role === 'head_office' ? 'Head office' : 'Branch'}
                </p>
                <address className="mt-3 not-italic text-sm leading-relaxed text-[#F2EDE4]/70">
                  {b.address} &ndash; {b.pincode}
                </address>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-[15px] text-[#F2EDE4]/75">
          Or call{' '}
          <a className="underline underline-offset-4" href="tel:+919553513366">
            +91 95535 13366
          </a>
          , or write to{' '}
          <a
            className="underline underline-offset-4"
            href="mailto:qualityhomesreality@gmail.com"
          >
            qualityhomesreality@gmail.com
          </a>
          .
        </p>

        <p className="mt-6 text-sm text-[#F2EDE4]/55">
          What happens to what you send is set out in the{' '}
          <Link className="underline underline-offset-4 hover:text-[#F2EDE4]" href="/privacy">
            privacy notice
          </Link>
          . Full office list on{' '}
          <Link className="underline underline-offset-4 hover:text-[#F2EDE4]" href="/branches">
            the offices page
          </Link>
          .
        </p>
      </Surface>
    </>
  );
}
