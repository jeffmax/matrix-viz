import { test, expect } from '@playwright/test';

// serve strips .html and redirects — use clean URL to preserve query params
const BASE = '/matmul-3d';

function realErrors(errors) {
  return errors.filter(e => !e.includes('WebGL'));
}

test('?tab=matmul navigates to Matrix Multiply', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}?tab=matmul`);
  await expect(page.locator('#ctrl-matmul')).not.toHaveClass(/hidden/);
  await expect(page.locator('#tier1-matmul')).toHaveClass(/active/);
  expect(realErrors(errors)).toEqual([]);
});

test('?tab=intro navigates to Outer Product', async ({ page }) => {
  await page.goto(`${BASE}?tab=intro`);
  await expect(page.locator('#ctrl-intro')).not.toHaveClass(/hidden/);
  await expect(page.locator('#tier1-blocks')).toHaveClass(/active/);
});

test('?tab=embed-fwd navigates to Embedding Forward', async ({ page }) => {
  await page.goto(`${BASE}?tab=embed-fwd`);
  await expect(page.locator('#ctrl-embed-fwd')).not.toHaveClass(/hidden/);
  await expect(page.locator('#tier1-embed')).toHaveClass(/active/);
});

test('?tab=embed-bwd navigates to Embedding Backward', async ({ page }) => {
  await page.goto(`${BASE}?tab=embed-bwd`);
  await expect(page.locator('#ctrl-embed-bwd')).not.toHaveClass(/hidden/);
  await expect(page.locator('#tier1-embed')).toHaveClass(/active/);
});

test('?preset=identity loads preset and navigates to matmul', async ({ page }) => {
  await page.goto(`${BASE}?preset=identity`);
  await expect(page.locator('#ctrl-matmul')).not.toHaveClass(/hidden/);
  const presetVal = await page.locator('#presetSelect').inputValue();
  expect(presetVal).toBe('identity');
  // Identity preset has default build mode 'dot'
  const activeMode = await page.evaluate(
    () => document.querySelector('#buildModeToggle .seg-active input')?.value
  );
  expect(activeMode).toBe('dot');
});

test('?preset=mask-upper loads correct matrices', async ({ page }) => {
  await page.goto(`${BASE}?preset=mask-upper`);
  const presetVal = await page.locator('#presetSelect').inputValue();
  expect(presetVal).toBe('mask-upper');
  // Verify description is visible
  await expect(page.locator('#presetDesc')).not.toHaveClass(/hidden/);
});

test('?mode=dot sets dot product build mode', async ({ page }) => {
  await page.goto(`${BASE}?tab=matmul&mode=dot`);
  const activeMode = await page.evaluate(
    () => document.querySelector('#buildModeToggle .seg-active input')?.value
  );
  expect(activeMode).toBe('dot');
});

test('?mode=outer sets outer product build mode', async ({ page }) => {
  await page.goto(`${BASE}?tab=matmul&mode=outer`);
  const activeMode = await page.evaluate(
    () => document.querySelector('#buildModeToggle .seg-active input')?.value
  );
  expect(activeMode).toBe('outer');
});

test('?preset=identity&mode=outer overrides preset default build mode', async ({ page }) => {
  // Identity preset defaults to 'dot', but mode=outer should override
  await page.goto(`${BASE}?preset=identity&mode=outer`);
  const presetVal = await page.locator('#presetSelect').inputValue();
  expect(presetVal).toBe('identity');
  const activeMode = await page.evaluate(
    () => document.querySelector('#buildModeToggle .seg-active input')?.value
  );
  expect(activeMode).toBe('outer');
});

test('no query params defaults to inner product tab', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('#ctrl-inner')).not.toHaveClass(/hidden/);
  await expect(page.locator('#tier1-blocks')).toHaveClass(/active/);
});

test('invalid preset is silently ignored', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}?preset=nonexistent`);
  // Should be on matmul tab (preset triggered navigation) but no preset selected
  await expect(page.locator('#ctrl-matmul')).not.toHaveClass(/hidden/);
  const presetVal = await page.locator('#presetSelect').inputValue();
  expect(presetVal).toBe('');
  expect(realErrors(errors)).toEqual([]);
});

test('all params combined: tab + preset + mode', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}?tab=matmul&preset=roll&mode=outer`);
  await expect(page.locator('#ctrl-matmul')).not.toHaveClass(/hidden/);
  const presetVal = await page.locator('#presetSelect').inputValue();
  expect(presetVal).toBe('roll');
  // roll defaults to 'dot', but mode=outer overrides
  const activeMode = await page.evaluate(
    () => document.querySelector('#buildModeToggle .seg-active input')?.value
  );
  expect(activeMode).toBe('outer');
  expect(realErrors(errors)).toEqual([]);
});
