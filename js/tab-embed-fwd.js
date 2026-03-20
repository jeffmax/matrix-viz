// ══════════════════════════════════════════════════
// TAB 3 — EMBEDDING FORWARD: btv,vc→btc (row selection)
// ══════════════════════════════════════════════════
// Einsum-centric redesign: the einsum badge maps to labeled axes on tensors.
// Pure 2D tab — no Three.js needed.

import { generateTokens, generateEmbedding, computeForward } from './embed-data.js';

// ── State ──
let eB = 2, eT = 3, eV = 4, eC = 3;
let tokenIds = [], X = [], W = [], Y = [];
let efStep = -1;        // -1 = overview, 0..P-1 = stepping through positions
let efPlaying = false;
let efTm = null;
let efSelectedCell = null; // {b, l, c} for trace-back
let efDetail = true;       // detail mode (show element-by-element breakdown) — default ON

const totalPositions = () => eB * eT;
const posTobl = (p) => [Math.floor(p / eT), p % eT];
const blToPos = (b, l) => b * eT + l;

// ── Init ──
export function efInit(randomize = true) {
  if (randomize) {
    const tok = generateTokens(eB, eT, eV);
    tokenIds = tok.tokenIds;
    X = tok.X;
    W = generateEmbedding(eV, eC);
  } else {
    tokenIds = Array.from({ length: eB }, () => Array.from({ length: eT }, (_, l) => l % eV));
    X = tokenIds.map(seq => seq.map(tok => { const oh = Array(eV).fill(0); oh[tok] = 1; return oh; }));
    W = Array.from({ length: eV }, () => Array(eC).fill(1));
  }
  Y = computeForward(X, W);
  efStep = -1;
  efPlaying = false;
  efSelectedCell = null;
  efDetail = true;
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
  const rowLabels = options.rowLabels || null; // rowLabels[page][row] → label string

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
  const labelExtra = rowLabels ? 24 : 0;
  const gridW = cols * (sz + 3) - 3 + labelExtra;
  const gridH = rows * (sz + 3) - 3;
  const totalW = gridW + (pages - 1) * offsetX + 10;
  const totalH = gridH + (pages - 1) * offsetY + 30;

  const expandable = options.expandable ?? false;
  const expandCls = expandable ? ' expandable' : '';
  // Wrapper keeps original dimensions when the stacked tensor goes absolute on expand
  if (expandable) {
    html += `<div class="ef-stacked-anchor" style="width:${totalW}px;height:${totalH}px;position:relative">`;
  }
  html += `<div class="ef-stacked-tensor${expandCls}" style="width:${totalW}px;height:${totalH}px">`;

  // Render pages back to front (b=0 on top, higher batches behind/below)
  for (let p = pages - 1; p >= 0; p--) {
    const ox = (pages - 1 - p) * offsetX;
    const oy = p * offsetY;
    const isActive = p === activePage;
    const isFront = p === (activePage >= 0 ? activePage : 0);
    const pageCls = `ef-tensor-page${isFront ? ' front-page' : ' back-page'}${isActive ? ' active-page' : ''}`;

    html += `<div class="${pageCls}" data-page="${p}" style="left:${ox}px;top:${oy}px;z-index:${p === activePage ? 10 : pages - 1 - p}">`;

    // Page header
    const headerCls = isActive ? 'ef-page-header active' : 'ef-page-header';
    html += `<div class="${headerCls}">${axisLabels.pageLabel || 'b'}=${p}</div>`;

    // Grid
    const labelCol = rowLabels ? 'auto ' : '';
    html += `<div class="grid" style="grid-template-columns: ${labelCol}repeat(${cols}, ${sz}px)">`;
    for (let r = 0; r < rows; r++) {
      const isActiveRow = isActive && r === activeRow;
      if (rowLabels) {
        const lbl = rowLabels[p] ? (rowLabels[p][r] ?? '') : '';
        const lblCls = isActiveRow ? 'ef-row-label active' : 'ef-row-label';
        html += `<div class="${lblCls}">${lbl}</div>`;
      }
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
  if (expandable) {
    html += '</div>'; // ef-stacked-anchor
  }

  html += '</div>'; // body-row
  html += '</div>'; // tensor-with-axes
  return html;
}

// ── Wire hover-to-expand on stacked tensors ──
function wireStackedHover(container) {
  const anchors = container.querySelectorAll('.ef-stacked-anchor');
  anchors.forEach(anchor => {
    const el = anchor.querySelector('.ef-stacked-tensor.expandable');
    if (!el) return;
    anchor.addEventListener('mouseenter', () => {
      if (efPlaying) return;
      el.classList.add('expanded');
      // Sort pages ascending by data-page so b=0 is on top, b=1 below, etc.
      const pages = Array.from(el.querySelectorAll('.ef-tensor-page'));
      pages.sort((a, b) => +a.dataset.page - +b.dataset.page);
      pages.forEach(p => el.appendChild(p));
      // Shift container up so the active (front) page stays under the mouse
      const front = el.querySelector('.ef-tensor-page.front-page');
      if (front) {
        const offsetTop = front.offsetTop;
        el.style.top = (-offsetTop) + 'px';
      }
    });
    anchor.addEventListener('mouseleave', () => {
      el.classList.remove('expanded');
      el.style.top = '';
    });
  });
}

// ── Mini one-hot dots HTML ──
function renderMiniOneHot(tokenId) {
  let html = '<div class="ef-mini-onehot">';
  for (let v = 0; v < eV; v++) {
    html += `<div class="ef-mini-dot${v === tokenId ? ' active' : ''}"></div>`;
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
    for (let l = 0; l < eT; l++) {
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

// ── One-hot row for contraction detail (horizontal, matches X display) ──
function renderOneHotRow(b, l) {
  const tok = tokenIds[b][l];
  let html = '<div class="ef-hrow">';
  for (let v = 0; v < eV; v++) {
    const val = v === tok ? 1 : 0;
    const cls = val === 1 ? 'mat-cell a cur' : 'mat-cell a dim';
    html += `<div class="${cls}" style="width:32px;height:32px;font-size:0.78rem">${val}</div>`;
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
  for (let v = 0; v < eV; v++) {
    const isActiveRow = fading && v === activeTokenId;
    const rowFaded = fading && !isActiveRow;
    html += `<div class="ef-w-rowlabel${isActiveRow ? ' active' : ''}"${rowFaded ? ' style="opacity:0.18"' : ''}>v=${v}</div>`;
    for (let c = 0; c < eC; c++) {
      const cls = isActiveRow ? 'mat-cell b cur' : 'mat-cell b';
      html += `<div class="${cls}${rowFaded ? ' ef-w-row-faded' : ''}" style="width:40px;height:40px;font-size:0.82rem">${W[v][c]}</div>`;
    }
  }
  html += '</div>';
  return html;
}

// ── Dot-product sub-viz for detail mode (mirrors matmul tab pattern) ──
// Shows C dot products: X[b,l,:] · W[:,c] = Y[b,l,c] for each output column c
function renderDotProducts(b, l) {
  const tok = tokenIds[b][l];
  let html = '<div class="ef-dot-products">';

  // Show all C dot products side by side
  for (let c = 0; c < eC; c++) {
    html += `<div class="ef-dot-col">`;
    html += `<div class="ef-dot-header">Y[${b},${l},${c}]</div>`;

    // X[b,l,:] as horizontal row  ·  W[:,c] as vertical column  =  result
    html += '<div class="dp-sub-viz-vectors">';

    // X[b,t,:] — one-hot row (horizontal)
    html += '<div class="dp-sub-viz-vec">';
    for (let v = 0; v < eV; v++) {
      const xVal = X[b][l][v];
      const cls = v === tok ? 'mat-cell a cur' : 'mat-cell a dim';
      html += `<div class="${cls}" style="width:32px;height:32px;font-size:0.78rem">${xVal}</div>`;
    }
    html += '</div>';

    html += '<span style="font-size:1.1rem;color:#bbb;font-weight:300">&middot;</span>';

    // W[:,c] — column of W (vertical)
    html += '<div class="dp-sub-viz-vec col">';
    for (let v = 0; v < eV; v++) {
      const cls = v === tok ? 'mat-cell b cur' : 'mat-cell b';
      html += `<div class="${cls}" style="width:32px;height:32px;font-size:0.78rem">${W[v][c]}</div>`;
    }
    html += '</div>';

    html += '<span style="font-size:1.1rem;color:#bbb;font-weight:300">=</span>';

    // Result scalar
    html += `<div class="mat-cell r cur" style="width:36px;height:36px;font-size:0.95rem;font-weight:700" onclick="efTraceBack(${b},${l},${c})">${Y[b][l][c]}</div>`;
    html += '</div>'; // dp-sub-viz-vectors

    // Products line
    html += '<div class="dp-products" style="justify-content:center"><span style="color:#666;font-size:0.72rem">Products:</span> ';
    for (let v = 0; v < eV; v++) {
      const prod = X[b][l][v] * W[v][c];
      const cls = v === tok ? 'dp-term dp-term-prod cur' : 'dp-term dp-term-prod dim';
      html += `<span class="${cls}">${prod}</span>`;
      if (v < eV - 1) html += ' <span style="color:#ccc">+</span> ';
    }
    html += '</div>';

    // Sum line
    html += `<div class="dp-sum-line" style="justify-content:center"><span style="color:#666;font-size:0.72rem">Sum:</span> <span class="dp-accum">${Y[b][l][c]}</span></div>`;

    html += '</div>'; // ef-dot-col
  }

  html += '</div>'; // ef-dot-products

  // Insight
  html += `<div class="ef-term-insight">Only v=${tok} contributes (the rest multiply by 0). The &ldquo;dot product&rdquo; just selects row ${tok} of W.</div>`;

  return html;
}

// ── Output row for contraction result (horizontal) ──
function renderOutputRow(b, l) {
  let html = '<div class="ef-hrow">';
  for (let c = 0; c < eC; c++) {
    html += `<div class="mat-cell r cur" style="width:32px;height:32px;font-size:0.78rem" `
      + `onclick="efTraceBack(${b},${l},${c})">${Y[b][l][c]}</div>`;
  }
  html += '</div>';
  return html;
}

// ── Contraction detail panel ──
function renderContractionDetail(b, l) {
  const tok = tokenIds[b][l];

  if (!efDetail) {
    // Compact: X[b,l,:] × W → W[tok,:] = Y[b,l,:]
    let html = '<div class="ef-subviz">';

    // Row 1: X row → W → result
    html += '<div class="ef-subviz-row">';

    html += '<div class="ef-subviz-section">';
    html += `<div class="ef-subviz-label">X[${b},${l},:] (1&times;${eV})</div>`;
    html += renderOneHotRow(b, l);
    html += '</div>';

    html += '<div class="ef-subviz-sym">&times;</div>';

    html += '<div class="ef-subviz-section">';
    html += `<div class="ef-subviz-label">W (${eV}&times;${eC})</div>`;
    html += renderWTable(tok);
    html += '</div>';

    html += '<div class="ef-subviz-sym">=</div>';

    html += '<div class="ef-subviz-section">';
    html += `<div class="ef-subviz-label">W[${tok},:] = Y[${b},${l},:]</div>`;
    html += renderOutputRow(b, l);
    html += '</div>';

    html += '</div>'; // subviz-row
    html += '</div>'; // subviz
    return html;
  }

  // Detail mode: dot-product breakdown (same pattern as matmul tab)
  let html = '<div class="ef-subviz">';
  html += `<div class="ef-subviz-label" style="margin-bottom:6px">Y[${b},${l},c] = X[${b},${l},:] &middot; W[:,c]  &mdash;  one dot product per output column:</div>`;
  html += renderDotProducts(b, l);
  html += '</div>'; // subviz
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

  // Prior pill — to the left of the tensors
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
  html += '<div class="ef-tensor-label">X <span class="ef-dim">(B=' + eB + ', T=' + eT + ', V=' + eV + ')</span></div>';
  html += renderStackedTensor(X, {
    top: 'v &rarr;', topContracted: true,
    left: 't &darr;', leftContracted: false,
    pageLabel: 'b'
  }, { cellRenderer: xCellRenderer, cellSize: 32, expandable: !efPlaying, rowLabels: tokenIds });
  html += '</div>';

  // W tensor (H×C) — 2D grid
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">W <span class="ef-dim">(V=' + eV + ', C=' + eC + ')</span></div>';
  html += renderGrid2D(W, {
    top: 'c &rarr;', topContracted: false,
    left: 'v &darr;', leftContracted: true
  }, { cellClass: 'mat-cell b', cellSize: 38 });
  html += '</div>';

  // Y tensor (B×L×C) — stacked pages, empty
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">Y <span class="ef-dim">(B=' + eB + ', T=' + eT + ', C=' + eC + ')</span></div>';
  html += renderStackedTensor(Y, {
    top: 'c &rarr;', topContracted: false,
    left: 't &darr;', leftContracted: false,
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

  // Prior pill — to the left of the tensors
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
  html += '<div class="ef-tensor-label">X <span class="ef-dim">(B=' + eB + ', T=' + eT + ', V=' + eV + ')</span></div>';
  html += renderStackedTensor(X, {
    top: 'v &rarr;', topContracted: true,
    left: 't &darr;', leftContracted: false,
    pageLabel: 'b'
  }, { activePage: b, activeRow: l, cellRenderer: xCellRenderer, cellSize: 32, expandable: !efPlaying, rowLabels: tokenIds });
  html += '</div>';

  // W tensor with active row
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">W <span class="ef-dim">(V=' + eV + ', C=' + eC + ')</span></div>';
  html += renderGrid2D(W, {
    top: 'c &rarr;', topContracted: false,
    left: 'v &darr;', leftContracted: true
  }, { cellClass: 'mat-cell b', cellSize: 38, highlightRow: tok, fadedRows: true });
  html += '</div>';

  // Y tensor — filled up to current step
  html += '<div class="ef-tensor-block">';
  html += '<div class="ef-tensor-label">Y <span class="ef-dim">(B=' + eB + ', T=' + eT + ', C=' + eC + ')</span></div>';
  html += renderStackedTensor(Y, {
    top: 'c &rarr;', topContracted: false,
    left: 't &darr;', leftContracted: false,
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
    for (let v = 0; v < eV; v++) {
      const xVal = X[b][l][v];
      const wVal = W[v][c];
      const cls = v === tok ? 'ef-term-live' : 'ef-term-zero';
      terms.push(`<span class="${cls}"><span class="fa">X[${b},${l},${v}]</span>&middot;<span class="fb">W[${v},${c}]</span> = ${xVal}&times;${wVal}</span>`);
    }
    f.innerHTML = `Y[${b},${l},${c}] = &Sigma;<sub>v</sub> X[${b},${l},v]&middot;W[v,${c}] = ${terms.join(' + ')} = <span class="fc">${Y[b][l][c]}</span>`
      + `<br><em style="color:#999;font-size:0.78rem">One-hot selects row ${tok} of W &mdash; it's just a lookup!</em>`;
    return;
  }

  if (efStep < 0) {
    f.innerHTML = `<span class="ei-contract" style="font-size:0.82rem">v</span> is the contracted axis (vocab) &mdash; each position's one-hot selects a row of W. Press &#9654; to step through.`;
  } else {
    const [b, l] = posTobl(efStep);
    const tok = tokenIds[b][l];
    let terms = [];
    for (let v = 0; v < eV; v++) {
      const cls = v === tok ? 'ef-term-live' : 'ef-term-zero';
      terms.push(`<span class="${cls}">${X[b][l][v]}&middot;<span class="fb">W[${v},:]</span></span>`);
    }
    f.innerHTML = `Y[${b},${l},:] = &Sigma;<sub>v</sub> X[${b},${l},v]&middot;W[v,:] = ${terms.join(' + ')} = <span class="fb">W[${tok},:]</span> = <span class="fc">[${Y[b][l].join(', ')}]</span>`;
  }
}

function efUpdateDots() {
  const el = document.getElementById('dEF');
  if (!el) return;
  el.innerHTML = '';
  const P = totalPositions();
  for (let s = 0; s < P; s++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    if (efStep > s) dot.classList.add('done');
    else if (efStep === s) dot.classList.add('cur');
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
    efRender(); // re-render so stacked tensors get expandable class back
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

// ── Detail toggle ──
export function efToggleDetail() {
  efDetail = !!document.getElementById('chkEfDetail')?.checked;
  efRender();
}

// ── Dimension changes ──
export function efChangeDim(dim, delta) {
  if (dim === 'B') eB = Math.max(1, Math.min(4, eB + delta));
  else if (dim === 'T') eT = Math.max(1, Math.min(4, eT + delta));
  else if (dim === 'V') eV = Math.max(2, Math.min(5, eV + delta));
  else if (dim === 'C') eC = Math.max(1, Math.min(5, eC + delta));
  efInit(true);
  efRender();
}

// ── Getters for tests ──
/* @testable */
export function getEfState() {
  return { eB, eT, eV, eC, tokenIds, X, W, Y, efStep, efPlaying, efSelectedCell, efDetail };
}
