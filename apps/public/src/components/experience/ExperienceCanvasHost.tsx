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
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { SmoothScroll } from './SmoothScroll';
import { coverGround, coverState } from './coverState';

const ExperienceCanvas = dynamic(
  () => import('./WorldCanvas').then((m) => m.WorldCanvas),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className="fixed inset-0 z-0 bg-[#0A1120]" />,
  },
);

// Split from the canvas import on purpose: the cover must be live while the
// WebGL bundle itself is still downloading, so it cannot live behind the same
// ssr:false boundary it is covering for. (And since that is still after first
// paint, a static copy of it is server-rendered below.)
const ExperiencePreloader = dynamic(
  () => import('./Preloader').then((m) => m.Preloader),
  { ssr: false },
);

/**
 * THE COVER, IN THE FIRST PAINT. The Preloader is a client-only chunk, so on a
 * cold load the page painted its copy over an empty frame, then the canvas lit
 * a bare sky behind it, and only then did the cover arrive over both — the
 * flash the second art-direction audit saw at 00:08. This is the same cover,
 * server-rendered, so it is on screen before any script runs; the Preloader,
 * drawn identically above it, removes it the moment it mounts. On a return
 * within the document the scene is already built and neither is drawn.
 */
function StaticCover() {
  const ground = coverGround(usePathname());
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[59] flex flex-col items-center justify-center"
      style={{ background: ground }}
    >
      <span className="t-micro text-[#F2EDE4]/[0.62]">Quality Homes Reality</span>
      <span className="relative mt-6 block h-px w-28 bg-[#F2EDE4]/[0.12]" />
    </div>
  );
}

export function ExperienceCanvasHost() {
  const [cover, setCover] = useState(() => !coverState.sceneInMemory);
  return (
    <>
      <SmoothScroll />
      <ExperienceCanvas />
      {cover ? <StaticCover /> : null}
      <ExperiencePreloader onMount={() => setCover(false)} />
    </>
  );
}
