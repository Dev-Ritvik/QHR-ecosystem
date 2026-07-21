// apps/crm/src/components/leads/StageStepper.tsx
'use client';

import { useState, useTransition } from 'react';
import { Check, XCircle, AlertCircle } from 'lucide-react';
import { changeLeadStage } from '@/server/actions/leads';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LINEAR_STAGES = [
  'new', 'contacted', 'qualified', 'site_visit', 'negotiation', 
  'token', 'agreement', 'registered', 'won'
] as const;

const LOST_REASONS = [
  'budget', 'location', 'bought_elsewhere', 'postponed', 
  'unreachable', 'not_interested', 'other'
] as const;

export function StageStepper({ leadId, currentStage }: { leadId: string, currentStage: string }) {
  const [isPending, startTransition] = useTransition();
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [selectedLostReason, setSelectedLostReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const currentIndex = LINEAR_STAGES.indexOf(currentStage as any);

  const handleStageClick = (stage: string) => {
    setError(null);
    if (stage === 'lost') {
      setLostDialogOpen(true);
      return;
    }
    
    startTransition(async () => {
      const res = await changeLeadStage({ leadId, toStage: stage as any });
      if (!res.ok) setError('code' in res ? res.code : 'Failed to update stage. Review pipeline rules.');
    });
  };

  const handleLostSubmit = () => {
    if (!selectedLostReason) return;
    setError(null);
    
    startTransition(async () => {
      const res = await changeLeadStage({ 
        leadId, 
        toStage: 'lost', 
        lostReason: selectedLostReason as any 
      });
      
      if (res.ok) {
        setLostDialogOpen(false);
        setSelectedLostReason('');
      } else {
        setError('code' in res ? res.code : 'Failed to mark as lost.');
      }
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* Linear Stepper */}
      <div className="flex items-center overflow-x-auto pb-4 hide-scrollbar">
        {LINEAR_STAGES.map((stage, idx) => {
          const isCompleted = currentIndex > idx || currentStage === 'won';
          const isCurrent = currentStage === stage;
          
          return (
            <div key={stage} className="flex items-center">
              <button
                disabled={isPending}
                onClick={() => handleStageClick(stage)}
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-bold transition-colors
                  ${isCompleted ? 'bg-primary text-primary-foreground border-primary' :
                    isCurrent ? 'border-primary text-primary bg-primary/10' : 
                    'border-muted bg-background text-muted-foreground hover:border-primary/50'}`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
              </button>
              <span className={`ml-3 text-sm font-semibold whitespace-nowrap
                ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {stage.replace('_', ' ').toUpperCase()}
              </span>
              {idx < LINEAR_STAGES.length - 1 && (
                <div className={`w-8 border-t-2 mx-3 ${isCompleted ? 'border-primary' : 'border-muted'}`} />
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      {/* Terminal Off-shoots */}
      <div className="flex gap-4 pt-2 border-t border-border">
        <Button
          variant={currentStage === 'lost' ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => handleStageClick('lost')}
          disabled={isPending || currentStage === 'won'}
          className={currentStage === 'lost' ? 'pointer-events-none' : ''}
        >
          <XCircle className="w-4 h-4 mr-2" /> 
          {currentStage === 'lost' ? 'Marked as Lost' : 'Mark as Lost'}
        </Button>
        <Button
          variant={currentStage === 'dormant' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => handleStageClick('dormant')}
          disabled={isPending || currentStage === 'won'}
          className={currentStage === 'dormant' ? 'pointer-events-none' : ''}
        >
          <AlertCircle className="w-4 h-4 mr-2" /> 
          {currentStage === 'dormant' ? 'Marked Dormant' : 'Mark as Dormant'}
        </Button>
      </div>

      {/* Mandatory Reason Dialog */}
      <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Lead as Lost</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              A curated reason is required to close this lead. This improves source ROI and lost-deal analytics.
            </p>
            <Select value={selectedLostReason} onValueChange={setSelectedLostReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map(r => (
                  <SelectItem key={r} value={r}>
                    {r.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostDialogOpen(false)}>Cancel</Button>
            <Button disabled={isPending || !selectedLostReason} onClick={handleLostSubmit}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
