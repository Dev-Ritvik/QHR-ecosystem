// packages/ui/src/brand/tokens.ts
//
// Brand colour tokens for Quality Homes Reality.
//
// ---------------------------------------------------------------------------
// The thesis
// ---------------------------------------------------------------------------
//
// The client asked for the logo to feel "elevated ... not flashy ... the
// presence must be valuable". The mark itself is not the problem — twenty years
// of recognition live in that silhouette, and redrawing it would throw that
// away to solve a problem nobody has.
//
// The problem is that the mark is specified in PRINTING INK: a saturated
// cobalt and a saturated orange, made to survive a flex banner in daylight. The
// site is specified in MATERIAL: near-black stone, warm cream, struck bronze.
// Put ink on stone and it reads as a sticker.
//
// But look at what the two palettes are actually saying. Deep blue with a warm
// accent — that is the same relationship in both. The site's #C08A5D is what
// that orange looks like when it stops shouting; #0A1120 is what that cobalt
// looks like at rest.
//
// So: keep every curve, change the material. INK stays canonical for print,
// signage, WhatsApp and anywhere the mark must survive daylight and cheap
// reproduction. MATERIAL is the same geometry rendered in the site's own
// palette for dark screens. Same logo, two finishes — the way a company's mark
// appears embossed on letterhead and painted on a hoarding without becoming a
// different logo.

/**
 * The canonical mark as supplied by the client. Sampled by eye from the raster
 * artwork — see brand/README.md; these need confirming against the source file
 * or a printed sample before anything goes to a printer, since a press will
 * reproduce exactly what it is given.
 */
export const INK = {
  /** Wordmark "QUALITY HOMES", house outline, monogram stem. */
  indigo: '#2E3192',
  /** The lighter blue at the roof apex — the mark carries a vertical gradient. */
  azure: '#1B75BC',
  /** The Q, and the word "REALITY". */
  orange: '#F15A24',
  paper: '#FFFFFF',
} as const;

/**
 * The same mark rendered in the site's material palette, for dark grounds.
 * Every value here already exists in the experience; nothing new is introduced.
 */
export const MATERIAL = {
  /** Page ground. */
  ground: '#0A1120',
  groundDeep: '#060A14',
  /** Wordmark and the house on dark — warm cream, never pure white. */
  cream: '#F2EDE4',
  /** What the orange becomes: struck bronze. */
  bronze: '#C08A5D',
  /** The highlight along a bronze edge. */
  bronzeLight: '#E8B98A',
  /** The blue at rest, for the house body on lighter dark grounds. */
  slate: '#101A2A',
} as const;

/**
 * Minimum widths. Below these the monogram's counters close up and the
 * wordmark's tracking collapses — the mark stops being legible before it stops
 * being visible, which is the failure nobody catches in review.
 */
export const MIN_WIDTH_PX = {
  /** Full horizontal lockup: mark beside wordmark. */
  horizontal: 180,
  /** Stacked lockup: mark above wordmark. */
  stacked: 120,
  /** Monogram alone. */
  monogram: 24,
} as const;

/**
 * Clear space, expressed as a multiple of the monogram's width. Nothing —
 * type, rule, image edge or another logo — enters this margin.
 */
export const CLEAR_SPACE_RATIO = 0.4;
