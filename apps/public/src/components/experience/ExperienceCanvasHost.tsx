// apps/public/src/components/experience/ExperienceCanvasHost.tsx
//
// The client boundary that lets a SERVER layout own the canvas.
//
// Why this file exists: `dynamic(..., { ssr: false })` is illegal inside a
// Server Component in the App Router. The (experience) layout must stay a
// Server Component (so its children can server-render for SEO), so the
// ssr:false import is quarantined here, in the smallest possible client leaf.
//
// The loading state is the void itself — not a spinner. A flat Midnight Navy
// field is indistinguishable from the not-yet-lit scene, so there is no visible
// "loading" moment even before the WebGL bundle arrives.
'use client';

import dynamic from 'next/dynamic';

const ExperienceCanvas = dynamic(
  () => import('./WorldCanvas').then((m) => m.WorldCanvas),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className="fixed inset-0 z-0 bg-[#0A1120]" />,
  },
);

export function ExperienceCanvasHost() {
  return <ExperienceCanvas />;
}
