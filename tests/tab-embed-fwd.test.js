import { describe, it, expect, beforeEach } from 'vitest';
import { efInit, efRender, efFwd, efBack, efReset, efJumpToPos,
         efTraceBack, efPause, getEfState } from '../js/tab-embed-fwd.js';

describe('tab-embed-fwd', () => {
  beforeEach(() => {
    efInit(true);
  });

  it('initializes with correct dimensions', () => {
    const s = getEfState();
    expect(s.tokenIds.length).toBe(2);
    expect(s.tokenIds[0].length).toBe(3);
    expect(s.W.length).toBe(4);  // H
    expect(s.W[0].length).toBe(3); // C
    expect(s.Y.length).toBe(2);  // B
    expect(s.Y[0].length).toBe(3); // L
    expect(s.Y[0][0].length).toBe(3); // C
  });

  it('starts at step -1 (overview)', () => {
    expect(getEfState().efStep).toBe(-1);
  });

  it('renders token grid and embedding table at step -1', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    expect(wrap.innerHTML).toContain('Tokens X');
    expect(wrap.innerHTML).toContain('Embedding W');
    expect(wrap.innerHTML).toContain('Output Y');
  });

  it('step forward advances position', () => {
    efFwd();
    expect(getEfState().efStep).toBe(0);
    efFwd();
    expect(getEfState().efStep).toBe(1);
  });

  it('step back decreases position', () => {
    efFwd(); efFwd(); efFwd();
    efBack();
    expect(getEfState().efStep).toBe(1);
  });

  it('step back from 0 goes to -1 (overview)', () => {
    efFwd();
    efBack();
    expect(getEfState().efStep).toBe(-1);
  });

  it('does not go below -1', () => {
    efBack();
    expect(getEfState().efStep).toBe(-1);
  });

  it('does not exceed total positions', () => {
    for (let i = 0; i < 10; i++) efFwd();
    expect(getEfState().efStep).toBe(5); // B*L-1 = 2*3-1
  });

  it('reset returns to step -1', () => {
    efFwd(); efFwd();
    efReset();
    expect(getEfState().efStep).toBe(-1);
    expect(getEfState().efPlaying).toBe(false);
  });

  it('jumpToPos sets exact step', () => {
    efJumpToPos(3);
    expect(getEfState().efStep).toBe(3);
  });

  it('row selection: correct row of W is active for current token', () => {
    efFwd(); // step 0 = position (0,0)
    efRender();
    const s = getEfState();
    const tok = s.tokenIds[0][0];
    const wrap = document.getElementById('efDisplay');
    // The active row label should contain the token's h value
    const activeLabels = wrap.querySelectorAll('.ef-w-rowlabel.active');
    expect(activeLabels.length).toBe(1);
    expect(activeLabels[0].textContent).toBe('h=' + tok);
  });

  it('forward output Y matches row selection from W', () => {
    const s = getEfState();
    for (let b = 0; b < 2; b++) {
      for (let l = 0; l < 3; l++) {
        const tok = s.tokenIds[b][l];
        expect(s.Y[b][l]).toEqual(s.W[tok]);
      }
    }
  });

  it('trace-back sets selectedCell', () => {
    efTraceBack(1, 0, 2);
    const s = getEfState();
    expect(s.efSelectedCell).toEqual({ b: 1, l: 0, c: 2 });
  });

  it('trace-back toggle clears selectedCell', () => {
    efTraceBack(1, 0, 2);
    efTraceBack(1, 0, 2);
    expect(getEfState().efSelectedCell).toBeNull();
  });
});
