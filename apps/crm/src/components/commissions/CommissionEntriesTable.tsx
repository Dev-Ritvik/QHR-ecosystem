'use client';

import { useState, useTransition } from 'react';
import { formatPaise } from '@estate/domain/money/format';
import { generateCommissionEntries, updateCommissionEntryStatus } from '@/server/actions/commissions';
import { format } from 'date-fns';
import { OverrideCommissionDialog } from './OverrideCommissionDialog';

type SerializedEntry = {
  id: string;
  payeeType: string;
  payeeName: string | null;
  tranche: string;
  basisAmountPaise: string;
  computedAmountPaise: string;
  effectiveAmountPaise: string;
  isOverridden: boolean;
  status: string;
  paidOn: string | null;
  paymentReference: string | null;
};

export function CommissionEntriesTable({ bookingId, entries, isOwner }: { bookingId: string, entries: SerializedEntry[], isOwner: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState('');
  
  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusVal, setStatusVal] = useState('due');
  const [paidOnVal, setPaidOnVal] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [refVal, setRefVal] = useState('');

  // Override Dialog state
  const [overrideTarget, setOverrideTarget] = useState<{ id: string, effectiveAmount: string } | null>(null);

  const handleGenerate = () => {
    setActionError('');
    startTransition(async () => {
      const res = await generateCommissionEntries(bookingId);
      if (!res.ok) setActionError(res.message || 'Generation failed');
    });
  };

  const handleSaveStatus = (entryId: string) => {
    setActionError('');
    startTransition(async () => {
      const res = await updateCommissionEntryStatus({
        entryId,
        status: statusVal as any,
        paidOn: statusVal === 'paid' ? paidOnVal : undefined,
        paymentReference: refVal || undefined
      });
      if (res.ok) setEditingId(null);
      else setActionError(res.message || 'Failed to update status');
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-lg">Commission Accruals</h3>
        {isOwner && (
          <button 
            onClick={handleGenerate} 
            disabled={isPending}
            className="text-sm bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Processing...' : 'Compute / Generate Entries'}
          </button>
        )}
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Tranche</th>
              <th className="px-4 py-3 font-medium">Payee</th>
              <th className="px-4 py-3 font-medium text-right">Basis Amt</th>
              <th className="px-4 py-3 font-medium text-right">Final Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {isOwner && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.length === 0 ? (
              <tr><td colSpan={isOwner ? 6 : 5} className="px-4 py-6 text-center text-muted-foreground">No commission entries generated yet</td></tr>
            ) : entries.map(entry => (
              <tr key={entry.id}>
                <td className="px-4 py-3 capitalize">{entry.tranche}</td>
                <td className="px-4 py-3">
                  <div className="capitalize">{entry.payeeType.replace('_', ' ')}</div>
                  {entry.payeeName && <div className="text-xs text-muted-foreground">{entry.payeeName}</div>}
                </td>
                <td className="px-4 py-3 text-right">{formatPaise(BigInt(entry.basisAmountPaise))}</td>
                <td className="px-4 py-3 text-right">
                  {entry.isOverridden && (
                    <div className="text-xs line-through text-muted-foreground mb-1">
                      {formatPaise(BigInt(entry.computedAmountPaise))}
                    </div>
                  )}
                  <div className={`font-medium ${entry.isOverridden ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatPaise(BigInt(entry.effectiveAmountPaise))}
                  </div>
                  {entry.isOverridden && <span className="text-[10px] uppercase text-amber-600 font-semibold tracking-wider">Overridden</span>}
                </td>
                <td className="px-4 py-3">
                  {editingId === entry.id ? (
                    <div className="flex flex-col space-y-2 w-48">
                      <select className="border p-1 rounded text-xs" value={statusVal} onChange={e => setStatusVal(e.target.value)}>
                        <option value="accrued">Accrued</option>
                        <option value="due">Due</option>
                        <option value="paid">Paid</option>
                        <option value="voided">Voided</option>
                      </select>
                      {statusVal === 'paid' && (
                        <>
                          <input type="date" className="border p-1 rounded text-xs" value={paidOnVal} onChange={e => setPaidOnVal(e.target.value)} />
                          <input type="text" placeholder="Ref / UTR" className="border p-1 rounded text-xs" value={refVal} onChange={e => setRefVal(e.target.value)} />
                        </>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize 
                        ${entry.status === 'paid' ? 'bg-green-100 text-green-800' : 
                          entry.status === 'due' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                        {entry.status}
                      </span>
                      {entry.paidOn && <div className="text-xs text-muted-foreground mt-1">Paid: {format(new Date(entry.paidOn), 'MMM d, yy')}</div>}
                      {entry.paymentReference && <div className="text-xs text-muted-foreground">Ref: {entry.paymentReference}</div>}
                    </div>
                  )}
                </td>
                {isOwner && (
                  <td className="px-4 py-3 text-right align-top">
                    {editingId === entry.id ? (
                      <div className="space-x-2">
                        <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                        <button onClick={() => handleSaveStatus(entry.id)} disabled={isPending} className="text-xs text-primary font-medium hover:underline">Save</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end space-y-2">
                        <button onClick={() => {
                          setEditingId(entry.id);
                          setStatusVal(entry.status);
                          setPaidOnVal(entry.paidOn || format(new Date(), 'yyyy-MM-dd'));
                          setRefVal(entry.paymentReference || '');
                        }} className="text-xs text-muted-foreground hover:underline">
                          Edit Status
                        </button>
                        <button 
                          onClick={() => setOverrideTarget({ id: entry.id, effectiveAmount: entry.effectiveAmountPaise })} 
                          className="text-xs text-amber-600 hover:underline"
                        >
                          Override Amount
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overrideTarget && (
        <OverrideCommissionDialog 
          isOpen={true} 
          onClose={() => setOverrideTarget(null)}
          entryId={overrideTarget.id}
          currentEffectivePaise={overrideTarget.effectiveAmount}
        />
      )}
    </div>
  );
}
