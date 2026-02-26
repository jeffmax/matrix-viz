import { describe, it, expect, beforeEach } from 'vitest';
import { computeData, I, K } from '../js/shared.js';
import { initScene } from '../js/scene.js';
import { rebuildBoxes, ensureAllGreen, addPlusPlanes } from '../js/cube-manager.js';
import { dpJumpToCell, dpFwd, getDpState, dpReset, dpTermByTerm } from '../js/tab-dotprod.js';

describe('Bug 3A: dpJumpToCell always enters selection mode', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    ensureAllGreen();
    addPlusPlanes();
    dpReset();
  });

  it('clicking a cell before animation sets selection', () => {
    dpJumpToCell(0, 0);
    const state = getDpState();
    expect(state.dpSelectedI).toBe(0);
    expect(state.dpSelectedK).toBe(0);
    expect(state.dpStep).toBe(-1);
  });

  it('clicking a cell AFTER stepping still enters selection mode', () => {
    // Step forward a few times so dpStep >= 0
    dpFwd();
    dpFwd();
    dpFwd();
    const stateBefore = getDpState();
    expect(stateBefore.dpStep).toBeGreaterThanOrEqual(0);

    // Now click a cell — should enter selection mode (dpStep = -1)
    dpJumpToCell(1, 1);
    const stateAfter = getDpState();
    expect(stateAfter.dpSelectedI).toBe(1);
    expect(stateAfter.dpSelectedK).toBe(1);
    expect(stateAfter.dpStep).toBe(-1);
  });
});

describe('Bug 3B: dpTermByTerm reads checkbox', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    ensureAllGreen();
    dpReset();
  });

  it('returns true when chkDpCol is unchecked (term-by-term default)', () => {
    // Add the checkbox to DOM if not present
    let chk = document.getElementById('chkDpCol');
    if (!chk) {
      chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.id = 'chkDpCol';
      document.body.appendChild(chk);
    }
    chk.checked = false;
    expect(dpTermByTerm()).toBe(true);
  });

  it('returns false when chkDpCol is checked (column-by-column mode)', () => {
    let chk = document.getElementById('chkDpCol');
    if (!chk) {
      chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.id = 'chkDpCol';
      document.body.appendChild(chk);
    }
    chk.checked = true;
    expect(dpTermByTerm()).toBe(false);
  });
});
