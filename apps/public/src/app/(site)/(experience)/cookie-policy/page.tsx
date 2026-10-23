// apps/public/src/app/(site)/(experience)/cookie-policy/page.tsx
//
// This one can be written accurately, because it describes cookies this
// codebase actually sets. Every name, purpose and lifetime below was read off
// the implementation rather than adapted from a template — see
// lib/consent/types.ts and middleware.ts.
//
// A FOLIO since 2026-10-06; its text and its two tables are what they were.

import type { Metadata } from 'next';
import { withShare } from '@/lib/share';
import Link from 'next/link';
import { Folio, Gilt, NextPage, Note, Plate, Prose, Sheet, Table } from '@/components/folio/Folio';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';
import { PRIVACY_CONTROL_NAME } from '@/lib/consent/types';
import { pageTitle, smallPrintAfter } from '@/components/site/siteMap';

export const metadata: Metadata = withShare('/cookie-policy', {
  title: pageTitle('/cookie-policy'),
  description:
    'Every cookie we set, what it is for, how long it lasts, and how to refuse or remove it.',
});

const ESSENTIAL = [
  {
    name: 'qhr_sid',
    purpose:
      'Identifies your visit, to keep a session together. Carries no profile and no name.',
    life: 'Deleted when you close the browser',
  },
  {
    name: 'qhr_consent',
    purpose:
      'Remembers the choices you made in the privacy panel, so you are not asked on every page.',
    life: '12 months',
  },
];

const OPTIONAL = [
  {
    name: 'qhr_vid',
    group: 'Analytics',
    purpose:
      'Recognises this browser if you return, so repeat visits count as one person. Only ever created after you turn Analytics on, and deleted the moment you turn it off.',
    life: '12 months',
  },
  {
    name: 'PostHog (ph_*)',
    group: 'Analytics',
    // (its last two words held together: "attention." stood alone on a tablet's line)
    purpose: 'Product analytics — which pages and projects hold attention.',
    life: 'Up to 12 months',
  },
  {
    name: 'Meta (_fbp, _fbc)',
    group: 'Marketing',
    purpose: 'Lets us show follow-ups on Facebook and Instagram about projects you viewed here.',
    life: 'Up to 3 months',
  },
  {
    name: 'Google (_ga, _gid, _gcl_au)',
    group: 'Marketing',
    purpose: 'Measurement and retargeting across Google services.',
    life: 'Up to 24 months',
  },
  {
    name: 'LinkedIn (bcookie, bscookie, li_sugr, lidc)',
    group: 'Marketing',
    purpose: 'Retargeting on LinkedIn.',
    life: 'Up to 12 months',
  },
];

function rows(list: { name: string; group?: string; purpose: string; life: string }[]) {
  return list.map((r) => [
    <>
      {r.name}
      {r.group ? <small>{r.group}</small> : null}
    </>,
    r.purpose,
    r.life,
  ]);
}

export default function CookiePolicyPage() {
  const next = smallPrintAfter('/cookie-policy');
  return (
    <>
      <RouteTelemetry routeId="cookie-policy" />
      <Folio>
        <Plate
          short
          long
          kicker="Cookies"
          title={
            <>
              What is stored <Gilt>on your device.</Gilt>
            </>
          }
          lede="Two cookies are strictly necessary. Everything else is off until you switch it on, and can be switched off again at any time."
          cue={{ label: 'Strictly necessary', href: '#needed' }}
        />

        <Sheet id="needed" rail="Strictly necessary" first layout="full" title="Strictly necessary">
          <Prose>
            <p>
              These carry no profiling and nothing that outlives your visit beyond remembering your
              own choices. They cannot be turned off: one keeps your session together, and the
              other remembers what you declined.
            </p>
          </Prose>
          <div className="mt-10">
            <Table head={['Cookie', 'Purpose', 'Lasts']} rows={rows(ESSENTIAL)} keep={[2]} />
          </div>
        </Sheet>

        <Sheet id="if-you-agree" rail="Only if you agree" layout="full" raised title="Only if you agree">
          <Prose>
            <p>
              Nothing in this group is set, and no request is made to any of these companies, until
              you turn the matching category on. Turning it off again stops collection immediately
              and deletes the cookies we can reach.
            </p>
          </Prose>
          <div className="mt-10">
            <Table head={['Cookie', 'Purpose', 'Lasts']} rows={rows(OPTIONAL)} keep={[2]} />
          </div>
        </Sheet>

        <Sheet id="changing" rail="Changing your mind" title="Changing your mind">
          <Prose>
            <p>
              Use the <strong>{PRIVACY_CONTROL_NAME}</strong> control at the foot of any page.
              The same panel has a control that deletes the data recorded during this visit. You
              can also clear cookies in your browser settings; everything continues to work, and
              you are asked for your choices again.
            </p>
          </Prose>
        </Sheet>

        <Sheet id="questions" rail="Questions" raised title="Questions">
          <Prose>
            <p>
              Written enquiries about cookies or personal data go to{' '}
              <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>, or by post to Quality Homes Reality,
              D.No. 50-92-36, 2nd Floor, Opp. Canara Bank, Shantipuram, Shankara Matam Road,
              Visakhapatnam&nbsp;530016, Andhra Pradesh.
            </p>
          </Prose>
          <Note className="mt-8">
            See also our <Link href="/privacy">privacy notice</Link>.
          </Note>
        </Sheet>

        <NextPage href={next.href} title={next.name} line={next.line} />
      </Folio>
    </>
  );
}
