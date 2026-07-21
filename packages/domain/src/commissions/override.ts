/**
 * FR-C18: Commission Overrides (latest-override-wins resolution).
 */

export type OverrideRecord = {
  overriddenAmountPaise: bigint;
  createdAt: Date;
};

export function resolveEffectiveCommission(
  computedAmountPaise: bigint,
  overrides: OverrideRecord[]
): { effectiveAmountPaise: bigint; isOverridden: boolean } {
  if (!overrides || overrides.length === 0) {
    return { effectiveAmountPaise: computedAmountPaise, isOverridden: false };
  }
  
  // Latest override wins (sort descending by createdAt)
  const sorted = [...overrides].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { 
    effectiveAmountPaise: sorted[0].overriddenAmountPaise, 
    isOverridden: true 
  };
}
