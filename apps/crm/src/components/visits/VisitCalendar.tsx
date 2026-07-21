// apps/crm/src/components/visits/VisitCalendar.tsx
'use client';

import { useState, useTransition } from 'react';
import { updateVisitStatus } from '@/server/actions/visits';
import { Button } from '@/components/ui/button';
import { MapPin, Car, Users, LayoutDashboard } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

type FormattedVisit = {
  id: string;
  scheduledAt: Date;
  status: string;
  outcomeCapturedAt: Date | null;
  pickupPoint: string | null;
  vehicleNote: string | null;
  agentName: string | null;
  leads: string[];
  units: string[];
};

export function VisitCalendar({ visits, isOwner }: { visits: FormattedVisit[], isOwner: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const currentDayOfWeek = today.getDay(); 
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + distanceToMonday + (weekOffset * 7));

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const handleStatusChange = (visitId: string, newStatus: string) => {
    startTransition(async () => {
      await updateVisitStatus({ visitId, status: newStatus as any });
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'border-emerald-500 bg-emerald-500/10 text-emerald-700';
      case 'cancelled': return 'border-destructive bg-destructive/10 text-destructive';
      case 'no_show': return 'border-orange-500 bg-orange-500/10 text-orange-700';
      default: return 'border-primary bg-primary/10 text-primary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">
          Week of {new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(startOfWeek)}
        </h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o - 1)}>Prev Week</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o + 1)}>Next Week</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map(day => {
          const isToday = day.getTime() === today.getTime();
          
          const dayVisits = visits.filter(v => {
            const vDate = new Date(v.scheduledAt);
            return vDate.getDate() === day.getDate() && vDate.getMonth() === day.getMonth() && vDate.getFullYear() === day.getFullYear();
          });

          return (
            <div key={day.toISOString()} className={`flex flex-col border rounded-xl overflow-hidden bg-card ${isToday ? 'ring-2 ring-primary border-primary' : 'border-border'}`}>
              <div className={`p-3 text-center border-b ${isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'}`}>
                <div className="text-xs font-bold uppercase">{new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(day)}</div>
                <div className="text-xl font-light">{day.getDate()}</div>
              </div>
              
              <div className="flex-1 p-2 space-y-3 min-h-[150px] bg-card">
                {dayVisits.length === 0 ? (
                  <div className="text-xs text-center text-muted-foreground pt-4 opacity-50">No visits</div>
                ) : (
                  dayVisits.map(visit => (
                    <div key={visit.id} className={`p-3 rounded-lg border text-xs shadow-sm space-y-2 ${getStatusColor(visit.status)}`}>
                      <div className="flex items-center justify-between font-bold border-b border-inherit pb-2">
                        <span>{new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(visit.scheduledAt)}</span>
                        {isOwner && <span className="opacity-70 truncate max-w-[80px]">{visit.agentName}</span>}
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-start">
                          <Users className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0 opacity-70" />
                          <span className="font-semibold">{visit.leads.join(', ')}</span>
                        </div>
                        {visit.units.length > 0 && (
                          <div className="flex items-start">
                            <LayoutDashboard className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0 opacity-70" />
                            <span className="line-clamp-2">{visit.units.join(' → ')}</span>
                          </div>
                        )}
                        {visit.pickupPoint && (
                          <div className="flex items-start">
                            <MapPin className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0 opacity-70" />
                            <span className="truncate">{visit.pickupPoint}</span>
                          </div>
                        )}
                        {visit.vehicleNote && (
                          <div className="flex items-start">
                            <Car className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0 opacity-70" />
                            <span className="truncate">{visit.vehicleNote}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-inherit mt-2 space-y-2">
                        <Select 
                          disabled={isPending} 
                          value={visit.status} 
                          onValueChange={(val) => handleStatusChange(visit.id, val)}
                        >
                          <SelectTrigger className="h-7 text-[10px] uppercase font-bold bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="no_show">No Show</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>

                        {visit.status === 'completed' && !visit.outcomeCapturedAt && (
                          <Button variant="outline" size="sm" className="w-full text-[10px] font-bold border-orange-500/30 text-orange-700 bg-orange-500/10 hover:bg-orange-500/20" asChild>
                            <Link href={`?capture=${visit.id}`}>CAPTURE OUTCOME</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
