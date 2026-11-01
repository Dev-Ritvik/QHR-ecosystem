// apps/public/src/components/site/reticle.test.ts
//
// The cursor's contracts: what it does to the page that a screenshot would not
// show until it had gone wrong for somebody.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RETICLE_MEDIA, RETICLE_TEXT } from './reticle';

const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

describe('the cursor', () => {
  const css = read('../../app/globals.css');
  const drawing = read('./ReticleDrawing.tsx');
  const rules = css.slice(css.indexOf('THE CURSOR (components/site/ReticleDrawing.tsx'));

  it('never leaves a visitor without one', () => {
    // the system's is hidden by a class the drawing sets when it has met a mouse,
    // not by the sheet alone: no script, a touch, a phone keep their own
    expect(css).toContain('html.reticle-on *');
    expect(css).not.toMatch(/(^|\n)\s*(html|body|\*)\s*\{[^}]*cursor:\s*none/);
    expect(drawing).toContain("html.classList.add('reticle-on');");
    expect(drawing).toContain("html.classList.remove('reticle-on');");
    // and a pointer that does not hover loads none of it
    expect(RETICLE_MEDIA).toContain('(hover: hover)');
    expect(RETICLE_MEDIA).toContain('(pointer: fine)');
    expect(RETICLE_MEDIA).toContain('(forced-colors: none)');
    expect(read('./ReticleCursor.tsx')).toContain("import('./ReticleDrawing')");
  });

  it('gives back the caret where one is placed, and stands aside', () => {
    expect(RETICLE_TEXT).toContain('textarea');
    expect(css).toMatch(/html\.reticle-on input:not\([^)]*\),\s*html\.reticle-on textarea,[^{]*\{\s*cursor: text !important;/);
    expect(css).toMatch(/\.reticle\[data-state='text'\] \{\s*opacity: 0;/);
  });

  it('is in the way of nothing, and over everything', () => {
    expect(css).toMatch(/\.reticle \{[^}]*pointer-events: none;/);
    const z = Number(/\.reticle \{[^}]*z-index: (\d+);/.exec(css)?.[1]);
    expect(z).toBeGreaterThan(100); // the consent card
    expect(drawing).toContain('aria-hidden className="reticle"');
  });

  it('is one drawing, whatever it is over: the hover state was taken off at the user’s word', () => {
    // nothing that knows what the pointer is over but a field and the scene
    expect(drawing).not.toMatch(/reticle-active|reticle-sweep|reticle-plate|reticle-caption|MutationObserver|style\.cursor/);
    expect(rules).not.toMatch(/reticle-active|reticle-sweep|reticle-plate|reticle-caption|data-state='hot'|data-state='plot'|data-hold/);
    // and nothing of it on the film's ground
    const layout = read('../experience/exteriorLayout.ts');
    expect(layout).not.toMatch(/reticle|uPlot|uScan|cursorInk|layoutPlotAt/);
    expect(read('../../app/(site)/(experience)/site-home/page.tsx')).not.toContain('data-plot-words');
    // one size
    expect(rules).toMatch(/\.reticle-ring \{[^}]*width: 36px;\s*height: 36px;/);
  });

  it('moves nothing but compositor layers, and blurs nothing', () => {
    expect(rules).not.toMatch(/backdrop-filter|filter:\s*blur/);
    for (const k of rules.matchAll(/@keyframes [\w-]+ \{[\s\S]*?\n\}/g)) {
      expect(k[0].match(/^\s+(?!from|to)[a-z-]+:/gm)?.every((l) => l.trim() === 'transform:')).toBe(true);
    }
    expect(rules).toContain('prefers-reduced-motion: reduce');
    // nothing turns: a band rotated on a layer is a bitmap, and read as pixels (the
    // user's reference of 2026-11-01); and the drawing's position is one transform
    expect(rules).not.toMatch(/@keyframes|animation:\s*reticle/);
    expect(drawing).not.toMatch(/feGaussianBlur|filter=/);
    expect(drawing).toContain('root.style.transform = `translate3d(${x}px, ${y}px, 0)`;');
  });

  it('says nothing: the box beside it was taken off at the user’s word', () => {
    // no words, no rule, no co-ordinates, and none of the sheet's annotations
    expect(drawing).not.toMatch(/reticle-words|reticle-survey|data-reticle-metres|Survey: idle|18\.114|83\.402/);
    expect(drawing).not.toMatch(/>\s*000°/);
    expect(drawing).not.toMatch(/>#FFB703</);
    expect(rules).not.toMatch(/reticle-words|reticle-survey|data-film|data-world|data-west|data-high|data-rise/);
    // and the film hands it nothing, every frame
    expect(read('../experience/WorldCanvas.tsx')).not.toMatch(/reticle/i);
    expect(read('./reticle.ts')).not.toMatch(/metres|reticleListen/);
    // the co-ordinates are still the header's own
    expect(read('./SiteHeader.tsx')).toContain('18.114° N, 83.402° E');
  });
});
