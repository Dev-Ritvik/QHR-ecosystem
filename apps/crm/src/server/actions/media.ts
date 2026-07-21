// apps/crm/src/server/actions/media.ts
'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { writeAudit } from '@/server/audit';
import { coreSchema as schema } from '@estate/db';
import { createClient } from '@supabase/supabase-js';
import { MediaOrderSchema } from '@/lib/validation';

// SUPABASE_SERVICE_ROLE_KEY bypasses RLS for uploads (NFR-S8 / T32 spec)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadMedia(formData: FormData) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: 'Unauthorized' };

  const projectId = formData.get('projectId') as string;
  const unitId = formData.get('unitId') as string | null;
  const kind = formData.get('kind') as 'hero' | 'gallery' | 'plan' | 'og_image';
  const altText = formData.get('altText') as string;
  const file = formData.get('file') as File;

  if (!projectId || !kind || !altText || !file) {
    return { ok: false as const, message: 'Missing required fields' };
  }

  // 1. Min-resolution gate (Basic validation)
  const buffer = Buffer.from(await file.arrayBuffer());
  
  if (buffer.length < 51200) { 
    return { ok: false as const, message: 'Image fails minimum resolution/quality gate' };
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${projectId}/${kind}_${Date.now()}.${fileExt}`;
  const bucket = 'project-media';

  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
    const baseUrl = publicUrlData.publicUrl;

    const variants = {
      thumb: { url: `${baseUrl}?width=400&resize=contain`, w: 400, h: 300 },
      web: { url: `${baseUrl}?width=1200&resize=contain`, w: 1200, h: 900 },
      presentation_4k: { url: `${baseUrl}?width=3840&resize=contain`, w: 3840, h: 2160 },
    };

    await authedQuery(context, async (tx: any) => {
      const [mediaRow] = await tx.insert(schema.media).values({
        projectId,
        unitId: unitId || null,
        kind,
        altText,
        storagePath: fileName,
        variants,
        status: 'ready',
        uploadedById: context.userId,
      }).returning();

      await writeAudit({
        actorId: context.userId,
        action: 'media.upload',
        entityType: 'media',
        entityId: mediaRow.id,
        before: null,
        after: { projectId, kind, storagePath: fileName },
      }, tx);

      return mediaRow;
    });

    revalidatePath(`/projects/${projectId}`);
    return { ok: true as const };
  } catch (error: any) {
    console.error('[media] Upload failed:', error);
    return { ok: false as const, message: error.message || 'Media upload failed' };
  }
}

export async function updateMediaOrder(data: { projectId: string, orderedIds: string[] }) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: 'Unauthorized' };
  
  const parsed = MediaOrderSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid payload' };
  }

  try {
    await authedQuery(context, async (tx: any) => {
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        await tx
          .update(schema.media)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(
            eq(schema.media.id, parsed.data.orderedIds[i]),
            eq(schema.media.projectId, parsed.data.projectId)
          ));
      }

      await writeAudit({
        actorId: context.userId,
        action: 'media.reorder',
        entityType: 'project',
        entityId: parsed.data.projectId,
        before: null,
        after: { orderedIds: parsed.data.orderedIds },
      }, tx);
    });

    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true as const };
  } catch (error: any) {
    return { ok: false as const, message: 'Failed to update order' };
  }
}
