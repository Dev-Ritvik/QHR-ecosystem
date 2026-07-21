'use client';

export function UnitPanel({ unit, project, isPricingUnlocked = false }: { unit: any; project: any; isPricingUnlocked?: boolean }) {
  if (!unit) return null;

  // FR-PM7 / FR-PM12: Conditionally reveal price based on unit settings and device clearance
  const showPrice = !unit.priceOnRequest || isPricingUnlocked;
  
  // Format paise. 1 Crore = 1,00,00,000 rupees = 1,00,00,00,000 paise.
  const crValue = unit.pricePaise ? (Number(unit.pricePaise) / 1000000000).toFixed(2) : '0';
  const priceString = showPrice && unit.pricePaise ? `₹${crValue} Cr` : 'Price on Request';

  return (
    <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-slate-700 text-slate-50 pointer-events-auto" data-testid="unit-panel">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{unit.unitNumber}</h2>
          <p className="text-slate-400">{unit.dimensionsLabel || `${unit.areaSqYd} sq yd`}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-400">{priceString}</div>
          {unit.priceOnRequest && isPricingUnlocked && (
            <div className="text-xs text-emerald-500/80 font-mono mt-1 uppercase tracking-wider">
              {/* Visible signal that the screen is operating with owner privilege */}
              Device Unlocked
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm mt-6">
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
          <div className="text-slate-400 mb-1">Status</div>
          <div className="font-medium capitalize">{unit.presentationStatus?.replace('_', ' ')}</div>
        </div>
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
          <div className="text-slate-400 mb-1">Facing</div>
          <div className="font-medium capitalize">{unit.facing || 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}
