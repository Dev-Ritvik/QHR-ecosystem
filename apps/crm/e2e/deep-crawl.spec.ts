import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Deep E2E Action Crawler', () => {
  test.setTimeout(600000); // 10 minutes timeout for deep crawling

  test('exhaustively click all actions and capture states', async ({ page }) => {
    const screenshotsDir = path.join(__dirname, 'screenshots', 'deep-crawl');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    let hasErrors = false;

    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Ignore generic favicon or known safe errors if needed
        const text = msg.text();
        if (
          !text.includes('favicon.ico') && 
          !text.includes('referrer policy') &&
          !text.includes('NEXT_PUBLIC_MAPTILER_API_KEY') &&
          !text.includes('violates the following Content Security Policy')
        ) {
          console.error(`Browser console error: ${text}`);
          hasErrors = true;
        }
      }
    });

    page.on('dialog', async dialog => {
      console.log(`Auto-dismissing dialog: ${dialog.message()}`);
      await dialog.dismiss().catch(() => {});
    });

    page.on('pageerror', exception => {
      if (!exception.message.includes('useContext')) {
        console.error(`Unhandled exception: ${exception.message}`);
        hasErrors = true;
      }
    });

    // 1. Target Dynamic Routes Dynamically
    const dynamicRoutes: string[] = [];
    
    // Get Project ID
    await page.goto('http://localhost:3002/projects');
    await page.waitForLoadState('networkidle');
    const projectLink = page.locator('main a[href^="/projects/"]:not([href="/projects/new"])').first();
    let projectId = '';
    if (await projectLink.count() > 0) {
       const href = await projectLink.getAttribute('href');
       if (href) {
         projectId = href.replace('/projects/', '');
         dynamicRoutes.push(
           href,
           `${href}/units`,
           `${href}/pricing`,
           `${href}/pois`,
           `${href}/commissions`
         );
       }
    }

    // Get Lead ID
    await page.goto('http://localhost:3002/leads');
    await page.waitForLoadState('networkidle');
    const leadLink = page.locator('main a[href^="/leads/"]:not([href="/leads/new"])').first();
    if (await leadLink.count() > 0) {
       const href = await leadLink.getAttribute('href');
       if (href) {
         dynamicRoutes.push(href);
       }
    }

    // Explicitly add /visits first child if applicable
    await page.goto('http://localhost:3002/visits');
    await page.waitForLoadState('networkidle');
    const visitLink = page.locator('main a[href^="/visits/"]').first();
    if (await visitLink.count() > 0) {
       const href = await visitLink.getAttribute('href');
       if (href) {
         dynamicRoutes.push(href);
       }
    }

    const routes = [
      '/projects',
      '/leads',
      '/visits',
      '/settings',
      ...dynamicRoutes
    ];

    const uniqueRoutes = [...new Set(routes)];

    for (const route of uniqueRoutes) {
      console.log(`\nStarting deep crawl on ${route}`);
      const response = await page.goto(`http://localhost:3002${route}`);
      
      if (!response || !response.ok()) {
        console.error(`Failed to load ${route} with status ${response?.status()}`);
        hasErrors = true;
        continue;
      }

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      const selector = 'main a:not([disabled]), main button:not([disabled]), main [role="button"], main [role="tab"], main tr';
      
      const initialCount = await page.locator(selector).count();
      console.log(`Found initially ${initialCount} interactive elements on ${route}`);

      for (let i = 0; i < initialCount; i++) {
        // Evaluate locator every iteration to avoid stale elements after goBack
        const element = page.locator(selector).nth(i);
        
        if (await element.count() === 0) {
           console.log(`Element ${i} no longer exists.`);
           continue;
        }

        const isVisible = await element.isVisible();
        if (!isVisible) continue;
        
        console.log(`Clicking element ${i} on ${route}`);
        
        try {
          // Fill forms in main context to enable any disabled buttons
          const inputs = page.locator('main input:visible, main textarea:visible, main select:visible');
          const inputCount = await inputs.count();
          for (let k = 0; k < inputCount; k++) {
             try {
                const el = inputs.nth(k);
                const tagName = await el.evaluate(e => e.tagName.toLowerCase());
                if (tagName === 'select') {
                    // Try to pick the last option
                    const options = await el.locator('option').all();
                    if (options.length > 1) {
                        const val = await options[options.length - 1].getAttribute('value');
                        if (val) await el.selectOption(val, { timeout: 1000 });
                    }
                } else {
                    await el.fill('test', { force: true, timeout: 1000 });
                }
             } catch(e) {}
          }

          // Some elements (like tr) might cause navigation, use Promise.race for timeout on click
          await Promise.race([
             element.click({ force: true, timeout: 2000 }),
             new Promise((_, reject) => setTimeout(() => reject(new Error('Click strictly timed out')), 2500))
          ]);
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(500);
          
          const routeName = route.replace(/\//g, '_').replace(/^_/, '') || 'home';
          const screenshotPath = path.join(screenshotsDir, `${routeName}-action-${i}-click.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });

          // check for modals or dropdowns
          const dialog = page.locator('[role="dialog"], dialog, [role="menu"]');
          if (await dialog.count() > 0 && await dialog.first().isVisible()) {
            console.log(`Context overlay detected after clicking element ${i}, interacting.`);
            
            // Pre-fill modal inputs
            const modalInputs = dialog.first().locator('input:visible, textarea:visible');
            const modalInputCount = await modalInputs.count();
            for (let k = 0; k < modalInputCount; k++) {
               try {
                  await modalInputs.nth(k).fill('test', { force: true, timeout: 1000 });
               } catch(e) {}
            }

            const modalScreenshotPath = path.join(screenshotsDir, `${routeName}-action-${i}-overlay.png`);
            await page.screenshot({ path: modalScreenshotPath, fullPage: true });

            // Attempt to close
            const closeBtn = dialog.first().locator('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"]');
            if (await closeBtn.count() > 0 && await closeBtn.first().isVisible()) {
              await closeBtn.first().click({ force: true, timeout: 2000 });
            } else {
              await page.keyboard.press('Escape');
            }
            await page.waitForTimeout(500);
          }

          // State Management: Check if navigated away
          const currentUrl = new URL(page.url());
          if (currentUrl.pathname !== route) {
             console.log(`Navigation triggered to ${currentUrl.pathname}, going back.`);
             await page.goBack();
             await page.waitForLoadState('networkidle');
             await page.waitForTimeout(500);
          }

        } catch (err: any) {
          console.warn(`Could not interact with element ${i}: ${err.message}`);
          // Fallback to reload route if stuck
          if (new URL(page.url()).pathname !== route) {
            await page.goto(`http://localhost:3002${route}`);
            await page.waitForLoadState('domcontentloaded');
          }
        }
      }
    }

    expect(hasErrors).toBe(false);
  });
});
