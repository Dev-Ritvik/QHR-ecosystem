// apps/public/src/app/(site)/(experience)/hall/page.tsx
//
// The first route that mounts real 3D. Deliberately its own route rather than
// retrofitted onto /about or /why-us: those are text nodes, and the scene needs
// to own the viewport.

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

// ssr:false is required, not stylistic — three.js touches window and WebGL at
// module scope, and the bundle is large enough that it must never sit in the
// server graph.
const HallScene = dynamic(
  () => import('@/components/experience/HallScene').then((m) => m.HallScene),
  { ssr: false },
);

export const metadata: Metadata = {
  title: 'The Hall — Quality Homes Reality',
  description:
    'Walk the presentation hall and read the layouts for Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
};

export default function HallPage() {
  return (
    <>
      <RouteTelemetry routeId="hall" />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Chapter III
          </p>
          <h1 className="mt-2 font-serif text-3xl text-neutral-900">
            The presentation hall
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Three layouts, raised on their own tables. Drag to look around, and
            move closer to read the plots.
          </p>
        </header>

        <HallScene />
      </main>
    </>
  );
}
