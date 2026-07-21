// packages/domain/src/leads/pipeline.ts

export type PipelineStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'site_visit'
  | 'negotiation'
  | 'token'
  | 'agreement'
  | 'registered'
  | 'won'
  | 'lost'
  | 'dormant';

export type LostReason =
  | 'budget'
  | 'location'
  | 'bought_elsewhere'
  | 'postponed'
  | 'unreachable'
  | 'not_interested'
  | 'other';

export interface TransitionPayload {
  toStage: PipelineStage;
  lostReason?: LostReason;
}

export type TransitionResult =
  | { ok: true; payload: TransitionPayload }
  | { ok: false; code: 'ILLEGAL_TRANSITION' | 'REASON_REQUIRED' | 'REASON_NOT_ALLOWED'; message: string };

/**
 * Valid stage transitions. 
 * Allows realistic forward movement (skipping intermediate steps is common in CRM),
 * dropping to lost/dormant from anywhere active, and reviving from terminal states.
 */
const LEGAL_TRANSITIONS: Record<PipelineStage, Set<PipelineStage>> = {
  new: new Set(['contacted', 'qualified', 'site_visit', 'lost', 'dormant']),
  contacted: new Set(['qualified', 'site_visit', 'negotiation', 'lost', 'dormant']),
  qualified: new Set(['site_visit', 'negotiation', 'token', 'lost', 'dormant']),
  site_visit: new Set(['negotiation', 'token', 'agreement', 'lost', 'dormant', 'qualified']), // can step back to qualified
  negotiation: new Set(['token', 'agreement', 'lost', 'dormant', 'site_visit']),
  token: new Set(['agreement', 'registered', 'lost', 'dormant', 'negotiation']),
  agreement: new Set(['registered', 'won', 'lost', 'dormant']),
  registered: new Set(['won', 'lost', 'dormant']),
  won: new Set(['registered', 'lost']), // Allowed only for extreme rollbacks/cancellations post-win
  lost: new Set(['new', 'contacted', 'qualified']), // Revival
  dormant: new Set(['contacted', 'qualified', 'site_visit']), // Revival
};

/**
 * Validates a lead pipeline stage transition.
 * Enforces the state graph and the mandatory lost-reason business rule (FR-C2).
 */
export function transitionLead(
  fromStage: PipelineStage,
  toStage: PipelineStage,
  lostReason?: LostReason | null
): TransitionResult {
  if (fromStage === toStage) {
    return { ok: false, code: 'ILLEGAL_TRANSITION', message: `Lead is already in stage '${fromStage}'.` };
  }

  const allowedTo = LEGAL_TRANSITIONS[fromStage];
  if (!allowedTo || !allowedTo.has(toStage)) {
    return {
      ok: false,
      code: 'ILLEGAL_TRANSITION',
      message: `Cannot transition lead from '${fromStage}' to '${toStage}'.`,
    };
  }

  if (toStage === 'lost') {
    if (!lostReason) {
      return {
        ok: false,
        code: 'REASON_REQUIRED',
        message: 'A valid reason is required when marking a lead as lost.',
      };
    }
    return { ok: true, payload: { toStage, lostReason } };
  }

  if (lostReason) {
    return {
      ok: false,
      code: 'REASON_NOT_ALLOWED',
      message: 'A lost reason can only be provided when transitioning to the "lost" stage.',
    };
  }

  return { ok: true, payload: { toStage } };
}
