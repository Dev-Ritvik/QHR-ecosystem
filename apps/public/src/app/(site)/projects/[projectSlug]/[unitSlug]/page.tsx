// apps/public/src/app/(site)/projects/[projectSlug]/[unitSlug]/page.tsx
//
// A PLOT'S OWN PAGE — and the sheet its brochure is printed from.
//
// NOT LINKED FROM ANYWHERE, ON PURPOSE. The register's plot numbers are
// provisional until the client's plot register arrives, so no page of the site
// points at a plot by number and the sitemap lists none (app/sitemap.ts has the
// account). It is reachable by its address, and the brochure route renders it
// to PDF in print mode (api/brochure) — which is why it stays OUTSIDE the
// experience group: a brochure must not wait on, or print, a WebGL canvas.
//
// A FOLIO ON SCREEN since 2026-10-06, like every other page: a plate (with no
// picture behind it here), then sheets. It was the one page still drawn in the
// component library's defaults — rounded cards, a pill for the status, a filled
// button — on a site that has none of those anywhere else.
//
// WHAT PRINT GETS IS UNCHANGED IN SUBSTANCE: the stamped header (project, plot,
// date, rate version), the specifications, the price line, the legal details
// and the office contact. The print-only blocks are kept as they were; the
// screen-only chrome (the plate, the form) is marked `print:hidden`, and the
// site's own chrome is taken off the sheet by app/folio.css (@media print).
//
// Nothing about price is stated beyond what the register holds — every unit in
// the projection is price_on_request with no price set, so any figure here
// would be fabricated.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { and, eq } from 'drizzle-orm';
import { projectsPub, unitsPub } from '@estate/db';
import { formatPaise } from '@estate/domain/src/money/format';
import { Folio, Gilt, Go, Actions, Ledger, Note, Plate, Sheet } from '@/components/folio/Folio';
import { DownloadBrochureButton } from '@/components/site/DownloadBrochureButton';
import { PlanMap } from '@/components/site/LayoutMaps';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { db, getGeometryByProjectId, getPoisByProjectId, getUnitsByProjectId } from '@/lib/projection';
import { EnquiryForm } from '../../../enquiry-form';

/**
 * This page rendered with an EMPTY <title> — verified in the browser. There was
 * no metadata export at all, so a shared plot link showed a blank tab and a
 * blank preview.
 *
 * Built only from columns that exist: unit number, project name, locality, and
 * the dimensions/area the layout plan already publishes.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string; unitSlug: string }>;
}): Promise<Metadata> {
  const { projectSlug, unitSlug } = await params;

  const rows = await db
    .select({
      unitNumber: unitsPub.unitNumber,
      dimensionsLabel: unitsPub.dimensionsLabel,
      areaSqYd: unitsPub.areaSqYd,
      projectName: projectsPub.name,
      locality: projectsPub.locality,
      city: projectsPub.city,
    })
    .from(unitsPub)
    .innerJoin(projectsPub, eq(unitsPub.projectId, projectsPub.projectId))
    .where(and(eq(projectsPub.slug, projectSlug), eq(unitsPub.unitNumber, unitSlug)))
    .limit(1)
    .catch(() => []);

  const row = rows[0];
  if (!row) return { title: 'Plot not found — Quality Homes Reality' };

  const where = [row.locality, row.city].filter(Boolean).join(', ');
  const size = row.dimensionsLabel || (row.areaSqYd ? `${row.areaSqYd} sq yd` : null);

  return {
    title: `Plot ${row.unitNumber}, ${row.projectName} — Quality Homes Reality`,
    description: [
      `Plot ${row.unitNumber} at ${row.projectName}`,
      where || null,
      size ? `${size}.` : null,
      'Price on request from the office that holds the site.',
    ]
      .filter(Boolean)
      .join(' · '),
    // Provisional numbering: a plot's page is not for a search engine.
    robots: { index: false, follow: true },
  };
}

const STATUS: Record<string, string> = {
  available: 'Open',
  selling_fast: 'Open',
  on_hold: 'On hold',
  booked: 'Booked',
  sold: 'Sold',
  not_for_sale: 'Not for sale',
};

export default async function UnitDetailPage({ params }: { params: Promise<{ projectSlug: string; unitSlug: string }> }) {
  const { projectSlug, unitSlug } = await params;

  const results = await db
    .select({
      unit: unitsPub,
      project: projectsPub,
    })
    .from(unitsPub)
    .innerJoin(projectsPub, eq(unitsPub.projectId, projectsPub.projectId))
    .where(and(eq(projectsPub.slug, projectSlug), eq(unitsPub.unitNumber, unitSlug)))
    .limit(1);

  if (results.length === 0) notFound();

  const { unit, project } = results[0];
  const classDetails = (Array.isArray(unit.classDetails) ? unit.classDetails : []) as { label: string; value: string }[];

  const geometry = await getGeometryByProjectId(project.projectId);
  // The plots and the places are only wanted by the map of them.
  const [pois, units] =
    geometry.length > 0
      ? await Promise.all([getPoisByProjectId(project.projectId), getUnitsByProjectId(project.projectId)])
      : [[], []];

  const where = [project.locality, project.city].filter(Boolean).join(', ');
  const area = [unit.areaSqYd ? `${unit.areaSqYd} sq yd` : null, unit.areaSqFt ? `${unit.areaSqFt} sq ft` : null]
    .filter(Boolean)
    .join(' · ');
  const price = unit.priceOnRequest
    ? 'On request'
    : unit.pricePaise
      ? formatPaise(BigInt(unit.pricePaise))
      : 'On request';

  const specs = [
    ...(unit.dimensionsLabel ? [{ term: 'Dimensions', value: unit.dimensionsLabel }] : []),
    ...(area ? [{ term: 'Area', value: area }] : []),
    ...(unit.facing ? [{ term: 'Facing', value: <span className="capitalize">{unit.facing}</span> }] : []),
    ...(unit.roadWidthM ? [{ term: 'Road width', value: `${unit.roadWidthM} m` }] : []),
    { term: 'Corner plot', value: unit.isCorner ? 'Yes' : 'No' },
    { term: 'Status', value: STATUS[unit.presentationStatus] ?? unit.presentationStatus.replace('_', ' ') },
    { term: 'Price', value: price },
    ...classDetails.map((d) => ({ term: d.label, value: d.value })),
  ];

  return (
    <Folio>
      <RouteTelemetry routeId="unit-detail" />

      {/* ── Print-only PDF Stamped Header (FR-W6 / NFR-D5) ── */}
      <div className="hidden print:block mb-8 border-b-2 border-foreground pb-4">
        <h1 className="text-step-4 font-bold tracking-tight">{project.name}</h1>
        <h2 className="text-step-2 font-medium mt-1">Unit {unit.unitNumber}</h2>
        <div className="flex justify-between mt-4 text-step--1 text-muted-foreground lining-nums tabular-nums">
          <span>Generated on: {format(new Date(), 'MMM d, yyyy')}</span>
          {unit.priceVersionId && <span>Rate Version: {unit.priceVersionId.substring(0, 8).toUpperCase()}</span>}
        </div>
      </div>

      {/* ── On screen: the plate ── */}
      <div className="folio-bare print:hidden">
        <Plate
          short
          kicker={where ? `${project.name} · ${where}` : project.name}
          title={
            <>
              Plot <Gilt>{unit.unitNumber}.</Gilt>
            </>
          }
          lede={[unit.dimensionsLabel, area].filter(Boolean).join(' · ') || undefined}
          cue={{ label: 'The plot', href: '#plot' }}
        >
          <DownloadBrochureButton
            projectSlug={project.slug}
            unitSlug={unit.unitNumber}
            priceVersionId={unit.priceVersionId}
          />
        </Plate>
      </div>

      <Sheet
        id="plot"
        rail="The plot"
        first
        kicker="As the register has it"
        title={
          <>
            Plot {unit.unitNumber}, <Gilt>in figures.</Gilt>
          </>
        }
        note="Plot numbers on this site are provisional. Confirm the number against the sanctioned plan with the branch before relying on it."
      >
        <Ledger rows={specs} />
        {!unit.priceOnRequest && unit.pricePaise ? (
          <Note className="mt-8">Prices are subject to change. Valid as of the current rate version.</Note>
        ) : null}
        <div className="print:hidden">
          <Actions>
            <Go href={`/projects/${project.slug}`}>The whole layout</Go>
            <Go href={`/projects/${project.slug}#plan`}>Its sanctioned plan</Go>
          </Actions>
        </div>
      </Sheet>

      {geometry.length > 0 ? (
        <Sheet
          id="map"
          rail="On the plan"
          layout="full"
          raised
          kicker="On the plan"
          title={
            <>
              Where it lies <Gilt>in the layout.</Gilt>
            </>
          }
        >
          <div className="folio-map print:h-[500px]">
            <PlanMap project={project} units={units} geometry={geometry} pois={pois} selectedUnitId={unit.unitId} />
          </div>
        </Sheet>
      ) : null}

      <div className="print:hidden">
        <Sheet
          id="ask"
          rail="Ask about it"
          kicker="To the office that holds it"
          title={
            <>
              Ask about <Gilt>this plot.</Gilt>
            </>
          }
          note={
            <>
              Whether it is still open, what it costs today, and its papers. Or{' '}
              <Link className="folio-link" href="/book-a-site-visit">
                arrange to walk it
              </Link>
              .
            </>
          }
        >
          <EnquiryForm
            projectId={project.projectId}
            projectName={project.name}
            unitId={unit.unitId}
            unitNumber={unit.unitNumber}
          />
        </Sheet>
      </div>

      {/* Print-only Office Contact */}
      <div className="hidden print:block border rounded-xl p-6">
        <h3 className="font-bold border-b pb-2 mb-2">Office Contact</h3>
        <p className="text-step--1">{process.env.NEXT_PUBLIC_SITE_URL?.replace('https://', '')}</p>
        {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (
          <p className="text-step--1 mt-1">Phone: {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}</p>
        )}
      </div>
    </Folio>
  );
}
