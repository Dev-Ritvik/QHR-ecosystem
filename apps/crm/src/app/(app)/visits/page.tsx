// apps/crm/src/app/(app)/visits/page.tsx
import { Suspense } from 'react';
import { authedQuery } from '@/server/db';
import { siteVisits, siteVisitLeads, siteVisitUnits, leads, units, projects, users, type CoreTransaction } from '@estate/db';
import { eq, inArray, isNull, asc, and } from 'drizzle-orm';
import { getRoleContext } from '@/server/session';
import { redirect } from 'next/navigation';
import { VisitCalendar } from '@/components/visits/VisitCalendar';
import { ScheduleVisitDialog } from '@/components/visits/ScheduleVisitDialog';
import { CaptureOutcomeDialog } from '@/components/visits/CaptureOutcomeDialog';

export default async function VisitsPage() {
  const context = await getRoleContext();
  if (!context) redirect('/login');
  
  const isOwner = context.role === 'owner';

  const { agentsData, leadsData, unitsData, visitsRaw, linkedLeads, linkedUnits } = await authedQuery(context, async (tx: CoreTransaction) => {
    const agentsData = await tx.select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, 'agent'));

    const leadsData = await tx.select({ id: leads.id, name: leads.name, phone: leads.phone })
      .from(leads)
      .where(
        isOwner 
          ? isNull(leads.archivedAt) 
          : and(isNull(leads.archivedAt), eq(leads.assignedAgentId, context.userId))
      );

    const unitsData = await tx.select({ 
        id: units.id, 
        unitNumber: units.unitNumber, 
        projectName: projects.name 
      })
      .from(units)
      .innerJoin(projects, eq(units.projectId, projects.id))
      .where(isNull(units.archivedAt));

    const visitsRaw = await tx.select({
        id: siteVisits.id,
        scheduledAt: siteVisits.scheduledAt,
        status: siteVisits.status,
        outcomeCapturedAt: siteVisits.outcomeCapturedAt,
        pickupPoint: siteVisits.pickupPoint,
        vehicleNote: siteVisits.vehicleNote,
        agentName: users.name,
      })
      .from(siteVisits)
      .leftJoin(users, eq(siteVisits.agentId, users.id))
      .where(
        isOwner 
          ? undefined 
          : eq(siteVisits.agentId, context.userId)
      );

    const visitIds = visitsRaw.map((v: any) => v.id);

    let linkedLeads: any[] = [];
    let linkedUnits: any[] = [];

    if (visitIds.length > 0) {
      linkedLeads = await tx.select({ visitId: siteVisitLeads.visitId, name: leads.name })
        .from(siteVisitLeads)
        .innerJoin(leads, eq(siteVisitLeads.leadId, leads.id))
        .where(inArray(siteVisitLeads.visitId, visitIds));

      linkedUnits = await tx.select({ 
          visitId: siteVisitUnits.visitId, 
          unitNumber: units.unitNumber, 
          projectName: projects.name,
          sortOrder: siteVisitUnits.sortOrder
        })
        .from(siteVisitUnits)
        .innerJoin(units, eq(siteVisitUnits.unitId, units.id))
        .innerJoin(projects, eq(units.projectId, projects.id))
        .where(inArray(siteVisitUnits.visitId, visitIds))
        .orderBy(asc(siteVisitUnits.sortOrder));
    }
    
    return { agentsData, leadsData, unitsData, visitsRaw, linkedLeads, linkedUnits };
  });

  const formattedVisits = visitsRaw.map((v: any) => ({
    ...v,
    leads: linkedLeads.filter((ll: any) => ll.visitId === v.id).map((ll: any) => ll.name),
    units: linkedUnits.filter((lu: any) => lu.visitId === v.id).map((lu: any) => `${lu.projectName} ${lu.unitNumber}`),
  }));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Visits</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {isOwner ? 'Office-wide calendar and scheduling' : 'Your scheduled visits'}
          </p>
        </div>
        
        <ScheduleVisitDialog 
          agents={agentsData}
          leads={leadsData}
          units={unitsData}
          currentUserId={context.userId}
          isOwner={isOwner}
        />
      </header>

      <VisitCalendar visits={formattedVisits} isOwner={isOwner} />

      <Suspense fallback={null}>
        <CaptureOutcomeDialog />
      </Suspense>
    </div>
  );
}
