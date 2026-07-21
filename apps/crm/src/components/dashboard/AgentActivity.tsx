'use client';

type ActivityData = {
  agentName: string;
  type: string;
  count: number;
};

export function AgentActivity({ data }: { data: ActivityData[] }) {
  const agents = Array.from(new Set(data.map(d => d.agentName)));
  const types = ['interaction', 'stage_change', 'follow_up_set', 'note'];

  const pivoted = agents.map(a => {
    const aData = data.filter(d => d.agentName === a);
    const counts: Record<string, number> = {};
    let total = 0;
    types.forEach(t => {
      const match = aData.find(d => d.type === t);
      counts[t] = match ? match.count : 0;
      total += counts[t];
    });
    return { agentName: a, counts, total };
  }).sort((a, b) => b.total - a.total); // Sort by most active

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <h3 className="font-semibold">Agent Activity (Last 30 Days)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Agent</th>
              <th className="px-3 py-2 font-medium text-right">Interactions</th>
              <th className="px-3 py-2 font-medium text-right">Stage Moves</th>
              <th className="px-3 py-2 font-medium text-right">Notes</th>
              <th className="px-3 py-2 font-medium text-right">Total Events</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pivoted.map(a => (
              <tr key={a.agentName}>
                <td className="px-3 py-2 font-medium">{a.agentName}</td>
                <td className="px-3 py-2 text-right">{a.counts.interaction}</td>
                <td className="px-3 py-2 text-right">{a.counts.stage_change}</td>
                <td className="px-3 py-2 text-right">{a.counts.note}</td>
                <td className="px-3 py-2 text-right font-semibold">{a.total}</td>
              </tr>
            ))}
            {pivoted.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No activity in 30 days</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
