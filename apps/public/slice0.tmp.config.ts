// TEMPORARY Playwright config for the Slice 0 / Step 2 acceptance run.
// Deliberately NO globalSetup: the default e2e/global-setup.ts seeds fixture
// data into whatever DATABASE_URL points at — currently the LIVE database.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-slice0',
  reporter: 'line',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:3001' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
