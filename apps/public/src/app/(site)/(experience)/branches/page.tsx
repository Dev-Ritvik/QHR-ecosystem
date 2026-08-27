// apps/public/src/app/(site)/(experience)/branches/page.tsx
//
// A PLACE (mapped to 'window'), so no Surface wrapper — the world stays open
// behind it. Every address is transcribed from the VSR Gayatri Township
// brochure, which carries the head office and both branches on its back panel.

import type { Metadata } from 'next';
import Link from 'next/link';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { BRANCHES, PROJECTS } from '@estate/domain/leads/branches';

export const metadata: Metadata = {
  title: 'Offices — Quality Homes Reality',
  description:
    'Head office in Visakhapatnam, with branches at Vizianagaram and Srikakulam. Each office holds the layouts in its own district.',
};

const ORDER = ['visakhapatnam', 'vizianagaram', 'srikakulam'] as const;

export default function BranchesPage() {
  return (
    <>
      <RouteTelemetry routeId="branches" />
      <main className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-[#F2EDE4]/50">
          Offices
        </p>
        <h1 className="mt-3 font-serif text-3xl text-[#F2EDE4] md:text-4xl">
          Three offices, three districts
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#F2EDE4]/70">
          Each office holds the layouts on its own ground. When you enquire, you
          reach the people who have walked that site — not a call centre.
        </p>

        <div className="mt-12 space-y-10">
          {ORDER.map((id) => {
            const b = BRANCHES[id];
            const held = PROJECTS.filter((p) => p.branch === id);
            return (
              <section key={b.id} className="border-t border-white/10 pt-8">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h2 className="font-serif text-2xl text-[#F2EDE4]">{b.name}</h2>
                  <span className="text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/60">
                    {b.role === 'head_office' ? 'Head office' : 'Branch'}
                  </span>
                </div>

                <address className="mt-4 not-italic text-[15px] leading-relaxed text-[#F2EDE4]/75">
                  {b.address}
                  <br />
                  {b.name} &ndash; {b.pincode}, Andhra Pradesh
                </address>

                <div className="mt-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/60">
                    Layouts held here
                  </p>
                  {held.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {held.map((p) => (
                        <li key={p.slug}>
                          <Link
                            href={`/projects/${p.slug}`}
                            className="text-[15px] text-[#F2EDE4]/85 underline-offset-4 hover:text-[#F2EDE4] hover:underline"
                          >
                            {p.name}
                          </Link>
                          <span className="ml-2 text-sm text-[#F2EDE4]/60">
                            {p.locality}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    // Visakhapatnam holds no layout of its own today. Saying so
                    // is better than an empty heading that reads as an omission.
                    <p className="mt-2 text-[15px] text-[#F2EDE4]/60">
                      No layout of its own at present. The head office handles
                      general enquiries and anything spanning more than one
                      district.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <p className="mt-14 text-[15px] text-[#F2EDE4]/60">
          Not sure which office to ask?{' '}
          <Link className="underline underline-offset-4 hover:text-[#F2EDE4]" href="/contact">
            Send one enquiry
          </Link>{' '}
          and it reaches whichever office holds the layout you were looking at.
        </p>
      </main>
    </>
  );
}
