import { describe, it, expect } from 'vitest';
import { maskPan, maskAadhaar } from './kyc';

describe('KYC Masking (NFR-S8)', () => {
  it('masks PAN correctly', () => {
    expect(maskPan('ABCDE1234F')).toBe('ABC******F');
    expect(maskPan(' abcde1234f ')).toBe('ABC******F'); // Trims and upper-cases
  });

  it('handles invalid PAN gracefully without crashing', () => {
    expect(maskPan('INVALID')).toBe('INVALID');
  });

  it('masks Aadhaar correctly', () => {
    expect(maskAadhaar('123456789012')).toBe('********9012');
    expect(maskAadhaar('1234 5678 9012')).toBe('********9012'); // Removes spaces
  });

  it('handles invalid Aadhaar gracefully without crashing', () => {
    expect(maskAadhaar('123')).toBe('123');
  });
});
