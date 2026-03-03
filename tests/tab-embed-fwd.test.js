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

  // ── New matmul flow tests ──

  it('renders mini one-hot dots in token cells (overview mode)', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    const dots = wrap.querySelectorAll('.ef-mini-onehot');
    // One mini-onehot per token cell (B*L = 6)
    expect(dots.length).toBe(6);
    // Each has eH dots
    const s = getEfState();
    dots.forEach(dotGroup => {
      expect(dotGroup.querySelectorAll('.ef-mini-dot').length).toBe(s.eH);
    });
  });

  it('renders mini one-hot dots with correct active dot', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    const s = getEfState();
    const firstToken = s.tokenIds[0][0];
    const firstDotGroup = wrap.querySelector('.ef-mini-onehot');
    const activeDots = firstDotGroup.querySelectorAll('.ef-mini-dot.active');
    expect(activeDots.length).toBe(1);
    // The active dot index should match the token id
    const allDots = [...firstDotGroup.querySelectorAll('.ef-mini-dot')];
    const activeIndex = allDots.indexOf(activeDots[0]);
    expect(activeIndex).toBe(firstToken);
  });

  it('renders one-hot column when position is active', () => {
    efFwd(); // step 0
    efRender();
    const wrap = document.getElementById('efDisplay');
    const onehotCol = wrap.querySelector('.ef-onehot-col');
    expect(onehotCol).not.toBeNull();
    // Should have eH rows
    const s = getEfState();
    const rows = onehotCol.querySelectorAll('.ef-onehot-row');
    expect(rows.length).toBe(s.eH);
    // Exactly one cell should have value "1" with class 'cur'
    const curCells = onehotCol.querySelectorAll('.mat-cell.a.cur');
    expect(curCells.length).toBe(1);
    expect(curCells[0].textContent).toBe('1');
  });

  it('intermediate grid shows zeros for non-token rows', () => {
    efFwd();
    efRender();
    const wrap = document.getElementById('efDisplay');
    const interGrid = wrap.querySelector('.ef-inter-grid');
    expect(interGrid).not.toBeNull();
    const s = getEfState();
    const tok = s.tokenIds[0][0];
    const cells = interGrid.querySelectorAll('.mat-cell');
    // Total cells = eH * eC
    expect(cells.length).toBe(s.eH * s.eC);
    // Non-token rows should show "0"
    for (let h = 0; h < s.eH; h++) {
      for (let c = 0; c < s.eC; c++) {
        const cell = cells[h * s.eC + c];
        if (h !== tok) {
          expect(cell.textContent).toBe('0');
          expect(cell.classList.contains('empty')).toBe(true);
        }
      }
    }
  });

  it('intermediate grid shows W values for token row', () => {
    efFwd();
    efRender();
    const wrap = document.getElementById('efDisplay');
    const interGrid = wrap.querySelector('.ef-inter-grid');
    const s = getEfState();
    const tok = s.tokenIds[0][0];
    const cells = interGrid.querySelectorAll('.mat-cell');
    // Token row should show W values
    for (let c = 0; c < s.eC; c++) {
      const cell = cells[tok * s.eC + c];
      expect(cell.textContent).toBe(String(s.W[tok][c]));
      expect(cell.classList.contains('cur')).toBe(true);
    }
  });

  it('W table rows are faded when position is active', () => {
    efFwd();
    efRender();
    const wrap = document.getElementById('efDisplay');
    const fadedCells = wrap.querySelectorAll('.ef-w-row-faded');
    const s = getEfState();
    // (eH - 1) rows faded × eC cells each
    expect(fadedCells.length).toBe((s.eH - 1) * s.eC);
  });

  it('matmul flow layout appears in active mode', () => {
    efFwd();
    efRender();
    const wrap = document.getElementById('efDisplay');
    expect(wrap.querySelector('.ef-matmul-flow')).not.toBeNull();
  });

  it('overview mode has no matmul flow', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    expect(wrap.querySelector('.ef-matmul-flow')).toBeNull();
  });

  it('formula bar shows matmul decomposition in active mode', () => {
    efFwd();
    efRender();
    const f = document.getElementById('fEF');
    const s = getEfState();
    // Should contain Σ and W[h,:] terms
    expect(f.innerHTML).toContain('W[');
    expect(f.innerHTML).toContain(s.Y[0][0].join(', '));
  });
});
