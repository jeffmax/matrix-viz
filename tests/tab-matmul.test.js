import { describe, it, expect, beforeEach } from 'vitest';
import { computeData, I, K, Res, setBuildComplete } from '../js/shared.js';
import { initScene } from '../js/scene.js';
import { rebuildBoxes, ensureAllGreen, addPlusPlanes, boxes } from '../js/cube-manager.js';
import { mmBuildDone, getOpHiTm, setOpHiTm, mmReset, setBuildMode, getBuildMode,
         mmJumpToCell, getMmState, mmHoverCell, mmClearHover, mmFwd,
         mmScrubCollapse, mmUpdateCanvasTitle } from '../js/tab-matmul.js';
import { PRESETS } from '../js/presets.js';

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
});

describe('mmJumpToCell enters exploration mode', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    ensureAllGreen();
    addPlusPlanes();
    mmReset();
  });

  it('clicking a cell sets selection and step=-1', () => {
    mmJumpToCell(0, 0);
    const state = getMmState();
    expect(state.mmSelectedI).toBe(0);
    expect(state.mmSelectedK).toBe(0);
    expect(state.t1).toBe(-1);
  });

  it('clicking a cell AFTER stepping enters exploration', () => {
    mmFwd();
    mmFwd();
    const stateBefore = getMmState();
    expect(stateBefore.t1).toBeGreaterThanOrEqual(0);

    mmJumpToCell(1, 1);
    const stateAfter = getMmState();
    expect(stateAfter.mmSelectedI).toBe(1);
    expect(stateAfter.mmSelectedK).toBe(1);
    expect(stateAfter.t1).toBe(-1);
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
