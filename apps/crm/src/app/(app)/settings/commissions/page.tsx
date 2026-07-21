import { CommissionRuleForm } from '@/components/commissions/CommissionRuleForm';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { coreSchema as core } from '@estate/db';
import { and, isNull } from 'drizzle-orm';
import { TrancheSplit } from '@estate/domain/commissions/engine';
import { notFound } from 'next/navigation';

export default async function OfficeCommissionsPage() {
  const context = await getRoleContext();
  if (!context) notFound();

  // NFR-S3: Owner only access to commission settings
  if (context.role !== 'owner') {
    return <div className="p-6 text-destructive">Unauthorized. Owner access required.</div>;
  }

  const defaultRule = await authedQuery(context, async (tx) => {
    const [rule] = await tx.select().from(core.commissionRules).where(
      and(isNull(core.commissionRules.projectId), isNull(core.commissionRules.archivedAt))
    );
    return rule;
  });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Office Commission Settings</h1>
        <p className="text-muted-foreground mt-1">Set the default commission payout rules for the entire office.</p>
      </div>

      <CommissionRuleForm 
        initialRateBps={defaultRule?.rateBps} 
        initialSplit={defaultRule?.trancheSplit as TrancheSplit}
      />
    </div>
  );
}
