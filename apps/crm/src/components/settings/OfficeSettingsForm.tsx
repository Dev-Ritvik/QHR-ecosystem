'use client';

import { useState, useTransition } from 'react';
import { updateOfficeSettings } from '@/server/actions/settings';

type OfficeSettingsFormProps = {
  holdMaxDurationDays: number;
  overdueEscalationDays: number;
  defaultSellingFastThresholdPct: number;
};

export function OfficeSettingsForm({ holdMaxDurationDays, overdueEscalationDays, defaultSellingFastThresholdPct }: OfficeSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const formData = new FormData(e.currentTarget);
    const payload = {
      holdMaxDurationDays: Number(formData.get('holdMaxDurationDays')),
      overdueEscalationDays: Number(formData.get('overdueEscalationDays')),
      defaultSellingFastThresholdPct: Number(formData.get('defaultSellingFastThresholdPct')),
    };

    startTransition(async () => {
      const res = await updateOfficeSettings(payload);
      if (res.ok) setSuccess('Settings updated successfully.');
      else setError(res.issues ? 'Validation failed. Check inputs.' : res.message || 'Update failed');
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl border rounded-lg p-6 bg-card">
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {success && <p className="text-sm font-medium text-green-600">{success}</p>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Max Hold Duration (Days)</label>
          <p className="text-xs text-muted-foreground mb-2">Holds extending beyond this require owner approval.</p>
          <input 
            type="number" 
            name="holdMaxDurationDays" 
            defaultValue={holdMaxDurationDays} 
            min="1" max="365" 
            className="w-full border rounded-md p-2 text-sm" 
            required 
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Overdue Escalation (Days)</label>
          <p className="text-xs text-muted-foreground mb-2">Follow-ups overdue by this many days escalate to the owner dashboard.</p>
          <input 
            type="number" 
            name="overdueEscalationDays" 
            defaultValue={overdueEscalationDays} 
            min="1" max="30" 
            className="w-full border rounded-md p-2 text-sm" 
            required 
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Selling Fast Threshold (%)</label>
          <p className="text-xs text-muted-foreground mb-2">Suggest &ldquo;Selling Fast&rdquo; label when available inventory drops below this percentage.</p>
          <input 
            type="number" 
            name="defaultSellingFastThresholdPct" 
            defaultValue={defaultSellingFastThresholdPct} 
            min="0" max="100" 
            className="w-full border rounded-md p-2 text-sm" 
            required 
          />
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isPending} 
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Save Configuration'}
      </button>
    </form>
  );
}
