'use client';

import { useState, useEffect } from 'react';

type RoiData = {
  source: string;
  totalLeads: number;
  wonLeads: number;
};

export function LeadSourceRoi({ data }: { data: RoiData[] }) {
  // Store owner-entered portal spend dynamically (NFR-D8 prevents us from breaking schema constraints for a new table)
  const [spend, setSpend] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const saved = localStorage.getItem('owner_portal_spend');
    if (saved) {
      try { setSpend(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const handleSpendChange = (source: string, val: string) => {
    const next = { ...spend, [source]: val };
    setSpend(next);
    localStorage.setItem('owner_portal_spend', JSON.stringify(next));
  };

  const calculateCPA = (totalSpend: number, won: number) => {
    if (won === 0) return 'N/A';
    return `₹${Math.round(totalSpend / won).toLocaleString()}`;
  };

  const calculateCPL = (totalSpend: number, leads: number) => {
    if (leads === 0) return 'N/A';
    return `₹${Math.round(totalSpend / leads).toLocaleString()}`;
  };

  const sorted = [...data].sort((a, b) => b.totalLeads - a.totalLeads);

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-end">
        <h3 className="font-semibold">Lead Source ROI</h3>
        <p className="text-xs text-muted-foreground">Enter spend (₹) for portals to compute CPA.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium text-right">Leads</th>
              <th className="px-3 py-2 font-medium text-right">Won</th>
              <th className="px-3 py-2 font-medium text-right w-32">Spend (₹)</th>
              <th className="px-3 py-2 font-medium text-right">Cost / Lead</th>
              <th className="px-3 py-2 font-medium text-right">CPA (Cost / Won)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map(d => {
              const isPortal = d.source.startsWith('portal_');
              const currentSpend = Number(spend[d.source]) || 0;
              
              return (
                <tr key={d.source}>
                  <td className="px-3 py-2 font-medium capitalize">{d.source.replace('_', ' ')}</td>
                  <td className="px-3 py-2 text-right">{d.totalLeads}</td>
                  <td className="px-3 py-2 text-right text-green-700 font-medium">{d.wonLeads}</td>
                  <td className="px-3 py-2 text-right">
                    {isPortal ? (
                      <input 
                        type="number"
                        placeholder="0"
                        className="w-full border rounded px-2 py-1 text-right text-xs"
                        value={spend[d.source] || ''}
                        onChange={(e) => handleSpendChange(d.source, e.target.value)}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs italic">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {isPortal && currentSpend > 0 ? calculateCPL(currentSpend, d.totalLeads) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {isPortal && currentSpend > 0 ? calculateCPA(currentSpend, d.wonLeads) : '-'}
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No source data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
