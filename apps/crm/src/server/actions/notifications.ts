'use server';

import { authedQuery } from '../db';
import { getRoleContext } from '../session';
import { notifications } from '@estate/db';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getUnreadNotifications() {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, error: 'Unauthorized' };
  
  return await authedQuery(context, async (tx) => {
    const notifs = await tx.select()
      .from(notifications)
      .where(and(eq(notifications.userId, context.userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
      
    return { ok: true as const, data: notifs };
  });
}

export async function markNotificationAsRead(id: string) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, error: 'Unauthorized' };
  
  await authedQuery(context, async (tx) => {
    await tx.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, context.userId)));
  });
    
  revalidatePath('/dashboard');
  return { ok: true as const };
}

export async function markAllNotificationsAsRead() {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, error: 'Unauthorized' };
  
  await authedQuery(context, async (tx) => {
    await tx.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, context.userId), eq(notifications.isRead, false)));
  });
    
  revalidatePath('/dashboard');
  return { ok: true as const };
}
