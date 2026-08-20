// apps/monolith/src/app/(experience)/layout.tsx
//
// THE CANVAS MOUNTS HERE — MASTER_SPEC §4.2, L3.
//
// A SERVER component on purpose: its children (the narrative, the syndicate
// dossiers, fifteen utility pages) must server-render real HTML for crawlers
// and no-JS readers. Only the canvas host is a client leaf.
//
// The persistence mechanism is App Router's own. Navigating between two pages
// inside this segment re-renders page.tsx only — this layout, and the <Canvas>
// inside it, is never unmounted. No portals, no global singletons, no
// template.tsx (which exists specifically to remount and would destroy the
// entire architecture).
//
// And because the canvas lives HERE rather than at root, app/not-found.tsx sits
// outside this group and no WebGL context is ever created on a 404. That is one
// decision removing a whole class of workaround — see §8.3.

import type { ReactNode } from 'react';
import { ExperienceHost } from '@/components/experience/ExperienceHost';

export default function ExperienceLayout({
  children,
  modal,
}: {
  children: ReactNode;
  /** The @modal parallel slot. Renders null via default.tsx when the URL does
   *  not match an intercepted route, and the HUD when it does. Because it is a
   *  SIBLING of children rather than a wrapper, opening the directory does not
   *  unmount the narrative underneath it — which is what lets the frozen
   *  canvas stay exactly where it was. */
  modal: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-void text-signal">
      {/* MASTER_SPEC §10 — first tab stop. A scroll narrative that cannot be
          skipped is a scroll narrative that fails the 30% usability weight. */}
      <a href="#directory" className="skip-link t-mono">
        Skip to directory
      </a>

      {/* The world: fixed, decorative, aria-hidden. Content is never inside
          the canvas. */}
      <ExperienceHost />

      {/* The readable layer, above the world. */}
      <div className="surface">{children}</div>

      {/* The Z-999 HUD. Sibling, not wrapper. */}
      {modal}
    </div>
  );
}
