// apps/crm/src/app/(app)/audit/page.tsx
import { authedQuery } from '@/server/db';
import { coreSchema as schema } from '@estate/db';
import { desc, eq } from 'drizzle-orm';
import { AuditLogViewer } from '@/components/audit/AuditLogViewer';
import { requireOwner } from '@/server/session';
import { redirect } from 'next/navigation';

export default async function AuditLogPage() {
  const ownerCheck = await requireOwner();

  // NFR-S3: Owner only access to audit log
  if (!ownerCheck.ok) {
    if (ownerCheck.code === "UNAUTHENTICATED") redirect("/login");
    return <div className="p-6 text-destructive">Unauthorized. Owner access required.</div>;
  }

  const context = { userId: ownerCheck.session.user.id, role: 'owner' as const };

  // Fetch top 1000 events to feed the fast client-side filter
  const rawLogs = await authedQuery(context, async (tx) => {
    return await tx.select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      entityType: schema.auditLog.entityType,
      entityId: schema.auditLog.entityId,
      before: schema.auditLog.before,
      after: schema.auditLog.after,
      ipAddress: schema.auditLog.ipAddress,
      createdAt: schema.auditLog.createdAt,
      actorName: schema.users.name,
    })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(1000);
  });

  // Serialize BigInt and Date to prevent Server Component serialization errors
  const serializedLogs = rawLogs.map(l => ({
    ...l,
    id: l.id.toString(),
    createdAt: l.createdAt.toISOString()
  }));

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground mt-1">Immutable record of system activity and data mutations.</p>
      </div>
      
      <AuditLogViewer logs={serializedLogs} />
    </div>
  );
}
