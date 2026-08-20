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

import dynamic from 'next/dynamic';

const World = dynamic(
  () => import('./WorldCanvas').then((m) => m.WorldCanvas),
  { ssr: false, loading: () => <div aria-hidden className="world bg-void" /> },
);

export function ExperienceHost() {
  return <World />;
}
