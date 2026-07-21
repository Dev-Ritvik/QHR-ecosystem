import { systemQuery } from '@/server/db';
import { presentationDevices } from '@estate/db';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * NFR-S5: Exposes a fast revocation check endpoint for the public projection layer.
 * Hit by the public app and cached (revalidate: 60) to guarantee ≤60s revocation effect.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');
  
  if (!hash) {
    return NextResponse.json({ ok: false, message: 'Missing hash' }, { status: 400 });
  }

  try {
    const device = await systemQuery(async (tx) => {
      return await tx.query.presentationDevices.findFirst({
        where: eq(presentationDevices.tokenHash, hash),
        columns: { revokedAt: true }
      });
    });

    // Valid if it exists and hasn't been revoked
    if (!device || device.revokedAt) {
      return NextResponse.json({ ok: false });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[VerifyDeviceToken]', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
