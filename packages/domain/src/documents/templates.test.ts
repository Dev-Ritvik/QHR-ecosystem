// packages/domain/src/documents/templates.test.ts
import { describe, it, expect } from 'vitest';
import { getUnitChecklistTemplate } from './templates';

describe('Document Templates', () => {
  it('returns the correct template for land', () => {
    const template = getUnitChecklistTemplate('land');
    expect(template.length).toBeGreaterThan(0);
    expect(template.find(t => t.key === 'ec')).toBeDefined();
    expect(template.find(t => t.key === 'ec')?.hasValidityDates).toBe(true);
  });

  it('returns the correct template for commercial', () => {
    const template = getUnitChecklistTemplate('commercial');
    expect(template.find(t => t.key === 'lease_deed')).toBeDefined();
    expect(template.find(t => t.key === 'mother_deed')).toBeUndefined();
  });

  it('returns the correct template for luxury_residential', () => {
    const template = getUnitChecklistTemplate('luxury_residential');
    expect(template.find(t => t.key === 'cc')).toBeDefined();
  });
});
