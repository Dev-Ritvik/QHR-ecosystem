// Slice 0 / Step 2 acceptance: does the WebGL canvas survive route changes?
//
// This is the test that validates FRONTEND_ARCHITECTURE §3.1. If it fails, the
// persistent-flight model is wrong and the architecture needs revising before
// any art is built.
import { test, expect, type Page } from '@playwright/test';

async function readProbe(page: Page) {
  await expect(page.getByTestId('persistence-probe')).toBeVisible({ timeout: 30_000 });
  // Wait for the render loop to have ticked at least once.
  await expect
    .poll(async () => (await page.getByTestId('probe-ctx').textContent())?.trim(), { timeout: 30_000 })
    .not.toBe('—');

  return {
    ctx: (await page.getByTestId('probe-ctx').textContent())!.trim(),
    gen: (await page.getByTestId('probe-gen').textContent())!.trim(),
    clock: parseFloat((await page.getByTestId('probe-clock').textContent())!.replace('s', '')),
  };
}

test('canvas survives in-segment navigation without remounting', async ({ page }) => {
  const fatals: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.text().includes('context lost')) fatals.push(m.text());
  });
  page.on('pageerror', (e) => fatals.push(`pageerror: ${e.message}`));

  await page.goto('/about');
  const before = await readProbe(page);
  expect(before.gen).toBe('1'); // exactly one WebGL context created

  // Navigate within the (experience) segment via a real client-side link.
  await page.getByRole('link', { name: /why families choose us/i }).click();
  await expect(page).toHaveURL(/\/why-us$/);
  await expect(page.getByRole('heading', { name: /proof, not persuasion/i })).toBeVisible();

  const after = await readProbe(page);

  // THE ASSERTIONS THAT MATTER:
  expect(after.ctx).toBe(before.ctx);        // same WebGL context object
  expect(after.gen).toBe('1');               // no second context was ever created
  expect(after.clock).toBeGreaterThan(before.clock); // same render loop, still running

  // And back again (browser history must not remount it either).
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  const afterBack = await readProbe(page);
  expect(afterBack.ctx).toBe(before.ctx);
  expect(afterBack.gen).toBe('1');

  expect(fatals, `console errors: ${fatals.join(' | ')}`).toEqual([]);

  console.log(
    `PERSISTENCE: ctx ${before.ctx} → ${after.ctx} → ${afterBack.ctx} | gen ${afterBack.gen} | clock ${before.clock}s → ${afterBack.clock}s`,
  );
  await page.screenshot({ path: process.env.SLICE0_SHOT || 'slice0.png', fullPage: false });
});

test('sustains 60fps on the reference machine', async ({ page }) => {
  await page.goto('/about');
  await readProbe(page);
  await page.waitForTimeout(1500); // let it settle past first-frame compile

  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames += 1;
          if (performance.now() - start < 3000) requestAnimationFrame(tick);
          else resolve((frames * 1000) / (performance.now() - start));
        };
        requestAnimationFrame(tick);
      }),
  );

  console.log(`MEASURED FPS: ${fps.toFixed(1)}`);
  expect(fps).toBeGreaterThan(55);
});

test('Tier 1 node server-renders real HTML with JavaScript disabled', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/about');

  // The article must exist without any JS having run.
  await expect(page.getByRole('heading', { name: /built for the long horizon/i })).toBeVisible();
  await expect(page.getByText(/approvals, survey lineage/i)).toBeVisible();

  const html = await page.content();
  expect(html).toContain('Built for the long horizon');
  console.log(`NO-JS HTML: ${html.length} bytes, heading + body copy present`);

  await ctx.close();
});
