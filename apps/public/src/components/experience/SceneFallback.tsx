'use client';

// apps/public/src/components/experience/SceneFallback.tsx
//
// What a visitor sees when the hall cannot run: no WebGL, a device tiered to
// low, or an asset that failed to load.
//
// This is a designed state, not an apology. The three layouts are the
// commercial content of the page, so the fallback still names them and still
// routes to the enquiry — a visitor on a weak device is a lead, not a bounce.

import { PROJECTS } from '@estate/domain/leads/branches';

/**
 * NOT interactive, on purpose.
 *
 * This stands in for the canvas, and the (experience) layout renders the real
 * page on top of it at z-10 — so it is a backdrop, not a competing panel. It
 * used to carry a <Link>, which put a focusable element inside the
 * aria-hidden subtree its host mounts it in: reachable by Tab, invisible to a
 * screen reader, which is a WCAG 4.1.2 failure and the exact opposite of the
 * help it was trying to offer. Every route it linked to is already in the
 * header and footer above it, so the link is gone rather than duplicated, and
 * WorldCanvas announces the situation once through a live region instead.
 *
 * Background is transparent so the host's #0A1120 shows through and the
 * degraded state still sits in the site's palette.
 */
export function SceneFallback({ reason }: { reason: 'unsupported' | 'error' }) {
  return (
    <div className="flex h-full w-full flex-col justify-center px-8 py-12 text-neutral-200">
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

      <p className="mt-8 max-w-xl text-xs uppercase tracking-[0.16em] text-neutral-500">
        Full details, plans and contact are on this page
      </p>
    </div>
  );
}
