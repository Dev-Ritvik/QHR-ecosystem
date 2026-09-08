/**
 * PHASE 6 — does navigating round the site leak?
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * TWO LAPS of the loop that crosses the segment boundary: from the film out to
 * a project page and back through the resume affordance. That boundary is the
 * interesting one — /projects/<slug> lives OUTSIDE the (experience) route
 * group, so navigating to it unmounts the canvas by design and returning builds
 * a new WebGL context. It is the only navigation on the site that could leak a
 * renderer.
 *
 * WHAT COUNTS AS A LEAK, DECIDED BEFORE THE NUMBERS.
 *
 * Not "the numbers moved during a lap" — they must, because the world is torn
 * down and rebuilt. A leak is LAP 2 ENDING HIGHER THAN LAP 1 ENDED. One lap can
 * only show a cost; two can tell a cost from a leak, which is why there are
 * two.
 *
 * EVERY NAVIGATION IS A CLIENT NAVIGATION. page.goto would reload the document,
 * which resets both the heap and the renderer — comparing two fresh loads
 * measures the browser's HTTP cache and nothing about this application. Only
 * navigations that keep the document alive can accumulate anything.
 *
 * THE RENDERER'S OWN ACCOUNTING IS THE REAL MEASUREMENT. info.memory.geometries
 * and .textures are live GL objects, not an estimate. The heap figure beside
 * them is performance.memory: Chrome-only, quantised, unforced without
 * --expose-gc, and reported here as a trend across laps rather than as a
 * number that means anything on its own.
 *
 * ONE HARNESS NOTE, BECAUSE IT COST THREE RUNS. The runner's vm has no global
 * URL constructor. `new URL(r.url()).pathname` inside a page.on('request')
 * handler therefore throws asynchronously and takes the entire connection down,
 * surfacing as "Connection closed" with no error and no stack — which reads
 * exactly like a timeout and was diagnosed as one twice. Paths are sliced from
 * strings here.
 */
async (page) => {
  const BASE = 'http://localhost:3001';
  const path = (u) => u.replace(BASE, '').split('?')[0];

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

  // `renderers` is the count of WebGLRenderers three has EVER announced in this
  // document, which is the honest way to count context rebuilds.
  //
  // A `webglcontextlost` listener was tried and does not work: r3f calls
  // forceContextLoss() on a canvas it is in the middle of detaching, so the
  // event has no path to a window-level listener and the count stays 0 while
  // the console plainly shows "THREE.WebGLRenderer: Context Lost." Counting
  // renderers observes the same thing from the side that can actually see it.
  const READ = () => {
    const h = window.__PROBE__;
    const gl = h && h.renderers.length ? h.renderers[h.renderers.length - 1] : null;
    return {
      renderers: h ? h.renderers.length : 0,
      scenes: h ? h.scenes.length : 0,
      geometries: gl ? gl.info.memory.geometries : null,
      textures: gl ? gl.info.memory.textures : null,
      programs: gl && gl.info.programs ? gl.info.programs.length : null,
      heapMB: performance.memory
        ? Math.round(performance.memory.usedJSHeapSize / 1048576)
        : null,
      canvases: document.querySelectorAll('canvas').length,
    };
  };

  const ready = () =>
    page.waitForFunction(
      () => document.documentElement.style.overflow !== 'hidden',
      undefined,
      { timeout: 22000 },
    );

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 110)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 110));
  });
  const glbs = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.slice(-4) === '.glb') glbs.push(path(u));
  });

  await page.addInitScript(INIT);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 4000 });
    await b.click();
  } catch (e) { /* consented */ }
  await ready();
  await page.waitForTimeout(1200);

  const marks = [];
  marks.push({ at: 'baseline', ...(await page.evaluate(READ)) });

  // Into the hall once, so the interior is armed and uploaded before the first
  // teardown — otherwise lap 1 and lap 2 are not the same lap.
  await page.evaluate(() => {
    const m = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(0.62 * m));
  });
  await page.waitForTimeout(1400);

  const lap = async (n) => {
    await page.locator('main a[href^="/projects/"]').first().click({ timeout: 12000 });
    await page.waitForTimeout(1800);
    marks.push({ at: 'lap' + n + ':away', ...(await page.evaluate(READ)) });

    await page.getByRole('link', { name: /the residence/i }).first().click({ timeout: 12000 });
    await ready();
    await page.waitForTimeout(1800);
    marks.push({ at: 'lap' + n + ':back', ...(await page.evaluate(READ)) });
  };

  await lap(1);
  await lap(2);

  const l1 = marks.find((m) => m.at === 'lap1:back');
  const l2 = marks.find((m) => m.at === 'lap2:back');
  return JSON.stringify({
    marks,
    // THE VERDICT: lap 2 against lap 1, at the same point in the cycle.
    lapOverLap: {
      geometries: l2.geometries - l1.geometries,
      textures: l2.textures - l1.textures,
      programs: l2.programs - l1.programs,
      canvases: l2.canvases - l1.canvases,
      heapMB: l2.heapMB - l1.heapMB,
      renderersCreated: l2.renderers - l1.renderers,
    },
    distinctGlbs: glbs.filter((v, i, a) => a.indexOf(v) === i),
    glbRequests: glbs.length,
    errorCount: errors.length,
    errors: errors.slice(0, 5),
  }, null, 2);
}
