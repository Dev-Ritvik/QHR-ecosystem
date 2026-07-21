// packages/domain/src/pricing/compute.test.ts

import { describe, it, expect } from 'vitest';
import { computePrice, validateOverride, PremiumRules } from './compute';

describe('Pricing Computation', () => {
  describe('Base Price', () => {
    it('computes lump_sum correctly without requiring unit dimensions', () => {
      const res = computePrice(50000000n, 'lump_sum', {}, {});
      expect(res.basePricePaise).toBe(50000000n);
      expect(res.computedPricePaise).toBe(50000000n);
    });

    it('computes per_sq_yd correctly including fractional areas', () => {
      // 10,000 rupees per sq yd = 10,00,000 paise
      // Area = 133.33 sq yd
      // Expected = 1,33,33,00,000 paise (13,33,300 rupees)
      const res = computePrice(1000000n, 'per_sq_yd', {}, { areaSqYd: 133.33 });
      expect(res.basePricePaise).toBe(133330000n);
    });

    it('computes per_sq_ft correctly', () => {
      // 5,000 rupees per sq ft = 5,00,000 paise
      // Area = 1200 sq ft
      // Expected = 60,00,00,000 paise (6,000,000 rupees)
      const res = computePrice(500000n, 'per_sq_ft', {}, { areaSqFt: 1200 });
      expect(res.basePricePaise).toBe(600000000n);
    });

    it('throws if required dimension is missing for the chosen basis', () => {
      expect(() => computePrice(1000n, 'per_sq_yd', {}, { areaSqFt: 100 })).toThrowError(
        'areaSqYd is required for per_sq_yd basis'
      );
      expect(() => computePrice(1000n, 'per_sq_ft', {}, { areaSqYd: 100 })).toThrowError(
        'areaSqFt is required for per_sq_ft basis'
      );
    });
  });

  describe('Premiums', () => {
    const baseRate = 1000000n; // 10,000 rupees (1,000,000 paise) per sq yd
    const context = { areaSqYd: 100, isCorner: true, facing: 'east', roadWidthM: 40 };
    // Base price = 10,00,00,000 paise (1,000,000 rupees)

    it('applies corner, facing, and road width premiums additively', () => {
      const rules: PremiumRules = {
        corner_pct: 5, // 5% = 50,000 rupees = 5,000,000 paise
        facing: { east: 2, north: 1 }, // east 2% = 20,000 rupees = 2,000,000 paise
        road_width: [
          { min_m: 30, pct: 3 },
          { min_m: 40, pct: 5 }, // Should pick this (highest applicable match) = 5% = 5,000,000 paise
          { min_m: 50, pct: 10 }
        ]
      };

      const res = computePrice(baseRate, 'per_sq_yd', rules, context);
      
      expect(res.breakdown.base).toBe(100000000n);
      expect(res.breakdown.corner).toBe(5000000n);
      expect(res.breakdown.facing).toBe(2000000n);
      expect(res.breakdown.roadWidth).toBe(5000000n);
      expect(res.premiumPaise).toBe(12000000n);
      expect(res.computedPricePaise).toBe(112000000n);
    });

    it('applies custom premiums (both percentage and flat amount variants)', () => {
      const rules: PremiumRules = {
        custom: [
          { key: 'park_facing', label: 'Park Facing', pct: 4.5 }, // 4.5% = 4,500,000 paise
          { key: 'clubhouse', label: 'Clubhouse Access', flat_paise: 5000000n } // 50,000 rupees flat = 5,000,000 paise
        ]
      };
      const res = computePrice(baseRate, 'per_sq_yd', rules, { areaSqYd: 100 });

      expect(res.breakdown.custom).toHaveLength(2);
      expect(res.breakdown.custom[0].amountPaise).toBe(4500000n);
      expect(res.breakdown.custom[1].amountPaise).toBe(5000000n);
      expect(res.premiumPaise).toBe(9500000n);
      expect(res.computedPricePaise).toBe(109500000n);
    });

    it('ignores premiums that do not match the unit context', () => {
      const rules: PremiumRules = {
        corner_pct: 10,
        facing: { north: 5 }
      };
      const nonCornerWestContext = { areaSqYd: 100, isCorner: false, facing: 'west' };
      const res = computePrice(baseRate, 'per_sq_yd', rules, nonCornerWestContext);
      
      expect(res.premiumPaise).toBe(0n);
      expect(res.computedPricePaise).toBe(100000000n);
    });
  });

  describe('validateOverride', () => {
    it('returns ok: true when no override is provided', () => {
      expect(validateOverride(null, null).ok).toBe(true);
      expect(validateOverride(undefined, undefined).ok).toBe(true);
    });

    it('returns ok: true when override and reason are both provided', () => {
      const res = validateOverride(95000000n, 'Client negotiation');
      expect(res.ok).toBe(true);
    });

    it('returns ok: false and code REASON_REQUIRED when override price lacks a reason', () => {
      const res = validateOverride(95000000n, null);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('REASON_REQUIRED');
      }

      const resEmptyString = validateOverride(95000000n, '   ');
      expect(resEmptyString.ok).toBe(false);
      if (!resEmptyString.ok) {
        expect(resEmptyString.code).toBe('REASON_REQUIRED');
      }
    });
  });
});
