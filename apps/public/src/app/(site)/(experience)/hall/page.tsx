// apps/public/src/app/(site)/(experience)/hall/page.tsx
//
// A PLACE, not a surface. The world is mounted by the (experience) layout and
// is already standing here — this route contributes only the readable layer.
//
// Note what is absent: no <Canvas>. The scene belongs to the layout so it can
// survive navigation; mounting one here as well would create a second WebGL
// context and upload the 15MB model twice.

import type { Metadata } from 'next';
import Link from 'next/link';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';
import { PROJECTS } from '@estate/domain/leads/branches';

export const metadata: Metadata = {
  title: 'The Hall — Quality Homes Reality',
  description:
    'Three layouts raised on their own tables: Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
};

export default function HallPage() {
  return (
    <>
      <RouteTelemetry routeId="hall" />

      {/* Sits at the foot of the viewport so the room is unobstructed. The
          world is the content here; this is the caption, not the page. */}
      <div className="pointer-events-none flex min-h-screen flex-col justify-end p-6 md:p-10">
        <div className="pointer-events-auto max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#F2EDE4]/50">
            The presentation hall
          </p>
          <h1 className="mt-3 font-serif text-3xl text-[#F2EDE4] md:text-4xl">
            Three addresses, one room
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#F2EDE4]/70">
            Each layout stands on its own table. Move closer to read the plots.
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {PROJECTS.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/projects/${p.slug}`}
                  className="text-sm text-[#F2EDE4]/80 underline-offset-4 transition hover:text-[#F2EDE4] hover:underline"
                >
                  {p.name}
                </Link>
                <span className="ml-2 text-xs text-[#F2EDE4]/40">
                  {p.district}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
