// apps/public/src/app/(site)/(experience)/knowledge/page.tsx
//
// A SURFACE read from the study. The index for short factual pieces.
//
// Two are written and live. The rest are listed as planned rather than
// published as thin filler — an index padded with stubs reads worse than a
// short index, and every piece here has to be worth a buyer's time or it is
// costing trust rather than building it.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'Knowledge — Quality Homes Reality',
  description:
    'Short, factual pieces on buying land in Vizianagaram and Srikakulam districts.',
};

const LIVE = [
  {
    href: '/investment-guide',
    title: 'Buying land in north coastal Andhra',
    blurb:
      'RERA registration, the four documents worth reading yourself, and what the new Bhogapuram airport does and does not change.',
    minutes: 6,
  },
  {
    href: '/knowledge/reading-a-layout-plan',
    title: 'How to read a layout plan',
    blurb:
      'Road widths, plot dimensions, open space and utility parcels — what the drawing tells you that a brochure will not.',
    minutes: 4,
  },
];

const PLANNED = [
  'What an encumbrance certificate actually shows',
  'Registration and stamp duty, step by step',
  'Gated layout maintenance: who pays for what, after the last plot sells',
];

export default function KnowledgePage() {
  return (
    <>
      <RouteTelemetry routeId="knowledge" />
      <Surface
        eyebrow="Knowledge"
        title="Worth knowing before you buy"
        lede="Short pieces on the parts of a land purchase that are easy to get wrong. Written to be useful even if you buy from someone else."
      >
        <div className="space-y-8">
          {LIVE.map((a) => (
            <article key={a.href} className="border-t border-white/10 pt-6 first:border-0 first:pt-0">
              <Link href={a.href} className="group">
                <h2 className="font-serif text-xl text-[#F2EDE4] underline-offset-4 group-hover:underline">
                  {a.title}
                </h2>
              </Link>
              <p className="mt-2 text-[15px] leading-relaxed text-[#F2EDE4]/70">
                {a.blurb}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[#F2EDE4]/60">
                {a.minutes} min read
              </p>
            </article>
          ))}
        </div>

        <section className="mt-14 border-t border-white/10 pt-6">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/60">
            Being written
          </h2>
          <ul className="mt-3 space-y-1.5 text-[15px] text-[#F2EDE4]/55">
            {PLANNED.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-[#F2EDE4]/50">
            Listed rather than published as stubs. A thin article costs more
            trust than a short list does.
          </p>
        </section>
      </Surface>
    </>
  );
}
