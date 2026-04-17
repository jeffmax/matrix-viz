// ══════════════════════════════════════════════════
// Tests for Quantum Gates tab (tab-quantum.js)
// ══════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import { qInit, qApply, qReset, qRender, getQState, GATES } from '../js/tab-quantum.js';

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

  it('qRender includes Dirac reference panel', () => {
    qRender();
    const el = document.getElementById('qDisplay');
    expect(el.innerHTML).toContain('Dirac notation reference');
    expect(el.innerHTML).toContain('⟨0|0⟩');
  });
});
