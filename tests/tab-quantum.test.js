// ══════════════════════════════════════════════════
// Tests for Quantum Gates tab (tab-quantum.js)
// ══════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import { qInit, qApply, qReset, qRender, getQState, GATES,
         qSelectFn, qApplyClassical, CLASSICAL_FNS, fnMatrix } from '../js/tab-quantum.js';

describe('Quantum Gates tab', () => {
  beforeEach(() => {
    qInit();
  });

  it('initializes with |0⟩ state and empty history', () => {
    const s = getQState();
    expect(s.state).toEqual([1, 0]);
    expect(s.prevState).toBeNull();
    expect(s.lastGate).toBeNull();
    expect(s.history).toEqual([]);
  });

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
    qApply('X');
    qApply('X');
    expect(getQState().state).toEqual([1, 0]);
  });

  it('Z|0⟩ = |0⟩ (no phase change on |0⟩)', () => {
    qApply('Z');
    expect(getQState().state).toEqual([1, 0]);
  });

  it('Z|1⟩ = −|1⟩', () => {
    qApply('X'); // now |1⟩
    qApply('Z');
    expect(getQState().state).toEqual([0, -1]);
  });

  it('X² = I and Z² = I (gates are involutive)', () => {
    qApply('X'); qApply('X');
    expect(getQState().state).toEqual([1, 0]);
    qInit();
    qApply('X'); // |1⟩
    qApply('Z'); qApply('Z'); // back to |1⟩
    expect(getQState().state).toEqual([0, 1]);
  });

  it('X Z X sequence on |0⟩ gives −|0⟩', () => {
    // |0⟩ -X→ |1⟩ -Z→ -|1⟩ -X→ -|0⟩
    qApply('X');
    qApply('Z');
    qApply('X');
    expect(getQState().state).toEqual([-1, 0]);
  });

  it('history records each applied gate with before/after states', () => {
    qApply('X');
    qApply('Z');
    const s = getQState();
    expect(s.history.length).toBe(2);
    expect(s.history[0]).toEqual({ gate: 'X', before: [1, 0], after: [0, 1] });
    expect(s.history[1]).toEqual({ gate: 'Z', before: [0, 1], after: [0, -1] });
  });

  it('lastGate and prevState track the most recent operation', () => {
    qApply('X');
    const s1 = getQState();
    expect(s1.lastGate).toBe('X');
    expect(s1.prevState).toEqual([1, 0]);
    qApply('Z');
    const s2 = getQState();
    expect(s2.lastGate).toBe('Z');
    expect(s2.prevState).toEqual([0, 1]);
  });

  it('qReset returns state to |0⟩ and clears history', () => {
    qApply('X');
    qApply('Z');
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

  it('GATES export contains I, X, Z with correct matrices', () => {
    expect(GATES.I.matrix).toEqual([[1, 0], [0, 1]]);
    expect(GATES.X.matrix).toEqual([[0, 1], [1, 0]]);
    expect(GATES.Z.matrix).toEqual([[1, 0], [0, -1]]);
  });

  it('qRender produces non-empty HTML in qDisplay', () => {
    qRender();
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).not.toBe('');
    expect(el.innerHTML).toContain('|ψ⟩');
  });

  it('qRender shows last operation panel after a gate is applied', () => {
    qApply('X');
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).toContain('column mixing');
    expect(el.innerHTML).toContain('Circuit so far');
  });

  it('qRender includes Dirac notation sections and connections', () => {
    qRender();
    const el = document.getElementById('qDisplay');
    // Section headers
    expect(el.innerHTML).toContain('Basics');
    expect(el.innerHTML).toContain('Deterministic operations');
    expect(el.innerHTML).toContain('Quantum gates');
    // Core Dirac symbols
    expect(el.innerHTML).toContain('⟨0|0⟩');
    expect(el.innerHTML).toContain('|1⟩⟨0|');
    // Connections panel
    expect(el.innerHTML).toContain('connections across the app');
  });
});

describe('Quantum tab — classical deterministic operations', () => {
  beforeEach(() => { qInit(); });

  it('CLASSICAL_FNS has identity, NOT, const-0, const-1', () => {
    expect(Object.keys(CLASSICAL_FNS).sort()).toEqual(['const0', 'const1', 'id', 'not']);
    expect(CLASSICAL_FNS.id.f).toEqual([0, 1]);
    expect(CLASSICAL_FNS.not.f).toEqual([1, 0]);
    expect(CLASSICAL_FNS.const0.f).toEqual([0, 0]);
    expect(CLASSICAL_FNS.const1.f).toEqual([1, 1]);
  });

  it('fnMatrix(id) = Identity matrix', () => {
    expect(fnMatrix(CLASSICAL_FNS.id)).toEqual([[1, 0], [0, 1]]);
  });

  it('fnMatrix(not) = Pauli-X matrix', () => {
    expect(fnMatrix(CLASSICAL_FNS.not)).toEqual([[0, 1], [1, 0]]);
  });

  it('fnMatrix(const0) maps both inputs to |0⟩', () => {
    expect(fnMatrix(CLASSICAL_FNS.const0)).toEqual([[1, 1], [0, 0]]);
  });

  it('fnMatrix(const1) maps both inputs to |1⟩', () => {
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

  it('qApplyClassical(0) on identity gives |0⟩', () => {
    qSelectFn('id');
    qApplyClassical(0);
    const s = getQState();
    expect(s.cLastApplied).toBe(true);
    expect(s.cInput).toBe(0);
    expect(s.cLastResult).toEqual([1, 0]);
  });

  it('qApplyClassical(0) on NOT gives |1⟩', () => {
    qSelectFn('not');
    qApplyClassical(0);
    expect(getQState().cLastResult).toEqual([0, 1]);
  });

  it('qApplyClassical(1) on const-0 gives |0⟩', () => {
    qSelectFn('const0');
    qApplyClassical(1);
    expect(getQState().cLastResult).toEqual([1, 0]);
  });

  it('qApplyClassical(0) on const-1 gives |1⟩', () => {
    qSelectFn('const1');
    qApplyClassical(0);
    expect(getQState().cLastResult).toEqual([0, 1]);
  });

  it('qApplyClassical rejects non-bit inputs', () => {
    qSelectFn('id');
    qApplyClassical(2);
    expect(getQState().cLastApplied).toBe(false);
  });

  it('qRender shows expansion ⟨b|a⟩ selection after applying', () => {
    qSelectFn('not');
    qApplyClassical(0);
    const el = document.getElementById('qDisplay');
    // Should show the Σ_b |f(b)⟩⟨b|a⟩ breakdown
    expect(el.innerHTML).toContain('M|0⟩');
    expect(el.innerHTML).toContain('⟨0|0⟩');
    expect(el.innerHTML).toContain('⟨1|0⟩');
  });

  it('qInit resets classical state', () => {
    qSelectFn('not');
    qApplyClassical(1);
    qInit();
    const s = getQState();
    expect(s.cFn).toBe('id');
    expect(s.cLastApplied).toBe(false);
  });
});
