import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LAYOUTS } from './layouts';
import { ft, plotSize, withPin } from './units';

const SRC = join(__dirname, '..');

/** Every file a visitor's words come from: the pages, the folio's parts, the
 *  site's chrome and the data they print. */
function wordFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'experience' && dir.endsWith('components')) continue; // the scene: no copy
      if (name === 'present' || name === 'api') continue; // the kiosk; route handlers
      wordFiles(full, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** A source with its comments taken out: what is left is code and copy. */
function uncommented(src: string): string {
  return src
    .replace(/\r\n/g, '\n')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

const files = [
  ...wordFiles(join(SRC, 'app/(site)')),
  ...wordFiles(join(SRC, 'components/folio')),
  ...wordFiles(join(SRC, 'components/site')),
  join(SRC, 'lib/layouts.ts'),
  join(SRC, 'lib/company.ts'),
];

describe('how a measurement is written', () => {
  it('writes each kind one way', () => {
    expect(ft(40)).toBe('40 ft');
    expect(plotSize(30, 50)).toBe('30′ × 50′');
    // the PIN keeps to its town's line: a space that does not break, and no dash
    expect(withPin('Ring Road, Vizianagaram', '535002')).toBe('Ring Road, Vizianagaram 535002');
  });

  it('is held on every page and in the layouts’ own data', () => {
    expect(files.length).toBeGreaterThan(40);
    const banned: [RegExp, string][] = [
      [/\d+-foot\b/, 'a length is "40 ft", not "40-foot"'],
      [/\d+ feet\b/, 'a length is "40 ft", not "40 feet"'],
      [/\d+ft\b/, 'a length is "40 ft", with its space'],
      [/\b(twenty|thirty|forty|sixty)-foot\b/i, 'a length is "40 ft", in figures'],
      [/\d′×\d/, 'a plot is "30′ × 50′", with a space each side of the sign'],
      [/\d+ by \d+\b/, 'a plot is "30′ × 50′"'],
      // a prime that is not one side of a plot (30′ × 50′): a road's width is in ft
      [/\d′(?! ×)(?<!× \d{1,3}′)/, 'a prime is a plot’s; a length is "40 ft"'],
      [/Square (yards|feet)/, 'an area’s unit is "sq yd" / "sq ft" (a column’s head: "Sq yd")'],
      [/square (yards?|feet|foot)\b/i, 'an area’s unit is "sq yd" / "sq ft", with a figure or without'],
      [/24 ?[×x] ?7/, 'a layout’s cameras are "CCTV round the clock"'],
      [/\b\d{3} \d{3}\b(?=[,.<\s])/, 'a PIN is six figures unbroken'],
      [/(&ndash;|–) (\{b\.pincode\}|\d{6})/, 'no dash before a PIN: it follows its town'],
    ];
    const found: string[] = [];
    for (const f of files) {
      const text = uncommented(readFileSync(f, 'utf8'));
      text.split('\n').forEach((line, i) => {
        // not copy: an SVG's numbers, a class's
        if (/viewBox=|className=|d="M|rgba?\(|stroke|translate\(/.test(line) && !/['"`>][^'"`<]*\d+ (feet|ft)\b/.test(line)) return;
        for (const [re, why] of banned) {
          if (re.test(line)) found.push(`${f.slice(SRC.length + 1)}:${i + 1} ${why}: ${line.trim().slice(0, 90)}`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it('prints no ampersand: the face’s own is a flourish, and another face’s is another face', () => {
    // The audit of 2026-10-05 (P3) took Playfair's decorative "&" out; the
    // forensic audit of 2026-10-09 (#60) took out the borrowed one that had
    // replaced it. What is left is the word.
    const found: string[] = [];
    for (const f of files) {
      const text = uncommented(readFileSync(f, 'utf8'));
      text.split('\n').forEach((line, i) => {
        // copy: an entity, or the character inside a string or between tags
        if (/&amp;/.test(line) || /(['"`>])[^'"`<>]* & [^'"`<>]*(['"`<])/.test(line)) {
          // (not copy: a type's intersection)
          if (/\b(type|interface|as|extends)\b[^'"`]* & /.test(line) || /: [A-Z][\w.]* & \{/.test(line)) return;
          found.push(`${f.slice(SRC.length + 1)}:${i + 1} ${line.trim().slice(0, 90)}`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it('marks every plot size in the layouts’ data as its sheet does', () => {
    for (const l of LAYOUTS) {
      for (const s of l.sizes) expect(s.label).toBe(plotSize(s.feet[0], s.feet[1]));
    }
  });
});
