import { describe, it, expect } from 'vitest';
import { transition, UnitStatus, LEGAL_TRANSITIONS, TransitionPayload } from './machine';

const ALL_STATUSES: UnitStatus[] = [
  'available',
  'on_hold',
  'booked',
  'registered',
  'sold',
  'not_for_sale',
];

// Helper to provide required entity IDs for legal state entries
const getValidPayload = (fromStatus: UnitStatus | null, toStatus: UnitStatus): TransitionPayload => {
  return {
    fromStatus,
    toStatus,
    holdId: toStatus === 'on_hold' ? 'hold-123' : undefined,
    bookingId: toStatus === 'booked' ? 'booking-123' : undefined,
  };
};

describe('Unit Status State Machine', () => {
  describe('Legal transitions', () => {
    // Test the initial creation transition (null -> available)
    it('allows initial transition to available', () => {
      const result = transition(getValidPayload(null, 'available'));
      expect(result.ok).toBe(true);
    });

    // Exhaustively test all defined legal transitions
    Object.entries(LEGAL_TRANSITIONS).forEach(([fromStr, allowedToStatuses]) => {
      if (fromStr === 'initial') return; // Handled above
      
      const fromStatus = fromStr as UnitStatus;

      allowedToStatuses.forEach((toStatus) => {
        it(`allows transition from '${fromStatus}' to '${toStatus}'`, () => {
          const result = transition(getValidPayload(fromStatus, toStatus));
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.event.fromStatus).toBe(fromStatus);
            expect(result.event.toStatus).toBe(toStatus);
          }
        });
      });
    });
  });

  describe('Illegal transitions', () => {
    // Exhaustively test all pairs NOT in the legal transitions list
    Object.entries(LEGAL_TRANSITIONS).forEach(([fromStr, allowedToStatuses]) => {
      if (fromStr === 'initial') return;

      const fromStatus = fromStr as UnitStatus;
      const illegalToStatuses = ALL_STATUSES.filter((status) => !allowedToStatuses.includes(status));

      illegalToStatuses.forEach((toStatus) => {
        it(`rejects transition from '${fromStatus}' to '${toStatus}'`, () => {
          const result = transition(getValidPayload(fromStatus, toStatus));
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.code).toBe('INVALID_TRANSITION');
          }
        });
      });
    });

    it('rejects initial transition to anything other than available', () => {
      const result = transition(getValidPayload(null, 'booked'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_TRANSITION');
      }
    });
  });

  describe('Relation constraint enforcement', () => {
    it('rejects transition to on_hold without a holdId', () => {
      const result = transition({
        fromStatus: 'available',
        toStatus: 'on_hold',
        holdId: undefined, // Explicitly missing
      });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('MISSING_RELATION');
        expect(result.message).toMatch(/requires a holdId/);
      }
    });

    it('rejects transition to booked without a bookingId', () => {
      const result = transition({
        fromStatus: 'available',
        toStatus: 'booked',
        bookingId: undefined, // Explicitly missing
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('MISSING_RELATION');
        expect(result.message).toMatch(/requires a bookingId/);
      }
    });
  });

  describe('mortgage status (owner rules 2026-07-18)', () => {
    it('allows placing an available unit under mortgage', () => {
      expect(transition({ fromStatus: 'available', toStatus: 'mortgage' }).ok).toBe(true);
    });

    it('allows releasing a mortgage back to available', () => {
      expect(transition({ fromStatus: 'mortgage', toStatus: 'available' }).ok).toBe(true);
    });

    it('allows booking a mortgaged unit (with a booking link)', () => {
      expect(transition({ fromStatus: 'mortgage', toStatus: 'booked', bookingId: 'b-1' }).ok).toBe(true);
    });

    it('NEVER allows selling or registering directly from mortgage', () => {
      const toSold = transition({ fromStatus: 'mortgage', toStatus: 'sold' });
      const toRegistered = transition({ fromStatus: 'mortgage', toStatus: 'registered' });
      expect(toSold.ok).toBe(false);
      expect(toRegistered.ok).toBe(false);
      if (!toSold.ok) expect(toSold.code).toBe('INVALID_TRANSITION');
    });

    it('cannot enter mortgage from sold or registered', () => {
      expect(transition({ fromStatus: 'sold', toStatus: 'mortgage' }).ok).toBe(false);
      expect(transition({ fromStatus: 'registered', toStatus: 'mortgage' }).ok).toBe(false);
    });
  });
});
