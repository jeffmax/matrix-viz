import { describe, it, expect, beforeEach } from 'vitest';
import { computeData, I, K } from '../js/shared.js';
import { initIntroVecs, renderIntro, introStep, introAnimDuration } from '../js/tab-intro.js';

// Access the mutable introStep via the module — we use stepFwdIntro to advance
import { stepFwdIntro } from '../js/tab-intro.js';

describe('Bug 1: Tab 0 step 2 should not replay result animation', () => {
  beforeEach(() => {
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
