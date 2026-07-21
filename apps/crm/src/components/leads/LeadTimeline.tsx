// apps/crm/src/components/leads/LeadTimeline.tsx
import { ArrowRight, Phone, MessageSquare, UserPlus, IndianRupee, FileText } from 'lucide-react';
import { formatPaise } from '@estate/domain/src/money/format';

export function LeadTimeline({ events }: { events: any[] }) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'stage_change': return <ArrowRight className="w-4 h-4 text-primary" />;
      case 'interaction': return <Phone className="w-4 h-4 text-green-600" />;
      case 'note': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'assignment': return <UserPlus className="w-4 h-4 text-purple-500" />;
      case 'negotiation': return <IndianRupee className="w-4 h-4 text-orange-500" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
    }).format(new Date(date));
  };

  if (!events || events.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8 border rounded-lg bg-muted/20">
        No events recorded yet.
      </div>
    );
  }

  return (
    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
      {events.map((event) => (
        <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          {/* Icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            {getEventIcon(event.type)}
          </div>
          
          {/* Card */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-4 rounded-xl border border-border shadow-sm text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground capitalize tracking-tight">
                {event.type.replace('_', ' ')}
              </span>
              <time className="text-xs text-muted-foreground font-medium">
                {formatDate(event.createdAt)}
              </time>
            </div>
            
            <div className="text-muted-foreground leading-relaxed">
              {event.type === 'stage_change' && (
                <p>
                  Moved from <span className="font-semibold text-foreground uppercase text-xs">{event.fromStage}</span> to <span className="font-semibold text-foreground uppercase text-xs">{event.toStage}</span>
                </p>
              )}
              {event.type === 'interaction' && (
                <p>
                  Logged {event.interactionType} interaction.
                  {event.outcomes && event.outcomes.length > 0 && (
                     <span className="block mt-1 space-x-1">
                       {event.outcomes.map((o: string) => (
                         <span key={o} className="inline-block px-2 py-0.5 bg-muted rounded-full text-[10px] uppercase font-bold text-foreground">
                           {o}
                         </span>
                       ))}
                     </span>
                  )}
                </p>
              )}
              {event.type === 'negotiation' && (
                <div className="mb-2">
                  <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
                    {event.negotiationKind?.replace('_', ' ')}
                  </p>
                  <p className="text-lg font-bold text-orange-600 mt-1">
                    {event.amountPaise ? formatPaise(event.amountPaise) : ''}
                  </p>
                </div>
              )}
              {event.type === 'assignment' && (
                <p>Assigned to new agent.</p>
              )}
              {event.type === 'merge' && (
                <p>Duplicate enquiry merged into this lead.</p>
              )}
              
              {event.note && (
                <p className="mt-3 p-3 text-foreground bg-muted/50 rounded-lg border border-border/50 text-sm">
                  {event.note}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
