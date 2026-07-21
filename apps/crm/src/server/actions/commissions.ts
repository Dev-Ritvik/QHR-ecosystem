'use server';

import { z } from 'zod';
import { coreSchema as core } from '@estate/db';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { writeAudit } from '@/server/audit';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { SaveCommissionRuleSchema, UpdateCommissionEntrySchema } from '@/lib/validation';
import { computeCommissionTranches, TrancheSplit } from '@estate/domain/commissions/engine';

export async function saveCommissionRule(data: z.infer<typeof SaveCommissionRuleSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Not authenticated' };

  if (context.role !== 'owner') {
    return { ok: false as const, code: 'FORBIDDEN', message: 'Owner access required' };
  }

  const parsed = SaveCommissionRuleSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  const { projectId, rateBps, trancheSplit } = parsed.data;

  // Archive existing active rule for this scope, then insert new
  const scopeWhere = projectId
    ? and(eq(core.commissionRules.projectId, projectId), isNull(core.commissionRules.archivedAt))
    : and(isNull(core.commissionRules.projectId), isNull(core.commissionRules.archivedAt));

  await authedQuery(context, async (tx: any) => {
    await tx.update(core.commissionRules)
      .set({ archivedAt: new Date() })
      .where(scopeWhere);

    const [row] = await tx.insert(core.commissionRules).values({
      projectId: projectId || null,
      rateBps,
      trancheSplit,
      createdById: context.userId,
    }).returning();

    await writeAudit({
      actorId: context.userId,
      action: 'commission_rule.update',
      entityType: projectId ? 'project' : 'office',
      entityId: projectId || 'global',
      before: null,
      after: { ruleId: row.id, rateBps, trancheSplit }
    }, tx);

    return row;
  });

  revalidatePath(projectId ? `/projects/${projectId}/commissions` : `/settings/commissions`);
  return { ok: true as const };
}

export async function generateCommissionEntries(bookingId: string) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Not authenticated' };

  const result = await authedQuery(context, async (tx: any) => {
    const booking = await tx.query.bookings.findFirst({
      where: eq(core.bookings.id, bookingId),
      with: { unit: true, lead: true }
    });

    if (!booking || !booking.considerationPaise) {
      return { ok: false as const, code: 'VALIDATION_FAILED', message: 'Booking requires consideration amount to compute commission' };
    }

    // Find applicable rule: project-specific, falling back to office default
    let rule = await tx.query.commissionRules.findFirst({
      where: and(eq(core.commissionRules.projectId, booking.unit.projectId), isNull(core.commissionRules.archivedAt))
    });

    if (!rule) {
      rule = await tx.query.commissionRules.findFirst({
        where: and(isNull(core.commissionRules.projectId), isNull(core.commissionRules.archivedAt))
      });
    }

    if (!rule) {
      return { ok: false as const, code: 'NOT_FOUND', message: 'No commission rule found (neither project nor default)' };
    }

    const amounts = computeCommissionTranches(
      booking.considerationPaise,
      rule.rateBps,
      rule.trancheSplit as TrancheSplit
    );

    // Determine payee (FR-C18)
    let payeeType: 'agent' | 'channel_partner' | 'referrer' = 'agent';
    let payeeUserId: string | null = booking.agentId;
    let payeeName: string | null = null;

    if (booking.lead?.source === 'channel_partner') {
      payeeType = 'channel_partner';
      payeeUserId = null;
      payeeName = booking.lead.sourceDetail || 'Unknown Channel Partner';
    } else if (booking.lead?.source === 'referral') {
      payeeType = 'referrer';
      payeeUserId = null;
      payeeName = booking.lead.sourceDetail || 'Unknown Referrer';
    }

    const existing = await tx.query.commissionEntries.findMany({
      where: and(eq(core.commissionEntries.bookingId, bookingId), isNull(core.commissionEntries.voidedAt))
    });
    const existingTranches = new Set(existing.map((e: { tranche: string }) => e.tranche));

    const toInsert = [];
    for (const tranche of ['token', 'agreement', 'registration'] as const) {
      if (!existingTranches.has(tranche) && amounts[tranche] > 0n) {
        toInsert.push({
          bookingId: booking.id,
          ruleId: rule.id,
          payeeType,
          payeeUserId,
          payeeName,
          tranche,
          basisAmountPaise: booking.considerationPaise,
          computedAmountPaise: amounts[tranche],
          status: 'accrued' as const
        });
      }
    }

    if (toInsert.length > 0) {
      await tx.insert(core.commissionEntries).values(toInsert);

      await writeAudit({
        actorId: context.userId,
        action: 'commission_entry.generate',
        entityType: 'booking',
        entityId: bookingId,
        before: null,
        after: { entriesGenerated: toInsert.length }
      }, tx);
    }

    return { ok: true as const, count: toInsert.length, bookingId };
  });

  revalidatePath(`/bookings/${bookingId}`);
  return result;
}

export async function updateCommissionEntryStatus(data: z.infer<typeof UpdateCommissionEntrySchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Not authenticated' };

  if (context.role !== 'owner') {
    return { ok: false as const, code: 'FORBIDDEN', message: 'Owner access required to modify commission status' };
  }

  const parsed = UpdateCommissionEntrySchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  const { entryId, status, paidOn, paymentReference } = parsed.data;

  const entry = await authedQuery(context, async (tx: any) => {
    return await tx.query.commissionEntries.findFirst({
      where: eq(core.commissionEntries.id, entryId)
    });
  });

  if (!entry) return { ok: false as const, code: 'NOT_FOUND', message: 'Entry not found' };

  await authedQuery(context, async (tx: any) => {
    await tx.update(core.commissionEntries).set({
      status,
      paidOn: paidOn ?? null,
      paymentReference: paymentReference || null,
      voidedAt: status === 'voided' ? new Date() : null,
      updatedAt: new Date()
    }).where(eq(core.commissionEntries.id, entryId));

    await writeAudit({
      actorId: context.userId,
      action: 'commission_entry.status_update',
      entityType: 'commission_entry',
      entityId: entryId,
      before: { status: entry.status },
      after: { status, paidOn, paymentReference }
    }, tx);
  });

  revalidatePath(`/bookings/${entry.bookingId}`);
  return { ok: true as const };
}

import { OverrideCommissionSchema } from '@/lib/validation';

export async function overrideCommissionEntry(data: z.infer<typeof OverrideCommissionSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Not authenticated' };

  // NFR-S3: Owner only access to commission overrides
  if (context.role !== 'owner') {
    return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Owner access required' };
  }

  const parsed = OverrideCommissionSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  const { entryId, overriddenAmountPaise, reason } = parsed.data;

  const result = await authedQuery(context, async (tx: any) => {
    const entry = await tx.query.commissionEntries.findFirst({
      where: eq(core.commissionEntries.id, entryId)
    });

    if (!entry) return { ok: false as const, code: 'NOT_FOUND', message: 'Commission entry not found' };

    // Determine previous amount for audit and DB constraint
    const existingOverrides = await tx.query.commissionOverrides.findMany({
      where: eq(core.commissionOverrides.entryId, entryId),
      orderBy: (co: any, { desc }: any) => [desc(co.createdAt)]
    });

    const previousAmountPaise = existingOverrides.length > 0 
      ? existingOverrides[0].overriddenAmountPaise 
      : entry.computedAmountPaise;

    const finalOverriddenAmount = BigInt(overriddenAmountPaise);

    const [newOverride] = await tx.insert(core.commissionOverrides).values({
      entryId,
      previousAmountPaise,
      overriddenAmountPaise: finalOverriddenAmount,
      reason,
      actorId: context.userId
    }).returning();

    await writeAudit({
      actorId: context.userId,
      action: 'commission_override.append',
      entityType: 'commission_entry',
      entityId: entryId,
      before: { previousAmountPaise: previousAmountPaise.toString() },
      after: { overriddenAmountPaise: finalOverriddenAmount.toString(), reason, overrideId: newOverride.id }
    }, tx);

    return { ok: true as const, bookingId: entry.bookingId, previousAmountPaise, finalOverriddenAmount, newOverrideId: newOverride.id };
  });

  if (!result.ok) return result;

  revalidatePath(`/bookings/${result.bookingId}`);
  return { ok: true as const };
}
