// apps/public/src/app/(site)/(experience)/properties/page.tsx
//
// A PLACE (mapped to 'table'), so no Surface wrapper.
//
// Plot SIZES are published here because they are printed on the approved layout
// plans and do not change. Plot-level AVAILABILITY is not, and the page says so
// rather than showing a number that would be stale within a week.
//
// The projection database currently holds seed inventory for two unrelated
// projects, not these three, so wiring this to live unit data would show a
// buyer the wrong thing with the authority of a real listing. That is worse
// than an honest gap, and it is why this reads from the layout plans instead.

import type { Metadata } from 'next';
import Link from 'next/link';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'Plots — Quality Homes Reality',
  description:
    'Plot sizes across Kartikeya Water Front, Lucky Garden and VSR Gayatri Township, and how to check what is available.',
};

interface Inventory {
  slug: string;
  name: string;
  where: string;
  district: string;
  sizes: string[];
  roads: string;
  approval: string;
}

const INVENTORY: Inventory[] = [
  {
    slug: 'kartikeya-water-front',
    name: 'Kartikeya Water Front',
    where: 'Poosapatirega',
    district: 'Vizianagaram',
    sizes: ['30′ × 50′', '30′ × 56′', '30′ × 60′'],
    roads: '40′ and 30′ internal roads, blacktop with street lighting',
    approval: 'VMRDA RERA layout',
  },
  {
    slug: 'lucky-garden',
    name: 'Lucky Garden',
    where: 'Kumaram Village, Garividi',
    district: 'Vizianagaram',
    sizes: ['15′ × 60′', '18′ × 60′'],
    roads: '20′ proposed internal roads',
    approval: 'See the layout plan for the approval block',
  },
  {
    slug: 'vsr-gayatri-township',
    name: 'VSR Gayatri Township',
    where: 'Bayyannapeta, near Allinagaram',
    district: 'Srikakulam',
    sizes: ['60′ × 30′'],
    roads: '40′ internal roads throughout',
    approval: 'SUDA approved · F.L.P. No. 10/2025/1178/DTCP/DPMS',
  },
];

export default function PropertiesPage() {
  return (
    <>
      <RouteTelemetry routeId="properties" />
      <main className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-[#F2EDE4]/50">
          Plots
        </p>
        <h1 className="mt-3 font-serif text-3xl text-[#F2EDE4] md:text-4xl">
          What is on offer, and where
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#F2EDE4]/70">
          Sizes and road widths are taken from the approved layout plans, so they
          are exact. Which individual plots remain is not published here — it
          changes weekly, and a stale availability list is worse than none.
        </p>

        <div className="mt-12 space-y-10">
          {INVENTORY.map((i) => (
            <section key={i.slug} className="border-t border-white/10 pt-8">
              <h2 className="font-serif text-2xl text-[#F2EDE4]">{i.name}</h2>
              <p className="mt-1 text-sm text-[#F2EDE4]/55">
                {i.where} &middot; {i.district} district
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {i.sizes.map((s) => (
                  <span
                    key={s}
                    className="rounded border border-white/15 px-3 py-1.5 font-mono text-[13px] text-[#F2EDE4]/85"
                  >
                    {s}
                  </span>
                ))}
              </div>

              <dl className="mt-5 space-y-2 text-[15px]">
                <div className="flex flex-wrap gap-x-3">
                  <dt className="text-[#F2EDE4]/45">Roads</dt>
                  <dd className="text-[#F2EDE4]/80">{i.roads}</dd>
                </div>
                <div className="flex flex-wrap gap-x-3">
                  <dt className="text-[#F2EDE4]/45">Approval</dt>
                  <dd className="text-[#F2EDE4]/80">{i.approval}</dd>
                </div>
              </dl>

              <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <Link
                  className="uppercase tracking-[0.14em] text-[#F2EDE4]/60 underline-offset-4 hover:text-[#F2EDE4] hover:underline"
                  href={`/projects/${i.slug}`}
                >
                  The layout
                </Link>
                <Link
                  className="uppercase tracking-[0.14em] text-[#F2EDE4]/60 underline-offset-4 hover:text-[#F2EDE4] hover:underline"
                  href="/hall"
                >
                  See it raised
                </Link>
              </p>
            </section>
          ))}
        </div>

        <section className="mt-14 border-t border-white/10 pt-8">
          <h2 className="font-serif text-xl text-[#F2EDE4]">
            Checking what is free
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#F2EDE4]/70">
            Ask the branch that holds the layout and they will tell you which
            plot numbers are open that day, with the current price for the size
            you want. No price is published on this site, because a figure that
            drifts out of date does a buyer more harm than no figure at all.
          </p>
          <p className="mt-5">
            <Link
              href="/contact"
              className="inline-block rounded border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.14em] text-[#F2EDE4] transition hover:border-amber-200/60"
            >
              Ask about availability
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
