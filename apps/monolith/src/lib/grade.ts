// apps/monolith/src/lib/grade.ts
//
// THE FILM STOCK — the split-tone grade, derived from four reference frames.
//
// Every number below was read off the client's reference images. Nothing here
// is a designer's guess about "cinematic teal and orange"; each hex is a value
// present in a supplied frame, and each derived uniform is that hex put through
// a stated transform. The provenance stays in the source because a grade nobody
// can trace is a grade nobody can defend in a review.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE FOUR FRAMES AGREE ON
//
// All four are the same photographic situation: a scene lit by a large COOL
// ambient (dusk sky, fog, water) punctured by small WARM point sources (2700 K
// practicals, sodium vapour, road lamps). That is not a stylistic split-tone
// applied in post — it is what the light in the reference actually did.
//
// So the grade's job is to REINFORCE a separation the scene already has, not to
// impose one. Which produces the single structural decision in this file:
//
//   THE HIGHLIGHT BAND HAS TWO TINTS, SELECTED BY THE PIXEL'S OWN HUE.
//
// The references contain two unrelated highlight families that one tint cannot
// serve:
//
//   WARM  sodium lamps #FFC069 · practicals #F2D6A8 · road lamps #E9A85E
//   COOL  fog crest #8AA2B6 · sky #B6CFE4 · plotting grid #CBD8E0 · spec #98A4B0
//
// Tint every highlight warm and the plotting grid in Act II — which the terrain
// shader draws COOL, and which is the most identifiable image in the narrative —
// turns amber. Tint them all cool and the 2700 K practicals in Act III stop
// being 2700 K. So the shader picks per pixel, on `r - b`.
//
// This also disposes of the objection MASTER_SPEC §5 Act III raises by name:
//
//   "2700 K means warm *pools with falloff*, never a global orange filter."
//
// A global orange filter is arithmetically unreachable here. Warmth is gated on
// the highlight weight (zero across shadows and midtones) AND on the pixel
// already being warmer than neutral. Cool pixels get cooler. That is asserted
// numerically by scripts/grade-check.mjs, not left as an intention.
// ─────────────────────────────────────────────────────────────────────────────

/** One measured value, with the frame it came from. */
export interface Swatch {
  hex: string;
  frame: string;
  note: string;
}

/**
 * The raw read.
 *
 * These are read visually from the supplied images at display resolution —
 * approximate, as asked for, not pixel-sampled means. They are recorded per
 * frame so a later re-sample can correct one image without re-deriving the
 * whole grade.
 */
export const REFERENCE: Record<string, Swatch[]> = {
  shadow: [
    { hex: '#0A0E14', frame: 'stone seam', note: 'seam interior, deepest point' },
    { hex: '#12161E', frame: 'villa blue hour', note: 'ceiling soffit, far interior' },
    { hex: '#0C1622', frame: 'fog corridor', note: 'unlit land between carriageways' },
    { hex: '#05080C', frame: 'the grid', note: 'unlit parcel — near black, still blue' },
  ],
  midtone: [
    { hex: '#2E3742', frame: 'stone seam', note: 'aggregate field, mean of both panels' },
    { hex: '#5478A0', frame: 'villa blue hour', note: 'twilight sky through the glazing' },
    { hex: '#2B4056', frame: 'fog corridor', note: 'fog body' },
    { hex: '#1A2735', frame: 'the grid', note: 'water and parcel surface' },
  ],
  highlightWarm: [
    { hex: '#C4A87A', frame: 'stone seam', note: 'warm bounce along the seam edge' },
    { hex: '#F2D6A8', frame: 'villa blue hour', note: '2700 K practicals on walnut' },
    { hex: '#FFC069', frame: 'fog corridor', note: 'sodium vapour highway lighting' },
    { hex: '#E9A85E', frame: 'the grid', note: 'spine road lamps' },
  ],
  highlightCool: [
    { hex: '#98A4B0', frame: 'stone seam', note: 'specular on wet aggregate' },
    { hex: '#B6CFE4', frame: 'villa blue hour', note: 'sky highlight, upper cloud' },
    { hex: '#8AA2B6', frame: 'fog corridor', note: 'fog crest catching sky' },
    { hex: '#CBD8E0', frame: 'the grid', note: 'plotting grid lines' },
  ],
};

/**
 * The consolidated grade — the per-channel mean of each family above.
 *
 * ONE grade serves all four acts, deliberately. The continuity table (§3)
 * already owns everything that varies with `q`: FOV, EV, roll, fog, Hz. A
 * second q-varying system competing with it is precisely the "four per-act
 * curves that happen to meet" failure §3 exists to prevent. The acts differ by
 * what is in frame and how it is lit, not by wearing four different film
 * stocks — and the references bear that out, since all four share one floor and
 * one pair of highlight families.
 */
export const GRADE = {
  /** Blue-black. Used ADDITIVELY — this is what stops the blacks reading as
   *  dead #000. All four frames have a non-neutral floor. */
  shadow: '#0B1118',
  /** Cool slate. Ships heavily attenuated — see MID_STRENGTH. */
  midtone: '#32465B',
  /** Sodium / 2700 K. Multiplicative gain on highlights that are already warm. */
  highlightWarm: '#E8BA7A',
  /** Sky / fog / specular. Multiplicative gain on highlights already cool. */
  highlightCool: '#A9BBCB',
} as const;

// ── TUNABLES ────────────────────────────────────────────────────────────────
// Parsed by scripts/grade-check.mjs. Keep each on one line in the form
// `export const NAME = <number>;` or the gate stops seeing what ships.

/** Perceptual luminance at which the shadow band reaches zero. */
export const SHADOW_PIVOT = 0.34;

/** Perceptual luminance at which the highlight band begins. Must exceed
 *  SHADOW_PIVOT, or the bands overlap and the midtone weight goes negative —
 *  which inverts the tint instead of removing it. */
export const HIGH_PIVOT = 0.62;

/** Scales the additive shadow lift. 1.0 ships the measured value verbatim. */
export const LIFT = 1.0;

/**
 * How far the midtone balance is applied. Small on purpose.
 *
 * The measured midtone normalises to a 1.80x blue gain, because in all four
 * references the midtones ARE atmosphere — fog, water, sky. Ours are not: they
 * are stone, marble and walnut, and at full strength every one of them turns
 * steel blue. That is a global blue filter, the exact mirror of the failure §5
 * forbids. This band's job is to hold the line between the two tinted ends, not
 * to become a third tint.
 */
export const MID_STRENGTH = 0.12;

/** How far the highlight balance is applied. */
export const HIGH_STRENGTH = 0.30;

/** The `r - b` window over which a highlight is judged warm rather than cool.
 *  The low end sits slightly below zero so a perfectly neutral specular leans
 *  cool — which is what all four references show. */
export const WARMTH_LO = -0.04;
export const WARMTH_HI = 0.10;

// ── COLOUR MATH ─────────────────────────────────────────────────────────────
// Deliberately dependency-free. The CI gate re-runs these exact functions, so
// the numbers it checks are the numbers that ship.

/**
 * sRGB transfer function, inverse.
 *
 * The hexes above are DISPLAY values; the composer buffer is linear. Feeding a
 * hex straight into a uniform is the most common way a grade ends up roughly
 * 2.7x too strong in the shadows with nobody able to say why.
 */
export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
}

/** Rec.709 luminance, matching the weights three uses. */
export function luminance(c: readonly [number, number, number]): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * A tint normalised to unit luminance, for use as a MULTIPLICATIVE balance.
 *
 * This is the property that makes the grade safe to run underneath the
 * continuity table's EV column: a balance whose luminance is exactly 1 can
 * rotate hue but cannot change level. Without it the grade would quietly
 * darken or brighten every frame, and every EV value in §3 would be a fiction.
 */
export function balance(hex: string): [number, number, number] {
  const c = hexToLinear(hex);
  const l = Math.max(luminance(c), 1e-6);
  return [c[0] / l, c[1] / l, c[2] / l];
}

/** The shadow tint, used ADDITIVELY. Linearised it is already the right order
 *  of magnitude (~3e-3), so it needs no scaling — the measurement is the lift. */
export function shadowLift(): [number, number, number] {
  const c = hexToLinear(GRADE.shadow);
  return [c[0] * LIFT, c[1] * LIFT, c[2] * LIFT];
}

/** What the shader actually receives. */
export const UNIFORMS = {
  shadowLift: shadowLift(),
  midBalance: balance(GRADE.midtone),
  warmBalance: balance(GRADE.highlightWarm),
  coolBalance: balance(GRADE.highlightCool),
};

/**
 * THE VOID — the scene-side background and fog colour.
 *
 * A bruising dark violet-grey. Distinct from GRADE.shadow above, and the two
 * must not be confused: this is the colour the SCENE renders (scene.background,
 * FogExp2, the sky horizon, the terrain's aerial-perspective target), before
 * exposure, before ACES, before the grade. GRADE.shadow is where a black pixel
 * ends up AFTER all of that.
 *
 * Everything warm in this build lives inside the Act III villa and nowhere else
 * (§5 Act III: "warm pools with falloff, never a global orange filter"). The
 * sky, the key light, the hemisphere ground, the terrain albedo and the Act II
 * plotting grid are all on the cold side of neutral by construction.
 */
export const VOID_COLOR = '#0A0A0E';

/** True 2700 K on the Planckian locus, in sRGB. The ONLY warm source in the
 *  build — the practicals inside the model duplex villa. */
export const PRACTICAL_2700K = '#FFA957';
