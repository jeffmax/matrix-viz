import { describe, it, expect, beforeEach } from 'vitest';
import { computeData, I, K, Res, setBuildComplete } from '../js/shared.js';
import { initScene } from '../js/scene.js';
import { rebuildBoxes, ensureAllGreen, addPlusPlanes, boxes } from '../js/cube-manager.js';
import { mmBuildDone, getOpHiTm, setOpHiTm, mmReset, setBuildMode, getBuildMode,
         mmJumpToCell, getMmState, mmHoverCell, mmClearHover, mmFwd } from '../js/tab-matmul.js';

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
