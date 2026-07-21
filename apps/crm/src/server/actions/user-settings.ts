'use server';

import { z } from 'zod';
import { authedQuery } from '../db';
import { getRoleContext } from '../session';
import { userSettings } from '@estate/db/schema/core/user-settings';
import { UserSettingsSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';

export async function updateUserSettings(data: z.infer<typeof UserSettingsSchema>) {
  const context = await getRoleContext();
  if (!context) {
    return { ok: false as const, code: 'UNAUTHENTICATED' };
  }
  
  const parsed = UserSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED' };
  }
  
  await authedQuery(context, async (tx) => {
    await tx.insert(userSettings)
      .values({ 
        userId: context.userId, 
        emailDigest: parsed.data.emailDigest 
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { 
          emailDigest: parsed.data.emailDigest, 
          updatedAt: new Date() 
        }
      });
  });
    
  revalidatePath('/profile');
  return { ok: true as const };
}
