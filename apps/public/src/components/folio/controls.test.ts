import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CONSENT_COPY, PRIVACY_CONTROL_NAME } from '@/lib/consent/types';
import { MONTHS_AHEAD, dayInWords, dayOnTheLine, isoDay, monthRows } from './VisitDay';

// The controls and their states, as the forensic audit of 2026-10-09 left
// them to be (its section I, #105 to #111, and #60): one focus ring, a consent
// card of the site's own, a day chosen from a month the site draws, one size
// of written line.

const SRC = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8').replace(/\r\n/g, '\n');
const css = read('app/globals.css');
const folio = read('app/folio.css');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'present' || name === '(present)' || name === 'api') continue; // the kiosk, the handlers
      sources(full, out);
    } else if (/\.tsx$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('one focus ring (#108)', () => {
  it('is said once, and nothing on a page sets an outline of its own', () => {
    expect(css).toContain('  --focus-ring: 2px solid var(--gilt);\n  --focus-gap: 4px;');
    expect(css).toContain(':focus-visible {\n  outline: var(--focus-ring);\n  outline-offset: var(--focus-gap);\n}');
    // every other `outline` in either sheet is that ring again, or its
    // absence where the exception is written down
    const own = (sheet: string) =>
      [...sheet.matchAll(/^ *outline: ([^;]+);/gm)].map((m) => m[1]).filter((v) => v !== 'var(--focus-ring)');
    expect(own(css)).toEqual(['none', 'none']); // what the page focused; the card that opened
    expect(own(folio)).toEqual(['none', 'none']); // a line to be written on, twice: a field, the day
    const lines = folio.slice(folio.indexOf('.folio-field input:focus-visible,'));
    expect(lines.slice(0, lines.indexOf('}'))).toContain('box-shadow: 0 1px 0 0 var(--gilt);');
    // what fills the frame takes the ring inside its edge
    expect(folio).toContain('.folio-next:focus-visible {\n  outline-offset: -10px;\n}');
  });

  it('has no ring written into the markup: the framework’s, or an amber one, or none', () => {
    const found: string[] = [];
    for (const f of sources(join(SRC, 'app')).concat(sources(join(SRC, 'components')))) {
      const text = readFileSync(f, 'utf8');
      const m = text.match(/focus(-visible)?:(ring|outline)[\w\-\[\]#/.]*|\boutline-none\b/g);
      // (the body of a page takes focus from "Skip to content", and is not a control)
      const real = (m ?? []).filter((c) => !(c === 'outline-none' && /id="site-content"[^>]*outline-none/.test(text)));
      if (real.length) found.push(`${f.slice(SRC.length + 1)}: ${[...new Set(real)].join(' ')}`);
    }
    expect(found).toEqual([]);
  });
});

describe('the consent card (#105 to #107)', () => {
  const card = read('components/consent/ConsentPanel.tsx');

  it('is set in the site’s kit: its quiet action three times, no box, no blur, no cool white', () => {
    expect(card.match(/className="cta-quiet"/g)?.length).toBe(3);
    expect(card).not.toMatch(/backdrop-blur|rounded|shadow-|neutral-|white\/|amber-/);
    expect(css).not.toMatch(/\.consent[^{]*\{[^}]*(backdrop-filter|border-radius|box-shadow)/);
    const body = css.slice(css.indexOf('.consent-body {'));
    expect(body.slice(0, body.indexOf('}'))).toContain('font-size: var(--step-0);');
    const title = css.slice(css.indexOf('.consent-title {'));
    expect(title.slice(0, title.indexOf('}'))).toContain('color: var(--ink);');
    expect(title.slice(0, title.indexOf('}'))).not.toContain('text-transform');
  });

  it('pre-selects no answer: focus lands on the card, and Enter there chooses nothing', () => {
    expect(card).toContain('ref.current.focus({ preventScroll: true });');
    expect(card).toContain('tabIndex={-1}');
    // the first thing focusable is no longer focused on opening
    expect(card).not.toContain('ref.current.querySelector<HTMLElement>(FOCUSABLE)?.focus();');
    // and the card keeps the keyboard, from itself as from its ends
    expect(card).toContain('if (at === ref.current) {');
  });

  it('is called what its control is called, and says so when it is come back to', () => {
    expect(PRIVACY_CONTROL_NAME).toBe('Privacy and data choices');
    expect(card).toContain("{needsDecision ? 'Before you explore.' : `${PRIVACY_CONTROL_NAME}.`}");
    expect(card).toContain('setDetail(!needsDecision);');
    expect(card).not.toMatch(/the experience|Privacy link/);
    for (const c of Object.values(CONSENT_COPY)) expect(c.title + c.body).not.toMatch(/the experience/i);
    for (const p of ['app/(site)/(experience)/privacy/page.tsx', 'app/(site)/(experience)/cookie-policy/page.tsx']) {
      expect(read(p)).toContain('<strong>{PRIVACY_CONTROL_NAME}</strong>');
    }
  });
});

describe('the day of a visit (#109)', () => {
  it('lays a month out in weeks from Sunday', () => {
    // October 2026 begins on a Thursday and has 31 days
    const rows = monthRows(2026, 9);
    expect(rows.length).toBe(5);
    expect(rows[0].map((d) => d?.getDate() ?? 0)).toEqual([0, 0, 0, 0, 1, 2, 3]);
    expect(rows[4].map((d) => d?.getDate() ?? 0)).toEqual([25, 26, 27, 28, 29, 30, 31]);
    // February 2027: 28 days from a Monday, four weeks and a day
    const feb = monthRows(2027, 1);
    expect(feb.flat().filter(Boolean).length).toBe(28);
    expect(feb[0][1]?.getDate()).toBe(1);
    for (const r of [...rows, ...feb]) expect(r.length).toBe(7);
  });

  it('sends the day as the date field did and says it in words', () => {
    const d = new Date(2026, 9, 17, 12);
    expect(isoDay(d)).toBe('2026-10-17');
    expect(dayInWords(d)).toBe('Saturday 17 October 2026');
    expect(dayOnTheLine(d)).toBe('Saturday 17 October');
    expect(isoDay(new Date(2027, 0, 5, 12))).toBe('2027-01-05');
    // no month comes round twice in what can be asked for, so the line needs no year
    expect(MONTHS_AHEAD).toBeLessThan(12);
  });

  it('is the form’s own line and not the browser’s field', () => {
    const form = read('app/(site)/enquiry-form.tsx');
    expect(form).not.toContain('type="date"');
    expect(form).toContain('<VisitDay');
    expect(form).toContain('name="date"');
    const day = read('components/folio/VisitDay.tsx');
    expect(day).toContain("<input type=\"hidden\" name={name} value={value ? isoDay(value) : ''} />");
  });
});

describe('the form’s lines and words (#110, #111)', () => {
  it('writes every line at one size, and has no grip to drag', () => {
    const area = folio.slice(folio.indexOf('nothing to drag. */\n.folio-field textarea {'));
    const rule = area.slice(0, area.indexOf('}'));
    expect(rule).toContain('resize: none;');
    expect(rule).not.toMatch(/font-size|line-height/);
    expect(read('app/(site)/enquiry-form.tsx')).toContain('onInput={grow}');
  });

  it('sets four words four on a line or two and two', () => {
    const chips = folio.slice(folio.indexOf('\n.folio-chips {'));
    expect(chips.slice(0, chips.indexOf('}'))).toContain('grid-template-columns: repeat(2, max-content);');
    expect(folio).toContain('.folio-form > .folio-fieldset > .folio-chips {\n    grid-template-columns: repeat(4, max-content);');
  });
});

describe('one face, every character of it (#60)', () => {
  it('borrows no character from another face', () => {
    expect(css).not.toContain('Estate Ampersand');
    expect(css).not.toMatch(/unicode-range/);
    expect(read('../tailwind.config.ts')).not.toContain('Estate Ampersand');
    expect(css).toContain("--font-text: var(--font-serif), 'Playfair Display', Georgia, serif;");
  });
});
