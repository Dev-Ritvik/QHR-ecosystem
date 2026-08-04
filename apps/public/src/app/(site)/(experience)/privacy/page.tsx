// apps/public/src/app/(site)/(experience)/privacy/page.tsx
//
// Written from the implementation, not from a template: every category, purpose
// and retention period below matches what the code actually does. Where a fact
// is organisational rather than technical — the registered entity, the Data
// Protection Officer — it is marked pending, because inventing it would be
// worse than leaving it blank.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { Pending, PendingNotice, pendingRobots } from '@/components/experience/Pending';

export const metadata: Metadata = {
  title: 'Privacy — Quality Homes Reality',
  description:
    'What we collect, why, how long we keep it, and the rights you have over it under the Digital Personal Data Protection Act 2023.',
  ...pendingRobots,
};

export default function PrivacyPage() {
  return (
    <>
      <RouteTelemetry routeId="privacy" />
      <Surface
        eyebrow="Privacy"
        title="What we collect, and what you can do about it"
        lede="Written plainly. Nothing beyond what is needed to run this site is recorded until you say so, and you can withdraw or delete at any time."
      >
        <PendingNotice what="The technical descriptions here match the software as built." />

        <h2 className="font-serif text-xl text-[#F2EDE4]">Who is responsible</h2>
        <p>
          Quality Homes Reality, head office at D.No. 50-92-36, 2nd Floor, Opp.
          Canara Bank, Shantipuram, Shankara Matam Road, Visakhapatnam 530 016,
          Andhra Pradesh, with branches at Vizianagaram and Srikakulam.
          Registered entity name and identifiers:{' '}
          <Pending>REGISTERED NAME, CIN / GST</Pending>.
        </p>
        <p>
          Data Protection Officer:{' '}
          Dev Ritvik, <a className="underline underline-offset-4" href="mailto:devritvik70@gmail.com">devritvik70@gmail.com</a>. Grievances about how
          your data has been handled go here first.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          What we collect, and when
        </h2>
        <p>
          <strong className="text-[#F2EDE4]">Always.</strong> A session
          identifier that lets the site keep your visit together, plus your
          recorded privacy choices. Neither identifies you, and the session
          identifier is deleted when you close your browser.
        </p>
        <p>
          <strong className="text-[#F2EDE4]">Only if you enable Analytics.</strong>{' '}
          Which pages and which project layouts you spend time with, how long,
          how deep you read, and which plots you look at in the 3D hall. This is
          recorded against a random identifier, not your name. If you later
          submit an enquiry, this history is attached to it so the branch
          handling your enquiry knows which layouts you were actually
          interested in.
        </p>
        <p>
          <strong className="text-[#F2EDE4]">Only if you enable Marketing.</strong>{' '}
          Meta, Google and LinkedIn are told which projects you viewed, so
          follow-ups you see elsewhere are about those rather than at random.
        </p>
        <p>
          <strong className="text-[#F2EDE4]">When you contact us.</strong> Your
          name, phone number and anything you write in the enquiry form, so that
          somebody can call you back.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          What we deliberately do not do
        </h2>
        <p>
          We do not record what you type into a form unless you submit it. We do
          not fingerprint your device to follow you past a cleared cookie. We do
          not infer your income from your hardware, guess at your household from
          how you move a camera, read your clipboard, or try to match you to a
          profile on another device. Each of these was considered and rejected.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">How long we keep it</h2>
        <ul className="list-disc space-y-2 pl-5 marker:text-[#F2EDE4]/40">
          <li>Detailed visit records: 13 months, then aggregated and deleted.</li>
          <li>
            Visits that never led to an enquiry: 90 days, then deleted entirely.
          </li>
          <li>
            Enquiries and the visit history attached to them:{' '}
            <Pending>RETENTION PERIOD FOR LEAD RECORDS</Pending>.
          </li>
        </ul>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">Your rights</h2>
        <p>
          Under the Digital Personal Data Protection Act 2023 you may ask for a
          copy of what we hold, ask us to correct it, ask us to erase it, and
          raise a grievance about how it was handled. You may also nominate
          someone to exercise these rights on your behalf.
        </p>
        <p>
          For this visit, two of those are immediate: the{' '}
          <strong className="text-[#F2EDE4]">Privacy &amp; data choices</strong>{' '}
          control at the foot of any page shows your current choices and will
          delete the data from this visit on the spot. For anything held against
          an enquiry you have submitted, write to the Data Protection Officer
          above and we will respond within{' '}
          <Pending>RESPONSE PERIOD</Pending>.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">Children</h2>
        <p>
          This site is intended for adults buying property. We do not knowingly
          collect data from anyone under 18, and no behavioural tracking or
          targeted advertising is directed at children.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">Who else sees it</h2>
        <p>
          Enquiries are handled by the Quality Homes Reality branch that holds
          the layout you asked about. Analytics and advertising data go to the
          providers named in the{' '}
          <Link className="underline underline-offset-4" href="/cookie-policy">
            cookie policy
          </Link>
          , and only for the categories you enabled. Other processors:{' '}
          <Pending>HOSTING, CRM AND STORAGE PROVIDERS</Pending>.
        </p>

        <p className="mt-12 text-sm text-[#F2EDE4]/50">
          Last updated: <Pending>DATE ON PUBLICATION</Pending>.
        </p>
      </Surface>
    </>
  );
}
