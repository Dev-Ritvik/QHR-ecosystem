// apps/crm/src/components/visits/CaptureOutcomeDialog.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { getVisitForCapture, captureVisitOutcome } from '@/server/actions/visits';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Check } from 'lucide-react';

const OUTCOME_CHIPS = [
  'shortlisted', 'liked', 'price_objection', 'location_objection', 'wants_corner', 'rejected'
] as const;

type UnitState = {
  outcomes: string[];
  note: string;
};

export function CaptureOutcomeDialog() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const captureId = searchParams.get('capture');

  const [isPending, startTransition] = useTransition();
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unitsData, setUnitsData] = useState<Array<{ unitId: string, label: string }>>([]);
  const [unitStates, setUnitStates] = useState<Record<string, UnitState>>({});
  const [generalNote, setGeneralNote] = useState('');

  useEffect(() => {
    if (!captureId) return;
    let mounted = true;
    
    setLoadingData(true);
    setError(null);
    setUnitsData([]);
    setUnitStates({});
    setGeneralNote('');

    getVisitForCapture(captureId).then(res => {
      if (!mounted) return;
      setLoadingData(false);
      
      if (res.ok && res.data) {
        const uData = res.data.units.map((u: { unitId: string, projectName: string, unitNumber: string }) => ({ unitId: u.unitId, label: `${u.projectName} - ${u.unitNumber}` }));
        setUnitsData(uData);
        
        const initialStates: Record<string, UnitState> = {};
        uData.forEach(u => {
          initialStates[u.unitId] = { outcomes: [], note: '' };
        });
        setUnitStates(initialStates);
      } else {
        setError(res.code || 'Failed to load visit details.');
      }
    });

    return () => { mounted = false; };
  }, [captureId]);

  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('capture');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggleChip = (unitId: string, chip: string) => {
    setUnitStates(prev => {
      const current = prev[unitId].outcomes;
      const next = current.includes(chip) 
        ? current.filter(c => c !== chip)
        : [...current, chip];
      return { ...prev, [unitId]: { ...prev[unitId], outcomes: next } };
    });
  };

  const updateNote = (unitId: string, val: string) => {
    setUnitStates(prev => ({
      ...prev,
      [unitId]: { ...prev[unitId], note: val }
    }));
  };

  const handleSubmit = () => {
    if (!captureId) return;

    // Validate that if there are units, at least one outcome is selected for each
    for (const u of unitsData) {
      if (unitStates[u.unitId].outcomes.length === 0) {
        setError(`Select at least one outcome for ${u.label}`);
        return;
      }
    }
    
    setError(null);

    const payload = {
      visitId: captureId,
      generalNote,
      unitOutcomes: unitsData.map(u => ({
        unitId: u.unitId,
        outcomes: unitStates[u.unitId].outcomes,
        outcomeNote: unitStates[u.unitId].note
      }))
    };

    startTransition(async () => {
      const res = await captureVisitOutcome(payload);
      if (res.ok) {
        handleClose();
      } else {
        setError(res.code || 'Failed to save outcomes.');
      }
    });
  };

  if (!captureId) return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Capture Visit Outcome</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-8">
          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</div>}
          
          {loadingData ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading visit details...</div>
          ) : (
            <>
              {unitsData.length > 0 && (
                <div className="space-y-6">
                  {unitsData.map(u => (
                    <div key={u.unitId} className="p-4 border rounded-xl bg-muted/20 space-y-4">
                      <h3 className="font-semibold">{u.label}</h3>
                      
                      <div className="flex flex-wrap gap-2">
                        {OUTCOME_CHIPS.map(chip => {
                          const isSelected = unitStates[u.unitId]?.outcomes.includes(chip);
                          return (
                            <button
                              key={chip}
                              onClick={() => toggleChip(u.unitId, chip)}
                              disabled={isPending}
                              className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-colors border ${
                                isSelected 
                                  ? 'bg-primary text-primary-foreground border-primary' 
                                  : 'bg-background text-muted-foreground hover:border-foreground/30'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 mr-1" />}
                              {chip.replace('_', ' ')}
                            </button>
                          );
                        })}
                      </div>

                      <Textarea 
                        placeholder="Specific note for this unit..."
                        className="text-sm resize-none h-20"
                        value={unitStates[u.unitId]?.note || ''}
                        onChange={(e) => updateNote(u.unitId, e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold">Next Step & General Note</label>
                <Textarea 
                  placeholder="What's the follow-up? General impression?"
                  className="text-sm resize-none h-24"
                  value={generalNote}
                  onChange={(e) => setGeneralNote(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || loadingData}>Save Outcomes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
