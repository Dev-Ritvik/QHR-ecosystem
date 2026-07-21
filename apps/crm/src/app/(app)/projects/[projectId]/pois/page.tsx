import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { coreSchema as schema } from '@estate/db';
import { PoiForm, type EditingPoi } from '@/components/pois/PoiForm';
import { ProjectNav } from '@/components/projects/ProjectNav';
import { deletePoiForm, movePoiForm } from '@/server/actions/pois';
import { isNull, and } from 'drizzle-orm';

import { parseWkbPoint } from '@/lib/wkb';

export default async function POIsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ editPoi?: string }>;
}) {
  const { projectId } = await params;
  const { editPoi } = await searchParams;
  const context = await getRoleContext();
  if (!context) redirect('/login');

  const [projectRow] = await authedQuery(context, async (tx: any) => {
    return tx.select({
      id: schema.projects.id,
      name: schema.projects.name,
      assetClass: schema.projects.assetClass,
      centroid: schema.projects.centroid
    })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId));
  });

  const project = projectRow ? {
    ...projectRow,
    centroid: parseWkbPoint(projectRow.centroid as unknown as string)
  } : null;

  if (!project) notFound();

  const projectPois = await authedQuery(context, async (tx: any) => {
    return tx.select({
      id: schema.pois.id,
      name: schema.pois.name,
      category: schema.pois.category,
      distanceM: schema.pois.distanceM,
      distanceOverrideM: schema.pois.distanceOverrideM,
      driveTimeMin: schema.pois.driveTimeMin,
      driveTimeOverrideMin: schema.pois.driveTimeOverrideMin,
      sortOrder: schema.pois.sortOrder,
      location: schema.pois.location,
    })
    .from(schema.pois)
    .where(and(eq(schema.pois.projectId, projectId), isNull(schema.pois.archivedAt)))
    .orderBy(schema.pois.sortOrder);
  });

  // NOTE: no inline 'use server' closures here. Next's closure serialization
  // crashed on the captured query results ("Functions cannot be passed
  // directly to Client Components"); movePoi/deletePoi are module-level
  // actions bound with plain serializable arguments instead.

  // ?editPoi=<id> switches the right-hand form into edit mode, pre-filled.
  const editingRow = editPoi ? projectPois.find((p: any) => p.id === editPoi) : null;
  const initialPoi: EditingPoi | null = editingRow ? {
    id: editingRow.id,
    name: editingRow.name,
    category: editingRow.category,
    location: (parseWkbPoint(editingRow.location as unknown as string)?.coordinates as [number, number] | undefined) ?? null,
    distanceOverrideM: editingRow.distanceOverrideM,
    driveTimeMin: editingRow.driveTimeMin,
    driveTimeOverrideMin: editingRow.driveTimeOverrideMin,
  } : null;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">POIs & Connectivity — {project.name}</h1>
        <p className="text-sm text-gray-600">Curate landmarks, transport, and amenities for the public projection.</p>
      </div>

      <ProjectNav projectId={projectId} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-medium mb-4">Curated List</h2>
          {projectPois.length === 0 ? (
            <div className="bg-gray-50 border border-dashed rounded p-8 text-center text-gray-500">
              No POIs added yet.
            </div>
          ) : (
            <div className="space-y-3">
              {projectPois.map((poi: any, idx: number) => {
                const effectiveDist = poi.distanceOverrideM ?? poi.distanceM;
                const effectiveTime = poi.driveTimeOverrideMin ?? poi.driveTimeMin;

                return (
                  <div key={poi.id} className="bg-white border rounded p-3 flex justify-between items-center shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/projects/${projectId}/pois?editPoi=${poi.id}`}
                          className="font-medium text-blue-700 hover:underline"
                          title="Edit this POI"
                        >
                          {poi.name}
                        </Link>
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded uppercase tracking-wider">
                          {poi.category}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {effectiveDist != null ? `${(effectiveDist / 1000).toFixed(1)} km` : 'Distance unknown'}
                        {effectiveTime != null && ` • ~${effectiveTime} min drive`}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 items-end">
                      <div className="flex gap-1">
                        <form action={movePoiForm.bind(null, { poiId: poi.id, direction: 'up' as const })}>
                          <button type="submit" disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-30">
                            ↑
                          </button>
                        </form>
                        <form action={movePoiForm.bind(null, { poiId: poi.id, direction: 'down' as const })}>
                          <button type="submit" disabled={idx === projectPois.length - 1} className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-30">
                            ↓
                          </button>
                        </form>
                      </div>
                      <form action={deletePoiForm.bind(null, { poiId: poi.id })}>
                        <button type="submit" className="text-xs text-red-600 hover:underline mt-1">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          {/* key resets the form state when switching between add/edit targets */}
          <PoiForm
            key={initialPoi?.id ?? 'new'}
            projectId={project.id}
            projectCentroid={project.centroid}
            initialPoi={initialPoi}
          />
        </div>
      </div>
    </div>
  );
}
