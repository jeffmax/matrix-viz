// ══════════════════════════════════════════════════
// Tests for Dirac tab (tab-quantum.js) — basics, deterministic, stochastic, quantum sub-tabs
// ══════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import { qInit, qApply, qReset, qRender, getQState, GATES,
         qSelectFn, qApplyClassical, CLASSICAL_FNS, fnMatrix,
         qSelectStoch, qApplyStoch, STOCH_MATRICES, matMul,
         qSetSubTab } from '../js/tab-quantum.js';

describe('Dirac tab — sub-tab switching', () => {
  beforeEach(() => { qInit(); qSetSubTab('basics'); });

  it('initializes sub-tab as basics', () => {
    expect(getQState().qSubTab).toBe('basics');
  });

  it('qSetSubTab switches to det/stoch/quantum', () => {
    qSetSubTab('det');
    expect(getQState().qSubTab).toBe('det');
    qSetSubTab('stoch');
    expect(getQState().qSubTab).toBe('stoch');
    qSetSubTab('quantum');
    expect(getQState().qSubTab).toBe('quantum');
  });

  it('qSetSubTab with unknown name is a no-op', () => {
    qSetSubTab('foo');
    expect(getQState().qSubTab).toBe('basics');
  });

  it('qSetSubTab toggles active class on the 4 tier-2 buttons', () => {
    qSetSubTab('stoch');
    expect(document.getElementById('tab-dirac-basics').classList.contains('active')).toBe(false);
    expect(document.getElementById('tab-dirac-det').classList.contains('active')).toBe(false);
    expect(document.getElementById('tab-dirac-stoch').classList.contains('active')).toBe(true);
    expect(document.getElementById('tab-dirac-quantum').classList.contains('active')).toBe(false);
  });

  it('qInit preserves qSubTab (so switching tiers does not reset view)', () => {
    qSetSubTab('quantum');
    qInit();
    expect(getQState().qSubTab).toBe('quantum');
  });
});

describe('Basics sub-tab — rendering', () => {
  beforeEach(() => { qInit(); qSetSubTab('basics'); });

  it('renders kets, bras, inner and outer product content', () => {
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).toContain('Basics');
    expect(el.innerHTML).toContain('⟨0|0⟩');
    expect(el.innerHTML).toContain('|1⟩⟨0|');
  });

  it('does not include deterministic/stochastic/quantum panels', () => {
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).not.toContain('Choose a 1-bit function');
    expect(el.innerHTML).not.toContain('Pick a stochastic matrix');
    expect(el.innerHTML).not.toContain('Current state |ψ⟩');
  });
});

describe('Quantum sub-tab — gate algebra', () => {
  beforeEach(() => { qInit(); qSetSubTab('quantum'); });

  it('I gate leaves state unchanged', () => {
    qApply('I');
    expect(getQState().state).toEqual([1, 0]);
    qApply('I');
    expect(getQState().state).toEqual([1, 0]);
  });

  it('X|0⟩ = |1⟩', () => {
    qApply('X');
    expect(getQState().state).toEqual([0, 1]);
  });

  it('X|1⟩ = |0⟩', () => {
    qApply('X'); qApply('X');
    expect(getQState().state).toEqual([1, 0]);
  });

  it('Z|0⟩ = |0⟩', () => {
    qApply('Z');
    expect(getQState().state).toEqual([1, 0]);
  });

  it('Z|1⟩ = −|1⟩', () => {
    qApply('X'); qApply('Z');
    expect(getQState().state).toEqual([0, -1]);
  });

  it('X² = I and Z² = I', () => {
    qApply('X'); qApply('X');
    expect(getQState().state).toEqual([1, 0]);
    qInit();
    qApply('X'); qApply('Z'); qApply('Z');
    expect(getQState().state).toEqual([0, 1]);
  });

  it('XZX on |0⟩ gives −|0⟩', () => {
    qApply('X'); qApply('Z'); qApply('X');
    expect(getQState().state).toEqual([-1, 0]);
  });

  it('history records gate with before/after', () => {
    qApply('X'); qApply('Z');
    const s = getQState();
    expect(s.history.length).toBe(2);
    expect(s.history[0]).toEqual({ gate: 'X', before: [1, 0], after: [0, 1] });
    expect(s.history[1]).toEqual({ gate: 'Z', before: [0, 1], after: [0, -1] });
  });

  it('lastGate and prevState track recent op', () => {
    qApply('X');
    expect(getQState().lastGate).toBe('X');
    expect(getQState().prevState).toEqual([1, 0]);
    qApply('Z');
    expect(getQState().lastGate).toBe('Z');
    expect(getQState().prevState).toEqual([0, 1]);
  });

  it('qReset returns state to |0⟩ and clears history', () => {
    qApply('X'); qApply('Z');
    qReset();
    const s = getQState();
    expect(s.state).toEqual([1, 0]);
    expect(s.lastGate).toBeNull();
    expect(s.prevState).toBeNull();
    expect(s.history).toEqual([]);
  });

  it('unknown gate is a no-op', () => {
    qApply('FOO');
    const s = getQState();
    expect(s.state).toEqual([1, 0]);
    expect(s.lastGate).toBeNull();
    expect(s.history).toEqual([]);
  });

  it('GATES export has correct matrices', () => {
    expect(GATES.I.matrix).toEqual([[1, 0], [0, 1]]);
    expect(GATES.X.matrix).toEqual([[0, 1], [1, 0]]);
    expect(GATES.Z.matrix).toEqual([[1, 0], [0, -1]]);
  });
});

describe('Quantum sub-tab — rendering (unitary constraint + composition)', () => {
  beforeEach(() => { qInit(); qSetSubTab('quantum'); });

  it('shows |ψ⟩ panel and gate buttons', () => {
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).toContain('|ψ⟩');
    expect(el.innerHTML).toContain('Apply gate');
  });

  it('shows U†U = I constraint intro and per-gate check', () => {
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).toContain('squared entries');
    expect(el.innerHTML).toContain('U†U = I');
  });

  it('shows column mixing panel after a gate', () => {
    qApply('X');
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).toContain('column mixing');
    expect(el.innerHTML).toContain('Circuit so far');
  });

  it('includes closed-under-composition XZ example', () => {
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).toContain('products of unitaries');
    expect(el.innerHTML).toContain('XZ');
  });

  it('does not include basics/det/stoch panels', () => {
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).not.toContain('Choose a 1-bit function');
    expect(el.innerHTML).not.toContain('Pick a stochastic matrix');
  });
});

describe('Deterministic sub-tab', () => {
  beforeEach(() => { qInit(); qSetSubTab('det'); });

  it('CLASSICAL_FNS has identity, NOT, const-0, const-1', () => {
    expect(Object.keys(CLASSICAL_FNS).sort()).toEqual(['const0', 'const1', 'id', 'not']);
    expect(CLASSICAL_FNS.id.f).toEqual([0, 1]);
    expect(CLASSICAL_FNS.not.f).toEqual([1, 0]);
    expect(CLASSICAL_FNS.const0.f).toEqual([0, 0]);
    expect(CLASSICAL_FNS.const1.f).toEqual([1, 1]);
  });

  it('fnMatrix produces correct matrices', () => {
    expect(fnMatrix(CLASSICAL_FNS.id)).toEqual([[1, 0], [0, 1]]);
    expect(fnMatrix(CLASSICAL_FNS.not)).toEqual([[0, 1], [1, 0]]);
    expect(fnMatrix(CLASSICAL_FNS.const0)).toEqual([[1, 1], [0, 0]]);
    expect(fnMatrix(CLASSICAL_FNS.const1)).toEqual([[0, 0], [1, 1]]);
  });

  it('qSelectFn updates cFn and resets application state', () => {
    qApplyClassical(1);
    expect(getQState().cLastApplied).toBe(true);
    qSelectFn('not');
    const s = getQState();
    expect(s.cFn).toBe('not');
    expect(s.cLastApplied).toBe(false);
  });

  it('qSelectFn ignores unknown id', () => {
    qSelectFn('bogus');
    expect(getQState().cFn).toBe('id');
  });

  it('qApplyClassical computes |f(a)⟩', () => {
    qSelectFn('not'); qApplyClassical(0);
    expect(getQState().cLastResult).toEqual([0, 1]);

    qSelectFn('const0'); qApplyClassical(1);
    expect(getQState().cLastResult).toEqual([1, 0]);

    qSelectFn('const1'); qApplyClassical(0);
    expect(getQState().cLastResult).toEqual([0, 1]);
  });

  it('qApplyClassical rejects non-bit inputs', () => {
    qSelectFn('id');
    qApplyClassical(2);
    expect(getQState().cLastApplied).toBe(false);
  });

  it('qRender shows expansion and closed-under-composition', () => {
    qSelectFn('not'); qApplyClassical(0);
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).toContain('M|0⟩');
    expect(el.innerHTML).toContain('⟨0|0⟩');
    expect(el.innerHTML).toContain('⟨1|0⟩');
    expect(el.innerHTML).toContain('Closed under composition');
  });

  it('does not include basics/stoch/quantum panels', () => {
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).not.toContain('Pick a stochastic matrix');
    expect(el.innerHTML).not.toContain('Current state |ψ⟩');
  });
});

describe('Stochastic sub-tab', () => {
  beforeEach(() => { qInit(); qSetSubTab('stoch'); });

  it('STOCH_MATRICES includes det-id, det-not, noisy-id, fair-flip', () => {
    expect(Object.keys(STOCH_MATRICES).sort()).toEqual(['det-id', 'det-not', 'fair-flip', 'noisy-id']);
  });

  it('all STOCH_MATRICES are column-stochastic (cols sum to 1)', () => {
    for (const id of Object.keys(STOCH_MATRICES)) {
      const m = STOCH_MATRICES[id].matrix;
      expect(m[0][0] + m[1][0]).toBeCloseTo(1);
      expect(m[0][1] + m[1][1]).toBeCloseTo(1);
    }
  });

  it('qSelectStoch updates sMat and resets application', () => {
    qApplyStoch(1, 0);
    expect(getQState().sLastApplied).toBe(true);
    qSelectStoch('fair-flip');
    const s = getQState();
    expect(s.sMat).toBe('fair-flip');
    expect(s.sLastApplied).toBe(false);
  });

  it('qSelectStoch ignores unknown id', () => {
    qSelectStoch('bogus');
    expect(getQState().sMat).toBe('noisy-id');
  });

  it('qApplyStoch on fair-flip with |0⟩ gives [½, ½]', () => {
    qSelectStoch('fair-flip');
    qApplyStoch(1, 0);
    expect(getQState().sLastResult).toEqual([0.5, 0.5]);
  });

  it('qApplyStoch on noisy-id with |0⟩ gives [¾, ¼]', () => {
    qSelectStoch('noisy-id');
    qApplyStoch(1, 0);
    expect(getQState().sLastResult).toEqual([0.75, 0.25]);
  });

  it('qApplyStoch on det-id with [½,½] gives [½,½]', () => {
    qSelectStoch('det-id');
    qApplyStoch(0.5, 0.5);
    expect(getQState().sLastResult).toEqual([0.5, 0.5]);
  });

  it('Mp always sums to 1 (closed under application)', () => {
    for (const mid of Object.keys(STOCH_MATRICES)) {
      qSelectStoch(mid);
      for (const p of [[1, 0], [0, 1], [0.5, 0.5], [0.25, 0.75]]) {
        qApplyStoch(p[0], p[1]);
        const r = getQState().sLastResult;
        expect(r[0] + r[1]).toBeCloseTo(1);
      }
    }
  });

  it('M·M is still column-stochastic for every preset', () => {
    for (const id of Object.keys(STOCH_MATRICES)) {
      const m = STOCH_MATRICES[id].matrix;
      const p = matMul(m, m);
      expect(p[0][0] + p[1][0]).toBeCloseTo(1);
      expect(p[0][1] + p[1][1]).toBeCloseTo(1);
    }
  });

  it('render shows column-sum check and composition panel', () => {
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).toContain('each column sums to 1');
    expect(el.innerHTML).toContain('closed under composition');
  });

  it('does not include basics/det/quantum panels', () => {
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).not.toContain('Choose a 1-bit function');
    expect(el.innerHTML).not.toContain('Current state |ψ⟩');
  });
});

describe('matMul helper', () => {
  it('multiplies 2×2 matrices correctly', () => {
    expect(matMul([[1, 0], [0, 1]], [[0, 1], [1, 0]])).toEqual([[0, 1], [1, 0]]);
    expect(matMul([[0, 1], [1, 0]], [[1, 0], [0, -1]])).toEqual([[0, -1], [1, 0]]);
  });
});
