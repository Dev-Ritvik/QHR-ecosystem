// packages/domain/src/leads/dedupe.ts

/**
 * Normalizes an Indian phone number to E.164 format (+91XXXXXXXXXX).
 * Strips formatting characters. Throws if the format is fundamentally invalid
 * per the database constraint `^\+[1-9][0-9]{7,14}$`.
 */
export function normalizePhone(rawPhone: string): string {
  // Strip all non-digit and non-plus characters
  let digits = rawPhone.replace(/[^\d+]/g, '');

  // Handle local Indian formats (10 digits without code, or starting with 0)
  if (digits.length === 10 && !digits.startsWith('+')) {
    digits = '+91' + digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = '+91' + digits.substring(1);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = '+' + digits;
  }

  // Final DB constraint check
  const dbConstraint = /^\+[1-9][0-9]{7,14}$/;
  if (!dbConstraint.test(digits)) {
    throw new Error(`Invalid phone number format after normalization: ${digits}`);
  }

  return digits;
}

/**
 * Generates an idempotent deduplication key: sha256(source|phone|unit|day).
 * Used for NFR-D8 to prevent duplicate leads from API double-submits.
 * * Note: Uses Web Crypto API (`globalThis.crypto.subtle`), supported in Node 18+ and browsers.
 */
export async function generateDedupeKey(
  source: string,
  phone: string,
  unitId: string | null | undefined,
  date: Date
): Promise<string> {
  const normalizedPhone = normalizePhone(phone);
  
  // Format date as YYYY-MM-DD in UTC
  const dayString = date.toISOString().split('T')[0];
  
  const unitSegment = unitId || 'none';
  const payload = `${source}|${normalizedPhone}|${unitSegment}|${dayString}`;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hexHash;
}
