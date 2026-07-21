'use client';

import { formatPaise } from '@estate/domain/money/format';

type PipelineData = {
  stage: string;
  valuePaise: string | null;
  count: number;
};

export function PipelineValue({ data }: { data: PipelineData[] }) {
  const stageOrder = [
    'new', 'contacted', 'qualified', 'site_visit', 'negotiation', 
    'token', 'agreement', 'registered', 'won', 'lost', 'dormant'
  ];

  const sortedData = [...data].sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <h3 className="font-semibold">Pipeline Value by Stage</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium text-right">Leads</th>
              <th className="px-3 py-2 font-medium text-right">Potential Value (Max Budget)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedData.map(d => (
              <tr key={d.stage}>
                <td className="px-3 py-2 capitalize font-medium">{d.stage.replace('_', ' ')}</td>
                <td className="px-3 py-2 text-right">{d.count}</td>
                <td className="px-3 py-2 text-right font-medium text-green-700">
                  {d.valuePaise ? formatPaise(BigInt(d.valuePaise)) : '₹0'}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No pipeline data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
