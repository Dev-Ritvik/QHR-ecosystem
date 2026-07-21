import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const routes = [
  '/',
  '/projects',
  '/projects/new',
  '/leads',
  '/visits',
  '/settings',
  '/settings/users',
];

test.describe('Visual Crawler', () => {
  test('take screenshots of core routes', async ({ page }) => {
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    for (const route of routes) {
      console.log(`Navigating to ${route}...`);
      await page.goto(`http://localhost:3000${route}`);
      await page.waitForLoadState('networkidle');
      
      const fileName = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
      const screenshotPath = path.join(screenshotsDir, `${fileName}.png`);
      
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Saved screenshot to ${screenshotPath}`);
    }
  });
});
