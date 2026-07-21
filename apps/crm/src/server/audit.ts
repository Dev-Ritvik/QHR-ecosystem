import { auditLog } from "@estate/db";
import { authedQuery } from "@/server/db";
import { getRoleContext } from "@/server/session";
import { headers } from "next/headers";

type AuditPayload = {
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
};

/**
 * Server helper to append an entry to the immutable audit_log.
 * Satisfies FR-C21 and NFR-S7 (append-only enforcement).
 */
export async function writeAudit(payload: AuditPayload, tx?: any) {
  const context = await getRoleContext();
  
  if (!context) {
    throw new Error("writeAudit requires an active session context to enforce RLS.");
  }

  // Default to the current session user if actor is not explicitly provided (e.g. system jobs)
  const actorId = payload.actorId || context.userId;

  let ipAddress = payload.ipAddress;
  if (!ipAddress) {
    const headersList = await headers();
    ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  }

  // before/after go into jsonb columns; audited entities routinely contain
  // BigInt money fields (paise), which JSON.stringify rejects — stringify them.
  const jsonSafe = (value: unknown) =>
    value === undefined || value === null
      ? value
      : JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)));

  const doInsert = async (transaction: any) => {
    await transaction.insert(auditLog).values({
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId,
      actorId,
      before: jsonSafe(payload.before),
      after: jsonSafe(payload.after),
      ipAddress,
    });
  };

  if (tx) {
    await doInsert(tx);
  } else {
    // Use the authenticated DAL to enforce RLS backstops and role grants automatically
    await authedQuery(context, doInsert);
  }
}
