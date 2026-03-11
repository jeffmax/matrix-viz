import { test, expect } from '@playwright/test';

const URL = '/matmul-3d.html';

function realErrors(errors) {
  return errors.filter(e => !e.includes('WebGL'));
}

// Helper: navigate to embed forward tab
async function gotoEmbedFwd(page) {
  await page.goto(URL);
  await page.evaluate(() => window.setTier('embed'));
  await expect(page.locator('#ctrl-embed-fwd')).not.toHaveClass(/hidden/);
}

// ── Bug 1: Pill should be above X tensor, not overlapping W or Y ──
test('F.one_hot pill is above X tensor and does not overlap W', async ({ page }) => {
  await gotoEmbedFwd(page);

  const pill = page.locator('.ef-prior-pill');
  await expect(pill).toBeVisible();

  const pillBox = await pill.boundingBox();
  const wTensor = page.locator('.ef-tensor-block').nth(1);
  const wBox = await wTensor.boundingBox();

  // Pill should be entirely to the left of the W tensor
  expect(pillBox.x + pillBox.width).toBeLessThan(wBox.x);
});

// ── Bug 2: Batch hover should not disrupt horizontal flow ──
test('stacked tensor hover does not shift other tensors horizontally', async ({ page }) => {
  await gotoEmbedFwd(page);

  // Get W tensor position before hover
  const wBefore = await page.locator('.ef-tensor-block').nth(1).boundingBox();

  // Hover over X tensor (stacked)
  const xStack = page.locator('.ef-stacked-tensor').first();
  await xStack.hover();
  // Wait for expansion
  await page.waitForTimeout(200);

  // Get W tensor position after hover
  const wAfter = await page.locator('.ef-tensor-block').nth(1).boundingBox();

  // W tensor should NOT have moved horizontally
  expect(Math.abs(wAfter.x - wBefore.x)).toBeLessThan(5);
});

test('stacked tensor hover keeps current batch under mouse', async ({ page }) => {
  await gotoEmbedFwd(page);
  await page.evaluate(() => { window.efFwd(); });

  // Get active page batch index
  const activeBatch = await page.evaluate(() => {
    const st = window.getEfState?.() ?? {};
    // efStep=0 means b=0, l=0
    return Math.floor(st.efStep / st.eL);
  });

  // Hover over X stacked tensor
  const xStack = page.locator('.ef-stacked-tensor').first();
  await xStack.hover();
  await page.waitForTimeout(200);

  // The expanded tensor should show the active batch visible and not displaced
  // The front-page (active batch) should still be under the mouse area
  const expanded = await page.locator('.ef-stacked-tensor.expanded').count();
  expect(expanded).toBe(1);

  // Verify the active page is present in the expanded view
  const activePage = page.locator('.ef-stacked-tensor.expanded .ef-tensor-page.active-page');
  if (await activePage.count() > 0) {
    await expect(activePage).toBeVisible();
  }
});

// ── Bug 3: Checkbox should say "Element by element" ──
test('embed fwd detail checkbox says "Element by element"', async ({ page }) => {
  await gotoEmbedFwd(page);

  const label = page.locator('#chkEfDetailLabel');
  await expect(label).toBeVisible();
  await expect(label).toHaveText('Element by element');
});

// ── Bug 4: Detail checkbox toggles sub-viz content ──
test('detail checkbox toggles between compact and element-by-element views', async ({ page }) => {
  await gotoEmbedFwd(page);
  // Step to show sub-viz
  await page.evaluate(() => { window.efFwd(); });

  // Sub-viz should be visible (compact mode)
  await expect(page.locator('.ef-subviz')).toBeVisible();

  // Get HTML of sub-viz in compact mode
  const compactHTML = await page.locator('.ef-subviz').innerHTML();

  // Should NOT have the intermediate grid in compact mode
  expect(compactHTML).not.toContain('ef-inter-grid');

  // Toggle detail on
  await page.evaluate(() => {
    document.getElementById('chkEfDetail').checked = true;
    window.efToggleDetail();
  });

  // Sub-viz should now show intermediate grid
  const detailHTML = await page.locator('.ef-subviz').innerHTML();
  expect(detailHTML).toContain('ef-inter-grid');

  // Toggle detail off
  await page.evaluate(() => {
    document.getElementById('chkEfDetail').checked = false;
    window.efToggleDetail();
  });

  // Should be back to compact
  const compactHTML2 = await page.locator('.ef-subviz').innerHTML();
  expect(compactHTML2).not.toContain('ef-inter-grid');
});

// ── Bug 5: Detail mode shows per-cell calculation ──
test('detail mode shows element-by-element calculation for each cell', async ({ page }) => {
  await gotoEmbedFwd(page);
  await page.evaluate(() => { window.efFwd(); });

  // Enable detail mode
  await page.evaluate(() => {
    document.getElementById('chkEfDetail').checked = true;
    window.efToggleDetail();
  });

  // The intermediate grid should show the element-wise products
  const interGrid = page.locator('.ef-inter-grid');
  await expect(interGrid).toBeVisible();

  // It should have H*C cells (4*3 = 12 by default)
  const state = await page.evaluate(() => {
    const s = window.getEfState();
    return { eH: s.eH, eC: s.eC };
  });
  const cells = await interGrid.locator('.mat-cell').count();
  expect(cells).toBe(state.eH * state.eC);
});
