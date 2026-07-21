// apps/crm/src/components/leads/NegotiationLogger.tsx
'use client';

import { useState, useTransition } from 'react';
import { logNegotiation } from '@/server/actions/leads';
import { rupeesToPaise } from '@estate/domain/money/paise';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { IndianRupee } from 'lucide-react';

export function NegotiationLogger({ leadId, unitsOfInterest }: { leadId: string, unitsOfInterest: { id: string, label: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<string>('');
  const [amountStr, setAmountStr] = useState('');
  const [unitId, setUnitId] = useState<string>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!kind || !amountStr) return;
    setError(null);

    // String-parsing rupees→paise conversion at the form boundary — no floats
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
        note
      });
      
      if (res.ok) {
        setKind('');
        setAmountStr('');
        setUnitId('');
        setNote('');
      } else {
        setError(res.code || 'Failed to log negotiation');
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-destructive">{error}</div>}
      
      <Select value={kind} onValueChange={setKind}>
        <SelectTrigger>
          <SelectValue placeholder="Negotiation Type" />
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
        placeholder="Notes on this negotiation..."
        value={note}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
        className="h-20 resize-none text-sm"
      />

      <Button 
        variant="secondary"
        className="w-full" 
        disabled={isPending || !kind || !amountStr}
        onClick={handleSubmit}
      >
        Log Negotiation
      </Button>
    </div>
  );
}
