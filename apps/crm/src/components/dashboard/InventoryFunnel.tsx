'use client';

type FunnelData = {
  projectName: string;
  status: string;
  count: number;
};

export function InventoryFunnel({ data }: { data: FunnelData[] }) {
  // Pivot data by project (columns follow the owner's 4-state view;
  // legacy not_for_sale rows count under the Mortgage bucket)
  const projects = Array.from(new Set(data.map(d => d.projectName)));
  const statuses = ['available', 'on_hold', 'booked', 'registered', 'sold', 'not_for_sale', 'mortgage'];

  const pivoted = projects.map(p => {
    const projData = data.filter(d => d.projectName === p);
    const counts: Record<string, number> = {};
    let total = 0;
    statuses.forEach(s => {
      const match = projData.find(d => d.status === s);
      counts[s] = match ? match.count : 0;
      total += counts[s];
    });
    return { projectName: p, counts, total };
  });

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <h3 className="font-semibold">Inventory Funnel</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium text-right">Available</th>
              <th className="px-3 py-2 font-medium text-right">Booked / Adv / Reserved</th>
              <th className="px-3 py-2 font-medium text-right">Sold Out</th>
              <th className="px-3 py-2 font-medium text-right">Mortgage</th>
              <th className="px-3 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pivoted.map(p => (
              <tr key={p.projectName}>
                <td className="px-3 py-2 font-medium">{p.projectName}</td>
                <td className="px-3 py-2 text-right text-green-600">{p.counts.available}</td>
                <td className="px-3 py-2 text-right text-blue-600">{p.counts.on_hold + p.counts.booked}</td>
                <td className="px-3 py-2 text-right text-gray-600">{p.counts.sold + p.counts.registered}</td>
                <td className="px-3 py-2 text-right text-amber-600">{p.counts.mortgage + p.counts.not_for_sale}</td>
                <td className="px-3 py-2 text-right font-semibold">{p.total}</td>
              </tr>
            ))}
            {pivoted.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No inventory data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
