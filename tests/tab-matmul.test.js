import { describe, it, expect, beforeEach } from 'vitest';
import { computeData } from '../js/shared.js';
import { initScene } from '../js/scene.js';
import { rebuildBoxes } from '../js/cube-manager.js';
import { mmBuildDone, getOpHiTm, setOpHiTm, mmReset } from '../js/tab-matmul.js';

describe('Bug 2: mmBuildDone should not cancel highlight timer', () => {
  beforeEach(() => {
    computeData(true);
    initScene();
    rebuildBoxes();
    mmReset();
  });

  it('opHiTm survives mmBuildDone (highlight chain not killed)', () => {
    // Simulate a running highlight timer by setting opHiTm to a known timeout id
    const fakeTimer = setTimeout(() => {}, 10000);
    setOpHiTm(fakeTimer);

    // Before fix: mmBuildDone → mmPauseBuild → opStopHi → clears opHiTm to null
    // After fix: mmBuildDone → mmStopBuildTimer (no opStopHi) → opHiTm survives
    mmBuildDone();

    const hiTm = getOpHiTm();
    // The highlight timer should NOT have been cleared
    expect(hiTm).toBe(fakeTimer);

    clearTimeout(fakeTimer);
  });
});
