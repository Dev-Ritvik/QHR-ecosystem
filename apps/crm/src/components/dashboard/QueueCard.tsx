// apps/crm/src/components/dashboard/QueueCard.tsx
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ElementType } from 'react';

type QueueItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  agentName?: string;
};

interface QueueCardProps {
  title: string;
  icon: ElementType;
  items: QueueItem[];
  emptyMessage: string;
  theme: 'destructive' | 'primary' | 'success' | 'warning';
  isOwner: boolean;
}

export function QueueCard({ title, icon: Icon, items, emptyMessage, theme, isOwner }: QueueCardProps) {
  const styles = {
    destructive: { wrapper: "border-destructive/30", header: "bg-destructive/10 text-destructive", badge: "border-destructive/20 text-destructive" },
    primary: { wrapper: "border-primary/30", header: "bg-primary/10 text-primary", badge: "border-primary/20 text-primary" },
    success: { wrapper: "border-emerald-500/30", header: "bg-emerald-500/10 text-emerald-600", badge: "border-emerald-500/20 text-emerald-600" },
    warning: { wrapper: "border-orange-500/30", header: "bg-orange-500/10 text-orange-600", badge: "border-orange-500/20 text-orange-600" },
  }[theme];

  return (
    <div className={`border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col max-h-[400px] ${styles.wrapper}`}>
      <div className={`flex items-center px-4 py-3 border-b border-inherit shrink-0 ${styles.header}`}>
        <Icon className="w-5 h-5 mr-2" />
        <h2 className="font-semibold">{title}</h2>
        <span className={`ml-auto bg-background text-xs font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>
          {items.length}
        </span>
      </div>
      
      {items.length === 0 ? (
        <div className="p-6 flex-1 flex items-center justify-center text-center text-sm text-muted-foreground bg-card">
          {emptyMessage}
        </div>
      ) : (
        <ul className="divide-y divide-border bg-card overflow-y-auto hide-scrollbar">
          {items.map((item) => (
            <li key={item.id}>
              <Link 
                href={item.href} 
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
              >
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.subtitle}</p>
                  {isOwner && item.agentName && (
                    <p className="text-xs font-semibold mt-1 opacity-70 text-foreground">Agent: {item.agentName}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
