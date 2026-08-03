'use client';

// apps/public/src/components/experience/SceneFallback.tsx
//
// What a visitor sees when the hall cannot run: no WebGL, a device tiered to
// low, or an asset that failed to load.
//
// This is a designed state, not an apology. The three layouts are the
// commercial content of the page, so the fallback still names them and still
// routes to the enquiry — a visitor on a weak device is a lead, not a bounce.

import Link from 'next/link';
import { PROJECTS } from '@estate/domain/leads/branches';

export function SceneFallback({ reason }: { reason: 'unsupported' | 'error' }) {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-neutral-950 px-8 py-12 text-neutral-200">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        Presentation hall
      </p>
      <h2 className="mt-3 font-serif text-2xl text-neutral-50">
        {reason === 'unsupported'
          ? 'Your device is showing the reading version'
          : 'The hall could not load just now'}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
        {reason === 'unsupported'
          ? 'The interactive hall needs more graphics capability than this browser reports. Everything in it is below.'
          : 'Something went wrong loading the scene. The layouts are below and the team can walk you through any of them.'}
      </p>

      <ul className="mt-8 space-y-4">
        {PROJECTS.map((p) => (
          <li key={p.slug} className="border-t border-white/10 pt-4">
            <p className="text-sm font-medium text-neutral-100">{p.name}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {p.locality} · {p.district}
            </p>
          </li>
        ))}
      </ul>

      <Link
        href="/#enquire"
        className="mt-8 inline-block w-fit rounded border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.16em] text-neutral-100 transition hover:border-amber-200/60"
      >
        Ask about these layouts
      </Link>
    </div>
  );
}
