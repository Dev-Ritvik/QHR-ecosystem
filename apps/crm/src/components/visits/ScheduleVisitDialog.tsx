// apps/crm/src/components/visits/ScheduleVisitDialog.tsx
"use client";

import { useState, useTransition } from "react";
import { scheduleVisit } from "@/server/actions/visits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, CheckCircle2 } from "lucide-react";

type Agent = { id: string; name: string };
type Lead = { id: string; name: string; phone: string };
type Unit = { id: string; unitNumber: string; projectName: string };

interface ScheduleVisitProps {
  agents: Agent[];
  leads: Lead[];
  units: Unit[];
  currentUserId: string;
  isOwner: boolean;
}

export function ScheduleVisitDialog({
  agents,
  leads,
  units,
  currentUserId,
  isOwner,
}: ScheduleVisitProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [scheduledAtStr, setScheduledAtStr] = useState("");
  const [agentId, setAgentId] = useState(currentUserId);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]); // Order maintained via push
  const [pickupPoint, setPickupPoint] = useState("");
  const [vehicleNote, setVehicleNote] = useState("");

  const handleLeadToggle = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id],
    );
  };

  const handleUnitToggle = (id: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    if (!scheduledAtStr || selectedLeadIds.length === 0) return;
    setError(null);

    // Convert local datetime-local string to UTC ISO string
    const isoDate = new Date(scheduledAtStr).toISOString();

    startTransition(async () => {
      const res = await scheduleVisit({
        scheduledAt: isoDate,
        agentId,
        leadIds: selectedLeadIds,
        unitIds: selectedUnitIds,
        pickupPoint,
        vehicleNote,
      });

      if (res.ok) {
        setOpen(false);
        setScheduledAtStr("");
        setSelectedLeadIds([]);
        setSelectedUnitIds([]);
        setPickupPoint("");
        setVehicleNote("");
      } else {
        setError(`Failed to schedule visit (Error: ${res.code}).`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Calendar className="w-4 h-4 mr-2" />
          Schedule Visit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Site Visit</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Date & Time <span className="text-destructive">*</span>
              </label>
              <Input
                type="datetime-local"
                value={scheduledAtStr}
                onChange={(e) => setScheduledAtStr(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assigned Agent</label>
              <Select
                value={agentId}
                onValueChange={setAgentId}
                disabled={!isOwner}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Leads (Clients) <span className="text-destructive">*</span>
            </label>
            <div className="border rounded-lg max-h-40 overflow-y-auto p-2 bg-muted/20 space-y-1">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer border transition-colors ${selectedLeadIds.includes(lead.id) ? "bg-primary/10 border-primary" : "bg-card border-transparent hover:border-border"}`}
                  onClick={() => handleLeadToggle(lead.id)}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {lead.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lead.phone}
                    </p>
                  </div>
                  {selectedLeadIds.includes(lead.id) && (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Units to Show (Ordered)
            </label>
            <p className="text-xs text-muted-foreground">
              Click in the order you plan to show them.
            </p>
            <div className="border rounded-lg max-h-40 overflow-y-auto p-2 bg-muted/20 space-y-1">
              {units.map((unit) => {
                const orderIndex = selectedUnitIds.indexOf(unit.id);
                const isSelected = orderIndex > -1;
                return (
                  <div
                    key={unit.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer border transition-colors ${isSelected ? "bg-primary/10 border-primary" : "bg-card border-transparent hover:border-border"}`}
                    onClick={() => handleUnitToggle(unit.id)}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {unit.projectName} - {unit.unitNumber}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 flex items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
                        {orderIndex + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pickup Point</label>
              <Input
                placeholder="e.g. Client's office, Metro Pillar 42"
                value={pickupPoint}
                onChange={(e) => setPickupPoint(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Vehicle / Driver Note
              </label>
              <Input
                placeholder="e.g. Using office Innova, Driver Raju"
                value={vehicleNote}
                onChange={(e) => setVehicleNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                isPending || !scheduledAtStr || selectedLeadIds.length === 0
              }
              onClick={handleSubmit}
            >
              Schedule Visit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
