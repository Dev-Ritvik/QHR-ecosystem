'use client';

import { useState, useTransition } from 'react';
import { overrideCommissionEntry } from '@/server/actions/commissions';
import { formatPaise } from '@estate/domain/money/format';

type OverrideCommissionDialogProps = {
  entryId: string;
  currentEffectivePaise: string;
  isOpen: boolean;
  onClose: () => void;
};

export function OverrideCommissionDialog({ entryId, currentEffectivePaise, isOpen, onClose }: OverrideCommissionDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  
  const [amountRupees, setAmountRupees] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!reason || reason.length < 3) {
      setError('A descriptive reason is required.');
      return;
    }

    startTransition(async () => {
      const res = await overrideCommissionEntry({
        entryId,
        overriddenAmountPaise: Math.round(Number(amountRupees) * 100),
        reason
      });

      if (res.ok) {
        setAmountRupees('');
        setReason('');
        onClose();
      } else {
        setError(res.message || 'Failed to apply override');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-1">Override Commission</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Current Amount: <span className="font-medium text-foreground">{formatPaise(BigInt(currentEffectivePaise))}</span>
        </p>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">New Amount (₹)</label>
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
            <label className="block text-sm font-medium mb-1">Reason (Mandatory)</label>
            <textarea 
              required 
              rows={3}
              placeholder="E.g., Adjusted per owner approval for extra marketing spend..." 
              className="w-full border p-2 rounded-md text-sm"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isPending}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Apply Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
