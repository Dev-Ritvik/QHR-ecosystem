'use client';

import { useEffect, useRef } from 'react';

/**
 * Orchestrates offline resilience (FR-PM10) by registering the service worker
 * and binding silent resync hooks. No user-visible error UI is rendered (FR-PM11).
 */
export function OfflineManager() {
  const isRegistered = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Register Service Worker to make the prefetch cache durable
    if ('serviceWorker' in navigator && !isRegistered.current) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => {
          isRegistered.current = true;
          console.log('[OfflineManager] SW registered for offline resilience');
        })
        .catch((err) => console.error('[OfflineManager] SW registration failed', err));
    }

    // 2. Silent resync on reconnect
    const handleOnline = () => {
      console.log('[OfflineManager] Reconnected. Triggering silent resync...');
      // Firing standard window events triggers SWR/polling hooks (like T59's realtime 30s fallback) 
      // to refetch immediately, guaranteeing fresh data after reconnection.
      window.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    };

    const handleOffline = () => {
      console.log('[OfflineManager] Connection lost. Operating from durable cache.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return null;
}
