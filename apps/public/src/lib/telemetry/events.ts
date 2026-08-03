// apps/public/src/lib/telemetry/events.ts
//
// The event taxonomy from docs/analytics-and-consent-spec.md §4.
//
// Nothing here carries a direct identifier. The session id travels as an
// HttpOnly cookie the browser cannot read, so a payload cannot claim an identity
// it was not issued (spec §6).

export type TelemetryEventName =
  // spatial
  | 'place_enter'
  | 'place_exit'
  | 'camera_dwell'
  | 'node_focus'
  | 'hologram_focus'
  | 'hologram_parcel_select'
  | 'media_open'
  | 'cta_hover'
  | 'route_open'
  | 'route_close'
  // session
  | 'session_start'
  | 'session_end'
  | 'form_start'
  | 'form_submit'
  | 'form_abandon';

/** Payloads are deliberately narrow. Anything not listed is not collected —
 *  in particular `form_abandon` carries a field COUNT and never field values,
 *  which is the line between measuring drop-off and the ghost-capture the spec
 *  refuses in §9. */
export interface TelemetryEvent {
  event: TelemetryEventName;
  /** Which of the ~7 world places this happened in. */
  placeId?: string;
  payload?: Record<string, string | number | boolean | null>;
  /** Client clock, epoch ms. The server records its own receipt time too and
   *  trusts that one for retention maths. */
  ts: number;
}

/** Highest-value events in the system: because the plots are real extruded
 *  geometry with their own contours, a raycast returns an actual parcel rather
 *  than a pixel on a texture. Spec §10 requires these to survive on every
 *  device tier, including the non-WebGL fallback, because scoring depends on
 *  them. */
export const CRITICAL_EVENTS: readonly TelemetryEventName[] = [
  'hologram_focus',
  'hologram_parcel_select',
  'form_submit',
] as const;

export function isCritical(e: TelemetryEventName): boolean {
  return CRITICAL_EVENTS.includes(e);
}
