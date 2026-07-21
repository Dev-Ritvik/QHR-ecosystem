export type UnitStatus =
  | 'available'
  | 'on_hold'
  | 'booked'
  | 'registered'
  | 'sold'
  | 'not_for_sale'
  | 'mortgage';

export const LEGAL_TRANSITIONS: Record<UnitStatus | 'initial', ReadonlyArray<UnitStatus>> = {
  initial: ['available'], // Represents fromStatus = null
  available: ['on_hold', 'booked', 'not_for_sale', 'mortgage'],
  on_hold: ['available', 'booked'],
  booked: ['registered', 'available'],
  registered: ['sold'],
  sold: [],
  not_for_sale: ['available'],
  // Property under a mortgage/lien: can be released back to available or
  // booked (subject to release), but can NEVER go directly to sold/registered
  // (owner rule 2026-07-18).
  mortgage: ['available', 'booked'],
};

export interface TransitionPayload {
  fromStatus: UnitStatus | null;
  toStatus: UnitStatus;
  holdId?: string | null;
  bookingId?: string | null;
  clientId?: string | null;
  actorId?: string | null;
  reason?: string | null;
}

export type TransitionResult =
  | { ok: true; event: TransitionPayload }
  | { ok: false; code: 'INVALID_TRANSITION' | 'MISSING_RELATION'; message: string };

/**
 * Validates a unit status transition against the domain state machine rules.
 * Enforces both legal (from, to) pairs and the presence of required related entities.
 */
export function transition(payload: TransitionPayload): TransitionResult {
  const { fromStatus, toStatus, holdId, bookingId } = payload;

  const transitionKey = fromStatus === null ? 'initial' : fromStatus;
  const allowed = LEGAL_TRANSITIONS[transitionKey];

  if (!allowed.includes(toStatus)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `Cannot transition unit from '${fromStatus ?? 'null'}' to '${toStatus}'.`,
    };
  }

  // Domain & DB constraint: entering 'on_hold' requires a valid hold record link
  if (toStatus === 'on_hold' && !holdId) {
    return {
      ok: false,
      code: 'MISSING_RELATION',
      message: `Transitioning to 'on_hold' requires a holdId.`,
    };
  }

  // Domain & DB constraint: entering 'booked' requires a valid booking record link
  if (toStatus === 'booked' && !bookingId) {
    return {
      ok: false,
      code: 'MISSING_RELATION',
      message: `Transitioning to 'booked' requires a bookingId.`,
    };
  }

  return { ok: true, event: payload };
}
