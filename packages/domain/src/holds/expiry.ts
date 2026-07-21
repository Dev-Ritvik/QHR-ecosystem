// packages/domain/src/holds/expiry.ts

export const DEFAULT_HOLD_DURATION_DAYS = 7;

export interface HoldState {
  status: 'active' | 'released' | 'expired' | 'converted';
  expiresAt: Date;
}

/**
 * Pure read-time check to prevent stale 'active' holds from displaying as held.
 * Enforces ADR-010: read paths consulting hold state treat a past-expires_at hold as already expired.
 */
export function isEffectivelyExpired(hold: HoldState, now: Date): boolean {
  if (hold.status === 'expired') {
    return true;
  }
  
  if (hold.status === 'active' && now >= hold.expiresAt) {
    return true;
  }
  
  return false;
}

/**
 * Computes the initial expiry date given a start date and a duration in days.
 */
export function computeInitialExpiry(startsAt: Date, durationDays: number = DEFAULT_HOLD_DURATION_DAYS): Date {
  const expiresAt = new Date(startsAt.getTime());
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  return expiresAt;
}

/**
 * Determines if a requested extension goes beyond the owner-configured maximum duration.
 */
export function extensionRequiresOwner(
  startsAt: Date,
  requestedExpiresAt: Date,
  maxDurationDays: number
): boolean {
  const durationMs = requestedExpiresAt.getTime() - startsAt.getTime();
  const maxMs = maxDurationDays * 24 * 60 * 60 * 1000;
  return durationMs > maxMs;
}

export type ValidateExtensionResult = 
  | { ok: true }
  | { ok: false; message: string; code: 'UNAUTHORIZED' | 'INVALID_DATE' };

/**
 * Validates a hold extension attempt against business rules (FR-C11).
 * Extension past owner-configured max requires owner approval.
 */
export function validateExtension(
  startsAt: Date,
  requestedExpiresAt: Date,
  maxDurationDays: number,
  isOwner: boolean,
  now: Date
): ValidateExtensionResult {
  if (requestedExpiresAt <= now) {
    return { 
      ok: false, 
      code: 'INVALID_DATE',
      message: 'Requested expiry must be in the future.' 
    };
  }

  if (extensionRequiresOwner(startsAt, requestedExpiresAt, maxDurationDays) && !isOwner) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      message: `Extension beyond the maximum ${maxDurationDays} days requires owner approval.`
    };
  }

  return { ok: true };
}
