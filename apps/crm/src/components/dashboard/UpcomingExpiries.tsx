'use client';

import { format, isPast } from 'date-fns';
import Link from 'next/link';

type ExpiringHold = any;
type ExpiringDoc = any;
type UpcomingFollowUp = any;

export function UpcomingExpiries({ holds, docs, followUps }: { holds: ExpiringHold[], docs: ExpiringDoc[], followUps: UpcomingFollowUp[] }) {
  
  return (
    <div className="bg-card border rounded-lg p-4 space-y-6">
      <h3 className="font-semibold">Upcoming Expiries & Action Items</h3>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">Holds Expiring (Next 7 Days)</h4>
        {holds.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No holds expiring soon.</p>
        ) : (
          <ul className="space-y-2">
            {holds.map((h: any) => {
              const overdue = isPast(new Date(h.expiresAt));
              return (
                <li key={h.id} className="flex justify-between items-center text-sm">
                  <div>
                    <Link href={`/projects/${h.unit.projectId}/units/${h.unitId}`} className="font-medium hover:underline text-blue-600">
                      Unit {h.unit.unitNumber} ({h.unit.project.name})
                    </Link>
                    <span className="text-muted-foreground ml-2">— {h.client.name}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${overdue ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-800'}`}>
                    {format(new Date(h.expiresAt), 'MMM d, h:mm a')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">Documents Expiring (Next 30 Days)</h4>
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No documents expiring soon.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d: any) => (
              <li key={d.id} className="flex justify-between items-center text-sm">
                <div>
                  <span className="font-medium">{d.title}</span>
                  {d.unit && <span className="text-muted-foreground ml-2">— Unit {d.unit.unitNumber}</span>}
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  {d.expiryDate && format(new Date(d.expiryDate), 'MMM d, yyyy')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">Upcoming Follow-Ups (Next 7 Days)</h4>
        {followUps.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No follow-ups scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {followUps.map((l: any) => (
              <li key={l.id} className="flex justify-between items-center text-sm">
                <div>
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline text-blue-600">
                    {l.name}
                  </Link>
                  <span className="text-muted-foreground ml-2">— Agent: {l.assignedAgent?.name || 'Unassigned'}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {l.nextFollowUpAt && format(new Date(l.nextFollowUpAt), 'MMM d, h:mm a')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
