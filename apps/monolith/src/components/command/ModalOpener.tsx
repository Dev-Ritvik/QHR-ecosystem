'use client';

// apps/monolith/src/components/command/ModalOpener.tsx
//
// Renders NOTHING — MASTER_SPEC §4.5 step 1.
//
// Mounting is the signal. When Next matches an intercepted route it mounts the
// @modal slot, this component mounts with it, and requestOpen() starts the
// freeze sequence:
//
//   requestOpen()  ->  invalidate()  ->  onAfterRender { capture; freeze }
//
// Deliberately does NOT set frameloop itself. The canvas must render ONE MORE
// FRAME before it can be captured; freezing here would capture a cleared
// backbuffer. That ordering is the whole reason the crossfade is seamless, and
// it is the mistake the source documents disagreed about (§4.5 [RESOLVED §7]).

import { useEffect } from 'react';
import { useCommandStore } from '@/state/commandStore';

export function ModalOpener() {
  const requestOpen = useCommandStore((s) => s.requestOpen);
  const close = useCommandStore((s) => s.close);

  useEffect(() => {
    requestOpen();
    return () => close();
  }, [requestOpen, close]);

  return null;
}
