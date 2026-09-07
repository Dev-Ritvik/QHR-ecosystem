/**
 * PHASE 6 — does the address bar follow the film, and the film the address bar?
 *
 *   Playwright MCP:  browser_run_code_unsafe { filename: this file }
 *
 * Six claims, each tested by doing the thing rather than by inspecting code:
 *
 *   1. scroll -> URL       the fragment names the chapter actually on screen
 *   2. no server request   crossing a chapter must not re-fetch the document
 *   3. no history spam     nine chapters must not become nine history entries
 *   4. URL -> scroll       a deep link opens ON that chapter
 *   5. back leaves cleanly back from the film goes to the previous page, not
 *                          backwards through nine chapters
 *   6. restoration         coming BACK to the film returns to the chapter left
 *
 * The document-request count is read from Playwright's own request events with
 * the navigation filter applied, so "no server request" is observed rather than
 * assumed from the absence of a visible flash.
 */
async (page) => {
  const BASE = 'http://localhost:3001';
  const out = {};

  const docRequests = [];
  const onReq = (r) => { if (r.resourceType() === 'document') docRequests.push(r.url().replace(BASE, '')); };
  page.on('request', onReq);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

  const scrollTo = async (frac) => {
    await page.evaluate((f) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.round(f * max));
    }, frac);
    // Longer than ChapterUrl's 180 ms settle, so the write has happened.
    await page.waitForTimeout(900);
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  try {
    const b = page.getByRole('button', { name: /essential only/i });
    await b.waitFor({ state: 'visible', timeout: 5000 });
    await b.click();
  } catch (e) { /* already consented */ }
  await page.waitForTimeout(6000);

  // 1 + 2 + 3 -------------------------------------------------------------
  const docsBefore = docRequests.length;
  const historyBefore = await page.evaluate(() => window.history.length);

  out.landing = page.url().replace(BASE, '');

  const walk = [];
  for (const f of [0.10, 0.32, 0.52, 0.62, 0.70, 0.78, 0.87]) {
    await scrollTo(f);
    walk.push({ frac: f, url: page.url().replace(BASE, '') });
  }
  out.walk = walk;
  out.documentRequestsDuringWalk = docRequests.length - docsBefore;
  out.historyEntriesAdded = (await page.evaluate(() => window.history.length)) - historyBefore;

  // Back to the top: the bar should shed the fragment rather than keep the
  // last chapter forever.
  await scrollTo(0);
  out.backAtTop = page.url().replace(BASE, '');

  // 4 ---------------------------------------------------------------------
  await page.goto(BASE + '/#station-2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  out.deepLink = await page.evaluate(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const sec = document.getElementById('station-2');
    return {
      frac: +(window.scrollY / max).toFixed(3),
      // The section's own position, so "did it land on the right chapter" is
      // answered against the DOM rather than against a number typed here.
      sectionTopFrac: sec ? +((sec.offsetTop) / max).toFixed(3) : null,
      sectionBottomFrac: sec ? +((sec.offsetTop + sec.offsetHeight) / max).toFixed(3) : null,
      url: location.pathname + location.hash,
    };
  });
  out.deepLinkLandedInsideChapter =
    out.deepLink.sectionTopFrac !== null &&
    out.deepLink.frac >= out.deepLink.sectionTopFrac - 0.01 &&
    out.deepLink.frac <= out.deepLink.sectionBottomFrac + 0.01;

  // 5 + 6 -----------------------------------------------------------------
  // Leave the film for a Tier-2 page, then come back through history.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await scrollTo(0.70);
  const leftAt = page.url().replace(BASE, '');
  await page.goto(BASE + '/downloads', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.goBack();
  await page.waitForTimeout(9000);
  out.leftAt = leftAt;
  out.afterBack = page.url().replace(BASE, '');
  out.afterBackScrollFrac = await page.evaluate(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return +(window.scrollY / max).toFixed(3);
  });

  out.errors = errors.slice(0, 6);
  out.errorCount = errors.length;
  page.off('request', onReq);
  return JSON.stringify(out, null, 2);
}
