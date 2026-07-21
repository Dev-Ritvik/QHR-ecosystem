// apps/crm/src/server/actions/export.ts
'use server';

import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { writeAudit } from '@/server/audit';
import { leads, bookings, paymentLedger, type CoreTransaction } from '@estate/db';
import { isNull, desc } from 'drizzle-orm';
import { format } from 'date-fns';

function generateCSV(data: Record<string, any>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => 
    headers.map(header => {
      const val = obj[header];
      const strVal = val === null || val === undefined ? '' : String(val);
      // Escape quotes by doubling them, wrap in quotes
      return `"${strVal.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export async function exportLeadsCSV() {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') {
    return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Owner access required' };
  }

  return await authedQuery(context, async (tx: CoreTransaction) => {
    const data = await tx.query.leads.findMany({
      where: isNull(leads.archivedAt),
      with: { assignedAgent: true },
      orderBy: [desc(leads.createdAt)]
    });

    const flatData = data.map((l: any) => ({
      LeadID: l.id,
      Name: l.name,
      Phone: l.phone,
      Email: l.email || '',
      Source: l.source,
      Stage: l.stage,
      AssignedAgent: l.assignedAgent?.name || 'Unassigned',
      NextFollowUp: l.nextFollowUpAt ? format(new Date(l.nextFollowUpAt), 'yyyy-MM-dd HH:mm:ss') : '',
      CreatedAt: format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm:ss')
    }));

    const csv = generateCSV(flatData);

    await writeAudit({
      actorId: context.userId,
      action: 'export.leads',
      entityType: 'export',
      entityId: 'leads',
      before: null,
      after: { rowCount: data.length, format: 'csv' }
    }, tx);

    return { ok: true as const, data: csv, filename: `leads_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv` };
  });
}

export async function exportDealsCSV() {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') {
    return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Owner access required' };
  }

  return await authedQuery(context, async (tx: CoreTransaction) => {
    const data = await tx.query.bookings.findMany({
      with: {
        client: true,
        agent: true,
        unit: { with: { project: true } }
      },
      orderBy: [desc(bookings.createdAt)]
    });

    const flatData = data.map((b: any) => ({
      BookingID: b.id,
      Project: b.unit?.project?.name,
      UnitNumber: b.unit?.unitNumber,
      ClientName: b.client?.name,
      ClientPhone: b.client?.phone,
      AgentName: b.agent?.name,
      Status: b.status,
      TokenAmountRupees: (Number(b.tokenAmountPaise) / 100).toFixed(2),
      ConsiderationRupees: b.considerationPaise ? (Number(b.considerationPaise) / 100).toFixed(2) : '',
      BookedOn: b.bookedOn,
      RegisteredOn: b.registeredOn || '',
      CreatedAt: format(new Date(b.createdAt), 'yyyy-MM-dd HH:mm:ss')
    }));

    const csv = generateCSV(flatData);

    await writeAudit({
      actorId: context.userId,
      action: 'export.deals',
      entityType: 'export',
      entityId: 'deals',
      before: null,
      after: { rowCount: data.length, format: 'csv' }
    }, tx);

    return { ok: true as const, data: csv, filename: `deals_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv` };
  });
}

export async function exportLedgerCSV() {
  const context = await getRoleContext();
  if (!context || context.role !== 'owner') {
    return { ok: false as const, code: 'UNAUTHENTICATED', message: 'Owner access required' };
  }

  return await authedQuery(context, async (tx: CoreTransaction) => {
    const data = await tx.query.paymentLedger.findMany({
      with: {
        booking: { with: { unit: { with: { project: true } }, client: true } }
      },
      orderBy: [desc(paymentLedger.createdAt)]
    });

    const flatData = data.map((l: any) => ({
      EntryID: l.id.toString(),
      BookingID: l.bookingId,
      Project: l.booking?.unit?.project?.name,
      UnitNumber: l.booking?.unit?.unitNumber,
      ClientName: l.booking?.client?.name,
      EntryType: l.entryType,
      AmountRupees: (Number(l.amountPaise) / 100).toFixed(2),
      PaidOn: l.paidOn,
      Mode: l.mode,
      Reference: l.reference || '',
      ReversesEntryID: l.reversesEntryId?.toString() || '',
      CreatedAt: format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm:ss')
    }));

    const csv = generateCSV(flatData);

    await writeAudit({
      actorId: context.userId,
      action: 'export.ledger',
      entityType: 'export',
      entityId: 'ledger',
      before: null,
      after: { rowCount: data.length, format: 'csv' }
    }, tx);

    return { ok: true as const, data: csv, filename: `ledger_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv` };
  });
}
