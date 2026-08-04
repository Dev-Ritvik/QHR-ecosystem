// apps/crm/scripts/publish-real-projects.ts
//
// Publishes every un-archived core project into the projection schema by
// calling the same publishProject() the CRM's publish button calls.
//
// Run:  pnpm dlx tsx apps/crm/scripts/publish-real-projects.ts
//
// It deliberately does NOT write to projection.* itself. The projection is a
// derived copy with a validation gate in front of it (hero image, narrative,
// approval number for land layouts, prices when visibility is public); a script
// that inserted rows directly would be free to publish a project the CRM would
// have refused, and the two would then disagree about what is live.

import { config } from 'dotenv';
import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { isNull } from 'drizzle-orm';
import * as schema from '@estate/db';
import { projects } from '@estate/db';
import { publishProject, checkPublishReadiness } from '../src/server/publish';

config({ path: path.resolve(__dirname, '../../../packages/db/.env') });

const url = process.env.DATABASE_URL_MIGRATIONS;
if (!url) {
  console.error('Set DATABASE_URL_MIGRATIONS in packages/db/.env');
  process.exit(1);
}

const client = postgres(url, { prepare: false });
const db = drizzle(client, { schema }) as any;

async function main() {
  const rows = await db.select().from(projects).where(isNull(projects.archivedAt));
  let failed = 0;

  for (const p of rows) {
    const { ok, checklist } = await checkPublishReadiness(db, p.id);
    if (!ok) {
      failed += 1;
      console.error(`\n${p.slug}: NOT READY`);
      for (const [k, v] of Object.entries(checklist)) if (v) console.error(`  - ${k}: ${v}`);
      continue;
    }
    const res = await publishProject(db, p.id);
    if (res.ok) {
      console.log(`${p.slug}: published`);
    } else {
      failed += 1;
      console.error(`${p.slug}: ${res.code}`, 'message' in res ? res.message : res.checklist);
    }
  }

  await client.end();
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
