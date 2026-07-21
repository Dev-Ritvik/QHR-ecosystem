// packages/domain/src/holds/expiry.test.ts

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HOLD_DURATION_DAYS,
  isEffectivelyExpired,
  computeInitialExpiry,
  extensionRequiresOwner,
  validateExtension
} from './expiry';

describe('Hold Expiry Rules', () => {
  describe('isEffectivelyExpired', () => {
    it('returns true if the database status is already expired', () => {
      const hold = { status: 'expired' as const, expiresAt: new Date('2026-01-01T10:00:00Z') };
      expect(isEffectivelyExpired(hold, new Date('2026-01-02T10:00:00Z'))).toBe(true);
    });

    it('returns true if status is active but current time is past expiry (ADR-010 read-time check)', () => {
      const hold = { status: 'active' as const, expiresAt: new Date('2026-01-01T10:00:00Z') };
      expect(isEffectivelyExpired(hold, new Date('2026-01-01T10:00:01Z'))).toBe(true);
    });

    it('returns false if status is active and current time is before expiry', () => {
      const hold = { status: 'active' as const, expiresAt: new Date('2026-01-01T10:00:00Z') };
      expect(isEffectivelyExpired(hold, new Date('2026-01-01T09:59:59Z'))).toBe(false);
    });

    it('returns false for released or converted holds, even if past expiry date (they are no longer holds)', () => {
      const holdReleased = { status: 'released' as const, expiresAt: new Date('2026-01-01T10:00:00Z') };
      expect(isEffectivelyExpired(holdReleased, new Date('2026-01-02T10:00:00Z'))).toBe(false);

      const holdConverted = { status: 'converted' as const, expiresAt: new Date('2026-01-01T10:00:00Z') };
      expect(isEffectivelyExpired(holdConverted, new Date('2026-01-02T10:00:00Z'))).toBe(false);
    });
  });

  describe('computeInitialExpiry', () => {
    it('adds the default duration days to the start date', () => {
      const startsAt = new Date('2026-01-01T12:00:00Z');
      const expiresAt = computeInitialExpiry(startsAt);
      expect(expiresAt.toISOString()).toBe('2026-01-08T12:00:00.000Z'); // +7 days
    });

    it('adds custom duration days when provided', () => {
      const startsAt = new Date('2026-01-01T12:00:00Z');
      const expiresAt = computeInitialExpiry(startsAt, 3);
      expect(expiresAt.toISOString()).toBe('2026-01-04T12:00:00.000Z'); // +3 days
    });
  });

  describe('extensionRequiresOwner', () => {
    const startsAt = new Date('2026-01-01T00:00:00Z');
    
    it('returns true if requested expiry exceeds maximum allowed days from start', () => {
      const requested = new Date('2026-01-12T00:00:00Z'); // 11 days
      expect(extensionRequiresOwner(startsAt, requested, 10)).toBe(true);
    });

    it('returns false if requested expiry is exactly maximum allowed days from start', () => {
      const requested = new Date('2026-01-11T00:00:00Z'); // 10 days exactly
      expect(extensionRequiresOwner(startsAt, requested, 10)).toBe(false);
    });

    it('returns false if requested expiry is well within max duration', () => {
      const requested = new Date('2026-01-05T00:00:00Z'); // 4 days
      expect(extensionRequiresOwner(startsAt, requested, 10)).toBe(false);
    });
  });

  describe('validateExtension', () => {
    const startsAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-05T00:00:00Z');
    const maxDuration = 10;

    it('allows an agent to extend if the new expiry is within the max duration', () => {
      const requested = new Date('2026-01-09T00:00:00Z'); // 8 days total, within 10 day max
      const result = validateExtension(startsAt, requested, maxDuration, false, now);
      expect(result.ok).toBe(true);
    });

    it('rejects an agent extending beyond the max duration', () => {
      const requested = new Date('2026-01-15T00:00:00Z'); // 14 days total, exceeds 10 day max
      const result = validateExtension(startsAt, requested, maxDuration, false, now);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHORIZED');
        expect(result.message).toContain('requires owner approval');
      }
    });

    it('allows an owner to extend beyond the max duration', () => {
      const requested = new Date('2026-01-15T00:00:00Z'); // 14 days total, exceeds 10 day max
      const result = validateExtension(startsAt, requested, maxDuration, true, now);
      expect(result.ok).toBe(true);
    });

    it('rejects any extension into the past', () => {
      const requested = new Date('2026-01-04T00:00:00Z'); // Before `now`
      const result = validateExtension(startsAt, requested, maxDuration, true, now);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_DATE');
      }
    });
  });
});
