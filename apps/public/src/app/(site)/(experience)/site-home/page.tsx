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
import { StationText } from '@/components/site/StationText';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { PublishSceneCards } from '@/components/experience/PublishSceneCards';
import { CityLink } from '@/components/site/CityLink';
import { chapters, TRACK_VH, type Chapter } from '@/components/experience/journey';
import { ChapterUrl } from '@/components/experience/ChapterUrl';
import { ChapterFade } from '@/components/experience/ChapterFade';
import { EnterLink } from '@/components/experience/EnterLink';

// ISR: Background revalidation every hour, unless manually cleared by the webhook (T37)
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Plotted layouts in Vizianagaram & Srikakulam — Quality Homes Reality',
  description:
    'Approved plotted layouts across the northern coastal districts of Andhra Pradesh, from a developer twenty years in the field. Plans published in full; prices on request from the branch that holds the site.',
};

/**
 * TRACK_VH — total scrollable height of the film, in viewport heights — is
 * imported from journey.ts, where its derivation lives.
 *
 * The camera's whole journey is mapped onto it, so it sets the pacing of every
 * chapter at once. Everything below is a FRACTION of it, never an absolute — so
 * retuning the pacing is one number, and it cannot desynchronise the copy from
 * the camera.
 *
 * It lives beside the chapter table rather than here because the doorway's
 * band is exactly one viewport OF THE TRACK, and a constant the scene reads
 * cannot be declared in a page the scene does not import.
 *
 * WHERE THE TRACK ENDS is marked in the markup (`data-film-end`), and the camera
 * measures its fractions against that point rather than against the whole
 * document — see filmTrack.ts for the desync the document measure produced.
 */

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

/**
 * THE DEPARTURE FADE.
 *
 * Each chapter's content block is tagged for <ChapterFade>, which dissolves it
 * as it rides out of frame rather than letting it slide under the header. The
 * full account of the defect, and of the CSS mask that was tried here first and
 * does not work, is in ChapterFade.tsx — the short version is that a mask is
 * anchored to the element box, so its fade band leaves the screen with the pane
 * exactly when it is needed.
 */

/**
 * THE TRACK MUST NOT SWALLOW POINTER EVENTS MEANT FOR THE WORLD.
 *
 * MEASURED, and it was a real defect rather than a test artefact. At scroll
 * 0.62 the first station's table projects to screen (1008, 750) — comfortably
 * in frame — and `document.elementFromPoint(1008, 750)` returned the chapter
 * SECTION, not the canvas. The section is `mx-auto max-w-6xl`, so its box spans
 * x 144..1296 of a 1440px viewport regardless of how narrow the visible copy
 * column is, and it sits at z-10 over a canvas at z-0. Every pointer event in
 * that band went to an empty grid cell.
 *
 * So dragging a table did nothing, and the same band covers the holograms. The
 * E2E case for it failed with the turntable's rotation unchanged at exactly 0 —
 * the interaction had never been reachable, on any pointer device, since the
 * track was written.
 *
 * The fix is the idiom /hall already uses: the track is transparent to the
 * pointer, and only the things a visitor actually reads or clicks take it back.
 * `[&>*]:pointer-events-auto` restores it to the pane's own children rather
 * than to the pane, so the empty space above and below a centred block stays
 * transparent too — that space is most of a `h-screen` pane.
 *
 * Text selection is unaffected: the copy itself is a direct child and keeps
 * pointer events.
 */
// Applied to <main> as well as to every chapter section. Sections alone were
// not enough: <main> is full-width and as tall as the whole film, so after the
// sections were fixed `elementFromPoint` at the first table still returned MAIN.
// Everything that is not a chapter — the empty state, the sold-out list — takes
// its pointer events back explicitly.
// `!` (important) on <main> specifically: the (experience) layout re-enables
// pointer events on its direct child, and that descendant rule outranks a plain
// utility class. The film is the one page that needs the world reachable
// through it, so it says so louder.
const TRACK_TRANSPARENT = 'pointer-events-none';
const TRACK_ROOT_TRANSPARENT = '!pointer-events-none';
const PANE_CONTENT_INTERACTIVE = 'pointer-events-none [&>*]:pointer-events-auto';

/** A chapter's height in vh, from its share of the scroll track. */
function vh(from: number, to: number): string {
  return `${((to - from) * TRACK_VH).toFixed(2)}vh`;
}

/**
 * A chapter's section height with its pane's viewport of exit moved in or out.
 *
 * WHY SOME SECTIONS ARE A VIEWPORT LONGER THAN THEIR CHAPTER, AND THE NEXT ONE A
 * VIEWPORT SHORTER. A pinned pane leaves over the LAST viewport of its section.
 * Where a chapter's camera beat sits at the chapter's START (every station,
 * where the camera arrives and dwells), that is right. Where the beat sits at
 * the END — the portrait, which the camera climbs to across its whole chapter,
 * and the constellation, which it settles on at the end of the revolution — the
 * pane was already riding out when the camera arrived, and the next chapter's
 * copy was on screen beside the wrong picture. Measured on the production build:
 * at the portrait beat, "Out the front door" was pinned and "At the top of the
 * stairs" had gone.
 *
 * So those two sections carry their exit viewport past the end of the chapter,
 * and the section after each gives the same viewport back — the film-end
 * markers stay exactly where the camera measures them, and so does every
 * chapter boundary the address bar and the camera read.
 */
function held(from: number, to: number, viewports: 1 | -1): string {
  return `calc(${vh(from, to)} ${viewports > 0 ? '+' : '-'} 100vh)`;
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
  // The fallback carries the id it was asked for, not just zeroes: a chapter
  // that is missing from the registry should still have a stable anchor rather
  // than an unnamed section the URL cannot address.
  const at = (id: string): Chapter => beat.find((c) => c.id === id) ?? { id, from: 0, to: 0 };

  const hero = at('hero');
  const revolution = at('revolution');
  const constellation = at('constellation');
  const approach = at('approach');
  const establish = at('establish');
  const portrait = at('portrait');
  const city = at('city');

  return (
    <main className={`pb-40 ${TRACK_ROOT_TRANSPARENT}`}>
      <RouteTelemetry routeId="site-home" />

      {/* Scroll <-> URL. Fed the SAME chapter list the camera and the
          section heights come from, so the address bar cannot drift from
          the film. Client-only and scene-independent: a visitor with no
          WebGL still scrolls this page and still gets a working address.
          Renders nothing. */}
      <ChapterUrl chapters={beat} />

      {/* Dissolves a chapter as it leaves the frame. Renders nothing;
          reads the panes tagged data-chapter-fade below. */}
      <ChapterFade />

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
          total: typeof p.totalUnits === 'number' ? p.totalUnits : null,
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
      <header
        id="hero"
        className={`relative scroll-mt-[62px] ${TRACK_TRANSPARENT}`}
        style={{ minHeight: vh(hero.from, hero.to) }}
      >
        <div
          className={`sticky top-[62px] h-[calc(100vh-62px)] ${PANE_CONTENT_INTERACTIVE}`}
          data-chapter-fade
        >
          {/* The hero nests one level deeper than the other chapters, so the
              pane's `[&>*]` rule would hand pointer events straight back to a
              full-width, full-height wrapper. The transparency is carried down
              to the copy column, which is the only thing here worth clicking. */}
          <div className="pointer-events-none mx-auto flex h-full max-w-6xl flex-col px-6 pt-[6vh]">
            <div className="pointer-events-auto w-full md:max-w-[min(31vw,452px)]">
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
        id="revolution"
        className={`mx-auto grid max-w-6xl scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
        style={{ minHeight: vh(revolution.from, revolution.to) }}
      >
        <div className="col-span-12 md:col-span-5 md:max-w-[36vw]">
          <div
            className={`sticky top-0 flex h-screen flex-col justify-center ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
          >
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
        id="constellation"
        className={`mx-auto grid max-w-6xl scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
        style={{ minHeight: held(constellation.from, constellation.to, 1) }}
      >
        <div className="col-span-12 md:col-span-5 md:max-w-[36vw]">
          <div
            className={`sticky top-0 flex h-screen flex-col justify-center ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
          >
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

      {/* ── CHAPTER 4 · THE APPROACH ──────────────────────────────────────
          Night falls as the camera comes down the flank and onto the entry
          axis, and the chapter ends square on the front door. Scrolling on
          opens it: the doors part, the camera goes through them into light, and
          the hall resolves out of it (doorway.ts).

          The copy is CENTRED and LOW, unlike every other chapter's left column,
          because this is the one frame in the film that is symmetrical — a door
          on the axis — and a column of type down the left would sit on top of
          the composition it is inviting the visitor into. Two lines, and a
          control that does what scrolling does, for anyone who would rather
          click than wheel. */}
      <section
        id="approach"
        className={`relative scroll-mt-[62px] ${TRACK_TRANSPARENT}`}
        style={{ minHeight: held(approach.from, approach.to, -1) }}
      >
        {/* Where the exterior's track ends, for a page with nothing inside. The
            camera measures its fractions from the furthest marker on the page.
            A viewport short of the chapter's height because this section starts
            a viewport late — the constellation holds its pane past its beat
            (see held()). */}
        <div
          aria-hidden
          data-film-end={approach.to}
          className="pointer-events-none absolute left-0 h-px w-px"
          style={{ top: held(approach.from, approach.to, -1) }}
        />
        <div
          className={`sticky top-0 flex h-screen flex-col items-center justify-end px-6 pb-[9vh] text-center ${PANE_CONTENT_INTERACTIVE}`}
          data-chapter-fade
        >
          <p className="t-eyebrow text-[#F2EDE4]/55">The residence</p>
          <p className="t-h3 mt-5 text-[#F2EDE4]/90">The door is open.</p>
          <EnterLink className="tap-target t-eyebrow group mt-8 inline-flex items-center gap-2 text-[#E8B98A] transition-colors hover:text-[#F2EDE4]">
            Step inside
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              &rarr;
            </span>
          </EnterLink>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="pointer-events-auto mx-auto max-w-6xl px-6 pt-[20vh]">
          <p className="t-h3 text-[#F2EDE4]/70">No layouts are open right now.</p>
          <p className="t-body mt-3 text-[#F2EDE4]/60">
            Ask the head office what is coming — new layouts are released before
            they reach this page.
          </p>
        </div>
      ) : (
        <>
          {/* ── CHAPTER 5 · THE HALL ────────────────────────────────────────
              The camera has come through the front door and out of the light
              onto the threshold. This section is the establishing shot: the
              camera holds the whole room with the staircase on axis, so the
              copy is one line and gets out of the way. It is also where the
              doorway lands the page, and where "Step inside" points. */}
          <section
            id="establish"
            className={`mx-auto grid max-w-6xl scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
            style={{ minHeight: vh(establish.from, establish.to) }}
          >
            <div className="col-span-12 md:col-span-5 md:max-w-[36vw]">
              <div
            className={`sticky top-0 flex h-screen flex-col justify-center ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
          >
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
            sized to its chapter. The copy is STICKY, so it holds still in the
            left half while the camera crosses the room behind it.

            TEXT ONLY, BY CLIENT REVIEW. These were image cards - a boxed plan
            with badges laid over the hall beside the hologram that already
            shows that plan - and every overlay inside the mansion was asked to
            go. The link stays: the canvas above is aria-hidden, so this name is
            the only way a keyboard or screen-reader visitor reaches the project
            from the hall.
          */}
          {stationProjects.map((project: any, i: number) => {
            const c = at(`station-${i + 1}`);
            return (
              <section
                key={project.projectId}
                id={c.id}
                className={`mx-auto grid max-w-6xl scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
                style={{ minHeight: vh(c.from, c.to) }}
              >
                <div className="col-span-12 md:col-span-6 md:max-w-[40vw]">
                  <div
            className={`sticky top-0 flex h-screen flex-col justify-center ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
          >
                    <p className="t-eyebrow mb-6 text-[#F2EDE4]/40 [font-variant-numeric:tabular-nums]">
                      {String(i + 1).padStart(2, '0')} &nbsp;/&nbsp;{' '}
                      {String(stationProjects.length).padStart(2, '0')}
                    </p>
                    <StationText project={project} />
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
            id="portrait"
            className={`mx-auto grid max-w-6xl scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
            style={{ minHeight: held(portrait.from, portrait.to, 1) }}
          >
            <div className="col-span-12 md:col-span-5 md:max-w-[36vw]">
              <div
            className={`sticky top-0 flex h-screen flex-col justify-center ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
          >
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

          {/* ── CHAPTER 6 · THE DISTRICT FIELD ─────────────────────────────
              The camera comes off the portrait, turns down the axis and stands
              at the entry doors. They dissolve, and the land the company sells
              opens beyond them: one marker per published layout, sized by its
              real plot count, sitting in its own district's band.

              THIS LIST IS THE AUTHORITY, not the markers. The canvas is
              decorative and aria-hidden; a visitor with no WebGL, no pointer or
              no sight reaches every project from here, in the same order, with
              the same numbers. The 3D enhances these links — it does not
              replace them, and it never becomes the only way to a project. */}
          {/* EXACTLY ITS CHAPTER'S HEIGHT, starting a viewport late, with the
              film's end marked a viewport before its foot. The portrait section
              above holds its pane a viewport past its beat (see held()), so this
              one begins that much later; the marker is pulled up by the same
              amount so it stays where the camera's journey ends (JOURNEY_END).
              What is left after the marker is the viewport this pane needs to
              leave — without it the project list would go at the very frame the
              district field finishes opening, the one frame the list is for. */}
          <section
            id="city"
            className={`relative mx-auto grid max-w-6xl scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
            style={{ minHeight: vh(city.from, city.to) }}
          >
            <div
              aria-hidden
              data-film-end={city.to}
              className="pointer-events-none absolute left-0 h-px w-px"
              style={{ top: held(city.from, city.to, -1) }}
            />
            {/* col-span-5 / 36vw, the same measure every other chapter uses.
                It was 6 / 42vw, which reached x 720 of 1440 — far enough right
                that the leftmost marker projected BEHIND the list and a click
                on it landed on the copy rather than on the scene. */}
            <div className="col-span-12 md:col-span-5 md:max-w-[36vw]">
              <div
                className={`sticky top-0 flex h-screen flex-col justify-center ${PANE_CONTENT_INTERACTIVE}`}
                data-chapter-fade
              >
                <p className="t-eyebrow text-[#F2EDE4]/45">Out the front door</p>
                {/* The measure is stepped down on small screens because this
                    chapter carries more than any other — a heading, every
                    published project, and the note about what the positions
                    mean. `!` is needed: t-h3 sets its own font-size from a CSS
                    layer that wins over a plain utility. */}
                <p className="t-h3 mt-4 !text-[1.3rem] leading-snug text-[#F2EDE4]/85 md:mt-6 md:!text-[1.8rem]">
                  Two districts.
                  <br className="hidden sm:block" /> Every layout we hold, and
                  where it stands.
                </p>

                <ul className="mt-6 space-y-5 md:mt-10 md:space-y-7">
                  {stationProjects.map((project: any) => (
                    <li key={project.projectId}>
                      {/* Focus or hover this and the project's marker lifts in
                          the field — see the note in CityLink for why the
                          keyboard path is a link here rather than a focusable
                          object inside an aria-hidden canvas. */}
                      <CityLink
                        slug={project.slug}
                        name={project.name}
                        locality={project.locality ?? null}
                        city={project.city ?? null}
                        available={project.availableUnits}
                        total={project.totalUnits}
                      />
                    </li>
                  ))}
                </ul>

                <p className="t-body mt-6 max-w-[34ch] !text-[0.8rem] text-[#F2EDE4]/50 md:mt-10 md:!text-[0.95rem]">
                  Positions in the scene are a diagram of the network, not a
                  map: the district is real, the plot counts are real, and the
                  place on the ground is not published.
                </p>
              </div>
            </div>
          </section>

          {/* The camera's last beat lands here and is allowed to hold. No copy
              at all for a third of a viewport: the district field has opened,
              the sequence is over, and the frame is the only thing on screen
              before the footer arrives over it. */}
          <div aria-hidden className="min-h-[34vh]" />

          {/* Sold-out layouts sit AFTER the journey rather than inside it. They
              have no table in the hall — an unlit plinth is the honest 3D
              equivalent — but they are real projects and a buyer checking a
              developer's history should be able to see them. */}
          {soldOutProjects.length > 0 && (
            <section className="pointer-events-auto mx-auto grid max-w-6xl grid-cols-12 px-6 pt-[14vh]">
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
