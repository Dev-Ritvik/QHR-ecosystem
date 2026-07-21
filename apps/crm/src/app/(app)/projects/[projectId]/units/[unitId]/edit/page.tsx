import { authedQuery } from "@/server/db";
import { getRoleContext } from "@/server/session";
import { coreSchema as schema } from "@estate/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { UnitForm } from "@/components/units/UnitForm";
import Link from "next/link";

export default async function EditUnitPage({ params }: { params: Promise<{ projectId: string, unitId: string }> }) {
  const { projectId, unitId } = await params;
  const context = await getRoleContext();
  if (!context) return notFound();

  const { project, unit, details } = await authedQuery(context, async (tx: any) => {
    const [project] = await tx.select().from(schema.projects).where(eq(schema.projects.id, projectId));
    if (!project) return { project: null, unit: null, details: null };

    const [unit] = await tx.select().from(schema.units).where(eq(schema.units.id, unitId));
    if (!unit || unit.projectId !== projectId) return { project, unit: null, details: null };

    let details = null;
    if (project.assetClass === 'land') {
      [details] = await tx.select().from(schema.unitLandDetails).where(eq(schema.unitLandDetails.unitId, unitId));
    } else if (project.assetClass === 'commercial') {
      [details] = await tx.select().from(schema.unitCommercialDetails).where(eq(schema.unitCommercialDetails.unitId, unitId));
    } else if (project.assetClass === 'luxury_residential') {
      [details] = await tx.select().from(schema.unitLuxuryDetails).where(eq(schema.unitLuxuryDetails.unitId, unitId));
    }

    return { project, unit, details };
  });

  if (!project || !unit) notFound();

  // UnitForm reads a flat object (core columns + asset-class detail columns).
  // overridePricePaise is a bigint; the form divides by 100 for rupee display.
  const initialData = {
    ...unit,
    ...(details ?? {}),
    overridePricePaise: unit.overridePricePaise ? unit.overridePricePaise.toString() : null,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/projects/${projectId}/units`} className="text-gray-500 hover:text-gray-900 transition-colors">
          &larr; Back to Inventory
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Unit {unit.unitNumber}</h1>
      </div>

      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <UnitForm projectId={projectId} assetClass={project.assetClass} unitId={unitId} initialData={initialData} />
      </div>
    </div>
  );
}
