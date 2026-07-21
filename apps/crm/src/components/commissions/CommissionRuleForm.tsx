'use client';

import { useState, useTransition } from 'react';
import { saveCommissionRule } from '@/server/actions/commissions';
import { TrancheSplit } from '@estate/domain/commissions/engine';

type CommissionRuleFormProps = {
  projectId?: string; // Omitting this makes it the office default rule
  initialRateBps?: number;
  initialSplit?: TrancheSplit;
};

export function CommissionRuleForm({ projectId, initialRateBps = 200, initialSplit = { token: 20, agreement: 30, registration: 50 } }: CommissionRuleFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const formData = new FormData(e.currentTarget);
    
    const rateBps = Number(formData.get('rateBps'));
    const token = Number(formData.get('token'));
    const agreement = Number(formData.get('agreement'));
    const registration = Number(formData.get('registration'));

    if (token + agreement + registration !== 100) {
      setError('Tranche splits must sum exactly to 100%');
      return;
    }

    startTransition(async () => {
      const res = await saveCommissionRule({
        projectId,
        rateBps,
        trancheSplit: { token, agreement, registration }
      });
      if (res.ok) setSuccess('Commission rule saved successfully.');
      else setError(res.issues ? 'Validation failed' : res.message || 'Error saving rule');
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md border rounded-md p-4 bg-card">
      <h3 className="font-medium text-lg border-b pb-2">
        {projectId ? 'Project Commission Override' : 'Office Default Commission Rule'}
      </h3>
      
      <div>
        <label className="block text-sm font-medium mb-1">Commission Rate (bps)</label>
        <div className="flex items-center space-x-2">
          <input type="number" name="rateBps" defaultValue={initialRateBps} min="0" max="10000" className="w-full border rounded-md p-2 text-sm" required />
          <span className="text-sm text-muted-foreground whitespace-nowrap">(100 bps = 1%)</span>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <label className="block text-sm font-medium">Tranche Splits (%)</label>
        <div className="flex items-center space-x-2">
          <span className="w-24 text-sm text-muted-foreground">Token</span>
          <input type="number" name="token" defaultValue={initialSplit.token} min="0" max="100" className="flex-1 border rounded-md p-2 text-sm" required />
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-24 text-sm text-muted-foreground">Agreement</span>
          <input type="number" name="agreement" defaultValue={initialSplit.agreement} min="0" max="100" className="flex-1 border rounded-md p-2 text-sm" required />
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-24 text-sm text-muted-foreground">Registration</span>
          <input type="number" name="registration" defaultValue={initialSplit.registration} min="0" max="100" className="flex-1 border rounded-md p-2 text-sm" required />
        </div>
      </div>

      {error && <p className="text-sm text-destructive font-medium">{error}</p>}
      {success && <p className="text-sm text-green-600 font-medium">{success}</p>}

      <button type="submit" disabled={isPending} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 w-full">
        {isPending ? 'Saving...' : 'Save Commission Rule'}
      </button>
    </form>
  );
}
