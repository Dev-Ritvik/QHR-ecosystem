// apps/public/src/components/experience/filmGrade.test.ts
//
// The print's shoulder under a ceiling — the header band's burnt-in highlights
// and a reading page's held ones — comes in without an edge.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HEADER_BAND } from './lensFilter';
import { READING_CEILING } from './readingLight';

const src = readFileSync(join(__dirname, 'FilmGrade.tsx'), 'utf8').replace(/\r\n/g, '\n');

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** FilmGrade's shoulder on a luma, restated: `on` is how far the ceiling has
 *  come down, 0..1. */
function shoulder(l: number, ceiling: number, on: number): number {
  const cap = 1 + (ceiling - 1) * on;
  const knee = cap * (1 + (0.7 - 1) * smooth(0, 0.35, on));
  if (l <= knee) return l;
  const over = (l - knee) / Math.max(1e-4, cap - knee);
  return knee + (cap - knee) * (1 - Math.exp(-over));
}

describe("the print's shoulder under a ceiling", () => {
  it('is in the shader as it is restated here', () => {
    expect(src).toContain('vec3 shoulder(vec3 g, float ceiling, float on) {');
    expect(src).toContain('float cap = mix(1.0, ceiling, on);');
    expect(src).toContain('float knee = cap * mix(1.0, 0.7, smoothstep(0.0, 0.35, on));');
    expect(src).toContain('return shoulder(g, ndTop.w, k);');
    expect(src).toContain('if (readCap.y > 0.0) g = shoulder(g, readCap.x, readCap.y);');
  });

  it('moves nothing where it begins: the band has no lower edge', () => {
    // The knee used to be seven-tenths of the ceiling from the first sliver of
    // the band, which rolled a white wall off by a ninth at once: a line
    // across the hall at 24% of the frame's height (a step of 6 to 7 luma).
    for (const l of [0.2, 0.5, 0.7, 0.8, 0.9, 1]) {
      expect(shoulder(l, HEADER_BAND.ceiling, 0)).toBe(l);
      expect(Math.abs(shoulder(l, HEADER_BAND.ceiling, 0.01) - l)).toBeLessThan(0.008);
    }
  });

  it('comes down smoothly: no step a row of pixels could show', () => {
    // 150 rows of a 900px frame across the band's fall: under a luma a row.
    for (const ceiling of [HEADER_BAND.ceiling, READING_CEILING]) {
      for (const l of [0.6, 0.75, 0.9, 1]) {
        let worst = 0;
        for (let i = 1; i <= 150; i += 1) {
          worst = Math.max(worst, Math.abs(shoulder(l, ceiling, i / 150) - shoulder(l, ceiling, (i - 1) / 150)));
        }
        expect(worst * 255, `luma ${l} under ${ceiling}`).toBeLessThan(2.5);
      }
    }
  });

  it('is the whole ceiling where it is whole, and leaves what is under its knee alone', () => {
    expect(shoulder(1, HEADER_BAND.ceiling, 1)).toBeLessThanOrEqual(HEADER_BAND.ceiling);
    expect(shoulder(1, READING_CEILING, 1)).toBeLessThanOrEqual(READING_CEILING);
    expect(shoulder(0.7 * HEADER_BAND.ceiling, HEADER_BAND.ceiling, 1)).toBe(0.7 * HEADER_BAND.ceiling);
    // from a third of the way in it is the law it always was: knee at 0.7 of the ceiling
    const on = 0.6;
    const cap = 1 + (HEADER_BAND.ceiling - 1) * on;
    expect(shoulder(cap * 0.7, HEADER_BAND.ceiling, on)).toBeCloseTo(cap * 0.7, 12);
    expect(shoulder(1, HEADER_BAND.ceiling, on)).toBeLessThan(cap);
  });

  it('takes the whole-frame density with the others, densest holding', () => {
    // lensFilter.all (the coda's fade): never added to the grad or the band.
    expect(src).toContain('uniform float ndAll;');
    expect(src).toContain('float d = ndAll;');
    expect(src).toContain('d = max(d, ndStops * (1.0 - smoothstep(ndInner, 1.0, length(q))));');
    expect(src).toContain("effect.uniforms.get('ndAll')!.value = lensFilter.all;");
  });

  it('never brightens anything, and keeps the order of tones', () => {
    for (const on of [0.05, 0.2, 0.35, 0.6, 1]) {
      let prev = -1;
      for (let i = 0; i <= 100; i += 1) {
        const l = i / 100;
        const out = shoulder(l, HEADER_BAND.ceiling, on);
        expect(out).toBeLessThanOrEqual(l + 1e-12);
        expect(out).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = out;
      }
    }
  });
});
