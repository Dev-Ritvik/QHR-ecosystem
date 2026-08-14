// apps/public/src/app/(site)/site-home/page.tsx
//
// The flat project index, outside the cinematic — what a search engine and a
// shared link land on.
//
// The copy this replaces offered "premium plotted developments, commercial
// spaces, and luxury residences". Two of those three do not exist: every open
// project is plotted land. Describing a portfolio we do not have is the kind
// of claim a buyer disproves by scrolling.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedProjects } from '@/lib/projection';
import { ProjectCard } from '@/components/site/ProjectCard';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

// ISR: Background revalidation every hour, unless manually cleared by the webhook (T37)
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Plotted layouts in Vizianagaram & Srikakulam — Quality Homes Reality',
  description:
    'Approved plotted layouts across the northern coastal districts of Andhra Pradesh, from a developer twenty years in the field. Plans published in full; prices on request from the branch that holds the site.',
};

export default async function SiteHomePage() {
  const projects = await getPublishedProjects();

  const availableProjects = projects.filter((p: any) => !p.isSoldOut);
  const soldOutProjects = projects.filter((p: any) => p.isSoldOut);

  return (
    // Asymmetric on purpose. A centred max-width column with three equal cards
    // under it is the shape every template ships with; holding the copy to the
    // left seven columns and letting the right breathe is what gives the page
    // tension rather than symmetry.
    <main className="mx-auto max-w-6xl px-6 pb-28 pt-20 md:pt-28">
      <RouteTelemetry routeId="site-home" />

      <header className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7">
          {/* t-display, not an ad-hoc text-4xl/5xl/6xl ladder. The scale is
              fluid via clamp(), so it never jumps at a breakpoint. */}
          <h1 className="t-display text-[#F2EDE4]">
            Land, in the districts
            <br className="hidden sm:block" /> we come from
          </h1>
          <p className="t-lede mt-8 max-w-xl text-[#F2EDE4]/70">
            Approved plotted layouts in Vizianagaram and Srikakulam, developed
            and sold directly by Quality Homes Reality. Every sanctioned plan is
            published in full below &mdash; sizes exactly as drawn, and the rate
            for the size you want from the office that holds the site.
          </p>
          <p className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
            <Link
              href="/start-here"
              className="t-eyebrow group inline-flex items-center gap-2 text-[#E8B98A] transition-colors hover:text-[#F2EDE4]"
            >
              In a hurry? Start here
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                &rarr;
              </span>
            </Link>
            <Link
              href="/hall"
              className="t-eyebrow group inline-flex items-center gap-2 text-[#F2EDE4]/45 transition-colors hover:text-[#F2EDE4]"
            >
              See the layouts raised
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                &rarr;
              </span>
            </Link>
          </p>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="mt-24 border-t border-white/10 pt-16">
          <p className="t-h3 text-[#F2EDE4]/70">No layouts are open right now.</p>
          <p className="t-body mt-3 text-[#F2EDE4]/45">
            Ask the head office what is coming — new layouts are released before
            they reach this page.
          </p>
        </div>
      ) : (
        <div className="mt-24 space-y-24">
          {availableProjects.length > 0 && (
            // Deliberately not three equal columns. The first card takes seven
            // of twelve and the other two stack beside it, so the grid has a
            // subject rather than a row of equals.
            <div className="grid gap-x-8 gap-y-12 md:grid-cols-12">
              {availableProjects.map((project: any, i: number) => (
                <div
                  key={project.projectId}
                  className={i === 0 ? 'md:col-span-7' : 'md:col-span-5'}
                >
                  <ProjectCard project={project} />
                </div>
              ))}
            </div>
          )}

          {soldOutProjects.length > 0 && (
            <section>
              <div className="mb-10 flex items-baseline gap-6">
                <h2 className="t-eyebrow text-[#F2EDE4]/40">Sold out</h2>
                <hr className="rule-hair flex-1" />
              </div>
              <div className="grid gap-x-8 gap-y-12 opacity-70 md:grid-cols-12">
                {soldOutProjects.map((project: any) => (
                  <div key={project.projectId} className="md:col-span-5">
                    <ProjectCard project={project} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
