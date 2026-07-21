'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { clients } from '@estate/db';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { maskPan, maskAadhaar } from '@estate/domain/clients/kyc';
import { writeAudit } from '@/server/audit';
import { revalidatePath } from 'next/cache';

const KycUpdateSchema = z.object({
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format").optional().or(z.literal('')),
  aadhaar: z.string().regex(/^\d{12}$/, "Invalid Aadhaar format").optional().or(z.literal(''))
});

export async function updateClientKyc(clientId: string, data: { pan?: string, aadhaar?: string }) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED' };
  
  const parsed = KycUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  return await authedQuery(context, async (tx) => {
    const [client] = await tx.select().from(clients).where(eq(clients.id, clientId));
    
    if (!client) {
      return { ok: false as const, code: 'NOT_FOUND', message: 'Client not found' };
    }

    const updates: Partial<typeof clients.$inferInsert> = {};
    
    if (parsed.data.pan) {
      updates.panMasked = maskPan(parsed.data.pan);
    }
    if (parsed.data.aadhaar) {
      updates.aadhaarMasked = maskAadhaar(parsed.data.aadhaar);
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await tx.update(clients).set(updates).where(eq(clients.id, clientId));

      await writeAudit({
        actorId: context.userId,
        action: 'client.kyc_update',
        entityType: 'client',
        entityId: clientId,
        before: { panMasked: client.panMasked, aadhaarMasked: client.aadhaarMasked },
        after: updates
      }, tx);
    }

    revalidatePath(`/bookings`);
    return { ok: true as const };
  });
}
