// apps/public/src/app/(site)/(experience)/careers/page.tsx
//
// A FOLIO with a short plate, read from the desk.
//
// Roles, requirements and contact details are transcribed from the career page
// on qualityhomesreality.com, which the client owns. Nothing about salary,
// benefits, team size or culture is stated, because none of that appears there
// and a careers page that invents it is the fastest way to lose a candidate in
// their first week.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { Folio, Gilt, Ledger, NextPage, Note, Plate, Prose, Sheet } from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { COMPANY } from '@/lib/company';
import { CONTACT_EMAIL } from '@/lib/contact';

export const metadata: Metadata = withShare('/careers', {
  title: pageTitle('/careers'),
  description:
    'Open roles at Quality Homes Reality across Visakhapatnam, Vizianagaram and Srikakulam.',
});

const ROLES = [
  {
    title: 'Sales Executive',
    experience: '1–3 years, real estate preferred',
    education: 'Any graduate',
    location: 'Andhra Pradesh',
  },
  {
    title: 'Senior Sales Executive',
    experience: '1–4 years, real estate preferred',
    education: 'Any graduate',
    location: 'Andhra Pradesh',
  },
];

const APPLY_EMAIL = CONTACT_EMAIL;

export default function CareersPage() {
  const next = pageAfter('/careers');
  return (
    <>
      <RouteTelemetry routeId="careers" />
      <Folio>
        <Plate
          short
          kicker="The company"
          title={
            <>
              We sell land <Gilt>we have walked.</Gilt>
            </>
          }
          lede="The roles open now, for people who want to know a site properly before they speak about it."
          cue={{ label: 'The roles', href: '#roles' }}
        />

        <Sheet
          id="roles"
          rail="The roles"
          first
          kicker="Open now"
          title={
            <>
              Two sales roles <Gilt>are open.</Gilt>
            </>
          }
          note="As the company lists them. Ask about pay and benefits when you apply."
        >
          <div className="folio-roles">
            {ROLES.map((r) => (
              <section key={r.title} aria-labelledby={`role-${r.title.replace(/\s+/g, '-').toLowerCase()}`}>
                <h3
                  id={`role-${r.title.replace(/\s+/g, '-').toLowerCase()}`}
                  className="folio-role-name"
                  data-reveal
                >
                  {r.title}
                </h3>
                <Ledger
                  rows={[
                    { term: 'Experience', value: r.experience },
                    { term: 'Education', value: r.education },
                    { term: 'Location', value: r.location },
                  ]}
                />
              </section>
            ))}
          </div>
        </Sheet>

        <Sheet
          id="apply"
          rail="How to apply"
          raised
          kicker="How to apply"
          title={
            <>
              Send a CV <Gilt>with the role named.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              Send a CV to{' '}
              <a href={`mailto:${APPLY_EMAIL}?subject=Application%20%E2%80%94%20Sales%20Executive`}>
                {APPLY_EMAIL}
              </a>
              , naming the role in the subject line.
            </p>
            <p>
              Applications are read at the Visakhapatnam head office and passed to whichever branch
              is hiring.
            </p>
            <p>
              To ask about a role before applying, telephone{' '}
              <a href={COMPANY.phone.href}>{COMPANY.phone.display}</a>.
            </p>
          </Prose>
          <Note className="mt-10">
            A CV sent to us is handled as set out in the <Link href="/privacy">privacy notice</Link>.
            Office addresses are on the <Link href="/branches">offices page</Link>.
          </Note>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
