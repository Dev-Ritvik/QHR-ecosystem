// apps/crm/src/app/(app)/leads/inbox/page.tsx
// (TS Server force refresh)
import { authedQuery } from '@/server/db';
import { coreSchema as schema, type CoreTransaction } from '@estate/db';
import { eq, desc, inArray, and, ne } from 'drizzle-orm';
import { getRoleContext } from '@/server/session';
import { redirect } from 'next/navigation';
import { TriageTable } from '@/components/leads/TriageTable';

export default async function InboxPage() {
  const context = await getRoleContext();
  // Role scope: Enforce owner access per elite doc logic and permission matrix
  if (!context || context.role !== 'owner') {
    redirect('/leads');
  }

  const { inboxLeads, existingLeads, agents } = await authedQuery(context, async (tx: CoreTransaction) => {
    // Fetch only incoming 'new' status leads from enquiry endpoints
    const inboxLeads = await tx.select().from(schema.leads)
      .where(eq(schema.leads.triageStatus, 'new'))
      .orderBy(desc(schema.leads.createdAt));

    const phones = inboxLeads.map(l => l.phone).filter(Boolean);
    
    // Find potential duplicates among active/existing leads
    let existingLeads: any[] = [];
    if (phones.length > 0) {
      existingLeads = await tx.select().from(schema.leads)
        .where(
          and(
            inArray(schema.leads.phone, phones),
            ne(schema.leads.triageStatus, 'new') // exclude other inbox items
          )
        )
        .orderBy(desc(schema.leads.createdAt));
    }

    // Fetch valid agents to assign to
    const agents = await tx.select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.role, 'agent'));

    return { inboxLeads, existingLeads, agents };
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Triage Inbox</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            New enquiries awaiting assignment, merging, or marking as spam.
          </p>
        </div>
      </header>
      
      <TriageTable 
        inboxLeads={inboxLeads} 
        agents={agents} 
        existingLeads={existingLeads} 
      />
    </div>
  );
}
