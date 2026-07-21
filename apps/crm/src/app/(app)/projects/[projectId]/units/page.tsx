import { authedQuery } from "@/server/db";
import { getRoleContext } from "@/server/session";
import { coreSchema as schema } from "@estate/db";
import { eq, and, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { UnitTable } from "@/components/units/UnitTable";
import { ProjectNav } from "@/components/projects/ProjectNav";
import Link from "next/link";

export default async function UnitsInventoryPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getRoleContext();
  if (!context) return notFound();

  const { project, list } = await authedQuery(context, async (tx) => {
    const [project] = await tx.select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId));

    if (!project) return { project: null, list: [] };

    const list = await tx.select()
      .from(schema.units)
      .where(
        and(
          eq(schema.units.projectId, projectId),
          isNull(schema.units.archivedAt)
        )
      )
      .orderBy(schema.units.unitNumber);

    return { project, list };
  });

  if (!project) notFound();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link href={`/projects/${projectId}`} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            &larr; Back to Project
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Unit Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Manage plots and units for {project.name}.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}/units/bulk`} className="border border-blue-600 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-50 text-sm font-medium transition-colors">
            Bulk Add
          </Link>
          <Link href={`/projects/${projectId}/units/new`} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors">
            Add Unit
          </Link>
        </div>
      </div>

      <ProjectNav projectId={projectId} />

      <UnitTable projectId={projectId} units={list} />
    </div>
  );
}
