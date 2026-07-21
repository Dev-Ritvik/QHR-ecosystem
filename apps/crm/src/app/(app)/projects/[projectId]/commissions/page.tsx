import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { coreSchema as core } from '@estate/db';
import { and, eq, isNull } from 'drizzle-orm';
import { CommissionRuleForm } from '@/components/commissions/CommissionRuleForm';
import { ProjectNav } from '@/components/projects/ProjectNav';
import { TrancheSplit } from '@estate/domain/commissions/engine';
import { notFound } from 'next/navigation';

export default async function ProjectCommissionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getRoleContext();

  // NFR-S3: Owner only access to commission overrides
  if (!context || context.role !== 'owner') {
    return <div className="p-6 text-destructive">Unauthorized. Owner access required.</div>;
  }

  const [project, overrideRule] = await authedQuery(context, async (tx: any) => {
    const proj = await tx.query.projects.findFirst({
      where: eq(core.projects.id, projectId)
    });
    const rule = await tx.query.commissionRules.findFirst({
      where: and(eq(core.commissionRules.projectId, projectId), isNull(core.commissionRules.archivedAt))
    });
    return [proj, rule];
  });

  if (!project) notFound();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Project Commission Override</h1>
        <p className="text-muted-foreground mt-1">
          Specific commission rules for {project.name}. If omitted, the office default applies.
        </p>
      </div>

      <ProjectNav projectId={projectId} />

      <CommissionRuleForm
        projectId={projectId}
        initialRateBps={overrideRule?.rateBps}
        initialSplit={overrideRule?.trancheSplit as TrancheSplit}
      />
    </div>
  );
}
