'use server';

import { documents, bookings } from '@estate/db';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { getBookingChecklist, getClientChecklist, DEAL_DOCUMENT_TITLES } from '@estate/domain/documents/deals';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function syncDealDocuments(bookingId: string) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Not authenticated' };

  return await authedQuery(context, async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
    
    if (!booking) {
      return { ok: false as const, code: 'NOT_FOUND', message: 'Booking not found' };
    }

    const bookingDocsList = getBookingChecklist(booking.tdsApplicable ?? false);
    const clientDocsList = getClientChecklist();

    const existingBookingDocs = await tx.select().from(documents).where(
      and(eq(documents.scope, 'booking'), eq(documents.bookingId, bookingId))
    );
    
    const existingClientDocs = await tx.select().from(documents).where(
      and(eq(documents.scope, 'client'), eq(documents.clientId, booking.clientId))
    );

    const existingBKeys = new Set(existingBookingDocs.map(d => d.checklistKey));
    const existingCKeys = new Set(existingClientDocs.map(d => d.checklistKey));

    const toInsert = [];
    
    for (const key of bookingDocsList) {
      if (!existingBKeys.has(key)) {
        toInsert.push({
          scope: 'booking' as const,
          bookingId: booking.id,
          checklistKey: key,
          title: DEAL_DOCUMENT_TITLES[key] || key,
          status: 'missing' as const
        });
      }
    }
    
    for (const key of clientDocsList) {
      if (!existingCKeys.has(key)) {
        toInsert.push({
          scope: 'client' as const,
          clientId: booking.clientId,
          checklistKey: key,
          title: DEAL_DOCUMENT_TITLES[key] || key,
          status: 'missing' as const
        });
      }
    }

    if (toInsert.length > 0) {
      await tx.insert(documents).values(toInsert);
    }

    revalidatePath(`/bookings/${bookingId}`);
    return { ok: true as const };
  });
}
