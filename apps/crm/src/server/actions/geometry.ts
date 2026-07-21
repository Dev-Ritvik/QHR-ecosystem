'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, and, max, sql } from 'drizzle-orm';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { writeAudit } from '@/server/audit';
import { coreSchema as schema } from '@estate/db';
import { createClient } from '@supabase/supabase-js';
import { SaveTransformSchema, SaveTracedUnitsSchema, ActivateVersionSchema } from '@/lib/validation';
import { validatePolygon } from '@estate/domain/geometry/validate';
import { computeEdgeData } from '@estate/domain/geometry/edge-derivation';

// SUPABASE_SERVICE_ROLE_KEY bypasses RLS for uploads (NFR-S8)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadLayout(formData: FormData) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, message: 'Not signed in' };
  }

  const projectId = formData.get('projectId') as string;
  const file = formData.get('file') as File;
  
  if (!projectId || !file) {
    return { ok: false as const, message: 'Missing project ID or file' };
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const fileType = fileExt === 'pdf' ? 'pdf' : fileExt === 'dxf' ? 'dxf' : 'image';
  const fileName = `${projectId}/layout_${Date.now()}.${fileExt}`;
  const bucket = 'project-layouts';

  try {
    // 1. Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    await authedQuery(context, async (tx: any) => {
      // 2. Determine next version number
      const [maxVerRecord] = await tx
        .select({ maxVer: max(schema.geometryVersions.versionNo) })
        .from(schema.geometryVersions)
        .where(eq(schema.geometryVersions.projectId, projectId));
      
      const nextVersionNo = (maxVerRecord?.maxVer || 0) + 1;

      // 3. Create draft geometry version
      const [version] = await tx.insert(schema.geometryVersions).values({
        projectId,
        versionNo: nextVersionNo,
        status: 'draft',
        sourceFilePath: fileName,
        sourceFileType: fileType,
        createdById: context.userId,
      }).returning();

      // 4. Audit Log
      await writeAudit({
        actorId: context.userId,
        action: 'geometry.upload_layout',
        entityType: 'project',
        entityId: projectId,
        before: null,
        after: { versionId: version.id, versionNo: nextVersionNo, path: fileName },
      }, tx);
    });

    revalidatePath(`/projects/${projectId}/digitizer`);
    return { ok: true as const };
  } catch (error: any) {
    console.error('[geometry] Layout upload failed:', error);
    return { ok: false as const, message: error.message || 'Layout upload failed' };
  }
}

/**
 * Creates a fresh DRAFT geometry version for a project whose latest version is
 * active/superseded (drafts are the only editable state, so without this the
 * digitizer dead-ends after activation). Clones the newest version's layout
 * file and georeference transform so revision starts from the current state.
 */
export async function createDraftVersion(projectId: string) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, message: 'Not signed in' };
  }

  try {
    let newVersionNo = 0;
    await authedQuery(context, async (tx: any) => {
      const [latest] = await tx
        .select()
        .from(schema.geometryVersions)
        .where(eq(schema.geometryVersions.projectId, projectId))
        .orderBy(sql`${schema.geometryVersions.versionNo} DESC`)
        .limit(1);

      if (!latest) throw new Error('No existing version to revise — upload a layout first');
      if (latest.status === 'draft') throw new Error('A draft version already exists — edit that one');

      newVersionNo = latest.versionNo + 1;
      const [version] = await tx.insert(schema.geometryVersions).values({
        projectId,
        versionNo: newVersionNo,
        status: 'draft',
        sourceFilePath: latest.sourceFilePath,
        sourceFileType: latest.sourceFileType,
        georefTransform: latest.georefTransform,
        createdById: context.userId,
      }).returning();

      await writeAudit({
        actorId: context.userId,
        action: 'geometry.create_draft',
        entityType: 'project',
        entityId: projectId,
        before: { revisedFromVersionId: latest.id, revisedFromVersionNo: latest.versionNo },
        after: { versionId: version.id, versionNo: newVersionNo },
      }, tx);
    });

    revalidatePath(`/projects/${projectId}/digitizer`);
    return { ok: true as const, versionNo: newVersionNo };
  } catch (error: any) {
    console.error('[geometry] Draft creation failed:', error);
    return { ok: false as const, message: error.message || 'Failed to create draft version' };
  }
}

export async function saveTransform(data: z.infer<typeof SaveTransformSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, message: 'Not signed in' };
  }
  
  const parsed = SaveTransformSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid payload', issues: parsed.error.flatten().fieldErrors };
  }

  const { versionId, transform } = parsed.data;

  try {
    await authedQuery(context, async (tx: any) => {
      const [version] = await tx.select().from(schema.geometryVersions).where(eq(schema.geometryVersions.id, versionId));
      if (!version) throw new Error('Geometry version not found');
      if (version.status !== 'draft') throw new Error('Can only modify draft geometry versions');

      await tx
        .update(schema.geometryVersions)
        .set({ georefTransform: transform })
        .where(eq(schema.geometryVersions.id, versionId));

      await writeAudit({
        actorId: context.userId,
        action: 'geometry.save_transform',
        entityType: 'geometry_version',
        entityId: versionId,
        before: { transform: version.georefTransform },
        after: { transform },
      }, tx);
    });

    revalidatePath(`/projects`);
    return { ok: true as const };
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to save transform' };
  }
}

export async function saveTracedUnits(data: z.infer<typeof SaveTracedUnitsSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, message: 'Not signed in' };
  }

  const parsed = SaveTracedUnitsSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid payload', issues: parsed.error.flatten().fieldErrors };
  }

  const { projectId, versionId, features } = parsed.data;

  try {
    await authedQuery(context, async (tx: any) => {
      // Ensure the version exists and is draft
      const [version] = await tx.select().from(schema.geometryVersions).where(eq(schema.geometryVersions.id, versionId));
      if (!version) throw new Error('Geometry version not found');
      if (version.status !== 'draft') throw new Error('Cannot add traces to active/superseded versions');

      for (const feature of features) {
        // 1. Validate polygon strictly through domain rules (NFR-D7).
        // validatePolygon expects a GeoJSON Feature (it reads .geometry) —
        // passing the bare Polygon made every save fail with
        // "Polygon has no coordinates".
        const validation = validatePolygon({ type: 'Feature', properties: {}, geometry: feature.geom } as any);
        if (!validation.ok) {
          throw new Error(`Invalid geometry for unit ${feature.unitNumber}: ${validation.message || 'Unknown error'}`);
        }

        // 2. Find or bulk-create the unit record linked to this polygon (FR-C8)
        let [unit] = await tx
          .select()
          .from(schema.units)
          .where(and(eq(schema.units.projectId, projectId), eq(schema.units.unitNumber, feature.unitNumber)));

        if (!unit) {
          [unit] = await tx
            .insert(schema.units)
            .values({
              projectId,
              unitNumber: feature.unitNumber,
              status: 'available',
            })
            .returning();
        }

        // 3. Persist the geometry as a valid PostGIS MultiPolygon/Polygon
        await tx
          .insert(schema.unitGeometries)
          .values({
            geometryVersionId: versionId,
            unitId: unit.id,
            geom: sql`extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(${JSON.stringify(feature.geom)}), 4326)`,
          })
          .onConflictDoUpdate({
            target: [schema.unitGeometries.geometryVersionId, schema.unitGeometries.unitId],
            set: {
              geom: sql`extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(${JSON.stringify(feature.geom)}), 4326)`,
              updatedAt: new Date(),
            },
          });
      }

      await writeAudit({
        actorId: context.userId,
        action: 'geometry.trace_units',
        entityType: 'geometry_version',
        entityId: versionId,
        before: null,
        after: { tracedCount: features.length },
      }, tx);
    });

    revalidatePath(`/projects/${projectId}/digitizer`);
    return { ok: true as const };
  } catch (error: any) {
    console.error('[geometry] Tracing save failed:', error);
    return { ok: false as const, message: error.message || 'Failed to save traced units' };
  }
}

export async function activateGeometryVersion(projectId: string, versionId: string) {
  const { authedQuery } = await import('@/server/db');
  const { getRoleContext } = await import('@/server/session');
  const { writeAudit } = await import('@/server/audit');
  const { eq, and } = await import('drizzle-orm');
  const { coreSchema } = await import('@estate/db');
  const { revalidatePath } = await import('next/cache');
  
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: "Not signed in" };

  try {
    return await authedQuery(context, async (tx: any) => {
      const versionGeoms = await tx.select().from(coreSchema.unitGeometries).where(eq(coreSchema.unitGeometries.geometryVersionId, versionId));
      
      // Recompute derived edge data for the skeleton view upon activation
      if (versionGeoms.length > 0) {
        const { computeEdgeData } = await import('@estate/domain/src/geometry/edge-derivation');
        for (const geom of versionGeoms) {
          const edgeDataMap = computeEdgeData([{ id: geom.unitId, unitId: geom.unitId, geom: geom.geom as any }]);
          const edgeData = edgeDataMap.get(geom.unitId);
          await tx.update(coreSchema.unitGeometries)
            .set({ edgeData, updatedAt: new Date() })
            .where(eq(coreSchema.unitGeometries.id, geom.id));
        }
      }
      
      await tx.update(coreSchema.geometryVersions)
        .set({ status: 'superseded' })
        .where(and(eq(coreSchema.geometryVersions.projectId, projectId), eq(coreSchema.geometryVersions.status, 'active')));
      await tx.update(coreSchema.geometryVersions)
        .set({ status: 'active', activatedAt: new Date() })
        .where(eq(coreSchema.geometryVersions.id, versionId));
    
      await writeAudit({
        action: 'geometry.activate',
        entityType: 'project',
        entityId: projectId,
        before: null,
        after: { versionId }
      }, tx);
      
      // Inline republish hook (T38)
      const [project] = await tx.select().from(coreSchema.projects).where(eq(coreSchema.projects.id, projectId));
      if (project?.publishedAt) {
        const { publishProject } = await import('../publish');
        await publishProject(tx, projectId);
      }
      
      revalidatePath(`/projects/${projectId}`);
      revalidatePath(`/projects/${projectId}/digitizer`);
      return { ok: true as const };
    });
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to activate geometry version' };
  }
}
