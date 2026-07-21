"use server";

import { z } from "zod";
import { eq, and, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ProjectSchema } from "@/lib/validation";
import { authedQuery } from "@/server/db";
import { coreSchema as schema } from "@estate/db";
import { getRoleContext, requireOwner } from "@/server/session";
import { writeAudit } from "@/server/audit";
import { toEwktPoint } from "@/lib/wkb";

// Splits the form's centroidLng/centroidLat off the payload and converts them
// to the geometry value for projects.centroid (undefined = leave untouched).
function extractCentroid(data: z.infer<typeof ProjectSchema>) {
  const { centroidLng, centroidLat, ...rest } = data;
  const centroid =
    centroidLng != null && centroidLat != null
      ? (toEwktPoint(centroidLng, centroidLat) as any)
      : undefined;
  return { rest, centroid };
}

export async function createProject(data: z.infer<typeof ProjectSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, code: "UNAUTHENTICATED", message: "Not signed in" };
  }

  const parsed = ProjectSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: "VALIDATION_FAILED", issues: parsed.error.flatten().fieldErrors };
  }

  try {
    const result = await authedQuery(context, async (tx) => {
      const existing = await tx.query.projects.findFirst({
        where: and(eq(schema.projects.slug, parsed.data.slug), isNull(schema.projects.archivedAt)),
      });

      if (existing) {
        return { ok: false as const, code: "VALIDATION_FAILED", issues: { slug: ["Slug is already in use by an active project"] } };
      }

      const { rest, centroid } = extractCentroid(parsed.data);
      const [project] = await tx.insert(schema.projects).values({
        ...rest,
        ...(centroid !== undefined ? { centroid } : {}),
        createdById: context.userId,
      }).returning();

      await writeAudit({
        action: "project.create",
        entityType: "project",
        entityId: project.id,
        after: project,
      }, tx);

      return { ok: true as const, data: project };
    });

    if (result.ok) {
      revalidatePath("/projects");
    }
    
    return result;
  } catch (err: any) {
    console.error("[createProject]", err);
    return { ok: false as const, code: "PERSIST_FAILED", message: "Failed to create project" };
  }
}

export async function updateProject(id: string, data: z.infer<typeof ProjectSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, code: "UNAUTHENTICATED", message: "Not signed in" };
  }

  const parsed = ProjectSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: "VALIDATION_FAILED", issues: parsed.error.flatten().fieldErrors };
  }

  try {
    const result = await authedQuery(context, async (tx) => {
      const existing = await tx.query.projects.findFirst({
        where: and(
          eq(schema.projects.slug, parsed.data.slug),
          ne(schema.projects.id, id),
          isNull(schema.projects.archivedAt)
        ),
      });

      if (existing) {
        return { ok: false as const, code: "VALIDATION_FAILED", issues: { slug: ["Slug is already in use by another active project"] } };
      }

      const before = await tx.query.projects.findFirst({ where: eq(schema.projects.id, id) });
      if (!before) {
        return { ok: false as const, code: "NOT_FOUND", message: "Project not found" };
      }

      const { rest, centroid } = extractCentroid(parsed.data);
      const [project] = await tx.update(schema.projects)
        .set({
          ...rest,
          ...(centroid !== undefined ? { centroid } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, id))
        .returning();

      await writeAudit({
        action: "project.update",
        entityType: "project",
        entityId: project.id,
        before,
        after: project,
      }, tx);

      return { ok: true as const, data: project, before };
    });

    if (result.ok) {
      revalidatePath("/projects");
      revalidatePath(`/projects/${id}`);
      
      return { ok: true as const, data: result.data };
    }
    
    return result;
  } catch (err: any) {
    console.error("[updateProject]", err);
    return { ok: false as const, code: "PERSIST_FAILED", message: "Failed to update project" };
  }
}

export async function archiveProject(id: string) {
  // Archiving is restricted to owners
  const ownerCheck = await requireOwner();
  if (!ownerCheck.ok) return ownerCheck;

  try {
    const context = { userId: ownerCheck.session.user.id, role: 'owner' as const };
    const result = await authedQuery(context, async (tx) => {
      const before = await tx.query.projects.findFirst({ where: eq(schema.projects.id, id) });
      if (!before) {
        return { ok: false as const, code: "NOT_FOUND", message: "Project not found" };
      }

      if (before.archivedAt) {
        return { ok: false as const, code: "VALIDATION_FAILED", message: "Project is already archived" };
      }

      const [project] = await tx.update(schema.projects)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.projects.id, id))
        .returning();

      await writeAudit({
        action: "project.archive",
        entityType: "project",
        entityId: project.id,
        before,
        after: project,
      }, tx);

      return { ok: true as const, data: project, before };
    });

    if (result.ok) {
      revalidatePath("/projects");
      return { ok: true as const };
    }
    
    return result;
  } catch (err: any) {
    console.error("[archiveProject]", err);
    return { ok: false as const, code: "PERSIST_FAILED", message: "Failed to archive project" };
  }
}

export async function getPublishChecklistAction(projectId: string) {
  const { authedQuery } = await import('@/server/db');
  const { checkPublishReadiness } = await import('../publish');
  const { getRoleContext } = await import('@/server/session');
  
  const context = await getRoleContext();
  if (!context) return { ok: false as const, checklist: null };
  
  return await authedQuery(context, async (tx: any) => {
    const { ok, checklist } = await checkPublishReadiness(tx, projectId);
    return { ok, checklist };
  });
}

export async function publishProjectAction(projectId: string) {
  const { authedQuery } = await import('@/server/db');
  const { publishProject } = await import('../publish');
  const { revalidatePath } = await import('next/cache');
  const { getRoleContext } = await import('@/server/session');
  
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: "Not signed in" };
  
  try {
    const result = await authedQuery(context, async (tx: any) => {
      return await publishProject(tx, projectId);
    });
    
    if (result.ok) {
      revalidatePath(`/projects/${projectId}`);
      revalidatePath(`/`);
    }
    return result;
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to publish project' };
  }
}

export async function unpublishProjectAction(projectId: string) {
  const { authedQuery } = await import('@/server/db');
  const { getRoleContext } = await import('@/server/session');
  const { writeAudit } = await import('@/server/audit');
  const { revalidatePath } = await import('next/cache');
  const { eq } = await import('drizzle-orm');
  const { coreSchema } = await import('@estate/db');
  const { projectsPub, unitsPub, geometryPub, poisPub, mediaManifests } = await import('@estate/db');
  
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: "Not signed in" };

  try {
    return await authedQuery(context, async (tx: any) => {
      await tx.delete(mediaManifests).where(eq(mediaManifests.projectId, projectId));
      await tx.delete(poisPub).where(eq(poisPub.projectId, projectId));
      await tx.delete(geometryPub).where(eq(geometryPub.projectId, projectId));
      await tx.delete(unitsPub).where(eq(unitsPub.projectId, projectId));
      await tx.delete(projectsPub).where(eq(projectsPub.projectId, projectId));
      await tx.update(coreSchema.projects).set({ publishedAt: null }).where(eq(coreSchema.projects.id, projectId));
      
      await writeAudit({
        action: 'project.unpublish',
        entityType: 'project',
        entityId: projectId,
        before: null,
        after: null
      }, tx);
      
      revalidatePath(`/projects/${projectId}`);
      revalidatePath(`/`);
      return { ok: true as const };
    });
  } catch (error: any) {
    return { ok: false as const, message: 'Failed to unpublish project' };
  }
}
