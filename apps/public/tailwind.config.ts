import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import sharedConfig from '@estate/ui/tailwind-preset';

/**
 * EVERY SPACE IS A WHOLE NUMBER OF BASELINES (globals.css, ONE BASELINE).
 *
 * Tailwind's spacing scale is quarter-rems, and the site's baseline is a
 * quarter-rem: `mt-6` has always been six baselines. Said in those words —
 * `calc(var(--bl) * 6)` — it is the same 1.5rem everywhere the baseline is
 * 0.25rem, which is everywhere but the film on a wide frame. There the frame
 * has a unit of its own (globals.css, THE FILM'S STAGE) and the baseline is
 * four of them, so a chapter's gaps grow and shrink with its type and with the
 * picture behind it, and nothing in the chapters' markup has to say so.
 */
const baselines = (n: number) => `calc(var(--bl, 0.25rem) * ${n})`;
const SPACING_STEPS = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64,
  72, 80, 96,
];
const LEADING_STEPS = [3, 4, 5, 6, 7, 8, 9, 10];

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  presets: [sharedConfig],
  theme: {
    extend: {
      // ONE FAMILY (globals.css, THE TYPE SYSTEM). `font-serif` was Tailwind's
      // own stack — ui-serif, Georgia — so every inner page that asked for it
      // set its headings in Georgia rather than the site's face.
      fontFamily: {
        serif: ['Estate Ampersand', 'var(--font-serif)', 'Playfair Display', 'Georgia', 'serif'],
      },
      spacing: Object.fromEntries(SPACING_STEPS.map((n) => [String(n), baselines(n)])),
      lineHeight: Object.fromEntries(LEADING_STEPS.map((n) => [String(n), baselines(n)])),
      // THE SCALE, as utilities: `text-step-2` is --step-2 with its leading on
      // the 4px baseline. These are the only sizes the site's pages use.
      fontSize: {
        'step--2': ['var(--step--2)', { lineHeight: 'round(nearest, calc(var(--step--2) * 1.6), var(--bl))' }],
        'step--1': ['var(--step--1)', { lineHeight: 'round(nearest, calc(var(--step--1) * 1.56), var(--bl))' }],
        'step-0': ['var(--step-0)', { lineHeight: 'round(nearest, calc(var(--step-0) * 1.75), var(--bl))' }],
        'step-1': ['var(--step-1)', { lineHeight: 'round(nearest, calc(var(--step-1) * 1.6), var(--bl))' }],
        'step-2': ['var(--step-2)', { lineHeight: 'round(nearest, calc(var(--step-2) * 1.3), var(--bl))' }],
        'step-3': ['var(--step-3)', { lineHeight: 'round(nearest, calc(var(--step-3) * 1.28), var(--bl))' }],
        'step-4': ['var(--step-4)', { lineHeight: 'round(nearest, calc(var(--step-4) * 1.2), var(--bl))' }],
        'step-5': ['var(--step-5)', { lineHeight: 'round(nearest, calc(var(--step-5) * 1.08), var(--bl))' }],
        'step-6': ['var(--step-6)', { lineHeight: 'round(nearest, var(--step-6), var(--bl))' }],
      },
    },
  },
  plugins: [
    // THE FILM'S TWO LAYOUTS (copyZone.ts, WIDE_QUERY — the same words; a test
    // holds them to it). `wide:` is a landscape frame from 768px up, where a
    // chapter's copy stands in a column down the left; every other frame — a
    // phone, a tablet held upright — sets it across the top or the foot. Width
    // alone (md) put a landscape frame's layout on an upright tablet, under a
    // lens that was filtering for a phone.
    //
    // A VARIANT, NOT A SCREEN. Given as a screen with a raw query it took the
    // max-* variants away from every screen — Tailwind only generates them
    // while all screens are plain min-widths — and the phone's header is laid
    // out with max-md: (measured on that build: no max-md rule in the
    // stylesheet at all).
    //
    // `short:` is a wide frame no taller than 520px — a phone on its side —
    // where a chapter keeps its headings and lets its glosses go (copyZone.ts,
    // SHORT_QUERY; such a frame is wide whatever its width).
    //
    // `panoramic:` is a frame at least twice as wide as it is tall: a phone on
    // its side, a laptop's window under a tall browser bar, an ultrawide
    // monitor. The camera's field is set by the frame's height, so such a
    // frame sees further to either side of every composition than the 16:10
    // it was composed on — and a block set off the left edge stands on
    // picture the design's frame does not have. Declared last: where it
    // speaks it overrides the two above.
    plugin(({ addVariant }) => {
      addVariant(
        'wide',
        '@media (min-width: 768px) and (orientation: landscape), (max-height: 520px) and (orientation: landscape)',
      );
      addVariant('short', '@media (max-height: 520px) and (orientation: landscape)');
      addVariant('panoramic', '@media (min-aspect-ratio: 2/1)');
      // `held:` is every frame on which the colophon's sign-off is HELD under
      // the map table (SiteFooter): the wide ones, and a tablet held upright,
      // which is laid out as a phone is but stands the table beside the
      // sign-off. A phone keeps the table above and lets the lines ride.
      addVariant('held', '@media (min-width: 768px), (max-height: 520px) and (orientation: landscape)');
      // `low:` is a landscape frame no taller than 700px: a 13-inch laptop's
      // window. The film's type has floors there, so the colophon's small
      // matter is a larger share of the frame's height than on a desk, and
      // its offices came to rest AT the map table's foot instead of under it
      // (measured at 1280x593: the third office's label 0.4% of the height
      // below the foot). It closes its own spaces up on such a frame.
      addVariant('low', '@media (max-height: 700px) and (orientation: landscape)');
    }),
  ],
};

export default config;
