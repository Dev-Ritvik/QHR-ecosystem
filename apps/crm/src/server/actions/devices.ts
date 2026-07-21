'use server';

import { authedQuery } from '@/server/db';
import { coreSchema as schema } from '@estate/db';
import { eq } from 'drizzle-orm';
import { EnrollDeviceSchema } from '@/lib/validation';
import { requireOwner } from '@/server/session';
import { writeAudit } from '@/server/audit';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

/**
 * Mints an Ed25519 token for a presentation device and broadcasts it 
 * to the waiting device via a short-code channel.
 */
export async function enrollDevice(data: { label: string; shortCode: string }) {
  // FR-C20 / NFR-S3: Owner only operation
  const ownerCheck = await requireOwner();
  if (!ownerCheck.ok) return ownerCheck;

  const parsed = EnrollDeviceSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, code: 'VALIDATION_FAILED' as const, issues: parsed.error.flatten().fieldErrors };
  }

  try {
    const privateKeyPem = process.env.DEVICE_TOKEN_PRIVATE_KEY;
    if (!privateKeyPem) {
      console.error('CRITICAL: DEVICE_TOKEN_PRIVATE_KEY is not configured in the environment.');
      return { ok: false as const, code: 'PERSIST_FAILED' as const, message: 'Server configuration error' };
    }

    const id = crypto.randomUUID();
    const scopes = ['projection:read', 'prices:read'];
    
    // Ed25519 Token Minting (ADR-004)
    const payloadObj = { jti: id, scopes, iat: Math.floor(Date.now() / 1000) };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signature = crypto.sign(null, payloadBuffer, privateKey);

    const token = `${payloadBuffer.toString('base64url')}.${signature.toString('base64url')}`;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const context = { userId: ownerCheck.session.user.id, role: 'owner' as const };
    
    await authedQuery(context, async (tx: any) => {
      await tx.insert(schema.presentationDevices).values({
        id,
        label: parsed.data.label,
        tokenHash,
        approvedById: ownerCheck.session.user.id,
        scopes,
      });

      await writeAudit({
        action: 'device.enroll',
        entityType: 'presentation_devices',
        entityId: id,
        after: { label: parsed.data.label, scopes },
      }, tx);
    });

    // Broadcast the minted plaintext token to the polling device
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const channel = supabase.channel(`device-enrollment-${parsed.data.shortCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'enrollment_success',
        payload: { token }
      });
      await supabase.removeChannel(channel);
    }

    revalidatePath('/settings/devices');
    return { ok: true as const };
  } catch (error) {
    console.error('[enrollDevice]', error);
    return { ok: false as const, code: 'PERSIST_FAILED' as const, message: 'Failed to enroll device' };
  }
}

/**
 * Revokes a presentation device token.
 * Propagation to presentation displays happens within ≤60s (FR-PM12).
 */
export async function revokeDevice(id: string) {
  const ownerCheck = await requireOwner();
  if (!ownerCheck.ok) return ownerCheck;

  try {
    const context = { userId: ownerCheck.session.user.id, role: 'owner' as const };
    
    await authedQuery(context, async (tx: any) => {
      await tx.update(schema.presentationDevices)
        .set({ revokedAt: new Date() })
        .where(eq(schema.presentationDevices.id, id));

      await writeAudit({
        action: 'device.revoke',
        entityType: 'presentation_devices',
        entityId: id,
      }, tx);
    });

    revalidatePath('/settings/devices');
    return { ok: true as const };
  } catch (error) {
    console.error('[revokeDevice]', error);
    return { ok: false as const, code: 'PERSIST_FAILED' as const, message: 'Failed to revoke device' };
  }
}
