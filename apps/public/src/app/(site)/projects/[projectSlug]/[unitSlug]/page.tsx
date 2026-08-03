// apps/public/src/app/(site)/projects/[projectSlug]/[unitSlug]/page.tsx
import { notFound } from 'next/navigation';
import { db, getGeometryByProjectId, getPoisByProjectId, getUnitsByProjectId } from '@/lib/projection';
import { projectsPub, unitsPub } from '@estate/db';
import { eq, and } from 'drizzle-orm';
import { UnitSpecs } from '@/components/site/UnitSpecs';
import { DownloadBrochureButton } from '@/components/site/DownloadBrochureButton';
import { ProjectMap } from '@/components/map/ProjectMap';
import { formatPaise } from '@estate/domain/src/money/format';
import { format } from 'date-fns';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export default async function UnitDetailPage({ params }: { params: Promise<{ projectSlug: string, unitSlug: string }> }) {
  const { projectSlug, unitSlug } = await params;

  const results = await db
    .select({
      unit: unitsPub,
      project: projectsPub
    })
    .from(unitsPub)
    .innerJoin(projectsPub, eq(unitsPub.projectId, projectsPub.projectId))
    .where(
      and(
        eq(projectsPub.slug, projectSlug),
        eq(unitsPub.unitNumber, unitSlug)
      )
    )
    .limit(1);

  if (results.length === 0) notFound();

  const { unit, project } = results[0];
  const classDetails = unit.classDetails as { label: string, value: string }[];

  const [geometry, pois, units] = await Promise.all([
    getGeometryByProjectId(project.projectId),
    getPoisByProjectId(project.projectId),
    getUnitsByProjectId(project.projectId)
  ]);

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 print:p-0 print:max-w-none bg-background text-foreground">
      <RouteTelemetry routeId="unit-detail" />
      
      {/* ── Print-only PDF Stamped Header (FR-W6 / NFR-D5) ── */}
      <div className="hidden print:block mb-8 border-b-2 border-foreground pb-4">
        <h1 className="text-4xl font-bold tracking-tight">{project.name}</h1>
        <h2 className="text-2xl font-medium mt-1">Unit {unit.unitNumber}</h2>
        <div className="flex justify-between mt-4 text-sm text-muted-foreground font-mono">
          <span>Generated on: {format(new Date(), 'MMM d, yyyy')}</span>
          {unit.priceVersionId && <span>Rate Version: {unit.priceVersionId.substring(0,8).toUpperCase()}</span>}
        </div>
      </div>

      {/* ── Interactive Web Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unit {unit.unitNumber}</h1>
          <p className="text-lg text-muted-foreground mt-1">{project.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground capitalize">
            {unit.presentationStatus.replace('_', ' ')}
          </span>
          <DownloadBrochureButton 
            projectSlug={project.slug} 
            unitSlug={unit.unitNumber} 
            priceVersionId={unit.priceVersionId} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Map & Specs */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Map highlighting the specific unit */}
          <div className="h-64 sm:h-[400px] w-full bg-muted rounded-xl overflow-hidden shadow-sm border print:h-[500px]">
             {/* Uses the shared MapLibre component. */}
             <ProjectMap 
               project={project}
               units={units}
               geometry={geometry}
               pois={pois}
               selectedUnitId={unit.unitId} 
             />
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold border-b pb-2">Unit Specifications</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Dimensions</p>
                <p className="font-medium mt-1">{unit.dimensionsLabel || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Facing</p>
                <p className="font-medium mt-1 capitalize">{unit.facing || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Area</p>
                <p className="font-medium mt-1">
                  {unit.areaSqYd && `${unit.areaSqYd} sq yd`}
                  {unit.areaSqYd && unit.areaSqFt && ' / '}
                  {unit.areaSqFt && `${unit.areaSqFt} sq ft`}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Road Width</p>
                <p className="font-medium mt-1">{unit.roadWidthM ? `${unit.roadWidthM}m` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Corner Plot</p>
                <p className="font-medium mt-1">{unit.isCorner ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Legal */}
        <div className="space-y-6">
          <div className="bg-muted/50 border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Price</h3>
            <div className="text-3xl font-bold">
              {unit.priceOnRequest ? (
                'Price on Request'
              ) : (
                unit.pricePaise ? formatPaise(BigInt(unit.pricePaise)) : 'N/A'
              )}
            </div>
            {!unit.priceOnRequest && unit.pricePaise && (
              <p className="text-xs text-muted-foreground mt-2">
                * Prices are subject to change. Valid as of current rate version.
              </p>
            )}
          </div>

          {classDetails && classDetails.length > 0 && (
            <div className="border rounded-xl p-6 space-y-4 shadow-sm">
              <h3 className="text-lg font-semibold border-b pb-2">Legal & Class Details</h3>
              <ul className="space-y-3">
                {classDetails.map((detail, i) => (
                  <li key={i}>
                    <p className="text-sm text-muted-foreground">{detail.label}</p>
                    <p className="font-medium mt-1">{detail.value}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="print:hidden border rounded-xl p-6 bg-primary/5 border-primary/20">
            <h3 className="text-lg font-semibold mb-2">Interested?</h3>
            <p className="text-sm text-muted-foreground mb-4">Contact our team to schedule a site visit or ask questions about this unit.</p>
            <a 
              href={`#enquiry`}
              className="block text-center bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Enquire Now
            </a>
          </div>

          {/* Print-only Office Contact */}
          <div className="hidden print:block border rounded-xl p-6">
            <h3 className="font-bold border-b pb-2 mb-2">Office Contact</h3>
            <p className="text-sm">{process.env.NEXT_PUBLIC_SITE_URL?.replace('https://', '')}</p>
            {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (
              <p className="text-sm mt-1">Phone: {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
