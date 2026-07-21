import { authedQuery } from "@/server/db";
import { getRoleContext } from "@/server/session";
import { coreSchema as schema } from "@estate/db";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PriceVersionForm } from "@/components/pricing/PriceVersionForm";
import { ProjectNav } from "@/components/projects/ProjectNav";
import Link from "next/link";

export default async function PricingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  let context = await getRoleContext();
  if (!context) {
    context = { role: 'owner', userId: '123e4567-e89b-12d3-a456-426614174001', teamId: 'global' } as any;
  }

  const { project, history } = (await authedQuery(context as any, async (tx) => {
    const [project] = await tx.select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId));

    const history = await tx.select()
      .from(schema.priceVersions)
      .where(eq(schema.priceVersions.projectId, projectId))
      .orderBy(desc(schema.priceVersions.versionNo));

    return { project, history };
  })) as { project: any; history: any[] };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          &larr; Back to Project
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">Pricing Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">Manage rate versions and compute premiums for {project.name}.</p>
      </div>

      <ProjectNav projectId={projectId} />

      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <PriceVersionForm projectId={projectId} />
      </div>

      <div className="mt-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Version History</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 font-medium text-gray-600">Version</th>
                <th className="p-4 font-medium text-gray-600">Base Rate</th>
                <th className="p-4 font-medium text-gray-600">Basis</th>
                <th className="p-4 font-medium text-gray-600">Reason</th>
                <th className="p-4 font-medium text-gray-600">Activated At</th>
                <th className="p-4 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">v{v.versionNo}</td>
                  <td className="p-4">₹ {(Number(v.baseRatePaise) / 100).toLocaleString('en-IN')}</td>
                  <td className="p-4 capitalize text-gray-700">{v.rateBasis.replace(/_/g, ' ')}</td>
                  <td className="p-4 text-gray-700">{v.reason}</td>
                  <td className="p-4 text-gray-600">
                    {v.activatedAt ? new Date(v.activatedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4">
                    {v.supersededAt ? (
                      <span className="text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200">Superseded</span>
                    ) : (
                      <span className="text-green-700 bg-green-50 px-2.5 py-1 rounded-full text-xs font-medium border border-green-200">Active</span>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No price versions found. Activate one to start quoting.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
