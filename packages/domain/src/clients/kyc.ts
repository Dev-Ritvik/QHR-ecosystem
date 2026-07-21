/**
 * NFR-S8: PII minimalism. PAN/Aadhaar are strictly masked before storage.
 * Original unmasked values are never stored in the database.
 */

export function maskPan(pan: string): string {
  const p = pan.trim().toUpperCase();
  if (p.length !== 10) return p;
  // Format: first 3 chars visible, 6 masked, last 1 visible (e.g., ABC******F)
  return `${p.substring(0, 3)}******${p.substring(9)}`;
}

export function maskAadhaar(aadhaar: string): string {
  const a = aadhaar.replace(/\s+/g, '');
  if (a.length !== 12) return a;
  // Format: mask first 8, show last 4
  return `********${a.substring(8)}`;
}
