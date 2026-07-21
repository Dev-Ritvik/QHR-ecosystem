'use server';

import { coreSchema as core } from '@estate/db';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { ilike, or, and, eq, isNull } from 'drizzle-orm';

export async function searchGlobal(query: string) {
  if (!query || query.trim().length < 2) {
    return { ok: true as const, data: { leads: [], projects: [], units: [] } };
  }

  const context = await getRoleContext();
  if (!context) {
    return { ok: true as const, data: { leads: [], projects: [], units: [] } };
  }

  const q = `%${query.trim()}%`;

  return authedQuery(context, async (tx: any) => {
    // FR-C22 / NFR-S3: Search leads by name/phone. Scoped to agent if not owner.
    const leadsPromise = tx.query.leads.findMany({
      where: context.role === 'agent'
        ? and(
            or(ilike(core.leads.name, q), ilike(core.leads.phone, q)),
            eq(core.leads.assignedAgentId, context.userId),
            isNull(core.leads.archivedAt)
          )
        : and(
            or(ilike(core.leads.name, q), ilike(core.leads.phone, q)),
            isNull(core.leads.archivedAt)
          ),
      columns: { id: true, name: true, phone: true, stage: true },
      limit: 5,
    });

    // Projects search
    const projectsPromise = tx.query.projects.findMany({
      where: and(ilike(core.projects.name, q), isNull(core.projects.archivedAt)),
      columns: { id: true, name: true },
      limit: 5,
    });

    // Units search by plot number (unitNumber) or survey number
    const unitsPromise = tx.select({
      id: core.units.id,
      unitNumber: core.units.unitNumber,
      projectId: core.units.projectId,
      projectName: core.projects.name
    })
    .from(core.units)
    .innerJoin(core.projects, eq(core.units.projectId, core.projects.id))
    .leftJoin(core.unitLandDetails, eq(core.units.id, core.unitLandDetails.unitId))
    .where(
      and(
        isNull(core.units.archivedAt),
        or(
          ilike(core.units.unitNumber, q),
          ilike(core.unitLandDetails.surveyNumber, q)
        )
      )
    )
    .limit(5);

    // NFR-P6: Parallel execution for <300ms response time at seed-data scale
    const [leads, projects, units] = await Promise.all([leadsPromise, projectsPromise, unitsPromise]);

    return {
      ok: true as const,
      data: { leads, projects, units }
    };
  });
}
