// packages/domain/src/leads/scoring.ts
//
// Propensity scoring, 0–100. See docs/analytics-and-consent-spec.md §5.
//
// Two properties this must have, and they are requirements rather than taste:
//
//   Auditable. The sales floor has to be able to see WHY a lead scored what it
//   did, and under the DPDP Act the visitor can ask to have it explained. So the
//   function returns a breakdown, not just a number, and the breakdown is what
//   gets persisted alongside the score.
//
//   Fair when consent is refused. A visitor who declines analytics still scores,
//   on form content and explicit actions alone, capped at CAP_WITHOUT_ANALYTICS.
//   Never zero, never hidden. Refusing tracking must not make a buyer invisible
//   to the sales floor — that would punish the person for exercising a right.

import type { BranchId, StationId } from './branches';

export interface ScoringInput {
  /** False when the visitor refused Analytics. Everything derived from
   *  telemetry is then unavailable, by design rather than by accident. */
  analyticsConsent: boolean;

  /** Dwell in ms at each hologram station. */
  hologramDwellMs?: Partial<Record<StationId, number>>;
  /** Distinct parcels the visitor focused on, per station. */
  parcelsFocused?: number;
  /** Parcels explicitly selected — a click, not a glance. */
  parcelsSelected?: number;

  /** Distinct world places entered. */
  placesVisited?: number;
  /** Median dwell across those places, ms. */
  medianPlaceDwellMs?: number;

  /** Route dwell in ms where pacing indicated reading rather than skimming. */
  consideredRouteDwellMs?: number;

  /** Explicit intent actions, regardless of consent — these come from the form
   *  and from clicks the visitor initiated. */
  floorPlanOpens?: number;
  pricingViews?: number;
  siteVisitInterest?: boolean;

  /** Distinct sessions in the last 30 days. Requires Analytics consent to be
   *  knowable at all, since it needs the persistent visitor id. */
  returnSessions?: number;
}

export interface ScoreBreakdown {
  hologramEngagement: number;
  explorationDepth: number;
  contentConsideration: number;
  explicitIntent: number;
  returnBehaviour: number;
  /** True when the total was limited because analytics was refused. */
  cappedForNoConsent: boolean;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  band: 'outbound' | 'nurture' | 'cold';
}

export const MAX_HOLOGRAM = 30;
export const MAX_EXPLORATION = 20;
export const MAX_CONTENT = 15;
export const MAX_INTENT = 20;
export const MAX_RETURN = 15;

/** Confirmed by the client: 75+ triggers immediate outbound, below 40 is
 *  nurture only. */
export const OUTBOUND_THRESHOLD = 75;
export const NURTURE_THRESHOLD = 40;
export const CAP_WITHOUT_ANALYTICS = 40;

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

// Half-saturation points. These are the calibration, and they matter more than
// the weights: with the first set of values a maximally engaged visitor topped
// out at 68, so the 75 threshold the client signed off would never once have
// fired. Each is now set so a realistically strong visitor reaches roughly 80%
// of the component, and the bands mean what they say.
const HALF = {
  hologramDwellMs: 20_000,
  parcelsFocused: 2,
  placesVisited: 1.5,
  placeDwellMs: 12_000,
  routeDwellMs: 30_000,
  parcelsSelected: 0.6,
  floorPlanOpens: 0.6,
  pricingViews: 0.5,
  returnSessions: 0.7,
} as const;

/** Diminishing returns: the first minute of attention says far more than the
 *  tenth, and a linear scale would let one idle tab out-score real interest. */
function saturating(value: number, halfway: number, max: number): number {
  if (value <= 0) return 0;
  return max * (value / (value + halfway));
}

export function scoreLead(input: ScoringInput): ScoreResult {
  const analytics = input.analyticsConsent;

  // ---- Hologram engagement (30)
  // The highest-signal component we have: which township, and whether they got
  // as far as individual parcels.
  let hologram = 0;
  if (analytics) {
    const dwell = Object.values(input.hologramDwellMs ?? {}).reduce(
      (a: number, b) => a + (b ?? 0),
      0,
    );
    // 45s of station dwell reaches half of the available points.
    hologram += saturating(dwell, HALF.hologramDwellMs, MAX_HOLOGRAM * 0.6);
    hologram += saturating(input.parcelsFocused ?? 0, HALF.parcelsFocused, MAX_HOLOGRAM * 0.4);
  }

  // ---- Depth of exploration (20)
  let exploration = 0;
  if (analytics) {
    const places = input.placesVisited ?? 0;
    const median = input.medianPlaceDwellMs ?? 0;
    exploration += saturating(places, HALF.placesVisited, MAX_EXPLORATION * 0.5);
    exploration += saturating(median, HALF.placeDwellMs, MAX_EXPLORATION * 0.5);
  }

  // ---- Content consideration (15)
  const content = analytics
    ? saturating(input.consideredRouteDwellMs ?? 0, HALF.routeDwellMs, MAX_CONTENT)
    : 0;

  // ---- Explicit intent (20, or the whole cap when analytics is refused)
  // Available WITHOUT analytics consent: these are actions the visitor took on
  // purpose, and a site visit request is intent whether or not we may profile.
  //
  // The ceiling widens to CAP_WITHOUT_ANALYTICS when the other four components
  // are unavailable. Leaving it at 20 looked reasonable until the tests showed
  // the consequence: a refusing visitor could never exceed 20 and so was
  // permanently in the "cold" band no matter how much explicit intent they
  // showed — deprioritised for exercising a right, which is the exact outcome
  // §5 says must not happen. With the wider ceiling, someone who selects a
  // parcel and asks for a site visit reaches nurture on their actions alone.
  const intentMax = analytics ? MAX_INTENT : CAP_WITHOUT_ANALYTICS;
  let intent = 0;
  intent += saturating(input.parcelsSelected ?? 0, HALF.parcelsSelected, intentMax * 0.4);
  intent += saturating(input.floorPlanOpens ?? 0, HALF.floorPlanOpens, intentMax * 0.2);
  intent += saturating(input.pricingViews ?? 0, HALF.pricingViews, intentMax * 0.15);
  if (input.siteVisitInterest) intent += intentMax * 0.25;

  // ---- Return behaviour (15)
  const returning = analytics
    ? saturating(Math.max(0, (input.returnSessions ?? 1) - 1), HALF.returnSessions, MAX_RETURN)
    : 0;

  const breakdown: ScoreBreakdown = {
    hologramEngagement: Math.round(clamp(hologram, MAX_HOLOGRAM)),
    explorationDepth: Math.round(clamp(exploration, MAX_EXPLORATION)),
    contentConsideration: Math.round(clamp(content, MAX_CONTENT)),
    explicitIntent: Math.round(clamp(intent, intentMax)),
    returnBehaviour: Math.round(clamp(returning, MAX_RETURN)),
    cappedForNoConsent: false,
  };

  let total =
    breakdown.hologramEngagement +
    breakdown.explorationDepth +
    breakdown.contentConsideration +
    breakdown.explicitIntent +
    breakdown.returnBehaviour;

  // Flag whenever the score was computed without telemetry, not only when the
  // clamp bites: the sales floor needs to know a 38 here is a ceiling-limited 38,
  // not a lukewarm one, or they will misread a strong lead as a weak one.
  if (!analytics) {
    total = Math.min(total, CAP_WITHOUT_ANALYTICS);
    breakdown.cappedForNoConsent = true;
  }

  const score = clamp(Math.round(total), 100);
  return {
    score,
    breakdown,
    band:
      score >= OUTBOUND_THRESHOLD
        ? 'outbound'
        : score >= NURTURE_THRESHOLD
          ? 'nurture'
          : 'cold',
  };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export interface RoutingInput {
  /** Dwell per station — interest, which the spec ranks above geography. */
  hologramDwellMs?: Partial<Record<StationId, number>>;
  /** A branch the visitor named themselves. Wins outright. */
  statedPreference?: BranchId | null;
  /** City/district from geo-IP, resolved to city level only — never finer. */
  geoPlace?: string | null;
}

export interface RoutingResult {
  branch: BranchId;
  /** Persisted so a misroute is diagnosable rather than mysterious. */
  reason: string;
}
