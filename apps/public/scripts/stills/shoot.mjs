// apps/public/scripts/stills/shoot.mjs
//
// THE STILLS, SHOT FROM THE BUILD THEY ARE FOR (src/components/experience/
// stills.ts has the account). Every view a visitor can open on — each page's
// plate, each chapter of the film where its copy is whole — is photographed
// from the running production build with nothing over it but what the scene
// itself draws, once for each cut of screen.
//
//   1. build and start the site          pnpm --filter @estate/public build; next start -p 3001
//   2. shoot      (from apps/public)     node scripts/stills/shoot.mjs <rawDir> [--base URL] [--only key,key] [--cuts w22,u46]
//   3. encode                            python scripts/stills/encode.py <rawDir>
//
// Step 3 writes public/stills/<v>/ and src/components/experience/
// stills.manifest.json, and the next build serves them. THE STILLS ARE OF A
// BUILD: shoot them again after anything that changes a picture (a model, a
// light, a pose, a lens, the film's copy windows), or a view opens on the old
// picture and dissolves into the new one.
//
// What is shot is the canvas alone: the page's words, its header, the grain
// and the still layer itself are hidden for the exposure (the lens's density
// under the film's copy is the scene's own, and stays).

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');

const args = process.argv.slice(2);
const RAW = args.find((a) => !a.startsWith('--'));
if (!RAW) {
  console.error('usage: node scripts/stills/shoot.mjs <rawDir> [--base URL] [--only key,key] [--cuts id,id]');
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = opt('base', 'http://localhost:3001');
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;
const ONLY_CUTS = opt('cuts', '') ? opt('cuts', '').split(',') : null;
fs.mkdirSync(RAW, { recursive: true });

/**
 * THE CUTS (stills.ts, CUTS): the frame each is shot at, in CSS pixels, at
 * twice the density — the encoder brings each down to `out` across, so an
 * edge in a still is as clean as the scene's own smoothing leaves it.
 */
const CUTS = [
  { id: 'w27', w: 2592, h: 960, dsf: 2, out: 2592 },
  { id: 'w22', w: 2112, h: 960, dsf: 2, out: 2112 },
  { id: 'w18', w: 1776, h: 960, dsf: 2, out: 1776 },
  { id: 'w16', w: 1536, h: 960, dsf: 2, out: 1536 },
  { id: 'w13', w: 1280, h: 960, dsf: 2, out: 1280 },
  { id: 'u70', w: 820, h: 1180, dsf: 2, out: 1025, mobile: true },
  { id: 'u59', w: 390, h: 664, dsf: 3, out: 780, mobile: true },
  { id: 'u46', w: 390, h: 844, dsf: 3, out: 780, mobile: true },
];

/**
 * A PAGE'S PLATE is its own words on its own ground over the picture, and the
 * picture's vertical field does not change with a wide screen's width: one
 * wide cut, the widest, is every wide screen's. The film's frames carry the
 * lens's density under their copy and are shot for each band of screens.
 */
const PLACE_CUTS = ['w27', 'u70', 'u59', 'u46'];
const FILM_CUTS = CUTS.map((c) => c.id);

/** Each place, and a page that stands there (packages/domain, places.ts). */
const PLACES = [
  ['arrival', '/start-here'],
  ['estate', '/construction-updates'],
  ['door', '/book-a-site-visit'],
  ['portico', '/why-us'],
  ['terrace', '/testimonials'],
  ['gate', '/terms'],
  ['canal', '/refund-policy'],
  ['above', '/sitemap'],
  ['hall', '/hall'],
  ['portrait', '/about'],
  ['tables', '/projects'],
  ['plots', '/properties'],
  ['map', '/locations'],
  ['sconces', '/branches'],
  ['dome', '/investment-guide'],
  ['attic', '/knowledge'],
  ['reading', '/knowledge/reading-a-layout-plan'],
  ['stair', '/faqs'],
  ['desk', '/contact'],
  ['plan', '/gallery'],
  ['plaque', '/downloads'],
  ['bench', '/careers'],
  ['shut', '/privacy'],
  ['urn', '/cookie-policy'],
  ['empty', '/no-such-page'],
  ['table', '/projects/kartikeya-water-front'],
  ['window', '/projects/lucky-garden'],
  ['study', '/projects/vsr-gayatri-township'],
];

const HIDE =
  'html, body, body *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; } ' +
  '.estate-grain, .scene-still, [data-scene-wait] { display: none !important; }';

const want = (key) => !ONLY || ONLY.includes(key) || ONLY.some((o) => key.startsWith(o));

const live = (page, ms = 120000) =>
  page.waitForFunction(() => document.documentElement.dataset.scene === 'live', undefined, { timeout: ms });

async function consent(page) {
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 12000 });
    await b.click();
  } catch {
    /* already answered in this context */
  }
}

async function expose(page, file) {
  const tag = await page.addStyleTag({ content: HIDE });
  // Two frames for the style to be laid out and the canvas to be the frame.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(120);
  await page.screenshot({ path: file, type: 'png' });
  await tag.evaluate((el) => el.remove());
}

const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu'],
});
const done = [];
const failed = [];

for (const cut of CUTS) {
  if (ONLY_CUTS && !ONLY_CUTS.includes(cut.id)) continue;
  const ctx = await browser.newContext({
    viewport: { width: cut.w, height: cut.h },
    deviceScaleFactor: cut.dsf,
    isMobile: !!cut.mobile,
    hasTouch: !!cut.mobile,
    reducedMotion: 'no-preference',
  });
  let answered = false;

  // ── the pages' plates ────────────────────────────────────────────────────
  if (PLACE_CUTS.includes(cut.id)) {
    for (const [place, route] of PLACES) {
      const key = `place-${place}`;
      if (!want(key)) continue;
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR', key, e.message.slice(0, 160)));
      try {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
        if (!answered) {
          await consent(page);
          answered = true;
        }
        await live(page);
        // The pointer off the page (a hover is a state), then the camera's own
        // settling and the reveal of the plate's words (which the scene's
        // density does not depend on, but the band a phone's frame is slid
        // over does).
        await page.mouse.move(cut.w - 2, cut.h - 2);
        await page.waitForTimeout(3600);
        await expose(page, path.join(RAW, `${key}.${cut.id}.png`));
        done.push(`${key}.${cut.id}`);
        console.log('SHOT', key, cut.id);
      } catch (e) {
        failed.push(`${key}.${cut.id}: ${String(e).slice(0, 120)}`);
        console.log('FAILED', key, cut.id, String(e).slice(0, 160));
      }
      await page.close();
    }
  }

  // ── the film's chapters ──────────────────────────────────────────────────
  if (FILM_CUTS.includes(cut.id) && (!ONLY || ONLY.some((o) => o.startsWith('film')))) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR film', e.message.slice(0, 160)));
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (!answered) {
        await consent(page);
        answered = true;
      }
      await live(page);
      await page.mouse.move(cut.w - 2, cut.h - 2);
      // Where each chapter's copy is whole, in pixels of this page: the
      // panes say their own windows (data-copy, in fractions of the film), and
      // the film says how long it is (data-film-end).
      const chapters = await page.evaluate(() => {
        let best = 0;
        let span = 0;
        for (const m of document.querySelectorAll('[data-film-end]')) {
          const f = +m.dataset.filmEnd;
          const y = m.getBoundingClientRect().top + scrollY;
          if (f > best && y > 0) {
            best = f;
            span = y / f;
          }
        }
        const seen = new Set();
        const out = [];
        for (const p of document.querySelectorAll('[data-copy]')) {
          const id = p.closest('section[id], header[id]')?.id;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const w = p.dataset.copy.split(',').map(Number);
          out.push({ id, y: id === 'hero' ? 0 : Math.round(((Math.max(0, w[1]) + w[2]) / 2) * span) });
        }
        return out;
      });
      for (const c of chapters) {
        const key = `film-${c.id}`;
        if (!want(key)) continue;
        await page.evaluate((to) => window.scrollTo(0, to), c.y);
        await page.waitForTimeout(600);
        await live(page);
        // The camera's damping, the lens following the copy, the hall's lights
        // on the first arrival inside.
        await page.waitForTimeout(/establish|station|portrait|city/.test(c.id) ? 7000 : 5000);
        await expose(page, path.join(RAW, `${key}.${cut.id}.png`));
        done.push(`${key}.${cut.id}`);
        console.log('SHOT', key, cut.id, 'y', c.y);
      }
    } catch (e) {
      failed.push(`film.${cut.id}: ${String(e).slice(0, 120)}`);
      console.log('FAILED film', cut.id, String(e).slice(0, 160));
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(
  path.join(RAW, 'shoot.json'),
  JSON.stringify({ at: new Date().toISOString(), base: BASE, cuts: CUTS, done, failed }, null, 1),
);
console.log(`${done.length} shot, ${failed.length} failed`);
if (failed.length) process.exitCode = 1;
