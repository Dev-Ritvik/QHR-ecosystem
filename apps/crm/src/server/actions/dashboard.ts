'use server';

import { sql, eq, isNull, and, isNotNull, inArray } from 'drizzle-orm';
import { coreSchema as core, type CoreTransaction } from '@estate/db';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';

export async function getOwnerDashboardData() {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') {
    throw new Error('Owner access required');
  }

  return await authedQuery(context, async (db: CoreTransaction) => {

  // 1. Inventory Funnel per Project
  const inventoryFunnel = await db.select({
    projectName: core.projects.name,
    status: core.units.status,
    count: sql<number>`count(*)::int`,
  })
  .from(core.units)
  .innerJoin(core.projects, eq(core.units.projectId, core.projects.id))
  .where(isNull(core.units.archivedAt))
  .groupBy(core.projects.name, core.units.status);

  // 2. Pipeline Value by Stage
  const pipelineValue = await db.select({
    stage: core.leads.stage,
    valuePaise: sql<string>`sum(${core.leads.budgetMaxPaise})`, // Casts sum to string
    count: sql<number>`count(*)::int`,
  })
  .from(core.leads)
  .where(isNull(core.leads.archivedAt))
  .groupBy(core.leads.stage);

  // 3. Agent Activity (last 30 days)
  const agentActivity = await db.select({
    agentName: core.users.name,
    type: core.leadEvents.type,
    count: sql<number>`count(*)::int`,
  })
  .from(core.leadEvents)
  .innerJoin(core.users, eq(core.leadEvents.actorId, core.users.id))
  .where(sql`${core.leadEvents.createdAt} > now() - interval '30 days'`)
  .groupBy(core.users.name, core.leadEvents.type);

  // 4. Lead-source ROI
  const leadSourceRoi = await db.select({
    source: core.leads.source,
    totalLeads: sql<number>`count(*)::int`,
    wonLeads: sql<number>`sum(case when ${core.leads.stage} = 'won' then 1 else 0 end)::int`,
  })
  .from(core.leads)
  .where(isNull(core.leads.archivedAt))
  .groupBy(core.leads.source);

  // 5. Upcoming Expiries (Holds, ECs, Follow-ups)
  const expiringHolds = await db.query.holds.findMany({
    where: and(
      eq(core.holds.status, 'active'),
      sql`${core.holds.expiresAt} < now() + interval '7 days'`
    ),
    with: { 
      unit: { with: { project: true } },
      client: true
    },
    orderBy: (h: any, { asc }: any) => [asc(h.expiresAt)]
  });

  const expiringDocs = await db.query.documents.findMany({
    where: and(
      inArray(core.documents.status, ['on_file']),
      isNotNull(core.documents.expiryDate),
      sql`${core.documents.expiryDate} < now() + interval '30 days'`
    ),
    with: { 
      unit: { with: { project: true } }
    },
    orderBy: (d: any, { asc }: any) => [asc(d.expiryDate)]
  });

  const upcomingFollowUps = await db.query.leads.findMany({
    where: and(
      isNull(core.leads.archivedAt),
      isNotNull(core.leads.nextFollowUpAt),
      sql`${core.leads.nextFollowUpAt} > now()`,
      sql`${core.leads.nextFollowUpAt} < now() + interval '7 days'`
    ),
    with: { assignedAgent: true },
    orderBy: (l: any, { asc }: any) => [asc(l.nextFollowUpAt)]
  });

  return {
    inventoryFunnel,
    pipelineValue,
    agentActivity,
    leadSourceRoi,
    expiringHolds,
    expiringDocs,
    upcomingFollowUps
  };
  });
}
