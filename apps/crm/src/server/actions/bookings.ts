'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { writeAudit } from '@/server/audit';
import { coreSchema as schema } from '@estate/db';
import { transition, TransitionPayload } from '@estate/domain/src/unit-status/machine';
import { findOrCreateClient } from './holds';
import {
  CreateBookingSchema,
  CancelBookingSchema,
  DefaultBookingSchema,
  ConvertBookingSchema,
} from '@/lib/validation';

export async function createBooking(data: z.infer<typeof CreateBookingSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: 'Unauthorized' };

  const parsed = CreateBookingSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid data', issues: parsed.error.flatten().fieldErrors };
  }

  const input = parsed.data;

  try {
    const result = await authedQuery(context, async (tx: any) => {
      // 1. Verify unit state
      const [unit] = await tx.select({ id: schema.units.id, status: schema.units.status, projectId: schema.units.projectId }).from(schema.units).where(eq(schema.units.id, input.unitId));
      if (!unit) throw new Error('Unit not found');

      // 1b. Resolve the buyer: existing client or find/create by phone
      const clientId = input.clientId
        ?? (await findOrCreateClient(context, tx, input.newClient!.name, input.newClient!.phone)).id;
      const agentId = input.agentId ?? context.userId;

      // 3. Release any active hold for this unit
      const [activeHold] = await tx
        .select()
        .from(schema.holds)
        .where(and(eq(schema.holds.unitId, input.unitId), eq(schema.holds.status, 'active')));
      
      let holdIdToLink = null;
      if (activeHold) {
        await tx
          .update(schema.holds)
          .set({ status: 'converted', releasedAt: new Date() })
          .where(eq(schema.holds.id, activeHold.id));
        holdIdToLink = activeHold.id;
      }

      // 4. Create the booking entity
      const [booking] = await tx.insert(schema.bookings).values({
        unitId: input.unitId,
        clientId,
        leadId: input.leadId || null,
        agentId,
        tokenAmountPaise: input.tokenAmountPaise,
        considerationPaise: input.considerationPaise || null,
        bookedOn: input.bookedOn,
        status: 'active',
      }).returning();

      // 2. Validate legal transition via domain state machine
      const domainResult = transition({
        fromStatus: unit.status,
        toStatus: 'booked',
        reason: 'Booking created',
        bookingId: booking.id,
        clientId,
        holdId: holdIdToLink,
        actorId: context.userId,
      } as TransitionPayload);
      
      if (!domainResult.ok) {
        throw new Error(domainResult.message || `Cannot transition unit from ${unit.status} to booked`);
      }

      // 5. Append transition event
      const [event] = await tx.insert(schema.unitStatusEvents).values({
        unitId: input.unitId,
        fromStatus: unit.status,
        toStatus: 'booked',
        reason: 'Booking created',
        bookingId: booking.id,
        holdId: holdIdToLink,
        clientId,
        actorId: context.userId,
      }).returning();

      // 6. Materialize unit status
      await tx
        .update(schema.units)
        .set({ status: 'booked', statusChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.units.id, input.unitId));

      // 7. Audit log — same transaction as the booking itself
      await writeAudit({
        action: 'booking.create',
        entityType: 'booking',
        entityId: booking.id,
        before: null,
        after: { bookingId: booking.id, unitId: input.unitId, eventId: event.id },
      }, tx);

      return { booking, event, unit };
    });

    revalidatePath(`/projects`);
    revalidatePath(`/projects/${result.unit.projectId}/units`);
    revalidatePath(`/projects/${result.unit.projectId}/units/${input.unitId}`);
    return { ok: true as const, bookingId: result.booking.id };
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to create booking' };
  }
}

export async function cancelBooking(data: z.infer<typeof CancelBookingSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: 'Unauthorized' };

  const parsed = CancelBookingSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid data', issues: parsed.error.flatten().fieldErrors };
  }

  try {
    const result = await authedQuery(context, async (tx: any) => {
      const [booking] = await tx.select().from(schema.bookings).where(eq(schema.bookings.id, parsed.data.bookingId));
      if (!booking) throw new Error('Booking not found');
      if (booking.status !== 'active') throw new Error('Only active bookings can be cancelled');

      const [unit] = await tx.select({ id: schema.units.id, status: schema.units.status, projectId: schema.units.projectId }).from(schema.units).where(eq(schema.units.id, booking.unitId));
      
      const domainResult = transition({
        fromStatus: unit.status,
        toStatus: 'available',
        reason: parsed.data.reason,
        actorId: context.userId,
      } as TransitionPayload);

      if (!domainResult.ok) throw new Error(domainResult.message || `Cannot transition unit from ${unit.status} to available`);

      await tx
        .update(schema.bookings)
        .set({ status: 'cancelled', cancelReason: parsed.data.reason, cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.bookings.id, booking.id));

      const [event] = await tx.insert(schema.unitStatusEvents).values({
        unitId: unit.id,
        fromStatus: unit.status,
        toStatus: 'available',
        reason: parsed.data.reason,
        bookingId: booking.id,
        actorId: context.userId,
      }).returning();

      await tx
        .update(schema.units)
        .set({ status: 'available', statusChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.units.id, unit.id));

      await writeAudit({
        action: 'booking.cancel',
        entityType: 'booking',
        entityId: parsed.data.bookingId,
        before: { status: 'active' },
        after: { status: 'cancelled', reason: parsed.data.reason, eventId: event.id },
      }, tx);

      return { booking, event, unit };
    });

    revalidatePath(`/projects`);
    revalidatePath(`/projects/${result.unit.projectId}/units`);
    revalidatePath(`/projects/${result.unit.projectId}/units/${result.unit.id}`);
    return { ok: true as const };
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to cancel booking' };
  }
}

export async function defaultBooking(data: z.infer<typeof DefaultBookingSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: 'Unauthorized' };

  const parsed = DefaultBookingSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid data', issues: parsed.error.flatten().fieldErrors };
  }

  try {
    const result = await authedQuery(context, async (tx: any) => {
      const [booking] = await tx.select().from(schema.bookings).where(eq(schema.bookings.id, parsed.data.bookingId));
      if (!booking) throw new Error('Booking not found');
      if (booking.status !== 'active') throw new Error('Only active bookings can be defaulted');

      const [unit] = await tx.select({ id: schema.units.id, status: schema.units.status, projectId: schema.units.projectId }).from(schema.units).where(eq(schema.units.id, booking.unitId));
      
      const domainResult = transition({
        fromStatus: unit.status,
        toStatus: 'available',
        reason: 'Booking defaulted',
        actorId: context.userId,
      } as TransitionPayload);

      if (!domainResult.ok) throw new Error(domainResult.message || `Cannot transition unit from ${unit.status} to available`);

      await tx
        .update(schema.bookings)
        .set({ status: 'defaulted', defaultedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.bookings.id, booking.id));

      const [event] = await tx.insert(schema.unitStatusEvents).values({
        unitId: unit.id,
        fromStatus: unit.status,
        toStatus: 'available',
        reason: 'Booking defaulted',
        bookingId: booking.id,
        actorId: context.userId,
      }).returning();

      await tx
        .update(schema.units)
        .set({ status: 'available', statusChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.units.id, unit.id));

      await writeAudit({
        action: 'booking.default',
        entityType: 'booking',
        entityId: parsed.data.bookingId,
        before: { status: 'active' },
        after: { status: 'defaulted', eventId: event.id },
      }, tx);

      return { booking, event, unit };
    });

    revalidatePath(`/projects`);
    revalidatePath(`/projects/${result.unit.projectId}/units`);
    revalidatePath(`/projects/${result.unit.projectId}/units/${result.unit.id}`);
    return { ok: true as const };
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to default booking' };
  }
}

export async function convertBooking(data: z.infer<typeof ConvertBookingSchema>) {
  const context = await getRoleContext();
  if (!context) return { ok: false as const, message: 'Unauthorized' };

  const parsed = ConvertBookingSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, message: 'Invalid data', issues: parsed.error.flatten().fieldErrors };
  }

  try {
    const result = await authedQuery(context, async (tx: any) => {
      const [booking] = await tx.select().from(schema.bookings).where(eq(schema.bookings.id, parsed.data.bookingId));
      if (!booking) throw new Error('Booking not found');
      if (booking.status !== 'active') throw new Error('Only active bookings can be converted');

      const [unit] = await tx.select({ id: schema.units.id, status: schema.units.status, projectId: schema.units.projectId }).from(schema.units).where(eq(schema.units.id, booking.unitId));
      
      const domainResult = transition({
        fromStatus: unit.status,
        toStatus: 'registered',
        reason: 'Registration completed',
        actorId: context.userId,
      } as TransitionPayload);

      if (!domainResult.ok) throw new Error(domainResult.message || `Cannot transition unit from ${unit.status} to registered`);

      await tx
        .update(schema.bookings)
        .set({ status: 'converted', registeredOn: parsed.data.registeredOn, updatedAt: new Date() })
        .where(eq(schema.bookings.id, booking.id));

      const [event] = await tx.insert(schema.unitStatusEvents).values({
        unitId: unit.id,
        fromStatus: unit.status,
        toStatus: 'registered',
        reason: 'Registration completed',
        bookingId: booking.id,
        actorId: context.userId,
      }).returning();

      await tx
        .update(schema.units)
        .set({ status: 'registered', statusChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.units.id, unit.id));

      await writeAudit({
        action: 'booking.convert',
        entityType: 'booking',
        entityId: parsed.data.bookingId,
        before: { status: 'active' },
        after: { status: 'converted', registeredOn: parsed.data.registeredOn, eventId: event.id },
      }, tx);

      return { booking, event, unit };
    });

    revalidatePath(`/projects`);
    revalidatePath(`/projects/${result.unit.projectId}/units`);
    revalidatePath(`/projects/${result.unit.projectId}/units/${result.unit.id}`);
    return { ok: true as const };
  } catch (error: any) {
    return { ok: false as const, message: error.message || 'Failed to convert booking' };
  }
}
