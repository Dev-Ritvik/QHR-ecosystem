// apps/public/src/app/(site)/(experience)/cookie-policy/page.tsx
//
// This one can be written accurately, because it describes cookies this
// codebase actually sets. Every name, purpose and lifetime below was read off
// the implementation rather than adapted from a template — see
// lib/consent/types.ts and middleware.ts.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'Cookies — Quality Homes Reality',
  description:
    'Every cookie this site sets, what it is for, how long it lasts, and how to refuse or remove it.',
};

const ESSENTIAL = [
  {
    name: 'qhr_sid',
    purpose:
      'Identifies your visit so the site can keep a session together. Carries no profile and no name.',
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
      'Recognises this browser if you return, so repeat visits are counted as one person rather than several. Only ever created after you turn Analytics on, and deleted the moment you turn it off.',
    life: '12 months',
  },
  {
    name: 'PostHog (ph_*)',
    group: 'Analytics',
    purpose: 'Product analytics — which pages and projects hold attention.',
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

export default function CookiePolicyPage() {
  return (
    <>
      <RouteTelemetry routeId="cookie-policy" />
      <Surface
        eyebrow="Cookies"
        title="What this site stores on your device"
        lede="Two cookies are needed to run the site. Everything else is off until you switch it on, and can be switched off again at any time."
      >
        <h2 className="font-serif text-xl text-[#F2EDE4]">Needed to run the site</h2>
        <p>
          These carry no profiling and nothing that outlives your visit beyond
          remembering your own choices. They cannot be turned off, because
          without them the site cannot keep a session together or remember that
          you declined anything.
        </p>
        <CookieTable rows={ESSENTIAL} />

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          Only if you agree
        </h2>
        <p>
          Nothing in this group is set, and no request is made to any of these
          companies, until you turn the matching category on. Turning it off
          again stops collection immediately and deletes the cookies we can
          reach.
        </p>
        <CookieTable rows={OPTIONAL} />

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">
          Changing your mind
        </h2>
        <p>
          Use the <strong className="text-[#F2EDE4]">Privacy &amp; data choices</strong>{' '}
          control at the foot of any page. The same panel has a control that
          deletes the data recorded during this visit. You can also clear
          cookies in your browser settings; the site continues to work, and you
          will simply be asked for your choices again.
        </p>

        <h2 className="mt-12 font-serif text-xl text-[#F2EDE4]">Questions</h2>
        <p>
          Written enquiries about cookies or personal data go to{' '}
          <a className="underline underline-offset-4" href="mailto:devritvik70@gmail.com">Dev Ritvik, devritvik70@gmail.com</a> at Quality
          Homes Reality, D.No. 50-92-36, 2nd Floor, Opp. Canara Bank,
          Shantipuram, Shankara Matam Road, Visakhapatnam 530 016, Andhra
          Pradesh.
        </p>
        <p className="text-sm text-[#F2EDE4]/60">
          See also our <Link className="underline underline-offset-4" href="/privacy">privacy notice</Link>.
        </p>
      </Surface>
    </>
  );
}

function CookieTable({
  rows,
}: {
  rows: { name: string; group?: string; purpose: string; life: string }[];
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/15 text-xs uppercase tracking-[0.14em] text-[#F2EDE4]/50">
            <th className="py-3 pr-4 font-normal">Cookie</th>
            <th className="py-3 pr-4 font-normal">Purpose</th>
            <th className="py-3 font-normal">Lasts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-white/10 align-top">
              <td className="py-4 pr-4 font-mono text-[13px] text-[#F2EDE4]">
                {r.name}
                {r.group && (
                  <span className="mt-1 block text-[10px] uppercase tracking-widest text-[#F2EDE4]/40">
                    {r.group}
                  </span>
                )}
              </td>
              <td className="py-4 pr-4 text-[#F2EDE4]/75">{r.purpose}</td>
              <td className="py-4 whitespace-nowrap text-[#F2EDE4]/60">{r.life}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
