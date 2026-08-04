import { describe, it, expect } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

// Drizzle wraps driver errors: the thrown error's `message` is always
// "Failed query: <sql>", and the Postgres error hangs off `cause`. Matching on
// message text therefore passes for ANY failure — including a syntax error or a
// dropped table — which is precisely the wrong behaviour for a test whose whole
// job is to prove a specific privilege is absent.
//
// So assert on SQLSTATE. 42501 is insufficient_privilege and nothing else, and
// unlike the English message it does not move between Postgres versions or
// locales.
const INSUFFICIENT_PRIVILEGE = '42501';

const sqlStateOf = (err: unknown): string | undefined => {
  for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
};

describe('Payment Ledger Append-Only Integrity (NFR-S7)', () => {
  it('prevents UPDATE and DELETE on payment_ledger via crm_app role', async () => {
    // Relying on the crm_app role credential populated in DATABASE_URL
    const url = process.env.DATABASE_URL_CRM || process.env.DATABASE_URL;
    if (!url) {
      console.warn('Skipping test: No CRM DB URL provided in environment.');
      return;
    }

    const client = postgres(url);
    const db = drizzle(client);

    try {
      // Assert that the permissions block edits regardless of row presence.
      // id = -1 matches nothing, so a successful query would affect zero rows —
      // the rejection can only come from the privilege check.
      for (const statement of [
        sql`UPDATE core.payment_ledger SET amount_paise = 1 WHERE id = -1`,
        sql`DELETE FROM core.payment_ledger WHERE id = -1`,
      ]) {
        const err = await db.execute(statement).then(
          () => null,
          (e: unknown) => e,
        );
        expect(err, 'expected the statement to be rejected').not.toBeNull();
        expect(sqlStateOf(err)).toBe(INSUFFICIENT_PRIVILEGE);
      }
    } finally {
      await client.end();
    }
  });
});
