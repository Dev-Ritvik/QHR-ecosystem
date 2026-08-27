import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests for apps/public.
 *
 * `include` is narrowed on purpose. Vitest's default glob would also collect
 * e2e/presentation-flow.spec.ts and e2e-slice0/persistence.spec.ts, which are
 * Playwright specs — they import @playwright/test and would fail on collection,
 * which is a worse failure mode than the silent skip this config exists to fix.
 * Playwright keeps its own runner and its own testDir.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
