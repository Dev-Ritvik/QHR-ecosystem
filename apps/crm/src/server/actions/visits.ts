// apps/crm/src/server/actions/visits.ts
'use server';

import { z } from 'zod';
import { authedQuery } from '@/server/db';
import { siteVisits, siteVisitLeads, siteVisitUnits, units, projects, type CoreTransaction } from '@estate/db';
import { writeAudit } from '@/server/audit';
import { getRoleContext } from '@/server/session';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { CreateVisitSchema, UpdateVisitStatusSchema, CaptureVisitOutcomeSchema } from '@/lib/validation';

export async function scheduleVisit(payload: z.infer<typeof CreateVisitSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = CreateVisitSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  if (context.role === 'agent' && parsed.data.agentId !== context.userId) {
    return { ok: false as const, code: 'UNAUTHORIZED' };
  }

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      const [visit] = await tx.insert(siteVisits).values({
        scheduledAt: new Date(parsed.data.scheduledAt),
        agentId: parsed.data.agentId,
        pickupPoint: parsed.data.pickupPoint,
        vehicleNote: parsed.data.vehicleNote,
        generalNote: parsed.data.generalNote,
        createdById: context.userId,
      }).returning({ id: siteVisits.id });

      await tx.insert(siteVisitLeads).values(
        parsed.data.leadIds.map(leadId => ({
          visitId: visit.id,
          leadId,
        }))
      );

      if (parsed.data.unitIds.length > 0) {
        await tx.insert(siteVisitUnits).values(
          parsed.data.unitIds.map((unitId, idx) => ({
            visitId: visit.id,
            unitId,
            sortOrder: idx,
          }))
        );
      }

      await writeAudit({ action: 'visit.create', entityType: 'site_visit', entityId: visit.id, actorId: context.userId, after: parsed.data }, tx);
      revalidatePath('/visits');
      revalidatePath('/');
      
      return { ok: true as const, data: visit };
    });
  } catch (err) {
    console.error('Failed to schedule visit:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

export async function updateVisitStatus(payload: z.infer<typeof UpdateVisitStatusSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = UpdateVisitStatusSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  try {
    await authedQuery(context, async (tx: CoreTransaction) => {
      await tx.update(siteVisits)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(siteVisits.id, parsed.data.visitId));

      await writeAudit({ action: 'visit.update_status', entityType: 'site_visit', entityId: parsed.data.visitId, actorId: context.userId, after: { status: parsed.data.status } }, tx);
    });

    revalidatePath('/visits');
    revalidatePath('/');
    return { ok: true as const };
  } catch (err) {
    console.error('Failed to update visit status:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

export async function getVisitForCapture(visitId: string) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      const [visit] = await tx.select().from(siteVisits).where(eq(siteVisits.id, visitId));
      if (!visit) return { ok: false as const, code: 'NOT_FOUND' };

      const visitUnits = await tx.select({
        unitId: siteVisitUnits.unitId,
        unitNumber: units.unitNumber,
        projectName: projects.name,
      })
      .from(siteVisitUnits)
      .innerJoin(units, eq(siteVisitUnits.unitId, units.id))
      .innerJoin(projects, eq(units.projectId, projects.id))
      .where(eq(siteVisitUnits.visitId, visitId))
      .orderBy(siteVisitUnits.sortOrder);

      return { ok: true as const, data: { visit, units: visitUnits } };
    });
  } catch (err) {
    console.error('Failed to get visit for capture:', err);
    return { ok: false as const, code: 'FETCH_FAILED' };
  }
}

export async function captureVisitOutcome(payload: z.infer<typeof CaptureVisitOutcomeSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = CaptureVisitOutcomeSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };

  try {
    await authedQuery(context, async (tx: CoreTransaction) => {
      await tx.update(siteVisits)
        .set({
          outcomeCapturedAt: new Date(),
          generalNote: parsed.data.generalNote,
          updatedAt: new Date(),
        })
        .where(eq(siteVisits.id, parsed.data.visitId));

      for (const uo of parsed.data.unitOutcomes) {
        await tx.update(siteVisitUnits)
          .set({
            outcomes: uo.outcomes,
            outcomeNote: uo.outcomeNote,
          })
          .where(and(
            eq(siteVisitUnits.visitId, parsed.data.visitId),
            eq(siteVisitUnits.unitId, uo.unitId)
          ));
      }

      await writeAudit({ action: 'visit.capture_outcome', entityType: 'site_visit', entityId: parsed.data.visitId, actorId: context.userId, after: parsed.data }, tx);
    });

    revalidatePath('/');
    revalidatePath('/visits');
    return { ok: true as const };
  } catch (err) {
    console.error('Failed to capture visit outcome:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}
