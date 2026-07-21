// packages/domain/src/unit-status/presentation-label.test.ts

import { describe, it, expect } from 'vitest';
import { shouldSuggestSellingFast, getPresentationLabel } from './presentation-label';
import type { UnitStatus } from './machine';

describe('Presentation Label Rules', () => {
  describe('shouldSuggestSellingFast', () => {
    it('suggests when availability is exactly at threshold', () => {
      expect(
        shouldSuggestSellingFast({
          availableUnits: 15,
          totalUnits: 100,
          sellingFastThresholdPct: 15,
        })
      ).toBe(true);
    });

    it('suggests when availability is below threshold', () => {
      expect(
        shouldSuggestSellingFast({
          availableUnits: 10,
          totalUnits: 100,
          sellingFastThresholdPct: 15,
        })
      ).toBe(true);
    });

    it('does not suggest when availability is above threshold', () => {
      expect(
        shouldSuggestSellingFast({
          availableUnits: 16,
          totalUnits: 100,
          sellingFastThresholdPct: 15,
        })
      ).toBe(false);
    });

    it('handles zero total units gracefully', () => {
      expect(
        shouldSuggestSellingFast({
          availableUnits: 0,
          totalUnits: 0,
          sellingFastThresholdPct: 15,
        })
      ).toBe(false);
    });

    it('handles a 0% threshold edge case', () => {
      expect(
        shouldSuggestSellingFast({
          availableUnits: 0,
          totalUnits: 100,
          sellingFastThresholdPct: 0,
        })
      ).toBe(true);

      expect(
        shouldSuggestSellingFast({
          availableUnits: 1,
          totalUnits: 100,
          sellingFastThresholdPct: 0,
        })
      ).toBe(false);
    });
  });

  describe('getPresentationLabel', () => {
    it('maps available to available without confirmation', () => {
      expect(getPresentationLabel('available', false)).toBe('available');
    });

    it('maps available to selling_fast with confirmation', () => {
      expect(getPresentationLabel('available', true)).toBe('selling_fast');
    });

    it('maps registered to booked regardless of confirmation', () => {
      expect(getPresentationLabel('registered', false)).toBe('booked');
      expect(getPresentationLabel('registered', true)).toBe('booked');
    });

    it('maps other statuses directly to their presentation equivalents', () => {
      const directMappings: { core: UnitStatus; pub: string }[] = [
        { core: 'on_hold', pub: 'on_hold' },
        { core: 'booked', pub: 'booked' },
        { core: 'sold', pub: 'sold' },
        { core: 'not_for_sale', pub: 'not_for_sale' },
      ];

      for (const mapping of directMappings) {
        // Core status shouldn't change even if selling_fast is erroneously checked for non-available units
        expect(getPresentationLabel(mapping.core, false)).toBe(mapping.pub);
        expect(getPresentationLabel(mapping.core, true)).toBe(mapping.pub); 
      }
    });
  });
});
