'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { writeAudit } from '@/server/audit';
import { coreSchema as schema } from '@estate/db';
import { PoiSchema, DeletePoiSchema, ReorderPoisSchema, UpdatePoiSchema } from '@/lib/validation';
import * as turf from '@turf/turf';
import { parseWkbPoint, toEwktPoint } from '@/lib/wkb';

export async function createPoi(data: z.input<typeof PoiSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, message: 'Not signed in' };
  }
  
  const parsed = PoiSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid payload', issues: parsed.error.flatten().fieldErrors };
  }

  const { projectId, location, ...rest } = parsed.data;

  try {
    await authedQuery(context, async (tx: any) => {
      // 1. Get the project centroid, or fallback to computing from active geometry
      const [proj] = await tx
        .select({
          centroid: schema.projects.centroid
        })
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId));

      if (!proj) throw new Error('Project not found');

      // 2. Compute distance from the centroid to the new POI
      let computedDistanceM: number | null = null;
      let referencePoint: GeoJSON.Point | null = parseWkbPoint(proj.centroid as unknown as string);

      if (!referencePoint) {
        // Fallback to the active geometry's boundary centroid
        const [activeGeom] = await tx
          .select({ boundary: schema.geometryVersions.boundaryGeom })
          .from(schema.geometryVersions)
          .where(and(eq(schema.geometryVersions.projectId, projectId), eq(schema.geometryVersions.status, 'active')));
        
        // MultiPolygon WKB parsing is complex, so we'll skip fallback computation if centroid is null 
        // to avoid writing a full WKB parser here.
        if (activeGeom && activeGeom.boundary) {
          // Geometry WKB fallback not supported in this constrained env without ST_AsGeoJSON
          // referencePoint = null;
        }
      }

      if (referencePoint && location) {
        const dist = turf.distance(
          turf.point(referencePoint.coordinates),
          turf.point(location),
          { units: 'meters' }
        );
        computedDistanceM = Math.round(dist);
      }

      // 3. Determine the sort order (append to the end)
      const existing = await tx
        .select({ id: schema.pois.id })
        .from(schema.pois)
        .where(eq(schema.pois.projectId, projectId));
      
      const sortOrder = existing.length;

      // 4. Insert the POI
      const [poi] = await tx.insert(schema.pois).values({
        projectId,
        name: rest.name,
        category: rest.category,
        location: location ? toEwktPoint(location[0], location[1]) as any : null,
        distanceM: computedDistanceM,
        distanceOverrideM: rest.distanceOverrideM || null,
        driveTimeMin: rest.driveTimeMin || null,
        driveTimeOverrideMin: rest.driveTimeOverrideMin || null,
        sortOrder,
        createdById: context.userId,
      }).returning();

      // 5. Audit
      await writeAudit({
        actorId: context.userId,
        action: 'poi.create',
        entityType: 'poi',
        entityId: poi.id,
        before: null,
        after: { name: rest.name, category: rest.category, distanceM: computedDistanceM },
      }, tx);
    });

    revalidatePath(`/projects/${projectId}/pois`);
    return { ok: true as const };
  } catch (error: any) {
    console.error('[pois] Creation failed:', error);
    return { ok: false as const, message: error.message || 'Failed to create POI' };
  }
}

export async function updatePoi(data: z.infer<typeof UpdatePoiSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, message: 'Not signed in' };
  }

  const parsed = UpdatePoiSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid payload', issues: parsed.error.flatten().fieldErrors };
  }

  const { poiId, location, ...rest } = parsed.data;

  try {
    let projectId: string;
    await authedQuery(context, async (tx: any) => {
      const [poi] = await tx.select().from(schema.pois).where(eq(schema.pois.id, poiId));
      if (!poi) throw new Error('POI not found');
      projectId = poi.projectId;

      // Recompute straight-line distance only if the pin moved
      let computedDistanceM: number | undefined = undefined;
      if (location) {
        const [proj] = await tx
          .select({ centroid: schema.projects.centroid })
          .from(schema.projects)
          .where(eq(schema.projects.id, poi.projectId));
        const referencePoint = parseWkbPoint(proj?.centroid as unknown as string);
        if (referencePoint) {
          computedDistanceM = Math.round(turf.distance(
            turf.point(referencePoint.coordinates),
            turf.point(location),
            { units: 'meters' }
          ));
        }
      }

      await tx.update(schema.pois).set({
        name: rest.name,
        category: rest.category,
        ...(location ? { location: toEwktPoint(location[0], location[1]) as any } : {}),
        ...(computedDistanceM !== undefined ? { distanceM: computedDistanceM } : {}),
        distanceOverrideM: rest.distanceOverrideM ?? null,
        driveTimeMin: rest.driveTimeMin ?? null,
        driveTimeOverrideMin: rest.driveTimeOverrideMin ?? null,
        updatedAt: new Date(),
      }).where(eq(schema.pois.id, poiId));

      await writeAudit({
        actorId: context.userId,
        action: 'poi.update',
        entityType: 'poi',
        entityId: poiId,
        before: { name: poi.name, category: poi.category, distanceOverrideM: poi.distanceOverrideM, driveTimeMin: poi.driveTimeMin, driveTimeOverrideMin: poi.driveTimeOverrideMin },
        after: { name: rest.name, category: rest.category, distanceOverrideM: rest.distanceOverrideM ?? null, driveTimeMin: rest.driveTimeMin ?? null, driveTimeOverrideMin: rest.driveTimeOverrideMin ?? null, movedPin: !!location },
      }, tx);
    });

    revalidatePath(`/projects/${projectId!}/pois`);
    return { ok: true as const };
  } catch (error: any) {
    console.error('[pois] Update failed:', error);
    return { ok: false as const, message: error.message || 'Failed to update POI' };
  }
}

export async function deletePoi(data: z.infer<typeof DeletePoiSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, message: 'Not signed in' };
  }
  
  const parsed = DeletePoiSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid payload' };
  }

  try {
    let projectId: string;
    await authedQuery(context, async (tx: any) => {
      const [poi] = await tx.select().from(schema.pois).where(eq(schema.pois.id, parsed.data.poiId));
      if (!poi) throw new Error('POI not found');
      
      projectId = poi.projectId;

      await tx
        .update(schema.pois)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.pois.id, poi.id));

      await writeAudit({
        actorId: context.userId,
        action: 'poi.delete',
        entityType: 'poi',
        entityId: poi.id,
        before: { archivedAt: null },
        after: { archivedAt: new Date() },
      }, tx);
    });

    revalidatePath(`/projects/${projectId!}/pois`);
    return { ok: true as const };
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to delete POI' };
  }
}

const MovePoiSchema = z.object({
  poiId: z.string().uuid(),
  direction: z.enum(['up', 'down']),
});

/**
 * Moves a POI one position up/down in the curated order. Module-level action
 * taking only serializable args — the previous inline server-action closure
 * on the POIs page crashed Next's closure serializer.
 */
export async function movePoi(data: z.infer<typeof MovePoiSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, message: 'Not signed in' };
  }

  const parsed = MovePoiSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid payload' };
  }

  try {
    let projectId: string;
    await authedQuery(context, async (tx: any) => {
      const [poi] = await tx.select().from(schema.pois).where(eq(schema.pois.id, parsed.data.poiId));
      if (!poi) throw new Error('POI not found');
      projectId = poi.projectId;

      const rows = await tx
        .select({ id: schema.pois.id })
        .from(schema.pois)
        .where(and(eq(schema.pois.projectId, poi.projectId), isNull(schema.pois.archivedAt)))
        .orderBy(schema.pois.sortOrder);

      const ids: string[] = rows.map((r: any) => r.id);
      const index = ids.indexOf(parsed.data.poiId);
      if (index < 0) throw new Error('POI not found in active list');

      const swapWith = parsed.data.direction === 'up' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= ids.length) return; // already at the edge

      [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];

      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(schema.pois)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(schema.pois.id, ids[i]));
      }

      await writeAudit({
        actorId: context.userId,
        action: 'poi.reorder',
        entityType: 'project',
        entityId: poi.projectId,
        before: null,
        after: { movedPoiId: parsed.data.poiId, direction: parsed.data.direction, orderedIds: ids },
      }, tx);
    });

    revalidatePath(`/projects/${projectId!}/pois`);
    return { ok: true as const };
  } catch (error: any) {
    console.error('[pois] Move failed:', error);
    return { ok: false as const, message: error.message || 'Failed to reorder POI' };
  }
}

// <form action> requires a void return; these wrap the result-returning
// actions for direct use as bound form actions.
export async function movePoiForm(data: z.infer<typeof MovePoiSchema>): Promise<void> {
  await movePoi(data);
}

export async function deletePoiForm(data: z.infer<typeof DeletePoiSchema>): Promise<void> {
  await deletePoi(data);
}

export async function reorderPois(data: z.infer<typeof ReorderPoisSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, message: 'Not signed in' };
  }
  
  const parsed = ReorderPoisSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid payload' };
  }

  try {
    await authedQuery(context, async (tx: any) => {
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        await tx
          .update(schema.pois)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(
            eq(schema.pois.id, parsed.data.orderedIds[i]),
            eq(schema.pois.projectId, parsed.data.projectId)
          ));
      }

      await writeAudit({
        actorId: context.userId,
        action: 'poi.reorder',
        entityType: 'project',
        entityId: parsed.data.projectId,
        before: null,
        after: { orderedIds: parsed.data.orderedIds },
      }, tx);
    });

    revalidatePath(`/projects/${parsed.data.projectId}/pois`);
    return { ok: true as const };
  } catch (error: any) {
    return { ok: false as const, message: 'Failed to update POI order' };
  }
}
