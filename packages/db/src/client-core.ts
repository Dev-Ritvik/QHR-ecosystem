import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Import all core schema definitions
import * as auth from './schema/core/auth';
import * as projects from './schema/core/projects';
import * as priceVersions from './schema/core/price-versions';
import * as units from './schema/core/units';
import * as unitDetailsLand from './schema/core/unit-details-land';
import * as unitDetailsCommercial from './schema/core/unit-details-commercial';
import * as unitDetailsLuxury from './schema/core/unit-details-luxury';
import * as clients from './schema/core/clients';
import * as leads from './schema/core/leads';
import * as leadEvents from './schema/core/lead-events';
import * as holds from './schema/core/holds';
import * as bookings from './schema/core/bookings';
import * as unitStatusEvents from './schema/core/unit-status-events';
import * as siteVisits from './schema/core/site-visits';
import * as documents from './schema/core/documents';
import * as paymentLedger from './schema/core/payment-ledger';
import * as commissionRules from './schema/core/commission-rules';
import * as commissionEntries from './schema/core/commission-entries';
import * as commissionOverrides from './schema/core/commission-overrides';
import * as geometryVersions from './schema/core/geometry-versions';
import * as unitGeometries from './schema/core/unit-geometries';
import * as pois from './schema/core/pois';
import * as auditLog from './schema/core/audit-log';
import * as media from './schema/core/media';
import * as notifications from './schema/core/notifications';
import * as officeSettings from './schema/core/office-settings';
import * as userSettings from './schema/core/user-settings';
import * as coreRelations from './schema/core/relations';

export const coreSchema = {
  ...auth,
  ...projects,
  ...priceVersions,
  ...units,
  ...unitDetailsLand,
  ...unitDetailsCommercial,
  ...unitDetailsLuxury,
  ...clients,
  ...leads,
  ...leadEvents,
  ...holds,
  ...bookings,
  ...unitStatusEvents,
  ...siteVisits,
  ...documents,
  ...paymentLedger,
  ...commissionRules,
  ...commissionEntries,
  ...commissionOverrides,
  ...geometryVersions,
  ...unitGeometries,
  ...pois,
  ...auditLog,
  ...media,
  ...notifications,
  ...officeSettings,
  ...userSettings,
  ...coreRelations,
};

// ---------------------------------------------------------------------------
// Session context types
// ---------------------------------------------------------------------------

/** The authenticated user's identity for RLS context injection. */
export type AppSession = {
  role: 'owner' | 'agent';
  userId: string; // UUID
};

// ---------------------------------------------------------------------------
// Client factory & RLS Context wrapper (Single Export)
// ---------------------------------------------------------------------------

/**
 * Creates a connection pool and returns the authenticated querying interface.
 * The raw Drizzle client is kept securely inside the closure.
 * Maps to NFR-S1 / ADR-002.
 */
export function createAuthedCoreAccess(connectionString: string) {
  // prepare: false is required for compatibility with Supabase pooler (PgBouncer in transaction mode)
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema: coreSchema });

  return {
    /**
     * Runs `fn` inside a transaction with `SET LOCAL app.role` and
     * `SET LOCAL app.user_id` applied.
     *
     * This is the **sole** public API for executing authenticated queries against
     * the `core` schema.
     */
    authedQuery: async <T>(
      session: AppSession,
      fn: (tx: CoreTransaction) => Promise<T>,
    ): Promise<T> => {
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.role', ${session.role}, true)`);
        await tx.execute(sql`SELECT set_config('app.user_id', ${session.userId}, true)`);
        return fn(tx);
      });
    },
    /**
     * Runs `fn` inside a transaction with `app.role = 'owner'` context, so
     * owner-scoped RLS policies grant full visibility. Note this does NOT
     * bypass RLS at the Postgres level: tables with RLS enabled but no
     * policy remain default-deny for the `crm_app` role.
     * Intended ONLY for system-level operations like crons or webhooks.
     */
    systemQuery: async <T>(
      fn: (tx: CoreTransaction) => Promise<T>,
    ): Promise<T> => {
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.role', 'owner', true)`);
        return fn(tx);
      });
    },
  };
}

export type DbType = import('drizzle-orm/postgres-js').PostgresJsDatabase<typeof coreSchema>;
/** The transaction handle passed to `authedQuery` callbacks. */
export type CoreTransaction = Parameters<Parameters<DbType['transaction']>[0]>[0];
