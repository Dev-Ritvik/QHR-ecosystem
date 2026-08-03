// apps/public/src/lib/consent/types.ts
//
// Consent model for the DPDP Act 2023. See docs/analytics-and-consent-spec.md §3.
//
// The rule that shapes everything here: consent must be free, specific, informed
// and unambiguous, given by clear affirmative action. So every optional category
// defaults to OFF, each is independently refusable, and withdrawal is as easy as
// granting. Nothing may be collected before a choice exists.

/** Bump when the notice text or the set of categories changes. A stored choice
 *  against an older version is treated as absent, and the visitor is asked
 *  again — silently inheriting consent across a changed notice is exactly the
 *  "informed" failure the Act is aimed at. */
export const CONSENT_VERSION = 1;

/** Twelve months. Long enough not to nag, short enough to be a real re-ask. */
export const CONSENT_MAX_AGE_S = 60 * 60 * 24 * 365;

export const CONSENT_COOKIE = 'qhr_consent';
/** Ephemeral, essential. Dies with the browser session. */
export const SESSION_COOKIE = 'qhr_sid';
/** Persistent, and written ONLY under Analytics consent. This is the difference
 *  between remembering a returning visitor and tracking one. */
export const VISITOR_COOKIE = 'qhr_vid';

/** Categories a visitor can refuse. `essential` is deliberately not in this
 *  union — it carries no profiling and no identifier outliving the session, so
 *  there is nothing to consent to. */
export type ConsentCategory = 'experience' | 'analytics' | 'marketing';

export const CONSENT_CATEGORIES: readonly ConsentCategory[] = [
  'experience',
  'analytics',
  'marketing',
] as const;

export interface ConsentState {
  version: number;
  experience: boolean;
  analytics: boolean;
  marketing: boolean;
  /** Epoch seconds the choice was recorded. */
  decidedAt: number;
}

/** No stored choice, or a choice against a superseded notice. Collection is not
 *  permitted in this state. */
export type ConsentStatus = ConsentState | null;

export const DENY_ALL: ConsentState = {
  version: CONSENT_VERSION,
  experience: false,
  analytics: false,
  marketing: false,
  decidedAt: 0,
};

export function allowAll(now = Math.floor(Date.now() / 1000)): ConsentState {
  return {
    version: CONSENT_VERSION,
    experience: true,
    analytics: true,
    marketing: true,
    decidedAt: now,
  };
}

export function essentialOnly(now = Math.floor(Date.now() / 1000)): ConsentState {
  return { ...DENY_ALL, decidedAt: now };
}

export function isGranted(
  state: ConsentStatus,
  category: ConsentCategory,
): boolean {
  if (!state || state.version !== CONSENT_VERSION) return false;
  return state[category] === true;
}

/** What the visitor is told, per category. Kept beside the model so the notice
 *  and the enforcement can never drift apart — if a category is added without
 *  copy, this fails to compile. */
export const CONSENT_COPY: Record<
  ConsentCategory | 'essential',
  { title: string; body: string }
> = {
  essential: {
    title: 'Essential',
    body:
      'Keeps the site working — your session, security, and loading the 3D scene. ' +
      'No profiling, and nothing that outlives your visit. Always on.',
  },
  experience: {
    title: 'Experience',
    body:
      'Remembers where you were, your sound and lighting preferences, and the last ' +
      'place you visited, so returning picks up where you left off.',
  },
  analytics: {
    title: 'Analytics',
    body:
      'Lets us see which projects and plots you spend time with, so we can show you ' +
      'more of what you looked at and skip what you did not. Also tells us which ' +
      'parts of the experience are slow on your device.',
  },
  marketing: {
    title: 'Marketing',
    body:
      'Allows us to show you relevant follow-ups on Meta, Google and LinkedIn, based ' +
      'on the projects you viewed here.',
  },
};
