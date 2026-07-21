import { authedQuery } from "@/server/db";
import { getRoleContext } from "@/server/session";
import { coreSchema as schema } from "@estate/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BulkUnitForm } from "@/components/units/BulkUnitForm";
import Link from "next/link";

export default async function BulkUnitsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getRoleContext();
  if (!context) return notFound();

  const [project] = await authedQuery(context, (tx) =>
    tx.select().from(schema.projects).where(eq(schema.projects.id, projectId))
  );

  if (!project) notFound();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/projects/${projectId}/units`} className="text-gray-500 hover:text-gray-900 transition-colors">
          &larr; Back to Inventory
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Add Units</h1>
      </div>

      <BulkUnitForm projectId={projectId} assetClass={project.assetClass} />
    </div>
  );
}
