'use client';

// apps/public/src/lib/consent/ConsentProvider.tsx
//
// Single source of truth for consent on the client. Anything that collects —
// PostHog, the telemetry collector, ad pixels — subscribes here and must hold
// its fire until the category it needs is granted.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  clearCookie,
  readConsentFromDocument,
  writeConsentToDocument,
} from './cookie';
import {
  CONSENT_VERSION,
  VISITOR_COOKIE,
  allowAll,
  essentialOnly,
  isGranted,
  type ConsentCategory,
  type ConsentState,
  type ConsentStatus,
} from './types';

/** Fires on every change so non-React collectors can react without polling. */
export const CONSENT_EVENT = 'qhr:consent';

interface ConsentContextValue {
  /** null until hydrated, so nothing collects during the first paint. */
  consent: ConsentStatus;
  /** True once the cookie has been read — distinguishes "no choice" from
   *  "not yet known", which matters because only the former should prompt. */
  ready: boolean;
  /** No valid choice against the current notice: show the panel. */
  needsDecision: boolean;
  granted: (category: ConsentCategory) => boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  save: (choice: Record<ConsentCategory, boolean>) => void;
  /** Re-open the panel — the persistent withdrawal route the Act requires. */
  reopen: () => void;
  panelOpen: boolean;
  closePanel: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentStatus>(null);
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    setConsent(readConsentFromDocument());
    setReady(true);
  }, []);

  const commit = useCallback((next: ConsentState) => {
    writeConsentToDocument(next);

    // Withdrawal has to be real. The persistent visitor id exists only to stitch
    // sessions under Analytics consent, so revoking that must remove it rather
    // than leave it lying around unused.
    if (!next.analytics) clearCookie(VISITOR_COOKIE);

    setConsent(next);
    setPanelOpen(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: next }));
    }
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      ready,
      needsDecision:
        ready && (consent === null || consent.version !== CONSENT_VERSION),
      granted: (c) => isGranted(consent, c),
      acceptAll: () => commit(allowAll()),
      rejectAll: () => commit(essentialOnly()),
      save: (choice) =>
        commit({
          version: CONSENT_VERSION,
          experience: choice.experience,
          analytics: choice.analytics,
          marketing: choice.marketing,
          decidedAt: Math.floor(Date.now() / 1000),
        }),
      reopen: () => setPanelOpen(true),
      panelOpen,
      closePanel: () => setPanelOpen(false),
    }),
    [consent, ready, panelOpen, commit],
  );

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error('useConsent must be used inside <ConsentProvider>');
  }
  return ctx;
}

/** Convenience for the common "may I collect?" check. Returns false until
 *  hydration completes, which is the safe default. */
export function useConsentGranted(category: ConsentCategory): boolean {
  const { granted, ready } = useConsent();
  return ready && granted(category);
}
