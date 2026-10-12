// apps/public/src/app/(site)/(experience)/contact/page.tsx
//
// A FOLIO with a short plate, read from the desk. Reuses the one enquiry form
// rather than a second one: that form already carries the honeypot, the E.164
// normalisation and the form telemetry, and a duplicate would drift from it.
//
// The switchboard number and address come from the client's own site at
// qualityhomesreality.com; the brochures leave their "For More Details" boxes
// blank, so nothing here is inferred from them.
//
// THE FORM ASKS WHICH LAYOUT (2026-10-06), where it asked nothing. The page
// promises that an enquiry "reaches the office that holds that site", and the
// form gave the office no site to go on unless the visitor had consented to
// analytics and looked at one. It is a choice now, with "not sure yet" as an
// answer; the layouts and their ids are the register's (lib/published.ts), so
// a layout that is not published cannot be chosen.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { BRANCHES } from '@estate/domain/leads/branches';
import { Folio, Gilt, NextPage, Note, Plate, Prose, Sheet } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { COMPANY } from '@/lib/company';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';
import { layoutBySlug } from '@/lib/layouts';
import { publishedLayouts } from '@/lib/published';
import { EnquiryForm } from '../../enquiry-form';
import { withPin } from '@/lib/units';

export const metadata: Metadata = withShare('/contact', {
  title: pageTitle('/contact'),
  description:
    'Ask about any of the three layouts. Your enquiry reaches the office that holds that site.',
});

export default async function ContactPage() {
  const next = pageAfter('/contact');
  const live = await publishedLayouts();
  const choices = live
    .filter((p) => !p.soldOut)
    .map((p) => {
      const l = layoutBySlug(p.slug);
      return { id: p.projectId, name: p.name, where: l ? `${l.where}, ${l.district}` : '' };
    });
  return (
    <>
      <RouteTelemetry routeId="contact" />
      <Folio>
        <Plate
          short
          kicker="Come and see"
          title={
            <>
              Ask about <Gilt>a layout.</Gilt>
            </>
          }
          lede="Ask about any of the three layouts, and the office that holds it will answer."
          cue={{ label: 'The enquiry', href: '#enquiry' }}
        />

        <Sheet
          id="enquiry"
          rail="The enquiry"
          first
          kicker="The enquiry"
          title={
            <>
              A name, a number, <Gilt>and what you want to know.</Gilt>
            </>
          }
          note="Somebody at the office that holds the layout telephones you back."
        >
          <EnquiryForm layouts={choices} />
        </Sheet>

        <Sheet
          id="offices"
          rail="An office directly"
          layout="full"
          raised
          kicker="Or an office directly"
          title={
            <>
              Three addresses, <Gilt>one telephone number.</Gilt>
            </>
          }
        >
          <div className="folio-trio">
            {(['visakhapatnam', 'vizianagaram', 'srikakulam'] as const).map((id) => {
              const b = BRANCHES[id];
              return (
                <section key={b.id} aria-labelledby={`office-${b.id}`}>
                  <p className="folio-kicker" data-reveal>
                    {b.role === 'head_office' ? 'Head office' : 'Branch'}
                  </p>
                  <h3 id={`office-${b.id}`} className="folio-trio-name" data-reveal>
                    <Link href={`/branches#${b.id}`}>{b.name}</Link>
                  </h3>
                  <address className="folio-trio-line not-italic" data-reveal>
                    {withPin(b.address, b.pincode)}
                  </address>
                </section>
              );
            })}
          </div>
          <div className="mt-14">
            <Prose>
              <p className="folio-first">
                Or call <a href={COMPANY.phone.href}>{COMPANY.phone.display}</a>, or write to{' '}
                <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.
              </p>
            </Prose>
            <Note className="mt-8">
              What is done with your details is in the{' '}
              <Link href="/privacy">privacy notice</Link>. To walk a layout,{' '}
              <Link href="/book-a-site-visit">arrange a site visit</Link>.
            </Note>
          </div>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
