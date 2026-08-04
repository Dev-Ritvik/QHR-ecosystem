import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Read packages/db/.env the same way the specs themselves do, so a developer
// with a local database keeps running them without exporting anything.
config();

// Every spec in this package is an INTEGRATION test: each one opens a real
// Postgres connection and needs both the superuser and the crm_app role, and
// they throw at import time when the URLs are absent. The CI job is
// "Typecheck, Lint, and Unit Tests" and provisions no database, so that throw
// took down the whole run rather than reporting a skip.
//
// Collect them only when a database is actually configured. To run them in CI,
// give the job a postgres service and set both URLs - the specs need no change.
const hasDb = Boolean(
  process.env.DATABASE_URL_MIGRATIONS && process.env.DATABASE_URL_CRM,
);

export default defineConfig({
  test: {
    include: hasDb ? ['src/**/*.test.ts'] : [],
    // Without this an empty run is itself a failure, which would just swap one
    // red job for another.
    passWithNoTests: true,

    // Vitest's defaults (5s test, 10s hook) assume a local database. These
    // specs talk to a hosted one where a single round trip costs ~2s, and
    // rls-context's beforeAll plants users, clients, leads, projects, units,
    // bookings, holds, visits, ledger rows and documents in sequence — around
    // a dozen statements, so it crosses 10s on latency alone and fails with
    // "Hook timed out" while the assertions themselves are fine.
    //
    // Raised rather than parallelised: the fixture inserts have genuine FK
    // ordering between them, and a flaky suite that passes on a fast link and
    // fails on a slow one is worse than a slow one that is honest.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
