// apps/crm/src/server/actions/units.ts
"use server";

import { z } from "zod";
import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { authedQuery } from "@/server/db";
import { getRoleContext } from "@/server/session";
import { writeAudit } from "@/server/audit";
import {
  UnitSchema,
  UnitLandDetailsSchema,
  UnitCommercialDetailsSchema,
  UnitLuxuryDetailsSchema,
  BulkCreateUnitsSchema,
} from "@/lib/validation";
import { computePrice } from "@estate/domain/src/pricing/compute";
import { transition, TransitionPayload } from "@estate/domain/src/unit-status/machine";
import { coreSchema as schema } from "@estate/db";

async function saveUnit(projectId: string, unitId: string | null, data: any) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: "UNAUTHENTICATED", message: "Unauthorized" };

  const parsedCore = UnitSchema.safeParse(data);
  if (!parsedCore.success) {
    return {
      ok: false as const,
      code: "VALIDATION_FAILED",
      message: "Invalid core fields",
      issues: parsedCore.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await authedQuery(context, async (tx: any) => {
      // 1. Fetch project to know asset class
      const [project] = await tx.select().from(schema.projects).where(eq(schema.projects.id, projectId));
      if (!project) throw new Error("PROJECT_NOT_FOUND");

      // Unit numbers are unique per project among live units
      // (units_project_number_live_uq); check up front so a duplicate gives a
      // clear message instead of a raw constraint failure.
      const [duplicate] = await tx.select({ id: schema.units.id }).from(schema.units)
        .where(and(
          eq(schema.units.projectId, projectId),
          eq(schema.units.unitNumber, parsedCore.data.unitNumber),
          isNull(schema.units.archivedAt),
        ));
      if (duplicate && duplicate.id !== unitId) {
        throw { isDuplicateNumber: true };
      }

      // Validate details based on asset class, with the schema matching the
      // detail table for that class (parsed output is inserted verbatim below)
      let landDetails: Record<string, unknown> | null = null;
      let commercialDetails: Record<string, unknown> | null = null;
      let luxuryDetails: Record<string, unknown> | null = null;

      if (project.assetClass === 'land') {
        const parsedLand = UnitLandDetailsSchema.safeParse(data);
        if (!parsedLand.success) throw { isZod: true, errors: parsedLand.error.flatten().fieldErrors };
        landDetails = parsedLand.data;
      } else if (project.assetClass === 'commercial') {
        const parsedComm = UnitCommercialDetailsSchema.safeParse(data);
        if (!parsedComm.success) throw { isZod: true, errors: parsedComm.error.flatten().fieldErrors };
        commercialDetails = parsedComm.data;
      } else if (project.assetClass === 'luxury_residential') {
        const parsedLux = UnitLuxuryDetailsSchema.safeParse(data);
        if (!parsedLux.success) throw { isZod: true, errors: parsedLux.error.flatten().fieldErrors };
        luxuryDetails = parsedLux.data;
      }

      // 2. Fetch active price version for computation
      const [activeVersion] = await tx.select()
        .from(schema.priceVersions)
        .where(
          and(
            eq(schema.priceVersions.projectId, projectId),
            isNull(schema.priceVersions.supersededAt)
          )
        )
        .orderBy(desc(schema.priceVersions.versionNo))
        .limit(1);

      let computedPricePaise = null;
      let priceVersionId = null;

      if (activeVersion) {
        priceVersionId = activeVersion.id;
        try {
          const rawComputed = computePrice(
            BigInt(activeVersion.baseRatePaise),
            activeVersion.rateBasis as any,
            activeVersion.premiums as any,
            {
              areaSqYd: parsedCore.data.areaSqYd || undefined,
              areaSqFt: parsedCore.data.areaSqFt || undefined,
              isCorner: parsedCore.data.isCorner,
              facing: parsedCore.data.facing || undefined,
              roadWidthM: parsedCore.data.roadWidthM || undefined
            }
          );
          computedPricePaise = rawComputed.computedPricePaise;
        } catch (e) {
          console.error("Price computation skipped or failed", e);
        }
      }

      const unitData = {
        projectId,
        unitNumber: parsedCore.data.unitNumber,
        facing: parsedCore.data.facing,
        isCorner: parsedCore.data.isCorner,
        roadWidthM: parsedCore.data.roadWidthM,
        areaSqYd: parsedCore.data.areaSqYd,
        areaSqFt: parsedCore.data.areaSqFt,
        dimensionsLabel: parsedCore.data.dimensionsLabel,
        priceVersionId,
        computedPricePaise,
        overridePricePaise: parsedCore.data.overridePricePaise ? BigInt(parsedCore.data.overridePricePaise) : null,
        overrideReason: parsedCore.data.overrideReason,
        updatedAt: new Date(),
      };

      let finalUnit;
      let isUpdate = false;
      let beforeUnit = null;

      if (unitId) {
        // Update Base Unit
        isUpdate = true;
        [beforeUnit] = await tx.select().from(schema.units).where(eq(schema.units.id, unitId));
        [finalUnit] = await tx.update(schema.units)
          .set(unitData)
          .where(eq(schema.units.id, unitId))
          .returning();
      } else {
        // Create Base Unit
        [finalUnit] = await tx.insert(schema.units).values(unitData).returning();
      }

      // 3. Upsert Details based on Asset Class (schemas always emit their
      // defaulted enum fields, so the update SET is never empty)
      if (landDetails) {
        await tx.insert(schema.unitLandDetails)
          .values({ unitId: finalUnit.id, ...landDetails })
          .onConflictDoUpdate({ target: schema.unitLandDetails.unitId, set: landDetails });

      } else if (commercialDetails) {
        await tx.insert(schema.unitCommercialDetails)
          .values({ unitId: finalUnit.id, ...commercialDetails })
          .onConflictDoUpdate({ target: schema.unitCommercialDetails.unitId, set: commercialDetails });

      } else if (luxuryDetails) {
        await tx.insert(schema.unitLuxuryDetails)
          .values({ unitId: finalUnit.id, ...luxuryDetails })
          .onConflictDoUpdate({ target: schema.unitLuxuryDetails.unitId, set: luxuryDetails });
      }

      await writeAudit({
        action: isUpdate ? "unit.update" : "unit.create",
        entityType: "unit",
        entityId: finalUnit.id,
        before: beforeUnit,
        after: finalUnit,
      }, tx);

      return { finalUnit, isUpdate, beforeUnit };
    });

    revalidatePath(`/projects/${projectId}/units`);
    revalidatePath(`/projects/${projectId}/units/${result.finalUnit.id}`);
    
    return { ok: true as const, unit: result.finalUnit };
  } catch (err: any) {
    console.error("Save unit error:", err);
    if (err.isZod) return { ok: false as const, code: "VALIDATION_FAILED", message: "Invalid specific details", issues: err.errors };
    if (err.isDuplicateNumber) return { ok: false as const, code: "VALIDATION_FAILED", message: `Unit number "${data?.unitNumber}" already exists in this project` };
    if (err.message === "PROJECT_NOT_FOUND") return { ok: false as const, code: "NOT_FOUND", message: "Project not found" };
    // Unique violation backstop (concurrent create/rename racing the pre-check).
    // Drizzle wraps the PostgresError, so the code sits on err.cause.
    if (err.code === "23505" || err.cause?.code === "23505") {
      return { ok: false as const, code: "VALIDATION_FAILED", message: "Unit number already exists in this project" };
    }

    return { ok: false as const, code: "PERSIST_FAILED", message: "Failed to save unit" };
  }
}

export async function createUnit(projectId: string, data: any) {
  return saveUnit(projectId, null, data);
}

/**
 * Creates `count` units in one transaction with sequential numbering
 * (`${prefix}${startNumber}` …). Detail rows are created per asset class with
 * schema defaults; for land projects a shared survey number is applied to
 * every unit (editable per unit afterwards). Prices are computed from the
 * active price version exactly like single-unit creation.
 */
export async function bulkCreateUnits(projectId: string, data: any) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: "UNAUTHENTICATED", message: "Unauthorized" };

  const parsed = BulkCreateUnitsSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: "VALIDATION_FAILED", message: "Invalid fields", issues: parsed.error.flatten().fieldErrors };
  }

  const { prefix, startNumber, count, facing, areaSqYd, areaSqFt, roadWidthM, surveyNumber } = parsed.data;
  const unitNumbers = Array.from({ length: count }, (_, i) => `${prefix}${startNumber + i}`);

  try {
    const result = await authedQuery(context, async (tx: any) => {
      const [project] = await tx.select().from(schema.projects).where(eq(schema.projects.id, projectId));
      if (!project) throw new Error("PROJECT_NOT_FOUND");

      if (project.assetClass === 'land' && !surveyNumber?.trim()) {
        return { ok: false as const, code: "VALIDATION_FAILED" as const, message: "Survey number is required for land projects (applied to all generated units)." };
      }

      // Reject the whole batch when any number is already taken (live units)
      const clashes = await tx.select({ unitNumber: schema.units.unitNumber }).from(schema.units)
        .where(and(
          eq(schema.units.projectId, projectId),
          inArray(schema.units.unitNumber, unitNumbers),
          isNull(schema.units.archivedAt),
        ));
      if (clashes.length > 0) {
        return {
          ok: false as const,
          code: "VALIDATION_FAILED" as const,
          message: `These unit numbers already exist: ${clashes.map((c: any) => c.unitNumber).join(', ')}. Adjust the prefix/start number.`,
        };
      }

      const [activeVersion] = await tx.select()
        .from(schema.priceVersions)
        .where(and(eq(schema.priceVersions.projectId, projectId), isNull(schema.priceVersions.supersededAt)))
        .orderBy(desc(schema.priceVersions.versionNo))
        .limit(1);

      let computedPricePaise: bigint | null = null;
      if (activeVersion) {
        try {
          computedPricePaise = computePrice(
            BigInt(activeVersion.baseRatePaise),
            activeVersion.rateBasis as any,
            activeVersion.premiums as any,
            { areaSqYd, areaSqFt, isCorner: false, facing: facing || undefined, roadWidthM }
          ).computedPricePaise;
        } catch (e) {
          console.error("Bulk price computation skipped", e);
        }
      }

      const inserted = await tx.insert(schema.units).values(unitNumbers.map(unitNumber => ({
        projectId,
        unitNumber,
        facing,
        isCorner: false,
        roadWidthM,
        areaSqYd,
        areaSqFt,
        priceVersionId: activeVersion?.id ?? null,
        computedPricePaise,
      }))).returning({ id: schema.units.id, unitNumber: schema.units.unitNumber });

      if (project.assetClass === 'land') {
        await tx.insert(schema.unitLandDetails).values(inserted.map((u: any) => ({
          unitId: u.id,
          surveyNumber: surveyNumber!.trim(),
        })));
      } else if (project.assetClass === 'commercial') {
        await tx.insert(schema.unitCommercialDetails).values(inserted.map((u: any) => ({ unitId: u.id })));
      } else if (project.assetClass === 'luxury_residential') {
        await tx.insert(schema.unitLuxuryDetails).values(inserted.map((u: any) => ({ unitId: u.id })));
      }

      await writeAudit({
        action: "units.bulk_create",
        entityType: "project",
        entityId: projectId,
        before: null,
        after: { count: inserted.length, unitNumbers: inserted.map((u: any) => u.unitNumber) },
      }, tx);

      return { ok: true as const, count: inserted.length };
    });

    if (result.ok) {
      revalidatePath(`/projects/${projectId}/units`);
    }
    return result;
  } catch (err: any) {
    console.error("Bulk unit creation error:", err);
    if (err.message === "PROJECT_NOT_FOUND") return { ok: false as const, code: "NOT_FOUND", message: "Project not found" };
    if (err.code === "23505" || err.cause?.code === "23505") {
      return { ok: false as const, code: "VALIDATION_FAILED", message: "One of the generated unit numbers already exists in this project" };
    }
    return { ok: false as const, code: "PERSIST_FAILED", message: "Failed to create units" };
  }
}

export async function updateUnit(projectId: string, unitId: string, data: any) {
  return saveUnit(projectId, unitId, data);
}

/**
 * Deletes a unit. Business records referencing the unit (holds, bookings,
 * documents, status history, lead activity, visit links, geometry) have
 * NO ACTION foreign keys — the database blocks the delete — so we check
 * first and return a friendly explanation instead of a constraint error.
 * Unit-owned rows (asset-class details, media) cascade automatically.
 */
export async function deleteUnit(projectId: string, unitId: string) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: "UNAUTHENTICATED", message: "Unauthorized" };

  try {
    const result = await authedQuery(context, async (tx: any) => {
      const [unit] = await tx.select().from(schema.units)
        .where(and(eq(schema.units.id, unitId), eq(schema.units.projectId, projectId)));
      if (!unit) return { ok: false as const, code: "NOT_FOUND" as const, message: "Unit not found" };

      const [deps] = await tx.execute(sql`SELECT
        (SELECT count(*)::int FROM core.holds WHERE unit_id = ${unitId}) AS holds,
        (SELECT count(*)::int FROM core.bookings WHERE unit_id = ${unitId}) AS bookings,
        (SELECT count(*)::int FROM core.documents WHERE unit_id = ${unitId}) AS documents,
        (SELECT count(*)::int FROM core.unit_status_events WHERE unit_id = ${unitId}) AS status_events,
        (SELECT count(*)::int FROM core.lead_events WHERE unit_id = ${unitId}) AS lead_events,
        (SELECT count(*)::int FROM core.lead_interests WHERE unit_id = ${unitId}) AS lead_interests,
        (SELECT count(*)::int FROM core.site_visit_units WHERE unit_id = ${unitId}) AS visit_links,
        (SELECT count(*)::int FROM core.unit_geometries WHERE unit_id = ${unitId}) AS geometries
      `);

      const labels: Record<string, string> = {
        holds: 'hold(s)', bookings: 'booking(s)', documents: 'document(s)',
        status_events: 'status history event(s)', lead_events: 'lead event(s)',
        lead_interests: 'lead interest(s)', visit_links: 'site visit link(s)',
        geometries: 'geometry feature(s)',
      };
      const blockers = Object.entries(labels)
        .filter(([key]) => Number(deps[key]) > 0)
        .map(([key, label]) => `${deps[key]} ${label}`);

      if (blockers.length > 0) {
        return {
          ok: false as const,
          code: "HAS_DEPENDENTS" as const,
          message: `Cannot delete unit ${unit.unitNumber}: it is referenced by ${blockers.join(', ')}. Remove or archive those records first.`,
        };
      }

      await writeAudit({
        action: "unit.delete",
        entityType: "unit",
        entityId: unitId,
        before: unit,
        after: null,
      }, tx);

      await tx.delete(schema.units).where(eq(schema.units.id, unitId));
      return { ok: true as const };
    });

    if (result.ok) {
      revalidatePath(`/projects/${projectId}/units`);
    }
    return result;
  } catch (err: any) {
    console.error("Delete unit error:", err);
    return { ok: false as const, code: "PERSIST_FAILED", message: err.message || "Failed to delete unit" };
  }
}

export async function transitionUnitStatusAction(
  unitId: string, 
  toStatus: any, 
  options?: {
    reason?: string;
    holdId?: string;
    bookingId?: string;
    clientId?: string;
  }
) {
  const reason = options?.reason;
  const holdId = options?.holdId;
  const bookingId = options?.bookingId;
  const clientId = options?.clientId;
  const { authedQuery } = await import('@/server/db');
  const { getRoleContext } = await import('@/server/session');
  const { writeAudit } = await import('@/server/audit');
  const { eq } = await import('drizzle-orm');
  const { coreSchema } = await import('@estate/db');
  const { revalidatePath } = await import('next/cache');
  
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: "Not signed in" };

  try {
    const { transition } = await import('@estate/domain/src/unit-status/machine');
    
    return await authedQuery(context, async (tx: any) => {
      const [unit] = await tx.select().from(coreSchema.units).where(eq(coreSchema.units.id, unitId));
      if (!unit) throw new Error('Unit not found');
      
      const domainResult = transition({
        fromStatus: unit.status as any,
        toStatus,
        reason,
        holdId,
        bookingId,
        clientId,
        actorId: context.userId
      });

      if (!domainResult.ok) {
        throw new Error(domainResult.message || "ILLEGAL_TRANSITION");
      }
      
      const event = domainResult.event;

      await tx.insert(coreSchema.unitStatusEvents).values({
        unitId,
        fromStatus: unit.status,
        toStatus: event.toStatus,
        reason: event.reason,
        holdId: event.holdId,
        bookingId: event.bookingId,
        clientId: event.clientId,
        actorId: context.userId
      });
      
      await tx.update(coreSchema.units)
        .set({ status: event.toStatus, statusChangedAt: new Date() })
        .where(eq(coreSchema.units.id, unitId));
      
      await writeAudit({
        action: 'unit.status_change',
        entityType: 'unit',
        entityId: unitId,
        before: { status: unit.status },
        after: { status: event.toStatus }
      }, tx);
      
      // Inline republish hook (T38) — Latency budget < 1s
      const [project] = await tx.select().from(coreSchema.projects).where(eq(coreSchema.projects.id, unit.projectId));
      if (project?.publishedAt) {
        const { publishProject } = await import('../publish');
        await publishProject(tx, unit.projectId);
      }
      
      revalidatePath(`/projects/${unit.projectId}`);
      revalidatePath(`/projects/${unit.projectId}/units`);
      return { ok: true as const };
    });
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to transition status' };
  }
}
