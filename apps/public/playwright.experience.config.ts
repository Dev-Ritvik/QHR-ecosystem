// apps/public/playwright.experience.config.ts
//
// The cinematic experience suite, deliberately separate from the default config.
//
// NO globalSetup. The default playwright.config.ts runs
// packages/db/src/seed/seed.ts against whatever DATABASE_URL points at, which
// locally is the live projection — a suite that only reads pages has no
// business seeding a database, and this one does not.
//
// It runs against the PRODUCTION server rather than `next dev`. That is not a
// preference: on the dev server the first navigation to a route pays for its
// webpack compile, which took a Tier-1 -> Tier-2 hop past three seconds and
// tripped the route veil's watchdog. The suite was reporting a veil defect that
// was a compiler. `next start` serves the same build a visitor gets.
//
// Serial, one worker. Several of these drive the scroll position of a shared
// scroll-driven film and read GPU state; running them in parallel on one
// machine makes the settle times, and therefore the assertions, depend on how
// busy the other workers are.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-experience',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : [['list']],
  // The film is long and the models are large; a cold first test pays for both.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3001',
    // Attach to a server that is already up locally; CI always starts its own.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
