// apps/crm/src/components/leads/TriageTable.tsx
'use client';

import { useState, useTransition } from 'react';
import { triageAssign, triageMerge, triageSpam } from '@/server/actions/leads';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, UserPlus, GitMerge, ShieldBan } from 'lucide-react';

type LeadRow = any;

export function TriageTable({ inboxLeads, agents, existingLeads }: { inboxLeads: LeadRow[], agents: any[], existingLeads: LeadRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Dialog State
  const [assignData, setAssignData] = useState<{ leadId: string } | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  
  const [mergeData, setMergeData] = useState<{ leadId: string, phone: string } | null>(null);
  const [selectedTargetLead, setSelectedTargetLead] = useState<string>('');

  const [spamLeadId, setSpamLeadId] = useState<string | null>(null);

  const handleAssign = () => {
    if (!assignData || !selectedAgent) return;
    setError(null);
    startTransition(async () => {
      const res = await triageAssign({ leadId: assignData.leadId, agentId: selectedAgent });
      if (res.ok) {
        setAssignData(null);
        setSelectedAgent('');
      } else {
        setError('Failed to assign lead' + (res.code ? ` (${res.code})` : ''));
      }
    });
  };

  const handleMerge = () => {
    if (!mergeData || !selectedTargetLead) return;
    setError(null);
    startTransition(async () => {
      const res = await triageMerge({ leadId: mergeData.leadId, targetLeadId: selectedTargetLead });
      if (res.ok) {
        setMergeData(null);
        setSelectedTargetLead('');
      } else {
        setError('Failed to merge lead' + (res.code ? ` (${res.code})` : ''));
      }
    });
  };

  const handleSpam = () => {
    if (!spamLeadId) return;
    setError(null);
    startTransition(async () => {
      const res = await triageSpam({ leadId: spamLeadId });
      if (res.ok) {
        setSpamLeadId(null);
      } else {
        setError('Failed to mark as spam' + (res.code ? ` (${res.code})` : ''));
      }
    });
  };

  if (inboxLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border rounded-xl bg-card text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold">Inbox Zero</h3>
        <p className="text-muted-foreground mt-1 text-sm max-w-sm">
          No new enquiries to triage. Website forms and portal webhook ingestions will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
            <tr>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Source & Intent</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inboxLeads.map((lead) => {
              const duplicates = existingLeads.filter(l => l.phone === lead.phone);
              const hasDuplicates = duplicates.length > 0;

              return (
                <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 align-top whitespace-nowrap text-muted-foreground">
                    {new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(lead.createdAt))}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-semibold text-foreground">{lead.name}</p>
                    <p className="text-muted-foreground mt-0.5">{lead.phone}</p>
                    {hasDuplicates && (
                      <span className="inline-flex mt-2 items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                        DUPLICATE PHONE
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="capitalize font-medium">{lead.source.replace('_', ' ')}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2 max-w-xs">
                      {lead.assetClassInterest ? lead.assetClassInterest.replace('_', ' ') : 'Any asset class'}
                      {lead.timelineExpectation ? ` • ${lead.timelineExpectation}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top text-right space-x-2 whitespace-nowrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setAssignData({ leadId: lead.id })}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      Assign
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className={hasDuplicates ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : ''}
                      onClick={() => setMergeData({ leadId: lead.id, phone: lead.phone })}
                    >
                      <GitMerge className="w-3.5 h-3.5 mr-1.5" />
                      Merge
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setSpamLeadId(lead.id)}
                    >
                      <ShieldBan className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Assign Dialog */}
      <Dialog open={!!assignData} onOpenChange={(open) => !open && setAssignData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lead</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignData(null)}>Cancel</Button>
            <Button disabled={isPending || !selectedAgent} onClick={handleAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={!!mergeData} onOpenChange={(open) => !open && setMergeData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge into Existing Lead</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will mark the new enquiry as a duplicate and append a merge event to the target lead&rsquo;s timeline.
            </p>
            <Select value={selectedTargetLead} onValueChange={setSelectedTargetLead}>
              <SelectTrigger>
                <SelectValue placeholder="Select target lead..." />
              </SelectTrigger>
              <SelectContent>
                {existingLeads
                  .filter(l => l.phone === mergeData?.phone)
                  .map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} • Stage: {l.stage.toUpperCase()}
                    </SelectItem>
                  ))
                }
                {existingLeads.filter(l => l.phone === mergeData?.phone).length === 0 && (
                  <SelectItem value="none" disabled>No active matches for this phone</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeData(null)}>Cancel</Button>
            <Button disabled={isPending || !selectedTargetLead || selectedTargetLead === 'none'} onClick={handleMerge}>Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spam Confirm Dialog */}
      <Dialog open={!!spamLeadId} onOpenChange={(open) => !open && setSpamLeadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Spam</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to mark this enquiry as spam? It will be removed from the active triage inbox.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpamLeadId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={isPending} onClick={handleSpam}>Confirm Spam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
