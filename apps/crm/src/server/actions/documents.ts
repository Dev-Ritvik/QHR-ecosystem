// apps/crm/src/server/actions/documents.ts
'use server';

import { z } from 'zod';
import { authedQuery } from '@/server/db';
import { documents } from '@estate/db';
import { writeAudit } from '@/server/audit';
import { getRoleContext } from '@/server/session';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { InitUnitChecklistSchema } from '@/lib/validation';
import { getUnitChecklistTemplate } from '@estate/domain/src/documents/templates';

const PRIVATE_BUCKET = 'private-docs';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function initUnitChecklist(payload: z.infer<typeof InitUnitChecklistSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  const parsed = InitUnitChecklistSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, code: 'VALIDATION_FAILED' };

  try {
    const existing = await authedQuery(context, async (tx) => 
      tx.select().from(documents).where(and(
        eq(documents.unitId, parsed.data.unitId),
        eq(documents.scope, 'unit')
      ))
    );

    if (existing.length > 0) {
      return { ok: true as const, message: 'Already initialized' };
    }

    const template = getUnitChecklistTemplate(parsed.data.assetClass);
    if (template.length === 0) return { ok: true as const }; // Nothing to init

    await authedQuery(context, async (tx) => {
      // unit_id ONLY: documents_exactly_one_owner requires exactly one of
      // project_id/unit_id/booking_id/client_id — setting project_id too made
      // every unit-checklist insert fail 23514. The project is reachable via
      // the unit, and all readers scope these rows by unit_id + scope.
      await tx.insert(documents).values(
        template.map(item => ({
          scope: 'unit' as const,
          unitId: parsed.data.unitId,
          checklistKey: item.key,
          title: item.title,
          status: 'missing' as const,
        }))
      );
      
      await writeAudit({
        actorId: context.userId,
        action: 'document.init_checklist',
        entityType: 'unit',
        entityId: parsed.data.unitId,
        after: { type: 'unit_checklist' }
      }, tx);
    });

    revalidatePath(`/projects/${parsed.data.projectId}/units/${parsed.data.unitId}`);
    return { ok: true as const };
  } catch (err) {
    console.error('Failed to init checklist:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

export async function uploadDocument(formData: FormData) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  const documentId = formData.get('documentId') as string;
  const file = formData.get('file') as File | null;
  const validFrom = formData.get('validFrom') as string | null;
  const expiryDate = formData.get('expiryDate') as string | null;
  const projectId = formData.get('projectId') as string | null;
  const unitId = formData.get('unitId') as string | null;
  const clientId = formData.get('clientId') as string | null;
  const bookingId = formData.get('bookingId') as string | null;

  if (!documentId || !file) {
    return { ok: false as const, code: 'VALIDATION_FAILED', message: 'Missing file or document ID' };
  }

  try {
    const ext = file.name.split('.').pop();
    let filePath = '';
    if (unitId) filePath = `units/${unitId}/${documentId}-${Date.now()}.${ext}`;
    else if (clientId) filePath = `clients/${clientId}/${documentId}-${Date.now()}.${ext}`;
    else if (bookingId) filePath = `bookings/${bookingId}/${documentId}-${Date.now()}.${ext}`;
    else filePath = `other/${documentId}-${Date.now()}.${ext}`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .upload(filePath, file, { upsert: true });

    if (storageError) throw storageError;

    await authedQuery(context, async (tx) => {
      await tx.update(documents).set({
        storagePath: storageData.path,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: BigInt(file.size),
        status: 'on_file',
        validFrom: validFrom || null,
        expiryDate: expiryDate || null,
        uploadedById: context.userId,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(documents.id, documentId));

      await writeAudit({
        actorId: context.userId,
        action: 'document.upload',
        entityType: 'document',
        entityId: documentId,
        after: { fileName: file.name }
      }, tx);
    });

    if (unitId && projectId) revalidatePath(`/projects/${projectId}/units/${unitId}`);
    if (bookingId) revalidatePath(`/bookings/${bookingId}`);
    return { ok: true as const };
  } catch (err) {
    console.error('Failed to upload document:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}

export async function getSignedDocumentUrl(documentId: string) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };

  try {
    const doc = await authedQuery(context, async (tx) => {
      const [docRecord] = await tx.select().from(documents).where(eq(documents.id, documentId));
      return docRecord;
    });
    
    if (!doc || !doc.storagePath) {
      return { ok: false as const, code: 'NOT_FOUND' };
    }

    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(doc.storagePath, 60);

    if (error) throw error;

    await authedQuery(context, async (tx) => {
      await writeAudit({
        actorId: context.userId,
        action: 'document.view',
        entityType: 'document',
        entityId: documentId,
        after: null
      }, tx);
    });

    return { ok: true as const, data: data.signedUrl };
  } catch (err) {
    console.error('Failed to generate signed url:', err);
    return { ok: false as const, code: 'PERSIST_FAILED' };
  }
}
