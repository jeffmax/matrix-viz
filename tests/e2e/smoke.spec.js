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
  await expect(page.locator('#presetSelect')).toBeVisible();

  const options = page.locator('#presetSelect option');
  const count = await options.count();
  // First option is "Presets..." placeholder, rest are real presets
  expect(count).toBeGreaterThanOrEqual(11);

  // Select each preset via the dropdown
  for (let i = 1; i < count; i++) {
    const val = await options.nth(i).getAttribute('value');
    await page.locator('#presetSelect').selectOption(val);
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
    const sel = document.getElementById('presetSelect');
    if (sel && sel.options.length > 1) {
      sel.value = sel.options[1].value;
      sel.dispatchEvent(new Event('change'));
    }
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

  // Build mode segmented control should be visible
  await expect(page.locator('#buildModeToggle')).toBeVisible();

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

test('outer product build fills result grid', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.locator('#tier1-matmul').click();

  const resultCells = await page.evaluate(() => {
    // mmFwd throws on WebGL (paintBox), so call mmRenderResult directly after
    // advancing the step counter as far as we can
    for (let i = 0; i < 20; i++) { try { window.mmFwd(); } catch (e) { /* WebGL */ } }
    // Force result grid render (DOM-only, doesn't need WebGL)
    try { window.mmRenderResult(); } catch (e) { /* ignore */ }
    const grid = document.getElementById('mmResultGrid');
    return grid ? grid.querySelectorAll('.mat-cell').length : 0;
  });
  expect(resultCells).toBeGreaterThan(0);
  expect(realErrors(errors)).toEqual([]);
});

test('dot product mode starts with empty cube', async ({ page }) => {
  await page.goto(URL);
  await page.locator('#tier1-matmul').click();

  const result = await page.evaluate(() => {
    try { window.setBuildMode('dot'); } catch (e) { /* WebGL */ }
    const grid = document.getElementById('mmResultGrid');
    const cells = grid ? grid.querySelectorAll('.mat-cell') : [];
    const emptyCount = [...cells].filter(c => c.classList.contains('empty')).length;
    return { total: cells.length, empty: emptyCount };
  });
  expect(result.empty).toBe(result.total);
});

test('collapse scrub hides opDisplay', async ({ page }) => {
  await page.goto(URL);
  await page.locator('#tier1-matmul').click();

  const hidden = await page.evaluate(() => {
    for (let i = 0; i < 20; i++) { try { window.mmFwd(); } catch (e) { /* WebGL */ } }
    try { window.mmScrubCollapse(0.5); } catch (e) { /* WebGL */ }
    const op = document.getElementById('opDisplay');
    return op ? op.classList.contains('hidden') : true;
  });
  expect(hidden).toBe(true);
});

test('preset selection changes build mode', async ({ page }) => {
  await page.goto(URL);
  await page.locator('#tier1-matmul').click();

  const mode = await page.evaluate(() => {
    try { window.selectPreset('identity'); } catch (e) { /* WebGL */ }
    return document.querySelector('input[name="buildMode"]:checked')?.value;
  });
  expect(mode).toBe('dot');

  const mode2 = await page.evaluate(() => {
    try { window.selectPreset('outer'); } catch (e) { /* WebGL */ }
    return document.querySelector('input[name="buildMode"]:checked')?.value;
  });
  expect(mode2).toBe('outer');
});

test('cell selection shows sub-viz and hides opDisplay', async ({ page }) => {
  await page.goto(URL);
  await page.locator('#tier1-matmul').click();

  const result = await page.evaluate(() => {
    for (let i = 0; i < 20; i++) { try { window.mmFwd(); } catch (e) { /* WebGL */ } }
    try { window.mmJumpToCell(0, 0); } catch (e) { /* WebGL */ }
    const op = document.getElementById('opDisplay');
    const sub = document.getElementById('dpSubViz');
    return {
      opHidden: op ? op.classList.contains('hidden') : true,
      subVisible: sub ? sub.style.display !== 'none' : false
    };
  });
  expect(result.opHidden).toBe(true);
  expect(result.subVisible).toBe(true);
});
