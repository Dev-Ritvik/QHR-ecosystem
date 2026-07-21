import { getOwnerDashboardData } from '@/server/actions/dashboard';
import { InventoryFunnel } from '@/components/dashboard/InventoryFunnel';
import { PipelineValue } from '@/components/dashboard/PipelineValue';
import { AgentActivity } from '@/components/dashboard/AgentActivity';
import { LeadSourceRoi } from '@/components/dashboard/LeadSourceRoi';
import { UpcomingExpiries } from '@/components/dashboard/UpcomingExpiries';

export default async function OwnerDashboardPage() {
  const data = await getOwnerDashboardData();

  // Serialization for BigInt and Dates to pass securely to client components
  const serializedHolds = data.expiringHolds.map((h: any) => ({
    ...h,
    startsAt: h.startsAt.toISOString(),
    expiresAt: h.expiresAt.toISOString(),
    createdAt: h.createdAt.toISOString(),
  }));

  const serializedFollowUps = data.upcomingFollowUps.map((l: any) => ({
    ...l,
    nextFollowUpAt: l.nextFollowUpAt?.toISOString(),
  }));

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owner Dashboard</h1>
        <p className="text-muted-foreground mt-1">High-level view of inventory, pipeline, and office activity.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InventoryFunnel data={data.inventoryFunnel} />
        <PipelineValue data={data.pipelineValue} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentActivity data={data.agentActivity} />
        <LeadSourceRoi data={data.leadSourceRoi} />
      </div>

      <UpcomingExpiries 
        holds={serializedHolds} 
        docs={data.expiringDocs} 
        followUps={serializedFollowUps} 
      />
    </div>
  );
}
