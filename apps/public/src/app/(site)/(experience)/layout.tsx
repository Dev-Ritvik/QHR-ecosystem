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

      {/* The readable layer: real DOM above the world */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
