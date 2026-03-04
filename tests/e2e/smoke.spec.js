import { test, expect } from '@playwright/test';

const URL = '/matmul-3d.html';

// WebGL isn't available in headless Chromium — filter those errors
function realErrors(errors) {
  return errors.filter(e => !e.includes('WebGL'));
}

test('app loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await expect(page.locator('.nav-wrap')).toBeVisible();
  expect(realErrors(errors)).toEqual([]);
});

test('all 3 tab navigations work', async ({ page }) => {
  await page.goto(URL);

  // Building Blocks tier — Inner Product (default)
  await expect(page.locator('#ctrl-inner')).not.toHaveClass(/hidden/);

  // Switch to Outer Product
  await page.locator('#tab-intro').click();
  await expect(page.locator('#ctrl-intro')).not.toHaveClass(/hidden/);

  // Switch to Matrix Multiply tier
  await page.locator('#tier1-matmul').click();
  await expect(page.locator('#ctrl-matmul')).not.toHaveClass(/hidden/);
});

test('all presets load without non-WebGL errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);

  // Switch to Matrix Multiply tier
  await page.locator('#tier1-matmul').click();
  await expect(page.locator('#presetBar')).toBeVisible();

  const pills = page.locator('.preset-pill');
  const count = await pills.count();
  expect(count).toBeGreaterThanOrEqual(10);

  for (let i = 0; i < count; i++) {
    await pills.nth(i).click();
    // Verify A grid renders cells (always present after preset load)
    await expect(page.locator('#gridA .mat-cell').first()).toBeVisible();
  }
  expect(realErrors(errors)).toEqual([]);
});

test('inner product tab renders vectors', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('#ctrl-inner')).not.toHaveClass(/hidden/);
  await expect(page.locator('#innerDisplay .mat-cell').first()).toBeVisible();
  await expect(page.locator('#fInner')).not.toBeEmpty();
});

test('outer product tab renders', async ({ page }) => {
  await page.goto(URL);
  await page.locator('#tab-intro').click();
  await expect(page.locator('#ctrl-intro')).not.toHaveClass(/hidden/);
  await expect(page.locator('#ctrl-intro .mat-cell').first()).toBeVisible();
});

test('tab switching between tiers without non-WebGL errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);

  // Start on inner product (Building Blocks)
  await expect(page.locator('#ctrl-inner')).not.toHaveClass(/hidden/);

  // Switch to Matrix Multiply tier
  await page.locator('#tier1-matmul').click();
  await expect(page.locator('#ctrl-matmul')).not.toHaveClass(/hidden/);

  // Switch back to Building Blocks
  await page.locator('#tier1-blocks').click();
  await expect(page.locator('#ctrl-inner')).not.toHaveClass(/hidden/);

  // Switch to Outer Product
  await page.locator('#tab-intro').click();
  await expect(page.locator('#ctrl-intro')).not.toHaveClass(/hidden/);

  expect(realErrors(errors)).toEqual([]);
});

test('matmul A and B grids render on fresh load', async ({ page }) => {
  await page.goto(URL);
  await page.locator('#tier1-matmul').click();
  await expect(page.locator('#ctrl-matmul')).not.toHaveClass(/hidden/);

  await expect(page.locator('#gridA .mat-cell').first()).toBeVisible();
  await expect(page.locator('#gridB .mat-cell').first()).toBeVisible();

  const aCells = await page.locator('#gridA .mat-cell').count();
  expect(aCells).toBe(9);
});

test('preset selection updates A/B grids', async ({ page }) => {
  await page.goto(URL);
  await page.locator('#tier1-matmul').click();

  await page.evaluate(() => {
    const pills = document.querySelectorAll('.preset-pill');
    if (pills.length > 1) pills[1].click();
  });

  await expect(page.locator('#gridA .mat-cell').first()).toBeVisible();
});

test('build-mode radio toggle visible and switchable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);

  // Switch to Matrix Multiply tier
  await page.locator('#tier1-matmul').click();
  await expect(page.locator('#ctrl-matmul')).not.toHaveClass(/hidden/);

  // Build mode radios should be visible
  await expect(page.locator('input[name="buildMode"][value="outer"]')).toBeVisible();
  await expect(page.locator('input[name="buildMode"][value="dot"]')).toBeVisible();

  // Switch to dot product mode via JS (avoids WebGL issues)
  await page.evaluate(() => window.setBuildMode('dot'));

  // Checkbox label should update
  const label = await page.locator('#chkDetailLabel').textContent();
  expect(label).toBe('Term by term');

  // Switch back
  await page.evaluate(() => window.setBuildMode('outer'));
  const label2 = await page.locator('#chkDetailLabel').textContent();
  expect(label2).toBe('Element by element');

  expect(realErrors(errors)).toEqual([]);
});
