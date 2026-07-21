// apps/crm/src/app/(app)/leads/[leadId]/page.tsx
import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { leads, leadEvents, leadInterests, units, projects, type CoreTransaction } from '@estate/db';
import { eq, ne, and, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { StageStepper } from '@/components/leads/StageStepper';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { InteractionLogger } from '@/components/leads/InteractionLogger';
import { NegotiationLogger } from '@/components/leads/NegotiationLogger';
import { FloorPriceReveal } from '@/components/leads/FloorPriceReveal';
import { PrivilegedEntries } from '@/components/leads/PrivilegedEntries';
import { formatPaise } from '@estate/domain/src/money/format';

export default async function LeadPage({ params }: { params: { leadId: string } }) {
  const context = await getRoleContext();
  if (!context) notFound();
  const isOwner = context.role === 'owner';

  return await authedQuery(context, async (tx: CoreTransaction) => {
    const [lead] = await tx.select().from(leads).where(eq(leads.id, params.leadId));
    if (!lead) notFound();

    // Negotiation events are privileged (owner-only RLS) — they surface only
    // through the audited reveal in the Privileged Info panel, not the open
    // timeline, matching the floor-price audited-read pattern.
    const events = await tx.select()
      .from(leadEvents)
      .where(and(eq(leadEvents.leadId, lead.id), ne(leadEvents.type, 'negotiation')))
      .orderBy(desc(leadEvents.createdAt));

    // Pull interested units to populate the negotiation form
    const interestsRaw = await tx.select({
      unitId: leadInterests.unitId,
      unitNumber: units.unitNumber,
      projectName: projects.name
    })
    .from(leadInterests)
    .leftJoin(units, eq(leadInterests.unitId, units.id))
    .leftJoin(projects, eq(leadInterests.projectId, projects.id))
    .where(eq(leadInterests.leadId, lead.id));

    const unitsOfInterest = interestsRaw
      .filter(i => i.unitId && i.unitNumber)
      .map(i => ({ id: i.unitId!, label: `${i.projectName} - ${i.unitNumber}` }));

    return (
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <header className="flex items-center justify-between border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{lead.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {lead.phone} • Source: <span className="capitalize">{lead.source.replace('_', ' ')}</span>
              {lead.sourceDetail && ` (${lead.sourceDetail})`}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Pipeline & History Column */}
          <div className="xl:col-span-2 space-y-8">
            <section className="bg-card border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight mb-6">Pipeline Stage</h2>
              <StageStepper leadId={lead.id} currentStage={lead.stage} />
            </section>

            <section className="bg-card border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight mb-6">Event Timeline</h2>
              <LeadTimeline events={events} />
            </section>
          </div>

          {/* Action & Detail Sidebar */}
          <div className="space-y-6">
            
            {/* Owner Only Block */}
            {isOwner && (
              <section className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-semibold tracking-tight">Privileged Info</h2>
                <FloorPriceReveal leadId={lead.id} />
                <PrivilegedEntries leadId={lead.id} unitsOfInterest={unitsOfInterest} />
              </section>
            )}

            <section className="bg-card border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight mb-4">Log Interaction</h2>
              <InteractionLogger leadId={lead.id} />
            </section>

            {['negotiation', 'site_visit', 'token'].includes(lead.stage) && (
              <section className="bg-card border border-orange-200/50 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight mb-4">Log Negotiation</h2>
                <NegotiationLogger leadId={lead.id} unitsOfInterest={unitsOfInterest} />
              </section>
            )}

            <section className="bg-card border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight mb-4">Lead Profile</h2>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Asset Interest</dt>
                  <dd className="font-medium capitalize text-foreground">
                    {lead.assetClassInterest?.replace('_', ' ') || 'Unknown'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Budget Envelope</dt>
                  <dd className="font-medium text-foreground">
                    {lead.budgetMinPaise 
                      ? `${formatPaise(lead.budgetMinPaise)} - ${formatPaise(lead.budgetMaxPaise!)}` 
                      : 'Not specified'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Timeline Expectation</dt>
                  <dd className="font-medium text-foreground">
                    {lead.timelineExpectation || 'Not specified'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    );
  });
}
