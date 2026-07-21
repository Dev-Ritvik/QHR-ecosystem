import { systemQuery } from './src/server/db';
import { sql } from 'drizzle-orm';

async function grantExtensions() {
  try {
    const res = await systemQuery(async (tx) => {
      await tx.execute(sql`GRANT USAGE ON SCHEMA extensions TO crm_app;`);
    });
    console.log("Success: granted USAGE on extensions to crm_app");
  } catch (err) {
    console.error("Failed:", err);
  }
}
grantExtensions();
