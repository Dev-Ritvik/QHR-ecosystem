import { createAuthedCoreAccess } from '@estate/db';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

/**
 * CRM database access wrapper.
 * Authentication context is enforced per-query by the package implementation,
 * adhering to the RLS boundary (NFR-S3).
 */
export const { authedQuery, systemQuery } = createAuthedCoreAccess(process.env.DATABASE_URL);
