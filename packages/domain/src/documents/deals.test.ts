import { describe, it, expect } from 'vitest';
import { getBookingChecklist, getClientChecklist } from './deals';

describe('Deal Document Templates (FR-C16)', () => {
  it('returns standard booking docs when TDS is not applicable', () => {
    const docs = getBookingChecklist(false);
    expect(docs).toContain('agreement_of_sale');
    expect(docs).not.toContain('form_26qb');
  });

  it('auto-flags Form 26QB when TDS is applicable', () => {
    const docs = getBookingChecklist(true);
    expect(docs).toContain('form_26qb');
  });

  it('returns standard client KYC checklist', () => {
    const docs = getClientChecklist();
    expect(docs).toContain('kyc_pan');
    expect(docs).toContain('kyc_aadhaar');
  });
});
