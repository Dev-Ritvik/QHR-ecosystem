// apps/crm/src/server/status-wiring.test.ts
//
// THE WIRING BETWEEN A PLOT'S STATUS, THE PROJECTION AND THE SITE — checked
// without a database (every other suite in this app needs a live one, and
// most of them write to it).
//
// What is held here was all found broken on 2026-10-07 by reading, not by a
// failing test, because nothing tested it:
//
//   a hold asked the status machine for 'held', a status that does not exist,
//   so no hold could ever be placed;
//   the hourly sweep recorded a lapsed hold and never returned its plot;
//   a booking changed a plot's status and never told the projection, so the
//   site's count of open plots stood still;
//   the intake kept sixty characters of an enquiry and dropped the rest.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEGAL_TRANSITIONS, transition, type UnitStatus } from '@estate/domain/unit-status/machine';

const src = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');
const STATUSES = Object.keys(LEGAL_TRANSITIONS).filter((s) => s !== 'initial') as UnitStatus[];

describe('a plot status, the projection and the site', () => {
  it('asks the status machine only for statuses it has', () => {
    for (const file of ['actions/holds.ts', 'actions/bookings.ts', 'actions/units.ts']) {
      const code = src(file);
      for (const m of code.matchAll(/transitionUnitStatusAction\(\s*[^,]+,\s*'([a-z_]+)'/g)) {
        expect(STATUSES, `${file} asks for '${m[1]}'`).toContain(m[1]);
      }
      for (const m of code.matchAll(/toStatus:\s*'([a-z_]+)'/g)) {
        expect(STATUSES, `${file} sets toStatus '${m[1]}'`).toContain(m[1]);
      }
    }
  });

  it('can place a hold: available to on_hold, with the hold it is for', () => {
    const holds = src('actions/holds.ts');
    expect(holds).toContain("transitionUnitStatusAction(unitId, 'on_hold', {");
    expect(holds).not.toMatch(/transitionUnitStatusAction\([^)]*'held'/);
    expect(transition({ fromStatus: 'available', toStatus: 'on_hold', holdId: 'h' }).ok).toBe(true);
    // what it used to ask for
    expect(transition({ fromStatus: 'available', toStatus: 'held' as UnitStatus, holdId: 'h' }).ok).toBe(false);
  });

  it('returns a plot when its hold lapses, and only a plot still on hold', () => {
    const sweep = src('../app/api/cron/expire-holds/route.ts');
    expect(sweep).toContain(".set({ status: 'available', statusChangedAt: new Date() })");
    expect(sweep).toContain(".where(and(eq(units.id, hold.unitId), eq(units.status, 'on_hold')))");
    expect(sweep).toContain('await republishAfterStatusChange(tx, projectId);');
    expect(transition({ fromStatus: 'on_hold', toStatus: 'available' }).ok).toBe(true);
  });

  it('tells the projection every time a booking changes a plot status', () => {
    const bookings = src('actions/bookings.ts');
    const sets = [...bookings.matchAll(/\.update\(schema\.units\)\s*\.set\(\{ status: '([a-z_]+)'/g)].map((m) => m[1]);
    expect(sets).toEqual(['booked', 'available', 'available', 'registered']);
    const hooks = bookings.match(/await republishAfterStatusChange\(tx, unit\.projectId\);/g) ?? [];
    expect(hooks.length).toBe(sets.length);
  });

  it('republishes in a way that cannot take the booking with it', () => {
    const publish = src('publish.ts');
    const hook = publish.slice(publish.indexOf('export async function republishAfterStatusChange'), publish.indexOf('export async function publishProject'));
    expect(hook).toContain('if (!project?.publishedAt) return;');
    expect(hook).toContain('try {');
    expect(hook).toContain("console.error('PROJECTION_DRIFT_DETECTED'");
    // publishProject itself works in a transaction of the handle it is given: a savepoint
    expect(publish).toContain('await db.transaction(async (tx: CoreTransaction) => {');
    // and a publish still tells the site
    expect(publish).toContain('await callRevalidate(projectSlug.slug);');
  });

  it('runs no scheduled job for a caller without the secret, least of all when there is no secret', async () => {
    const { cronAuthorized } = await import('./cron-auth');
    const before = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      // The template every route compared with was `Bearer ${undefined}`.
      expect(cronAuthorized('Bearer undefined')).toBe(false);
      expect(cronAuthorized(null)).toBe(false);
      process.env.CRON_SECRET = 'a-secret-of-some-length';
      expect(cronAuthorized('Bearer a-secret-of-some-length')).toBe(true);
      expect(cronAuthorized('Bearer a-secret-of-some-lengtH')).toBe(false);
      expect(cronAuthorized('Bearer a-secret')).toBe(false);
      expect(cronAuthorized('a-secret-of-some-length')).toBe(false);
      expect(cronAuthorized('')).toBe(false);
    } finally {
      if (before === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = before;
    }
    // and every route asks it
    for (const job of ['daily-notifications', 'demo-export', 'digest', 'expire-holds', 'expiry-alerts', 'reconcile', 'telemetry-retention']) {
      const route = src(`../app/api/cron/${job}/route.ts`);
      expect(route, job).toContain('cronAuthorized(');
      expect(route, job).not.toContain('process.env.CRON_SECRET');
    }
  });

  it('keeps a website enquiry whole, and a bad layout id does not lose the lead', () => {
    const intake = src('../app/api/enquiries/route.ts');
    expect(intake).toContain('const said = describeEnquiry(payload);');
    expect(intake).toContain('sourceDetail: said.detail ?? undefined,');
    expect(intake).toContain('timelineExpectation: said.head ?? undefined,');
    expect(intake).not.toContain('payload.message.substring(0, 60)');
    // ids are taken only if they are ids, and the interest goes in under a savepoint
    expect(intake).toContain("typeof payload.projectId === 'string' && UUID.test(payload.projectId)");
    expect(intake).toMatch(/await tx\.transaction\(async \(sp\) => \{\s*await sp\.insert\(leadInterests\)/);
    // the lead page shows it
    const page = src('../app/(app)/leads/[leadId]/page.tsx');
    expect(page).toContain('The enquiry, as it was sent');
    expect(page).toContain('Layouts asked about');
  });
});
