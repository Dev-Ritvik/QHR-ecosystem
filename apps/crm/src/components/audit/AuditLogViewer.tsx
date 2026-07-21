// apps/crm/src/components/audit/AuditLogViewer.tsx
'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { DiffViewer } from './DiffViewer';

type AuditRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before: any;
  after: any;
  ipAddress: string | null;
  createdAt: string;
  actorName: string | null;
};

export function AuditLogViewer({ logs }: { logs: AuditRecord[] }) {
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = logs.filter(l => {
    if (actionFilter && !l.action.toLowerCase().includes(actionFilter.toLowerCase())) return false;
    if (entityFilter && !l.entityType.toLowerCase().includes(entityFilter.toLowerCase())) return false;
    if (actorFilter && !(l.actorName || 'system').toLowerCase().includes(actorFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Filter by actor..."
          className="border p-2 rounded-md text-sm bg-card"
          value={actorFilter}
          onChange={e => setActorFilter(e.target.value)}
        />
        <input
          type="text"
          placeholder="Filter by action..."
          className="border p-2 rounded-md text-sm bg-card"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        />
        <input
          type="text"
          placeholder="Filter by entity type..."
          className="border p-2 rounded-md text-sm bg-card"
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
        />
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No audit logs match your filters.</td></tr>
            ) : filtered.map(log => {
              const isExpanded = expandedId === log.id;
              return (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div>{format(new Date(log.createdAt), 'MMM d, yyyy')}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(log.createdAt), 'HH:mm:ss')}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium capitalize">{log.actorName || 'System'}</div>
                      {log.ipAddress && <div className="text-xs text-muted-foreground font-mono">{log.ipAddress}</div>}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-blue-600 dark:text-blue-400">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="capitalize font-medium">{log.entityType.replace('_', ' ')}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">{log.entityId}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {isExpanded ? 'Hide Diff' : 'View Diff'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-muted/10">
                      <td colSpan={5} className="px-4 py-4">
                        <DiffViewer before={log.before} after={log.after} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="text-xs text-muted-foreground pt-2">
        Showing up to 1000 recent events.
      </div>
    </div>
  );
}
