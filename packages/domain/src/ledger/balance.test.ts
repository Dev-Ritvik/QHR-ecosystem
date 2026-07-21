import { describe, it, expect } from 'vitest';
import { computeRunningBalances, validateLedgerSign } from './balance';

describe('Ledger Balance Logic (FR-C17)', () => {
  it('calculates running balances chronologically', () => {
    const entries = [
      { id: 2n, entryType: 'installment', amountPaise: 5000n, paidOn: '2023-01-02' },
      { id: 1n, entryType: 'token', amountPaise: 1000n, paidOn: '2023-01-01' },
      { id: 3n, entryType: 'refund', amountPaise: -500n, paidOn: '2023-01-03' },
    ];
    
    const balanced = computeRunningBalances(entries);
    expect(balanced[0].id).toBe(1n);
    expect(balanced[0].runningBalancePaise).toBe(1000n);
    
    expect(balanced[1].id).toBe(2n);
    expect(balanced[1].runningBalancePaise).toBe(6000n);
    
    expect(balanced[2].id).toBe(3n);
    expect(balanced[2].runningBalancePaise).toBe(5500n);
  });

  it('enforces correct signs based on entry type (NFR-D1 / DB CHECK)', () => {
    expect(validateLedgerSign('installment', 100n)).toBe(100n);
    expect(validateLedgerSign('refund', 100n)).toBe(-100n);
    expect(validateLedgerSign('reversal', 100n)).toBe(-100n);
    
    // Sanitizes incorrect negative inputs from the form implicitly
    expect(validateLedgerSign('token', -100n)).toBe(100n);
  });
});
