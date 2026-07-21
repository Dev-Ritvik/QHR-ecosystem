'use server';

import { z } from 'zod';
import { coreSchema as core } from '@estate/db';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { writeAudit } from '@/server/audit';
import { validateLedgerSign } from '@estate/domain/ledger/balance';
import { revalidatePath } from 'next/cache';
import { AppendLedgerSchema } from '@/lib/validation';

export async function appendLedgerEntry(data: z.infer<typeof AppendLedgerSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Unauthorized' };

  const parsed = AppendLedgerSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED', issues: parsed.error.flatten().fieldErrors };
  }

  const { bookingId, entryType, amountPaise, paidOn, mode, reference, note, reversesEntryId } = parsed.data;

  // Final sanity sign adjustment per NFR-D1
  const finalAmountPaise = validateLedgerSign(entryType, BigInt(amountPaise));

  try {
    await authedQuery(context, async (tx) => {
      const [row] = await tx.insert(core.paymentLedger).values({
        bookingId,
        entryType: entryType as any,
        amountPaise: finalAmountPaise,
        paidOn,
        mode: mode as any,
        reference: reference || null,
        note: note || null,
        reversesEntryId: reversesEntryId ? BigInt(reversesEntryId) : null,
        createdById: context.userId,
      }).returning();

      await writeAudit({
        actorId: context.userId,
        action: 'ledger.append',
        entityType: 'booking',
        entityId: bookingId,
        before: null,
        after: { entryId: row.id.toString(), type: entryType, amount: finalAmountPaise.toString() }
      }, tx);

      return row;
    });

    revalidatePath(`/bookings/${bookingId}`);
    return { ok: true as const };
  } catch (err: any) {
    console.error('Ledger append failed:', err);
    return { ok: false as const, code: 'PERSIST_FAILED', message: err.message || 'Failed to insert entry' };
  }
}
