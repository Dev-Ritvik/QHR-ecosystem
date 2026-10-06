// apps/public/src/components/experience/copyZone.ts
//
// WHERE THE COPY IS, for the lens.
//
// ChapterFade measures every chapter's content on each scroll frame, to fade
// it as it leaves; it also publishes here where on the screen each chapter's
// visible copy stands, so the film can put its filter behind the words
// (lensFilter.ts, the phone's sky grad) — following them as they scroll, the
// way an operator rides a grad — rather than at a scroll position guessed for
// one screen shape. Plain numbers, no three.js: ChapterFade is page code.

export interface CopyPane {
  /** The chapter's section id (hero, revolution, holdings, approach, ...). */
  id: string;
  /** Its opacity, 0..1 (ChapterFade's own). */
  weight: number;
  /** Top and bottom of its copy on screen, as fractions of the viewport's
   *  height from the top, clamped to the viewport. */
  top: number;
  bottom: number;
}

/** A box on the screen: fractions of the viewport, from its top-left. */
export interface ScreenBox {
  l: number;
  t: number;
  r: number;
  b: number;
}

/**
 * `panes` is the chapters' copy. `lines` is the film's colophon (ChapterFade's
 * `lines` mode): where the GLYPHS of each line that can be seen stand — not
 * the line's box, which for a link is a 44 px row for the thumb and for the
 * sign-off's call to action the width of the grid. The lens asks whether any
 * of them is coming to stand on the lit map table (lensFilter.codaFilter).
 *
 * `remaining` is how much further the page can still scroll, in frames: a
 * line of the colophon rises by exactly that much and no more, so a line that
 * is under the table with less than its distance left to go will never stand
 * on it (lensFilter.colophonCover). Infinity until the page has said.
 */
export const copyZone: { panes: CopyPane[]; lines: ScreenBox[]; remaining: number } = {
  panes: [],
  lines: [],
  remaining: Infinity,
};

/**
 * WHICH WAY THE COPY IS LAID OUT.
 *
 * site-home places every chapter's copy one of two ways: in a column down the
 * left of a landscape frame at least 768 px wide (Tailwind's `wide:` variant,
 * tailwind.config.ts — the same words as WIDE_QUERY, and a test holds them to
 * it), or across the top or the foot of any other frame: a phone, a tablet
 * held upright. The lens asks the same question here, so a filter is always
 * made for where the words are.
 *
 * AND A PHONE ON ITS SIDE IS A WIDE FRAME, whatever its width (SHORT_QUERY: a
 * landscape frame no taller than 520 px). The other layout stacks a chapter's
 * copy across the top of the frame, and a frame 360 px tall has no top to
 * stack it in — the cover's block alone is 260. Beside the picture, in the
 * frame's own unit (globals.css, THE FILM'S STAGE), it has the same place it
 * has on a desk.
 *
 * They used to ask different ones — the page its width (md), the lens its
 * aspect — and on a tablet held upright each answered for a different screen:
 * copy in a landscape frame's left column, under a phone's sky grad, which
 * followed the words down the frame and took the whole daylight hero with it,
 * house and all (seen at 820x1180).
 */
export const WIDE_QUERY =
  '(min-width: 768px) and (orientation: landscape), (max-height: 520px) and (orientation: landscape)';
/** A wide frame too short for the design's small type at a size that can be
 *  read: a phone on its side (Tailwind's `short:` variant). */
export const SHORT_QUERY = '(max-height: 520px) and (orientation: landscape)';
const SHORT_HEIGHT = 520;

/**
 * The same, for a viewport of this size in CSS pixels. (Strictly wider than
 * it is tall: CSS calls a square frame `portrait`, so the page lays a square
 * out as it does a phone, and the lens must filter for that.)
 */
export function filmIsWide(width: number, height: number): boolean {
  return width > height && (width >= 768 || height <= SHORT_HEIGHT);
}

/** SHORT_QUERY, for a viewport of this size in CSS pixels. */
export function filmIsShort(width: number, height: number): boolean {
  return width > height && height <= SHORT_HEIGHT;
}

/**
 * How much of a filter the copy's presence asks for: all of it while a quarter
 * of the copy is still there. A filter that faded WITH the copy left the copy
 * at half strength on a ground at half density — measured after the third
 * table, the departing lines on a p90 luma of 160 with the edge half gone. So
 * the filter arrives before the copy and leaves after it.
 */
export function copyPresence(weight: number): number {
  return Math.min(1, Math.max(0, weight) * 4);
}

/**
 * How far a chapter's pane travels, as a share of the viewport's height, while
 * its copy dissolves in before it is held and out after it is released
 * (ChapterFade). Here because the film needs the same number: the house
 * lights hold for a chapter's copy until it has gone (hallLight.ts).
 */
export const CHAPTER_FADE_TRAVEL = 0.26;
