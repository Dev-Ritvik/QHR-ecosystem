'use client';

// apps/public/src/components/site/ProjectCard.tsx
//
// Two things were wrong here and the client review caught both.
//
// 1. LIGHT THEME ON A DARK PAGE. This carried text-gray-900 / bg-gray-100 from
//    when the site had a white background. After the chrome went dark the card
//    body was near-black type on near-black ground.
//
// 2. NO FAILURE STATE. `<img src={heroUrl}>` with no onError, so when heroUrl
//    pointed at a PDF — which it did, because the publish gate only checks that
//    a hero row EXISTS, not that the file is displayable — the browser fell back
//    to painting the alt text. Raw alt text on a card is the most obviously
//    broken thing a page can show.
//
// The URL is fixed at source, but a card must not depend on that being true
// forever: a hero can 404 after a storage migration or a bad publish. So the
// image failing is now a designed state, not an accident.

import { useState } from 'react';
import Link from 'next/link';
import { InferSelectModel } from 'drizzle-orm';
import { projectsPub } from '@estate/db/src/schema/projection';

type Project = InferSelectModel<typeof projectsPub>;

const assetClassMap: Record<Project['assetClass'], string> = {
  land: 'Plotted development',
  commercial: 'Commercial',
  luxury_residential: 'Luxury residential',
};

/** Displayable in an <img>. A PDF is not, and that is exactly what shipped. */
const RASTER = /\.(jpe?g|png|webp|avif|gif|svg)(\?|$)/i;

export function ProjectCard({ project }: { project: Project }) {
  const isSoldOut = project.isSoldOut;
  const [broken, setBroken] = useState(false);

  // Two ways a hero fails: the URL is not an image format at all (catchable
  // before a request is made), or it is but the fetch fails (only catchable on
  // error). Both land in the same state.
  const usable = Boolean(project.heroUrl) && RASTER.test(project.heroUrl) && !broken;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0A1120]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm bg-[#101A2A] ring-1 ring-white/[0.07]">
        {usable ? (
          <img
            src={project.heroUrl}
            alt={project.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className={
              'h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04] ' +
              (isSoldOut ? 'opacity-80 grayscale' : '')
            }
          />
        ) : (
          // Not a grey box and not a spinner. A layout plan is a drawing, so the
          // placeholder is drafting paper: a faint grid with a slow sheen. It
          // reads as "the drawing is not here yet" rather than "something broke".
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(242,237,228,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(242,237,228,0.05) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            <div className="qhr-sheen absolute inset-0" />
            <span className="absolute inset-x-0 bottom-5 text-center text-[10px] uppercase tracking-[0.22em] text-[#F2EDE4]/30">
              Plan image pending
            </span>
          </div>
        )}

        {/* Sits over the image, so it needs its own ground to stay legible on a
            pale drawing. Bronze hairline rather than a filled pill — the review
            called the old white pills Bootstrap, and it was right. */}
        <div className="absolute right-4 top-4">
          {isSoldOut ? (
            <span className="rounded-[2px] border border-white/15 bg-[#060A14]/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#F2EDE4]/70 backdrop-blur-sm">
              Fully sold
            </span>
          ) : (
            <span className="rounded-[2px] border border-[#C08A5D]/40 bg-[#060A14]/75 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#E8B98A] backdrop-blur-sm">
              {project.availableUnits} available
            </span>
          )}
        </div>

        <div className="absolute bottom-4 left-4">
          <span className="rounded-[2px] bg-[#060A14]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#F2EDE4]/60 backdrop-blur-sm">
            {assetClassMap[project.assetClass]}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="t-h3 text-[#F2EDE4] transition-colors group-hover:text-[#E8B98A]">
          {project.name}
        </h3>
        <p className="t-small mt-2 text-[#F2EDE4]/45">
          {[project.locality, project.city].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  );
}
