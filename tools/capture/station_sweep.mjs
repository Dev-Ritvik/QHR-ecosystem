/**
 * PHASE 6B — where the tables are actually reachable.
 *
 *   node tools/capture/station_sweep.mjs
 *
 * Walks the interior leg and reports, at each scroll fraction, which station
 * drag proxies project inside the frame and where. Written because adding the
 * city chapter renormalised the interior leg and the turntable test's hardcoded
 * fractions stopped pointing at anything — and "recompute them from the
 * weights" produced a list that still found nothing. A sweep answers it in one
 * run instead of one rebuild per guess.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const appRequire = createRequire(
  pathToFileURL(path.join(process.cwd(), 'apps/public/package.json')).href,
);
const { chromium } = appRequire('playwright');

const BASE = 'http://localhost:3001';

const INIT = () => {
  const hits = { scenes: [], renderers: [] };
  const tgt = new EventTarget();
  tgt.addEventListener('observe', (e) => {
    const o = e.detail;
    if (!o) return;
    if (o.isScene) hits.scenes.push(o);
    else if (o.isWebGLRenderer) hits.renderers.push(o);
  });
  window.__THREE_DEVTOOLS__ = tgt;
  window.__PROBE__ = hits;
};

const ATTACH = () => {
  const h = window.__PROBE__;
  if (!h || !h.renderers.length) return false;
  const gl = h.renderers[h.renderers.length - 1];
  if (gl.__swPatched) return true;
  const orig = gl.render.bind(gl);
  gl.render = function patched(scene, camera) {
    if (scene && scene.isScene) {
      let world = false;
      scene.traverse((o) => {
        if (!world && /^(station_drag_|beacon_|mansion_)/.test(o.name || '')) world = true;
      });
      if (world) window.__PAIR__ = { scene, camera };
    }
    return orig(scene, camera);
  };
  gl.__swPatched = true;
  return true;
};

const LOOK = () => {
  const pair = window.__PAIR__;
  if (!pair) return null;
  const V = pair.camera.position.constructor;
  const out = [];
  pair.scene.traverse((o) => {
    const m = /^station_drag_(.+)$/.exec(o.name || '');
    if (!m) return;
    const c = o.getWorldPosition(new V());
    const p = c.clone().project(pair.camera);
    const x = Math.round(((p.x + 1) / 2) * window.innerWidth);
    const y = Math.round(((-p.y + 1) / 2) * window.innerHeight);
    const onScreen =
      p.z < 1 && x > 60 && x < window.innerWidth - 60 && y > 110 && y < window.innerHeight - 60;
    const el = onScreen ? document.elementFromPoint(x, y) : null;
    out.push({
      id: m[1],
      x,
      y,
      onScreen,
      hit: el ? el.tagName : null,
    });
  });
  return out;
};

const main = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 6000 });
    await b.click();
  } catch { /* consented */ }
  const locked = await page
    .waitForFunction(() => document.documentElement.style.overflow === 'hidden', undefined,
                     { timeout: 9000 })
    .then(() => true, () => false);
  if (locked) {
    await page.waitForFunction(
      () => document.documentElement.style.overflow !== 'hidden', undefined, { timeout: 60000 });
  }
  await page.evaluate(ATTACH);
  await page.waitForTimeout(800);

  for (let f = 0.5; f <= 0.8001; f += 0.01) {
    const frac = +f.toFixed(3);
    await page.evaluate((v) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.round(v * max));
    }, frac);
    await page.waitForTimeout(1200);
    const rows = await page.evaluate(LOOK);
    if (!rows) { console.log(frac, 'no pair'); continue; }
    const on = rows.filter((r) => r.onScreen);
    console.log(
      frac.toFixed(3),
      on.length
        ? on.map((r) => `${r.id}@${r.x},${r.y} over ${r.hit}`).join('  ')
        : '-',
    );
  }
  await browser.close();
};

main().catch((e) => { console.error(e); process.exit(1); });
