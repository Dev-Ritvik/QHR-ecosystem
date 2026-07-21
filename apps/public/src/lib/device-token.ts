import crypto from 'crypto';

/**
 * FR-PM12: Verifies the Ed25519 token issued by the CRM. 
 * Checks cryptographic signature locally, then verifies revocation status against 
 * the CRM via a short-TTL fetch request.
 */
export async function verifyDeviceToken(token: string | undefined): Promise<boolean> {
  // If the owner opts to publish all prices openly, the feature flag is off and everyone is "unlocked"
  if (process.env.NEXT_PUBLIC_DEVICE_ENROLLMENT_ENABLED !== 'true') return true; 
  if (!token) return false;

  try {
    const pubKey = process.env.DEVICE_TOKEN_PUBLIC_KEY?.replace(/\\n/g, '\n');
    if (!pubKey) {
      console.error('CRITICAL: DEVICE_TOKEN_PUBLIC_KEY is missing from environment variables.');
      return false;
    }

    const [payload64, sig64] = token.split('.');
    if (!payload64 || !sig64) return false;

    // 1. Verify cryptographic minting
    const isValid = crypto.verify(
      null,
      Buffer.from(payload64, 'base64url'),
      crypto.createPublicKey(pubKey),
      Buffer.from(sig64, 'base64url')
    );

    if (!isValid) return false;

    // 2. Hash and check revocation state via the CRM (with 60s cache limit per NFR-S5)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const crmUrl = process.env.NEXT_PUBLIC_CRM_URL || 'http://crm.localhost:3000';
    
    const res = await fetch(`${crmUrl}/api/devices/verify?hash=${tokenHash}`, {
      next: { revalidate: 60 }
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.ok;
  } catch (error) {
    console.error('[verifyDeviceToken] Validation error:', error);
    return false;
  }
}
