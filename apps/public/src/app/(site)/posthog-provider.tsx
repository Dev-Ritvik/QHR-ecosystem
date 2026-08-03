'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, useRef } from 'react';
import { useConsent } from '@/lib/consent/ConsentProvider';

// PostHog previously initialised unconditionally on mount, which meant it began
// collecting before the visitor had been asked anything. Under the DPDP Act
// consent must precede collection, so init is now gated on the Analytics
// category, and withdrawal actively tears the session down rather than merely
// stopping new events.
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { ready, granted } = useConsent();
  const started = useRef(false);
  const allowed = ready && granted('analytics');

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    if (allowed && !started.current) {
      posthog.init(key, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        capture_pageview: false,
        // Belt and braces: even once initialised, nothing leaves the page until
        // opt_in_capturing() below. If this ever mounts against a stale consent
        // read, the default is still silence.
        opt_out_capturing_by_default: true,
        persistence: 'localStorage+cookie',
      });
      started.current = true;
    }

    if (!started.current) return;

    if (allowed) {
      posthog.opt_in_capturing();
    } else {
      // Withdrawal must be real: stop capturing AND drop the distinct id, so a
      // later re-consent is not silently stitched to the earlier session.
      posthog.opt_out_capturing();
      posthog.reset();
    }
  }, [allowed]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
