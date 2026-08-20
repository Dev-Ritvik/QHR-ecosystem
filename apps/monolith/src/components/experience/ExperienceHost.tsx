'use client';

// apps/monolith/src/components/experience/ExperienceHost.tsx
//
// The client boundary that lets a SERVER layout own the canvas.
//
// dynamic(..., { ssr: false }) is illegal inside a Server Component in the App
// Router. The (experience) layout must stay a Server Component so its children
// can server-render, so the ssr:false import is quarantined here, in the
// smallest possible client leaf.
//
// The loading state is the void itself, not a spinner: a flat #050505 field is
// indistinguishable from the not-yet-lit scene, so there is no visible
// "loading" moment even before the WebGL bundle arrives.

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { TierD } from './TierD';
import { Gate } from '@/components/command/Gate';
import { Chrome } from '@/components/command/Chrome';
import { subscribe } from '@/lib/ticker';
import { duckAudio, updateAudio } from '@/lib/audio';
import { useCommandStore } from '@/state/commandStore';

const World = dynamic(
  () => import('./WorldCanvas').then((m) => m.WorldCanvas),
  { ssr: false, loading: () => <div aria-hidden className="world bg-void" /> },
);

export function ExperienceHost() {
  // Audio reads q from the same clock as everything else (L1). A pure
  // subscriber: it never schedules its own work and never decides anything.
  useEffect(() => subscribe((q) => updateAudio(q)), []);

  // Ducked while the Command Overlay is open (§7). The world stops; the
  // dossier remains.
  const overlayOpen = useCommandStore((s) => s.overlayOpen);
  useEffect(() => duckAudio(overlayOpen), [overlayOpen]);

  return (
    <>
      {/* Tier D renders INSTEAD of the canvas, not alongside it — WorldCanvas
          returns null for tier D, so no WebGL context is ever created. */}
      <TierD />
      <World />
      {/* Above both. Holds scroll until consent resolves and [ ENTER ] is
          pressed — the same gesture that unlocks AudioContext. */}
      <Chrome />
      <Gate />
    </>
  );
}
