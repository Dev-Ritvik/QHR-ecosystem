// apps/crm/src/server/cron-auth.ts
//
// WHO MAY RUN A SCHEDULED JOB.
//
// Each of the seven cron routes compared the request's Authorization header
// with `Bearer ${process.env.CRON_SECRET}` — and where CRON_SECRET is not
// set, that template is the literal string "Bearer undefined". A deployment
// that had forgotten the variable did not have closed jobs; it had jobs that
// anybody could run by sending those two words: the sweep that returns held
// plots, the export, the job that deletes old telemetry.
//
// Closed when there is no secret, and compared in constant time when there is.

import crypto from 'crypto';

export function cronAuthorized(header: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
