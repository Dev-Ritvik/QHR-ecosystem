// apps/crm/src/app/api/cron/reconcile/route.ts
import { NextResponse } from 'next/server';
import { eq, isNotNull, isNull, and } from 'drizzle-orm';
import { systemQuery } from '@/server/db';
import { projects, units, projectsPub, unitsPub } from '@estate/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const driftDetails: string[] = [];

  try {
    await systemQuery(async (db) => {
      // Fetch core published projects
      const corePublished = await db.select().from(projects).where(isNotNull(projects.publishedAt));
      const pubProjects = await db.select().from(projectsPub);

      const pubProjectIds = new Set(pubProjects.map((p: any) => p.projectId));
      const coreProjectIds = new Set(corePublished.map((p: any) => p.id));

      // 1. Missing in projection
      for (const p of corePublished) {
        if (!pubProjectIds.has(p.id)) {
          driftDetails.push(`Project ${p.id} (${p.slug}) has publishedAt but is missing in projection`);
        }
      }

      // 2. Extraneous in projection
      for (const p of pubProjects) {
        if (!coreProjectIds.has(p.projectId)) {
          driftDetails.push(`Project ${p.projectId} (${p.slug}) is in projection but not published in core`);
        }
      }

      // 3. Count diffs for shared projects
      for (const p of corePublished) {
        if (!pubProjectIds.has(p.id)) continue;

        const pubP = pubProjects.find((x: any) => x.projectId === p.id);
        if (!pubP) continue; // unreachable: guarded by pubProjectIds.has above
        const coreUnitsList = await db.select().from(units).where(and(eq(units.projectId, p.id), isNull(units.archivedAt)));
        const pubUnitsList = await db.select().from(unitsPub).where(eq(unitsPub.projectId, p.id));

        const coreTotalUnits = coreUnitsList.length;
        const coreAvailableUnits = coreUnitsList.filter((u: any) => u.status === 'available').length;

        if (pubP.totalUnits !== coreTotalUnits) {
          driftDetails.push(`Project ${p.id} totalUnits mismatch: core=${coreTotalUnits}, pub=${pubP.totalUnits}`);
        }
        if (pubP.availableUnits !== coreAvailableUnits) {
          driftDetails.push(`Project ${p.id} availableUnits mismatch: core=${coreAvailableUnits}, pub=${pubP.availableUnits}`);
        }

        if (coreUnitsList.length !== pubUnitsList.length) {
          driftDetails.push(`Project ${p.id} units rows mismatch: core=${coreUnitsList.length}, pub=${pubUnitsList.length}`);
        }
      }
    });

    if (driftDetails.length > 0) {
      // Alert on drift (Sentry captures console.error by default in standard configurations)
      console.error('PROJECTION_DRIFT_DETECTED', { driftCount: driftDetails.length, details: driftDetails });
    } else {
      console.log('Reconciliation complete. No drift detected.');
    }

    // Ping BetterStack heartbeat
    if (process.env.BETTERSTACK_HEARTBEAT_RECONCILE) {
      try {
        await fetch(process.env.BETTERSTACK_HEARTBEAT_RECONCILE, { method: 'POST' });
      } catch (e) {
        console.error('Failed to ping BETTERSTACK_HEARTBEAT_RECONCILE', e);
      }
    }

    return NextResponse.json({ ok: true, driftCount: driftDetails.length, driftDetails });

  } catch (err) {
    console.error('Reconciliation cron failed:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error during reconciliation' }, { status: 500 });
  }
}
