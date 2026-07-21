import { ReactNode } from 'react';
import { OfflineManager } from '@/components/present/OfflineManager';
import { DiagnosticsOverlay } from '@/components/present/DiagnosticsOverlay';
import { SilentErrorBoundary } from '@/components/present/SilentErrorBoundary';
import { IdleAttract } from '@/components/present/IdleAttract';

export default function PresentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-slate-900 text-slate-50 min-h-screen w-full overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
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
