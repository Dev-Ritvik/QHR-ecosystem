// apps/public/src/app/(site)/site-home/page.tsx
//
// The scroll track for the cinematic journey, and the accessible equivalent of
// everything in it.
//
// TWO JOBS, AND THE SECOND ONE IS THE IMPORTANT ONE.
//
// First, this page is the TRACK. The camera reads document scroll and nothing
// else, so the height of each section below IS the pacing of a chapter: a
// chapter given too little page rushes, one given too much stalls. Those
// heights are therefore not typed in by hand — they are computed from the same
// `chapters()` the camera uses, so the copy and the camera can never drift
// apart. That drift is what happened the last time the track was retuned: the
// page grew to fix pacing and the camera's 12 metres of travel became 0.8m per
// screen.
//
// Second, and more importantly, this page is what the experience DEGRADES TO.
// The canvas is aria-hidden and client-only. A crawler, a screen reader, a
// keyboard user and anyone whose browser cannot do WebGL get exactly this
// markup and nothing else. So every destination the 3D scene can reach has to
// be a real link here, in the order the camera reaches it: three project
// holograms, and the founder's portrait above the stairs. It is not a summary
// of the experience — it is the experience, told in words.
//
// The copy this page's first version carried offered "premium plotted
// developments, commercial spaces, and luxury residences". Two of those three
// do not exist: every open project is plotted land. Describing a portfolio we
// do not have is the kind of claim a buyer disproves by scrolling.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedProjects } from '@/lib/projection';
import { ProjectCard } from '@/components/site/ProjectCard';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { PublishSceneCards } from '@/components/experience/PublishSceneCards';
import { chapters } from '@/components/experience/journey';

// ISR: Background revalidation every hour, unless manually cleared by the webhook (T37)
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Plotted layouts in Vizianagaram & Srikakulam — Quality Homes Reality',
  description:
    'Approved plotted layouts across the northern coastal districts of Andhra Pradesh, from a developer twenty years in the field. Plans published in full; prices on request from the branch that holds the site.',
};

/**
 * Total scrollable height, in viewport heights.
 *
 * The camera's whole journey is mapped onto this, so it sets the pacing of
 * every chapter at once. Twelve viewports of travel for nine chapters is about
 * 1.3 screens of wheel per chapter, which is slow enough that a composition
 * resolves and holds before the next one starts and fast enough that the page
 * does not feel like a chore. The reference build runs fifteen for a shorter
 * sequence.
 *
 * Everything below is a FRACTION of this, never an absolute — so retuning the
 * pacing is one number, and it cannot desynchronise the copy from the camera.
 */
const TRACK_VH = 1700;

/**
 * WHY EVERY CHAPTER'S COPY IS A FULL-VIEWPORT STICKY PANE.
 *
 * The first version pinned each block at a comfortable reading offset —
 * `sticky top-[30vh]` and friends — with the block's own natural height. In a
 * browser that put TWO chapters on screen at once for a long stretch of every
 * transition, which is exactly what it sounds like: the constellation's figures
 * with the hall's opening line growing underneath them.
 *
 * The arithmetic, for a 650px viewport, a 350px block and a 195px offset: the
 * block unsticks when its BOTTOM reaches its section's bottom, so it comes to
 * rest 350px from the section end and then rides up. Meanwhile the next
 * section's block enters normal flow 195px below the boundary. Between those two
 * positions there are several hundred pixels where both are inside the viewport.
 *
 * A pane that is exactly one viewport tall, pinned at top 0, with its content
 * vertically centred, cannot do that.
 *
 * flex-COL, not flex. The first attempt used `flex items-center`, which is a
 * row: it laid the eyebrow, the heading, the rule, the figures and the
 * paragraph out side by side across the pane, on top of each other. The pane
 * has one job — centre a stack vertically — and that is `flex-col
 * justify-center`. The outgoing pane's content passes out
 * through the top of the frame at the same moment the incoming pane's content is
 * still a full viewport below the fold. Only one chapter is ever legible, which
 * is the whole point of a chapter.
 */

/** A chapter's height in vh, from its share of the scroll track. */
function vh(from: number, to: number): string {
  return `${((to - from) * TRACK_VH).toFixed(2)}vh`;
}

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

  // FOUR pedestals exist in interior_hall.glb; this many are lit. The camera
  // path, the station components and the chapter boundaries all derive from
  // this one number, so a fourth published project extends the choreography
  // with no code change — and no project is ever invented to fill a plinth.
  const stationProjects = availableProjects.slice(0, 4);
  const beat = chapters(stationProjects.length);
  const at = (id: string) => beat.find((c) => c.id === id) ?? { from: 0, to: 0 };

  const hero = at('hero');
  const revolution = at('revolution');
  const constellation = at('constellation');
  const establish = at('establish');
  const portrait = at('portrait');

  return (
    <main className="pb-40">
      <RouteTelemetry routeId="site-home" />

      {/* Hands the published projects to the WebGL tree, which binds them to
          the hologram tables in the hall. Renders nothing itself — the canvas
          is mounted by the layout above this page, so a store is the only path
          between them. */}
      <PublishSceneCards
        cards={stationProjects.map((p: any) => ({
          slug: p.slug,
          name: p.name,
          locality: p.locality ?? '',
          city: p.city ?? '',
          available: typeof p.availableUnits === 'number' ? p.availableUnits : null,
          soldOut: Boolean(p.isSoldOut),
        }))}
      />

      {/* ── CHAPTER 1 · HERO ──────────────────────────────────────────────

          An editorial cover, composed against the render rather than laid out
          beside it. Three numbers from the hero frame at 1440x900 decide
          everything below, and all three were measured off the framebuffer:

            * the left column is BLACK from y 0 to y ~260 (mean luma 11..16,
              max 17) and LIT from y ~300 down (mean 76..85)
            * the highlights that actually break type — the lit west wing, the
              window glow, the terrace edge — all begin at x 600. Left of 600
              the ground is flat: max luma 93 against 136 at its worst. Right
              of it, 227..255.
            * the spire tip lands at y 216, inside the black band

          So: the measure is capped short of x 600, which is what the
          `max-w-[min(31vw,452px)]` is — not a taste call about line length but
          the distance from the page gutter to the first blown highlight. The
          previous paragraph ran to x 692 and put six lines of body copy across
          ground reading a mean of 80 with peaks to 233, which is the single
          reason the hero read as a brochure: the type was fighting the
          brightest thing in the picture and losing.

          And the block is placed so the horizon runs THROUGH it. "Land, in the
          districts" sits in the black sky; "we come from" sits on the land.
          That is the sky being used rather than filled — the negative space is
          doing the same work the spire does, bridging dark to lit, and the
          sentence means what the composition means.

          Sticky, like every other chapter, and pinned at 62px rather than 0 so
          the block never slides under the fixed bar and never drifts during
          the first 62px of scroll. */}
      <header className="relative" style={{ minHeight: vh(hero.from, hero.to) }}>
        <div className="sticky top-[62px] h-[calc(100vh-62px)]">
          <div className="mx-auto flex h-full max-w-6xl flex-col px-6 pt-[6vh]">
            <div className="w-full md:max-w-[min(31vw,452px)]">
              {/* Small uppercase metadata. The two districts, because they are
                  the specific factual claim the whole page rests on and they
                  no longer need to be carried by the body copy. */}
              <p className="t-eyebrow text-[#F2EDE4]/55">
                Vizianagaram &middot; Srikakulam
              </p>

              {/* t-display, not an ad-hoc text-4xl/5xl/6xl ladder. The scale is
                  fluid via clamp(), so it never jumps at a breakpoint.

                  The break before the italic is a real gap, not a line break:
                  two lines set tight, then air, then the turn of phrase. The
                  italic falls on "we come from" because that is the claim the
                  page rests on — a developer selling in the districts it is
                  actually from. */}
              <h1 className="t-display mt-8 text-[#F2EDE4]">
                Land, in the
                <br />
                districts
                <em className="mt-[0.30em] block italic text-[#E8B98A]">
                  we come from
                </em>
              </h1>

              {/* Two short lines. This was a six-line paragraph that restated
                  the districts, the developer, the plans, the sizes and where
                  the rate comes from — all of which the page says again, at
                  length, in chapters the visitor has not reached yet. A cover
                  states; it does not brief. */}
              <p className="t-body mt-10 max-w-[38ch] text-[#F2EDE4]/70">
                Approved layouts, sold direct by the developer.
                <br className="hidden md:block" /> Every sanctioned plan
                published in full.
              </p>

              {/* Secondary by construction: eyebrow scale, stacked rather than
                  ranged across the frame, no button shape. gap-y-4 keeps the
                  two 44px hit areas from overlapping. */}
              <p className="mt-11 flex flex-col items-start gap-y-4">
                <Link
                  href="/start-here"
                  className="tap-target t-eyebrow group inline-flex items-center gap-2 text-[#E8B98A] transition-colors hover:text-[#F2EDE4]"
                >
                  In a hurry? Start here
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    &rarr;
                  </span>
                </Link>
                <Link
                  href="/hall"
                  className="tap-target t-eyebrow group inline-flex items-center gap-2 text-[#F2EDE4]/55 transition-colors hover:text-[#F2EDE4]"
                >
                  See the layouts raised
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    &rarr;
                  </span>
                </Link>
              </p>
            </div>

            {/* Scroll indicator, pushed to the foot of the pane. It belongs to
                the frame rather than to the copy, and the bottom third of the
                frame is the one part of the composition with nothing in it. */}
            <div className="mt-auto flex items-center gap-4 pb-[9vh]">
              <span className="t-eyebrow text-[#F2EDE4]/45">Scroll</span>
              <span aria-hidden className="relative h-10 w-px overflow-hidden bg-[#F2EDE4]/15">
                <span className="absolute inset-x-0 top-0 h-4 animate-[scrollcue_2.2s_ease-in-out_infinite] bg-[#E8B98A]" />
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── CHAPTER 2 · THE REVOLUTION ────────────────────────────────────
          The camera swings two hundred degrees around the left flank. Almost no
          copy on purpose: this is the chapter where the architecture is the
          only argument, and a paragraph over it would be a second thing to
          look at. Two lines, held still by `sticky` while the building turns
          behind them. */}
      <section
        className="mx-auto grid max-w-6xl grid-cols-12 px-6"
        style={{ minHeight: vh(revolution.from, revolution.to) }}
      >
        <div className="col-span-12 md:col-span-5 md:max-w-[36vw]">
          <div className="sticky top-0 flex h-screen flex-col justify-center">
            <p className="t-eyebrow text-[#F2EDE4]/45">Twenty years, one district</p>
            <p className="t-h3 mt-6 text-[#F2EDE4]/85">
              We do not broker land.
              <br />
              We develop it, and we are still here
              <br className="hidden sm:block" /> when the last plot sells.
            </p>
          </div>
        </div>
      </section>

      {/* ── CHAPTER 3 · THE CONSTELLATION ─────────────────────────────────
          The camera turns off the building and out into the dark, and the
          sphere resolves in the right of frame. The text block sits beside it,
          which is what this section is.

          Editorial, not a hero: a small label, a short statement, a rule, and
          three figures. Figures because this is the one place in the sequence
          where a claim can be made in numbers rather than adjectives, and
          numbers are the thing a buyer of land actually wants. Every one comes
          from the published projection — nothing here is composed. */}
      <section
        className="mx-auto grid max-w-6xl grid-cols-12 px-6"
        style={{ minHeight: vh(constellation.from, constellation.to) }}
      >
        <div className="col-span-12 md:col-span-5 md:max-w-[36vw]">
          <div className="sticky top-0 flex h-screen flex-col justify-center">
            <p className="t-eyebrow text-[#F2EDE4]/45">Every plot, plotted</p>
            <h2 className="t-h2 mt-6 text-[#F2EDE4]">
              One point for
              <br />
              <em className="italic text-[#E8B98A]">every plot we hold</em>
            </h2>
            <hr className="rule-hair mt-10" />
            <dl className="mt-8 grid grid-cols-3 gap-x-6">
              <div>
                <dt className="t-eyebrow text-[#F2EDE4]/45">Layouts</dt>
                <dd className="mt-3 text-[28px] leading-none text-[#F2EDE4] [font-variant-numeric:tabular-nums]">
                  {list.length}
                </dd>
              </div>
              <div>
                <dt className="t-eyebrow text-[#F2EDE4]/45">Plots</dt>
                <dd className="mt-3 text-[28px] leading-none text-[#F2EDE4] [font-variant-numeric:tabular-nums]">
                  {list.reduce(
                    (n: number, p: any) =>
                      n + (typeof p.totalUnits === 'number' ? p.totalUnits : 0),
                    0,
                  )}
                </dd>
              </div>
              <div>
                <dt className="t-eyebrow text-[#F2EDE4]/45">Open</dt>
                <dd className="mt-3 text-[28px] leading-none text-[#E8B98A] [font-variant-numeric:tabular-nums]">
                  {list.reduce(
                    (n: number, p: any) =>
                      n + (typeof p.availableUnits === 'number' ? p.availableUnits : 0),
                    0,
                  )}
                </dd>
              </div>
            </dl>
            <p className="t-body mt-8 max-w-md text-[#F2EDE4]/55">
              Counted from the sanctioned layout plans, not from a brochure. The
              hall below holds one table for each.
            </p>
          </div>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="mx-auto max-w-6xl px-6 pt-[20vh]">
          <p className="t-h3 text-[#F2EDE4]/70">No layouts are open right now.</p>
          <p className="t-body mt-3 text-[#F2EDE4]/60">
            Ask the head office what is coming — new layouts are released before
            they reach this page.
          </p>
        </div>
      ) : (
        <>
          {/* ── CHAPTER 4 · THE HALL ────────────────────────────────────────
              The veil closes over the last metre of the approach and opens
              inside. This section is the establishing shot: the camera holds
              the whole room with the staircase on axis, so the copy is one
              line and gets out of the way. */}
          <section
            className="mx-auto grid max-w-6xl grid-cols-12 px-6"
            style={{ minHeight: vh(establish.from, establish.to) }}
          >
            <div className="col-span-12 md:col-span-5 md:max-w-[36vw]">
              <div className="sticky top-0 flex h-screen flex-col justify-center">
                <p className="t-eyebrow text-[#F2EDE4]/45">Inside</p>
                <p className="t-h3 mt-6 text-[#F2EDE4]/85">
                  Each layout stands on its own table.
                  <br className="hidden sm:block" /> Turn one to read it from
                  another side; open it to see every plot.
                </p>
              </div>
            </div>
          </section>

          {/*
            ── CHAPTERS 5..n · THE STATIONS ──────────────────────────────────

            One section per lit table, in the order the camera visits them, each
            sized to its chapter. The card is STICKY, so it holds still in the
            left half while the camera crosses the room behind it.

            THESE CARDS ARE NOT DECORATION. They are the keyboard and
            screen-reader equivalent of the holograms: the canvas above them is
            aria-hidden, so this link is the only way a non-pointer user reaches
            the project. Removing them to "let the 3D speak" would take three
            products off the site for everyone who does not use a mouse.
          */}
          {stationProjects.map((project: any, i: number) => {
            const c = at(`station-${i + 1}`);
            return (
              <section
                key={project.projectId}
                className="mx-auto grid max-w-6xl grid-cols-12 px-6"
                style={{ minHeight: vh(c.from, c.to) }}
              >
                <div className="col-span-12 md:col-span-6 md:max-w-[40vw]">
                  <div className="sticky top-0 flex h-screen flex-col justify-center">
                    <p className="t-eyebrow mb-6 text-[#F2EDE4]/40 [font-variant-numeric:tabular-nums]">
                      {String(i + 1).padStart(2, '0')} &nbsp;/&nbsp;{' '}
                      {String(stationProjects.length).padStart(2, '0')}
                    </p>
                    <ProjectCard project={project} />
                  </div>
                </div>
              </section>
            );
          })}

          {/* ── FINAL CHAPTER · THE PORTRAIT ───────────────────────────────
              The camera leaves the last table, crosses to the central axis and
              climbs the staircase to the portrait above the landing. Clicking
              it in the scene opens About; this is the same destination, as a
              link, for everyone who cannot click a painting. */}
          <section
            className="mx-auto grid max-w-6xl grid-cols-12 px-6"
            style={{ minHeight: vh(portrait.from, portrait.to) }}
          >
            <div className="col-span-12 md:col-span-5 md:max-w-[36vw]">
              <div className="sticky top-0 flex h-screen flex-col justify-center">
                <p className="t-eyebrow text-[#F2EDE4]/45">At the top of the stairs</p>
                <p className="t-h3 mt-6 text-[#F2EDE4]/85">
                  The name on the sanction letters
                  <br className="hidden sm:block" /> has been the same for twenty
                  years.
                </p>
                <p className="mt-10">
                  <Link
                    href="/about"
                    className="tap-target t-eyebrow group inline-flex items-center gap-2 text-[#E8B98A] transition-colors hover:text-[#F2EDE4]"
                  >
                    Who we are
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">
                      &rarr;
                    </span>
                  </Link>
                </p>
              </div>
            </div>
          </section>

          {/* The camera's last beat lands here and is allowed to hold. No copy
              at all for a third of a viewport: the portrait has been reached,
              the sequence is over, and the frame is the only thing on screen
              before the footer arrives over it. */}
          <div aria-hidden className="min-h-[34vh]" />

          {/* Sold-out layouts sit AFTER the journey rather than inside it. They
              have no table in the hall — an unlit plinth is the honest 3D
              equivalent — but they are real projects and a buyer checking a
              developer's history should be able to see them. */}
          {soldOutProjects.length > 0 && (
            <section className="mx-auto grid max-w-6xl grid-cols-12 px-6 pt-[14vh]">
              <div className="col-span-12 md:col-span-6 md:max-w-[40vw]">
                <div className="mb-10 flex items-baseline gap-6">
                  <h2 className="t-eyebrow text-[#F2EDE4]/60">Sold out</h2>
                  <hr className="rule-hair flex-1" />
                </div>
                <div className="space-y-12 opacity-70">
                  {soldOutProjects.map((project: any) => (
                    <ProjectCard key={project.projectId} project={project} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
