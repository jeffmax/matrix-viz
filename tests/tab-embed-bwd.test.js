import { describe, it, expect, beforeEach } from 'vitest';
import { ebInit, ebRender, ebFwd, ebBack, ebReset, ebJumpToPos,
         ebTraceBack, ebPause, getEbState } from '../js/tab-embed-bwd.js';

describe('tab-embed-bwd', () => {
  beforeEach(() => {
    ebInit(false); // deterministic for testing
  });

  it('initializes with correct dimensions', () => {
    const s = getEbState();
    expect(s.tokenIds.length).toBe(2);
    expect(s.tokenIds[0].length).toBe(3);
    expect(s.G.length).toBe(2);  // B
    expect(s.G[0].length).toBe(3); // L
    expect(s.G[0][0].length).toBe(3); // C
    expect(s.dW.length).toBe(4);  // H
    expect(s.dW[0].length).toBe(3); // C
  });

  it('starts at step -1 (overview)', () => {
    expect(getEbState().ebStep).toBe(-1);
  });

  it('renders token grid, gradient info, and dW accumulator', () => {
    ebRender();
    const wrap = document.getElementById('ebDisplay');
    expect(wrap.innerHTML).toContain('Tokens');
    expect(wrap.innerHTML).toContain('dW accumulator');
  });

  it('step forward advances position', () => {
    ebFwd();
    expect(getEbState().ebStep).toBe(0);
    ebFwd();
    expect(getEbState().ebStep).toBe(1);
  });

  it('accumulation: dW values update correctly as steps advance', () => {
    // With deterministic init (all G=1), stepping through should accumulate
    ebFwd(); // step 0: position (0,0), token = 0%4 = 0
    ebRender();
    const s0 = getEbState();
    // Token 0's row should have G[0,0,:] = [1,1,1] added
    expect(s0.dWAccum[0]).toEqual([1, 1, 1]);

    ebFwd(); // step 1: position (0,1), token = 1%4 = 1
    ebRender();
    const s1 = getEbState();
    expect(s1.dWAccum[1]).toEqual([1, 1, 1]);
    // Token 0 unchanged
    expect(s1.dWAccum[0]).toEqual([1, 1, 1]);
  });

  it('final step matches full dW', () => {
    for (let i = 0; i < 6; i++) ebFwd();
    ebRender();
    const s = getEbState();
    expect(s.dWAccum).toEqual(s.dW);
  });

  it('reset clears accumulator back to zeros', () => {
    ebFwd(); ebFwd();
    ebReset();
    const s = getEbState();
    expect(s.ebStep).toBe(-1);
    ebRender();
    const s2 = getEbState();
    for (const row of s2.dWAccum) {
      expect(row).toEqual([0, 0, 0]);
    }
  });

  it('trace-back sets selectedCell', () => {
    ebTraceBack(2, 1);
    expect(getEbState().ebSelectedCell).toEqual({ v: 2, c: 1 });
  });

  it('trace-back toggle clears selectedCell', () => {
    ebTraceBack(2, 1);
    ebTraceBack(2, 1);
    expect(getEbState().ebSelectedCell).toBeNull();
  });

  it('does not exceed total positions', () => {
    for (let i = 0; i < 10; i++) ebFwd();
    expect(getEbState().ebStep).toBe(5);
  });

  it('jumpToPos sets exact step', () => {
    ebJumpToPos(4);
    expect(getEbState().ebStep).toBe(4);
  });
});
