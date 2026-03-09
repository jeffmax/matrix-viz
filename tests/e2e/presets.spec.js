import { test, expect } from '@playwright/test';

const URL = '/matmul-3d.html';

function realErrors(errors) {
  return errors.filter(e => !e.includes('WebGL'));
}

// ══════════════════════════════════════════════════════════════
// Expected data for every preset
// ══════════════════════════════════════════════════════════════
const PRESETS = [
  { id: 'basic',      mode: 'outer', I: 2, J: 3, K: 2, aCells: 6,  bCells: 6, resCells: 4, labelA: 'A',   labelB: 'B',  aFlat: ['1','2','3','4','5','6'],                             bFlat: ['7','8','9','10','11','12'],                resFlat: ['58','64','139','154'],                                       descSnippet: 'Standard multiplication' },
  { id: 'identity',   mode: 'dot',   I: 3, J: 3, K: 3, aCells: 9,  bCells: 9, resCells: 9, labelA: 'I',   labelB: 'B',  aFlat: ['1','0','0','0','1','0','0','0','1'],                  bFlat: ['5','3','1','8','6','2','4','7','9'],       resFlat: ['5','3','1','8','6','2','4','7','9'],                         descSnippet: 'Identity matrix' },
  { id: 'row-select', mode: 'dot',   I: 3, J: 3, K: 3, aCells: 9,  bCells: 9, resCells: 9, labelA: 'S',   labelB: 'B',  aFlat: ['0','0','1','1','0','0','0','0','1'],                  bFlat: ['5','3','1','8','6','2','4','7','9'],       resFlat: ['4','7','9','5','3','1','4','7','9'],                         descSnippet: 'Row selection' },
  { id: 'permute',    mode: 'dot',   I: 3, J: 3, K: 3, aCells: 9,  bCells: 9, resCells: 9, labelA: 'P',   labelB: 'B',  aFlat: ['0','0','1','0','1','0','1','0','0'],                  bFlat: ['1','2','3','4','5','6','7','8','9'],       resFlat: ['7','8','9','4','5','6','1','2','3'],                         descSnippet: 'Permutation matrix' },
  { id: 'sum-rows',   mode: 'outer', I: 1, J: 3, K: 2, aCells: 3,  bCells: 6, resCells: 2, labelA: '𝟏ᵀ',  labelB: 'B',  aFlat: ['1','1','1'],                                         bFlat: ['1','2','3','4','5','6'],                  resFlat: ['9','12'],                                                    descSnippet: 'Row sum' },
  { id: 'sum-cols',   mode: 'outer', I: 3, J: 3, K: 1, aCells: 9,  bCells: 3, resCells: 3, labelA: 'B',   labelB: '𝟏',  aFlat: ['1','2','3','4','5','6','7','8','9'],                  bFlat: ['1','1','1'],                              resFlat: ['6','15','24'],                                               descSnippet: 'Column sum' },
  { id: 'average',    mode: 'outer', I: 1, J: 3, K: 2, aCells: 3,  bCells: 6, resCells: 2, labelA: 'avg', labelB: 'B',  aFlat: ['0.33','0.33','0.33'],                                bFlat: ['3','6','9','12','6','3'],                 resFlat: null, /* floating point — check within tolerance */             descSnippet: 'Row average' },
  { id: 'mask-upper', mode: 'outer', I: 4, J: 4, K: 2, aCells: 16, bCells: 8, resCells: 8, labelA: 'L',   labelB: 'B',  aFlat: ['1','0','0','0','1','1','0','0','1','1','1','0','1','1','1','1'], bFlat: ['1','2','3','4','5','6','7','8'], resFlat: ['1','2','4','6','9','12','16','20'],                          descSnippet: 'Causal mask' },
  { id: 'projection', mode: 'dot',   I: 3, J: 3, K: 1, aCells: 9,  bCells: 3, resCells: 3, labelA: 'P',   labelB: 'v',  aFlat: ['1','0','0','0','0','0','0','0','1'],                  bFlat: ['3','7','5'],                              resFlat: ['3','0','5'],                                                 descSnippet: 'Projection' },
  { id: 'outer',      mode: 'outer', I: 3, J: 1, K: 3, aCells: 3,  bCells: 3, resCells: 9, labelA: 'a',   labelB: 'bᵀ', aFlat: ['1','2','3'],                                         bFlat: ['4','5','6'],                              resFlat: ['4','5','6','8','10','12','12','15','18'],                     descSnippet: 'Outer product' },
  { id: 'roll',       mode: 'dot',   I: 4, J: 4, K: 1, aCells: 16, bCells: 4, resCells: 4, labelA: 'R',   labelB: 'v',  aFlat: ['0','0','0','1','1','0','0','0','0','1','0','0','0','0','1','0'], bFlat: ['10','20','30','40'],             resFlat: ['40','10','20','30'],                                         descSnippet: 'Circular shift' },
];

// Helper: navigate to matmul tab
async function gotoMatmul(page) {
  await page.goto(URL);
  await page.locator('#tier1-matmul').click();
  await expect(page.locator('#ctrl-matmul')).not.toHaveClass(/hidden/);
}

// ══════════════════════════════════════════════════════════════
// TEST: Each preset loads correctly with right matrices and desc
// ══════════════════════════════════════════════════════════════
for (const preset of PRESETS) {
  test(`preset "${preset.id}" loads correct matrices and description`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await gotoMatmul(page);

    const result = await page.evaluate((id) => {
      try { window.selectPreset(id); } catch (e) {}
      const aGrid = document.getElementById('gridA');
      const bGrid = document.getElementById('gridB');
      const aVals = aGrid ? [...aGrid.querySelectorAll('.mat-cell')].map(c => c.textContent.trim()) : [];
      const bVals = bGrid ? [...bGrid.querySelectorAll('.mat-cell')].map(c => c.textContent.trim()) : [];
      const mode = document.querySelector('input[name="buildMode"]:checked')?.value;
      const desc = document.getElementById('presetDesc')?.textContent || '';
      const descHidden = document.getElementById('presetDesc')?.classList.contains('hidden');
      const titleA = document.getElementById('mmTitleA')?.textContent || '';
      const titleB = document.getElementById('mmTitleB')?.textContent || '';
      const resultGrid = document.getElementById('mmResultGrid');
      const resCells = resultGrid ? resultGrid.querySelectorAll('.mat-cell').length : 0;
      const resDone = resultGrid ? resultGrid.querySelectorAll('.mat-cell.done').length : 0;
      const slider = document.getElementById('spCollapse');
      const sliderDisabled = slider ? slider.disabled : true;
      const subViz = document.getElementById('dpSubViz');
      const subVizHidden = subViz ? subViz.style.display === 'none' : true;
      return { aVals, bVals, mode, desc, descHidden, titleA, titleB, resCells, resDone, sliderDisabled, subVizHidden };
    }, preset.id);

    // Matrix values match
    expect(result.aVals).toEqual(preset.aFlat);
    expect(result.bVals).toEqual(preset.bFlat);
    // Build mode matches
    expect(result.mode).toBe(preset.mode);
    // Description visible and contains snippet
    expect(result.descHidden).toBe(false);
    expect(result.desc).toContain(preset.descSnippet);
    // Matrix labels match
    expect(result.titleA).toBe(preset.labelA);
    expect(result.titleB).toBe(preset.labelB);
    // Result grid has correct cell count, all empty (no done)
    expect(result.resCells).toBe(preset.resCells);
    expect(result.resDone).toBe(0);
    // Slider disabled, sub-viz hidden
    expect(result.sliderDisabled).toBe(true);
    expect(result.subVizHidden).toBe(true);
    expect(realErrors(errors)).toEqual([]);
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Each preset completes build with correct result values
// ══════════════════════════════════════════════════════════════
for (const preset of PRESETS) {
  test(`preset "${preset.id}" build completes with correct results`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await gotoMatmul(page);

    const result = await page.evaluate((id) => {
      try { window.selectPreset(id); } catch (e) {}
      // Step through all steps
      const maxSteps = 100; // more than enough for any preset
      for (let i = 0; i < maxSteps; i++) { try { window.mmFwd(); } catch (e) {} }

      const grid = document.getElementById('mmResultGrid');
      const cells = grid ? grid.querySelectorAll('.mat-cell') : [];
      const vals = [...cells].map(c => c.textContent.trim());
      const doneCells = grid ? grid.querySelectorAll('.mat-cell.done').length : 0;
      const slider = document.getElementById('spCollapse');
      const sliderEnabled = slider ? !slider.disabled : false;
      const formula = document.getElementById('fMM')?.textContent || '';
      const title = document.getElementById('canvasTitle')?.textContent || '';
      return { vals, doneCells, totalCells: cells.length, sliderEnabled, formula, title };
    }, preset.id);

    // All cells should be done
    expect(result.totalCells).toBe(preset.resCells);
    expect(result.doneCells).toBe(preset.resCells);
    // Slider should be enabled after build
    expect(result.sliderEnabled).toBe(true);
    // Formula should indicate completion
    if (preset.mode === 'outer') {
      expect(result.formula).toContain('slices built');
    } else {
      expect(result.formula).toContain('cells computed');
    }
    // Result values match (skip average due to floating point)
    if (preset.resFlat) {
      expect(result.vals).toEqual(preset.resFlat);
    }
    expect(realErrors(errors)).toEqual([]);
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Dot product presets show sub-viz during build
// ══════════════════════════════════════════════════════════════
const DP_PRESETS = PRESETS.filter(p => p.mode === 'dot');
for (const preset of DP_PRESETS) {
  test(`preset "${preset.id}" (dot) shows sub-viz during build`, async ({ page }) => {
    await gotoMatmul(page);

    const result = await page.evaluate((id) => {
      try { window.selectPreset(id); } catch (e) {}
      // Step once
      try { window.mmFwd(); } catch (e) {}

      const subViz = document.getElementById('dpSubViz');
      const subVisible = subViz ? subViz.style.display !== 'none' : false;
      const subContent = subViz ? subViz.textContent : '';
      // Formula should mention Result[0,0]
      const formula = document.getElementById('fMM')?.textContent || '';
      // Step dots should exist
      const dots = document.querySelectorAll('#dMM .step-dot');
      const curDots = document.querySelectorAll('#dMM .step-dot.cur');
      return { subVisible, subContent, formula, totalDots: dots.length, curDots: curDots.length };
    }, preset.id);

    expect(result.subVisible).toBe(true);
    expect(result.subContent).toContain('Row 0');
    expect(result.formula).toContain('Result[0');
    expect(result.totalDots).toBe(preset.resCells);
    expect(result.curDots).toBe(1);
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Outer product presets show partial sums during build
// ══════════════════════════════════════════════════════════════
const OP_PRESETS = PRESETS.filter(p => p.mode === 'outer');
for (const preset of OP_PRESETS) {
  test(`preset "${preset.id}" (outer) shows partial sums during build`, async ({ page }) => {
    await gotoMatmul(page);

    const result = await page.evaluate((id) => {
      try { window.selectPreset(id); } catch (e) {}
      // Step once — first j-slice
      try { window.mmFwd(); } catch (e) {}

      const grid = document.getElementById('mmResultGrid');
      const partialCells = grid ? grid.querySelectorAll('.mat-cell.partial').length : 0;
      // Formula should mention slice
      const formula = document.getElementById('fMM')?.textContent || '';
      // Step dots should exist
      const dots = document.querySelectorAll('#dMM .step-dot');
      return { partialCells, formula, totalDots: dots.length };
    }, preset.id);

    // After one step, result grid should have partial or done cells (done if J=1)
    if (preset.J === 1) {
      // Single slice — build completes on first step
      expect(result.partialCells).toBe(0);
    } else {
      expect(result.partialCells).toBe(preset.resCells);
    }
    // Step dots = J slices
    expect(result.totalDots).toBe(preset.J);
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Switching between every adjacent pair of presets resets properly
// ══════════════════════════════════════════════════════════════
for (let idx = 0; idx < PRESETS.length - 1; idx++) {
  const from = PRESETS[idx];
  const to = PRESETS[idx + 1];
  test(`switching "${from.id}" → "${to.id}" resets state cleanly`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await gotoMatmul(page);

    const result = await page.evaluate(({ fromId, toId, toResCells }) => {
      // Load first preset and step through partially or fully
      try { window.selectPreset(fromId); } catch (e) {}
      for (let i = 0; i < 50; i++) { try { window.mmFwd(); } catch (e) {} }

      // Switch to next preset
      try { window.selectPreset(toId); } catch (e) {}

      // Verify clean state
      const grid = document.getElementById('mmResultGrid');
      const doneCells = grid ? grid.querySelectorAll('.mat-cell.done').length : 0;
      const curCells = grid ? grid.querySelectorAll('.mat-cell.cur').length : 0;
      const totalCells = grid ? grid.querySelectorAll('.mat-cell').length : 0;

      const aGrid = document.getElementById('gridA');
      const aCells = aGrid ? aGrid.querySelectorAll('.mat-cell').length : 0;

      const mode = document.querySelector('input[name="buildMode"]:checked')?.value;
      const slider = document.getElementById('spCollapse');
      const sliderDisabled = slider ? slider.disabled : true;
      const subViz = document.getElementById('dpSubViz');
      const subVizHidden = subViz ? subViz.style.display === 'none' : true;
      const opDisplay = document.getElementById('opDisplay');
      const opHidden = opDisplay ? opDisplay.classList.contains('hidden') : true;
      const desc = document.getElementById('presetDesc')?.textContent || '';

      return { doneCells, curCells, totalCells, aCells, mode, sliderDisabled, subVizHidden, opHidden, desc };
    }, { fromId: from.id, toId: to.id, toResCells: to.resCells });

    // No stale done/cur cells
    expect(result.doneCells).toBe(0);
    expect(result.curCells).toBe(0);
    // Correct cell counts for new preset
    expect(result.totalCells).toBe(to.resCells);
    expect(result.aCells).toBe(to.aCells);
    // Mode matches new preset
    expect(result.mode).toBe(to.mode);
    // Slider disabled, sub-viz hidden, op hidden
    expect(result.sliderDisabled).toBe(true);
    expect(result.subVizHidden).toBe(true);
    expect(result.opHidden).toBe(true);
    // Description matches new preset
    expect(result.desc).toContain(to.descSnippet);
    expect(realErrors(errors)).toEqual([]);
  });
}

// ══════════════════════════════════════════════════════════════
// TEST: Build → complete → switch preset → build again works
// ══════════════════════════════════════════════════════════════
test('complete build, switch preset, complete second build', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await gotoMatmul(page);

  const result = await page.evaluate(() => {
    // Build identity (dot, 3×3)
    try { window.selectPreset('identity'); } catch (e) {}
    for (let i = 0; i < 20; i++) { try { window.mmFwd(); } catch (e) {} }
    const firstResult = [...document.getElementById('mmResultGrid').querySelectorAll('.mat-cell')].map(c => c.textContent.trim());

    // Switch to basic (outer, 2×3·3×2)
    try { window.selectPreset('basic'); } catch (e) {}
    for (let i = 0; i < 20; i++) { try { window.mmFwd(); } catch (e) {} }
    const secondResult = [...document.getElementById('mmResultGrid').querySelectorAll('.mat-cell')].map(c => c.textContent.trim());
    const secondDone = document.getElementById('mmResultGrid').querySelectorAll('.mat-cell.done').length;

    // Switch to roll (dot, 4×4·4×1)
    try { window.selectPreset('roll'); } catch (e) {}
    for (let i = 0; i < 20; i++) { try { window.mmFwd(); } catch (e) {} }
    const thirdResult = [...document.getElementById('mmResultGrid').querySelectorAll('.mat-cell')].map(c => c.textContent.trim());
    const thirdDone = document.getElementById('mmResultGrid').querySelectorAll('.mat-cell.done').length;

    return { firstResult, secondResult, secondDone, thirdResult, thirdDone };
  });

  expect(result.firstResult).toEqual(['5','3','1','8','6','2','4','7','9']);
  expect(result.secondResult).toEqual(['58','64','139','154']);
  expect(result.secondDone).toBe(4);
  expect(result.thirdResult).toEqual(['40','10','20','30']);
  expect(result.thirdDone).toBe(4);
  expect(realErrors(errors)).toEqual([]);
});

// ══════════════════════════════════════════════════════════════
// TEST: Exploration mode works after DP build
// ══════════════════════════════════════════════════════════════
test('exploration mode after identity build shows correct sub-viz', async ({ page }) => {
  await gotoMatmul(page);

  const result = await page.evaluate(() => {
    try { window.selectPreset('identity'); } catch (e) {}
    for (let i = 0; i < 20; i++) { try { window.mmFwd(); } catch (e) {} }

    // Click cell [1,2] — result should be 2 (I*B = B, so B[1][2] = 2)
    try { window.mmJumpToCell(1, 2); } catch (e) {}

    const subViz = document.getElementById('dpSubViz');
    const subVisible = subViz ? subViz.style.display !== 'none' : false;
    const subContent = subViz ? subViz.textContent : '';
    const resultGrid = document.getElementById('mmResultGrid');
    const curCell = resultGrid ? resultGrid.querySelector('.mat-cell.cur') : null;
    const curVal = curCell ? curCell.textContent.trim() : '';

    return { subVisible, subContent, curVal };
  });

  expect(result.subVisible).toBe(true);
  expect(result.subContent).toContain('Row 1');
  expect(result.subContent).toContain('Column 2');
  expect(result.curVal).toBe('2');
});

// ══════════════════════════════════════════════════════════════
// TEST: Average preset result is close to expected (floating point)
// ══════════════════════════════════════════════════════════════
test('average preset produces approximately correct results', async ({ page }) => {
  await gotoMatmul(page);

  const result = await page.evaluate(() => {
    try { window.selectPreset('average'); } catch (e) {}
    for (let i = 0; i < 20; i++) { try { window.mmFwd(); } catch (e) {} }
    const grid = document.getElementById('mmResultGrid');
    return [...grid.querySelectorAll('.mat-cell')].map(c => parseFloat(c.textContent.trim()));
  });

  // avg * B = [0.33*3+0.33*9+0.33*6, 0.33*6+0.33*12+0.33*3] ≈ [5.94, 6.93]
  expect(result.length).toBe(2);
  expect(result[0]).toBeCloseTo(5.94, 1);
  expect(result[1]).toBeCloseTo(6.93, 1);
});
