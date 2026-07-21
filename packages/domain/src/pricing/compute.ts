// packages/domain/src/pricing/compute.ts

export type RateBasis = 'per_sq_yd' | 'per_sq_ft' | 'lump_sum';

export interface PremiumRules {
  corner_pct?: number;
  facing?: Record<string, number>;
  road_width?: Array<{ min_m: number; pct: number }>;
  custom?: Array<{
    key: string;
    label: string;
    pct?: number;
    flat_paise?: bigint;
  }>;
}

export interface UnitPricingContext {
  areaSqYd?: number | null;
  areaSqFt?: number | null;
  isCorner?: boolean;
  facing?: string | null;
  roadWidthM?: number | null;
}

export interface PricingResult {
  basePricePaise: bigint;
  premiumPaise: bigint;
  computedPricePaise: bigint;
  breakdown: {
    base: bigint;
    corner: bigint;
    facing: bigint;
    roadWidth: bigint;
    custom: Array<{ key: string; label: string; amountPaise: bigint }>;
  };
}

/**
 * Computes the list price for a unit based on a price version's rate and premium rules.
 * Enforces NFR-D1 (integer paise everywhere) and rounding at paise precision.
 */
export function computePrice(
  baseRatePaise: bigint,
  rateBasis: RateBasis,
  rules: PremiumRules,
  context: UnitPricingContext
): PricingResult {
  let basePrice = BigInt(0);

  // 1. Calculate Base Price
  if (rateBasis === 'lump_sum') {
    basePrice = baseRatePaise;
  } else if (rateBasis === 'per_sq_yd') {
    if (!context.areaSqYd) {
      throw new Error("areaSqYd is required for per_sq_yd basis");
    }
    // Multiply by 10000, then divide to support fractional areas safely up to 4 decimal places
    basePrice = (baseRatePaise * BigInt(Math.round(context.areaSqYd * 10000))) / BigInt(10000);
  } else if (rateBasis === 'per_sq_ft') {
    if (!context.areaSqFt) {
      throw new Error("areaSqFt is required for per_sq_ft basis");
    }
    basePrice = (baseRatePaise * BigInt(Math.round(context.areaSqFt * 10000))) / BigInt(10000);
  }

  // 2. Calculate Premiums (Additive over base price)
  const breakdown = {
    base: basePrice,
    corner: BigInt(0),
    facing: BigInt(0),
    roadWidth: BigInt(0),
    custom: [] as Array<{ key: string; label: string; amountPaise: bigint }>,
  };

  const applyPct = (pct: number) => {
    // E.g., 5.5% = 550 basis points. (basePrice * 550) / 10000.
    // Integer division guarantees paise precision rounding (truncation).
    return (basePrice * BigInt(Math.round(pct * 100))) / BigInt(10000);
  };

  if (context.isCorner && rules.corner_pct) {
    breakdown.corner = applyPct(rules.corner_pct);
  }

  if (context.facing && rules.facing && rules.facing[context.facing]) {
    breakdown.facing = applyPct(rules.facing[context.facing]);
  }

  if (context.roadWidthM !== undefined && context.roadWidthM !== null && rules.road_width && rules.road_width.length > 0) {
    // Sort descending by min_m to find the highest applicable band
    const applicable = [...rules.road_width]
      .sort((a, b) => b.min_m - a.min_m)
      .find((band) => context.roadWidthM! >= band.min_m);
    
    if (applicable) {
      breakdown.roadWidth = applyPct(applicable.pct);
    }
  }

  if (rules.custom) {
    for (const customRule of rules.custom) {
      let amount = BigInt(0);
      if (customRule.pct) {
        amount += applyPct(customRule.pct);
      }
      if (customRule.flat_paise) {
        amount += customRule.flat_paise;
      }
      
      if (amount > BigInt(0)) {
        breakdown.custom.push({
          key: customRule.key,
          label: customRule.label,
          amountPaise: amount,
        });
      }
    }
  }

  const customTotal = breakdown.custom.reduce((sum, item) => sum + item.amountPaise, BigInt(0));
  const premiumPaise = breakdown.corner + breakdown.facing + breakdown.roadWidth + customTotal;

  return {
    basePricePaise: basePrice,
    premiumPaise,
    computedPricePaise: basePrice + premiumPaise,
    breakdown,
  };
}

export type ValidateOverrideResult = 
  | { ok: true }
  | { ok: false; message: string; code: 'REASON_REQUIRED' };

/**
 * Enforces FR-C9 / DB check: an override price MUST be accompanied by a reason.
 */
export function validateOverride(
  overridePricePaise: bigint | null | undefined,
  overrideReason: string | null | undefined
): ValidateOverrideResult {
  if (overridePricePaise !== null && overridePricePaise !== undefined) {
    if (!overrideReason || overrideReason.trim() === '') {
      return { 
        ok: false, 
        code: 'REASON_REQUIRED', 
        message: 'A reason is required when overriding the computed price.' 
      };
    }
  }
  return { ok: true };
}
