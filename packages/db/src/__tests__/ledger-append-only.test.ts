import { describe, it, expect } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

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

    // Assert that the permissions block edits regardless of row presence
    await expect(
      db.execute(sql`UPDATE core.payment_ledger SET amount_paise = 1 WHERE id = -1`)
    ).rejects.toThrow(/permission denied for table payment_ledger/);

    await expect(
      db.execute(sql`DELETE FROM core.payment_ledger WHERE id = -1`)
    ).rejects.toThrow(/permission denied for table payment_ledger/);

    await client.end();
  });
});
