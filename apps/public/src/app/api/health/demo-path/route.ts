import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/projection';
import { projectsPub } from '@estate/db/src/schema/projection';

/**
 * NFR-R2: Better Stack synthetic demo-path check.
 * Hits the projection API directly with a real query. This ensures:
 * 1. The database is reachable.
 * 2. The `projection_reader` role is intact and authorized.
 * 3. The data payload actually exists for the presentation mode to function.
 */
export async function GET(req: NextRequest) {
  try {
    const start = Date.now();
    const project = await db.select().from(projectsPub).limit(1);
    const ms = Date.now() - start;

    return NextResponse.json({
      status: 'healthy',
      latencyMs: ms,
      hasData: project.length > 0
    }, { status: 200 });
  } catch (error: any) {
    console.error('Synthetic demo-path check failed:', error);
    return NextResponse.json({ status: 'unhealthy', error: error.message }, { status: 500 });
  }
}
