'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { reassignSelectedLeads } from '@/server/actions/leads';

type LeadListItem = {
  id: string;
  name: string;
  phone: string;
  stage: string;
  source: string;
  assignedAgentName: string | null;
  createdAt: Date;
};

export function LeadList({ leads, agents, isOwner, currentAgentFilter }: {
  leads: LeadListItem[],
  agents: { id: string; name: string }[],
  isOwner: boolean,
  currentAgentFilter?: string
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reassignTo, setReassignTo] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id));
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(leads.map(l => l.id)));
  };

  const handleReassignSelected = () => {
    if (!reassignTo || selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await reassignSelectedLeads({ leadIds: [...selected], toAgentId: reassignTo });
      if (res.ok) {
        setSelected(new Set());
        setReassignTo('');
        router.refresh();
      } else {
        setError(('message' in res && res.message) || 'Failed to reassign selected leads.');
      }
    });
  };

  return (
    <div className="space-y-4">
      {isOwner && (
        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
          <span className="text-sm font-medium text-slate-700">Owner View: Filter by Assignment</span>
          <select
            className="text-sm border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-1.5 pl-3 pr-8 bg-white"
            value={currentAgentFilter || 'all'}
            onChange={(e) => {
              const val = e.target.value;
              router.push(val === 'all' ? '/leads' : `/leads?agentId=${val}`);
            }}
          >
            <option value="all">All Agents</option>
            <option value="unassigned">Unassigned Only</option>
            <optgroup label="Agents">
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
      )}

      {isOwner && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
          <span className="text-sm font-medium text-indigo-900">
            {selected.size} lead{selected.size === 1 ? '' : 's'} selected
          </span>
          <select
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
            className="text-sm border-slate-300 rounded-md shadow-sm py-1.5 pl-3 pr-8 bg-white"
          >
            <option value="">Reassign to…</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            onClick={handleReassignSelected}
            disabled={isPending || !reassignTo}
            className="bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Reassigning…' : 'Reassign Selected'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Clear
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}

      <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
        {leads.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="text-slate-400 font-medium mb-1">No leads found</div>
            <div className="text-sm text-slate-500">
              {isOwner && currentAgentFilter === 'unassigned'
                ? "There are no unassigned leads in the pipeline."
                : "Try adjusting your filters or adding a new lead."}
            </div>
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {isOwner && (
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all leads"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                )}
                <th className="px-6 py-3 font-medium text-slate-600">Name</th>
                <th className="px-6 py-3 font-medium text-slate-600">Phone</th>
                <th className="px-6 py-3 font-medium text-slate-600">Stage</th>
                <th className="px-6 py-3 font-medium text-slate-600">Source</th>
                {isOwner && <th className="px-6 py-3 font-medium text-slate-600">Assigned To</th>}
                <th className="px-6 py-3 font-medium text-slate-600 text-right">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-slate-50 transition-colors group ${selected.has(lead.id) ? 'bg-indigo-50/50' : ''}`}>
                  {isOwner && (
                    <td className="pl-4 pr-2 py-4 w-8">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggle(lead.id)}
                        aria-label={`Select lead ${lead.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <Link href={`/leads/${lead.id}`} className="hover:text-indigo-600 focus:outline-none focus:underline">
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono tracking-tight">{lead.phone}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 capitalize border border-slate-200/60">
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 capitalize">
                    {lead.source.replace('_', ' ')}
                  </td>
                  {isOwner && (
                    <td className="px-6 py-4 text-slate-500">
                      {lead.assignedAgentName || <span className="text-slate-400 italic">Unassigned</span>}
                    </td>
                  )}
                  <td className="px-6 py-4 text-slate-500 text-right">
                    {formatDate(lead.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
