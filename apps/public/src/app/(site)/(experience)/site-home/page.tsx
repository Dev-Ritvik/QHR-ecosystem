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
import { WordReveal } from '@/components/experience/WordReveal';
import { AmbientSound } from '@/components/experience/AmbientSound';
import { ScrollCue } from '@/components/experience/ScrollCue';

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

/*
 * NO SCRIMS, NO SHADOWED TYPE. Every chapter's copy used to carry a soft shade
 * behind it (the hero's, the panes', the hall's) and a text-shadow on every
 * line. The second art-direction audit (2026-09-30) called that the first of
 * the five things making the film look cheap — "artificial darkness ...
 * brute-forced onto the screen to make the text legible". The type now sits
 * where the picture is quiet: in the house's shade, in the evening land, in
 * the dim of a gallery hall, on the shaded stone round the map table.
 *
 * AND EVERY LINE IS SET AT THE STRENGTH THAT GROUND ALLOWS. The quiet ground
 * was measured for ivory at full strength; the small lines were then set at
 * 55 to 75% of it, to step them back from the headings — and at their own
 * strength they stood under AA (measured per text node at 1440x900: the
 * cover's place line at 4.1:1, the figures' labels at 3.2 to 3.9, a table's
 * place line at 3.8, its count in gilt at 3.5). Hierarchy here is scale and
 * weight, as the fourth critique asked ("pure white, elegant typography";
 * "using weight, scale, and grid placement to create hierarchy"): the small
 * capitals are ivory at full strength, a gloss at 88 to 95%, and gilt is kept
 * for what is large enough to carry it or stands on ground dark enough.
 */

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
  const holdings = at('holdings');
  const approach = at('approach');
  const establish = at('establish');
  const portrait = at('portrait');
  const city = at('city');

  return (
    <main className={`film-stage mt-[calc(var(--bar)_-_62px)] pb-40 ${TRACK_ROOT_TRANSPARENT}`}>
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
      {/* Headlines rise in a word at a time as their chapter arrives. */}
      <WordReveal />
      {/* A sound layer, muted until asked for (its control is set in the
          header). */}
      <AmbientSound />

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

          THE BLOCK STANDS ON THE LAND, UNDER AN EMPTY SKY. It used to be
          placed so the horizon ran through it — "Land, in the districts" in a
          black sky, "we come from" on the land. The sky has since become a
          photographed golden hour, and the third art-direction critique
          (2026-09-30) found the headline floating over its bright cloud bank
          ("It looks like a sticker placed on a television screen"). Measured on
          the clean plate at 1440x900, the headline's old place reads a mean
          luma of 139 (p90 188; the italic's band peaking at 197), its place at
          the foot of the frame 70 (p90 109) over the lawn, and the gloss and
          the action below it 48. So the block is set at the foot of the frame,
          the whole sentence on the land, and the sky above it is left to the
          spire. That is on a wide frame. A phone frames the
          house lower and larger, its foot is the facade, and its quiet ground
          is the sky at the top, where the block stays — and stays SHORT. A
          phone's glass is 390x844, but its browser's bars leave about 390x664
          of it when the page opens, and the facade begins at half the frame's
          height: set as it is on a wide frame, the block ran to 60% of that
          frame and its last lines stood on the facade, under a sky grad that
          had followed them down over the house (seen at 375x667). So on a
          phone the headline is a step down (globals.css), the gaps are a
          step tighter and the gloss takes the column's full measure: the
          block ends at 46% of the short frame, on the roof's slate.

          Sticky, like every other chapter, and pinned at the header's height
          rather than 0 so the block never slides under the fixed bar and
          never drifts during the first of the scroll.

          ALL OF IT IN THE FRAME'S OWN UNIT ON A WIDE FRAME (globals.css, THE
          FILM'S STAGE; `film-stage` on <main>). The numbers above were taken
          at 1440x900, and the picture they were taken from scales with the
          frame's height while rems do not: on a laptop's 1536x730 the same
          block began 40% of the way down the frame rather than 50%, its
          place line on the horizon's haze (p90 luma 110), and the holdings'
          eyebrow stood in the sunset (157 to 181). So the type, the gaps,
          the grid's width and this measure are counts of `--u`, a
          nine-hundredth of the frame's height, and the block is the same
          size against the picture, over the same part of it, on every wide
          frame. */}
      <header
        id="hero"
        className={`relative scroll-mt-[62px] ${TRACK_TRANSPARENT}`}
        style={{ minHeight: vh(hero.from, hero.to) }}
      >
        <div
          className={`sticky top-[var(--bar)] h-[calc(100vh_-_var(--bar))] ${PANE_CONTENT_INTERACTIVE}`}
          data-chapter-fade
        >
          {/* The hero nests one level deeper than the other chapters, so the
              pane's `[&>*]` rule would hand pointer events straight back to a
              full-width, full-height wrapper. The transparency is carried down
              to the copy column, which is the only thing here worth clicking. */}

          {/* THE GRID. The same twelve columns and gutter as the header
              (SiteHeader), so the copy's left edge, the logo and the nav all
              stand on column lines: the copy spans columns 1-5, the nav starts
              on column 7. */}
          {/* HELD BY ITS TOP ON A WIDE FRAME, at the design's own height in the
              picture (the place line 50.1% of the way down). The block used
              to be held by its foot, and a block grows where its small type
              stops shrinking: on a 1280x593 frame it stood 4% of the frame
              higher than it was drawn, its place line up off the lawn's
              shade onto brighter ground (p90 luma 113 to 122). The line nearest the
              horizon is the one that cannot move; the foot has a tenth of
              the frame under it to grow into. */}
          <div className="site-grid pointer-events-none relative h-full grid-rows-[1fr_auto] pt-[2vh] wide:pt-0">
            {/* ONE STATEMENT, ONE SUPPORTING LINE, ONE ACTION (the refinement
                brief, 2026-10-03: "reduce the number of simultaneous luxury
                signals: tiny uppercase labels, excessive tracking, repeated
                rules, micro-metadata"; "one dominant statement, one supporting
                statement, one action"). The cover carried six marks: a label in
                tracked capitals, the headline, a hairline, the gloss, the
                action and its rule. The label and the hairline are gone from
                the picture. The districts the label named are the claim the
                page rests on, so the gloss says them; the label itself is kept
                for a screen reader, which reads the page and not the frame.
                The headline stands where it stood: the block's top is lower by
                the label's own line (sixteen units), on a wide frame. */}
            {/* IN THE SKY, ON A WIDE FRAME (the paid audit of 2026-10-04, passes
                2 and 6: "the image is the art direction and the typography is
                information placed onto it. Reverse that relationship"). The
                cover is taken on a long lens now (cameraPath, the hero): the
                house is half the frame and the land round it is the picture's
                own business — the block's old place on the lawn is the pool
                terrace and the house's west wall. The top third is sky and
                nothing else, so the sentence is set there, a title in the air
                over the roofline as a magazine sets one, and the lens wears a
                light graduated filter for that sky (lensFilter, COVER_SKY).
                The third critique refused a headline "floating over" a bright
                cloud bank; this stands above the horizon's haze, on the sky's
                quiet upper air. The first line's top is 13% of the way down
                the frame.

                AND THE SMALL TYPE STAYS ON THE LAND. A day's sky is a stop and
                a half brighter than small ivory type can stand on, and the
                density that would hold it there is the dark lid the audit's
                first pass took off. MEASURED on this frame's clean plate (a
                grid of the brightest tenth of each cell): the sky 130 to 175;
                the hazed park behind the house 170 to 212; and the west lawn,
                in the house's own long shadow, 60 to 100 from 19 to 38% of
                the width between 61 and 75% of the way down — the quiet
                ground of this picture, with nothing done to make it so. The
                supporting line and the action stand there, on the same left
                edge as the title: a title and its caption. */}
            <div className="pointer-events-auto col-span-12 w-full max-w-[calc(452*var(--u))] self-start wide:max-w-none wide:pt-[calc(10.4vh_-_var(--bar))] lg:col-span-8">
              <p className="sr-only">Vizianagaram &middot; Srikakulam</p>

              {/* ONE SENTENCE, ONE SIZE, ONE LEADING, ONE STYLE. The turn of
                  phrase was an italic in bronze; the fourth art-direction
                  critique (2026-09-30) read the site's italics against its
                  roman as a second voice ("stop mixing ... heavily italicized
                  serifs") and asked for hierarchy by scale and weight. The
                  phrase keeps the house's gilt, in the same roman — on a
                  phone, where the sky grad that rides with the copy is dense
                  enough to carry it; over a wide frame's lighter sky it is
                  ivory like the rest (globals.css: gilt needs a ground under
                  a luma of 107 at this size, ivory 137). */}
              <h1 className="t-display mt-4 text-[#F2EDE4] wide:whitespace-nowrap md:mt-6">
                Land, in the
                <br />
                districts <span className="t-display-em">we&nbsp;come&nbsp;from</span>
              </h1>

              {/* Editorial, not default: the lede size with its own leading and
                  a touch of tracking, set to a short measure and balanced. */}
              {/* (On a wide frame the two below are lifted out of the block's
                  flow and held by their own top, on the lawn: see above.) */}
              <div className="wide:absolute wide:left-[calc(var(--bl)*6)] wide:top-[calc(64vh_-_var(--bar))] wide:max-w-[calc(452*var(--u))]">
              <p className="t-hero-lede mt-5 text-[#F2EDE4]/95 short:sr-only md:mt-8 md:max-w-[36ch] wide:!mt-0">
                Approved layouts in Vizianagaram and Srikakulam, sold direct by
                the developer. Every sanctioned plan published in full.
              </p>

              {/* ONE ACTION, AND NO ARROW. The hero carried two ("Start here"
                  and a quiet "See the layouts raised"); the third art-direction
                  critique (2026-09-30) counted every mark on the opening frame
                  and asked for "extreme restraint". The fourth read the drawn
                  arrow after the words as "standard web UI, not luxury
                  editorial": the action is the gilt rule leading into the
                  words, as a magazine sets a pointer, and nothing after them. */}
              {/* On a wide frame the action stands at the frame's foot, on
                  the pool's dark water, beside the scroll cue (below): under
                  the supporting line the ground is the terrace's pale stone. */}
              <div className="mt-6 md:mt-8 wide:hidden">
                <Link href="/start-here" className="cta-primary">
                  Start here
                </Link>
              </div>
              </div>
            </div>

            {/* THE FOOT OF THE COVER: the one action (a wide frame's; a phone's
                is in the block above), and the scroll cue beside it — the cue
                only for a visitor who has not found the scroll on their own
                (ScrollCue). Both on the pool's water: measured on the clean
                plate, the brightest tenth of it 67 to 76 from 13 to 31% of the
                width, 88 to 93.5% of the way down. */}
            <div className="col-span-12 flex items-center gap-x-[calc(var(--bl)*12)] self-end pb-[4vh] pt-6 wide:pb-[7.4vh]">
              <div className="pointer-events-auto hidden wide:block">
                <Link href="/start-here" className="cta-primary">
                  Start here
                </Link>
              </div>
              <ScrollCue />
            </div>
          </div>
        </div>
      </header>

      {/* ── CHAPTER 2 · THE REVOLUTION ────────────────────────────────────
          The camera swings two hundred degrees around the left flank. Almost no
          copy on purpose: this is the chapter where the architecture is the
          only argument, and a paragraph over it would be a second thing to
          look at. Two lines, held still by `sticky` while the building turns
          behind them — set a little below the middle of the frame from md up:
          measured on the clean plate at this beat, the lines' old place reads
          a mean luma of 64 (p90 142, the horizon's haze) and this one 41 (p90
          80), on the lawn. */}
      <section
        id="revolution"
        className={`mx-auto grid max-w-[var(--grid-max)] scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
        style={{ minHeight: vh(revolution.from, revolution.to) }}
      >
        <div className="col-span-12 wide:col-span-5 wide:max-w-[calc(518.4*var(--u))]">
          <div
            // Held by its top on a wide frame, like the cover and the holdings:
            // its first line 60.4% of the way down. (It was 50.4%. With the
            // refinement brief the exterior's lens went to deep focus, the
            // horizon's haze behind that place came up sharp and bright, and
            // the label stood on a p90 luma of 178 at leg 0.22: 1.8:1. Ten
            // per cent lower the whole block is on the lawn for every frame
            // it is up — measured each fiftieth of the leg, never under 1.45
            // times what its line needs, with no filter on the lens.)
            className={`sticky top-0 flex h-screen flex-col justify-center wide:justify-start wide:pt-[calc(60.44vh_+_16_*_var(--u))] ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
          >
            {/* (The chapter's label: read, not drawn. See the cover.) */}
            <p className="sr-only">Twenty years, one district</p>
            <p className="t-h3 mt-6 text-[#F2EDE4]">
              We do not broker land.
              <br />
              {/* Balanced, not broken by hand: a forced break after "still
                  here" left "here" alone on a line at 1440. */}
              <span className="block [text-wrap:balance]">
                We develop it, and we are still here when the last plot sells.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ── CHAPTER 3 · THE HOLDINGS ─────────────────────────────────────
          The crane settles behind the house as evening falls: the estate low
          in the right of frame, its spire against the sky, and the land to its
          left gone dark. The figures sit in that dark. (Until the second
          art-direction audit this chapter carried a constellation over the
          spire; the audit asked for it to go, and it has.)

          IN THE LOWER HALF OF THE FRAME, ON THE LAND (on a wide frame; a phone
          keeps the centred block its own framing was set for). The copy arrives while the sky
          behind the house is still the golden hour's brightest (clean plate,
          left column, at the chapter's first frames: mean luma 139..204 above
          y 0.5, 71..93 below it), and evening only darkens it later. Centred,
          the heading stood in that glare for the first half of the chapter.

          Editorial, not a hero: a small label, a short statement, a rule, and
          three figures. Figures because this is the one place in the sequence
          where a claim can be made in numbers rather than adjectives, and
          numbers are the thing a buyer of land actually wants. Every one comes
          from the published projection — nothing here is composed. */}
      <section
        id="holdings"
        className={`mx-auto grid max-w-[var(--grid-max)] scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
        style={{ minHeight: held(holdings.from, holdings.to, 1) }}
      >
        <div className="col-span-12 wide:col-span-5 wide:max-w-[calc(518.4*var(--u))]">
          <div
            // Held by its top on a wide frame, like the cover's (the eyebrow
            // 47.9% of the way down, as drawn): at 1280x593 the block held by
            // its foot stood 4.5% of the frame higher, toward the sunset.
            className={`sticky top-0 flex h-screen flex-col justify-center wide:justify-start wide:pt-[calc(47.89vh_+_16_*_var(--u))] ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
          >
            <p className="sr-only">The holdings</p>
            <h2 className="t-h2 mt-6 text-[#F2EDE4]">
              Every plot we hold,
              <br />
              <span className="text-[#E8B98A] short:text-[#F2EDE4]">counted in full</span>
            </h2>
            {/* THE FIGURES, AS ORNAMENT. The first audit read the old row as a
                SaaS dashboard; the second read its successor — serif figures
                in ruled columns under capitals — as "a generic admin
                dashboard" still. The rules were the dashboard. So there are
                none: three figures at the top of the scale in its lightest
                weight, with the old-style numerals Playfair draws (the ones
                that rise and fall like lower-case letters, the way a book sets
                its dates), each over a microscopic tracked label, and air
                between them instead of a line. `flex-col-reverse` puts each figure over its label
                while the markup keeps the label first, as a <dl> must.

                WHAT IS OPEN COMES FIRST, the figure a buyer is here for, and
                it is the one in gilt — at the left end of the row, where the
                land stays dark for the whole chapter (measured under each
                figure's place from leg 0.40 to 0.70: a p90 luma of 28 to 70
                at the left, 27 to 175 at the right, where the garden's
                blossom and then the terrace pass behind). It used to close
                the row, and at leg 0.60 the gilt stood on 112: 2.7:1. Ivory
                holds the right end at 3:1 through the same frames. */}
            {/* AND NOW AS FACTS, SET AS A BOOK SETS THEM (the paid audit of
                2026-10-04, pass 6: "those numbers should not feel like
                ordinary dashboard statistics. They should feel like editorial
                facts"). Three numerals at the top of the scale over tracked
                capitals is how a dashboard draws a metric, whatever the face.
                A printed page sets a short table: the figure in the text's own
                old-style numerals, a step up, its words beside it in the
                text's own voice, one fact to a line and the figures ranged
                right so their units stand under one another. No capitals, no
                gilt: what is open comes first, and that is its emphasis.
                (`flex-row-reverse` puts each figure before its words while
                the markup keeps the term first, as a <dl> must.) */}
            <dl className="mt-8 flex flex-col gap-y-[calc(var(--bl)*1.5)]">
              <div className="flex flex-row-reverse items-baseline justify-end gap-x-[calc(var(--bl)*4)]">
                <dt className="t-fact-term text-[#F2EDE4]">plots open</dt>
                <dd className="t-fact text-[#F2EDE4]">
                  {list.reduce(
                    (n: number, p: any) =>
                      n + (typeof p.availableUnits === 'number' ? p.availableUnits : 0),
                    0,
                  )}
                </dd>
              </div>
              <div className="flex flex-row-reverse items-baseline justify-end gap-x-[calc(var(--bl)*4)]">
                <dt className="t-fact-term text-[#F2EDE4]">plots in all</dt>
                <dd className="t-fact text-[#F2EDE4]">
                  {list.reduce(
                    (n: number, p: any) =>
                      n + (typeof p.totalUnits === 'number' ? p.totalUnits : 0),
                    0,
                  )}
                </dd>
              </div>
              <div className="flex flex-row-reverse items-baseline justify-end gap-x-[calc(var(--bl)*4)]">
                <dt className="t-fact-term text-[#F2EDE4]">{list.length === 1 ? 'layout' : 'layouts'}</dt>
                <dd className="t-fact text-[#F2EDE4]">{list.length}</dd>
              </div>
            </dl>
            {/* One line under the figures (it ran three: the second sentence
                told the visitor what the next chapter shows them). */}
            <p className="t-body mt-10 max-w-[34ch] text-[#F2EDE4]/[0.88] short:sr-only">
              Counted from the sanctioned layout plans, not from a brochure.
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
        {/* IT WAITS FOR THE DOOR (ChapterFade, AFTER_ATTR). The pane is held
            while the camera is still coming down the flank, where the lit
            windows pass behind the foot of the frame; the copy develops a
            viewport later, as the camera comes round onto the front and the
            door it speaks of is in the picture. */}
        <div
          className={`sticky top-0 flex h-screen flex-col items-center justify-end px-6 pb-[9vh] text-center ${PANE_CONTENT_INTERACTIVE}`}
          data-chapter-fade
          data-fade-after="1.05"
        >
          <p className="sr-only">The residence</p>
          <p className="t-h3 mt-6 text-[#F2EDE4]">The door is open.</p>
          <EnterLink className="cta-primary mt-8">Step inside</EnterLink>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="pointer-events-auto mx-auto max-w-[var(--grid-max)] px-6 pt-[20vh]">
          <p className="t-h3 text-[#F2EDE4]">No layouts are open right now.</p>
          <p className="t-body mt-3 text-[#F2EDE4]/90">
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
              doorway lands the page, and where "Step inside" points.

              At the foot of the frame, from md up: the hall's clerestory stands in the
              upper left of this shot, and measured on its clean plate the
              left column reads mean luma 105..190 (p90 243, the windows'
              light) from y 0.25 to 0.5, and 51..67 below y 0.8, on the dim
              wall under the sconces. */}
          <section
            id="establish"
            className={`mx-auto grid max-w-[var(--grid-max)] scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
            style={{ minHeight: vh(establish.from, establish.to) }}
          >
            <div className="col-span-12 wide:col-span-5 wide:max-w-[calc(518.4*var(--u))]">
              {/* On a phone the copy stands at the foot of the frame, on the stair's shade; the phone's lens lifts the room above it (phoneFraming.ts). */}
              <div
            className={`sticky top-0 flex h-screen flex-col justify-end pb-[9vh] wide:pb-[8vh] ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
          >
                <p className="sr-only">Inside</p>
                {/* Its first sentence alone on a phone on its side: all three,
                    in that frame's narrow column, stood five lines high —
                    from 59% of the frame, on the lit wall (p90 luma 107). And
                    on a short measure there: on the column's full one its
                    first line ran out onto the stair's pale stone ("its own"
                    on 101 to 114). */}
                <p className="t-h3 mt-6 text-[#F2EDE4] short:max-w-[14ch]">
                  Each layout stands on its own table.
                  <span className="short:sr-only">
                    <br className="hidden sm:block" /> Turn one to read it from
                    another side; open it to see every plot.
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/*
            ── CHAPTERS 5..n · THE STATIONS ──────────────────────────────────

            One section per lit table, in the order the camera visits them, each
            sized to its chapter. The copy is STICKY, so it holds still in the
            left half while the camera crosses the room behind it.

            ON A FRAME THAT IS NOT WIDE (a phone, a tablet held upright) there
            is no left half to hold it in: the frame shows the middle of the
            landscape one, and the plan's pane begins at its centre line. Set
            across the middle, as it was, the copy was set across the plan. So
            there it stands in four short lines under the header, on the wall
            above the plan, under the header's own band (lensFilter.ts,
            tableBandFilter); it develops in place when the camera lands on the
            table (ChapterFade, held), and it is held there for thirty
            hundredths of a viewport longer than the section itself runs,
            which is what the negative margin on its column is: room the next
            table's copy has not yet come to. Not at the last table: the camera
            does not dwell there, it withdraws to the stair, and copy held on
            would caption a frame its plan had already left (seen at leg 0.57).

            TEXT ONLY, BY CLIENT REVIEW. These were image cards - a boxed plan
            with badges laid over the hall beside the hologram that already
            shows that plan - and every overlay inside the mansion was asked to
            go. The link stays: the canvas above is aria-hidden, so this name is
            the only way a keyboard or screen-reader visitor reaches the project
            from the hall.
          */}
          {stationProjects.map((project: any, i: number) => {
            const c = at(`station-${i + 1}`);
            // Held on past the section's end on a frame that is not wide (see
            // above) — at every table the camera dwells at.
            const last = i === stationProjects.length - 1;
            const dwell = last ? '' : '-mb-[30vh]';
            return (
              <section
                key={project.projectId}
                id={c.id}
                className={`mx-auto grid max-w-[var(--grid-max)] scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
                style={{ minHeight: vh(c.from, c.to) }}
              >
                {/* (A narrower measure on a phone on its side: its small type
                    does not shrink with the frame, and at 932x430 a place
                    line ran the whole measure, to the edge of the plan.) */}
                <div className={`col-span-12 wide:col-span-6 wide:mb-0 wide:max-w-[calc(576*var(--u))] short:max-w-[calc(500*var(--u))] ${dwell}`}>
                  <div
            className={`sticky top-0 flex h-screen flex-col justify-start pt-20 wide:justify-center wide:pt-0 ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
            data-fade-narrow="held"
            // The last table's copy leaves with the camera (ChapterFade, OUT_ATTR).
            data-fade-out={last ? '0.12' : undefined}
          >
                    {/* THE NAME, WHERE IT IS, WHAT IS OPEN — and nothing over
                        them. Each table used to be numbered like a collection:
                        Roman numerals in tracked capitals over a hairline of
                        gilt, then the name. The refinement brief counted those
                        among the frame's "decorative typographic gestures";
                        the holdings chapter has already said how many tables
                        there are. */}
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
            className={`mx-auto grid max-w-[var(--grid-max)] scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
            style={{ minHeight: held(portrait.from, portrait.to, 1) }}
          >
            <div className="col-span-12 wide:col-span-5 wide:max-w-[calc(518.4*var(--u))]">
              {/* On a phone, below the portrait and its plate — never across the sitter — with the lens's front raised to make the room (phoneFraming.ts).
                  IN PLACE there (ChapterFade, held): riding in from under the frame's foot it was readable before the grad that follows it had its ground (its eyebrow on a p90 luma of 104.9 at leg 0.67, a tenth short of the limit). */}
              <div
            className={`sticky top-0 flex h-screen flex-col justify-end pb-[8vh] wide:justify-center wide:pb-0 ${PANE_CONTENT_INTERACTIVE}`}
            data-chapter-fade
            data-fade-narrow="held"
          >
                <p className="sr-only">At the top of the stairs</p>
                {/* A NARROW MEASURE from md up (the fourth critique's check:
                    set on two lines, the second ran to the picture's frame
                    and its last words stood in the picture light's spill on
                    the wall, p90 122 to 169). Seventeen characters wraps it
                    in four, on the dark panelling, with air before the
                    frame. A phone keeps the full width of its own band. */}
                <p className="t-h3 mt-6 text-[#F2EDE4] wide:max-w-[17ch] wide:[text-wrap:balance]">
                  The name on the sanction letters has been the same for twenty years.
                </p>
                <p className="mt-8">
                  <Link href="/about" className="cta-quiet">
                    <span className="cta-quiet-label">Who we are</span>
                  </Link>
                </p>
              </div>
            </div>
          </section>

          {/* ── CHAPTER 6 · THE MAP TABLE ─────────────────────────────────
              The camera comes off the portrait and down into the court of the
              stair, onto a walnut table with the two districts carved into
              its top in plaster relief — the coast, the rivers in gilt, the
              ghats inland — and a brass pin standing in the district of every
              published layout, as long as its plots are many (MapTable.tsx).
              The land the company sells, kept inside the house: the fourth
              art-direction critique (2026-09-30) asked for exactly that, in
              place of the abstract field out of doors this chapter used to
              open onto ("keep the camera inside the architectural world").

              THIS LIST IS THE AUTHORITY, not the pins. The canvas is
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
              camera settles on the table, the one frame the list is for. */}
          <section
            id="city"
            className={`relative mx-auto grid max-w-[var(--grid-max)] scroll-mt-[62px] grid-cols-12 px-6 ${TRACK_TRANSPARENT}`}
            style={{ minHeight: vh(city.from, city.to) }}
          >
            <div
              aria-hidden
              data-film-end={city.to}
              className="pointer-events-none absolute left-0 h-px w-px"
              style={{ top: held(city.from, city.to, -1) }}
            />
            {/* col-span-5 / 36vw, the same measure every other chapter uses,
                so the list stands on the court's shaded stone and the table
                holds the right of the frame, where its pins can be clicked. */}
            <div className="col-span-12 wide:col-span-5 wide:max-w-[calc(518.4*var(--u))]">
              {/* On a phone, above the table, on the landing's walnut; the lens's front falls to put the table under the list (phoneFraming.ts).
                  IN PLACE (ChapterFade, held): the list used to ride up the frame to get there, across the table's lit relief (its note at 76% on a p90 luma of 211 at leg 0.96), and it is set a little tighter than on a wide frame, so its last line stands a tenth of the frame clear of the table (it stood one hundredth clear). */}
              <div
                className={`sticky top-0 flex h-screen flex-col justify-start pt-[max(5rem,10vh)] wide:justify-center wide:pt-0 ${PANE_CONTENT_INTERACTIVE}`}
                data-chapter-fade
                data-fade-narrow="held"
              >
                <p className="sr-only">The land</p>
                <p className="t-h3 mt-4 text-[#F2EDE4] wide:mt-6">
                  Two districts.
                  <br className="hidden sm:block" /> Every layout we hold, and
                  where it stands.
                </p>

                <ul className="mt-6 space-y-4 max-md:space-y-3 wide:mt-8 wide:space-y-6">
                  {stationProjects.map((project: any) => (
                    <li key={project.projectId}>
                      {/* Focus or hover this and the project's pin lifts on the
                          table — see the note in CityLink for why the keyboard
                          path is a link here rather than a focusable object
                          inside an aria-hidden canvas. */}
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

                {/* One sentence (it ran four lines of small type). It keeps
                    BOTH of its claims: that the table is a model, and that a
                    pin is a district and not a site — no published project
                    has a centroid, and the page has to say so in words (the
                    E2E suite holds it to that; the type pass of 2026-10-03
                    cut the second half and the suite caught it). */}
                <p className="t-small mt-6 text-[#F2EDE4] short:sr-only max-md:mt-4 wide:mt-8 wide:max-w-[36ch]">
                  A model of the two districts, not a survey: a pin marks a
                  district, not a place on the ground.
                </p>
              </div>
            </div>
          </section>

          {/* The camera's last beat lands here and is allowed to hold. No copy
              at all for a third of a viewport: the table is lit, the sequence
              is over, and the frame is the only thing on screen before the
              house lights go down and the footer arrives over it. */}
          <div aria-hidden className="min-h-[34vh]" />

          {/* Sold-out layouts sit AFTER the journey rather than inside it. They
              have no table in the hall — an unlit plinth is the honest 3D
              equivalent — but they are real projects and a buyer checking a
              developer's history should be able to see them. */}
          {soldOutProjects.length > 0 && (
            <section className="pointer-events-auto mx-auto grid max-w-[var(--grid-max)] grid-cols-12 px-6 pt-[14vh]">
              <div className="col-span-12 md:col-span-6 md:max-w-[40vw]">
                <div className="mb-10 flex items-baseline gap-6">
                  <h2 className="t-eyebrow text-[#F2EDE4]">Sold out</h2>
                  <hr className="rule-hair flex-1" />
                </div>
                <div className="space-y-12 opacity-90">
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
