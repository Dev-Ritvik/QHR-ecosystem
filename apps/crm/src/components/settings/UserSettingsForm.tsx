'use client';

import { useState, useTransition } from 'react';
import { updateUserSettings } from '@/server/actions/user-settings';

export function UserSettingsForm({ initialEmailDigest }: { initialEmailDigest: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEmailDigest);
  const [status, setStatus] = useState('');

  const handleSave = () => {
    setStatus('');
    startTransition(async () => {
      const res = await updateUserSettings({ emailDigest: enabled });
      if (res.ok) {
        setStatus('Preferences saved successfully.');
      } else {
        setStatus('Failed to save preferences.');
      }
    });
  };

  return (
    <div className="bg-card border rounded-lg p-6 max-w-md space-y-4">
      <h3 className="font-semibold text-lg">Notification Preferences</h3>
      
      <label className="flex items-center space-x-3 cursor-pointer">
        <input 
          type="checkbox" 
          checked={enabled} 
          onChange={e => setEnabled(e.target.checked)} 
          disabled={isPending}
          className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
        />
        <span className="text-sm font-medium">Receive Daily Email Digest</span>
      </label>
      
      <p className="text-xs text-muted-foreground">
        A daily summary of your assigned leads, expiring holds, and due follow-ups, including direct <span className="font-semibold text-foreground">wa.me WhatsApp links</span> for quick contact. Requires an email address on your account.
      </p>

      {status && (
        <p className={`text-sm font-medium ${status.includes('Failed') ? 'text-destructive' : 'text-green-600'}`}>
          {status}
        </p>
      )}

      <button 
        onClick={handleSave} 
        disabled={isPending}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}
