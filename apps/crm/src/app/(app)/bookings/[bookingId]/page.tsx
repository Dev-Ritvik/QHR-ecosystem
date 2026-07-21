import { notFound, redirect } from 'next/navigation';
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { formatPaise } from '@estate/domain/money/format';
import { KycForm } from '@/components/clients/KycForm';
import { DocumentChecklist } from '@/components/documents/DocumentChecklist';
import { SyncChecklistButton } from '@/components/documents/SyncChecklistButton';
import { CancelBookingButton } from '@/components/bookings/CancelBookingButton';
import { BookingLedger } from '@/components/ledger/BookingLedger';
import { CommissionEntriesTable } from '@/components/commissions/CommissionEntriesTable';
import { resolveEffectiveCommission } from '@estate/domain/commissions/override';
import { format } from 'date-fns';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { coreSchema as core } from '@estate/db';

export default async function BookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const context = await getRoleContext();
  if (!context) redirect("/login");

  const booking = await authedQuery(context, async (tx: any) => {
    return tx.query.bookings.findFirst({
      where: eq(core.bookings.id, bookingId),
      with: {
        client: true,
        unit: {
          with: { project: true }
        },
        agent: true
      }
    });
  });

  if (!booking) notFound();

  const ledgerEntries = await authedQuery(context, async (tx: any) => {
    return tx.query.paymentLedger.findMany({
      where: eq(core.paymentLedger.bookingId, bookingId),
      orderBy: (l: any, { asc }: any) => [asc(l.paidOn), asc(l.id)],
    });
  });

  // Existing checklist rows — without these the checklists below always
  // render "No documents synced yet" even when files are on file.
  const { bookingDocs, clientDocs } = await authedQuery(context, async (tx: any) => {
    const bookingDocs = await tx.select().from(core.documents).where(and(
      eq(core.documents.bookingId, bookingId),
      eq(core.documents.scope, 'booking'),
      isNull(core.documents.archivedAt)
    ));
    const clientDocs = await tx.select().from(core.documents).where(and(
      eq(core.documents.clientId, booking.clientId),
      eq(core.documents.scope, 'client'),
      isNull(core.documents.archivedAt)
    ));
    return { bookingDocs, clientDocs };
  });

  const serializedLedger = ledgerEntries.map((e: any) => ({
    id: e.id.toString(),
    entryType: e.entryType,
    amountPaise: e.amountPaise.toString(),
    paidOn: format(new Date(e.paidOn), 'yyyy-MM-dd'),
    mode: e.mode,
    reference: e.reference,
    note: e.note,
    reversesEntryId: e.reversesEntryId?.toString()
  }));

  // NFR-S3: Owner sees all commissions, agents only see their own.
  // We strictly gate the entire commission component visibility to owners.
  const isOwner = context.role === 'owner';
  let serializedCommissions: any[] = [];
  
  if (isOwner) {
    const commissionEntries = await authedQuery(context, async (tx: any) => {
      return tx.query.commissionEntries.findMany({
        where: and(eq(core.commissionEntries.bookingId, bookingId), isNull(core.commissionEntries.voidedAt)),
        orderBy: (c: any, { asc }: any) => [asc(c.createdAt)]
      });
    });

    const entryIds = commissionEntries.map((e: any) => e.id);
    const overrides = entryIds.length > 0 
      ? await authedQuery(context, async (tx: any) => {
          return tx.query.commissionOverrides.findMany({
            where: inArray(core.commissionOverrides.entryId, entryIds)
          });
        })
      : [];

    serializedCommissions = commissionEntries.map((c: any) => {
      const entryOverrides = overrides.filter((o: any) => o.entryId === c.id);
      const { effectiveAmountPaise, isOverridden } = resolveEffectiveCommission(c.computedAmountPaise, entryOverrides);

      return {
        id: c.id,
        payeeType: c.payeeType,
        payeeName: c.payeeName || (c.payeeUserId === booking.agentId ? booking.agent.name : null),
        tranche: c.tranche,
        basisAmountPaise: c.basisAmountPaise.toString(),
        computedAmountPaise: c.computedAmountPaise.toString(),
        effectiveAmountPaise: effectiveAmountPaise.toString(),
        isOverridden,
        status: c.status,
        paidOn: c.paidOn,
        paymentReference: c.paymentReference
      };
    });
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deal & Booking Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Unit {booking.unit.unitNumber} • {booking.unit.project.name}
          </p>
        </div>
        <div className="text-right space-y-2">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
              {booking.status}
            </span>
            <p className="text-sm text-muted-foreground mt-1">Booked on {format(new Date(booking.bookedOn), 'MMM d, yyyy')}</p>
          </div>
          {booking.status === 'active' && (
            <CancelBookingButton bookingId={booking.id} unitNumber={booking.unit.unitNumber} />
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-lg bg-card">
        <div>
          <p className="text-sm text-muted-foreground font-medium">Client</p>
          <p className="font-medium mt-1">{booking.client.name}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground font-medium">Token Paid</p>
          <p className="font-medium mt-1">{formatPaise(booking.tokenAmountPaise)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground font-medium">Consideration</p>
          <p className="font-medium mt-1">
            {booking.considerationPaise ? formatPaise(booking.considerationPaise) : 'TBD'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground font-medium">Agent of Record</p>
          <p className="font-medium mt-1">{booking.agent.name}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h2 className="text-lg font-medium border-b pb-2">Client Identity (KYC)</h2>
          <KycForm 
            clientId={booking.clientId} 
            panMasked={booking.client.panMasked} 
            aadhaarMasked={booking.client.aadhaarMasked} 
          />
          <div className="pt-4">
            <h3 className="text-sm font-medium mb-3">Client KYC Documents</h3>
            <DocumentChecklist scope="client" clientId={booking.clientId} existingDocs={clientDocs} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-lg font-medium">Deal Documents</h2>
            <SyncChecklistButton bookingId={booking.id} />
          </div>
          <DocumentChecklist scope="booking" bookingId={booking.id} existingDocs={bookingDocs} />
        </section>
      </div>

      <section className="space-y-4 pt-8 border-t">
        <h2 className="text-lg font-medium">Payment Ledger</h2>
        <BookingLedger bookingId={booking.id} entries={serializedLedger} />
      </section>

      {/* NFR-S3: Owner-only visibility for commission tracking */}
      {isOwner && (
        <section className="space-y-4 pt-8 border-t">
          <h2 className="text-lg font-medium text-amber-900">Commission Overview (Owner Only)</h2>
          <CommissionEntriesTable bookingId={booking.id} entries={serializedCommissions} isOwner={isOwner} />
        </section>
      )}
    </div>
  );
}
