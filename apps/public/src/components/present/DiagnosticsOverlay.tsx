'use client';

import { useEffect, useState } from 'react';

/**
 * FR-PM11: Hidden diagnostic view for dev/ops during office setup.
 * Toggled via Ctrl+Shift+D. Strictly no client-facing error UI.
 */
export function DiagnosticsOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState({
    online: true,
    tier: 'unknown',
    screen: '',
    userAgent: ''
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Key combo: Ctrl + Shift + D
      if (e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isVisible) {
      setMetrics({
        online: navigator.onLine,
        tier: window.localStorage.getItem('capability_tier') || 'unknown',
        screen: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent
      });
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 z-50 w-full h-full bg-black/80 text-green-400 font-mono p-8 pointer-events-none text-sm">
      <h2 className="text-xl font-bold mb-4 text-white">System Diagnostics (Hidden)</h2>
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div><strong>Network:</strong> {metrics.online ? 'Online' : 'Offline'}</div>
        <div><strong>Capability Tier:</strong> {metrics.tier}</div>
        <div><strong>Resolution:</strong> {metrics.screen}</div>
        <div className="col-span-2 text-xs text-slate-400 mt-4 break-all">
          <strong>User Agent:</strong> {metrics.userAgent}
        </div>
        <div className="col-span-2 mt-4 text-slate-300">
          <em>Note: All asset failures and crashes are being routed silently to Sentry.</em>
        </div>
      </div>
    </div>
  );
}
