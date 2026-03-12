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

test('stacked tensor hover keeps batch 0 under mouse when batch 0 is active', async ({ page }) => {
  await gotoEmbedFwd(page);
  // Step forward — step 0 = batch 0
  await page.evaluate(() => { window.efFwd(); });

  // Get the X stacked tensor's first anchor
  const anchor = page.locator('.ef-stacked-anchor').first();
  // Get the front-page (active page) position before hover
  const frontPage = anchor.locator('.ef-tensor-page.front-page');
  const beforeBox = await frontPage.boundingBox();

  // Hover to expand
  await anchor.hover();
  await page.waitForTimeout(200);

  // After expand, the active page should not have shifted vertically
  const afterBox = await frontPage.boundingBox();
  expect(Math.abs(afterBox.y - beforeBox.y)).toBeLessThan(5);
});

test('stacked tensor hover keeps batch 1 under mouse when batch 1 is active', async ({ page }) => {
  await gotoEmbedFwd(page);
  // Jump to position 3 = batch 1, t=0 (with eT=3)
  await page.evaluate(() => { window.efJumpToPos(3); });

  const anchor = page.locator('.ef-stacked-anchor').first();
  // Get the front-page (batch 1) position before hover
  const frontPage = anchor.locator('.ef-tensor-page.front-page');
  const beforeBox = await frontPage.boundingBox();

  // Hover to expand
  await anchor.hover();
  await page.waitForTimeout(200);

  // After expand, batch 1 should not have shifted vertically
  const afterBox = await frontPage.boundingBox();
  expect(Math.abs(afterBox.y - beforeBox.y)).toBeLessThan(5);
});

test('expanded tensor shows pages in correct order relative to active page', async ({ page }) => {
  await gotoEmbedFwd(page);
  // Jump to batch 1
  await page.evaluate(() => { window.efJumpToPos(3); });

  const anchor = page.locator('.ef-stacked-anchor').first();
  await anchor.hover();
  await page.waitForTimeout(200);

  // In expanded view, batch 0 should be ABOVE batch 1
  const pages = page.locator('.ef-stacked-tensor.expanded .ef-tensor-page');
  const count = await pages.count();
  expect(count).toBe(2);

  // Get vertical positions of each page
  const boxes = [];
  for (let i = 0; i < count; i++) {
    const box = await pages.nth(i).boundingBox();
    const header = await pages.nth(i).locator('.ef-page-header').textContent();
    boxes.push({ y: box.y, header });
  }

  // batch 0 should be above batch 1 (lower y value)
  const b0 = boxes.find(b => b.header.includes('b=0'));
  const b1 = boxes.find(b => b.header.includes('b=1'));
  expect(b0.y).toBeLessThan(b1.y);
});

// ── Bug 3: Checkbox should say "Element by element" ──
test('embed fwd detail checkbox says "Element by element"', async ({ page }) => {
  await gotoEmbedFwd(page);

  const label = page.locator('#chkEfDetailLabel');
  await expect(label).toBeVisible();
  await expect(label).toHaveText('Element by element');
});

// ── Bug 4: Detail checkbox toggles sub-viz content ──
test('detail checkbox toggles between dot-product and compact views', async ({ page }) => {
  await gotoEmbedFwd(page);
  // Step to show sub-viz — detail mode is on by default
  await page.evaluate(() => { window.efFwd(); });

  // Sub-viz should be visible with dot-product columns (detail mode default)
  await expect(page.locator('.ef-subviz')).toBeVisible();
  const detailHTML = await page.locator('.ef-subviz').innerHTML();
  expect(detailHTML).toContain('ef-dot-products');
  expect(detailHTML).not.toContain('ef-w-grid');

  // Toggle detail off → compact mode
  await page.evaluate(() => {
    document.getElementById('chkEfDetail').checked = false;
    window.efToggleDetail();
  });

  const compactHTML = await page.locator('.ef-subviz').innerHTML();
  expect(compactHTML).toContain('ef-w-grid');
  expect(compactHTML).not.toContain('ef-dot-products');

  // Toggle detail on → back to dot-product view
  await page.evaluate(() => {
    document.getElementById('chkEfDetail').checked = true;
    window.efToggleDetail();
  });

  const detailHTML2 = await page.locator('.ef-subviz').innerHTML();
  expect(detailHTML2).toContain('ef-dot-products');
});

// ── Bug 5: Detail mode shows dot-product breakdown ──
test('detail mode shows dot-product columns with products and sums', async ({ page }) => {
  await gotoEmbedFwd(page);
  await page.evaluate(() => { window.efFwd(); });

  // Detail mode is on by default — should show dot-product columns
  const state = await page.evaluate(() => {
    const s = window.getEfState();
    return { eV: s.eV, eC: s.eC, tok: s.tokenIds[0][0] };
  });

  // Should have eC dot-product columns
  const dotCols = page.locator('.ef-dot-col');
  await expect(dotCols).toHaveCount(state.eC);

  // Each column has row vector (eV cells) and column vector (eV cells)
  const col0 = dotCols.first();
  const rowVec = col0.locator('.dp-sub-viz-vec:not(.col) .mat-cell');
  await expect(rowVec).toHaveCount(state.eV);
  const colVec = col0.locator('.dp-sub-viz-vec.col .mat-cell');
  await expect(colVec).toHaveCount(state.eV);

  // Products line: eV terms, exactly 1 cur and eV-1 dim
  const curProds = col0.locator('.dp-term-prod.cur');
  await expect(curProds).toHaveCount(1);
  const dimProds = col0.locator('.dp-term-prod.dim');
  await expect(dimProds).toHaveCount(state.eV - 1);

  // Sum line exists
  const accum = col0.locator('.dp-accum');
  await expect(accum).toHaveCount(1);

  // Insight callout should mention row selection
  const insight = page.locator('.ef-term-insight');
  await expect(insight).toBeVisible();
  await expect(insight).toContainText('selects row');
});

// ── Bug 6: Detail mode steps same as compact (per position, not per h) ──
test('detail mode does not add extra steps per v element', async ({ page }) => {
  await gotoEmbedFwd(page);

  const state = await page.evaluate(() => {
    const s = window.getEfState();
    return { eB: s.eB, eT: s.eT, eV: s.eV };
  });

  // Step through all positions — should be eB*eT steps total, not eB*eT*eV
  const totalPositions = state.eB * state.eT;

  for (let i = 0; i < totalPositions; i++) {
    await page.evaluate(() => { window.efFwd(); });
  }

  // Should be at the last position
  const finalStep = await page.evaluate(() => window.getEfState().efStep);
  expect(finalStep).toBe(totalPositions - 1);

  // One more step should NOT advance further
  await page.evaluate(() => { window.efFwd(); });
  const noAdvance = await page.evaluate(() => window.getEfState().efStep);
  expect(noAdvance).toBe(totalPositions - 1);

  // Step dots should match position count, not position*eV count
  const dotCount = await page.locator('#dEF .step-dot').count();
  expect(dotCount).toBe(totalPositions);
});

// ── Bug 7: Stacked tensor hover should work after play completes ──
test('stacked tensor hover works after play finishes', async ({ page }) => {
  await gotoEmbedFwd(page);

  // Play and wait for it to finish
  await page.evaluate(() => { window.efToggle(); });
  // Wait for play to complete — 6 positions at minimum speed
  await page.waitForFunction(() => !window.getEfState().efPlaying, { timeout: 15000 });

  // After play, stacked tensors should have expandable class
  const expandableCount = await page.locator('.ef-stacked-tensor.expandable').count();
  expect(expandableCount).toBeGreaterThan(0);

  // Hover should expand the tensor
  const anchor = page.locator('.ef-stacked-anchor').first();
  await anchor.hover();
  await page.waitForTimeout(200);

  const expandedCount = await page.locator('.ef-stacked-tensor.expanded').count();
  expect(expandedCount).toBe(1);
});
