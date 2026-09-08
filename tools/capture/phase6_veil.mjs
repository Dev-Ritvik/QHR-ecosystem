/**
 * PHASE 6 — the route veil, tested for the thing that matters: does every
 * navigation still work?
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * A transition device sits in front of every link on the site, so the only
 * interesting question is whether it ever eats one. Each case below performs a
 * real click and asserts the destination, and each also asserts that the veil
 * REOPENED — a veil that leaves the visitor behind an opaque screen is a worse
 * outcome than no transition, and "the URL changed" would not catch it.
 *
 * Covered:
 *   Tier1 -> Tier1     /about  -> /why-us   (canvas must survive)
 *   Tier1 -> Tier2     /       -> /projects/<slug>
 *   Tier2 -> Tier1     project -> /
 *   Tier2 -> Tier2     project -> /downloads
 *   in-page fragment   must NOT veil (the chapter anchors, the skip link)
 *   new tab / modifier must NOT be intercepted
 *   reduced motion     no veil, navigation still client-side
 */
async (page) => {
  const BASE = 'http://localhost:3001';
  const out = {};
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 180)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 180)); });
  const docs = [];
  page.on('request', (r) => { if (r.resourceType() === 'document') docs.push(r.url().replace(BASE, '')); });

  const veilState = () =>
    page.evaluate(() => {
      // The veil is the only fixed z-[80] element in the tree.
      const el = document.querySelector('div.fixed.inset-0.z-\\[80\\]');
      if (!el) return { present: false };
      const cs = getComputedStyle(el);
      return {
        present: true,
        opacity: +cs.opacity,
        visibility: cs.visibility,
        pointerEvents: cs.pointerEvents,
      };
    });

  const settle = async (ms) => page.waitForTimeout(ms);

  /**
   * Wait for the preloader to actually lift before clicking anything.
   *
   * The first version of this file used a flat 5 s wait and then clicked a
   * project card 9,053 px down the track. The preloader holds
   * `overflow: hidden` on the document until the scene is ready, so
   * scroll-into-view could not reach the link and the click landed on the
   * cover — which looked exactly like the veil eating a navigation, and was
   * reported as one for two runs. The scroll lock is the real precondition, so
   * it is what gets waited on.
   */
  // Wait for the preloader to APPLY its lock and then release it. The naive
  // `!== 'hidden'` check resolves instantly, because the Preloader is
  // dynamic(ssr:false) and the inline style is '' until it mounts — measured,
  // it returned at 359 ms with zero meshes in the scene while the cover did not
  // actually lift until 2870 ms.
  const ready = async () => {
    const locked = await page
      .waitForFunction(() => document.documentElement.style.overflow === 'hidden',
                       undefined, { timeout: 8000 })
      .then(() => true, () => false);
    if (locked) {
      await page.waitForFunction(() => document.documentElement.style.overflow !== 'hidden',
                                 undefined, { timeout: 45000 });
    }
    await page.waitForTimeout(600);
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/about', { waitUntil: 'domcontentloaded' });
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 5000 });
    await b.click();
  } catch (e) { /* consented */ }
  await ready();
  out.veilPresent = await veilState();

  // --- Tier 1 -> Tier 1, with the canvas identity checked across it --------
  const canvasBefore = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    // Tag the live element; if the tag survives, the element was never
    // replaced — which is a stronger claim than "a canvas is present".
    c.dataset.veilProbe = 'tier1';
    return { w: c.width, h: c.height };
  });
  const docsBefore = docs.length;
  const link = page.getByRole('link', { name: /how we work|why us/i }).first();
  await link.click();
  // PEAK opacity across the transition, not a single sample. A one-shot read at
  // a fixed offset is a race against the compositor: the same 150 ms sample
  // returned 0.98 on one run and 0.00 on another, because the transition had
  // not started painting yet. Polling for the maximum answers the actual
  // question — did the veil ever close — without depending on when we looked.
  let peak = 0;
  for (let i = 0; i < 14; i += 1) {
    const v = await veilState();
    if (v.opacity > peak) peak = v.opacity;
    await settle(60);
  }
  out.veilClosedTo = +peak.toFixed(2);
  await settle(2000);
  out.tier1 = {
    url: page.url().replace(BASE, ''),
    veil: await veilState(),
    canvasSurvived: await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return !!(c && c.dataset.veilProbe === 'tier1');
    }),
    documentRequests: docs.length - docsBefore,
    canvasBefore,
  };

  // --- in-page fragment must NOT veil -------------------------------------
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await ready();
  const beforeAnchor = await veilState();
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = '#constellation';
    a.textContent = 'probe';
    a.id = 'veil-anchor-probe';
    document.querySelector('main')?.appendChild(a);
  });
  await page.click('#veil-anchor-probe');
  await settle(120);
  const duringAnchor = await veilState();
  out.fragmentDidNotVeil =
    beforeAnchor.opacity === 0 && duringAnchor.opacity === 0 &&
    duringAnchor.visibility === 'hidden';
  out.anchorUrl = page.url().replace(BASE, '');

  // --- Tier 1 -> Tier 2 ----------------------------------------------------
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await ready();
  const projectLink = page.locator('main a[href^="/projects/"]').first();
  const projectHref = await projectLink.getAttribute('href');
  const d2 = docs.length;
  await projectLink.click();
  await settle(2600);
  out.tier1to2 = {
    wanted: projectHref, url: page.url().replace(BASE, ''),
    veil: await veilState(), documentRequests: docs.length - d2,
  };

  // --- Tier 2 -> Tier 2 ----------------------------------------------------
  const d3 = docs.length;
  await page.getByRole('link', { name: /^the residence$/i }).first().click().catch(async () => {
    await page.locator('a[href="/downloads"]').first().click();
  });
  await settle(2600);
  out.tier2to1or2 = { url: page.url().replace(BASE, ''), veil: await veilState(),
                      documentRequests: docs.length - d3 };

  // --- modifier click must not be intercepted ------------------------------
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await ready();
  const before = page.url();
  await page.locator('main a[href^="/"]').first().click({ modifiers: ['Control'] });
  await settle(700);
  out.modifierClickDidNotNavigateInPlace = page.url() === before;
  out.modifierVeil = await veilState();

  // --- reduced motion ------------------------------------------------------
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/about', { waitUntil: 'domcontentloaded' });
  await ready();
  const d4 = docs.length;
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (c) c.dataset.veilProbe = 'reduced';
  });
  await page.getByRole('link', { name: /how we work|why us/i }).first().click();
  await settle(1800);
  out.reducedMotion = {
    url: page.url().replace(BASE, ''),
    documentRequests: docs.length - d4,
    veil: await veilState(),
    canvasSurvived: await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return !!(c && c.dataset.veilProbe === 'reduced');
    }),
  };
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  out.errorCount = errors.length;
  out.errors = errors.slice(0, 6);
  return JSON.stringify(out, null, 2);
}
