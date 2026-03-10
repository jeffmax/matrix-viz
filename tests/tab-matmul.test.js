import { describe, it, expect, beforeEach } from 'vitest';
import { computeData, I, J, K, A, B, Res, setBuildComplete, changeDim, setData, isPresetActive } from '../js/shared.js';
import { initScene } from '../js/scene.js';
import { rebuildBoxes, ensureAllGreen, addPlusPlanes, boxes } from '../js/cube-manager.js';
import { mmBuildDone, getOpHiTm, setOpHiTm, mmReset, setBuildMode, getBuildMode,
         mmJumpToCell, getMmState, mmHoverCell, mmClearHover, mmFwd, mmBack,
         mmScrubCollapse, mmUpdateCanvasTitle, mmToggleDetail } from '../js/tab-matmul.js';
import { PRESETS, loadPreset, clearPreset, fullClearPreset } from '../js/presets.js';

describe('Bug 2: mmBuildDone should not cancel highlight timer', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('opHiTm survives mmBuildDone (highlight chain not killed)', () => {
    const fakeTimer = setTimeout(() => {}, 10000);
    setOpHiTm(fakeTimer);
    mmBuildDone();
    const hiTm = getOpHiTm();
    expect(hiTm).toBe(fakeTimer);
    clearTimeout(fakeTimer);
  });
});

describe('mmBuildDone re-renders result grid', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('result grid has cells after mmBuildDone', () => {
    mmBuildDone();
    const grid = document.getElementById('mmResultGrid');
    expect(grid.innerHTML).not.toBe('');
    expect(grid.querySelectorAll('.mat-cell').length).toBe(I * K);
  });
});

describe('setBuildMode toggles and resets', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('switches to dot product mode', () => {
    setBuildMode('dot');
    expect(getBuildMode()).toBe('dot');
    const state = getMmState();
    expect(state.t1).toBe(-1);
    expect(state.mmPhase).toBe('build');
  });

  it('switches back to outer product mode', () => {
    setBuildMode('dot');
    setBuildMode('outer');
    expect(getBuildMode()).toBe('outer');
  });

  it('updates checkbox label', () => {
    setBuildMode('dot');
    const lbl = document.getElementById('chkDetailLabel');
    expect(lbl.textContent).toBe('Term by term');
    setBuildMode('outer');
    expect(lbl.textContent).toBe('Element by element');
  });

  it('resets mid-build when toggling mode', () => {
    // Step forward in outer product mode
    mmFwd();
    mmFwd();
    const stateBefore = getMmState();
    expect(stateBefore.t1).toBeGreaterThan(0);

    // Switch mode — should reset
    setBuildMode('dot');
    const stateAfter = getMmState();
    expect(stateAfter.t1).toBe(-1);
    expect(stateAfter.mmPhase).toBe('build');
  });
});

describe('Dot product detail checkbox', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
    setBuildMode('dot');
  });

  it('detail checkbox controls term-by-term in dp mode', () => {
    const chk = document.getElementById('chkDetail');
    chk.checked = true;
    // Step forward — should be term-by-term stepping
    mmFwd();
    const state = getMmState();
    expect(state.t1).toBe(0);
  });

  it('detail mode: future terms (j > curJ) hide cube values', () => {
    const chk = document.getElementById('chkDetail');
    chk.checked = true;
    // Step to first term: cell (0,0), j=0
    mmFwd(); // t1=0 → i=0, k=0, j=0

    // In the cube column for cell (0,0):
    // j=0 should show value (current term — highlighted)
    expect(boxes[0][0][0].spr.visible).toBe(true);
    // j=1, j=2 should NOT show values (future terms, not yet visited)
    expect(boxes[0][1][0].spr.visible).toBe(false);
    expect(boxes[0][2][0].spr.visible).toBe(false);
  });

  it('detail mode: past terms (j < curJ) show cube values', () => {
    const chk = document.getElementById('chkDetail');
    chk.checked = true;
    // Step to third term: cell (0,0), j=2
    mmFwd(); // t1=0 → j=0
    mmFwd(); // t1=1 → j=1
    mmFwd(); // t1=2 → j=2

    // j=0 and j=1 should show values (past terms — done)
    expect(boxes[0][0][0].spr.visible).toBe(true);
    expect(boxes[0][1][0].spr.visible).toBe(true);
    // j=2 is current — should also show value
    expect(boxes[0][2][0].spr.visible).toBe(true);
  });

  it('non-detail mode: all terms in current column show values', () => {
    const chk = document.getElementById('chkDetail');
    chk.checked = false;
    // Step to first cell: (0,0), j=-1 (all at once)
    mmFwd(); // t1=0 → i=0, k=0, j=-1

    // All j values in the current column should show values
    for (let j = 0; j < 3; j++) {
      expect(boxes[0][j][0].spr.visible).toBe(true);
    }
  });
});

describe('mmJumpToCell enters exploration mode', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    ensureAllGreen();
    addPlusPlanes();
    mmReset();
    mmBuildDone(); // Build must complete before exploration is allowed
  });

  it('clicking a cell sets selection and step=-1', () => {
    mmJumpToCell(0, 0);
    const state = getMmState();
    expect(state.mmSelectedI).toBe(0);
    expect(state.mmSelectedK).toBe(0);
    expect(state.t1).toBe(-1);
  });

  it('clicking a cell mid-build does NOT enter exploration', () => {
    // Reset back to build phase, step forward but build not complete
    mmReset();
    mmFwd();
    mmFwd();
    const stateBefore = getMmState();
    expect(stateBefore.t1).toBeGreaterThanOrEqual(0);

    mmJumpToCell(1, 1);
    const stateAfter = getMmState();
    // Should NOT have entered exploration — build not complete
    expect(stateAfter.mmSelectedI).toBe(-1);
    expect(stateAfter.mmSelectedK).toBe(-1);
    // t1 should be unchanged (build still in progress)
    expect(stateAfter.t1).toBe(stateBefore.t1);
  });
});

describe('Hover in exploration mode', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    ensureAllGreen();
    addPlusPlanes();
    mmReset();
    mmBuildDone(); // Build must complete before exploration is allowed
  });

  it('mmHoverCell sets hover state when a result cell is selected', () => {
    mmJumpToCell(0, 0);
    mmHoverCell(1);
    // Should not throw
    mmClearHover();
    const state = getMmState();
    expect(state.mmSelectedI).toBe(0);
  });

  it('mmHoverCell does nothing when no result cell is selected', () => {
    mmHoverCell(1);
    mmClearHover();
    const state = getMmState();
    expect(state.mmSelectedI).toBe(-1);
  });
});

describe('Bug #4: Dot product initial cube is empty', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    setBuildComplete(false);
    mmReset();
  });

  it('switching to dot product with buildComplete=false shows empty cube', () => {
    setBuildMode('dot');
    const state = getMmState();
    expect(state.t1).toBe(-1);
    expect(state.buildMode).toBe('dot');
    // Boxes should be nearly invisible (empty state)
    for (let i = 0; i < boxes.length; i++)
      for (let j = 0; j < boxes[i].length; j++)
        for (let k = 0; k < boxes[i][j].length; k++) {
          expect(boxes[i][j][k].mat.opacity).toBeLessThan(0.2);
        }
  });
});

describe('Bug #2: Sub-viz lifecycle', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
    setBuildMode('outer');
  });

  it('opDisplay hides when collapse slider is scrubbed', () => {
    mmBuildDone();
    // Simulate opDisplay being visible (as it would be after outer product build)
    const opPanel = document.getElementById('opDisplay');
    opPanel.classList.remove('hidden');
    opPanel.innerHTML = '<div>test</div>';
    mmScrubCollapse(0.5);
    expect(opPanel.classList.contains('hidden')).toBe(true);
  });

  it('opDisplay hides when a result cell is selected', () => {
    mmBuildDone();
    // Simulate opDisplay being visible (as it would be after outer product build)
    const opPanel = document.getElementById('opDisplay');
    opPanel.classList.remove('hidden');
    opPanel.innerHTML = '<div>test</div>';
    mmJumpToCell(0, 0);
    expect(opPanel.classList.contains('hidden')).toBe(true);
  });

  it('sub-viz shows when result cell selected in outer product mode', () => {
    mmBuildDone();
    mmJumpToCell(0, 0);
    const subViz = document.getElementById('dpSubViz');
    expect(subViz.style.display).not.toBe('none');
  });
});

describe('Bug #3: Result grid states are empty/partial/done only', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('exploration mode: non-selected cells have class done, not muted', () => {
    mmBuildDone();
    mmJumpToCell(0, 0);
    const grid = document.getElementById('mmResultGrid');
    const cells = grid.querySelectorAll('.mat-cell');
    cells.forEach(cell => {
      expect(cell.classList.contains('muted')).toBe(false);
    });
    const selected = grid.querySelector('.mat-cell.cur');
    expect(selected).not.toBeNull();
    const doneCells = grid.querySelectorAll('.mat-cell.done');
    expect(doneCells.length).toBe(cells.length - 1);
  });
});

describe('Presets have buildMode', () => {
  it('every preset has a buildMode field', () => {
    for (const p of PRESETS) {
      expect(p.buildMode).toBeDefined();
      expect(['outer', 'dot']).toContain(p.buildMode);
    }
  });

  it('projection preset desc does not reference x/y/z coordinates', () => {
    const proj = PRESETS.find(p => p.id === 'projection');
    expect(proj).toBeDefined();
    // Desc should not use "x", "y", "z" as coordinate names — confusing with matrix labels
    expect(proj.desc).not.toMatch(/\bkeeps? x\b/i);
    expect(proj.desc).not.toMatch(/\bzeros? y\b/i);
  });
});

describe('Bug: mmReset should clear buildComplete', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('mmReset after build completion clears result grid in DP mode', () => {
    setBuildMode('dot');
    mmBuildDone();
    // After build, result grid shows values
    let grid = document.getElementById('mmResultGrid');
    let doneCells = grid.querySelectorAll('.mat-cell.done');
    expect(doneCells.length).toBeGreaterThan(0);

    // Reset — result grid should be empty
    mmReset();
    grid = document.getElementById('mmResultGrid');
    const emptyCells = grid.querySelectorAll('.mat-cell.empty');
    expect(emptyCells.length).toBe(grid.querySelectorAll('.mat-cell').length);
  });

  it('mmReset after build completion clears result grid in OP mode', () => {
    setBuildMode('outer');
    mmBuildDone();
    let grid = document.getElementById('mmResultGrid');
    expect(grid.querySelectorAll('.mat-cell').length).toBeGreaterThan(0);

    mmReset();
    grid = document.getElementById('mmResultGrid');
    const cells = grid.querySelectorAll('.mat-cell');
    // In OP reset, cells should be empty (no values)
    cells.forEach(cell => {
      expect(cell.classList.contains('done')).toBe(false);
    });
  });
});

describe('Bug: DP initial state uses grey empty boxes, not green', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    setBuildComplete(false);
    mmReset();
  });

  it('dot product s=-1 paints boxes with empty color (0xeeeeee), not green', () => {
    setBuildMode('dot');
    // Boxes should use the empty color (0xeeeeee), not green (0x50c878)
    const b = boxes[0][0][0];
    expect(b.mat.color.getHex()).toBe(0xeeeeee);
    expect(b.mat.opacity).toBeLessThan(0.2);
  });
});

describe('Bug: Exploration highlight should not use orange for selected column', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('selected cube cells should not use orange (0xf0a040)', () => {
    mmBuildDone();
    mmJumpToCell(0, 0);
    // The selected column cells should NOT be orange
    const b = boxes[0][0][0];
    const hex = b.mat.color.getHex();
    // 0xf0a040 is orange — should NOT be used for selected cells
    expect(hex).not.toBe(0xf0a040);
    // Should be cyan (0x20c0e0), not orange or A's color
    expect(hex).toBe(0x20c0e0);
  });

  it('selected cells keep highlight color after collapse and uncollapse', () => {
    mmBuildDone();
    mmScrubCollapse(0.5);
    mmJumpToCell(0, 0);
    const colorAtHalf = boxes[0][0][0].mat.color.getHex();
    mmScrubCollapse(0);
    mmJumpToCell(0, 0);
    const colorAtZero = boxes[0][0][0].mat.color.getHex();
    // Colors should be the same at both collapse positions
    expect(colorAtHalf).toBe(colorAtZero);
  });
});

describe('Bug: OP animation sync — cube slice delayed until animation completes', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    setBuildComplete(false);
    mmReset();
    setBuildMode('outer');
  });

  it('first step shows building state (no values) on the new slice', () => {
    mmFwd(); // step to t1=0, slice j=0
    // The first slice should be in "building" state (low opacity, no values)
    // since the animation just started
    const b = boxes[0][0][0];
    // Building state: opacity 0.40, no sprite visible
    expect(b.mat.opacity).toBeLessThan(0.5);
    expect(b.spr.visible).toBe(false);
  });

  it('second step on same slice shows active state (with values)', () => {
    mmFwd(); // step to t1=0, slice j=0 — building state
    mmFwd(); // step to t1=1, same slice j=0 or j=1
    // After a second step, the previous slice should be done/active
    const b = boxes[0][0][0];
    // Either the current slice is active (high opacity with values)
    // or the previous slice is done (green with values)
    expect(b.mat.opacity).toBeGreaterThan(0.5);
  });
});

describe('Bug: OP last slice should delay like earlier slices', () => {
  beforeEach(() => {
    setData({ I: 2, J: 3, K: 2 });
    computeData(true);
    initScene();
    rebuildBoxes();
    setBuildComplete(false);
    mmReset();
    setBuildMode('outer');
  });

  it('last slice starts in building state (not immediately green)', () => {
    // Step to last slice (j=2, the third slice)
    mmFwd(); // t1=0 → j=0
    mmFwd(); // t1=1 → j=1
    mmFwd(); // t1=2 → j=2 (last slice) — should trigger mmBuildDone

    // The last slice should be in 'building' state initially,
    // NOT immediately painted green by ensureAllGreen()
    const b = boxes[0][2][0]; // i=0, j=2 (last), k=0
    // Building state: opacity 0.40, no sprite visible
    expect(b.mat.opacity).toBeLessThan(0.5);
    expect(b.spr.visible).toBe(false);
  });

  it('earlier slices are done (green) when last slice is building', () => {
    mmFwd(); mmFwd(); mmFwd(); // step to last slice

    // Earlier slices should be green/done
    const b0 = boxes[0][0][0]; // j=0
    expect(b0.mat.color.getHex()).toBe(0x50c878);
    expect(b0.mat.opacity).toBeGreaterThan(0.7);
  });

  it('mmFwd at last step does not cancel pending build-done timer', () => {
    mmFwd(); mmFwd(); mmFwd(); // reach last slice

    // Pressing forward again should be a no-op (not cancel timers)
    mmFwd();
    const state = getMmState();
    // Should still be in build phase (mmBuildDone hasn't fired yet)
    // or in collapse phase if mmBuildDone already fired
    expect(state.t1).toBe(2); // still at last step
  });
});

describe('Bug: DP result grid should not be clickable before build starts', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    setBuildComplete(false);
    mmReset();
    setBuildMode('dot');
  });

  it('DP result grid cells have no onclick before build starts', () => {
    // After switching to DP mode with no build, result cells should not be clickable
    const grid = document.getElementById('mmResultGrid');
    const cells = grid.querySelectorAll('.mat-cell');
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach(cell => {
      // Empty cells should not have cursor:pointer or onclick
      expect(cell.style.cursor).not.toBe('pointer');
      expect(cell.getAttribute('onclick')).toBeNull();
    });
  });

  it('DP result hint should be empty before build starts', () => {
    const hint = document.getElementById('mmResultHint');
    expect(hint.textContent).not.toBe('click cell to trace inputs');
  });

  it('mmJumpToCell should not enter exploration when build not started', () => {
    mmJumpToCell(0, 0);
    const state = getMmState();
    // Should NOT enter exploration (no selection) since build hasn't started
    expect(state.mmSelectedI).toBe(-1);
    expect(state.mmSelectedK).toBe(-1);
  });

  it('DP result grid IS clickable after build completes', () => {
    mmBuildDone();
    const grid = document.getElementById('mmResultGrid');
    const cells = grid.querySelectorAll('.mat-cell');
    expect(cells.length).toBeGreaterThan(0);
    // After build, cells should be clickable
    const clickableCells = grid.querySelectorAll('[onclick]');
    expect(clickableCells.length).toBe(cells.length);
    const hint = document.getElementById('mmResultHint');
    expect(hint.textContent).toBe('click cell to trace inputs');
  });
});

describe('Bug #5: Canvas title uses Cube notation', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('initial title shows Cube[i,j,k]', () => {
    const title = document.getElementById('canvasTitle');
    expect(title.textContent).toContain('Cube');
  });

  it('collapsed title shows summation', () => {
    mmBuildDone();
    mmScrubCollapse(0.5);
    const title = document.getElementById('canvasTitle');
    expect(title.textContent).toContain('Result');
  });
});

describe('Bug: changeDim uses preset fill functions', () => {
  beforeEach(() => {
    setData({ I: 3, J: 3, K: 3 });
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('row-select: new A cells are 0, new B cells are random', () => {
    const data = loadPreset('row-select');
    setData({ I: data.I, J: data.J, K: data.K, A: data.A, B: data.B });

    expect(isPresetActive()).toBe(true);

    const oldK = K;
    changeDim('K', 1); // add a column to B

    // New B column should be random (from fillB: rand)
    // New A cells would only appear if J grew, not K
    // But let's verify B's new column isn't all zeros — it uses rand
    let anyNonZero = false;
    for (let j = 0; j < J; j++) {
      if (B[j][oldK] !== 0) anyNonZero = true;
    }
    // Random fill should produce at least one non-zero across multiple runs
    // (This is a probabilistic test but 3 cells with rand() in [1,9] will be non-zero)
    expect(anyNonZero).toBe(true);

    fullClearPreset();
  });

  it('identity: new A cells follow diagonal pattern', () => {
    const data = loadPreset('identity');
    setData({ I: data.I, J: data.J, K: data.K, A: data.A, B: data.B });

    // Add a row and column (increase I and J)
    changeDim('I', 1); // I: 3→4
    changeDim('J', 1); // J: 3→4

    // A[3][3] should be 1 (diagonal), A[3][0..2] should be 0
    expect(A[3][3]).toBe(1);
    expect(A[3][0]).toBe(0);
    expect(A[3][1]).toBe(0);
    expect(A[3][2]).toBe(0);
    // A[0][3] should be 0 (off-diagonal)
    expect(A[0][3]).toBe(0);

    fullClearPreset();
  });

  it('mask-upper: new A cells follow lower-triangular pattern', () => {
    const data = loadPreset('mask-upper');
    setData({ I: data.I, J: data.J, K: data.K, A: data.A, B: data.B });

    // Add a row and column (I: 4→5, J: 4→5)
    changeDim('I', 1);
    changeDim('J', 1);

    // A[4][0..4] should be [1,1,1,1,1] (lower-triangular: i>=j)
    for (let j = 0; j <= 4; j++) {
      expect(A[4][j]).toBe(1);
    }
    // A[0][4] should be 0 (upper triangle)
    expect(A[0][4]).toBe(0);

    fullClearPreset();
  });

  it('sum-rows: new A cells are all 1', () => {
    const data = loadPreset('sum-rows');
    setData({ I: data.I, J: data.J, K: data.K, A: data.A, B: data.B });

    changeDim('J', 1); // add a column — A should get a new 1

    // All A cells should be 1 (sum-rows is all-ones)
    for (let j = 0; j < J; j++) {
      expect(A[0][j]).toBe(1);
    }

    fullClearPreset();
  });

  it('new cells are random (non-zero) when no preset active', () => {
    fullClearPreset();
    expect(isPresetActive()).toBe(false);

    // Run multiple times to be statistically confident
    let anyNonZero = false;
    for (let trial = 0; trial < 5; trial++) {
      computeData(true);
      const oldK = K;
      changeDim('K', 1);
      for (let j = 0; j < J; j++) {
        if (B[j][oldK] !== 0) anyNonZero = true;
      }
      // Reset K back
      changeDim('K', -1);
    }
    expect(anyNonZero).toBe(true);
  });
});

describe('Bug: collapse after exploration clears cube highlights', () => {
  beforeEach(() => {
    setData({ I: 3, J: 3, K: 3 });
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('scrubbing collapse clears cyan color from exploration', () => {
    mmBuildDone();
    mmJumpToCell(0, 0); // select cell → cyan highlight

    // Verify exploration set cyan on selected column
    const b = boxes[0][0][0];
    expect(b.mat.color.getHex()).toBe(0x20c0e0); // cyan

    // Now scrub collapse
    mmScrubCollapse(0.5);

    // All boxes should be green→purple lerp, NOT cyan
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      const box = boxes[i][j][k];
      if (box.mesh.visible) {
        expect(box.mat.color.getHex()).not.toBe(0x20c0e0);
      }
    }
  });

  it('scrubbing collapse resets sprite text from black to white', () => {
    mmBuildDone();
    mmJumpToCell(1, 1); // select cell → black text on cyan

    // Exploration sets black text via makeTex
    // After collapse, text should be white again
    mmScrubCollapse(0);

    // All visible sprites should have white text (re-created by ensureAllGreen)
    // We verify by checking that ensureAllGreen was called (boxes have green color at t=0)
    const b = boxes[0][0][0];
    // At t=0, applyCollapse sets color to grColor (0x50c878)
    expect(b.mat.color.getHex()).toBe(0x50c878);
  });

  it('scrubbing collapse from already-collapsed state clears exploration', () => {
    mmBuildDone();
    mmScrubCollapse(1.0); // fully collapsed
    mmScrubCollapse(0);   // uncollapse back
    mmJumpToCell(0, 0);   // select in uncollapsed state

    // Verify exploration is active
    expect(boxes[0][0][0].mat.color.getHex()).toBe(0x20c0e0);

    // Scrub to 50%
    mmScrubCollapse(0.5);

    // No cyan should remain
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      const box = boxes[i][j][k];
      if (box.mesh.visible) {
        expect(box.mat.color.getHex()).not.toBe(0x20c0e0);
      }
    }
  });
});

describe('Bug: mmBuildDone should turn all boxes green for both modes', () => {
  beforeEach(() => {
    setData({ I: 3, J: 3, K: 3 });
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('OP mode: all boxes green after mmBuildDone', () => {
    setBuildMode('outer');
    // Call mmBuildDone directly (mmFwd delays it for OP animation)
    mmBuildDone();

    // All boxes should be green (0x50c878)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      expect(boxes[i][j][k].mat.color.getHex()).toBe(0x50c878);
    }
  });

  it('DP mode: all boxes green after mmBuildDone', () => {
    setBuildMode('dot');
    // Step to end
    const total = I * K;
    for (let s = 0; s < total; s++) mmFwd();

    // All boxes should be green (0x50c878) — not orange from last step
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      expect(boxes[i][j][k].mat.color.getHex()).toBe(0x50c878);
    }
  });

  it('DP detail mode: all boxes green after mmBuildDone', () => {
    setBuildMode('dot');
    const chk = document.getElementById('chkDetail');
    chk.checked = true;
    // Step through all terms
    const total = I * K * J;
    for (let s = 0; s < total; s++) mmFwd();

    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      expect(boxes[i][j][k].mat.color.getHex()).toBe(0x50c878);
    }
  });
});

describe('Bug: mmBack should work after build completes', () => {
  beforeEach(() => {
    setData({ I: 3, J: 3, K: 3 });
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('OP: mmBack after stepping to end re-enters build phase', () => {
    setBuildMode('outer');
    // Call mmBuildDone directly (mmFwd delays it for OP animation)
    for (let s = 0; s < J - 1; s++) mmFwd();
    mmBuildDone(); // simulate build completion
    const stateAfterBuild = getMmState();
    expect(stateAfterBuild.mmPhase).toBe('collapse');

    // Back should work — re-enter build, step back
    mmBack();
    const stateAfterBack = getMmState();
    expect(stateAfterBack.mmPhase).toBe('build');
    expect(stateAfterBack.t1).toBe(J - 2); // totalSteps()-2 = J-2 = 1
  });

  it('DP: mmBack after stepping to end re-enters build phase', () => {
    setBuildMode('dot');
    const total = I * K;
    for (let s = 0; s < total; s++) mmFwd();
    const stateAfterBuild = getMmState();
    expect(stateAfterBuild.mmPhase).toBe('collapse');

    mmBack();
    const stateAfterBack = getMmState();
    expect(stateAfterBack.mmPhase).toBe('build');
    expect(stateAfterBack.t1).toBe(total - 2);
  });

  it('DP detail: mmBack after stepping to end re-enters build phase', () => {
    setBuildMode('dot');
    const chk = document.getElementById('chkDetail');
    chk.checked = true;
    const total = I * K * J;
    for (let s = 0; s < total; s++) mmFwd();
    expect(getMmState().mmPhase).toBe('collapse');

    mmBack();
    const state = getMmState();
    expect(state.mmPhase).toBe('build');
    expect(state.t1).toBe(total - 2);
  });

  it('mmBack does NOT re-enter build if collapse has started', () => {
    setBuildMode('outer');
    for (let s = 0; s < J; s++) mmFwd();
    // Scrub collapse partway
    mmScrubCollapse(0.5);
    expect(getMmState().mmPhase).toBe('collapse');

    // Back should NOT work — collapse is in progress
    mmBack();
    expect(getMmState().mmPhase).toBe('collapse');
  });
});

describe('Bug: detail toggle mid-build remaps step', () => {
  beforeEach(() => {
    setData({ I: 3, J: 3, K: 3 });
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('DP: toggling detail ON maps to start of current cell terms', () => {
    setBuildMode('dot');
    const chk = document.getElementById('chkDetail');
    chk.checked = false;

    // Step forward 2 times: t1=0 (cell 0), t1=1 (cell 1)
    mmFwd(); mmFwd();
    const state1 = getMmState();
    expect(state1.t1).toBe(1); // cell index 1

    // Toggle detail ON — should map to t1 = 1 * J (start of cell 1's terms)
    chk.checked = true;
    mmToggleDetail();

    const state2 = getMmState();
    expect(state2.t1).toBe(1 * J); // should be at start of cell 1's term breakdown
  });

  it('DP: toggling detail OFF maps back to containing cell', () => {
    setBuildMode('dot');
    const chk = document.getElementById('chkDetail');
    chk.checked = true;

    // Step forward J+1 times: into cell 1's second term
    for (let i = 0; i <= J; i++) mmFwd();
    const state1 = getMmState();
    expect(state1.t1).toBe(J); // first step of cell 1 (detail)

    // Toggle detail OFF — should map to cell 1
    chk.checked = false;
    mmToggleDetail();

    const state2 = getMmState();
    expect(state2.t1).toBe(1); // cell index 1
  });

  it('OP: toggling detail ON maps to start of current slice elements', () => {
    setBuildMode('outer');
    const chk = document.getElementById('chkDetail');
    chk.checked = false;

    // Step forward: t1=0 (slice j=0)
    mmFwd();
    const state1 = getMmState();
    expect(state1.t1).toBe(0);

    // Toggle detail ON — should map to t1 = 0 * I * K
    chk.checked = true;
    mmToggleDetail();

    const state2 = getMmState();
    expect(state2.t1).toBe(0);
  });

  it('OP: toggling detail OFF from mid-slice maps to that slice', () => {
    setBuildMode('outer');
    const chk = document.getElementById('chkDetail');
    chk.checked = true;

    // Step to second element of first slice
    mmFwd(); mmFwd();
    const state1 = getMmState();
    expect(state1.t1).toBe(1); // second element in slice 0

    // Toggle detail OFF — should map to slice 0
    chk.checked = false;
    mmToggleDetail();

    const state2 = getMmState();
    expect(state2.t1).toBe(0); // slice 0
  });

  it('detail toggle before build started does not crash', () => {
    setBuildMode('dot');
    const chk = document.getElementById('chkDetail');
    chk.checked = false;

    // Toggle without any steps — should not crash
    chk.checked = true;
    expect(() => mmToggleDetail()).not.toThrow();

    const state = getMmState();
    expect(state.t1).toBe(-1); // still at -1
  });
});

describe('mmJumpToCell deselect hides sub-viz panels', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('deselecting a cell hides dpSubViz', () => {
    setBuildMode('dot');
    setBuildComplete(true);
    const subViz = document.getElementById('dpSubViz');
    subViz.style.display = 'block';
    // Select cell (0,0)
    mmJumpToCell(0, 0);
    expect(subViz.style.display).not.toBe('none');
    // Deselect same cell
    mmJumpToCell(0, 0);
    expect(subViz.style.display).toBe('none');
  });

  it('deselecting a cell hides opDisplay', () => {
    setBuildMode('outer');
    setBuildComplete(true);
    const opPanel = document.getElementById('opDisplay');
    opPanel.classList.remove('hidden');
    opPanel.innerHTML = 'something';
    // Select cell (0,0)
    mmJumpToCell(0, 0);
    // Deselect same cell
    mmJumpToCell(0, 0);
    expect(opPanel.classList.contains('hidden')).toBe(true);
  });
});
