'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBooking, convertBooking } from '@/server/actions/bookings';
import { transitionUnitStatusAction } from '@/server/actions/units';
import { syncDealDocuments } from '@/server/actions/deal-documents';
import { rupeesToPaise } from '@estate/domain/money/paise';
import { Button } from '@/components/ui/button';

type ClientOption = { id: string; name: string; phone: string };
type AgentOption = { id: string; name: string };

interface BookUnitDialogProps {
  unitId: string;
  unitStatus: string;
  clients: ClientOption[];
  agents: AgentOption[];
  defaultAgentId: string;
}

/**
 * Detailed Booked / Sold Out form (owner request): captures buyer, agent,
 * token amount, booking date and sale price, creates the REAL booking via
 * the existing createBooking action (same audit trail and commission basis),
 * then materialises the deal-document checklist for uploads on the unit page.
 * "Sold Out" additionally walks the legal chain booked → registered → sold.
 */
export function BookUnitDialog({ unitId, unitStatus, clients, agents, defaultAgentId }: BookUnitDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newClientMode, setNewClientMode] = useState(clients.length === 0);

  // Booking is only enterable from these states (state machine)
  const canBook = ['available', 'on_hold', 'mortgage'].includes(unitStatus);
  if (!canBook) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const mode = fd.get('mode') as 'booked' | 'sold';
    const bookedOn = fd.get('bookedOn') as string;

    let tokenPaise: bigint;
    let salePaise: bigint | undefined;
    try {
      tokenPaise = rupeesToPaise(fd.get('tokenAmountRupees') as string);
      const saleRaw = (fd.get('salePriceRupees') as string)?.trim();
      salePaise = saleRaw ? rupeesToPaise(saleRaw) : undefined;
    } catch (err: any) {
      setError(err.message);
      return;
    }

    const payload: any = {
      unitId,
      agentId: fd.get('agentId'),
      tokenAmountPaise: tokenPaise.toString(),
      ...(salePaise ? { considerationPaise: salePaise.toString() } : {}),
      bookedOn,
    };
    if (newClientMode) {
      payload.newClient = { name: fd.get('clientName'), phone: fd.get('clientPhone') };
    } else {
      payload.clientId = fd.get('clientId');
    }

    startTransition(async () => {
      const res = await createBooking(payload);
      if (!res.ok) {
        setError(res.message || 'Failed to create booking');
        return;
      }

      // Materialise the deal-document checklist so uploads are available
      await syncDealDocuments(res.bookingId);

      if (mode === 'sold') {
        // Legal chain: booked -> registered (convert) -> sold
        const conv = await convertBooking({ bookingId: res.bookingId, registeredOn: bookedOn });
        if (!conv.ok) {
          setError(`Booked, but marking sold failed at registration: ${conv.message}`);
          router.refresh();
          return;
        }
        const soldRes = await transitionUnitStatusAction(unitId, 'sold', { reason: 'Marked Sold Out via booking form', bookingId: res.bookingId });
        if (!soldRes.ok) {
          setError(`Registered, but final sold transition failed: ${soldRes.message}`);
          router.refresh();
          return;
        }
      }

      setIsOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Mark Booked / Sold</Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Book / Sell This Unit</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="mode" value="booked" defaultChecked /> Booked / Advance Paid
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="mode" value="sold" /> Sold Out
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Buyer</label>
                  {clients.length > 0 && (
                    <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setNewClientMode(m => !m)}>
                      {newClientMode ? 'Choose existing client' : '+ New client'}
                    </button>
                  )}
                </div>
                {newClientMode ? (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input name="clientName" required placeholder="Buyer name" className="rounded-md border border-gray-300 p-2 text-sm" />
                    <input name="clientPhone" required placeholder="+919876543210" className="rounded-md border border-gray-300 p-2 text-sm" />
                  </div>
                ) : (
                  <select name="clientId" required className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm">
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Agent Responsible</label>
                <select name="agentId" required defaultValue={defaultAgentId} className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm">
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Token / Booking Amount (₹) *</label>
                  <input name="tokenAmountRupees" type="number" step="0.01" min="0" required className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Booking Date *</label>
                  <input name="bookedOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Sale Price (₹)</label>
                <p className="text-xs text-gray-500">Leave blank to keep the computed list price. Also the basis for commissions.</p>
                <input name="salePriceRupees" type="number" step="0.01" min="0" className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm" />
              </div>

              <p className="text-xs text-gray-500 bg-gray-50 border rounded p-2">
                After saving, the deal-document checklist (agreement, ID proof, payment receipt, …)
                appears on this unit&rsquo;s page for uploads.
              </p>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                  Cancel
                </button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
