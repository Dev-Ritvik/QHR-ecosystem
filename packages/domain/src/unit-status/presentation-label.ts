// packages/domain/src/unit-status/presentation-label.ts

import type { UnitStatus } from './machine';

export type PresentationLabel =
  | 'available'
  | 'selling_fast'
  | 'on_hold'
  | 'booked'
  | 'sold'
  | 'not_for_sale';

export interface SuggestionParams {
  availableUnits: number;
  totalUnits: number;
  sellingFastThresholdPct: number;
}

/**
 * Determines if the "selling fast" label should be auto-suggested to the owner.
 * Suggestion only: per FR-C7, marketing stays a human decision and is never auto-applied.
 */
export function shouldSuggestSellingFast(params: SuggestionParams): boolean {
  const { availableUnits, totalUnits, sellingFastThresholdPct } = params;
  
  if (totalUnits === 0) return false;
  if (sellingFastThresholdPct < 0 || sellingFastThresholdPct > 100) return false;

  const availablePct = (availableUnits / totalUnits) * 100;
  return availablePct <= sellingFastThresholdPct;
}

/**
 * Maps the core state-machine status to the public presentation label.
 * - 'registered' maps to 'booked' for public display
 * - 'available' can be overridden to 'selling_fast' if owner confirmed
 */
export function getPresentationLabel(
  status: UnitStatus,
  isSellingFastConfirmed: boolean = false
): PresentationLabel {
  switch (status) {
    case 'available':
      return isSellingFastConfirmed ? 'selling_fast' : 'available';
    case 'on_hold':
      return 'on_hold';
    case 'booked':
      return 'booked';
    case 'registered':
      return 'booked'; // Publisher maps core registered -> 'booked' until sold (FR-PM4)
    case 'sold':
      return 'sold';
    case 'not_for_sale':
      return 'not_for_sale';
    case 'mortgage':
      // A mortgaged property must not be sold; the public site simply shows
      // it as not for sale until the lien is released.
      return 'not_for_sale';
    default:
      // Exhaustiveness check
      const _exhaustiveCheck: never = status;
      return 'not_for_sale';
  }
}

/**
 * Owner-facing grouped status (4-state view requested 2026-07-18):
 * Available | Booked / Advance Paid / Reserved | Sold Out | Mortgage.
 * Display-only — the underlying legal states and transitions are unchanged.
 * 'not_for_sale' is retired from the owner UI (client wants exactly these 4);
 * any legacy row displays under the Mortgage (withheld-from-sale) bucket.
 */
export function getOwnerStatusLabel(status: UnitStatus): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'on_hold':
    case 'booked':
      return 'Booked / Advance Paid / Reserved';
    case 'registered':
    case 'sold':
      return 'Sold Out';
    case 'mortgage':
    case 'not_for_sale':
      return 'Mortgage';
    default: {
      const _exhaustiveCheck: never = status;
      return status;
    }
  }
}
