// apps/public/src/app/(site)/(experience)/branches/page.tsx
//
// A FOLIO, read from the map table. Every address is transcribed from the VSR
// Gayatri Township brochure, which carries the head office and both branches
// on its back panel (packages/domain/src/leads/branches.ts keeps them, and
// which office holds which layout).

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import { BRANCHES, PROJECTS } from '@estate/domain/leads/branches';
import {
  Actions,
  Folio,
  Gilt,
  Go,
  IndexList,
  Ledger,
  NextPage,
  Plate,
  Prose,
  Sheet,
  Window,
} from '@/components/folio/Folio';
import { pageAfter, pageTitle } from '@/components/site/siteMap';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { COMPANY } from '@/lib/company';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';
import { withPin } from '@/lib/units';

export const metadata: Metadata = withShare('/branches', {
  title: pageTitle('/branches'),
  description:
    'Head office in Visakhapatnam, with branches at Vizianagaram and Srikakulam. Each office holds the layouts in its own district.',
});

const ORDER = ['visakhapatnam', 'vizianagaram', 'srikakulam'] as const;

export default function BranchesPage() {
  const next = pageAfter('/branches');
  return (
    <>
      <RouteTelemetry routeId="branches" />
      <Folio>
        <Plate
          kicker="The company"
          title={
            <>
              Three offices, <Gilt>three districts.</Gilt>
            </>
          }
          lede="Each office holds the layouts on its own ground. When you enquire, you reach the people who have walked that land."
          cue={{ label: BRANCHES[ORDER[0]].name, href: `#${ORDER[0]}` }}
        />

        {ORDER.map((id, i) => {
          const b = BRANCHES[id];
          const held = PROJECTS.filter((p) => p.branch === id);
          return (
            <Sheet
              key={b.id}
              id={b.id}
              rail={b.name}
              first={i === 0}
              raised={i % 2 === 1}
              kicker={b.role === 'head_office' ? 'Head office' : 'Branch'}
              title={
                <>
                  {b.name}
                  <Gilt>.</Gilt>
                </>
              }
            >
              <Ledger
                rows={[
                  {
                    term: 'Address',
                    value: (
                      <address className="not-italic">
                        {withPin(b.address, b.pincode)}, Andhra Pradesh
                      </address>
                    ),
                  },
                  // The one number the company prints is the head office's.
                  ...(b.role === 'head_office'
                    ? [
                        {
                          term: 'Telephone',
                          value: (
                            <a className="folio-link" href={COMPANY.phone.href}>
                              {COMPANY.phone.display}
                            </a>
                          ),
                        },
                      ]
                    : []),
                ]}
              />

              <div className="mt-12">
                <h3 className="folio-sub" data-reveal>
                  Layouts held here
                </h3>
                {held.length > 0 ? (
                  <IndexList
                    two
                    items={held.map((p) => ({
                      href: `/projects/${p.slug}`,
                      name: p.name,
                      line: (
                        <>
                          {p.locality}, {p.district} district
                        </>
                      ),
                    }))}
                  />
                ) : (
                  // Visakhapatnam holds no layout of its own today: what it
                  // does is said, in place of a list.
                  <p className="folio-standfirst is-small" data-reveal>
                    The head office handles general enquiries and anything spanning more than one
                    district.
                  </p>
                )}
              </div>
            </Sheet>
          );
        })}

        <Window gloss="It reaches whichever office holds the layout you were looking at.">
          Not sure which office? <Gilt>Send one enquiry.</Gilt>
        </Window>

        <Sheet
          id="write"
          rail="Write or call"
          kicker="Write or call"
          title={
            <>
              One number, <Gilt>one address to write to.</Gilt>
            </>
          }
        >
          <Prose>
            <p className="folio-first">
              Telephone the head office on{' '}
              <a href={COMPANY.phone.href}>{COMPANY.phone.display}</a>, or write to{' '}
              <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.
            </p>
            <p>
              Say which layout you are asking about, and the enquiry goes to the office that holds
              it.
            </p>
          </Prose>
          <Actions>
            <Go href="/contact">Send an enquiry</Go>
            <Go href="/book-a-site-visit">Arrange a site visit</Go>
          </Actions>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
