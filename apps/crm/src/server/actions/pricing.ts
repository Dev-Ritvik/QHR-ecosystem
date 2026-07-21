"use server";

import { z } from "zod";
import { eq, desc, isNull, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { authedQuery } from "@/server/db";
import { getRoleContext } from "@/server/session";
import { writeAudit } from "@/server/audit";
import { PriceVersionSchema } from "@/lib/validation";
import { priceVersions, projects, units } from "@estate/db";
import { computePrice } from "@estate/domain/src/pricing/compute";

/**
 * Recomputes computed_price_paise for every unit in the project against the
 * given price version. Without this, units created BEFORE a version was
 * activated keep a NULL computed price forever (unit create/edit is the only
 * other computation point) and the inventory table shows "—".
 * Units whose data can't satisfy the rate basis (e.g. missing area for
 * per_sq_yd) are left NULL — genuinely unpriceable until edited.
 */
async function recomputeUnitPrices(
  tx: any,
  projectId: string,
  version: { id: string; baseRatePaise: bigint | string; rateBasis: string; premiums: unknown },
): Promise<{ priced: number; skipped: number }> {
  const projectUnits = await tx.select({
      id: units.id,
      areaSqYd: units.areaSqYd,
      areaSqFt: units.areaSqFt,
      isCorner: units.isCorner,
      facing: units.facing,
      roadWidthM: units.roadWidthM,
    })
    .from(units)
    .where(eq(units.projectId, projectId));

  let priced = 0;
  let skipped = 0;
  const rows: Array<{ id: string; pricePaise: string | null }> = [];
  for (const u of projectUnits) {
    let computedPricePaise: bigint | null = null;
    try {
      computedPricePaise = computePrice(
        BigInt(version.baseRatePaise),
        version.rateBasis as any,
        version.premiums as any,
        {
          areaSqYd: u.areaSqYd ? Number(u.areaSqYd) : undefined,
          areaSqFt: u.areaSqFt ? Number(u.areaSqFt) : undefined,
          isCorner: u.isCorner,
          facing: u.facing || undefined,
          roadWidthM: u.roadWidthM ? Number(u.roadWidthM) : undefined,
        },
      ).computedPricePaise;
      priced++;
    } catch {
      skipped++;
    }
    rows.push({ id: u.id, pricePaise: computedPricePaise === null ? null : computedPricePaise.toString() });
  }

  // Single bulk UPDATE — one per-unit statement each would take ~150ms × N
  // over the pooled connection and stall large projects for tens of seconds.
  if (rows.length > 0) {
    await tx.execute(sql`
      UPDATE core.units AS u
      SET computed_price_paise = v.price_paise::bigint,
          price_version_id = ${version.id}::uuid,
          updated_at = now()
      FROM (VALUES ${sql.join(
        rows.map((r) => sql`(${r.id}::uuid, ${r.pricePaise}::bigint)`),
        sql`, `,
      )}) AS v(id, price_paise)
      WHERE u.id = v.id
    `);
  }
  return { priced, skipped };
}

export async function createPriceVersion(projectId: string, data: z.input<typeof PriceVersionSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: "UNAUTHENTICATED", message: "Unauthorized" };

  const parsed = PriceVersionSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      code: "VALIDATION_FAILED",
      message: "Invalid fields",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await authedQuery(context, async (tx) => {
      // 1. Verify project exists
      const [project] = await tx.select().from(projects).where(eq(projects.id, projectId));
      if (!project) throw new Error("PROJECT_NOT_FOUND");

      // 2. Find currently active version
      const [activeVersion] = await tx.select()
        .from(priceVersions)
        .where(
          and(
            eq(priceVersions.projectId, projectId),
            isNull(priceVersions.supersededAt)
          )
        )
        .orderBy(desc(priceVersions.versionNo))
        .limit(1);

      const nextVersionNo = activeVersion ? activeVersion.versionNo + 1 : 1;
      const now = new Date();

      // 3. Supersede old version
      if (activeVersion) {
        await tx.update(priceVersions)
          .set({ supersededAt: now })
          .where(eq(priceVersions.id, activeVersion.id));
      }

      // 4. Insert new version (atomic supersede)
      const [newVersion] = await tx.insert(priceVersions).values({
        projectId,
        versionNo: nextVersionNo,
        rateBasis: parsed.data.rateBasis,
        baseRatePaise: BigInt(parsed.data.baseRatePaise),
        premiums: parsed.data.premiums ?? {},
        reason: parsed.data.reason ?? "",
        createdById: context.userId,
        activatedAt: now,
      }).returning();

      // New version is active immediately — reprice the whole project now
      const { priced, skipped } = await recomputeUnitPrices(tx, projectId, newVersion);

      await writeAudit({
        action: "pricing.create_version",
        entityType: "project",
        entityId: projectId,
        after: { versionId: newVersion.id, versionNo: newVersion.versionNo, baseRatePaise: Number(newVersion.baseRatePaise), unitsPriced: priced, unitsSkipped: skipped },
      }, tx);

      return newVersion;
    });

    revalidatePath(`/projects/${projectId}/pricing`);
    revalidatePath(`/projects/${projectId}/units`);
    return { ok: true as const, version: result };
  } catch (err: any) {
    console.error("Create price version error:", err);
    if (err.message === "PROJECT_NOT_FOUND") {
      return { ok: false as const, code: "NOT_FOUND", message: "Project not found" };
    }
    return { ok: false as const, code: "PERSIST_FAILED", message: "Failed to create price version" };
  }
}

export async function activatePriceVersion(projectId: string, versionId: string) {
  const { authedQuery } = await import('@/server/db');
  const { getRoleContext } = await import('@/server/session');
  const { writeAudit } = await import('@/server/audit');
  const { eq, and, isNull, isNotNull } = await import('drizzle-orm');
  const { coreSchema } = await import('@estate/db');
  const { revalidatePath } = await import('next/cache');
  
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: "Not signed in" };

  try {
    return await authedQuery(context, async (tx: any) => {
      await tx.update(coreSchema.priceVersions)
        .set({ supersededAt: new Date() })
        .where(and(eq(coreSchema.priceVersions.projectId, projectId), isNull(coreSchema.priceVersions.supersededAt), isNotNull(coreSchema.priceVersions.activatedAt)));
      // Clear supersededAt too so re-activating an older version actually
      // makes it the active one for every isNull(supersededAt) reader.
      const [activated] = await tx.update(coreSchema.priceVersions)
        .set({ activatedAt: new Date(), supersededAt: null })
        .where(eq(coreSchema.priceVersions.id, versionId))
        .returning();
      if (!activated) throw new Error('Price version not found');

      // Reprice every unit against the newly active version (must precede
      // the republish below, which projects unit prices to the public site)
      const { priced, skipped } = await recomputeUnitPrices(tx, projectId, activated);

      await writeAudit({
        action: 'pricing.activate',
        entityType: 'project',
        entityId: projectId,
        before: null,
        after: { versionId, unitsPriced: priced, unitsSkipped: skipped }
      }, tx);

      // Inline republish hook (T38)
      const [project] = await tx.select().from(coreSchema.projects).where(eq(coreSchema.projects.id, projectId));
      if (project?.publishedAt) {
        const { publishProject } = await import('../publish');
        await publishProject(tx, projectId);
      }
      
      revalidatePath(`/projects/${projectId}`);
      revalidatePath(`/projects/${projectId}/pricing`);
      revalidatePath(`/projects/${projectId}/units`);
      return { ok: true as const };
    });
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to activate price version' };
  }
}
