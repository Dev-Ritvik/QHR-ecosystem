'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { writeAudit } from '@/server/audit';
import { officeSettings } from '@estate/db/schema/core/office-settings';
import { OfficeSettingsSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';

export async function updateOfficeSettings(data: z.infer<typeof OfficeSettingsSchema>) {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') {
    return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Owner access required' };
  }

  const parsed = OfficeSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  await authedQuery(context, async (tx: any) => {
    const currentSettings = await tx.select().from(officeSettings).limit(1);
    
    await tx.update(officeSettings)
      .set({
        ...parsed.data,
        updatedAt: new Date()
      })
      .where(eq(officeSettings.id, true));

    await writeAudit({
      actorId: context.userId,
      action: 'office_settings.update',
      entityType: 'office_settings',
      entityId: 'global',
      before: currentSettings[0] || null,
      after: parsed.data
    }, tx);
  });

  revalidatePath('/settings');
  return { ok: true as const };
}
