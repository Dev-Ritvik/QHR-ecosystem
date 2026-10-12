// apps/public/src/components/experience/plateBand.ts
//
// THE PICTURE'S OWN BAND, on a screen held upright.
//
// On a landscape frame a plate's title stands BESIDE its subject. On an
// upright one it stands UNDER it: the words are a block at the frame's foot,
// as tall as they are long, and the picture has what is left — the band
// between the header's foot and the block's first line. How tall that band is
// belongs to the page (a three-line title over a four-line lede leaves less
// of it) and to the screen (a phone showing its browser's bars is 664 px
// high, not 844: the same words, and a hundred and eighty pixels less
// picture).
//
// The rig used to slide every still's frame up by a fixed share of its height
// (poses.ts, `phone.rise`), set by eye at 390x844 on one page's words. Seen on
// the finished build at 390x664, and at 390x844 on the pages with the longest
// titles: a layout's model half under its own title's density, and on the
// five pages that stand on the hall's axis the title printed across the
// founder's portrait.
//
// So a still says WHERE IN THE BAND its lens's axis stands (`phone.at`: 0 at
// the header's foot, 1 at the first line of the words), the page measures its
// own band (FolioChrome), and the slide is worked out from the two — for this
// page, on this screen.

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface PlateBand {
  /** The header's foot: CSS px from the top of the frame. */
  top: number;
  /** The first line of the plate's words: CSS px from the top of the frame,
   *  with the page unscrolled. */
  bottom: number;
}

/**
 * The band of the page now shown; null where a page has no plate, or has not
 * measured it yet. Written by FolioChrome, read by the rig every frame: a
 * module's own state, like the journey's, because the two are on opposite
 * sides of the canvas and neither renders for the other.
 */
export const plateBand: { current: PlateBand | null } = { current: null };

/**
 * WHERE A PAGE'S MOVE ENDS. A still's camera goes from its opening frame to a
 * second one as its page is read (poses.ts, `to`), and the one place the
 * second is SEEN is the page's window: the opening between two sheets where
 * the picture is let through again. The move used to be spread over the whole
 * page, so the window showed whatever the camera had got to by then — on most
 * pages the opening picture again, a few centimetres on (the forensic audit of
 * 2026-10-09, #66: "several pages then repeat their own opening picture as
 * the band halfway down"). It ends at the window now: `end` is the scroll, in
 * CSS px, at which the page's first window stands in the middle of the frame
 * — measured by the page, like the band — and the frame there is the one
 * `to` was composed as. Null on a page with no window: its move runs the
 * length of the page, as it did, and is only ever seen leaving the plate.
 */
export const pageMove: { end: number | null } = { end: null };

/**
 * How far along its move a still is (0 at its opening frame, 1 at its second)
 * with the page `scrolled` CSS px down, of `extent` it can scroll.
 */
export function stillProgress(scrolled: number, extent: number, end: number | null): number {
  const span = end !== null && end > 1 ? end : Math.max(1, extent);
  const t = clamp(scrolled / span, 0, 1);
  // Eased at both ends: it leaves the opening frame slowly, while the plate
  // is still being looked at, and settles onto the window's.
  return t * t * (3 - 2 * t);
}

/**
 * The band the poses were first judged in, as shares of a 390x844 frame's
 * height: under a 56 px header, over words that began at 456 px. It stands
 * for a page that has not measured its own (the frame before the first
 * layout effect), so that frame is the one the measured band then confirms
 * and not a different picture.
 */
export const NOMINAL_BAND = { top: 0.066, bottom: 0.54 } as const;

/** No shifted front past this: beyond a third of the frame the far edge of
 *  the picture is the edge of a hundred-degree lens, and it shows. */
export const MAX_RISE = 0.36;

/**
 * How far the frame slides up over the lens's axis (a share of its height,
 * as applyShift takes it) for the axis to stand `at` of the way down the
 * picture's band, on a frame `height` CSS px high.
 */
export function riseInBand(at: number, band: PlateBand | null, height: number): number {
  const t = clamp(at, 0, 1);
  if (!band || !(height > 0) || !(band.bottom > band.top)) {
    return clamp(0.5 - (NOMINAL_BAND.top + t * (NOMINAL_BAND.bottom - NOMINAL_BAND.top)), -MAX_RISE, MAX_RISE);
  }
  const axis = band.top + t * (band.bottom - band.top);
  return clamp(0.5 - axis / height, -MAX_RISE, MAX_RISE);
}
