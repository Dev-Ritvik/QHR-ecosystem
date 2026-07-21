// apps/crm/src/server/actions/leads.ts
'use server';

import { z } from 'zod';
import { authedQuery } from '@/server/db';
import { leads, leadEvents, type CoreTransaction } from '@estate/db';
import { writeAudit } from '@/server/audit';
import { getRoleContext } from '@/server/session';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { 
  LeadSchema, 
  LogInteractionSchema, 
  ChangeStageSchema,
  TriageAssignSchema,
  TriageMergeSchema,
  TriageSpamSchema,
  LogNegotiationSchema
} from '@/lib/validation';

export async function createLead(payload: z.infer<typeof LeadSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = LeadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      const [lead] = await tx.insert(leads).values({
        ...parsed.data,
        assignedAgentId: context.userId,
      }).returning({ id: leads.id });

      await tx.insert(leadEvents).values({
        leadId: lead.id,
        type: 'stage_change',
        toStage: 'new',
        actorId: context.userId,
        note: 'Lead created',
      });

      await writeAudit({ action: 'lead.create', entityType: 'lead', entityId: lead.id, actorId: context.userId, after: parsed.data }, tx);
      revalidatePath('/leads');
      return { ok: true as const, data: lead };
    });
  } catch (err) {
    console.error('Failed to create lead:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

export async function logInteraction(payload: z.infer<typeof LogInteractionSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = LogInteractionSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      const [event] = await tx.insert(leadEvents).values({
        leadId: parsed.data.leadId,
        type: 'interaction',
        interactionType: parsed.data.interactionType,
        outcomes: parsed.data.outcomes,
        note: parsed.data.note,
        actorId: context.userId,
      }).returning({ id: leadEvents.id });

      if (parsed.data.nextFollowUpAt) {
        await tx.update(leads)
          .set({ nextFollowUpAt: new Date(parsed.data.nextFollowUpAt), updatedAt: new Date() })
          .where(eq(leads.id, parsed.data.leadId));
      }

      await writeAudit({ action: 'lead.interaction', entityType: 'lead', entityId: parsed.data.leadId, actorId: context.userId, after: {
        interactionType: parsed.data.interactionType,
        outcomes: parsed.data.outcomes
      }}, tx);

      revalidatePath(`/leads/${parsed.data.leadId}`);
      return { ok: true as const, data: event };
    });
  } catch (err) {
    console.error('Failed to log interaction:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

export async function changeLeadStage(payload: z.infer<typeof ChangeStageSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = ChangeStageSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  const { leadId, toStage, lostReason, note } = parsed.data;

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      const [lead] = await tx.select().from(leads).where(eq(leads.id, leadId));
      if (!lead) return { ok: false as const, code: 'NOT_FOUND' };

      const eventNote = note || (toStage === 'lost' ? `Lost Reason: ${lostReason?.replace('_', ' ')}` : undefined);

      await tx.insert(leadEvents).values({
        leadId,
        type: 'stage_change',
        fromStage: lead.stage,
        toStage,
        actorId: context.userId,
        note: eventNote,
      });

      await tx.update(leads).set({
        stage: toStage,
        lostReason: toStage === 'lost' ? lostReason : null,
        updatedAt: new Date(),
      }).where(eq(leads.id, leadId));

      await writeAudit({ action: 'lead.stage_change', entityType: 'lead', entityId: leadId, actorId: context.userId, before: { stage: lead.stage }, after: { stage: toStage, lostReason }}, tx);

      revalidatePath(`/leads/${leadId}`);
      return { ok: true as const };
    });
  } catch (err) {
    console.error('Failed to change lead stage:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

// --- Triage Actions ---

export async function triageAssign(payload: z.infer<typeof TriageAssignSchema>) {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = TriageAssignSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, code: 'VALIDATION_FAILED' };

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      await tx.update(leads)
        .set({ triageStatus: 'assigned', assignedAgentId: parsed.data.agentId, updatedAt: new Date() })
        .where(eq(leads.id, parsed.data.leadId));

      await tx.insert(leadEvents).values({
        leadId: parsed.data.leadId,
        type: 'assignment',
        assignedToId: parsed.data.agentId,
        actorId: context.userId,
      });

      await writeAudit({ action: 'triage.assign', entityType: 'lead', entityId: parsed.data.leadId, actorId: context.userId, after: { assignedTo: parsed.data.agentId } }, tx);
      revalidatePath('/leads/inbox');
      return { ok: true as const };
    });
  } catch (err) {
    console.error('Failed to assign lead:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

export async function triageMerge(payload: z.infer<typeof TriageMergeSchema>) {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = TriageMergeSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, code: 'VALIDATION_FAILED' };

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      await tx.update(leads)
        .set({ triageStatus: 'merged', mergedIntoLeadId: parsed.data.targetLeadId, updatedAt: new Date() })
        .where(eq(leads.id, parsed.data.leadId));

      await tx.insert(leadEvents).values({
        leadId: parsed.data.targetLeadId,
        type: 'merge',
        note: 'Merged duplicate enquiry into this lead',
        actorId: context.userId,
      });

      await writeAudit({ action: 'triage.merge', entityType: 'lead', entityId: parsed.data.leadId, actorId: context.userId, after: { mergedInto: parsed.data.targetLeadId } }, tx);
      revalidatePath('/leads/inbox');
      return { ok: true as const };
    });
  } catch (err) {
    console.error('Failed to merge lead:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

export async function triageSpam(payload: z.infer<typeof TriageSpamSchema>) {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = TriageSpamSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, code: 'VALIDATION_FAILED' };

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      await tx.update(leads)
        .set({ triageStatus: 'spam', updatedAt: new Date() })
        .where(eq(leads.id, parsed.data.leadId));

      await writeAudit({ action: 'triage.spam', entityType: 'lead', entityId: parsed.data.leadId, actorId: context.userId, after: null }, tx);
      revalidatePath('/leads/inbox');
      return { ok: true as const };
    });
  } catch (err) {
    console.error('Failed to mark lead as spam:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

// --- Negotiation History & Floor Price ---

export async function logNegotiation(payload: z.infer<typeof LogNegotiationSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = LogNegotiationSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      const [event] = await tx.insert(leadEvents).values({
        leadId: parsed.data.leadId,
        type: 'negotiation',
        negotiationKind: parsed.data.negotiationKind,
        amountPaise: BigInt(parsed.data.amountPaise),
        unitId: parsed.data.unitId,
        note: parsed.data.note,
        actorId: context.userId,
      }).returning({ id: leadEvents.id });

      await writeAudit({
        action: 'lead.negotiation', 
        entityType: 'lead', 
        entityId: parsed.data.leadId, 
        actorId: context.userId, 
        after: {
          negotiationKind: parsed.data.negotiationKind,
          amountPaise: parsed.data.amountPaise
        }
      }, tx);

      revalidatePath(`/leads/${parsed.data.leadId}`);
      return { ok: true as const, data: event };
    });
  } catch (err) {
    console.error('Failed to log negotiation:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

// Owner-only audited read of the full privileged (negotiation) history.
// Same FR-C21 pattern as getLeadFloorPrice: the audit row commits in the
// same transaction as the read — no unaudited path to this data.
export async function getLeadPrivilegedEntries(leadId: string) {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') return { ok: false as const, code: 'UNAUTHORIZED' };

  const { units, users } = await import('@estate/db');
  const { desc } = await import('drizzle-orm');

  return await authedQuery(context, async (tx: CoreTransaction) => {
    await writeAudit({
      action: 'lead.read_privileged_entries',
      entityType: 'lead',
      entityId: leadId,
      actorId: context.userId,
      after: null
    }, tx);

    const rows = await tx.select({
        id: leadEvents.id,
        negotiationKind: leadEvents.negotiationKind,
        amountPaise: leadEvents.amountPaise,
        note: leadEvents.note,
        createdAt: leadEvents.createdAt,
        unitNumber: units.unitNumber,
        actorName: users.name,
      })
      .from(leadEvents)
      .leftJoin(units, eq(leadEvents.unitId, units.id))
      .leftJoin(users, eq(leadEvents.actorId, users.id))
      .where(and(
        eq(leadEvents.leadId, leadId),
        eq(leadEvents.type, 'negotiation')
      ))
      .orderBy(desc(leadEvents.createdAt));

    return {
      ok: true as const,
      data: rows.map(r => ({
        id: r.id,
        negotiationKind: r.negotiationKind,
        amountPaise: r.amountPaise ? r.amountPaise.toString() : null,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        unitNumber: r.unitNumber,
        actorName: r.actorName,
      })),
    };
  });
}

// Owner-only DAL boundary for floor price checking
export async function getLeadFloorPrice(leadId: string) {
  const context = await getRoleContext();
  // Absolute enforcement of NFR-S3 owner-only view
  if (!context || context.role !== 'owner') return { ok: false as const, code: 'UNAUTHORIZED' };
  
  // Determine floor price as the lowest concession logged on this lead
  return await authedQuery(context, async (tx: CoreTransaction) => {
    // Audited privileged read per FR-C21 — same transaction as the read
    await writeAudit({
      action: 'lead.read_floor_price',
      entityType: 'lead',
      entityId: leadId,
      actorId: context.userId,
      after: null
    }, tx);

    const events = await tx.select()
      .from(leadEvents)
      .where(and(
         eq(leadEvents.leadId, leadId),
         eq(leadEvents.type, 'negotiation'),
         eq(leadEvents.negotiationKind, 'concession')
      ))
      .orderBy(asc(leadEvents.amountPaise))
      .limit(1);
      
    return { 
      ok: true as const, 
      data: events[0]?.amountPaise ? Number(events[0].amountPaise) : null 
    };
  });
}

import { BulkReassignSchema, ReassignSelectedLeadsSchema } from '@/lib/validation';
import { inArray } from 'drizzle-orm';

/**
 * Reassigns an explicit selection of leads (checkbox flow), as opposed to
 * bulkReassignLeads which moves EVERYTHING from one agent to another.
 */
export async function reassignSelectedLeads(data: z.infer<typeof ReassignSelectedLeadsSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  if (context.role !== 'owner') {
    return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Owner access required' };
  }

  const parsed = ReassignSelectedLeadsSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  const { leadIds, toAgentId } = parsed.data;

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      // Only live leads from the selection actually move
      const targets = await tx.query.leads.findMany({
        where: (l, { and: andOp, isNull: isNullOp, inArray: inArrayOp }) =>
          andOp(inArrayOp(l.id, leadIds), isNullOp(l.archivedAt)),
        columns: { id: true, assignedAgentId: true },
      });

      if (targets.length === 0) {
        return { ok: true as const, count: 0 };
      }

      const targetIds = targets.map(t => t.id);
      await tx.update(leads)
        .set({ assignedAgentId: toAgentId, updatedAt: new Date() })
        .where(inArray(leads.id, targetIds));

      await tx.insert(leadEvents).values(targetIds.map(leadId => ({
        leadId,
        type: 'assignment' as const,
        assignedToId: toAgentId,
        actorId: context.userId,
      })));

      await writeAudit({
        actorId: context.userId,
        action: 'leads.reassign_selected',
        entityType: 'user',
        entityId: toAgentId,
        before: { previousAssignments: targets.map(t => ({ leadId: t.id, agentId: t.assignedAgentId })) },
        after: { assignedAgentId: toAgentId, leadsAffected: targetIds.length },
      }, tx);

      revalidatePath('/leads');
      return { ok: true as const, count: targetIds.length };
    });
  } catch (err: any) {
    console.error('Selected reassignment failed:', err);
    return { ok: false as const, code: 'PERSIST_FAILED', message: err.message || 'Reassignment failed' };
  }
}

export async function bulkReassignLeads(data: z.infer<typeof BulkReassignSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  if (context.role !== 'owner') {
    return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Owner access required' };
  }

  const parsed = BulkReassignSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  const { fromAgentId, toAgentId } = parsed.data;

  try {
    return await authedQuery(context, async (tx: CoreTransaction) => {
      const leadsToReassign = await tx.query.leads.findMany({
        where: (l, { eq, and, isNull }) => and(
          eq(l.assignedAgentId, fromAgentId),
          isNull(l.archivedAt)
        ),
        columns: { id: true }
      });

      if (leadsToReassign.length === 0) {
        return { ok: true as const, count: 0 };
      }

      await tx.update(leads)
        .set({ assignedAgentId: toAgentId, updatedAt: new Date() })
        .where(and(eq(leads.assignedAgentId, fromAgentId), isNull(leads.archivedAt)));

      const eventsToInsert = leadsToReassign.map(l => ({
        leadId: l.id,
        type: 'assignment' as const,
        assignedToId: toAgentId,
        actorId: context.userId
      }));
      
      await tx.insert(leadEvents).values(eventsToInsert);

      await writeAudit({
        actorId: context.userId,
        action: 'leads.bulk_reassign',
        entityType: 'user', 
        entityId: fromAgentId,
        before: { assignedAgentId: fromAgentId },
        after: { assignedAgentId: toAgentId, leadsAffected: leadsToReassign.length }
      }, tx);

      revalidatePath('/leads');
      return { ok: true as const, count: leadsToReassign.length };
    });
  } catch (err: any) {
    console.error('Bulk reassignment failed:', err);
    return { ok: false as const, code: 'PERSIST_FAILED', message: err.message || 'Bulk reassignment failed' };
  }
}

