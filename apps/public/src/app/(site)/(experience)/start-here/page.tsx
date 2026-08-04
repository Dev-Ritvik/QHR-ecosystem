// apps/public/src/app/(site)/(experience)/start-here/page.tsx
//
// A PLACE (mapped to 'arrival'). The deliberate way OUT of the cinematic.
//
// This route exists because the visitors who convert fastest are the ones the
// experience annoys most: somebody who already knows they want a 30×60 in
// Vizianagaram does not want a camera flight, they want the plan and a phone
// number. Without this, the 3D costs the client exactly the leads it was built
// to win.
//
// So: no scene dependency, no motion, shortest possible path to a plan, a price
// conversation, or a site visit.

import type { Metadata } from 'next';
import Link from 'next/link';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { PROJECTS } from '@estate/domain/leads/branches';

export const metadata: Metadata = {
  title: 'Start here — Quality Homes Reality',
  description:
    'The short version: three approved layouts in Vizianagaram and Srikakulam, the plans to download, and how to reach the office that holds each one.',
};

const PATHS = [
  {
    href: '/properties',
    label: 'I know the size I want',
    blurb: 'Plot sizes and road widths across all three layouts, side by side.',
  },
  {
    href: '/downloads',
    label: 'Give me the plans',
    blurb: 'All three approved layout plans as PDFs, ready to print or send on.',
  },
  {
    href: '/contact',
    label: 'I want to speak to someone',
    blurb:
      'One enquiry, routed to the office that holds the layout you ask about.',
  },
  {
    href: '/investment-guide',
    label: 'I am checking this out first',
    blurb:
      'What to verify before money moves, and what the new Bhogapuram airport does and does not change.',
  },
];

export default function StartHerePage() {
  return (
    <>
      <RouteTelemetry routeId="start-here" />
      <main className="relative z-10 mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-[#F2EDE4]/50">
          Start here
        </p>
        <h1 className="mt-3 font-serif text-3xl text-[#F2EDE4] md:text-4xl">
          The short version
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#F2EDE4]/75">
          Quality Homes Reality sells plotted land in the northern coastal
          districts of Andhra Pradesh, from offices in Visakhapatnam,
          Vizianagaram and Srikakulam. Three layouts are open. Every one of them
          is approved, and every plan on this site is the approved drawing rather
          than an artist&rsquo;s impression.
        </p>

        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/45">
            The three layouts
          </h2>
          <ul className="mt-4 space-y-3">
            {PROJECTS.map((p) => (
              <li key={p.slug} className="flex flex-wrap items-baseline gap-x-3">
                <Link
                  href={`/projects/${p.slug}`}
                  className="font-serif text-lg text-[#F2EDE4] underline-offset-4 hover:underline"
                >
                  {p.name}
                </Link>
                <span className="text-sm text-[#F2EDE4]/50">
                  {p.locality} &middot; {p.district}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[#F2EDE4]/45">
            Where do you want to go?
          </h2>
          <ul className="mt-4 space-y-3">
            {PATHS.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="block rounded border border-white/12 px-5 py-4 transition hover:border-amber-200/50"
                >
                  <span className="font-serif text-lg text-[#F2EDE4]">
                    {p.label}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-[#F2EDE4]/60">
                    {p.blurb}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 text-sm leading-relaxed text-[#F2EDE4]/55">
          Prefer to look around instead? The three layouts stand as raised models
          in{' '}
          <Link className="underline underline-offset-4 hover:text-[#F2EDE4]" href="/hall">
            the hall
          </Link>
          . Nothing on this page needs it.
        </p>
      </main>
    </>
  );
}
