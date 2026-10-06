'use client';

// apps/public/src/components/experience/ChapterFade.tsx
//
// A chapter's copy comes up in place over its stretch of the film, and goes
// in place.
//
// ---------------------------------------------------------------------------
// WHAT THIS WAS
// ---------------------------------------------------------------------------
//
// A departure fade. Each chapter's copy was a pane pinned for its section, and
// a pinned pane rides up the frame to its place and up out of it again; this
// read every pane's rectangle on each scroll frame and dissolved it over a
// quarter of a viewport of that ride at either end, so that a chapter that had
// finished was not still on the screen under the header. Three more rules grew
// on it for the frames where a quarter of a viewport of riding was too much: a
// pane that develops in place on a phone, one that waits for its picture, one
// that leaves early. (Their history, and the CSS mask and the scrim that were
// tried before any of it, are in git: this file before 2026-10-05.)
//
// All of that was a rule about the PAGE. The camera knew nothing of it: it
// never stopped, and the copy came and went over whatever the move happened
// to be showing.
//
// ---------------------------------------------------------------------------
// WHAT IT IS NOW
// ---------------------------------------------------------------------------
//
// A WINDOW A CHAPTER. Each chapter's copy is up for one stretch of scroll: the
// page gives each pane that stretch (`data-copy`, in fractions of the film's
// track: journey.ts, COPY_SPAN), each pane is pinned for the whole of its
// chapter (site-home), and this writes one opacity from the scroll. Nothing
// rides and nothing slides: the words develop where they stand and dissolve
// where they stand, while the camera goes on behind them.
//
// (It was written for the audit of 2026-10-05, whose first item was "arrive,
// then speak": the film was scored in rests and moves, the camera stood still
// on every chapter and the window lay wholly inside that rest. The client sent
// the stopping camera back the next day — "why this cam stop for a brief
// moment?" — and the camera is the continuous one he approved. The windows
// stayed, placed on that camera: where along each chapter the picture behind
// the words is the one they were set on.)
//
// One rAF, coalesced from the scroll event, a handful of opacities, no React
// state. The value lives outside React so that scrolling costs no render.

import { useEffect } from 'react';
import { copyZone, type CopyPane, type ScreenBox } from './copyZone';
import { measureFilmSpan } from './filmTrack';

/**
 * The header's height where nothing says otherwise. On the film's stage (a
 * wide frame: globals.css) the header is as tall as the frame's unit makes
 * it, so the line is read from `--bar` and read again when the frame changes.
 */
const HEADER_PX = 62;
/** A block that is neither a chapter nor a list of lines fades over this
 *  much, under the header (the old rule, kept for a pane with no window). */
const FADE_SPAN = 260;
// From the header's own lower edge: a line that reaches it dissolves across
// this share of the header's height.
const HEADER_BAND = 14 / HEADER_PX;

/** Elements to fade. Set by site-home on each chapter's content block. */
export const FADE_ATTR = 'data-chapter-fade';
/**
 * On a chapter's pane: the stretch of scroll its copy is up for, as four
 * fractions of the film's track — nothing before the first, whole from the
 * second to the third, gone by the fourth (journey.ts, Chapter.copy).
 */
export const COPY_ATTR = 'data-copy';
/**
 * `data-chapter-fade="lines"`: a block that is not a chapter — it is not held,
 * it scrolls like a page — whose lines must still not pass through the header.
 * The film's colophon: over the film the header is air, with no bar to pass
 * behind, and on any frame shorter than the colophon its lines rode up through
 * the mark and the controls on the way to the page's end. In this mode the
 * block itself is never dissolved; each element marked LINE_ATTR is, as its
 * top comes to the header's edge.
 */
export const LINES_MODE = 'lines';
export const LINE_ATTR = 'data-line';
/**
 * `data-hold` on one of those lines: a line that is HELD in the frame for a
 * stretch of scroll (the colophon's sign-off on a wide frame: SiteFooter pins
 * it under the map table and gives it a spacer to be pinned across). Such a
 * line is a chapter's copy in all but name, and goes as one does: it
 * dissolves over the last half notch of its hold, in place, so it has gone
 * when the page lets go of it — instead of riding up through the table, with
 * the lens closed over the whole picture for as long as that took. Measured
 * off the layout: the room left under it in its own wrapper. A line with no
 * room to be held in (any frame that is not wide) is left to the header's
 * rule alone.
 */
export const HOLD_ATTR = 'data-hold';
/** The fall of a held line, in notches (a notch is a third of the frame). */
export const HOLD_FALL = 0.5;
/**
 * Set on a pane while its copy is at nothing. An element at opacity 0 still
 * takes clicks, and every chapter's pane is in the frame for the whole of its
 * chapter: a tap meant for the plan in view could land on a link nobody can
 * see. globals.css takes the pointer off a pane that carries this. Not
 * `visibility`: that would take the links out of the tab order too, and the
 * list is the keyboard's only way to a project (see CityLink).
 */
export const FADED_ATTR = 'data-faded';
/** A headline whose words rise in (WordReveal.tsx): given this while its
 *  chapter's copy is up, so the words rise as the chapter speaks. */
const REVEALED = 'is-revealed';

/** GLSL smoothstep on a span: 0 before `a`, 1 after `b`. */
export function rise(x: number, a: number, b: number): number {
  if (b <= a) return x >= b ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * How much of a chapter's copy is up at `at` of the film's track, for the
 * window the page gave it: [in from, in whole, out from, out gone].
 */
export function copyOpacity(window: readonly number[], at: number): number {
  return Math.min(rise(at, window[0], window[1]), 1 - rise(at, window[2], window[3]));
}

/**
 * How much of a HELD line is up (HOLD_ATTR) with `room` px of its hold left
 * under it, on a frame `frame` px tall: whole until half a notch is left,
 * gone when none is.
 */
export function heldStrength(room: number, frame: number): number {
  const fall = (Math.max(1, frame) / 3) * HOLD_FALL;
  return Math.min(1, Math.max(0, room / fall));
}

/**
 * What counts as the chapter's content, for saying where on the screen its
 * words are (copyZone, for the lens) and for keeping each of them out of the
 * header.
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
        const lines = el.getAttribute(FADE_ATTR) === LINES_MODE;
        const win = (el.getAttribute(COPY_ATTR) ?? '').split(',').map(Number);
        return {
          el,
          // The chapter's id: a section's, or the hero's header's.
          id: el.closest('section[id], header[id]')?.id ?? '',
          content: Array.from(el.querySelectorAll<HTMLElement>(lines ? `[${LINE_ATTR}]` : CONTENT)),
          /** Each line's strength this frame, 0..1 (LINES_MODE reads it back). */
          strengths: [] as number[],
          /** Not a chapter: only its lines are faded, at the header (LINES_MODE). */
          lines,
          /** Each line's words (textRange), made when first asked for and made
           *  again if the page has replaced the text they were made on. */
          ranges: [] as (Range | null)[],
          /** The stretch of the track its copy is up for (COPY_ATTR), if it has one. */
          window: win.length === 4 && win.every((v) => Number.isFinite(v)) ? win : null,
          /** Its copy is up: its headline's words have been told to rise. */
          speaking: false,
        };
      })
      .filter((p) => p.content.length > 0);
    if (panes.length === 0) return;

    // The header's lower edge and the track's length: layout, so they change
    // with the frame.
    //
    // MEASURED, NOT PARSED. `--bar` on the stage is an expression
    // (max(2.75rem, calc(62 * var(--u)))), and a custom property's computed
    // value is its tokens, not a length: parseFloat of it was NaN, so the
    // line stood at the 62px fallback on every wide frame. That was right to
    // within three pixels at 1920x945 and wrong by eighteen on a phone on its
    // side, where the bar is 44: a title set 55px down, clear of the header,
    // was dissolved as if it were under it (measured on the build of
    // 2026-10-05 at 844x390 and 1536x730: the cover's title at nothing and at
    // a sixth). So the length is asked of the layout, through an element
    // that is that tall.
    let headerLine = HEADER_PX;
    let span = 1;
    /** The document's height: with the frame's, how far the page can scroll. */
    let pageHeight = 0;
    const ruler = document.createElement('div');
    ruler.setAttribute('aria-hidden', 'true');
    ruler.style.cssText =
      'position:absolute;left:0;top:0;width:0;height:var(--bar);visibility:hidden;pointer-events:none';
    panes[0].el.appendChild(ruler);
    const measure = () => {
      const bar = ruler.getBoundingClientRect().height;
      headerLine = bar > 0 ? bar : HEADER_PX;
      span = Math.max(1, measureFilmSpan());
      pageHeight = document.documentElement.scrollHeight;
    };
    measure();

    let frame = 0;
    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const tops: number[] = [];

    const apply = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const at = window.scrollY / span;
      // Where the visible copy stands, for the lens (copyZone.ts).
      const zone: CopyPane[] = [];
      let colophon: ScreenBox[] | null = null;
      for (const pane of panes) {
        const { el, id, content, lines, ranges, strengths } = pane;
        // 1 while the chapter speaks; 0 before its window and after it.
        // Clamped, so the overwhelming majority of
        // frames write the same value and the browser skips the recalculation.
        let o: number;
        if (lines) o = 1;
        else if (pane.window) o = copyOpacity(pane.window, at);
        else {
          // A pane with no window of its own: gone as it comes under the header.
          o = clamp01((el.getBoundingClientRect().top + FADE_SPAN - headerLine) / FADE_SPAN);
        }
        const next = o === 1 ? '' : o.toFixed(3);
        if (el.style.opacity !== next) el.style.opacity = next;
        const faded = o < 0.02;
        if (faded !== el.hasAttribute(FADED_ATTR)) el.toggleAttribute(FADED_ATTR, faded);

        // The headline's words rise as the chapter begins to speak, and are
        // put back when it has gone, so the next arrival plays again. (Asked
        // of the pane each frame it is up: WordReveal marks its headlines
        // after this has first run.)
        if (!lines) {
          const speak = o > 0.04;
          if (speak) {
            for (const h of el.querySelectorAll<HTMLElement>(`.reveal:not(.${REVEALED})`)) h.classList.add(REVEALED);
          } else if (pane.speaking && o <= 0.001) {
            for (const h of el.querySelectorAll<HTMLElement>(`.reveal.${REVEALED}`)) h.classList.remove(REVEALED);
          }
          if (speak) pane.speaking = true;
          else if (o <= 0.001) pane.speaking = false;
          if (o <= 0) continue;
        }

        // Where its words are, and no line of them through the header: each
        // element by its own top.
        let top = Infinity;
        let bottom = -Infinity;
        tops.length = 0;
        strengths.length = 0;
        for (const c of content) {
          const r = c.getBoundingClientRect();
          if (r.height < 4) {
            tops.push(NaN);
            strengths.push(0);
            continue;
          }
          tops.push(r.top);
          // A held line (HOLD_ATTR): whole until half a notch of its hold is
          // left, gone when none is.
          let held = 1;
          if (lines && c.hasAttribute(HOLD_ATTR) && c.parentElement) {
            const wrap = c.parentElement.getBoundingClientRect();
            if (wrap.height - r.height > 8) held = heldStrength(wrap.bottom - r.bottom, vh);
          }
          strengths.push(held);
          if (r.top < top) top = r.top;
          if (r.bottom > bottom) bottom = r.bottom;
        }
        if (top === Infinity) continue;
        for (let i = 0; i < content.length; i += 1) {
          const t = tops[i];
          if (Number.isNaN(t)) continue;
          const oc = Math.min(strengths[i], clamp01((t - headerLine) / (HEADER_BAND * headerLine)));
          strengths[i] = oc;
          const want = oc === 1 ? '' : oc.toFixed(3);
          if (content[i].style.opacity !== want) content[i].style.opacity = want;
        }

        // (A chapter's copy, for the lens. The colophon is not one.)
        if (!lines && bottom > 0 && top < vh) {
          zone.push({ id, weight: o, top: Math.max(0, top / vh), bottom: Math.min(1, bottom / vh) });
        }

        // The colophon's lines, for the lens (copyZone.lines): the words of
        // each one that is in the frame and has not dissolved, at the header
        // or at the end of its hold.
        if (lines) {
          colophon = [];
          if (bottom > 0 && top < vh) {
            const vw = window.innerWidth || 1;
            for (let i = 0; i < content.length; i += 1) {
              const t = tops[i];
              if (Number.isNaN(t) || t >= vh) continue;
              if (strengths[i] < 0.05) continue;
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
      // How much further the page can scroll, in frames: no line of the
      // colophon rises by more than that (lensFilter.colophonCover).
      copyZone.remaining = Math.max(0, (pageHeight - vh - window.scrollY) / vh);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    // A KEYBOARD REACHES A LINK IN A CHAPTER THAT IS NOT SPEAKING. Every
    // chapter's links are in the tab order whether its copy is up or not, and
    // focus on one that is at nothing is focus somewhere the page shows
    // nothing (measured on the old rule: Tab from the cover landed on the
    // first table's name at opacity 0). So the page is taken to where that
    // chapter's copy is whole, and what has the focus can be seen. Keyboard
    // focus only (:focus-visible): a click or a tap is already on something
    // visible.
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.matches !== 'function' || !t.matches(':focus-visible')) return;
      const pane = panes.find((p) => p.el.contains(t));
      if (!pane || !pane.window) return;
      if (parseFloat(pane.el.style.opacity || '1') >= 0.99) return;
      window.scrollTo({ top: Math.round(pane.window[1] * span) + 2 });
    };
    document.addEventListener('focusin', onFocusIn);

    // A resize changes the track's length without any scroll happening.
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
      ruler.remove();
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
      copyZone.remaining = Infinity;
    };
  }, []);

  return null;
}
