// apps/public/src/app/(site)/(experience)/privacy/page.tsx
//
// Written from the implementation, not from a template: every category, purpose
// and retention period below matches what the code actually does. Where a fact
// is organisational rather than technical — the registered entity, the Data
// Protection Officer — it is marked pending, because inventing it would be
// worse than leaving it blank.
//
// A FOLIO since 2026-10-06, and not a word of it changed in the setting: a
// notice of this kind is read for what it commits to, and a redesign is no
// occasion to reword a commitment.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { Pending, PendingNotice, pendingRobots } from '@/components/experience/Pending';
import { Folio, Gilt, NextPage, Note, Plate, Prose, Sheet } from '@/components/folio/Folio';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';
import { PRIVACY_CONTROL_NAME } from '@/lib/consent/types';
import { pageTitle, smallPrintAfter } from '@/components/site/siteMap';

export const metadata: Metadata = withShare('/privacy', {
  title: pageTitle('/privacy'),
  description:
    'What we collect, why, how long we keep it, and the rights you have over it under the Digital Personal Data Protection Act 2023.',
  ...pendingRobots,
});

export default function PrivacyPage() {
  const next = smallPrintAfter('/privacy');
  return (
    <>
      <RouteTelemetry routeId="privacy" />
      <Folio>
        <Plate
          short
          long
          kicker="Privacy"
          title={
            <>
              How we handle <Gilt>your information.</Gilt>
            </>
          }
          lede="Written plainly. Until you say otherwise the one record is what keeps your visit together, and you can withdraw or delete at any time."
          cue={{ label: 'Who is responsible', href: '#who' }}
        />

        <Sheet
          id="who"
          rail="Who is responsible"
          first
          title="Who is responsible"
        >
          <PendingNotice what="The technical descriptions here match the software as built." />
          <Prose>
            <p>
              Quality Homes Reality, head office at D.No. 50-92-36, 2nd Floor, Opp. Canara Bank,
              Shantipuram, Shankara Matam Road, Visakhapatnam&nbsp;530016, Andhra Pradesh, with branches
              at Vizianagaram and Srikakulam. Registered entity name and identifiers:{' '}
              <Pending>REGISTERED NAME, CIN / GST</Pending>.
            </p>
            {/* THE COMPANY'S OWN ADDRESS (lib/contact.ts: the one the offices
                read). This named the site's developer and his personal
                mailbox as the company's Data Protection Officer — a
                placeholder that went live (the forensic audit of 2026-10-09,
                #82). An officer by name is the company's to appoint and is
                not invented here. */}
            <p>
              Questions and grievances about how your data has been handled go to the head office
              first, at <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="what"
          rail="What we collect"
          title={
            <>
              What we <Gilt>collect.</Gilt>
            </>
          }
        >
          <Prose>
            <p>
              <strong>Always.</strong> A session identifier that lets the site keep your visit
              together, plus your recorded privacy choices. Neither identifies you, and the session
              identifier is deleted when you close your browser.
            </p>
            <p>
              <strong>Only if you enable Analytics.</strong> Which pages and which project layouts
              you spend time with, how long, how deep you read, and which plots you look at in the
              3D hall. This is recorded against a random identifier, not your name. If you later
              submit an enquiry, this history is attached to it so the branch handling your enquiry
              knows which layouts you were actually interested in.
            </p>
            <p>
              <strong>Only if you enable Marketing.</strong> Meta, Google and LinkedIn are told
              which projects you viewed, so follow-ups you see elsewhere are about those projects.
            </p>
            <p>
              <strong>When you contact us.</strong> Your name, phone number and anything you write
              in the enquiry form, so that somebody can call you back.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="not"
          rail="What we do not do"
          raised
          title="What we deliberately do not do"
        >
          <Prose>
            <p>
              We do not record what you type into a form unless you submit it. We do not
              fingerprint your device to follow you past a cleared cookie. We do not infer your
              income from your hardware, guess at your household from how you move a camera, read
              your clipboard, or try to match you to a profile on another device. Each of these was
              considered and rejected.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="how-long"
          rail="How long"
          title="How long we keep it"
        >
          <Prose>
            <ul>
              <li>Detailed visit records: 13 months, then aggregated and deleted.</li>
              <li>Visits that never led to an enquiry: 90 days, then deleted entirely.</li>
              <li>
                Enquiries and the visit history attached to them:{' '}
                <Pending>RETENTION PERIOD FOR LEAD RECORDS</Pending>.
              </li>
            </ul>
          </Prose>
        </Sheet>

        <Sheet
          id="rights"
          rail="Your rights"
          raised
          title="Your rights"
        >
          <Prose>
            <p>
              Under the Digital Personal Data Protection Act 2023 you may ask for a copy of what we
              hold, ask us to correct it, ask us to erase it, and raise a grievance about how it was
              handled. You may also nominate someone to exercise these rights on your behalf.
            </p>
            <p>
              For this visit, two of those are immediate: the{' '}
              <strong>{PRIVACY_CONTROL_NAME}</strong> control at the foot of any page shows your
              current choices and will delete the data from this visit on the spot. For anything
              held against an enquiry you have submitted, write to the head office at the address
              above and we will respond within <Pending>RESPONSE PERIOD</Pending>.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="children"
          rail="Children"
          title="Children"
        >
          <Prose>
            <p>
              This site is intended for adults buying property. We do not knowingly collect data
              from anyone under 18, and no behavioural tracking or targeted advertising is directed
              at children.
            </p>
          </Prose>
        </Sheet>

        <Sheet
          id="who-else"
          rail="Who else sees it"
          raised
          title="Who else sees it"
        >
          <Prose>
            <p>
              Enquiries are handled by the Quality Homes Reality branch that holds the layout you
              asked about. Analytics and advertising data go to the providers named in the{' '}
              <Link href="/cookie-policy">cookie policy</Link>, and only for the categories you
              enabled. Other processors: <Pending>HOSTING, CRM AND STORAGE PROVIDERS</Pending>.
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
