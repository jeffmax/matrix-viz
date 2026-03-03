import { describe, it, expect, beforeEach } from 'vitest';
import { computeData, I, K } from '../js/shared.js';
import { initIntroVecs, renderIntro, introStep, introAnimDuration,
         resetIntroStep, stepFwdIntro } from '../js/tab-intro.js';

describe('Tab 0 labels should not contain [:, None] broadcasting syntax', () => {
  beforeEach(() => {
    resetIntroStep();
    computeData(true);
    initIntroVecs(true);
  });

  it('step 0 does not show [:, None] or [None, :]', () => {
    renderIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).not.toContain('[:, None]');
    expect(wrap.innerHTML).not.toContain('[None, :]');
  });

  it('step 1 does not show [:, None] or [None, :]', () => {
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).not.toContain('[:, None]');
    expect(wrap.innerHTML).not.toContain('[None, :]');
  });

  it('step 2 does not show [:, None] or [None, :]', () => {
    stepFwdIntro();
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    expect(wrap.innerHTML).not.toContain('[:, None]');
    expect(wrap.innerHTML).not.toContain('[None, :]');
  });
});

describe('Bug 1: Tab 0 step 2 should not replay result animation', () => {
  beforeEach(() => {
    resetIntroStep();
    computeData(true);
    initIntroVecs(true);
  });

  it('step 1 result cells have .anim class (animation plays)', () => {
    // Advance to step 1
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    const resultCells = wrap.querySelectorAll('.mat-cell.r');
    expect(resultCells.length).toBeGreaterThan(0);
    // Step 1 should have .anim class on result cells
    for (const cell of resultCells) {
      expect(cell.classList.contains('anim')).toBe(true);
    }
  });

  it('step 2 result cells should NOT have .anim class (no double-play)', () => {
    // Advance to step 1, then step 2
    stepFwdIntro();
    stepFwdIntro();
    const wrap = document.getElementById('introDisplay');
    const resultCells = wrap.querySelectorAll('.mat-cell.r');
    expect(resultCells.length).toBeGreaterThan(0);
    // Step 2 should NOT have .anim class — cells appear instantly
    for (const cell of resultCells) {
      expect(cell.classList.contains('anim')).toBe(false);
    }
  });

  it('step 2 introAnimDuration should be short (no animation to wait for)', () => {
    stepFwdIntro();
    stepFwdIntro();
    const dur = introAnimDuration();
    // Should be a fixed short duration, not a computed animation time
    expect(dur).toBeLessThan(1000);
  });
});
