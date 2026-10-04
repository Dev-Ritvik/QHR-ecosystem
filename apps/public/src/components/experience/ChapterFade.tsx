'use client';

// apps/public/src/components/experience/ChapterFade.tsx
//
// A chapter dissolves as it leaves the frame, instead of sliding under the bar.
//
// (The account below is of the first version, when the header was a
// translucent bar. On the film it is now a mark reversed out on the picture
// with nothing behind it, and the rule changed with it: see WHEN A CHAPTER IS
// GONE, above the constants. The reasons a mask and a scrim cannot do this
// still stand.)
//
// ---------------------------------------------------------------------------
// THE DEFECT, MEASURED
// ---------------------------------------------------------------------------
//
// The site header is `bg-[#0A1120]/[0.72]` with a backdrop blur — TRANSLUCENT, not
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
import { CHAPTER_FADE_TRAVEL, copyZone, filmIsWide, type CopyPane, type ScreenBox } from './copyZone';

/**
 * WHEN A CHAPTER IS GONE.
 *
 * The first rule faded a chapter from the bar's lower edge (62px, opacity 1)
 * to 260px above it — written when the header was a translucent bar the
 * chapter slid under. The fourth art-direction critique took the bar away (the
 * mark is reversed out on the picture, a watermark), and with nothing over it
 * that rule showed what it had always been doing: on the capture at leg 0.15
 * the departing hero's place line was printed across the wordmark, text over
 * text, and its headline had crossed the whole of the bright sky at full
 * strength on the way (measured p90 150 to 204 behind it) before the fade so
 * much as began.
 *
 * So now a chapter dissolves from the moment it LEAVES — its pane is sticky,
 * so "leaving" is exact: the pane's top has risen above the line it was stuck
 * at — and is gone after FADE_TRAVEL of a viewport's travel, which is slow
 * enough to be a dissolve and short enough that the copy never reaches the sky
 * on a landscape screen. And no line of copy passes through the header: each
 * element fades out across HEADER_BAND as its own top reaches HEADER_LINE,
 * which is what keeps a chapter that RESTS near the top (the phone's hero)
 * off the mark.
 *
 * AND IT ARRIVES THE SAME WAY. A chapter used to ride up the whole frame at
 * full strength before it reached its place, across whatever the picture held
 * on the way: on a phone the map chapter's list climbed over the lit relief of
 * the table itself (measured, its note on a p90 luma of 211 at leg 0.96) to
 * reach the dark it rests on. So the same travel is counted on the way in:
 * the copy develops over the last FADE_TRAVEL before its pane is held, on the
 * ground it was placed on, and between two chapters there is a beat of
 * picture with no words on it at all.
 *
 * AND ON A FRAME THAT IS NOT WIDE, A PANE MAY ASK TO ARRIVE IN PLACE
 * (NARROW_ATTR). A quarter of a viewport's travel is a long way on a phone,
 * where the copy shares one narrow frame with its subject. Measured at 390x844
 * with the travel above: the map's note still at 76% strength over the table's
 * lit relief at leg 0.96 (p90 211), six hundredths of a viewport short of its
 * place. A pane marked `held` does not come up the frame: it develops in its
 * place, over the first NARROW_TRAVEL after it is held — the tables' copy and
 * the map's list, which stand directly above their subjects. It leaves as
 * every pane does, upward and away from them. (In place at both ends was
 * tried: the map's pane is let go at the film's last frame, and the list was
 * gone from the one frame it is for.)
 */
/**
 * The header's height where nothing says otherwise. On the film's stage (a
 * wide frame: globals.css) the header is as tall as the frame's unit makes
 * it, and the cover's pane is held directly under it — so the line is READ
 * from that pane (`headerLine`, below), and read again when the frame changes.
 */
const HEADER_PX = 62;
/** The old rule's span, still used for a pane that is not sticky. */
const FADE_SPAN = 260;
const FADE_TRAVEL = CHAPTER_FADE_TRAVEL;
// From the header's own lower edge: the phone's hero rests its place line at
// 79px, and a band begun any lower held it at 81% while it was being read
// (measured). The band below the line, as a share of the header's height.
const HEADER_BAND = 14 / HEADER_PX;

/** Elements to fade. Set by site-home on each chapter's content block. */
export const FADE_ATTR = 'data-chapter-fade';
/**
 * `data-chapter-fade="lines"`: a block that is not a chapter — it is not held,
 * it scrolls like a page — whose lines must still not pass through the header.
 * The film's colophon: over the film the header is air, with no bar to pass
 * behind, and on any frame shorter than the colophon its lines rode up through
 * the mark and the controls on the way to the page's end (measured at the end
 * of the page: twelve lines under the header at 390x844, its first at y -281;
 * one at 1366x657). In this mode the block itself is never dissolved; each
 * element marked LINE_ATTR is, as its top comes to the header's edge.
 */
export const LINES_MODE = 'lines';
export const LINE_ATTR = 'data-line';
/** On a pane: `held` to develop in place on a frame that is not wide
 *  (copyZone.filmIsWide). */
export const NARROW_ATTR = 'data-fade-narrow';
/** The scroll that development takes, as a share of the viewport's height. */
export const NARROW_TRAVEL = 0.08;
/**
 * On a pane: the travel over which it LEAVES, as a share of the viewport's
 * height, where that should be shorter than the travel it arrives over.
 *
 * The last table's. The camera does not dwell there; it withdraws to the
 * stair, and what comes round behind the copy's column as it goes is the
 * hall's bare ivory wall. Leaving over the standard quarter of a viewport,
 * the lines were still at half strength when the wall had arrived — measured
 * at leg 0.57, on a p90 luma of 99 to 114 across four sizes of frame, with a
 * lens already burnt in as far as a wall will take. A caption goes when its
 * picture does: over 0.12 the lines are gone while the plan is still theirs.
 */
export const OUT_ATTR = 'data-fade-out';
/**
 * On a pane: how long it waits, held, before its copy develops — in viewports
 * of scroll after the pane is held, on every shape of frame. Then it develops
 * in place over AFTER_TRAVEL, and leaves as every pane does.
 *
 * The approach's. Its pane is held from leg 0.76, while the camera is still
 * coming down the house's flank, and for the next twentieth of the leg the
 * flank's lit windows pass straight behind the foot of the frame: sampled
 * every fiftieth of the leg at 1920x1080, "The door is open." stood across a
 * row of them at 0.78 (on a p90 luma of 196, 1.5:1) and "Step inside" on a
 * lit arch at 0.80 (116, 4.0:1). No density a lens can carry brings a lamp
 * down, and the line says the door is open while the picture shows a side
 * wall. So the copy waits for its picture: through the flank and the swoop
 * over the roof's corner the film has no words on it, and the copy develops
 * as the camera comes round onto the front (from leg 0.845, whole by 0.86),
 * where its ground is the forecourt's dark and the door it speaks of is in
 * the frame.
 */
export const AFTER_ATTR = 'data-fade-after';
export const AFTER_TRAVEL = 0.2;
/**
 * Set on a pane while its copy is at nothing. An element at opacity 0 still
 * takes clicks, and a chapter's links ride through the frame unseen on the
 * way to their place — across the tables, whose plans are themselves links
 * into the scene: a tap meant for the plan in view could land on the name of
 * the NEXT one. globals.css takes the pointer off a pane that carries this.
 * Not `visibility`: that would take the links out of the tab order too, and
 * the list is the keyboard's only way to a project (see CityLink).
 */
export const FADED_ATTR = 'data-faded';

/**
 * How far a held pane's copy has developed: `since` is how far the page has
 * scrolled since the pane was held, `travel` the development's length, both
 * in pixels. Nothing before it is held.
 */
export function heldOpacity(since: number, travel: number): number {
  const x = since / travel;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

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

/**
 * A line's words, as a range from its first glyph to its last: where the text
 * is, which is what the lens needs (copyZone.lines), not where its box is.
 * Null if it has none.
 */
function textRange(el: HTMLElement): Range | null {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let first: Text | null = null;
  let last: Text | null = null;
  while (w.nextNode()) {
    const n = w.currentNode as Text;
    if (!n.data.trim()) continue;
    if (!first) first = n;
    last = n;
  }
  if (!first || !last) return null;
  const r = document.createRange();
  r.setStart(first, 0);
  r.setEnd(last, last.data.length);
  return r;
}

export function ChapterFade() {
  useEffect(() => {
    const panes = Array.from(document.querySelectorAll<HTMLElement>(`[${FADE_ATTR}]`))
      .map((el) => {
        const cs = getComputedStyle(el);
        const lines = el.getAttribute(FADE_ATTR) === LINES_MODE;
        return {
          el,
          // The chapter's id: a section's, or the hero's header's.
          id: el.closest('section[id], header[id]')?.id ?? '',
          content: Array.from(el.querySelectorAll<HTMLElement>(lines ? `[${LINE_ATTR}]` : CONTENT)),
          /** Not a chapter: only its lines are faded, at the header (LINES_MODE). */
          lines,
          /** Each line's words (textRange), made when first asked for and made
           *  again if the page has replaced the text they were made on. */
          ranges: [] as (Range | null)[],
          sticky: cs.position === 'sticky',
          /** Where the pane is held while its chapter is read. */
          stuckTop: parseFloat(cs.top) || 0,
          /** In place, on a frame that is not wide (NARROW_ATTR). */
          narrowHeld: el.getAttribute(NARROW_ATTR) === 'held',
          /** Its own travel to leave over, if it has one (OUT_ATTR). */
          out: parseFloat(el.getAttribute(OUT_ATTR) ?? '') || FADE_TRAVEL,
          /** Viewports it waits, held, before it develops (AFTER_ATTR). */
          after: parseFloat(el.getAttribute(AFTER_ATTR) ?? '') || 0,
        };
      })
      .filter((p) => p.content.length > 0);
    if (panes.length === 0) return;

    // Where each pane is held, and the header's lower edge (the cover's pane
    // is held under it): layout, so they change with the frame.
    let headerLine = HEADER_PX;
    const measure = () => {
      for (const p of panes) p.stuckTop = parseFloat(getComputedStyle(p.el).top) || 0;
      const cover = panes.find((p) => p.id === 'hero');
      headerLine = cover && cover.stuckTop > 0 ? cover.stuckTop : HEADER_PX;
    };
    measure();

    let frame = 0;
    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const tops: number[] = [];

    const apply = () => {
      frame = 0;
      // Where the visible copy stands, for the lens (copyZone.ts).
      const vh = window.innerHeight || 1;
      const travel = FADE_TRAVEL * vh;
      const wide = filmIsWide(window.innerWidth, vh);
      const zone: CopyPane[] = [];
      let colophon: ScreenBox[] | null = null;
      for (const { el, id, content, sticky, stuckTop, narrowHeld, out, after, lines, ranges } of panes) {
        // The topmost thing a reader can see in this chapter. Taken over the
        // whole set rather than the first child, because the panes do not share
        // a wrapper — the hero's content sits two levels down inside a
        // full-height column, so "first element child" is the column and its
        // top is the pane's.
        let top = Infinity;
        let bottom = -Infinity;
        tops.length = 0;
        for (const c of content) {
          const r = c.getBoundingClientRect();
          if (r.height < 4) {
            tops.push(NaN);
            continue;
          }
          tops.push(r.top);
          if (r.top < top) top = r.top;
          if (r.bottom > bottom) bottom = r.bottom;
        }
        if (top === Infinity) continue;

        // 1 while the pane is held; rising from 0 across `travel` as it comes
        // to the line it is held at, and falling to 0 across the same travel
        // once it has left it. Clamped, so the overwhelming majority of frames
        // write the same '1' and the browser skips the style recalculation.
        let o: number;
        if (lines) {
          o = 1;
        } else if (sticky && after > 0 && el.parentElement) {
          // Held, and waiting for its picture (AFTER_ATTR): nothing until the
          // page has gone `after` viewports past the point it was held, then
          // in place; it leaves by the rule below.
          const since = stuckTop - el.parentElement.getBoundingClientRect().top - after * vh;
          const gone = clamp01((stuckTop - el.getBoundingClientRect().top) / (out * vh));
          o = Math.min(heldOpacity(since, AFTER_TRAVEL * vh), 1 - gone);
        } else if (sticky && narrowHeld && !wide && el.parentElement) {
          // It develops in place — the pane is held once its containing block's
          // top is above the line — and leaves by the rule below.
          const since = stuckTop - el.parentElement.getBoundingClientRect().top;
          const gone = clamp01((stuckTop - el.getBoundingClientRect().top) / (out * vh));
          o = Math.min(heldOpacity(since, NARROW_TRAVEL * vh), 1 - gone);
        } else if (sticky) {
          // Below the line it is arriving, above it leaving (OUT_ATTR).
          const past = stuckTop - el.getBoundingClientRect().top;
          o = 1 - clamp01(past > 0 ? past / (out * vh) : -past / travel);
        } else {
          o = clamp01((top - (headerLine - FADE_SPAN)) / FADE_SPAN);
        }
        const next = o === 1 ? '' : o.toFixed(3);
        if (el.style.opacity !== next) el.style.opacity = next;
        const faded = o < 0.02;
        if (faded !== el.hasAttribute(FADED_ATTR)) el.toggleAttribute(FADED_ATTR, faded);

        // And no line through the header: each element by its own top.
        for (let i = 0; i < content.length; i += 1) {
          const t = tops[i];
          if (Number.isNaN(t)) continue;
          const oc = clamp01((t - headerLine) / (HEADER_BAND * headerLine));
          const want = oc === 1 ? '' : oc.toFixed(3);
          if (content[i].style.opacity !== want) content[i].style.opacity = want;
        }

        // (A chapter's copy, for the lens. The colophon is not one.)
        if (!lines && o > 0 && bottom > 0 && top < vh) {
          zone.push({ id, weight: o, top: Math.max(0, top / vh), bottom: Math.min(1, bottom / vh) });
        }

        // The colophon's lines, for the lens (copyZone.lines): the words of
        // each one that is in the frame and has not dissolved at the header.
        if (lines) {
          colophon = [];
          if (bottom > 0 && top < vh) {
            const vw = window.innerWidth || 1;
            for (let i = 0; i < content.length; i += 1) {
              const t = tops[i];
              if (Number.isNaN(t) || t >= vh) continue;
              if (clamp01((t - headerLine) / (HEADER_BAND * headerLine)) < 0.05) continue;
              let r = ranges[i];
              if (!r || !r.startContainer.isConnected || !r.endContainer.isConnected) {
                r = textRange(content[i]);
                ranges[i] = r;
              }
              if (!r) continue;
              const b = r.getBoundingClientRect();
              if (b.width < 2 || b.bottom <= 0 || b.top >= vh) continue;
              colophon.push({ l: b.left / vw, t: b.top / vh, r: b.right / vw, b: b.bottom / vh });
            }
          }
        }
      }
      copyZone.panes = zone;
      copyZone.lines = colophon ?? [];
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    // A KEYBOARD REACHES A LINK IN A CHAPTER THAT IS NOT ON SCREEN. The browser
    // scrolls the link into view by the shortest way, which leaves its pane
    // still riding in from below — at nothing, focus ring and all: the focus
    // was somewhere the page was showing nothing (measured: Tab from the hero
    // lands on the first table's name at opacity 0). So the page is taken to
    // where that pane is held, and what has the focus can be seen. Keyboard
    // focus only (:focus-visible): a click or a tap is already on something
    // visible.
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.matches !== 'function' || !t.matches(':focus-visible')) return;
      const pane = panes.find((p) => p.el.contains(t));
      if (!pane || !pane.sticky || !pane.el.parentElement) return;
      if (parseFloat(pane.el.style.opacity || '1') >= 0.99) return;
      const vh = window.innerHeight || 1;
      const held = pane.narrowHeld && !filmIsWide(window.innerWidth, vh);
      const box = pane.el.parentElement.getBoundingClientRect();
      // (A pane that waits before it develops is taken past its wait.)
      const develop = pane.after > 0 ? (pane.after + AFTER_TRAVEL) * vh : held ? NARROW_TRAVEL * vh : 0;
      window.scrollTo({ top: window.scrollY + box.top - pane.stuckTop + develop + 2 });
    };
    document.addEventListener('focusin', onFocusIn);

    // A resize changes which chapter is where without any scroll happening —
    // and, on the film's stage, where each pane is held.
    const ro = new ResizeObserver(() => {
      measure();
      onScroll();
    });
    ro.observe(document.body);

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusIn);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
      // Leave the DOM as it was found. This unmounts when the visitor navigates
      // off the film, and a chapter frozen at 0.4 opacity in a cached tree
      // would come back wrong.
      for (const { el, content } of panes) {
        el.style.opacity = '';
        el.removeAttribute(FADED_ATTR);
        for (const c of content) c.style.opacity = '';
      }
      copyZone.panes = [];
      copyZone.lines = [];
    };
  }, []);

  return null;
}
