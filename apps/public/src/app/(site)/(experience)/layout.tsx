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
import { PublishSceneCards } from '@/components/experience/PublishSceneCards';
import { getPublishedProjects } from '@/lib/projection';

// The tables' layouts are read here (below), so every page of the segment is
// refreshed as the film is: hourly, unless the CRM's webhook clears it sooner.
export const revalidate = 3600;

/**
 * THE HOUSE IS FURNISHED ON EVERY PAGE. The three tables in the hall carry
 * the published layouts as site models, and what is published was handed to
 * the scene by the film's page alone — and taken back when a visitor left it.
 * So the hall behind every other page stood with its tables bare: /hall, the
 * page ABOUT those tables, opened on three empty pedestals unless the visitor
 * had come by way of the film. The layout hands them over now, once, for the
 * whole segment, and they stay while a visitor moves between its pages.
 *
 * Degrades as the film's own read does: a failed query is no tables, never a
 * failed page (a page of words does not need Postgres).
 */
async function SceneLayouts() {
  let projects: unknown = [];
  try {
    projects = await getPublishedProjects();
  } catch (err) {
    console.error('[experience] projection read failed; the hall is shown without its layouts', err);
    return null;
  }
  const list: any[] = Array.isArray(projects) ? projects : [];
  const open = list.filter((p) => !p.isSoldOut).slice(0, 4);
  if (open.length === 0) return null;
  return (
    <PublishSceneCards
      cards={open.map((p) => ({
        slug: p.slug,
        name: p.name,
        locality: p.locality ?? '',
        city: p.city ?? '',
        available: typeof p.availableUnits === 'number' ? p.availableUnits : null,
        total: typeof p.totalUnits === 'number' ? p.totalUnits : null,
        soldOut: Boolean(p.isSoldOut),
      }))}
    />
  );
}

export default function ExperienceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#15110C] text-[#F2EDE4]">
      {/* The world (fixed, decorative — content is never inside the canvas) */}
      <ExperienceCanvasHost />
      {/* What stands on its tables. Renders nothing. */}
      <SceneLayouts />

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
