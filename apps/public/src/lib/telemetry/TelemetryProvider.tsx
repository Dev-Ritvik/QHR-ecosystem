'use client';

// apps/public/src/lib/telemetry/TelemetryProvider.tsx
//
// Binds the collector to consent. This is the only place that flips it on, so
// there is exactly one gate to audit.

import { useEffect } from 'react';
import { useConsent } from '@/lib/consent/ConsentProvider';
import { telemetry } from './collector';

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const { ready, granted } = useConsent();
  const allowed = ready && granted('analytics');

  useEffect(() => {
    telemetry.attachLifecycle();
  }, []);

  useEffect(() => {
    telemetry.setEnabled(allowed);
    if (!allowed) return;

    // Device tier is MEASURED, never read off a GPU model string — spec §9
    // rules that out and §10 requires frame-time tiering instead. Sent once at
    // session start so the CRM can tell a genuine bounce from a device that
    // could not carry the experience.
    telemetry.push('session_start', undefined, {
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      viewportW: typeof window !== 'undefined' ? window.innerWidth : 0,
      viewportH: typeof window !== 'undefined' ? window.innerHeight : 0,
      deviceMemory:
        typeof navigator !== 'undefined' &&
        'deviceMemory' in navigator &&
        typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 'number'
          ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory!
          : null,
      cores:
        typeof navigator !== 'undefined' && navigator.hardwareConcurrency
          ? navigator.hardwareConcurrency
          : null,
    });

    return () => {
      telemetry.flush(true);
    };
  }, [allowed]);

  return <>{children}</>;
}
