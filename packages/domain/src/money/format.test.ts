import { describe, it, expect } from 'vitest';
import { formatPaise } from './format';

describe('formatPaise', () => {
  it('formats amounts under 1 Lakh correctly', () => {
    expect(formatPaise(0n)).toBe('₹0');
    expect(formatPaise(5000n)).toBe('₹50');
    expect(formatPaise(150000n)).toBe('₹1,500');
    expect(formatPaise(9999900n)).toBe('₹99,999');
    
    // Shows fraction only when applicable
    expect(formatPaise(5050n)).toBe('₹50.5');
  });

  it('formats amounts in Lakhs correctly', () => {
    expect(formatPaise(10000000n)).toBe('₹1 L'); // exactly 1 Lakh
    expect(formatPaise(15000000n)).toBe('₹1.5 L'); // 1.5 Lakhs
    expect(formatPaise(14500000n)).toBe('₹1.45 L'); // 1.45 Lakhs
    expect(formatPaise(99900000n)).toBe('₹9.99 L'); // 9.99 Lakhs
  });

  it('formats amounts in Crores correctly', () => {
    // 1 Crore = 10,000,000 Rupees = 1,000,000,000 paise
    expect(formatPaise(1000000000n)).toBe('₹1 Cr'); 
    expect(formatPaise(14500000000n)).toBe('₹14.5 Cr'); 
    expect(formatPaise(14530000000n)).toBe('₹14.53 Cr'); 
    // Truncates correctly without lingering .00
    expect(formatPaise(10000000000n)).toBe('₹10 Cr'); 
  });

  it('handles negative amounts', () => {
    expect(formatPaise(-150000n)).toBe('-₹1,500');
    expect(formatPaise(-14500000000n)).toBe('-₹14.5 Cr');
  });
});
