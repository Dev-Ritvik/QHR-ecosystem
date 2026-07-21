// packages/domain/src/leads/pipeline.test.ts

import { describe, it, expect } from 'vitest';
import { transitionLead } from './pipeline';

describe('Lead Pipeline State Machine', () => {
  it('allows valid forward transitions', () => {
    const res1 = transitionLead('new', 'contacted');
    expect(res1.ok).toBe(true);
    
    const res2 = transitionLead('contacted', 'site_visit');
    expect(res2.ok).toBe(true);

    const res3 = transitionLead('agreement', 'won'); // skipping registered
    expect(res3.ok).toBe(true);
  });

  it('rejects transitioning to the same stage', () => {
    const res = transitionLead('qualified', 'qualified');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('ILLEGAL_TRANSITION');
    }
  });

  it('rejects completely invalid transitions', () => {
    const res = transitionLead('new', 'won');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('ILLEGAL_TRANSITION');
    }
  });

  it('requires a reason when transitioning to lost', () => {
    const withoutReason = transitionLead('negotiation', 'lost');
    expect(withoutReason.ok).toBe(false);
    if (!withoutReason.ok) {
      expect(withoutReason.code).toBe('REASON_REQUIRED');
    }

    const withReason = transitionLead('negotiation', 'lost', 'budget');
    expect(withReason.ok).toBe(true);
    if (withReason.ok) {
      expect(withReason.payload.toStage).toBe('lost');
      expect(withReason.payload.lostReason).toBe('budget');
    }
  });

  it('rejects a reason if transitioning to a stage other than lost', () => {
    const res = transitionLead('new', 'contacted', 'budget');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('REASON_NOT_ALLOWED');
    }
  });

  it('allows reviving a lost lead', () => {
    const res = transitionLead('lost', 'contacted');
    expect(res.ok).toBe(true);
  });
});
