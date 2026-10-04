import { ReactNode } from 'react';
import { OfflineManager } from '@/components/present/OfflineManager';
import { DiagnosticsOverlay } from '@/components/present/DiagnosticsOverlay';
import { SilentErrorBoundary } from '@/components/present/SilentErrorBoundary';
import { IdleAttract } from '@/components/present/IdleAttract';

// The kiosk keeps the system sans it was designed in: the public site's one
// family (Playfair, set on <body> in globals.css) is the website's voice, and
// this is a staff-operated sales tool read from three metres away.
export default function PresentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-slate-900 font-sans text-slate-50 min-h-screen w-full overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      {/* FR-PM10: Offline resilience */}
      <OfflineManager />
      
      {/* FR-PM11: Hidden diagnostics view */}
      <DiagnosticsOverlay />

      {/* FR-PM13: Idle attract state */}
      <IdleAttract />
      
      <main className="w-full h-full relative">
        {/* FR-PM11: No error UI. Full-tree crashes resolve to branded empty states */}
        <SilentErrorBoundary>
          {children}
        </SilentErrorBoundary>
      </main>
    </div>
  );
}
