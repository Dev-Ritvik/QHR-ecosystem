// apps/public/src/app/(site)/(experience)/layout.tsx
//
// TIER 1 segment layout (FRONTEND_ARCHITECTURE §3.1).
//
// This is a SERVER component on purpose: its children (the node pages) must
// server-render real HTML for SEO and no-JS readers. Only the canvas host is
// a client leaf.
//
// The persistence mechanism is App Router's own: navigating between two pages
// inside this segment re-renders `page.tsx` only — this layout, and therefore
// the <Canvas> inside it, is never unmounted. No portals, no global singletons.
import type { ReactNode } from 'react';
import { ExperienceCanvasHost } from '@/components/experience/ExperienceCanvasHost';

export default function ExperienceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0A1120] text-[#F2EDE4]">
      {/* The world (fixed, decorative — content is never inside the canvas) */}
      <ExperienceCanvasHost />

      {/*
        The readable layer: real DOM above the world.

        `pointer-events-none` with the page taking it straight back is not a
        flourish — it is what lets the world underneath be touched at all. This
        wrapper is full-width and as tall as the document, and it sits at z-10
        over a canvas at z-0, so without this it swallows every pointer event
        aimed at anything in the scene. Measured on the film: at the first
        project table, `elementFromPoint` returned this div, and dragging the
        table did nothing on any pointer device.

        `[&>*]` restores it to the page root only, so every ordinary page
        behaves exactly as before. A page that wants the world reachable
        through it — the film does — overrides with `!pointer-events-none` and
        re-enables its own content, which is the pattern /hall already used by
        hand.
      */}
      <div className="relative z-10 pointer-events-none [&>*]:pointer-events-auto">
        {children}
      </div>
    </div>
  );
}
