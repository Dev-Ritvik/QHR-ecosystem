// apps/public/src/app/(site)/(experience)/gallery/page.tsx
//
// A SURFACE read from the hall.
//
// What is here is what genuinely exists: the three approved layout plans, which
// are the most informative images the client has — a buyer learns more from a
// plot grid than from a stock render. Site photography does not exist in
// anything supplied, and rather than fill the page with generic imagery the
// absence is stated.

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Surface } from '@/components/experience/Surface';
import { RouteTelemetry } from '@/components/telemetry/RouteTelemetry';

export const metadata: Metadata = {
  title: 'Gallery — Quality Homes Reality',
  description:
    'Approved layout plans for Kartikeya Water Front, Lucky Garden and VSR Gayatri Township.',
};

const PLATES = [
  {
    src: '/gallery/kartikeya-layout.jpg',
    w: 1600,
    h: 1557,
    name: 'Kartikeya Water Front',
    slug: 'kartikeya-water-front',
    caption:
      'Poosapatirega, Vizianagaram. Plots at 30′×50′, 30′×56′ and 30′×60′ around a central lake, with 40′ and 30′ internal roads.',
  },
  {
    src: '/gallery/lucky-garden-layout.jpg',
    w: 1600,
    h: 948,
    name: 'Lucky Garden',
    slug: 'lucky-garden',
    caption:
      'Kumaram Village, Garividi, Vizianagaram. Plot status is marked on the sheet, with the future extension to the west.',
  },
  {
    src: '/gallery/gayatri-layout.jpg',
    w: 1600,
    h: 1140,
    name: 'VSR Gayatri Township',
    slug: 'vsr-gayatri-township',
    caption:
      'Bayyannapeta, near Allinagaram, Srikakulam. 60′×30′ plots on 40′ roads, with public open space along the western boundary.',
  },
];

export default function GalleryPage() {
  return (
    <>
      <RouteTelemetry routeId="gallery" />
      <Surface
        eyebrow="Gallery"
        title="The layouts, full size"
        lede="The same three plans that stand on the tables in the hall — here as flat sheets you can read closely or take away."
      >
        <div className="space-y-14">
          {PLATES.map((p) => (
            <figure key={p.slug}>
              <div className="overflow-hidden rounded border border-white/10 bg-white">
                <Image
                  src={p.src}
                  alt={`Approved layout plan for ${p.name}`}
                  width={p.w}
                  height={p.h}
                  className="h-auto w-full"
                  // Only the first plate is above the fold on most screens.
                  priority={p.slug === 'kartikeya-water-front'}
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              </div>
              <figcaption className="mt-4">
                <Link
                  href={`/projects/${p.slug}`}
                  className="font-serif text-lg text-[#F2EDE4] underline-offset-4 hover:underline"
                >
                  {p.name}
                </Link>
                <p className="mt-1 text-sm leading-relaxed text-[#F2EDE4]/65">
                  {p.caption}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-14 border-t border-white/10 pt-6 text-sm leading-relaxed text-[#F2EDE4]/55">
          Site photography and amenity images are not published here yet. When
          they are, they will be photographs of these three sites rather than
          stock imagery — a buyer can tell the difference, and being caught
          using someone else&rsquo;s aerial shot costs more trust than an empty
          gallery does.
        </p>
      </Surface>
    </>
  );
}
