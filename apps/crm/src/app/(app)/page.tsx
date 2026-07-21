// apps/crm/src/app/(app)/page.tsx
import { Suspense } from 'react';
import { authedQuery } from '@/server/db';
import { leads, siteVisits, siteVisitLeads, users, type CoreTransaction } from '@estate/db';
import { eq, and, isNull, lt, lte, gte, notInArray, or, desc } from 'drizzle-orm';
import { getRoleContext } from '@/server/session';
import { redirect } from 'next/navigation';
import { AlertCircle, Clock, Calendar, UserPlus } from 'lucide-react';
import { QueueCard } from '@/components/dashboard/QueueCard';
import { CaptureOutcomeDialog } from '@/components/visits/CaptureOutcomeDialog';

export default async function DashboardPage() {
  const context = await getRoleContext();
  if (!context) redirect('/login');

  const isOwner = context.role === 'owner';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
  
  const ESCALATION_DAYS = 3;
  const escalationThreshold = new Date(startOfToday.getTime() - ESCALATION_DAYS * 24 * 60 * 60 * 1000);

  const activeLeadsBase = and(
    isNull(leads.archivedAt),
    notInArray(leads.stage, ['won', 'lost', 'dormant'])
  );

  const roleCondition = isOwner ? undefined : eq(leads.assignedAgentId, context.userId);

  // 1. Overdue
  const overdueCondition = isOwner 
    ? lt(leads.nextFollowUpAt, escalationThreshold) 
    : lt(leads.nextFollowUpAt, startOfToday);

  const { overdueRaw, dueTodayRaw, newLeadsRaw, visitsRawQuery } = await authedQuery(context, async (tx: CoreTransaction) => {
    const overdueRaw = await tx.select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        nextFollowUpAt: leads.nextFollowUpAt,
        agentName: users.name
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedAgentId, users.id))
      .where(and(activeLeadsBase, roleCondition, overdueCondition))
      .orderBy(leads.nextFollowUpAt);

    // 2. Due Today
    const dueTodayCondition = and(
      gte(leads.nextFollowUpAt, startOfToday),
      lte(leads.nextFollowUpAt, endOfToday)
    );

    const dueTodayRaw = await tx.select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        nextFollowUpAt: leads.nextFollowUpAt,
        agentName: users.name
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedAgentId, users.id))
      .where(and(activeLeadsBase, roleCondition, dueTodayCondition))
      .orderBy(leads.nextFollowUpAt);

    // 3. New Leads
    const newLeadsCondition = and(
      eq(leads.stage, 'new'),
      isNull(leads.nextFollowUpAt)
    );

    const newLeadsRaw = await tx.select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        createdAt: leads.createdAt,
        agentName: users.name
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedAgentId, users.id))
      .where(and(activeLeadsBase, roleCondition, newLeadsCondition))
      .orderBy(desc(leads.createdAt));

    // 4. Site Visits (Today + Uncaptured)
    const visitsRoleCondition = isOwner ? undefined : eq(siteVisits.agentId, context.userId);
    const relevantVisitsCondition = or(
      and(gte(siteVisits.scheduledAt, startOfToday), lte(siteVisits.scheduledAt, endOfToday)),
      and(eq(siteVisits.status, 'completed'), isNull(siteVisits.outcomeCapturedAt))
    );

    const visitsRawQuery = await tx.select({
        id: siteVisits.id,
        scheduledAt: siteVisits.scheduledAt,
        status: siteVisits.status,
        outcomeCapturedAt: siteVisits.outcomeCapturedAt,
        agentName: users.name,
        leadName: leads.name,
        leadId: leads.id
      })
      .from(siteVisits)
      .leftJoin(users, eq(siteVisits.agentId, users.id))
      .leftJoin(siteVisitLeads, eq(siteVisits.id, siteVisitLeads.visitId))
      .leftJoin(leads, eq(siteVisitLeads.leadId, leads.id))
      .where(and(visitsRoleCondition, relevantVisitsCondition))
      .orderBy(siteVisits.scheduledAt);

    return { overdueRaw, dueTodayRaw, newLeadsRaw, visitsRawQuery };
  });

  const visitsMap = new Map();
  for (const v of visitsRawQuery) {
    if (!visitsMap.has(v.id)) visitsMap.set(v.id, { ...v, leadNames: [], primaryLeadId: v.leadId });
    if (v.leadName) visitsMap.get(v.id).leadNames.push(v.leadName);
  }
  const visitsCombined = Array.from(visitsMap.values());

  const formatTime = (date: Date) => 
    new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);

  const mapLead = (l: any) => ({
    id: l.id,
    href: `/leads/${l.id}`,
    title: l.name,
    subtitle: l.nextFollowUpAt ? `Due: ${formatTime(l.nextFollowUpAt)}` : `Phone: ${l.phone}`,
    agentName: l.agentName
  });

  const overdueMapped = overdueRaw.map(mapLead);
  const dueTodayMapped = dueTodayRaw.map(mapLead);
  
  const newLeadsMapped = newLeadsRaw.map((l: any) => ({
    id: l.id,
    href: `/leads/${l.id}`,
    title: l.name,
    subtitle: `Assigned: ${new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(l.createdAt)}`,
    agentName: l.agentName
  }));
  
  const visitsMapped = visitsCombined.map((v: any) => ({
    id: v.id,
    // Triggers the CaptureOutcomeDialog via search param
    href: v.status === 'completed' && !v.outcomeCapturedAt 
      ? `?capture=${v.id}` 
      : (v.primaryLeadId ? `/leads/${v.primaryLeadId}` : '#'),
    title: v.leadNames.length > 0 ? v.leadNames.join(', ') : 'No Lead Assigned',
    subtitle: v.status === 'completed' && !v.outcomeCapturedAt 
      ? 'Action Required: Capture Outcome'
      : `Scheduled: ${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(v.scheduledAt)}`,
    agentName: v.agentName
  }));

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Today</h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          {isOwner 
            ? `Office overview • Escalated overdue (> ${ESCALATION_DAYS} days)` 
            : 'Your follow-up queue and schedule for today'}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QueueCard 
          title={isOwner ? "Escalated Overdue" : "Overdue"}
          icon={AlertCircle}
          theme="destructive"
          items={overdueMapped}
          emptyMessage={isOwner ? "No escalated follow-ups in the office." : "You're all caught up on past follow-ups!"}
          isOwner={isOwner}
        />

        <QueueCard 
          title="Due Today"
          icon={Clock}
          theme="primary"
          items={dueTodayMapped}
          emptyMessage="No follow-ups scheduled for today."
          isOwner={isOwner}
        />

        <QueueCard 
          title="Site Visits & Outcomes"
          icon={Calendar}
          theme="warning"
          items={visitsMapped}
          emptyMessage="No visits scheduled today or pending outcomes."
          isOwner={isOwner}
        />

        <QueueCard 
          title="New Leads"
          icon={UserPlus}
          theme="success"
          items={newLeadsMapped}
          emptyMessage="No new un-contacted leads."
          isOwner={isOwner}
        />
      </div>

      <Suspense fallback={null}>
        <CaptureOutcomeDialog />
      </Suspense>
    </div>
  );
}
