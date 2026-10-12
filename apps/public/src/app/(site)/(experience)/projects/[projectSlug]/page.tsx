// apps/public/src/app/(site)/(experience)/projects/[projectSlug]/page.tsx
//
// A LAYOUT'S OWN PAGE: a folio opened at its own table in the hall.
//
// ---------------------------------------------------------------------------
// What this page was
// ---------------------------------------------------------------------------
//
// The most commercially important page of the site, and for three sections out
// of five it said that it had nothing: "Gallery Unavailable", "Map
// Unavailable", "No narrative provided for this project" — dashed boxes with an
// icon in each, because the register holds no photographs, no plot geometry
// and no narrative for these layouts. Its two real facts were the name and a
// badge. And it stood outside the house: no canvas behind it, a different
// header, on a page reached by "opening" a model in a hall it then had nothing
// to do with.
//
// Meanwhile everything a buyer wants from this page was already published on
// other ones: the sanctioned plan (the gallery), the plot sizes and roads (the
// plots page), the approval (five pages), how it is reached and what is near
// it (the locations page), the office that holds it (the offices page).
//
// ---------------------------------------------------------------------------
// What it is
// ---------------------------------------------------------------------------
//
// Those, on one page, in the order they are asked: how large and how many; the
// plan, at the page's full width, with what to look for on it; the plots and
// their areas; what the brochure lists; the approval; how it is reached; and
// the form that goes to the branch that holds it, bound to this layout.
//
//   WHAT A LAYOUT IS       lib/layouts.ts (off its sheet and its brochure)
//   HOW MANY, HOW MANY OPEN  the register's row for it, read here
//   A MAP OF ITS PLOTS     only when the register has their geometry
//   WHAT IS NEARBY, MAPPED  only when the register has surveyed places
//
// NOTHING IS "UNAVAILABLE". A section with no data is not on the page. When
// the register gains geometry or photographs they appear (LayoutMaps.tsx; the
// gallery block below), with no other change.
//
// A layout the register publishes that lib/layouts.ts does not know (one added
// in the CRM tomorrow) still has a page: its name, where it is, its counts,
// whatever the register says of it, and the form.
//
// The description is the project's own narrative when it has one, and falls
// back to its locality when it does not, because a made-up sentence about a
// real development is exactly the class of claim this project must not make.
//
// ---------------------------------------------------------------------------
// When the register does not answer
// ---------------------------------------------------------------------------
//
// The register is a database at the far end of a network, and this page asked
// it five questions with nothing between an unanswered one and the visitor.
// Seen on the finished build, on a connection that dropped for some seconds
// (ECONNRESET, then ETIMEDOUT): the site's most commercial page was a server
// error — and since the hall's own read had failed with it, a loading curtain
// over nothing.
//
// Almost nothing that makes this a page is in the register. It is the
// layout's own sheet and brochure, kept in lib/layouts.ts. So the register's
// row is read under a guard. If it does not answer and the sheets hold this
// layout, the page is set from the sheet: no counts, no map of plots, no
// photographs — the sections that are the register's — and the form still
// goes to the branch, naming the layout. If the sheets do not hold it either
// there is nothing true to set, and the error is the segment's (error.tsx).
// The four lesser reads (geometry, photographs, surveyed places, plots) each
// fail to an empty list: a section with no data is not on the page.
//
// ---------------------------------------------------------------------------
// One template, three pages, and no sentence in common
// ---------------------------------------------------------------------------
//
// The forensic audit of 2026-10-09 counted eleven sentences of nine words or
// more that stood on all three layouts' pages word for word (#86: "reused
// sentences are what a template leaves behind"), among them a band it names
// twice, "The plan is the promise. The land is the proof." (#84: "most section
// headings are two-beat aphorisms"), and "check the number against the
// authority's own records rather than against this page" (#85: pages that
// talk about themselves). The template stands; what it prints is each
// layout's own: which branch gives its plot numbers, whose records its
// approval is looked up in and under what number, who walks a visitor over
// it. A sentence that could not be made the layout's own is gone (how to open
// a file; that the plan is what the page is checked against), and so is a row
// that printed "ask the branch" where a reference would be (#87): the
// sentence under it says whom to ask, and for what.
//
// AND HOW IT IS REACHED IS ON ONE PAGE. The roads to a layout and what stands
// near it were set out here and, word for word, on the page of locations
// (#86: "say each thing in one place and link to it"). They are that page's;
// this one names the branch that holds the layout and points there, and keeps
// what only it can show: the surveyed places, mapped, when the register has
// them.

import type { Metadata } from 'next';
import { SITE_NAME } from '@/components/site/siteMap';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BRANCHES } from '@estate/domain/leads/branches';
import {
  Actions,
  Figures,
  Folio,
  Gilt,
  Go,
  Ledger,
  List,
  NextPage,
  Note,
  Paper,
  Plate,
  Prose,
  Sheet,
  Table,
  Window,
  type FigureItem,
} from '@/components/folio/Folio';
import { NearbyMap, PlanMap } from '@/components/site/LayoutMaps';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { COMPANY } from '@/lib/company';
import { LAYOUTS, layoutBySlug, plotArea } from '@/lib/layouts';
import {
  getGeometryByProjectId,
  getMediaByProjectId,
  getPoisByProjectId,
  getProjectBySlug,
  getUnitsByProjectId,
} from '@/lib/projection';
import { num } from '@/lib/published';
import { EnquiryForm } from '../../../enquiry-form';

type Row = NonNullable<Awaited<ReturnType<typeof getProjectBySlug>>>;

/** The register did not answer (which is not the same as "no such layout"). */
const UNREAD = Symbol('unread');

async function readRow(slug: string): Promise<Row | null | typeof UNREAD> {
  try {
    return await getProjectBySlug(slug);
  } catch (err) {
    console.error('[layout] the register did not answer; the page is set from its sheet', err);
    return UNREAD;
  }
}

/** A read of the register's that the page can stand without. */
async function orNone<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (err) {
    console.error('[layout] a read of the register failed; its section is left off', err);
    return [];
  }
}

/** What this page reads of a layout's row. */
interface PageProject {
  projectId: string | null;
  slug: string;
  name: string;
  narrative: unknown;
  locality: string | null;
  city: string | null;
  amenities: unknown;
  totalUnits: number | null;
  availableUnits: number | null;
}

/** The same, off the layout's own sheet: its name and its place, and nothing
 *  that is counted. */
function fromSheet(sheet: NonNullable<ReturnType<typeof layoutBySlug>>): PageProject {
  return {
    projectId: null,
    slug: sheet.slug,
    name: sheet.name,
    narrative: null,
    locality: sheet.where,
    city: sheet.district,
    amenities: null,
    totalUnits: null,
    availableUnits: null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}): Promise<Metadata> {
  const { projectSlug } = await params;
  const row = await readRow(projectSlug);
  const sheet = layoutBySlug(projectSlug);
  // (Unanswered, a layout the sheets hold keeps its own title: a crawler that
  // came during an outage was told the page did not exist.)
  const project: PageProject | null = row === UNREAD ? (sheet ? fromSheet(sheet) : null) : row;
  if (!project) return { title: `Project not found — ${SITE_NAME}` };

  const where = [project.locality, project.city].filter(Boolean).join(', ');
  // (One separator in a tab's title, the site over: a name, a dash, the house.
  // These two were the only titles with a bar in them.)
  const title = where ? `${project.name}, ${where} — ${SITE_NAME}` : `${project.name} — ${SITE_NAME}`;

  const description =
    (typeof project.narrative === 'string' && project.narrative.trim()) ||
    (where ? `${project.name}, an approved plotted development at ${where}.` : undefined);

  return { title, description, alternates: { canonical: `/projects/${projectSlug}` } };
}

const yd = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const row = await readRow(projectSlug);

  if (row === null) {
    notFound();
  }
  // (See "When the register does not answer", above.)
  const real = row === UNREAD ? null : row;
  const onSheet = layoutBySlug(projectSlug);
  if (!real && !onSheet) {
    throw new Error('The register did not answer, for a layout the sheets do not hold.');
  }
  const project: PageProject = real ?? fromSheet(onSheet!);
  const id = project.projectId;

  const layout = layoutBySlug(project.slug);
  const [geometry, media, pois] = id
    ? await Promise.all([
        orNone(() => getGeometryByProjectId(id)),
        orNone(() => getMediaByProjectId(id)),
        orNone(() => getPoisByProjectId(id)),
      ])
    : [[], [], []];
  // The plots are only wanted by the map of them.
  const units = id && geometry.length > 0 ? await orNone(() => getUnitsByProjectId(id)) : [];
  const galleryMedia = media.filter((m: any) => m.kind === 'gallery' && (m.variants as any)?.web?.url);
  const amenities: string[] = Array.isArray(project.amenities)
    ? (project.amenities as any[]).map((a) => String(a?.label ?? '')).filter(Boolean)
    : [];

  const total = typeof project.totalUnits === 'number' ? project.totalUnits : null;
  const open = typeof project.availableUnits === 'number' ? project.availableUnits : null;
  const where = layout
    ? `${layout.where} · ${layout.district} district`
    : [project.locality, project.city].filter(Boolean).join(' · ');
  const office = layout ? BRANCHES[layout.branch] : null;
  // "the Vizianagaram branch": whom a reader of this layout's page is sent to.
  const theOffice = office
    ? `the ${office.name} ${office.role === 'head_office' ? 'office' : 'branch'}`
    : 'the office that holds it';
  const TheOffice = theOffice.charAt(0).toUpperCase() + theOffice.slice(1);

  const [head, ...rest] = project.name.split(' ');
  const figures: FigureItem[] = [
    ...(total !== null ? [{ value: num(total), label: 'plots in the layout' }] : []),
    ...(open !== null ? [{ value: num(open), label: 'open today' }] : []),
    ...(layout
      ? [
          {
            value: String(layout.sizes.length),
            label: layout.sizes.length === 1 ? 'plot size, throughout' : 'plot sizes',
          },
          { value: String(Math.max(...layout.roadWidths)), unit: 'ft', label: 'its widest road' },
        ]
      : []),
  ];

  // The plan sheet's three parts, arranged below by the plan's proportions.
  const upright = layout ? layout.plan.w / layout.plan.h < 1.25 : false;
  const plan = layout ? (
    <Paper
      src={layout.plan.src}
      w={layout.plan.w}
      h={layout.plan.h}
      alt={`Sanctioned layout plan of ${layout.name}`}
      eager
    />
  ) : null;
  const lookFor = layout ? (
    <>
      <h3 className="folio-sub" data-reveal>
        What to look for on it
      </h3>
      <List className="is-small" items={layout.onTheSheet} />
    </>
  ) : null;
  const readIt = layout ? (
    <>
      <h3 className="folio-sub" data-reveal>
        To read it properly
      </h3>
      <Actions>
        <Go href={layout.plan.pdf} download>
          The plan, {layout.plan.pdfSize}
        </Go>
        <Go href="/knowledge/reading-a-layout-plan">How to read a layout plan</Go>
        <Go href={`/gallery#${layout.slug}`}>All three plans</Go>
      </Actions>
    </>
  ) : null;

  const i = LAYOUTS.findIndex((l) => l.slug === project.slug);
  const next = LAYOUTS.length > 1 ? LAYOUTS[(i + 1 + LAYOUTS.length) % LAYOUTS.length] : null;
  const provided = layout && layout.features.length > 0 ? layout.features : !layout ? amenities : [];

  return (
    <>
      <RouteTelemetry routeId="project-detail" />
      <Folio>
        <Plate
          kicker={where || 'A layout'}
          title={
            rest.length > 0 ? (
              <>
                {head} <Gilt>{rest.join(' ')}.</Gilt>
              </>
            ) : (
              <>
                {head}
                <Gilt>.</Gilt>
              </>
            )
          }
          lede={layout?.summary ?? (typeof project.narrative === 'string' ? project.narrative : undefined)}
          cue={figures.length > 0 ? { label: 'At a glance', href: '#glance' } : { label: 'Ask about it', href: '#ask' }}
        >
          <Go href="/book-a-site-visit">Arrange a site visit</Go>
        </Plate>

        {figures.length > 0 ? (
          <Sheet
            id="glance"
            rail="At a glance"
            first
            layout="full"
            kicker="At a glance"
            title={
              <>
                How large, <Gilt>and how much is open.</Gilt>
              </>
            }
          >
            <Figures items={figures} />
            <Note className="mt-12">
              {total !== null ? 'The counts are read from the offices’ register. ' : null}
              {TheOffice} gives the open plot numbers at {project.name}, and the rate, for the day
              you ask.
            </Note>
          </Sheet>
        ) : null}

        {layout ? (
          <Sheet
            id="plan"
            rail="The plan"
            layout="full"
            raised
            kicker="The sanctioned plan"
            title={
              <>
                The whole layout, <Gilt>on one sheet.</Gilt>
              </>
            }
          >
            {upright ? (
              // A plan that is nearly square: beside what is said of it.
              <div className="folio-plan is-upright">
                {plan}
                <div>
                  {lookFor}
                  <div className="mt-12">{readIt}</div>
                </div>
              </div>
            ) : (
              <>
                {plan}
                <div className="folio-pair mt-14">
                  <div>{lookFor}</div>
                  <div>{readIt}</div>
                </div>
              </>
            )}
          </Sheet>
        ) : null}

        {real && geometry.length > 0 ? (
          <Sheet
            id="map"
            rail="The plots, mapped"
            layout="full"
            kicker="The plots, mapped"
            title={
              <>
                Every plot, <Gilt>where it lies.</Gilt>
              </>
            }
          >
            <div className="folio-map" data-reveal>
              <PlanMap project={real} units={units} geometry={geometry} pois={pois} />
            </div>
          </Sheet>
        ) : null}

        {layout ? (
          <Sheet
            id="plots"
            rail="The plots"
            kicker="The plots"
            title={
              layout.sizes.length === 1 ? (
                <>
                  One size, <Gilt>and the road it stands on.</Gilt>
                </>
              ) : (
                <>
                  The sizes, <Gilt>and the roads they stand on.</Gilt>
                </>
              )
            }
            note={`Frontage by depth in feet, as the ${layout.name} sheet prints it. Areas are worked from those figures.`}
          >
            <Table
              head={['Plot', 'Sq ft', 'Sq yd']}
              numeric={[1, 2]}
              rows={layout.sizes.map((s) => {
                const a = plotArea(s);
                return [s.label, a.sqFt.toLocaleString('en-IN'), yd(a.sqYd)];
              })}
            />
            <div className="mt-10">
              <Ledger
                rows={[
                  { term: 'Roads', value: layout.roads },
                  ...(layout.approach ? [{ term: 'The way in', value: layout.approach }] : []),
                ]}
              />
            </div>
            <Actions>
              <Go href="#ask">Ask which plots are open</Go>
              <Go href="/properties">Every size, side by side</Go>
            </Actions>
          </Sheet>
        ) : null}

        {provided.length > 0 ? (
          <Sheet
            id="provided"
            rail="What is listed"
            raised
            kicker={layout ? 'As its brochure lists them' : 'As the register lists them'}
            title={
              <>
                What is <Gilt>to be provided.</Gilt>
              </>
            }
            note={`Ask ${theOffice} which of these stand at ${project.name} today, and see them when you walk it.`}
          >
            <List items={provided} />
          </Sheet>
        ) : null}

        {galleryMedia.length > 0 ? (
          <Sheet
            id="photographs"
            rail="Photographs"
            layout="full"
            kicker="Photographs"
            title={
              <>
                The site, <Gilt>photographed.</Gilt>
              </>
            }
          >
            <div className="folio-photos">
              {galleryMedia.map((m: any) => (
                <div key={m.id} className="folio-photo" data-reveal>
                  <Image
                    src={(m.variants as any).web.url}
                    alt={m.altText}
                    fill
                    sizes="(max-width: 900px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </Sheet>
        ) : null}

        <Window gloss={`${TheOffice} arranges a visit to ${project.name} and walks you over it.`}>
          See it <Gilt>on the ground.</Gilt>
        </Window>

        {layout ? (
          <Sheet
            id="approval"
            rail="Approval"
            kicker="Approval"
            title={
              <>
                Whose sanction, <Gilt>and how to check it.</Gilt>
              </>
            }
          >
            <Ledger
              rows={[
                { term: 'Authority', value: layout.approval.authority },
                ...(layout.approval.reference ? [{ term: 'Reference', value: layout.approval.reference }] : []),
              ]}
            />
            <div className="mt-10">
              <Prose>
                {layout.approval.reference ? (
                  <p>
                    Look up {layout.approval.reference} in {layout.approval.authority}&rsquo;s own
                    records, and ask {theOffice} for the approval papers of the plot you are
                    considering.
                  </p>
                ) : (
                  <p>
                    Ask {theOffice} for the {layout.approval.authority} approval reference of{' '}
                    {layout.name} and the approval papers of the plot you are considering, and look
                    the reference up in the authority&rsquo;s own records.
                  </p>
                )}
              </Prose>
            </div>
            <Actions>
              <Go href="/investment-guide#documents">The other documents to read</Go>
            </Actions>
          </Sheet>
        ) : null}

        {layout ? (
          <Sheet
            id="getting-there"
            rail="Getting there"
            raised
            kicker="Getting there"
            title={
              <>
                {layout.where.split(',')[0]}, <Gilt>{layout.district} district.</Gilt>
              </>
            }
          >
            <Ledger
              rows={[
                {
                  term: 'The way there',
                  value: (
                    <Link className="folio-link" href={`/locations#${layout.slug}`}>
                      The roads to {layout.where.split(',')[0]}, and what is near
                    </Link>
                  ),
                },
                ...(office
                  ? [
                      {
                        term: 'Held by',
                        value: (
                          <Link className="folio-link" href={`/branches#${layout.branch}`}>
                            {TheOffice}
                          </Link>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {real && pois.length > 0 ? (
              <div className="mt-12">
                <NearbyMap pois={pois as any} projectCentroid={real.centroid} />
              </div>
            ) : null}
            <Actions>
              <Go href="/book-a-site-visit">Arrange a site visit</Go>
            </Actions>
          </Sheet>
        ) : null}

        <Sheet
          id="ask"
          rail="Ask about it"
          kicker={office ? `To the ${office.name} ${office.role === 'head_office' ? 'office' : 'branch'}` : 'To the office that holds it'}
          title={
            <>
              Ask about <Gilt>{project.name}.</Gilt>
            </>
          }
          note={
            <>
              Which {project.name} plots are open, what they cost today, the papers for one of
              them. Or telephone{' '}
              <a className="folio-link" href={COMPANY.phone.href}>
                {COMPANY.phone.display}
              </a>
              .
            </>
          }
        >
          <EnquiryForm projectId={project.projectId ?? undefined} projectName={project.name} />
        </Sheet>

        {next && next.slug !== project.slug ? (
          <NextPage
            href={`/projects/${next.slug}`}
            kicker="Next"
            title={next.name}
            line={`${next.where}, ${next.district} district.`}
          />
        ) : (
          <NextPage href="/projects" kicker="Back to" title="The layouts" />
        )}
      </Folio>
    </>
  );
}
