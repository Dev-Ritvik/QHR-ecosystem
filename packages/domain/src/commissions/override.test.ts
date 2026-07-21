import { describe, it, expect } from 'vitest';
import { resolveEffectiveCommission } from './override';

describe('Commission Overrides (FR-C18)', () => {
  it('returns computed amount when no overrides exist', () => {
    const computed = 500000n;
    const result = resolveEffectiveCommission(computed, []);
    
    expect(result.effectiveAmountPaise).toBe(500000n);
    expect(result.isOverridden).toBe(false);
  });

  it('resolves to the latest override based on createdAt', () => {
    const computed = 500000n;
    const overrides = [
      { overriddenAmountPaise: 400000n, createdAt: new Date('2024-01-01T10:00:00Z') },
      { overriddenAmountPaise: 450000n, createdAt: new Date('2024-01-02T15:00:00Z') }, // Latest
      { overriddenAmountPaise: 300000n, createdAt: new Date('2024-01-01T08:00:00Z') },
    ];
    
    const result = resolveEffectiveCommission(computed, overrides);
    
    expect(result.effectiveAmountPaise).toBe(450000n);
    expect(result.isOverridden).toBe(true);
  });
});
