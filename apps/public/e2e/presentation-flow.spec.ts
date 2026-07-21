import { test, expect } from '@playwright/test';

test.describe('Presentation Flow', () => {
  test('Keyboard-only pacemaker test: grid → project → view modes → unit panel', async ({ page }) => {
    // 1. Grid
    await page.goto('/present-home');

    // Wait for grid to be ready
    await expect(page.locator('main').first()).toBeVisible();

    // Use spatial navigation to focus the first project card
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    // 2. Project Cinematic Entry & Bird's Eye Map
    // Wait for transition to complete and map legend to be visible (FR-PM3 buffer)
    const legend = page.locator('[data-testid="status-legend"]');
    await expect(legend).toBeVisible({ timeout: 60000 });

    // Ensure the MapLibre canvas is present
    const mapCanvas = page.locator('.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible();

    // 3. View Modes (FR-PM6)
    // Cycle through all three view modes using keyboard exclusively
    // ArrowUp navigates focus into the view mode switcher controls
    await page.keyboard.press('ArrowUp');

    // Select Skeleton View (Mode 1)
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    // Select 2.5D Extrusion View (Mode 2)
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    // Select Connectivity View (Mode 3)
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    // 4. Unit Panel (FR-PM5 / FR-PM7)
    // Navigate back down to the map units
    await page.keyboard.press('ArrowDown');

    // Move to a unit polygon and select it
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    // Verify the Unit Panel opens
    const unitPanel = page.locator('[data-testid="unit-panel"]');
    await expect(unitPanel).toBeVisible();

    // Verify key unit panel contents formatting (e.g., Price string presence)
    await expect(unitPanel).toContainText(/₹|Price/i);
  });
});
