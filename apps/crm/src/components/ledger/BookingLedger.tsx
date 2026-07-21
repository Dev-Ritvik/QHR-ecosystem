'use client';

import { useState, useTransition } from 'react';
import { formatPaise } from '@estate/domain/money/format';
import { computeRunningBalances } from '@estate/domain/ledger/balance';
import { appendLedgerEntry } from '@/server/actions/ledger';
import { format } from 'date-fns';

type SerializedEntry = {
  id: string;
  entryType: string;
  amountPaise: string;
  paidOn: string;
  mode: string;
  reference?: string | null;
  note?: string | null;
  reversesEntryId?: string | null;
};

export function BookingLedger({ bookingId, entries }: { bookingId: string, entries: SerializedEntry[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  
  const [type, setType] = useState('installment');
  const [amountRupees, setAmountRupees] = useState('');
  const [paidOn, setPaidOn] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mode, setMode] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [reversesEntryId, setReversesEntryId] = useState('');

  // Hydrate bigints for domain calculations
  const mapped = entries.map(e => ({
    ...e,
    id: BigInt(e.id),
    amountPaise: BigInt(e.amountPaise)
  }));
  
  const withBalances = computeRunningBalances(mapped);

  const handleReverse = (id: bigint, amount: bigint) => {
    setType('reversal');
    setReversesEntryId(id.toString());
    setAmountRupees((Math.abs(Number(amount)) / 100).toString());
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    startTransition(async () => {
      const res = await appendLedgerEntry({
        bookingId,
        entryType: type as any,
        amountPaise: Math.round(Number(amountRupees) * 100),
        paidOn,
        mode: mode as any,
        reference: reference || undefined,
        note: note || undefined,
        reversesEntryId: reversesEntryId || undefined
      });
      
      if (res.ok) {
        setAmountRupees('');
        setReference('');
        setNote('');
        setReversesEntryId('');
        setType('installment');
      } else {
        setError(res.message || 'Validation failed');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Date / ID</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Mode & Ref</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium text-right">Running Balance</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {withBalances.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No ledger entries yet</td></tr>
            ) : withBalances.map(entry => (
              <tr key={entry.id.toString()}>
                <td className="px-4 py-3">
                  <div>{format(new Date(entry.paidOn), 'MMM d, yyyy')}</div>
                  <div className="text-xs text-muted-foreground">ID: {entry.id.toString()}</div>
                </td>
                <td className="px-4 py-3 capitalize">
                  {entry.entryType}
                  {entry.reversesEntryId && <span className="block text-xs text-muted-foreground">Reverses #{entry.reversesEntryId}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="capitalize">{entry.mode.replace('_', ' ')}</div>
                  {entry.reference && <div className="text-xs text-muted-foreground">{entry.reference}</div>}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${entry.amountPaise < 0n ? 'text-destructive' : 'text-green-600'}`}>
                  {formatPaise(entry.amountPaise)}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatPaise(entry.runningBalancePaise)}
                </td>
                <td className="px-4 py-3 text-right">
                  {entry.entryType !== 'reversal' && entry.amountPaise > 0n && (
                    <button 
                      onClick={() => handleReverse(entry.id, entry.amountPaise)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Reverse
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleSubmit} className="border p-4 rounded-md bg-card space-y-4 max-w-3xl">
        <h3 className="font-medium border-b pb-2">Append New Entry</h3>
        {error && <p className="text-sm text-destructive">{error}</p>}
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Entry Type</label>
            <select className="w-full border p-2 rounded-md text-sm" value={type} onChange={e => setType(e.target.value)}>
              <option value="token">Token</option>
              <option value="installment">Installment</option>
              <option value="registration">Registration</option>
              <option value="refund">Refund</option>
              <option value="reversal">Reversal (Correction)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium mb-1">Amount (₹)</label>
            <input 
              type="number" 
              min="0" 
              step="0.01" 
              required 
              className="w-full border p-2 rounded-md text-sm"
              value={amountRupees}
              onChange={e => setAmountRupees(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Date Paid</label>
            <input 
              type="date" 
              required 
              className="w-full border p-2 rounded-md text-sm"
              value={paidOn}
              onChange={e => setPaidOn(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium mb-1">Payment Mode</label>
            <select className="w-full border p-2 rounded-md text-sm" value={mode} onChange={e => setMode(e.target.value)}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="dd">DD</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Reference (Optional)</label>
            <input 
              type="text" 
              placeholder="UTR / Cheque No" 
              className="w-full border p-2 rounded-md text-sm"
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
          </div>

          {type === 'reversal' && (
            <div>
              <label className="block text-xs font-medium mb-1 text-destructive">Reverses Entry ID</label>
              <input 
                type="number" 
                required 
                placeholder="Entry ID" 
                className="w-full border-destructive p-2 rounded-md text-sm"
                value={reversesEntryId}
                onChange={e => setReversesEntryId(e.target.value)}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Note (Optional)</label>
          <input 
            type="text" 
            placeholder="Description" 
            className="w-full border p-2 rounded-md text-sm"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {isPending ? 'Appending...' : 'Append to Ledger'}
        </button>
      </form>
    </div>
  );
}
