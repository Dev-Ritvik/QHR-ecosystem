/**
 * apply_migration.ts — manual one-shot migration runner
 *
 * NOT a test. Run explicitly with:
 *   npx tsx apply_migration.ts migrations/<filename>.sql
 *
 * Requires DATABASE_URL_MIGRATIONS in the environment (superuser credentials).
 * Never import or call this from any test suite.
 */

import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import { config } from 'dotenv';

config();

const suConn = process.env.DATABASE_URL_MIGRATIONS;
if (!suConn) {
  console.error('ERROR: DATABASE_URL_MIGRATIONS is not set.');
  process.exit(1);
}

const sqlFilePath = process.argv[2];
if (!sqlFilePath) {
  console.error('Usage: npx tsx apply_migration.ts migrations/<filename>.sql');
  process.exit(1);
}

const resolvedPath = path.resolve(sqlFilePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`ERROR: File not found: ${resolvedPath}`);
  process.exit(1);
}

const sqlFile = fs.readFileSync(resolvedPath, 'utf8');
const suSql = postgres(suConn, { prepare: false });

async function run() {
  console.log(`Applying migration: ${resolvedPath}`);
  await suSql.unsafe(sqlFile);
  console.log('Migration applied successfully.');
  await suSql.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  suSql.end().finally(() => process.exit(1));
});
