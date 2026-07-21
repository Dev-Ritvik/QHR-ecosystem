// apps/public/src/components/present/StatusLegend.tsx
'use client';

import { useMemo } from 'react';

interface StatusLegendProps {
  units: any[]; // Inferred from units_pub
}

const STATUS_CONFIG = [
  { id: 'available', label: 'Available', color: '#10b981', pattern: 'solid' }, // Emerald 500
  { id: 'selling_fast', label: 'Selling Fast', color: '#f59e0b', pattern: 'solid' }, // Amber 500
  { id: 'on_hold', label: 'On Hold', color: '#f97316', pattern: 'dashed' }, // Orange 500
  { id: 'booked', label: 'Booked', color: '#8b5cf6', pattern: 'hatched' }, // Violet 500
  { id: 'sold', label: 'Sold', color: '#64748b', pattern: 'solid' }, // Slate 500
  // Owner 4-state view: the withheld-from-sale bucket is "Mortgage" (the
  // only source of not_for_sale in the projection is a mortgaged unit).
  { id: 'not_for_sale', label: 'Mortgage', color: '#d97706', pattern: 'dashed' }, // Amber 600
];

export function StatusLegend({ units }: StatusLegendProps) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    units.forEach(u => {
      c[u.presentationStatus] = (c[u.presentationStatus] || 0) + 1;
    });
    return c;
  }, [units]);

  return (
    <div data-testid="status-legend" className="absolute bottom-12 left-12 bg-black/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl z-40 text-white min-w-[320px]">
      <h3 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-6">
        Inventory Status
      </h3>
      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        {STATUS_CONFIG.map(status => {
          const count = counts[status.id] || 0;
          return (
            <div key={status.id} className="flex items-center gap-4">
              <div 
                className="w-6 h-6 rounded-md border-2 border-white/20 shadow-inner flex items-center justify-center overflow-hidden shrink-0"
                style={{ 
                  backgroundColor: status.pattern === 'solid' ? status.color : 'transparent',
                  borderColor: status.pattern === 'dashed' ? status.color : 'rgba(255,255,255,0.2)'
                }}
              >
                {status.pattern === 'hatched' && (
                  <div 
                    className="w-full h-full opacity-60" 
                    style={{ 
                      background: `repeating-linear-gradient(45deg, ${status.color}, ${status.color} 2px, transparent 2px, transparent 6px)` 
                    }} 
                  />
                )}
                {status.pattern === 'dashed' && (
                  <div 
                    className="w-full h-full border-2 border-dashed opacity-80" 
                    style={{ borderColor: status.color }} 
                  />
                )}
                {status.pattern === 'solid' && (
                  <div 
                    className="w-full h-full" 
                    style={{ backgroundColor: status.color }} 
                  />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold leading-none tracking-tight">
                  {count}
                </span>
                <span className="text-xs font-semibold text-gray-300 mt-1 uppercase tracking-wide">
                  {status.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
