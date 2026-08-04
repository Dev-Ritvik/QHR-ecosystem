// apps/public/src/app/(site)/(experience)/why-us/page.tsx
//
// A SURFACE read from the study.
//
// The placeholder this replaces promised two things the site does not do:
// "status is drawn live from our records — what you see is what remains", and
// "rates are computed from a published basis". Neither is true. We publish no
// availability (it changes weekly and a stale list is worse than none) and no
// price at all. A differentiators page that describes features we decided
// against is worse than no page, because every one of those claims is
// checkable in about four seconds.
//
// So each claim below is one this build actually keeps, and can be verified
// from the site itself without asking anyone.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'How we work — Quality Homes Reality',
  description:
    'Approved plans published in full, offices in the district where the land is, and no price on the website — what that means for a buyer.',
};

interface Claim {
  title: string;
  body: string;
  proof: { label: string; href: string };
}

const CLAIMS: Claim[] = [
  {
    title: 'The approved plan, not an impression',
    body:
      'Every layout on this site is published as the sanctioned drawing, with its approval number on the page — SUDA F.L.P. No. 10/2025/1178/DTCP/DPMS for Gayatri, a VMRDA layout for Kartikeya. You can download the full sheet and take it to the sub-registrar office before you speak to anyone.',
    proof: { label: 'Download the plans', href: '/downloads' },
  },
  {
    title: 'Offices in the district, not a call centre',
    body:
      'Visakhapatnam, Vizianagaram and Srikakulam. The people who answer an enquiry about a layout are the people who work at the site it belongs to, which is why an enquiry goes to a branch rather than to a queue.',
    proof: { label: 'See the offices', href: '/branches' },
  },
  {
    title: 'No price on the website',
    body:
      'Land rates move, and a figure left on a web page after it has stopped being true costs a buyer more than a blank space ever will. Ask the branch holding the layout and you get the rate for the size you want, on the day you ask, alongside which plots are actually free.',
    proof: { label: 'Ask about a layout', href: '/contact' },
  },
  {
    title: 'Sizes stated exactly',
    body:
      'Plot dimensions and road widths come off the approved plan, so 30 by 60 means thirty by sixty. Nothing is rounded up into a bigger-sounding number, and the road in front of your plot is the width the sanction says it is.',
    proof: { label: 'Compare the sizes', href: '/properties' },
  },
  {
    title: 'We develop what we sell',
    body:
      'Quality Homes Reality is not a broker placing other developers’ inventory. The layouts here are the company’s own, developed and managed directly, which is why there is nobody in between to blame when something needs fixing.',
    proof: { label: 'About the company', href: '/about' },
  },
];

export default function WhyUsPage() {
  return (
    <>
      <RouteTelemetry routeId="why-us" />
      <Surface
        eyebrow="How we work"
        title="Proof, not persuasion"
        lede="Five things this company does differently. Each one is checkable from this website before you give anybody your phone number."
      >
        <ol className="space-y-10">
          {CLAIMS.map((c, i) => (
            <li key={c.title} className="border-t border-white/10 pt-8 first:border-0 first:pt-0">
              <p className="text-xs tracking-[0.2em] text-[#F2EDE4]/35">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h2 className="mt-2 font-serif text-2xl text-[#F2EDE4]">{c.title}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#F2EDE4]/75">{c.body}</p>
              <p className="mt-4">
                <Link
                  href={c.proof.href}
                  className="text-xs uppercase tracking-[0.14em] text-[#F2EDE4]/60 underline-offset-4 hover:text-[#F2EDE4] hover:underline"
                >
                  {c.proof.label}
                </Link>
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-14 border-t border-white/10 pt-6 text-sm leading-relaxed text-[#F2EDE4]/55">
          What we do not claim matters too. There is no availability counter on
          this site, because plot status changes weekly and a stale one would
          mislead you with the authority of a real listing. There are no site
          photographs yet, and{' '}
          <Link className="underline underline-offset-4 hover:text-[#F2EDE4]" href="/gallery">
            the gallery says so
          </Link>{' '}
          rather than filling the space with stock imagery.
        </p>
      </Surface>
    </>
  );
}
