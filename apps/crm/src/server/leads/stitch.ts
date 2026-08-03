// apps/crm/src/server/leads/stitch.ts
//
// Attach a visitor session to a lead, then score and route it.
//
// This runs in the CRM rather than the public site because the CRM owns the
// telemetry. Scoring on the public side would mean shipping the whole session
// history to the browser and trusting it back — a lead score the visitor can
// edit is worse than no lead score.
//
// Everything here is best-effort by design. A failed stitch must never fail the
// enquiry: losing a score is a nuisance, losing a lead is lost revenue.

import { sql } from 'drizzle-orm';
// Subpath imports: packages/domain has no barrel index, and the rest of the
// codebase reaches into it the same way (see @estate/domain/leads/dedupe).
import { scoreLead, type ScoringInput } from '@estate/domain/leads/scoring';
import { routeLead } from '@estate/domain/leads/routing';
import type { StationId, BranchId } from '@estate/domain/leads/branches';

// Station ids as they appear in place/payload fields from the 3D hall.
const STATIONS: StationId[] = ['S1', 'S2', 'S3'];

interface Tx {
  execute: (q: unknown) => Promise<unknown>;
}

interface SessionRow {
  id: string;
  consent_analytics: boolean;
  utm_source: string | null;
  visitor_id: string | null;
}

/**
 * @param geoPlace city/district resolved from the request IP, city-level only.
 *                 Null when unavailable — routing falls back rather than guessing.
 */
export async function stitchSessionToLead(
  tx: Tx,
  leadId: string,
  sessionId: string | null,
  geoPlace: string | null,
): Promise<{ score: number; branch: BranchId; reason: string } | null> {
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;

  const sessions = (await tx.execute(sql`
    SELECT id, consent_analytics, utm_source, visitor_id
    FROM core.visitor_sessions WHERE id = ${sessionId}::uuid
  `)) as unknown as SessionRow[];
  const session = sessions?.[0];

  // No session row means the visitor refused analytics (nothing was ever
  // written) or their telemetry has since been erased. Either way they still
  // get scored — on the form alone — rather than being dropped.
  const analytics = Boolean(session?.consent_analytics);

  const input: ScoringInput = { analyticsConsent: analytics };
  const dwell: Partial<Record<StationId, number>> = {};

  if (analytics) {
    const rows = (await tx.execute(sql`
      SELECT event, place_id, payload
      FROM core.session_events
      WHERE session_id = ${sessionId}::uuid
      ORDER BY occurred_at ASC
      LIMIT 5000
    `)) as unknown as Array<{
      event: string;
      place_id: string | null;
      payload: Record<string, unknown> | null;
    }>;

    const places = new Set<string>();
    const placeDwells: number[] = [];
    const parcels = new Set<string>();
    let parcelSelects = 0;
    let consideredMs = 0;
    let floorPlans = 0;

    for (const r of rows ?? []) {
      const p = r.payload ?? {};
      const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : 0);

      switch (r.event) {
        case 'place_enter':
          if (r.place_id) places.add(r.place_id);
          break;
        case 'place_exit':
          if (num('dwellMs') > 0) placeDwells.push(num('dwellMs'));
          break;
        case 'hologram_focus': {
          const st = String(p.station ?? r.place_id ?? '');
          if ((STATIONS as string[]).includes(st)) {
            dwell[st as StationId] = (dwell[st as StationId] ?? 0) + num('dwellMs');
          }
          if (p.parcelId) parcels.add(`${st}:${String(p.parcelId)}`);
          break;
        }
        case 'hologram_parcel_select':
          parcelSelects += 1;
          break;
        case 'route_close':
          consideredMs += num('consideredMs');
          break;
        case 'media_open':
          if (p.kind === 'plan') floorPlans += 1;
          break;
      }
    }

    placeDwells.sort((a, b) => a - b);
    input.hologramDwellMs = dwell;
    input.parcelsFocused = parcels.size;
    input.parcelsSelected = parcelSelects;
    input.placesVisited = places.size;
    input.medianPlaceDwellMs =
      placeDwells.length > 0
        ? placeDwells[Math.floor(placeDwells.length / 2)]
        : 0;
    input.consideredRouteDwellMs = consideredMs;
    input.floorPlanOpens = floorPlans;

    // Return visits are only knowable through the persistent visitor id, which
    // only exists under Analytics consent.
    if (session?.visitor_id) {
      const counts = (await tx.execute(sql`
        SELECT count(*)::int AS n FROM core.visitor_sessions
        WHERE visitor_id = ${session.visitor_id}::uuid
          AND first_seen_at > now() - interval '30 days'
      `)) as unknown as Array<{ n: number }>;
      input.returnSessions = counts?.[0]?.n ?? 1;
    }
  }

  const scored = scoreLead(input);
  const routed = routeLead({ hologramDwellMs: dwell, geoPlace });

  await tx.execute(sql`
    UPDATE core.leads
    SET lead_score = ${scored.score},
        lead_score_breakdown = ${JSON.stringify(scored.breakdown)}::jsonb,
        session_id = ${sessionId}::uuid,
        routed_branch = ${routed.branch},
        routing_reason = ${routed.reason},
        updated_at = now()
    WHERE id = ${leadId}::uuid
  `);

  if (session) {
    await tx.execute(sql`
      UPDATE core.visitor_sessions
      SET lead_id = ${leadId}::uuid, updated_at = now()
      WHERE id = ${sessionId}::uuid
    `);
  }

  return { score: scored.score, branch: routed.branch, reason: routed.reason };
}
