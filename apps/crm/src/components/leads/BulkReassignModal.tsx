'use client';

import { useState, useTransition } from 'react';
import { bulkReassignLeads } from '@/server/actions/leads';

type Agent = { id: string; name: string };

type BulkReassignModalProps = {
  agents: Agent[];
  isOpen: boolean;
  onClose: () => void;
};

export function BulkReassignModal({ agents, isOpen, onClose }: BulkReassignModalProps) {
  const [isPending, startTransition] = useTransition();
  const [fromAgent, setFromAgent] = useState('');
  const [toAgent, setToAgent] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); 
    setSuccess('');

    if (fromAgent === toAgent) {
      setError('Source and destination agents must be different.');
      return;
    }

    startTransition(async () => {
      const res = await bulkReassignLeads({ fromAgentId: fromAgent, toAgentId: toAgent });
      if (res.ok) {
        setSuccess(`Successfully reassigned ${res.count} active leads.`);
        setTimeout(() => {
          onClose();
          setSuccess('');
          setFromAgent('');
          setToAgent('');
        }, 2000);
      } else {
        setError(res.message || 'Failed to reassign leads.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 border">
        <h2 className="text-lg font-semibold mb-1">Bulk Reassign Leads</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Move all active leads from one agent to another. Full history will be preserved.
        </p>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
        {success && <p className="text-sm text-green-600 mb-4">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">From Agent</label>
            <select 
              required 
              className="w-full border p-2 rounded-md text-sm bg-background" 
              value={fromAgent} 
              onChange={e => setFromAgent(e.target.value)} 
              disabled={isPending}
            >
              <option value="">Select source agent</option>
              {agents.map(a => <option key={`from-${a.id}`} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">To Agent</label>
            <select 
              required 
              className="w-full border p-2 rounded-md text-sm bg-background" 
              value={toAgent} 
              onChange={e => setToAgent(e.target.value)} 
              disabled={isPending}
            >
              <option value="">Select destination agent</option>
              {agents.map(a => <option key={`to-${a.id}`} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
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
              {isPending ? 'Processing...' : 'Reassign All'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
