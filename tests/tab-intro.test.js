import { describe, it, expect, beforeEach } from 'vitest';
import { computeData, I, K } from '../js/shared.js';
import { initIntroVecs, renderIntro, introStep, introAnimDuration,
         resetIntroStep, stepFwdIntro,
         introToggleDirac, getIntroDirac } from '../js/tab-intro.js';

describe('Tab 0 labels should not contain [:, None] broadcasting syntax', () => {
  beforeEach(() => {
    resetIntroStep();
    computeData(true);
    initIntroVecs(true);
  });

  it('step 0 (1D vectors) does not show [:, None] or [None, :]', () => {
    renderIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).not.toContain('[:, None]');
    expect(wrap.innerHTML).not.toContain('[None, :]');
  });

  it('step 1 (reshape) does not show [:, None] or [None, :]', () => {
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).not.toContain('[:, None]');
    expect(wrap.innerHTML).not.toContain('[None, :]');
  });

  it('step 2 (broadcast) does not show [:, None] or [None, :]', () => {
    stepFwdIntro();
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).not.toContain('[:, None]');
    expect(wrap.innerHTML).not.toContain('[None, :]');
  });

  it('step 3 (result) does not show [:, None] or [None, :]', () => {
    stepFwdIntro();
    stepFwdIntro();
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).not.toContain('[:, None]');
    expect(wrap.innerHTML).not.toContain('[None, :]');
  });
});

describe('Bug 1: Tab 0 step 3 should not replay result animation', () => {
  beforeEach(() => {
    resetIntroStep();
    computeData(true);
    initIntroVecs(true);
  });

  it('step 2 result cells have .anim class (animation plays)', () => {
    // Advance to step 2 (broadcast)
    stepFwdIntro();
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    const resultCells = wrap.querySelectorAll('.mat-cell.r');
    expect(resultCells.length).toBeGreaterThan(0);
    // Step 2 should have .anim class on result cells
    for (const cell of resultCells) {
      expect(cell.classList.contains('anim')).toBe(true);
    }
  });

  it('step 3 result cells should NOT have .anim class (no double-play)', () => {
    // Advance to step 2, then step 3
    stepFwdIntro();
    stepFwdIntro();
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    const resultCells = wrap.querySelectorAll('.mat-cell.r');
    expect(resultCells.length).toBeGreaterThan(0);
    // Step 3 should NOT have .anim class — cells appear instantly
    for (const cell of resultCells) {
      expect(cell.classList.contains('anim')).toBe(false);
    }
  });

  it('step 3 introAnimDuration should be short (no animation to wait for)', () => {
    stepFwdIntro();
    stepFwdIntro();
    stepFwdIntro();
    const dur = introAnimDuration();
    // Should be a fixed short duration, not a computed animation time
    expect(dur).toBeLessThan(1000);
  });
});

describe('4-step progression', () => {
  beforeEach(() => {
    resetIntroStep();
    computeData(true);
    initIntroVecs(true);
  });

  it('has 4 step dots', () => {
    renderIntro();
    const dots = document.getElementById('dIntro').querySelectorAll('.step-dot');
    expect(dots.length).toBe(4);
  });

  it('step 0 shows both vectors as horizontal rows', () => {
    renderIntro();
    const wrap = document.getElementById('introDisplay');
    // Step 0 should show a and b — no column layout for a
    expect(wrap.innerHTML).not.toContain('column vector');
    expect(wrap.innerHTML).not.toContain('row vector');
  });

  it('step 1 shows column/row reshape', () => {
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).toContain('column vector');
    expect(wrap.innerHTML).toContain('row vector');
  });

  it('cannot step beyond step 3', () => {
    stepFwdIntro(); // → 1
    stepFwdIntro(); // → 2
    stepFwdIntro(); // → 3
    stepFwdIntro(); // should stay at 3
    const dots = document.getElementById('dIntro').querySelectorAll('.step-dot');
    const curDots = document.getElementById('dIntro').querySelectorAll('.step-dot.cur');
    expect(dots.length).toBe(4);
    expect(curDots.length).toBe(1);
  });
});

describe('Outer Product — Dirac toggle', () => {
  beforeEach(() => {
    resetIntroStep();
    computeData(true);
    initIntroVecs(true);
    // Ensure off by default
    const chk = document.getElementById('chkIntroDirac');
    if (chk) chk.checked = false;
    if (getIntroDirac()) introToggleDirac();
  });

  it('is off by default', () => {
    expect(getIntroDirac()).toBe(false);
    renderIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).not.toContain('|a⟩⟨b|');
  });

  it('enabling shows |a⟩⟨b| labels', () => {
    document.getElementById('chkIntroDirac').checked = true;
    introToggleDirac();
    expect(getIntroDirac()).toBe(true);
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).toContain('|a⟩');
    expect(wrap.innerHTML).toContain('⟨b|');
  });

  it('result label on step 3 is |a⟩⟨b| in Dirac mode', () => {
    document.getElementById('chkIntroDirac').checked = true;
    introToggleDirac();
    stepFwdIntro(); stepFwdIntro(); stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).toContain('|a⟩⟨b|');
  });
});
