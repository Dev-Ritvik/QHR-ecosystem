'use client';

// apps/public/src/components/telemetry/RouteTelemetry.tsx
//
// Drop-in marker for a route. The pages are server components, so the hook needs
// a client boundary; this renders nothing and exists only to own that boundary.
//
// Deliberately not placed in the layout: route_open/route_close must bracket a
// single route, and a layout-level mount would span navigations within the same
// segment and report one enormous dwell.

import { useRouteTelemetry } from '@/lib/telemetry/hooks';

export function RouteTelemetry({ routeId }: { routeId: string }) {
  useRouteTelemetry(routeId);
  return null;
}
