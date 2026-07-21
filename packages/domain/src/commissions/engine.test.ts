import { describe, it, expect } from 'vitest';
import { computeCommissionTranches } from './engine';

describe('Commission Engine (FR-C18)', () => {
  it('computes basic commission and splits correctly', () => {
    // 1 Crore = 1,00,00,000 rupees = 1,000,000,000 paise. 2% commission = 200 bps.
    // Total commission = 2,00,000 rupees = 20,000,000 paise.
    const consideration = 1000000000n;
    const result = computeCommissionTranches(consideration, 200, {
      token: 10,
      agreement: 40,
      registration: 50
    });

    expect(result.token).toBe(2000000n); // 20k rupees
    expect(result.agreement).toBe(8000000n); // 80k rupees
    expect(result.registration).toBe(10000000n); // 1L rupees
  });

  it('allocates rounding remainders to the registration tranche safely', () => {
    // Consideration = 100,000,001 paise. Rate = 100 bps (1%). 
    // Total commission = 1,000,000 paise. (integer division discards the .01)
    const consideration = 100000001n;
    const result = computeCommissionTranches(consideration, 100, {
      token: 33,
      agreement: 33,
      registration: 34
    });

    expect(result.token).toBe(330000n);
    expect(result.agreement).toBe(330000n);
    expect(result.registration).toBe(340000n); 
    expect(result.token + result.agreement + result.registration).toBe(1000000n);
  });

  it('throws on invalid split sum', () => {
    expect(() => {
      computeCommissionTranches(1000n, 200, { token: 50, agreement: 50, registration: 50 });
    }).toThrow('Tranche split percentages must sum to 100');
  });
});
