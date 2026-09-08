'use client';

// apps/public/src/components/experience/ChapterFade.tsx
//
// A chapter dissolves as it leaves the frame, instead of sliding under the bar.
//
// ---------------------------------------------------------------------------
// THE DEFECT, MEASURED
// ---------------------------------------------------------------------------
//
// The site header is `bg-[#0A1120]/72` with a backdrop blur — TRANSLUCENT, not
// opaque. So a chapter pane riding out of frame does not disappear behind it;
// it shows through it, washed out and blurred. On the station chapters that
// content is a full-colour sanctioned layout plan, and at 1440x900:
//
//   scroll 0.10   21px of the hero h1 and 9px of its eyebrow in the bar
//   scroll 0.70   23px of the Kartikeya plan, 15px of its heading
//   scroll 0.78   62px of the Lucky Garden plan — the whole bar height
//   scroll 0.87   62px of the VSR Gayatri plan
//
// At 0.78 the logo was sitting on top of oranges, greens and whites from a plot
// drawing. Separately, two chapters were legible at once at 0.60, 0.78 and 0.87
// — which site-home's own comment says a full-viewport sticky pane "cannot" do.
// It can: the PANE only ever shows one, but a tall pane's CONTENT still
// overlaps the next chapter's on the way past.
//
// One fade fixes both, because both are the same thing: a chapter that has
// finished is still on screen.
//
// ---------------------------------------------------------------------------
// WHY NOT A CSS MASK, WHICH WAS TRIED AND DOES NOT WORK
// ---------------------------------------------------------------------------
//
// The obvious fix is `mask-image: linear-gradient(transparent 0, #000 96px)` on
// each sticky pane — no JavaScript, one composited layer, nothing per frame.
// It was implemented, and it fails for a reason that is invisible until you
// look at a capture: a mask is anchored to the ELEMENT box, not the viewport.
// A `sticky top-0` pane is pinned at viewport 0 for most of its life, so the
// band lines up — but the moment it unsticks and scrolls away, its box top goes
// negative and the fade band travels off the top of the screen with it. Exactly
// when the fade is needed, it is no longer over the viewport. The capture at
// 0.78 still showed the plan bleeding through the bar.
//
// Nor can a scrim do it. A gradient painted over the content would also be
// painted over the canvas — the world sits at z-0 beneath the page at z-10, and
// CSS cannot darken one without darkening the other. That would put a
// permanent vignette on every frame of the film to solve a DOM problem.
//
// So: read the rect, write the opacity. It is viewport-anchored by
// construction, which is the one property the cheap options lack.
//
// ---------------------------------------------------------------------------
// WHAT IT COSTS
// ---------------------------------------------------------------------------
//
// One rAF, coalesced from the scroll event, reading six rects and writing six
// opacities — all in a single layout pass, no allocation, no React state. The
// same discipline as useScrollProgress: the value lives outside React so that
// scrolling costs no render. Against a WebGL frame drawing 95,000 triangles
// this is not measurable.

import { useEffect } from 'react';

/**
 * Where a departing chapter is fully gone, in pixels above the header.
 *
 * The fade runs from the bar's lower edge (62px, opacity 1) to 260px above it
 * (opacity 0). 260 rather than something tighter because a fade short enough to
 * be safe is also short enough to read as a flicker: at 1440x900 a chapter
 * crosses that band over roughly a third of a viewport of scroll, which is slow
 * enough to feel like a dissolve and fast enough that two chapters are never
 * both legible.
 */
const HEADER_PX = 62;
const FADE_SPAN = 260;

/** Elements to fade. Set by site-home on each chapter's content block. */
export const FADE_ATTR = 'data-chapter-fade';

/**
 * What counts as the chapter's content, for deciding where it is.
 *
 * THE TRIGGER COMES FROM THE CONTENT, NOT FROM THE PANE, AND THE FIRST VERSION
 * GOT THAT WRONG. Reading the pane's own rect looks equivalent and is not: a
 * `sticky top-0` pane is pinned at viewport 0 for the whole time its chapter is
 * being READ, so its top is a constant and the fade derived from it was a
 * constant too. Measured: the constellation and the hall — both at their held
 * midpoints, both the thing the visitor was looking at — were being drawn at
 * 0.762 opacity, permanently. The pane says where the frame is; only the
 * content says where the words are.
 */
const CONTENT = 'h1, h2, h3, p, img, dl, figure, a';

export function ChapterFade() {
  useEffect(() => {
    const panes = Array.from(document.querySelectorAll<HTMLElement>(`[${FADE_ATTR}]`))
      .map((el) => ({ el, content: Array.from(el.querySelectorAll<HTMLElement>(CONTENT)) }))
      .filter((p) => p.content.length > 0);
    if (panes.length === 0) return;

    let frame = 0;

    const apply = () => {
      frame = 0;
      for (const { el, content } of panes) {
        // The topmost thing a reader can see in this chapter. Taken over the
        // whole set rather than the first child, because the panes do not share
        // a wrapper — the hero's content sits two levels down inside a
        // full-height column, so "first element child" is the column and its
        // top is the pane's.
        let top = Infinity;
        for (const c of content) {
          const r = c.getBoundingClientRect();
          if (r.height < 4) continue;
          if (r.top < top) top = r.top;
        }
        if (top === Infinity) continue;

        // 1 while the content is at or below the bar; 0 once it has risen
        // FADE_SPAN above it. Clamped, so the overwhelming majority of frames
        // write the same '1' and the browser skips the style recalculation.
        let o = (top - (HEADER_PX - FADE_SPAN)) / FADE_SPAN;
        o = o < 0 ? 0 : o > 1 ? 1 : o;
        const next = o === 1 ? '' : o.toFixed(3);
        if (el.style.opacity !== next) el.style.opacity = next;
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    // A resize changes which chapter is where without any scroll happening.
    const ro = new ResizeObserver(onScroll);
    ro.observe(document.body);

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
      // Leave the DOM as it was found. This unmounts when the visitor navigates
      // off the film, and a chapter frozen at 0.4 opacity in a cached tree
      // would come back wrong.
      for (const { el } of panes) el.style.opacity = '';
    };
  }, []);

  return null;
}
