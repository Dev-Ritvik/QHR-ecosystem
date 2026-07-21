import Link from 'next/link';
import { LeadList } from '@/components/leads/LeadList';
import { BulkReassignButton } from '@/components/leads/BulkReassignButton';
import { getRoleContext } from '@/server/session';
import { authedQuery } from '@/server/db';
import { coreSchema as schema } from '@estate/db';
import { desc, isNull, eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ agentId?: string }> }) {
  const context = await getRoleContext();
  if (!context) redirect('/login');
  const isOwner = context.role === 'owner';
  
  const params = await searchParams;

  const { agents, leads } = await authedQuery(context, async (tx) => {
    let usersList: { id: string, name: string }[] = [];
    if (isOwner) {
      usersList = await tx.query.users.findMany({
        where: isNull(schema.users.deactivatedAt),
        columns: { id: true, name: true },
        orderBy: (u, { asc }) => [asc(u.name)]
      });
    }

    const conditions = [isNull(schema.leads.archivedAt)];
    if (!isOwner) {
      conditions.push(eq(schema.leads.assignedAgentId, context.userId));
    } else if (params.agentId === 'unassigned') {
      conditions.push(isNull(schema.leads.assignedAgentId));
    } else if (params.agentId) {
      conditions.push(eq(schema.leads.assignedAgentId, params.agentId));
    }

    const leadsData = await tx
      .select({
        id: schema.leads.id,
        name: schema.leads.name,
        phone: schema.leads.phone,
        stage: schema.leads.stage,
        source: schema.leads.source,
        createdAt: schema.leads.createdAt,
        assignedAgentName: schema.users.name,
      })
      .from(schema.leads)
      .leftJoin(schema.users, eq(schema.leads.assignedAgentId, schema.users.id))
      .where(and(...conditions))
      .orderBy(desc(schema.leads.createdAt));

    return { agents: usersList, leads: leadsData };
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads & Pipeline</h1>
          <p className="text-muted-foreground mt-1">Manage enquiries and pipeline progress.</p>
        </div>
        <div className="flex items-center gap-3">
          {isOwner && (
            <BulkReassignButton agents={agents} />
          )}
          <Link
            href="/leads/new"
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 whitespace-nowrap"
          >
            New Lead
          </Link>
        </div>
      </div>

      <LeadList leads={leads} isOwner={isOwner} agents={agents} />
    </div>
  );
}
