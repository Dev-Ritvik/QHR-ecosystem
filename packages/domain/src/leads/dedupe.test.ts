// packages/domain/src/leads/dedupe.test.ts

import { describe, it, expect } from 'vitest';
import { normalizePhone, generateDedupeKey } from './dedupe';

describe('Lead Deduplication & Phone Normalization', () => {
  describe('normalizePhone', () => {
    it('formats a 10-digit Indian number correctly', () => {
      expect(normalizePhone('9876543210')).toBe('+919876543210');
      expect(normalizePhone('98765 43210')).toBe('+919876543210');
      expect(normalizePhone('(987)-654-3210')).toBe('+919876543210');
    });

    it('formats a number starting with 0 correctly', () => {
      expect(normalizePhone('09876543210')).toBe('+919876543210');
    });

    it('formats a number starting with 91 correctly', () => {
      expect(normalizePhone('919876543210')).toBe('+919876543210');
    });

    it('keeps a properly formatted E.164 number unchanged', () => {
      expect(normalizePhone('+919876543210')).toBe('+919876543210');
      expect(normalizePhone('+14155552671')).toBe('+14155552671'); // Valid US number
    });

    it('throws on fundamentally invalid numbers', () => {
      expect(() => normalizePhone('12345')).toThrow('Invalid phone number format');
      expect(() => normalizePhone('+invalid')).toThrow('Invalid phone number format');
    });
  });

  describe('generateDedupeKey', () => {
    it('generates a consistent sha256 hash for identical payloads', async () => {
      const date = new Date('2026-07-08T10:01:45Z');
      
      const key1 = await generateDedupeKey('website', '98765 43210', 'unit-123', date);
      const key2 = await generateDedupeKey('website', '+919876543210', 'unit-123', date); // Diff formatting, same normalized
      
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex length
    });

    it('generates different hashes when unitId differs', async () => {
      const date = new Date('2026-07-08T10:00:00Z');
      
      const key1 = await generateDedupeKey('website', '9876543210', 'unit-123', date);
      const key2 = await generateDedupeKey('website', '9876543210', null, date);
      
      expect(key1).not.toBe(key2);
    });

    it('generates different hashes for different days', async () => {
      const date1 = new Date('2026-07-08T23:00:00Z');
      const date2 = new Date('2026-07-09T01:00:00Z'); // Next UTC day
      
      const key1 = await generateDedupeKey('website', '9876543210', 'unit-123', date1);
      const key2 = await generateDedupeKey('website', '9876543210', 'unit-123', date2);
      
      expect(key1).not.toBe(key2);
    });
  });
});
