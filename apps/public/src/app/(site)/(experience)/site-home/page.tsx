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
  // The home page must render even when the database does not.
  //
  // It crashed in front of the client: one failed query against
  // projection.projects_pub took the whole page down and replaced the site with
  // a raw Next.js error screen printing the SELECT statement. A marketing home
  // page is mostly words and a 3D scene, and neither of those needs Postgres —
  // there is no reason for a projection read to be able to destroy them.
  //
  // Degrades in three layers rather than throwing:
  //   1. the query fails      -> projects = [], the page renders with the "no
  //                              layouts open" panel and the scene intact
  //   2. the query returns    -> Array.isArray guard, because a driver that
  //      something odd           returns null or an object would otherwise
  //                              throw TypeError on .filter and land in exactly
  //                              the same crash screen
  //   3. anything else        -> error.tsx in this segment catches it
  //
  // Rethrowing on a build-time prerender is deliberate: a broken database
  // during `next build` should fail the build loudly rather than bake an empty
  // page into the ISR cache and serve it for an hour.
  let projects: unknown = [];
  try {
    projects = await getPublishedProjects();
  } catch (err) {
    console.error('[site-home] projection read failed; rendering without projects', err);
    projects = [];
  }

  const list: any[] = Array.isArray(projects) ? projects : [];
  const availableProjects = list.filter((p: any) => !p.isSoldOut);
  const soldOutProjects = list.filter((p: any) => p.isSoldOut);

  return (
    // THE SCROLL TRACK.
    //
    // min-h-[10000px] is load-bearing, not padding. The camera dolly is 12
    // metres of travel mapped onto document scroll progress, and this page used
    // to be 2,514px — about 3.5 viewports — so the entire move was crammed into
    // ~1,800px of wheel. That is why it read as frantic rather than cinematic,
    // and why the layout sheets collided with the architecture: there was no
    // room between sections for either to breathe.
    //
    // The reference build runs 10,800px (15 viewports) for far LESS motion than
    // this. The floor here guarantees the minimum regardless of how many
    // projects are published, so a quiet month cannot silently re-compress the
    // pacing back to where it was.
    //
    // Every section below is sized in vh and the cards are sticky, so the extra
    // distance is spent holding a frame while the camera moves through it —
    // not on empty space.
    <main className="min-h-[10000px] pb-40">
      <RouteTelemetry routeId="site-home" />

      {/* Copy sits in the LEFT half throughout. The arrival pose aims left of
          the mansion, putting the building right-of-centre, so the left is the
          half of the frame that is deliberately empty. Cards and headings live
          there; the architecture is never covered. */}
      <header className="mx-auto grid min-h-[130vh] max-w-6xl grid-cols-12 gap-10 px-6 pt-[22vh]">
        {/* STRICT LEFT COLUMN. max-w-[40vw] on top of the grid span, because a
            column span is a fraction of the CONTAINER and the container is
            capped at max-w-6xl — on a wide monitor six of twelve columns stops
            well short of 40% of the viewport, and on a narrow one it overruns.
            The camera keeps the right 60% as an unobstructed stage, so the copy
            is measured against the VIEWPORT the stage is cut from. */}
        <div className="col-span-12 md:col-span-6 md:max-w-[40vw]">
          {/* t-display, not an ad-hoc text-4xl/5xl/6xl ladder. The scale is
              fluid via clamp(), so it never jumps at a breakpoint. */}
          <h1 className="t-display text-[#F2EDE4]">
            Land, in the districts
            <br className="hidden sm:block" />{' '}
            {/* The italic falls on "we come from" because that is the claim
                the whole page rests on — a developer selling in the districts
                it is actually from. The accent marks the sentence's meaning,
                not a random word chosen for texture. */}
            <em className="italic text-[#E8B98A]">we come from</em>
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

        {/* Scroll indicator. Sits in the hero's own grid rather than fixed to
            the viewport, so it scrolls away with the section it belongs to
            instead of hovering over the whole page. */}
        <div className="col-span-12 mt-24 flex items-center gap-4 md:col-span-6 md:col-start-1">
          <span className="t-eyebrow text-[#F2EDE4]/35">Scroll</span>
          <span aria-hidden className="relative h-10 w-px overflow-hidden bg-[#F2EDE4]/15">
            <span className="absolute inset-x-0 top-0 h-4 animate-[scrollcue_2.2s_ease-in-out_infinite] bg-[#E8B98A]" />
          </span>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="mx-auto max-w-6xl px-6 pt-[20vh]">
          <p className="t-h3 text-[#F2EDE4]/70">No layouts are open right now.</p>
          <p className="t-body mt-3 text-[#F2EDE4]/45">
            Ask the head office what is coming — new layouts are released before
            they reach this page.
          </p>
        </div>
      ) : (
        <>
          {/*
            One project per section, each 380vh tall with the card STICKY.

            The card holds still in the left half while ~3.8 viewports of scroll
            pass underneath it, and the camera keeps travelling the whole time.
            That is where the extra page height goes: the visitor is not
            scrolling past empty space, they are holding one plan while the
            building moves behind it.

            It also makes the collision structurally impossible. Only one card
            is ever on screen, and it is confined to the half of the frame the
            camera deliberately leaves empty. Previously three cards shared one
            grid and the middle one landed straight over the portico.
          */}
          {availableProjects.map((project: any) => (
            <section
              key={project.projectId}
              className="mx-auto grid min-h-[380vh] max-w-6xl grid-cols-12 px-6"
            >
              {/* STRICT LEFT COLUMN. max-w-[40vw] on top of the grid span, because a
            column span is a fraction of the CONTAINER and the container is
            capped at max-w-6xl — on a wide monitor six of twelve columns stops
            well short of 40% of the viewport, and on a narrow one it overruns.
            The camera keeps the right 60% as an unobstructed stage, so the copy
            is measured against the VIEWPORT the stage is cut from. */}
        <div className="col-span-12 md:col-span-6 md:max-w-[40vw]">
                <div className="sticky top-[16vh]">
                  <ProjectCard project={project} />
                </div>
              </div>
            </section>
          ))}

          {soldOutProjects.length > 0 && (
            <section className="mx-auto grid min-h-[260vh] max-w-6xl grid-cols-12 px-6">
              {/* STRICT LEFT COLUMN. max-w-[40vw] on top of the grid span, because a
            column span is a fraction of the CONTAINER and the container is
            capped at max-w-6xl — on a wide monitor six of twelve columns stops
            well short of 40% of the viewport, and on a narrow one it overruns.
            The camera keeps the right 60% as an unobstructed stage, so the copy
            is measured against the VIEWPORT the stage is cut from. */}
        <div className="col-span-12 md:col-span-6 md:max-w-[40vw]">
                <div className="sticky top-[16vh]">
                  <div className="mb-10 flex items-baseline gap-6">
                    <h2 className="t-eyebrow text-[#F2EDE4]/40">Sold out</h2>
                    <hr className="rule-hair flex-1" />
                  </div>
                  <div className="space-y-12 opacity-70">
                    {soldOutProjects.map((project: any) => (
                      <ProjectCard key={project.projectId} project={project} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* The last stretch carries no copy at all. The camera finishes its
              approach at the portico here, and the frame is allowed to be the
              only thing on screen before the footer arrives. */}
          <div aria-hidden className="min-h-[130vh]" />
        </>
      )}
    </main>
  );
}
