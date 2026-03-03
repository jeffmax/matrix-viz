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

  it('renders stacked tensor X and grid W at step -1', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    // Stacked tensor for X
    expect(wrap.querySelector('.ef-stacked-tensor')).not.toBeNull();
    // Grid for W
    expect(wrap.querySelector('.ef-tensor-with-axes')).not.toBeNull();
    // Tensor labels
    expect(wrap.innerHTML).toContain('X');
    expect(wrap.innerHTML).toContain('W');
    expect(wrap.innerHTML).toContain('Y');
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

  // ── Stacked tensor tests ──

  it('stacked tensor shows B pages for X', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    const pages = wrap.querySelectorAll('.ef-tensor-page');
    const s = getEfState();
    // X has B pages, Y has B pages = 2*B total in overview
    expect(pages.length).toBe(s.eB * 2);
  });

  it('axis labels present with contracted coloring for h', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    const contractedLabels = wrap.querySelectorAll('.ef-axis-label.contracted');
    // h axis appears on X (top) and W (left) = 2 contracted labels
    expect(contractedLabels.length).toBe(2);
  });

  it('prior pill renders with token grid tooltip', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    const pill = wrap.querySelector('.ef-prior-pill');
    expect(pill).not.toBeNull();
    expect(pill.textContent).toContain('F.one_hot');
    const tooltip = wrap.querySelector('.ef-pill-tooltip');
    expect(tooltip).not.toBeNull();
    // Tooltip shows token grid with batch labels and mini-onehot dots
    const tokenGrid = tooltip.querySelector('.ef-pill-token-grid');
    expect(tokenGrid).not.toBeNull();
    const s = getEfState();
    const batchLabels = tooltip.querySelectorAll('.ef-pill-batch-label');
    expect(batchLabels.length).toBe(s.eB);
    const tokenCells = tooltip.querySelectorAll('.ef-pill-token-cell');
    expect(tokenCells.length).toBe(s.eB * s.eL);
    // Each token cell has mini-onehot dots
    const dotGroups = tooltip.querySelectorAll('.ef-mini-onehot');
    expect(dotGroups.length).toBe(s.eB * s.eL);
  });

  // ── Contraction detail tests ──

  it('contraction detail appears in active mode', () => {
    efFwd();
    efRender();
    const wrap = document.getElementById('efDisplay');
    expect(wrap.querySelector('.ef-contraction-detail')).not.toBeNull();
  });

  it('overview mode has no contraction detail', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    expect(wrap.querySelector('.ef-contraction-detail')).toBeNull();
  });

  it('contraction detail: one-hot column has eH rows', () => {
    efFwd();
    efRender();
    const wrap = document.getElementById('efDisplay');
    const onehotCol = wrap.querySelector('.ef-onehot-col');
    expect(onehotCol).not.toBeNull();
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
    expect(cells.length).toBe(s.eH * s.eC);
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
    for (let c = 0; c < s.eC; c++) {
      const cell = cells[tok * s.eC + c];
      expect(cell.textContent).toBe(String(s.W[tok][c]));
      expect(cell.classList.contains('cur')).toBe(true);
    }
  });

  it('W grid rows are faded in contraction detail when position is active', () => {
    efFwd();
    efRender();
    const wrap = document.getElementById('efDisplay');
    // Contraction detail W table has faded rows
    const contraction = wrap.querySelector('.ef-contraction-detail');
    const fadedCells = contraction.querySelectorAll('.ef-w-row-faded');
    const s = getEfState();
    // (eH - 1) rows faded × eC cells each
    expect(fadedCells.length).toBe((s.eH - 1) * s.eC);
  });

  it('W grid has active row label for current token', () => {
    efFwd(); // step 0 = position (0,0)
    efRender();
    const s = getEfState();
    const tok = s.tokenIds[0][0];
    const wrap = document.getElementById('efDisplay');
    const activeLabels = wrap.querySelectorAll('.ef-w-rowlabel.active');
    expect(activeLabels.length).toBe(1);
    expect(activeLabels[0].textContent).toBe('h=' + tok);
  });

  it('formula bar shows Σ_h decomposition in active mode', () => {
    efFwd();
    efRender();
    const f = document.getElementById('fEF');
    const s = getEfState();
    expect(f.innerHTML).toContain('W[');
    expect(f.innerHTML).toContain(s.Y[0][0].join(', '));
  });

  it('overview formula mentions contracted axis h', () => {
    efRender();
    const f = document.getElementById('fEF');
    expect(f.innerHTML).toContain('contracted');
  });

  it('stacked tensors have expandable class when not playing', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    const expandables = wrap.querySelectorAll('.ef-stacked-tensor.expandable');
    expect(expandables.length).toBe(2); // X and Y
  });

  it('stacked tensor expands on mouseenter', () => {
    efRender();
    const wrap = document.getElementById('efDisplay');
    const stackedEl = wrap.querySelector('.ef-stacked-tensor.expandable');
    stackedEl.dispatchEvent(new Event('mouseenter'));
    expect(stackedEl.classList.contains('expanded')).toBe(true);
    stackedEl.dispatchEvent(new Event('mouseleave'));
    expect(stackedEl.classList.contains('expanded')).toBe(false);
  });

  it('active page highlights correct batch in X stacked tensor', () => {
    efJumpToPos(3); // position 3 = (b=1, l=0)
    efRender();
    const wrap = document.getElementById('efDisplay');
    const activePages = wrap.querySelectorAll('.ef-tensor-page.active-page');
    // One for X, one for Y
    expect(activePages.length).toBe(2);
    // Both should have b=1 in their header
    activePages.forEach(page => {
      const header = page.querySelector('.ef-page-header');
      expect(header.textContent).toContain('b=1');
    });
  });
});
