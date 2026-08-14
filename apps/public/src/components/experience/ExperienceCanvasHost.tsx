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
import { SmoothScroll } from './SmoothScroll';

const ExperienceCanvas = dynamic(
  () => import('./WorldCanvas').then((m) => m.WorldCanvas),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className="fixed inset-0 z-0 bg-[#0A1120]" />,
  },
);

// Split from the canvas import on purpose: the counter must be on screen while
// the WebGL bundle itself is still downloading, so it cannot live behind the
// same ssr:false boundary it is covering for.
const ExperiencePreloader = dynamic(
  () => import('./Preloader').then((m) => m.Preloader),
  { ssr: false },
);

export function ExperienceCanvasHost() {
  return (
    <>
      <SmoothScroll />
      <ExperienceCanvas />
      <ExperiencePreloader />
    </>
  );
}
