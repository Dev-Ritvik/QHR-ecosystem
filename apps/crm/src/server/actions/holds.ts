// apps/crm/src/server/actions/holds.ts
"use server";

import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { authedQuery } from "@/server/db";
import { getRoleContext } from "@/server/session";
import { writeAudit } from "@/server/audit";
import { HoldSchema, ExtendHoldSchema } from "@/lib/validation";
import { isEffectivelyExpired } from "@estate/domain/src/holds/expiry";
import { coreSchema as schema } from "@estate/db";
import { transitionUnitStatusAction } from "@/server/actions/units";

// Minimal client lookup/create flow for deals & holds
export async function findOrCreateClient(context: any, tx: any, name: string, phone: string) {
  const [existing] = await tx.select().from(schema.clients).where(
    and(eq(schema.clients.phone, phone), isNull(schema.clients.archivedAt))
  );
  if (existing) return existing;

  const [newClient] = await tx.insert(schema.clients).values({
    name,
    phone,
    createdById: context.userId,
  }).returning();
  
  await writeAudit({
    action: "client.create",
    entityType: "client",
    entityId: newClient.id,
    after: newClient,
  }, tx);

  return newClient;
}

export async function createHold(unitId: string, data: z.infer<typeof HoldSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: "UNAUTHENTICATED", message: "Unauthorized" };

  const parsed = HoldSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: "VALIDATION_FAILED", message: "Invalid fields", issues: parsed.error.flatten().fieldErrors };
  }

  try {
    const result = await authedQuery(context, async (tx: any) => {
      const [unit] = await tx.select().from(schema.units).where(eq(schema.units.id, unitId));
      
      if (!unit) throw new Error("NOT_FOUND");
      if (unit.status !== "available") throw new Error("UNIT_NOT_AVAILABLE");

      const maxDuration = context.role === 'owner' ? 30 : 14;
      if (parsed.data.durationDays > maxDuration) {
        throw new Error("DURATION_EXCEEDS_MAX");
      }

      const client = await findOrCreateClient(context, tx, parsed.data.clientName, parsed.data.clientPhone);

      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + parsed.data.durationDays * 24 * 60 * 60 * 1000);

      const [hold] = await tx.insert(schema.holds).values({
        unitId,
        clientId: client.id,
        status: 'active',
        startsAt,
        expiresAt,
        reason: parsed.data.reason,
        createdById: context.userId,
      }).returning();
      
      return { unit, hold, client };
    });

    // Call state machine via existing service outside the transaction
    const transitionRes = await transitionUnitStatusAction(unitId, 'held', { holdId: result.hold.id, clientId: result.client.id, reason: parsed.data.reason });
    
    if (!transitionRes.ok) {
      // Revert hold entry if the state machine rejects
      await authedQuery(context, async (tx: any) => {
        await tx.update(schema.holds).set({ status: 'released' }).where(eq(schema.holds.id, result.hold.id));
      });
      return { ok: false as const, code: "PERSIST_FAILED", message: "State machine rejected transition" };
    }

    revalidatePath(`/projects/${result.unit.projectId}/units`);
    revalidatePath(`/projects/${result.unit.projectId}/units/${unitId}`);
    return { ok: true as const, hold: result.hold };
  } catch (err: any) {
    console.error("Create hold error:", err);
    if (err.message === "NOT_FOUND") return { ok: false as const, code: "NOT_FOUND", message: "Unit not found" };
    if (err.message === "UNIT_NOT_AVAILABLE") return { ok: false as const, code: "PERSIST_FAILED", message: "Unit is not available to hold" };
    if (err.message === "DURATION_EXCEEDS_MAX") return { ok: false as const, code: "PERSIST_FAILED", message: "Duration exceeds allowed maximum for your role. Contact owner for extended holds." };
    return { ok: false as const, code: "PERSIST_FAILED", message: "Failed to create hold" };
  }
}

export async function extendHold(holdId: string, data: z.infer<typeof ExtendHoldSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: "UNAUTHENTICATED", message: "Unauthorized" };

  const parsed = ExtendHoldSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: "VALIDATION_FAILED", message: "Invalid fields", issues: parsed.error.flatten().fieldErrors };
  }

  try {
    const result = await authedQuery(context, async (tx: any) => {
      const [hold] = await tx.select().from(schema.holds).where(eq(schema.holds.id, holdId));
      
      if (!hold || hold.status !== 'active') throw new Error("NOT_FOUND");
      
      if (isEffectivelyExpired(hold, new Date())) {
          throw new Error("ALREADY_EXPIRED");
      }

      const totalDurationDays = (hold.expiresAt.getTime() - hold.startsAt.getTime() + parsed.data.additionalDays * 24 * 60 * 60 * 1000) / (1000 * 60 * 60 * 24);
      
      if (totalDurationDays > 14 && context.role !== 'owner') {
         throw new Error("DURATION_EXCEEDS_MAX");
      }

      const newExpiresAt = new Date(hold.expiresAt.getTime() + parsed.data.additionalDays * 24 * 60 * 60 * 1000);
      
      const [updatedHold] = await tx.update(schema.holds)
        .set({
          expiresAt: newExpiresAt,
          extendedById: context.userId,
          extendedAt: new Date(),
        })
        .where(eq(schema.holds.id, holdId))
        .returning();

      const [unit] = await tx.select().from(schema.units).where(eq(schema.units.id, hold.unitId));

      await writeAudit({
        action: "hold.extend",
        entityType: "hold",
        entityId: holdId,
        before: { expiresAt: hold.expiresAt },
        after: { expiresAt: updatedHold.expiresAt },
      }, tx);

      return { hold: updatedHold, oldHold: hold, unit };
    });

    revalidatePath(`/projects/${result.unit.projectId}/units`);
    revalidatePath(`/projects/${result.unit.projectId}/units/${result.hold.unitId}`);
    return { ok: true as const, hold: result.hold };
  } catch (err: any) {
     console.error("Extend hold error:", err);
     if (err.message === "NOT_FOUND") return { ok: false as const, code: "NOT_FOUND", message: "Active hold not found" };
     if (err.message === "ALREADY_EXPIRED") return { ok: false as const, code: "PERSIST_FAILED", message: "Hold is already effectively expired. It cannot be extended." };
     if (err.message === "DURATION_EXCEEDS_MAX") return { ok: false as const, code: "PERSIST_FAILED", message: "Total hold duration exceeding 14 days requires owner approval." };
     return { ok: false as const, code: "PERSIST_FAILED", message: "Failed to extend hold" };
  }
}

export async function releaseHold(holdId: string, reason?: string) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: "UNAUTHENTICATED", message: "Unauthorized" };

  try {
    const result = await authedQuery(context, async (tx: any) => {
      const [hold] = await tx.select().from(schema.holds).where(eq(schema.holds.id, holdId));
      
      if (!hold || hold.status !== 'active') throw new Error("NOT_FOUND");

      const [updatedHold] = await tx.update(schema.holds)
        .set({ 
          status: 'released', 
          releasedAt: new Date(), 
          reason: reason || hold.reason 
        })
        .where(eq(schema.holds.id, holdId))
        .returning();

      const [unit] = await tx.select().from(schema.units).where(eq(schema.units.id, hold.unitId));
      
      return { hold: updatedHold, unit };
    });

    // Release transition back to available
    await transitionUnitStatusAction(result.hold.unitId, 'available', { holdId: result.hold.id, reason: reason || 'Manual release' });

    revalidatePath(`/projects/${result.unit.projectId}/units`);
    revalidatePath(`/projects/${result.unit.projectId}/units/${result.hold.unitId}`);
    return { ok: true as const, hold: result.hold };
  } catch (err: any) {
    console.error("Release hold error:", err);
    if (err.message === "NOT_FOUND") return { ok: false as const, code: "NOT_FOUND", message: "Active hold not found" };
    return { ok: false as const, code: "PERSIST_FAILED", message: "Failed to release hold" };
  }
}

export async function getActiveHold(unitId: string) {
  const context = await getRoleContext();
  if (!context) return null;

  try {
    const result = await authedQuery(context, async (tx: any) => {
      const [hold] = await tx.select().from(schema.holds).where(
        and(eq(schema.holds.unitId, unitId), eq(schema.holds.status, 'active'))
      );
      return hold;
    });

    if (!result) return null;

    // Read-path runtime expiry check (belt & braces with cron)
    if (isEffectivelyExpired(result, new Date())) {
      return null;
    }
    return result;
  } catch (err) {
    return null;
  }
}
