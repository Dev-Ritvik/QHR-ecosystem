import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Two sizes a fraction apart, found again by the forensic re-audit of 17
// October 2026 (the fault of the audit's #97, by other roads): a page's lede
// in the frame's unit beside reading text in the reader's own size (23.1 and
// 22.5 px at 1920x945), and on a short frame or a phone a section's head in
// the frame's unit over names a fraction under or over it (30.66 and 30.89 at
// 1366x657; 26.91 and 26.07 at 390x844). What holds them apart: the lede is
// the reading text's size, and where the head comes down to the names, the
// names take the step below theirs and a quotation the head's own size.

const SRC = join(__dirname, '../..');
const folio = readFileSync(join(SRC, 'app/folio.css'), 'utf8').replace(/\r\n/g, '\n');

/** The declarations of the first rule whose selector is exactly `sel` and that sets a size. */
function rule(sel: string): string {
  for (let at = folio.indexOf(`${sel} {`); at >= 0; at = folio.indexOf(`${sel} {`, at + 1)) {
    const body = folio.slice(at, folio.indexOf('}', at));
    if (body.includes('font-size')) return body;
  }
  throw new Error(`no sized rule for ${sel}`);
}

describe("a page's lede and a window's gloss", () => {
  it('are the reading text, never the frame unit', () => {
    const wide = folio.indexOf('@media (min-width: 768px) and (orientation: landscape)');
    const block = folio.slice(wide, folio.indexOf('\n}\n', wide));
    expect(block).toContain('--support: var(--step-1);');
    expect(block).not.toMatch(/--support:[^;]*var\(--u\)/);
  });
});

describe('a name in a run of names', () => {
  it('keeps every one of its lines where its text begins, its rule hung back into its room', () => {
    // A name that wrapped began its second line in the strip each run cuts
    // away (so that no rule begins a line, #76): "ential School" on a phone.
    expect(folio).toContain('.folio-run li {\n  padding-left: var(--run-rule);\n}');
    const rule = folio.slice(folio.indexOf('.folio-run li::before {'), folio.indexOf('}', folio.indexOf('.folio-run li::before {')));
    expect(rule).toContain('margin: 0 0.8rem 0 calc(0.8rem - var(--run-rule));');
    // the rule's room is what the run cuts away: 0.8 + 1.1 + 0.8 rem
    expect(folio).toMatch(/\.folio-run \{\n {2}--run-rule: 2\.7rem;/);
    expect(rule).toContain('width: 1.1rem;');
  });
});

describe('a name under a section head', () => {
  const NAMES = [
    '.folio-step::before',
    '.folio-step h3',
    '.folio-index-name',
    '.folio-qa dt',
    '.folio-trio-name',
    '.folio-role-name',
    '  .folio-figure dt small',
  ];

  it('is set in --name, a quotation in --quote', () => {
    for (const sel of NAMES) expect(rule(sel), sel).toMatch(/font-size: var\(--name\);/);
    expect(rule('.folio-quote blockquote')).toMatch(/font-size: var\(--quote\);/);
    expect(folio).not.toMatch(/font-size: var\(--step-3\);/);
  });

  const SHORT =
    '@media (orientation: portrait) and (max-width: 453px), (orientation: landscape) and (max-height: 803px), (orientation: landscape) and (min-width: 1700px) and (max-height: 880px), (orientation: landscape) and (max-width: 946px)';

  it('is the step-3 of the scale, and a step below it where the head comes down to it', () => {
    expect(folio).toMatch(/\.folio,\n\.folio-stage \{\n {2}--name: var\(--step-3\);\n {2}--quote: var\(--step-3\);\n\}/);
    const short = folio.indexOf(SHORT);
    expect(short).toBeGreaterThan(0);
    const block = folio.slice(short, folio.indexOf('\n}\n', short));
    expect(block).toContain('--name: var(--step-2);');
    expect(block).toContain('--quote: var(--d3);');
    const side = folio.indexOf('@media (orientation: landscape) and (max-height: 640px) {', short);
    expect(side).toBeGreaterThan(short);
    expect(folio.slice(side, folio.indexOf('\n}\n', side))).toContain('--name: var(--step-1);');
  });

  it('stands at least a seventh under its head on any screen, a phone held either way to a wide desk', () => {
    // The sizes, in px, as globals.css and folio.css set them (a 16 px rem).
    const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const vw = (w: number) => w / 100;
    const step = (n: 1 | 2 | 3, w: number, landscape: boolean) => {
      if (landscape && w >= 1600) {
        const at = w - 1600;
        return n === 1
          ? clamp(20, 20 + at * 0.0078125, 22.5)
          : n === 2
            ? clamp(25, 25 + at * 0.009765625, 28.125)
            : clamp(31.25, 31.25 + at * 0.01220703, 35.156);
      }
      return n === 1
        ? clamp(18, 17.333 + 0.1852 * vw(w), 20)
        : n === 2
          ? clamp(21.6, 20.467 + 0.3148 * vw(w), 25)
          : clamp(25.92, 24.144 + 0.4935 * vw(w), 31.25);
    };
    // The head (t-d3): in the frame's unit on a wide frame or a phone on its
    // side, fluid on anything held upright.
    // (CSS: a square window is portrait.)
    const head = (w: number, h: number) => {
      const landscape = w > h;
      if (landscape && (w >= 768 || h <= 520)) return Math.max(24, 42 * Math.min(h / 900, w / 1200));
      return clamp(26, 6.9 * vw(w), 36);
    };
    // The name, by the rules above.
    const name = (w: number, h: number) => {
      const landscape = w > h;
      if (landscape && h <= 640) return step(1, w, landscape);
      const short =
        (!landscape && w <= 453) || (landscape && h <= 803) || (landscape && w >= 1700 && h <= 880) || (landscape && w <= 946);
      return step(short ? 2 : 3, w, landscape);
    };
    // Every window a screen can have, up to a 21:9 monitor's proportions
    // (2.4 to 1) either way; a window dragged to a strip is not a reader's.
    let worst = Infinity;
    let at = '';
    for (let w = 320; w <= 2560; w += 8) {
      for (let h = 360; h <= 1440; h += 8) {
        if (Math.max(w / h, h / w) > 2.4) continue;
        const r = head(w, h) / name(w, h);
        if (r < worst) {
          worst = r;
          at = `${w}x${h}`;
        }
      }
    }
    expect(worst, at).toBeGreaterThanOrEqual(1.15);
    // and the frames the audit measured, where a name was a fraction off its head
    expect(head(1366, 657) / name(1366, 657)).toBeGreaterThan(1.2);
    expect(head(390, 844) / name(390, 844)).toBeGreaterThan(1.2);
    // where nothing moves: 1920x945 keeps its names at step-3
    expect(name(1920, 945)).toBeCloseTo(35.156, 2);
  });
});
