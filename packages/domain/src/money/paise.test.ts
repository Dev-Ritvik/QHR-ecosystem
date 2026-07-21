import { describe, it, expect } from 'vitest';
import { add, subtract, multiplyByBps, allocate, rupeesToPaise } from './paise';

describe('rupeesToPaise', () => {
  it('converts whole rupee amounts (×100 exactly)', () => {
    expect(rupeesToPaise(45000)).toBe(4500000n);
    expect(rupeesToPaise('45000')).toBe(4500000n);
    expect(rupeesToPaise(10000000)).toBe(1000000000n); // 1 crore ₹ = 1e9 paise
    expect(rupeesToPaise(0)).toBe(0n);
  });

  it('converts decimal amounts without float rounding', () => {
    expect(rupeesToPaise('4500000.50')).toBe(450000050n);
    expect(rupeesToPaise(4500000.5)).toBe(450000050n);
    expect(rupeesToPaise('0.01')).toBe(1n);
    expect(rupeesToPaise('99.9')).toBe(9990n); // one decimal = tens of paise
  });

  it('rejects malformed or negative input', () => {
    expect(() => rupeesToPaise('-5')).toThrow();
    expect(() => rupeesToPaise('12.345')).toThrow(); // sub-paise precision
    expect(() => rupeesToPaise('abc')).toThrow();
    expect(() => rupeesToPaise('')).toThrow();
  });
});

describe('paise arithmetic', () => {
  it('adds amounts correctly', () => {
    expect(add(100n, 200n, 50n)).toBe(350n);
    expect(add(100n, -50n)).toBe(50n);
    expect(add()).toBe(0n);
  });

  it('subtracts amounts correctly', () => {
    expect(subtract(100n, 30n)).toBe(70n);
    expect(subtract(50n, 100n)).toBe(-50n);
  });

  it('multiplies by basis points correctly', () => {
    // 100,000 paise (₹1,000) * 100 bps (1%) = 1,000 paise (₹10)
    expect(multiplyByBps(100000n, 100)).toBe(1000n);
    // 50% = 5,000 bps
    expect(multiplyByBps(100000n, 5000)).toBe(50000n);
    // Lossy fraction correctly truncates, avoiding float math
    expect(multiplyByBps(100n, 33)).toBe(0n); // 0.33 paise truncated to 0
  });

  describe('allocate', () => {
    it('allocates evenly without remainders', () => {
      const result = allocate(100n, [1, 1]);
      expect(result).toEqual([50n, 50n]);
    });

    it('distributes remainder to the front of the array', () => {
      const result = allocate(100n, [1, 1, 1]);
      // 100 / 3 = 33 remainder 1. First share gets the +1 penny.
      expect(result).toEqual([34n, 33n, 33n]);
    });

    it('allocates according to arbitrary ratios', () => {
      const result = allocate(100n, [3, 7]);
      expect(result).toEqual([30n, 70n]);
    });

    it('handles negative amounts safely with remainder distribution', () => {
      const result = allocate(-100n, [1, 1, 1]);
      // -100 / 3 = -33 remainder -1. First share gets the -1 penny.
      expect(result).toEqual([-34n, -33n, -33n]);
      expect(add(...result)).toBe(-100n);
    });

    it('returns zeroes if total ratio is 0', () => {
      const result = allocate(100n, [0, 0]);
      expect(result).toEqual([0n, 0n]);
    });
  });
});
