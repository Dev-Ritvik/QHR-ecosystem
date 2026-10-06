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
import { StartCue } from '@/components/experience/StartCue';

// ISR: Background revalidation every hour, unless manually cleared by the webhook (T37)
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Plotted layouts in Vizianagaram & Srikakulam — Quality Homes Reality',
  description:
    'Approved plotted layouts across the northern coastal districts of Andhra Pradesh, from a developer twenty years in the field. Plans published in full; prices on request from the branch that holds the site.',
};

/**
 * TRACK_VH — total scrollable height of the film, in viewport heights — is
 * imported from journey.ts, where its derivation lives. Everything below is a
 * FRACTION of it, never an absolute, so retiming a chapter cannot
 * desynchronise the copy from the camera.
 *
 * WHERE THE TRACK ENDS is marked in the markup (`data-film-end`), and the
 * camera measures its fractions against that point rather than against the
 * whole document — see filmTrack.ts for the desync the document measure
 * produced.
 */

/**
 * HOW A CHAPTER'S COPY IS HELD.
 *
 * Every chapter's copy is a full-viewport pane pinned for the whole of its
 * chapter. It used to be pinned for its section less a viewport and to ride up
 * the frame to its place and away from it, dissolving on the way (the audit
 * of 2026-10-05, P0: "Text fades in while the frame is still travelling ...
 * and often fades out before it can be read").
 *
 * The copy does not ride any more: each pane carries the stretch of scroll its
 * words are up for (`data-copy`, from journey.ts, where the camera's own
 * places are), develops in place and dissolves in place. Nothing slides. So
 * that a pane is in the frame for the whole of its chapter, each section is a
 * viewport TALLER than its chapter and takes that viewport back with a
 * negative margin: the next section begins where the chapter ends, and the
 * pane inside is pinned from the chapter's first pixel to its last — and for
 * as long after it as its words are still up (the portrait's line, while the
 * camera holds on the picture; the map's index, after the film's last frame).
 *
 * THE CAMERA DOES NOT WAIT FOR THE WORDS (the client, 2026-10-06, of the cut
 * that made it wait: "this one is slow and laggy also why this cam stop for a
 * brief moment? the client didn't like it"). It is the continuous path the
 * client approved, and each chapter's copy is up for the stretch of it on
 * which the picture behind is the one the copy was set on.
 *
 * COMPOSED INTO THE FRAME, NOT A COLUMN (the audit, P1: "all text and nav sit
 * inside a narrow centered column ... always at the same left position
 * regardless of what the camera shows"). On a wide frame each chapter's block
 * is placed on its own stretch of the film — the frame's edge for a margin
 * (`--edge`, globals.css), its top given in the frame's height — where that
 * stretch is quietest: the cover's and the orbit's in the sky, the figures on
 * the evening land, the door's centred under the door, the hall's on the wall
 * beside each subject. The camera goes on behind it, so where the picture
 * passing under a block is not quiet enough for it the lens carries a soft
 * density there for as long as the block is up, as it did before that audit
 * (lensFilter.ts: the sky's grad, the land's ellipse, the tables' edge).
 * A phone and an upright tablet stack each block across the top or the foot
 * of the frame, as they did.
 *
 * ONE DOMINANT LINE A CHAPTER (the audit, P1: "headlines are about 44 px on a
 * ~1,900 px screen in a serif built for body text"). The display lines are
 * set in the face's display cut at twice the size they were (globals.css,
 * THE FILM'S DISPLAY TYPE): `t-d1` the cover's title and the orbit's line,
 * `t-d2` the door's, a table's name and the hall's, `t-d3` a statement of
 * more than a line. The figures are the event of their chapter (`t-fig`).
 */

/**
 * THE TRACK MUST NOT SWALLOW POINTER EVENTS MEANT FOR THE WORLD. The track is
 * transparent to the pointer, and only the things a visitor actually reads or
 * clicks take it back: a table is dragged and a plan is clicked THROUGH the
 * page. (Measured when it was not so: `elementFromPoint` at the first table
 * returned the chapter's section, and the turntable had never been reachable.)
 * `!` on <main>: the (experience) layout re-enables pointer events on its
 * direct child, and that rule outranks a plain utility class.
 */
const TRACK_ROOT_TRANSPARENT = '!pointer-events-none';

/** A chapter's pane: pinned for its whole chapter, transparent to the pointer
 *  but for what is read or pressed in it. A column on a phone, a frame to
 *  place blocks in on a wide one. */
const PANE = 'sticky top-0 flex h-screen w-full flex-col px-6 pointer-events-none wide:block wide:px-0';
/** A block of copy in a pane. */
const BLOCK = 'pointer-events-auto wide:absolute wide:left-[var(--edge)]';

/** A chapter's section: a viewport taller than the chapter, with that
 *  viewport given back, so its pane is pinned from the chapter's first pixel
 *  to its last — and on past it for as long as its copy is still up
 *  (`linger`, taken back too: the next section still begins where the
 *  chapter ends). */
function track(c: Chapter): React.CSSProperties {
  const linger = Math.max(0, c.copy.out[1] - c.to) * TRACK_VH;
  return {
    minHeight: `calc(${((c.to - c.from) * TRACK_VH + linger).toFixed(2)}vh + 100vh)`,
    marginBottom: `calc(-100vh - ${linger.toFixed(2)}vh)`,
  };
}

/** The stretch of scroll a chapter's copy is up for, for ChapterFade. */
function copyOf(c: Chapter): string {
  return [...c.copy.in, ...c.copy.out].map((v) => v.toFixed(5)).join(',');
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
  const at = (id: string): Chapter =>
    beat.find((c) => c.id === id) ?? { id, from: 0, to: 0, copy: { in: [0, 0], out: [0, 0] } };

  const hero = at('hero');
  const revolution = at('revolution');
  const holdings = at('holdings');
  const approach = at('approach');
  const establish = at('establish');
  const portrait = at('portrait');
  const city = at('city');

  return (
    <main className={`film-stage pb-40 ${TRACK_ROOT_TRANSPARENT}`}>
      <RouteTelemetry routeId="site-home" />

      {/* Scroll <-> URL. Fed the SAME chapter list the camera and the
          section heights come from, so the address bar cannot drift from
          the film. Client-only and scene-independent: a visitor with no
          WebGL still scrolls this page and still gets a working address.
          Renders nothing. */}
      <ChapterUrl chapters={beat} />

      {/* Brings each chapter's copy up in place over its stretch of the film,
          and takes it away in place (journey.ts, COPY_SPAN). Renders nothing;
          reads the panes tagged data-chapter-fade below. */}
      <ChapterFade />
      {/* Headlines rise in a word at a time as their chapter speaks. */}
      <WordReveal />
      {/* A sound layer, muted until asked for (its control is set in the
          header). */}
      <AmbientSound />

      {/* Hands the published projects to the WebGL tree, which binds them to
          the tables in the hall. Renders nothing itself — the canvas is
          mounted by the layout above this page, so a store is the only path
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

      {/* ── CHAPTER 1 · THE COVER ─────────────────────────────────────────
          The long-lens three-quarter of the entrance front, the top third of
          the frame sky. On a wide frame the copy stands in three places, each
          on its own quiet ground: the TITLE in that sky, under the graduated
          filter the lens wears for a day's sky (lensFilter.ts, COVER_SKY); the
          supporting line on the west lawn, in the house's own long shadow;
          and at the frame's foot the one cue. A phone frames the house lower
          and larger: its quiet ground is the sky at the top, where the block
          stands whole.

          ONE CUE (the audit of 2026-10-05, P2: "The hero shows both 'START
          HERE' and 'SCROLL' plus a stray vertical tick. Done when there is
          one designed cue"). The cover carried an action that left the film
          for another page and, beside it, a cue to stay and scroll. They are
          one thing now: "Start here" starts the film (StartCue).

          THE COVER IS COMPOSED FROM THE PAGE'S FIRST PIXEL. Every page
          begins 62px down, under the header's bar, and over the film the
          header is air: the cover's pane began 62px down the frame and rode
          up to its place over the first fifth of a notch — the title, its
          line and the cue all 62px lower in the one frame a visitor is sure
          to see than in the frame they were composed and measured on (the
          cue 37px from the frame's foot, the gilt line's feet out of the
          sky's grad). On a wide frame the pane takes that 62px back, so the
          first frame is the composed one and nothing rides. The title stands
          where the orbit's line will, a tenth of the way down. */}
      <header id="hero" className="relative scroll-mt-[62px]" style={track(hero)}>
        <div className={`${PANE} justify-start pt-[calc(var(--bar)_+_2vh)] wide:-mt-[62px] wide:pt-0`} data-chapter-fade data-copy={copyOf(hero)}>
          <div className={`${BLOCK} wide:top-[max(10.5vh,var(--clear))]`}>
            <p className="sr-only">Vizianagaram &middot; Srikakulam</p>
            <h1 className="t-d1 mt-4 text-[#F2EDE4] wide:mt-0 wide:whitespace-nowrap">
              Land, in the districts
              <br />
              <span className="t-gilt">we&nbsp;come&nbsp;from.</span>
            </h1>
          </div>
          <div className={`${BLOCK} wide:top-[71vh] wide:max-w-[calc(430*var(--u))]`}>
            <p className="t-support mt-5 max-w-[36ch] text-[#F2EDE4] short:sr-only wide:mt-0">
              Approved layouts in Vizianagaram and Srikakulam, sold direct by
              the developer. Every sanctioned plan published in full.
            </p>
          </div>
          <div className={`${BLOCK} mt-7 wide:bottom-[7vh] wide:mt-0`}>
            <StartCue href="#revolution" />
          </div>
        </div>
      </header>

      {/* ── CHAPTER 2 · THE ORBIT ─────────────────────────────────────────
          The camera travels down the west side of the house, the lawn and
          its hedges under it and the morning's sky over it. The chapter is
          one statement, and it used to be set at paragraph size over the
          hedges. Its first sentence is the frame's title now, at the display
          size in the sky to the left of the house, and its second the caption
          to it, on the lawn — as the cover's title and its line stand. It is
          up for the stretch of the orbit on which that sky is still the
          morning's (journey.ts, COPY_SPAN): by leg 0.28 the sunset has come
          up behind where the title stands. */}
      <section id="revolution" className="relative scroll-mt-[62px]" style={track(revolution)}>
        <div className={`${PANE} justify-start pt-[calc(var(--bar)_+_3vh)] wide:pt-0`} data-chapter-fade data-copy={copyOf(revolution)}>
          <div className={`${BLOCK} wide:top-[max(10.5vh,var(--clear))]`}>
            <p className="sr-only">Twenty years, one district</p>
            <p className="t-d1 text-[#F2EDE4] wide:whitespace-nowrap">
              We do not
              <br />
              broker <span className="t-gilt">land.</span>
            </p>
          </div>
          <div className={`${BLOCK} wide:top-[66.4vh] wide:max-w-[calc(330*var(--u))] short:max-w-[calc(520*var(--u))]`}>
            <p className="t-support mt-5 max-w-[30ch] text-[#F2EDE4] wide:mt-0">
              We develop it, and we are still here when the last plot sells.
            </p>
          </div>
        </div>
      </section>

      {/* ── CHAPTER 3 · THE HOLDINGS ─────────────────────────────────────
          The crane comes round behind the house at sunset and all but rests
          there: the estate low in the right of the frame, the land to its
          left going dark. The figures stand on that land, and they are the
          event of the chapter (the
          audit, P1: "the stats numbers are barely larger than their labels
          ... each read as the main event of their chapter"): three numerals
          at the display's largest size in the face's old-style figures, each
          over a line of tracked capitals. Every one comes from the published
          projection — nothing here is composed. `flex-col-reverse` puts each
          figure over its label while the markup keeps the term first, as a
          <dl> must. */}
      <section id="holdings" className="relative scroll-mt-[62px]" style={track(holdings)}>
        <div className={`${PANE} justify-center`} data-chapter-fade data-copy={copyOf(holdings)}>
          {/* THE FIGURES FIRST ON A WIDE FRAME, the statement under them and its
              gloss on one line under that (`order`: the markup keeps the
              heading first). Where the crane all but rests (leg 0.6) the
              lawn the evening sun still reaches is a bright strip across the
              left of the frame from 52 to 64% of the way down, and from 65%
              down the land is the trees' long shadows and the canal garden:
              the figures stand across the strip's foot and everything smaller
              is below it. The block comes up earlier than that, while the
              crane is still rising over the lit lawn, so the lens carries a
              soft ellipse round it for as long as it is up (lensFilter.ts,
              HOLDINGS_BOX).

              ON A FRAME MORE THAN TWICE AS WIDE AS IT IS TALL (`panoramic:`)
              the camera sees further left, and the frame's first seventh is
              that lawn in the open, past the palms' shadows: at 1280x593 the
              first figure's label began on a ground of 126 (3.5:1). The
              block stands further in as the frame widens past two to one —
              four-tenths of the width it has over that, so nothing at
              exactly two to one, 12px at 1920x945 and 38 at 1280x593 —
              where the shadows are. */}
          <div className={`${BLOCK} flex flex-col wide:top-[58.5vh] short:top-[calc(58.5vh+var(--bl)*8)] panoramic:left-[calc(var(--edge)_+_(100vw_-_200vh)_*_0.4)]`}>
            <p className="sr-only">The holdings</p>
            <h2 className="t-d3 text-[#F2EDE4] wide:order-2 wide:mt-[calc(var(--bl)*9)] short:mt-[calc(var(--bl)*5)]">
              Every plot we hold,
              <br />
              <span className="t-gilt short:text-[#F2EDE4]">counted in full.</span>
            </h2>
            {/* (Ranged by their heads: on a phone a label takes two lines and
                the figures must still stand on one line with each other.) */}
            <dl className="mt-8 flex items-start gap-x-[calc(var(--bl)*9)] wide:order-1 wide:mt-0 wide:gap-x-[calc(var(--bl)*14)]">
              <div className="flex flex-col-reverse">
                <dt className="t-eyebrow mt-3 text-[#F2EDE4]">Plots open</dt>
                <dd className="t-fig text-[#F2EDE4]">
                  {list.reduce(
                    (n: number, p: any) =>
                      n + (typeof p.availableUnits === 'number' ? p.availableUnits : 0),
                    0,
                  )}
                </dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt className="t-eyebrow mt-3 text-[#F2EDE4]">Plots in all</dt>
                <dd className="t-fig text-[#F2EDE4]">
                  {list.reduce(
                    (n: number, p: any) =>
                      n + (typeof p.totalUnits === 'number' ? p.totalUnits : 0),
                    0,
                  )}
                </dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt className="t-eyebrow mt-3 text-[#F2EDE4]">{list.length === 1 ? 'Layout' : 'Layouts'}</dt>
                <dd className="t-fig text-[#F2EDE4]">{list.length}</dd>
              </div>
            </dl>
            <p className="t-support mt-8 max-w-[34ch] text-[#F2EDE4] short:sr-only wide:order-3 wide:mt-[calc(var(--bl)*5)] wide:max-w-none wide:whitespace-nowrap">
              Counted from the sanctioned layout plans, not from a brochure.
            </p>
          </div>
        </div>
      </section>

      {/* ── CHAPTER 4 · THE DOOR ──────────────────────────────────────────
          Dusk falls as the camera comes down the west side and round onto the
          entry axis, and ends square on the front door.

          The copy is CENTRED and LOW, unlike every other chapter's, because
          this is the one frame in the film that is symmetrical — a door on
          the axis — and a column of type down the left would stand on the
          composition it is inviting the visitor into.

          AND THE DOOR OPENS WHILE THE LINE IS UP (the audit, P1: "'The door
          is open.' appears while the door is visibly shut; it opens only
          after the text has faded"). The line comes up as the camera turns
          onto the door's axis, and the leaves swing with the scroll over the
          last of the approach, onto the lit hall behind them (DoorwayRig,
          doorway.ts: doorAjar); scrolling on walks through them. */}
      <section id="approach" className="relative scroll-mt-[62px]" style={track(approach)}>
        {/* Where the exterior's track ends, for a page with nothing inside. The
            camera measures its fractions from the furthest marker on the page. */}
        <div
          aria-hidden
          data-film-end={approach.to}
          className="pointer-events-none absolute left-0 h-px w-px"
          style={{ top: `${((approach.to - approach.from) * TRACK_VH).toFixed(2)}vh` }}
        />
        <div className={`${PANE} items-center justify-end pb-[9vh] text-center`} data-chapter-fade data-copy={copyOf(approach)}>
          <div className="pointer-events-auto flex flex-col items-center wide:absolute wide:inset-x-0 wide:bottom-[8.5vh]">
            <p className="sr-only">The residence</p>
            <p className="t-d2 text-[#F2EDE4]">The door is open.</p>
            <EnterLink className="cta-primary mt-6 wide:mt-7">Step inside</EnterLink>
          </div>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="pointer-events-auto mx-auto max-w-[var(--grid-max)] px-6 pt-[120vh]">
          <p className="t-h3 text-[#F2EDE4]">No layouts are open right now.</p>
          <p className="t-body mt-3 text-[#F2EDE4]/90">
            Ask the head office what is coming — new layouts are released before
            they reach this page.
          </p>
        </div>
      ) : (
        <>
          {/* ── CHAPTER 5 · THE HALL ────────────────────────────────────────
              The camera has come through the front door onto the threshold,
              and with the first scroll it moves off the axis to the
              establishing shot: the whole room, the stair its axis, the
              portrait small at the end of it. The hall's one statement is
              read there, in the upper left of a wide frame, across the west
              wall's dusk windows: this frame's sky, as the cover's title and
              the orbit's line stand in theirs. It has gone before the camera
              turns to the first table. It is also where "Step inside"
              points. */}
          <section id="establish" className="relative scroll-mt-[62px]" style={track(establish)}>
            <div className={`${PANE} justify-end pb-[9vh]`} data-chapter-fade data-copy={copyOf(establish)}>
              <div className={`${BLOCK} wide:top-[max(15vh,var(--clear))] wide:max-w-[calc(640*var(--u))]`}>
                <p className="sr-only">Inside</p>
                <p className="t-d2 text-[#F2EDE4] short:max-w-[14ch]">
                  Each layout stands
                  <br className="hidden wide:block" /> on its <span className="t-gilt">own table.</span>
                </p>
                <p className="t-support mt-5 max-w-[34ch] text-[#F2EDE4] short:sr-only wide:mt-6">
                  Turn one to read it from another side; open it to see every plot.
                </p>
              </div>
            </div>
          </section>

          {/*
            ── THE TABLES ────────────────────────────────────────────────────
            One section per lit table, in the order the camera visits them,
            each the same length. A table's name, where it is and what is
            open come up beside it as the camera reaches it and stay for as
            long as the camera dwells there; the last table has no dwell (the
            camera withdraws from it toward the stair at once), and its name
            leaves with the camera, as it always did.

            ON A FRAME THAT IS NOT WIDE (a phone, a tablet held upright) there
            is no beside: the copy stands in short lines under the header, on
            the wall above the model.

            TEXT ONLY, BY CLIENT REVIEW, and the link stays: the canvas above
            is aria-hidden, so this name is the only way a keyboard or
            screen-reader visitor reaches the project from the hall.
          */}
          {stationProjects.map((project: any, i: number) => {
            const c = at(`station-${i + 1}`);
            return (
              <section key={project.projectId} id={c.id} className="relative scroll-mt-[62px]" style={track(c)}>
                <div className={`${PANE} justify-start pt-20`} data-chapter-fade data-copy={copyOf(c)}>
                  <div className={`${BLOCK} wide:top-[36vh] wide:max-w-[calc(560*var(--u))] short:max-w-[calc(500*var(--u))]`}>
                    <StationText project={project} />
                  </div>
                </div>
              </section>
            );
          })}

          {/* ── THE PORTRAIT ───────────────────────────────────────────────
              The camera leaves the last table, crosses to the central axis and
              climbs the court to the portrait in its niche above the landing.
              Clicking it in the scene opens About; this is the same
              destination, as a link, for everyone who cannot click a painting.

              The copy stands on the upper wall beside the niche, a fifth of
              the way down a wide frame, from the foot of the stair to the
              landing; the lens's left edge is burnt in behind it for the
              climb, when the attic's windows pass there (lensFilter.ts,
              stationFilter). It outlasts its chapter by half a notch, while
              the camera holds on the picture (`track`). */}
          <section id="portrait" className="relative scroll-mt-[62px]" style={track(portrait)}>
            <div className={`${PANE} justify-end pb-[8vh]`} data-chapter-fade data-copy={copyOf(portrait)}>
              <div className={`${BLOCK} wide:top-[20vh] wide:max-w-[calc(430*var(--u))]`}>
                <p className="sr-only">At the top of the stairs</p>
                <p className="t-d3 text-[#F2EDE4]">
                  The name on the sanction letters has been the same{' '}
                  <span className="t-gilt">for&nbsp;twenty&nbsp;years.</span>
                </p>
                <p className="mt-7">
                  <Link href="/about" className="cta-quiet">
                    <span className="cta-quiet-label">Who we are</span>
                  </Link>
                </p>
              </div>
            </div>
          </section>

          {/* ── THE MAP TABLE ──────────────────────────────────────────────
              The camera comes off the portrait and down into the court of the
              stair, onto a walnut table with the two districts carved into
              its top (MapTable.tsx). The land the company sells, kept inside
              the house.

              THIS LIST IS THE AUTHORITY, not the pins. The canvas is
              decorative and aria-hidden; a visitor with no WebGL, no pointer or
              no sight reaches every project from here, in the same order, with
              the same numbers. */}
          <section id="city" className="relative scroll-mt-[62px]" style={track(city)}>
            <div
              aria-hidden
              data-film-end={city.to}
              className="pointer-events-none absolute left-0 h-px w-px"
              style={{ top: `${((city.to - city.from) * TRACK_VH).toFixed(2)}vh` }}
            />
            <div className={`${PANE} justify-start pt-[max(5rem,10vh)]`} data-chapter-fade data-copy={copyOf(city)}>
              <div className={`${BLOCK} wide:top-[17vh] wide:max-w-[calc(500*var(--u))]`}>
                <p className="sr-only">The land</p>
                <p className="t-d3 text-[#F2EDE4]">
                  Two districts.
                  <br className="hidden sm:block" /> Every layout we hold,{' '}
                  <span className="t-gilt">and&nbsp;where&nbsp;it&nbsp;stands.</span>
                </p>

                <ul className="mt-6 space-y-4 max-md:space-y-3 wide:mt-9 wide:space-y-5">
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

                {/* One sentence. It keeps BOTH of its claims: that the table is
                    a model, and that a pin is a district and not a site — no
                    published project has a centroid, and the page has to say
                    so in words (the E2E suite holds it to that). */}
                <p className="t-small mt-6 text-[#F2EDE4] short:sr-only max-md:mt-4 wide:mt-8 wide:max-w-[36ch]">
                  A model of the two districts, not a survey: a pin marks a
                  district, not a place on the ground.
                </p>
              </div>
            </div>
          </section>

          {/* The camera's last beat holds here. No copy at all for a third of a
              viewport: the table is lit, the sequence is over, and the frame is
              the only thing on screen before the house lights go down and the
              colophon arrives over it. */}
          <div aria-hidden className="min-h-[134vh]" />

          {/* Sold-out layouts sit AFTER the journey rather than inside it. They
              have no table in the hall — an unlit plinth is the honest 3D
              equivalent — but they are real projects and a buyer checking a
              developer's history should be able to see them. */}
          {soldOutProjects.length > 0 && (
            <section className="pointer-events-auto relative px-[var(--edge)] pt-[14vh]">
              <div className="max-w-[40rem]">
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
