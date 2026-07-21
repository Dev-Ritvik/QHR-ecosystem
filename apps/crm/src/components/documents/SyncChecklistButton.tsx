'use client';

import { useState, useTransition } from 'react';
import { syncDealDocuments } from '@/server/actions/deal-documents';

export function SyncChecklistButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState('');

  return (
    <div className="flex items-center space-x-4">
      <button 
        onClick={() => {
          setStatus('');
          startTransition(async () => {
            const res = await syncDealDocuments(bookingId);
            if (res.ok) setStatus('Checklist synced');
            else setStatus('Failed to sync');
          });
        }}
        disabled={isPending}
        className="text-sm bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md hover:bg-secondary/80 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Syncing...' : 'Sync Required Deal Documents'}
      </button>
      {status && <span className="text-sm text-muted-foreground">{status}</span>}
    </div>
  );
}
