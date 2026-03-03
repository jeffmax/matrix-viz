// ══════════════════════════════════════════════════
// TAB 3 — EMBEDDING FORWARD: blh,hc→blc (row selection)
// ══════════════════════════════════════════════════
// Einsum-centric redesign: the einsum badge maps to labeled axes on tensors.
// Pure 2D tab — no Three.js needed.

import { generateTokens, generateEmbedding, computeForward } from './embed-data.js';

// ── State ──
let eB = 2, eL = 3, eH = 4, eC = 3;
let tokenIds = [], X = [], W = [], Y = [];
let efStep = -1;        // -1 = overview, 0..P-1 = stepping through positions
let efPlaying = false;
let efTm = null;
let efSelectedCell = null; // {b, l, c} for trace-back

const totalPositions = () => eB * eL;
const posTobl = (p) => [Math.floor(p / eL), p % eL];
const blToPos = (b, l) => b * eL + l;

// ── Init ──
export function efInit(randomize = true) {
  if (randomize) {
    const tok = generateTokens(eB, eL, eH);
    tokenIds = tok.tokenIds;
    X = tok.X;
    W = generateEmbedding(eH, eC);
  } else {
    tokenIds = Array.from({ length: eB }, () => Array.from({ length: eL }, (_, l) => l % eH));
    X = tokenIds.map(seq => seq.map(tok => { const oh = Array(eH).fill(0); oh[tok] = 1; return oh; }));
    W = Array.from({ length: eH }, () => Array(eC).fill(1));
  }
  Y = computeForward(X, W);
  efStep = -1;
  efPlaying = false;
  efSelectedCell = null;
}

// ══════════════════════════════════════════════════
// RENDERING HELPERS — pure functions (data+config → HTML)
// Designed for later extraction into shared einsum-viz utilities.
// ══════════════════════════════════════════════════

// ── Render a 2D grid with axis labels ──
// data2D[row][col], axisLabels: {top, left}, options: {highlight, cellClass, cellSize}
function renderGrid2D(data2D, axisLabels, options = {}) {
  const rows = data2D.length;
  const cols = data2D[0].length;
  const sz = options.cellSize || 36;
  const cellClass = options.cellClass || 'mat-cell b';
  const highlightRow = options.highlightRow ?? -1;
  const fadedRows = options.fadedRows ?? false;

  let html = '<div class="ef-tensor-with-axes">';

  // Top axis label
  if (axisLabels.top) {
    const cls = axisLabels.topContracted ? 'ef-axis-label contracted' : 'ef-axis-label';
    html += `<div class="ef-tensor-top-axis"><span class="${cls}">${axisLabels.top}</span></div>`;
  }

  html += '<div class="ef-tensor-body-row">';

  // Left axis label
  if (axisLabels.left) {
    const cls = axisLabels.leftContracted ? 'ef-axis-label contracted' : 'ef-axis-label';
    html += `<div class="ef-tensor-left-axis"><span class="${cls}">${axisLabels.left}</span></div>`;
  }

  // Grid
  html += `<div class="grid" style="grid-template-columns: repeat(${cols}, ${sz}px)">`;
  for (let r = 0; r < rows; r++) {
    const isActive = r === highlightRow;
    const isFaded = fadedRows && !isActive;
    for (let c = 0; c < cols; c++) {
      let cls = cellClass;
      if (isActive) cls += ' cur';
      if (isFaded) cls += ' ef-w-row-faded';
      const style = `width:${sz}px;height:${sz}px;font-size:0.78rem`;
      const extra = isFaded ? ';opacity:0.18' : '';
      html += `<div class="${cls}" style="${style}${extra}">${data2D[r][c]}</div>`;
    }
  }
  html += '</div>';

  html += '</div>'; // body-row
  html += '</div>'; // tensor-with-axes
  return html;
}

// ── Render a stacked 3D tensor as offset pages ──
// data3D[page][row][col], axisLabels: {top, left, pageLabel}
// options: {activePage, activeRow, cellRenderer, cellSize, emptyPages}
function renderStackedTensor(data3D, axisLabels, options = {}) {
  const pages = data3D.length;
  const rows = data3D[0].length;
  const cols = data3D[0][0].length;
  const sz = options.cellSize || 36;
  const activePage = options.activePage ?? -1;
  const activeRow = options.activeRow ?? -1;
  const cellRenderer = options.cellRenderer || ((val) => val);
  const emptyPages = options.emptyPages ?? false;
  const doneUpTo = options.doneUpTo ?? -1; // for Y: fill up to this (b,l) position
  const onCellClick = options.onCellClick || null;

  const offsetX = 6; // px right per back page
  const offsetY = 4; // px up per back page

  let html = '<div class="ef-tensor-with-axes">';

  // Top axis label
  if (axisLabels.top) {
    const cls = axisLabels.topContracted ? 'ef-axis-label contracted' : 'ef-axis-label';
    html += `<div class="ef-tensor-top-axis"><span class="${cls}">${axisLabels.top}</span></div>`;
  }

  html += '<div class="ef-tensor-body-row">';

  // Left axis label
  if (axisLabels.left) {
    const cls = axisLabels.leftContracted ? 'ef-axis-label contracted' : 'ef-axis-label';
    html += `<div class="ef-tensor-left-axis"><span class="${cls}">${axisLabels.left}</span></div>`;
  }

  // Calculate total stacked area
  const gridW = cols * (sz + 3) - 3;
  const gridH = rows * (sz + 3) - 3;
  const totalW = gridW + (pages - 1) * offsetX + 10;
  const totalH = gridH + (pages - 1) * offsetY + 30;

  const expandable = options.expandable ?? false;
  const expandCls = expandable ? ' expandable' : '';
  html += `<div class="ef-stacked-tensor${expandCls}" style="width:${totalW}px;height:${totalH}px">`;

  // Render pages back to front
  for (let p = pages - 1; p >= 0; p--) {
    const ox = p * offsetX;
    const oy = (pages - 1 - p) * offsetY;
    const isActive = p === activePage;
    const isFront = p === (activePage >= 0 ? activePage : 0);
    const pageCls = `ef-tensor-page${isFront ? ' front-page' : ' back-page'}${isActive ? ' active-page' : ''}`;

    html += `<div class="${pageCls}" style="left:${ox}px;top:${oy}px;z-index:${p === activePage ? 10 : p}">`;

    // Page header
    const headerCls = isActive ? 'ef-page-header active' : 'ef-page-header';
    html += `<div class="${headerCls}">${axisLabels.pageLabel || 'b'}=${p}</div>`;

    // Grid
    html += `<div class="grid" style="grid-template-columns: repeat(${cols}, ${sz}px)">`;
    for (let r = 0; r < rows; r++) {
      const isActiveRow = isActive && r === activeRow;
      for (let c = 0; c < cols; c++) {
        const val = data3D[p][r][c];
        const pos = blToPos(p, r);
        let rendered;
        if (emptyPages && doneUpTo < 0) {
          // All empty
          rendered = { text: '', cls: 'mat-cell r empty' };
        } else if (emptyPages && doneUpTo >= 0) {
          const done = pos <= doneUpTo;
          const cur = pos === doneUpTo;
          if (cur) rendered = { text: val, cls: 'mat-cell r cur' };
          else if (done) rendered = { text: val, cls: 'mat-cell r done' };
          else rendered = { text: '', cls: 'mat-cell r empty' };
        } else {
          rendered = cellRenderer(val, p, r, c, isActiveRow);
        }
        const click = onCellClick ? ` onclick="${onCellClick}(${p},${r},${c})"` : '';
        const rowHi = isActiveRow ? ' ef-row-highlight' : '';
        html += `<div class="${rendered.cls}${rowHi}" style="width:${sz}px;height:${sz}px;font-size:0.78rem"${click}>${rendered.text}</div>`;
      }
    }
    html += '</div>';
    html += '</div>'; // tensor-page
  }
  html += '</div>'; // stacked-tensor

  html += '</div>'; // body-row
  html += '</div>'; // tensor-with-axes
  return html;
}

// ── Wire hover-to-expand on stacked tensors ──
function wireStackedHover(container) {
  const stackeds = container.querySelectorAll('.ef-stacked-tensor.expandable');
  stackeds.forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (!efPlaying) el.classList.add('expanded');
    });
    el.addEventListener('mouseleave', () => {
      el.classList.remove('expanded');
    });
  });
}

// ── Mini one-hot dots HTML ──
function renderMiniOneHot(tokenId) {
  let html = '<div class="ef-mini-onehot">';
  for (let h = 0; h < eH; h++) {
    html += `<div class="ef-mini-dot${h === tokenId ? ' active' : ''}"></div>`;
  }
  html += '</div>';
  return html;
}

// ── Prior-step pill with hover tooltip showing token grid ──
function renderPriorPill() {
  let tooltip = '<div class="ef-pill-token-grid">';
  for (let b = 0; b < eB; b++) {
    tooltip += '<div class="ef-pill-token-row">';
    tooltip += `<span class="ef-pill-batch-label">b=${b}</span>`;
    for (let l = 0; l < eL; l++) {
      const tok = tokenIds[b][l];
      tooltip += '<div class="ef-pill-token-cell">';
      tooltip += `<span class="ef-pill-tok-id">${tok}</span>`;
      tooltip += renderMiniOneHot(tok);
      tooltip += '</div>';
    }
    tooltip += '</div>';
  }
  tooltip += '</div>';
  return `<div class="ef-prior-pill">F.one_hot(tokens) &rarr;`
    + `<div class="ef-pill-tooltip">${tooltip}</div></div>`;
}

// ── One-hot column for contraction detail ──
function renderOneHotSlice(b, l) {
  const tok = tokenIds[b][l];
  let html = '<div class="ef-onehot-col">';
  for (let h = 0; h < eH; h++) {
    const val = h === tok ? 1 : 0;
    const cls = val === 1 ? 'mat-cell a cur' : 'mat-cell a dim';
    html += '<div class="ef-onehot-row">';
    html += `<span class="ef-onehot-rowlabel">h=${h}</span>`;
    html += `<div class="${cls}" style="width:36px;height:36px;font-size:0.82rem">${val}</div>`;
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// ── W table with row fading for contraction ──
function renderWTable(activeTokenId) {
  const fading = activeTokenId >= 0;
  let html = `<div class="ef-w-grid" style="grid-template-columns: auto repeat(${eC}, 40px)">`;
  html += '<div class="ef-w-header"></div>';
  for (let c = 0; c < eC; c++) html += '<div class="ef-w-header">c' + c + '</div>';
  for (let h = 0; h < eH; h++) {
    const isActiveRow = fading && h === activeTokenId;
    const rowFaded = fading && !isActiveRow;
    html += `<div class="ef-w-rowlabel${isActiveRow ? ' active' : ''}"${rowFaded ? ' style="opacity:0.18"' : ''}>h=${h}</div>`;
    for (let c = 0; c < eC; c++) {
      const cls = isActiveRow ? 'mat-cell b cur' : 'mat-cell b';
      html += `<div class="${cls}${rowFaded ? ' ef-w-row-faded' : ''}" style="width:40px;height:40px;font-size:0.82rem">${W[h][c]}</div>`;
    }
  }
  html += '</div>';
  return html;
}

// ── Intermediate H×C grid ──
function renderIntermediate(b, l) {
  const tok = tokenIds[b][l];
  let html = `<div class="ef-inter-grid" style="grid-template-columns: repeat(${eC}, 36px)">`;
  for (let h = 0; h < eH; h++) {
    const isActive = h === tok;
    for (let c = 0; c < eC; c++) {
      const val = X[b][l][h] * W[h][c];
      if (isActive) {
        html += `<div class="mat-cell r cur" style="width:36px;height:36px;font-size:0.78rem">${val}</div>`;
      } else {
        html += `<div class="mat-cell r empty" style="width:36px;height:36px;font-size:0.72rem;opacity:0.25">0</div>`;
      }
    }
  }
  html += '</div>';
  return html;
}

// ── Output vector for contraction result ──
function renderOutputVec(b, l) {
  let html = '<div style="display:flex;flex-direction:column;gap:3px">';
  for (let c = 0; c < eC; c++) {
    html += `<div class="mat-cell r cur" style="width:36px;height:36px;font-size:0.78rem" `
      + `onclick="efTraceBack(${b},${l},${c})">${Y[b][l][c]}</div>`;
  }
  html += '</div>';
  return html;
}

// ── Contraction detail panel (horizontal flow) ──
function renderContractionDetail(b, l) {
  const tok = tokenIds[b][l];

  let html = '<div class="ef-contraction-detail">';

  // One-hot slice
  html += '<div class="ef-contraction-section">';
  html += `<div class="ef-contraction-label">X[${b},${l},:]</div>`;
  html += renderOneHotSlice(b, l);
  html += '</div>';

  html += '<div class="ef-contraction-sym">&times;</div>';

  // W table with fading
  html += '<div class="ef-contraction-section">';
  html += '<div class="ef-contraction-label">W</div>';
  html += renderWTable(tok);
  html += '</div>';

  html += '<div class="ef-contraction-sym">=</div>';

  // Intermediate H×C grid
  html += '<div class="ef-contraction-section">';
  html += `<div class="ef-contraction-label">X[${b},${l},:] &middot; W</div>`;
  html += renderIntermediate(b, l);
  html += '</div>';

  html += '<div class="ef-contraction-sym">&Sigma;<sub style="font-size:0.6em">h</sub>&rarr;</div>';

  // Output vector
  html += '<div class="ef-contraction-section">';
  html += `<div class="ef-contraction-label">Y[${b},${l},:]</div>`;
  html += renderOutputVec(b, l);
  html += '</div>';

  html += '</div>';
  return html;
}

// ══════════════════════════════════════════════════
// MAIN RENDERING
// ══════════════════════════════════════════════════

export function efRender() {
  const wrap = document.getElementById('efDisplay');
  if (!wrap) return;

  if (efStep < 0) {
    renderOverview(wrap);
  } else {
    renderActivePosition(wrap);
  }
  efUpdateFormula();
  efUpdateDots();
}

function renderOverview(wrap) {
  let html = '<div class="ef-tensor-row">';

  // Prior pill — positioned left, outside the main tensor row
  html += '<div class="ef-pill-block">';
  html += renderPriorPill();
  html += '</div>';

  html += '<div class="ef-overview-tensors">';

  // X tensor (B×L×H) — stacked pages
  const xCellRenderer = (val, p, r, c, isActiveRow) => {
    if (val === 1) return { text: '1', cls: 'mat-cell a' };
    return { text: '0', cls: 'mat-cell a dim' };
  };
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">X <span class="ef-dim">(B=' + eB + ', L=' + eL + ', H=' + eH + ')</span></div>';
  html += renderStackedTensor(X, {
    top: 'h &rarr;', topContracted: true,
    left: 'l &darr;', leftContracted: false,
    pageLabel: 'b'
  }, { cellRenderer: xCellRenderer, cellSize: 32, expandable: !efPlaying });
  html += '</div>';

  // W tensor (H×C) — 2D grid
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">W <span class="ef-dim">(H=' + eH + ', C=' + eC + ')</span></div>';
  html += renderGrid2D(W, {
    top: 'c &rarr;', topContracted: false,
    left: 'h &darr;', leftContracted: true
  }, { cellClass: 'mat-cell b', cellSize: 38 });
  html += '</div>';

  // Y tensor (B×L×C) — stacked pages, empty
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">Y <span class="ef-dim">(B=' + eB + ', L=' + eL + ', C=' + eC + ')</span></div>';
  html += renderStackedTensor(Y, {
    top: 'c &rarr;', topContracted: false,
    left: 'l &darr;', leftContracted: false,
    pageLabel: 'b'
  }, { emptyPages: true, cellSize: 32, onCellClick: 'efTraceBack', expandable: !efPlaying });
  html += '</div>';

  html += '</div>'; // ef-overview-tensors
  html += '</div>'; // ef-tensor-row
  wrap.innerHTML = html;
  wireStackedHover(wrap);
}

function renderActivePosition(wrap) {
  const [b, l] = posTobl(efStep);
  const tok = tokenIds[b][l];

  let html = '<div class="ef-tensor-row">';

  // Prior pill — positioned left
  html += '<div class="ef-pill-block">';
  html += renderPriorPill();
  html += '</div>';

  html += '<div class="ef-overview-tensors">';

  // X tensor with active row highlighted
  const xCellRenderer = (val, p, r, c, isActiveRow) => {
    if (val === 1) {
      return { text: '1', cls: isActiveRow ? 'mat-cell a cur' : 'mat-cell a' };
    }
    return { text: '0', cls: isActiveRow ? 'mat-cell a dim' : 'mat-cell a dim' };
  };
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">X <span class="ef-dim">(B=' + eB + ', L=' + eL + ', H=' + eH + ')</span></div>';
  html += renderStackedTensor(X, {
    top: 'h &rarr;', topContracted: true,
    left: 'l &darr;', leftContracted: false,
    pageLabel: 'b'
  }, { activePage: b, activeRow: l, cellRenderer: xCellRenderer, cellSize: 32, expandable: !efPlaying });
  html += '</div>';

  // W tensor with active row
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">W <span class="ef-dim">(H=' + eH + ', C=' + eC + ')</span></div>';
  html += renderGrid2D(W, {
    top: 'c &rarr;', topContracted: false,
    left: 'h &darr;', leftContracted: true
  }, { cellClass: 'mat-cell b', cellSize: 38, highlightRow: tok, fadedRows: true });
  html += '</div>';

  // Y tensor — filled up to current step
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">Y <span class="ef-dim">(B=' + eB + ', L=' + eL + ', C=' + eC + ')</span></div>';
  html += renderStackedTensor(Y, {
    top: 'c &rarr;', topContracted: false,
    left: 'l &darr;', leftContracted: false,
    pageLabel: 'b'
  }, { emptyPages: true, doneUpTo: efStep, activePage: b, cellSize: 32, onCellClick: 'efTraceBack', expandable: !efPlaying });
  html += '</div>';

  html += '</div>'; // ef-overview-tensors
  html += '</div>'; // ef-tensor-row

  // Contraction detail panel below
  html += renderContractionDetail(b, l);

  wrap.innerHTML = html;
  wireStackedHover(wrap);
}

function efUpdateFormula() {
  const f = document.getElementById('fEF');
  if (!f) return;

  if (efSelectedCell) {
    const { b, l, c } = efSelectedCell;
    const tok = tokenIds[b][l];
    let terms = [];
    for (let h = 0; h < eH; h++) {
      const xVal = X[b][l][h];
      const wVal = W[h][c];
      const cls = h === tok ? 'ef-term-live' : 'ef-term-zero';
      terms.push(`<span class="${cls}"><span class="fa">X[${b},${l},${h}]</span>&middot;<span class="fb">W[${h},${c}]</span> = ${xVal}&times;${wVal}</span>`);
    }
    f.innerHTML = `Y[${b},${l},${c}] = &Sigma;<sub>h</sub> X[${b},${l},h]&middot;W[h,${c}] = ${terms.join(' + ')} = <span class="fc">${Y[b][l][c]}</span>`
      + `<br><em style="color:#999;font-size:0.78rem">One-hot selects row ${tok} of W &mdash; it's just a lookup!</em>`;
    return;
  }

  if (efStep < 0) {
    f.innerHTML = `<span class="ei-contract" style="font-size:0.82rem">h</span> is the contracted axis &mdash; each position's one-hot selects a row of W. Press &#9654; to step through.`;
  } else {
    const [b, l] = posTobl(efStep);
    const tok = tokenIds[b][l];
    let terms = [];
    for (let h = 0; h < eH; h++) {
      const cls = h === tok ? 'ef-term-live' : 'ef-term-zero';
      terms.push(`<span class="${cls}">${X[b][l][h]}&middot;<span class="fb">W[${h},:]</span></span>`);
    }
    f.innerHTML = `Y[${b},${l},:] = &Sigma;<sub>h</sub> X[${b},${l},h]&middot;W[h,:] = ${terms.join(' + ')} = <span class="fb">W[${tok},:]</span> = <span class="fc">[${Y[b][l].join(', ')}]</span>`;
  }
}

function efUpdateDots() {
  const el = document.getElementById('dEF');
  if (!el) return;
  el.innerHTML = '';
  const P = totalPositions();
  for (let p = 0; p < P; p++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    if (efStep > p) dot.classList.add('done');
    else if (efStep === p) dot.classList.add('cur');
    el.appendChild(dot);
  }
}

// ── Trace-back ──
export function efTraceBack(b, l, c) {
  if (efSelectedCell && efSelectedCell.b === b && efSelectedCell.l === l && efSelectedCell.c === c) {
    efSelectedCell = null;
  } else {
    efSelectedCell = { b, l, c };
  }
  efUpdateFormula();
}

// ── Playback ──
function efDelay() { return 1400 - parseInt(document.getElementById('spEF')?.value || 600); }

export function efFwd() {
  efPause();
  efSelectedCell = null;
  if (efStep < totalPositions() - 1) { efStep++; efRender(); }
}

export function efBack() {
  efPause();
  efSelectedCell = null;
  if (efStep > -1) { efStep--; efRender(); }
}

export function efToggle() {
  if (efPlaying) efPause();
  else efPlay();
}

function efPlay() {
  if (efStep >= totalPositions() - 1) efStep = -1;
  efPlaying = true;
  const btn = document.getElementById('pbEF');
  if (btn) btn.textContent = '\u23F8';
  efTick();
}

export function efPause() {
  efPlaying = false;
  clearTimeout(efTm);
  const btn = document.getElementById('pbEF');
  if (btn) btn.textContent = '\u25B6';
}

function efTick() {
  if (!efPlaying) return;
  if (efStep < totalPositions() - 1) {
    efStep++;
    efRender();
    efTm = setTimeout(efTick, efDelay());
  } else {
    efPause();
  }
}

export function efReset() {
  efPause();
  efStep = -1;
  efSelectedCell = null;
  efRender();
}

export function efJumpToPos(p) {
  efPause();
  efSelectedCell = null;
  efStep = p;
  efRender();
}

// ── Dimension changes ──
export function efChangeDim(dim, delta) {
  if (dim === 'B') eB = Math.max(1, Math.min(4, eB + delta));
  else if (dim === 'L') eL = Math.max(1, Math.min(4, eL + delta));
  else if (dim === 'H') eH = Math.max(2, Math.min(5, eH + delta));
  else if (dim === 'C') eC = Math.max(1, Math.min(5, eC + delta));
  efInit(true);
  efRender();
}

// ── Getters for tests ──
/* @testable */
export function getEfState() {
  return { eB, eL, eH, eC, tokenIds, X, W, Y, efStep, efPlaying, efSelectedCell };
}
