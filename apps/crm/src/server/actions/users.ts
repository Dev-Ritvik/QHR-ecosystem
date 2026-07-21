'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { coreSchema as core } from '@estate/db';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { writeAudit } from '@/server/audit';
import { InviteUserSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';

export async function inviteUser(data: z.infer<typeof InviteUserSchema>) {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') {
    return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Owner access required' };
  }

  const parsed = InviteUserSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  try {
    await authedQuery(context, async (tx: any) => {
      const [newUser] = await tx.insert(core.users).values({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        role: parsed.data.role
      }).returning();

      await writeAudit({
        actorId: context.userId,
        action: 'user.invite',
        entityType: 'user',
        entityId: newUser.id,
        before: null,
        after: { name: newUser.name, phone: newUser.phone, role: newUser.role }
      }, tx);
    });

    revalidatePath('/settings/users');
    return { ok: true as const };
  } catch (err: any) {
    if (err.message?.includes('users_phone_live_uq')) {
      return { ok: false as const, code: 'PERSIST_FAILED', message: 'An active user with this phone number already exists.' };
    }
    return { ok: false as const, code: 'PERSIST_FAILED', message: err.message || 'Failed to invite user.' };
  }
}

export async function toggleUserStatus(userId: string, targetStatus: 'active' | 'deactivated') {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') {
    return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Owner access required' };
  }

  if (userId === context.userId) {
    return { ok: false as const, code: 'VALIDATION_FAILED', message: 'You cannot deactivate your own account.' };
  }

  await authedQuery(context, async (tx: any) => {
    const deactivatedAt = targetStatus === 'deactivated' ? new Date() : null;

    await tx.update(core.users)
      .set({ deactivatedAt, updatedAt: new Date() })
      .where(eq(core.users.id, userId));

    await writeAudit({
      actorId: context.userId,
      action: `user.${targetStatus}`,
      entityType: 'user',
      entityId: userId,
      before: { status: targetStatus === 'deactivated' ? 'active' : 'deactivated' },
      after: { status: targetStatus }
    }, tx);
  });

  revalidatePath('/settings/users');
  return { ok: true as const };
}
