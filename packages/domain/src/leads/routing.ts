// packages/domain/src/leads/routing.ts
//
// Three-branch routing. See docs/analytics-and-consent-spec.md §7.
//
// Order matters and is deliberate:
//   1. What the visitor SAID. An explicit preference beats anything inferred.
//   2. What they LOOKED AT. Interest is a stronger buying signal than where the
//      request happened to originate — someone browsing from Hyderabad who spent
//      four minutes on the Srikakulam township belongs to Srikakulam, not to
//      whichever office is nearest their IP.
//   3. Where they ARE. Geography is the tiebreak, not the driver.
//   4. Head office, when nothing else resolves. Never unrouted.

import {
  BRANCHES,
  branchForPlace,
  projectByStation,
  type BranchId,
  type StationId,
} from './branches';
import type { RoutingInput, RoutingResult } from './scoring';

const HEAD_OFFICE: BranchId = 'visakhapatnam';

export function routeLead(input: RoutingInput): RoutingResult {
  // 1. Stated preference
  if (input.statedPreference && BRANCHES[input.statedPreference]) {
    return {
      branch: input.statedPreference,
      reason: `stated_preference:${input.statedPreference}`,
    };
  }

  // 2. Interest — the station with the most dwell picks the office that owns it
  const dwell = input.hologramDwellMs ?? {};
  let topStation: StationId | null = null;
  let topMs = 0;
  for (const [station, ms] of Object.entries(dwell) as [StationId, number][]) {
    if ((ms ?? 0) > topMs) {
      topMs = ms ?? 0;
      topStation = station;
    }
  }
  // A brush past the table is not interest. Require a few seconds of real dwell
  // before letting it override geography.
  if (topStation && topMs >= 5_000) {
    const project = projectByStation(topStation);
    if (project) {
      return {
        branch: project.branch,
        reason: `interest:${project.slug}:${Math.round(topMs / 1000)}s`,
      };
    }
  }

  // 3. Geography
  const geo = branchForPlace(input.geoPlace);
  if (geo) {
    return { branch: geo, reason: `geo:${input.geoPlace}` };
  }

  // 4. Fallback
  return { branch: HEAD_OFFICE, reason: 'fallback:head_office' };
}
