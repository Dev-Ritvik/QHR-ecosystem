// apps/crm/src/components/leads/PrivilegedEntries.tsx
'use client';

import { useState, useTransition } from 'react';
import { logNegotiation, getLeadPrivilegedEntries } from '@/server/actions/leads';
import { rupeesToPaise } from '@estate/domain/money/paise';
import { formatPaise } from '@estate/domain/src/money/format';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Eye, IndianRupee, Plus, ShieldAlert } from 'lucide-react';

type Entry = {
  id: string;
  negotiationKind: string | null;
  amountPaise: string | null;
  note: string | null;
  createdAt: string;
  unitNumber: string | null;
  actorName: string | null;
};

const KIND_LABELS: Record<string, string> = {
  asked_price: 'Quoted Price (We Asked)',
  client_offer: 'Client Offer',
  concession: 'Concession (We reduced to)',
  counter: 'Counter Offer (Client countered)',
};

/**
 * Privileged Info entries for a lead — the negotiation records the schema
 * protects with owner-only RLS (kind + amount + optional unit + note).
 * Reading is an audited privileged read (FR-C21 pattern, same as the floor
 * price reveal); adding goes through the existing logNegotiation action so
 * floor-price derivation and the audit trail keep working unchanged.
 */
export function PrivilegedEntries({ leadId, unitsOfInterest }: { leadId: string, unitsOfInterest: { id: string, label: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState<Entry[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Add-entry form state
  const [kind, setKind] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [unitId, setUnitId] = useState('');
  const [note, setNote] = useState('');

  const handleReveal = () => {
    setError(null);
    startTransition(async () => {
      const res = await getLeadPrivilegedEntries(leadId);
      if (res.ok) setEntries(res.data);
      else setError(res.code || 'Unauthorized or failed');
    });
  };

  const handleAdd = () => {
    if (!kind || !amountStr) return;
    setError(null);

    let amountPaise: number;
    try {
      amountPaise = Number(rupeesToPaise(amountStr));
    } catch (err: any) {
      setError(err.message || 'Invalid amount');
      return;
    }

    startTransition(async () => {
      const res = await logNegotiation({
        leadId,
        negotiationKind: kind as any,
        amountPaise,
        unitId: unitId || 'none',
        note: note || undefined,
      });
      if (!res.ok) {
        setError(res.code || 'Failed to save entry');
        return;
      }
      setKind('');
      setAmountStr('');
      setUnitId('');
      setNote('');
      setShowForm(false);
      // Refresh the revealed list if it's open (another audited read)
      if (entries !== undefined) {
        const refreshed = await getLeadPrivilegedEntries(leadId);
        if (refreshed.ok) setEntries(refreshed.data);
      }
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-center">
          <ShieldAlert className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {entries === undefined ? (
        <Button
          variant="outline"
          className="w-full text-orange-700 border-orange-200 hover:bg-orange-50 hover:text-orange-800"
          onClick={handleReveal}
          disabled={isPending}
        >
          <Eye className="w-4 h-4 mr-2" />
          Reveal Privileged Entries (Audited Read)
        </Button>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 text-center border rounded-lg bg-muted/20">
          No privileged entries yet. <span className="text-[10px] block text-orange-600/70">Read audited</span>
        </p>
      ) : (
        <ul className="space-y-2">
          <li className="text-[10px] text-orange-600/70 text-right">Read audited</li>
          {entries.map((e) => (
            <li key={e.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-800">
                  {e.negotiationKind ? KIND_LABELS[e.negotiationKind] ?? e.negotiationKind : 'Entry'}
                </span>
                <span className="font-bold text-orange-900">
                  {e.amountPaise ? formatPaise(BigInt(e.amountPaise)) : '—'}
                </span>
              </div>
              {e.unitNumber && (
                <p className="text-xs text-orange-800 mt-1">Unit {e.unitNumber}</p>
              )}
              {e.note && (
                <p className="text-xs text-orange-900/90 mt-1 whitespace-pre-wrap">{e.note}</p>
              )}
              <p className="text-[10px] text-orange-600/70 mt-1">
                {e.actorName || 'Unknown'} • {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(e.createdAt))}
              </p>
            </li>
          ))}
        </ul>
      )}

      {!showForm ? (
        <Button variant="secondary" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Privileged Entry
        </Button>
      ) : (
        <div className="space-y-3 border border-orange-200 rounded-lg p-3 bg-orange-50/40">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue placeholder="Entry Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asked_price">Quoted Price (We Asked)</SelectItem>
              <SelectItem value="client_offer">Client Offer</SelectItem>
              <SelectItem value="concession">Concession (We reduced to)</SelectItem>
              <SelectItem value="counter">Counter Offer (Client countered)</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              placeholder="Amount (₹)"
              className="pl-9"
              value={amountStr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmountStr(e.target.value)}
            />
          </div>

          {unitsOfInterest.length > 0 && (
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Specific Unit (Optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific unit</SelectItem>
                {unitsOfInterest.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Textarea
            placeholder="Confidential note (internal only)..."
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
            className="h-16 resize-none text-sm"
          />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={isPending || !kind || !amountStr} onClick={handleAdd}>
              {isPending ? 'Saving…' : 'Save Entry'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
