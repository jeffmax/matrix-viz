// ══════════════════════════════════════════════════
// TAB 3 — EMBEDDING FORWARD: blh,hc→blc (row selection)
// ══════════════════════════════════════════════════
// Pure 2D tab — no Three.js needed.
// Steps through (b,l) positions showing how one-hot × weight = row selection.

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

// ── Mini one-hot dots HTML ──
function renderMiniOneHot(tokenId) {
  let html = '<div class="ef-mini-onehot">';
  for (let h = 0; h < eH; h++) {
    html += `<div class="ef-mini-dot${h === tokenId ? ' active' : ''}"></div>`;
  }
  html += '</div>';
  return html;
}

// ── Token grid (shared between overview & active, active uses compact) ──
function renderTokenGrid(compact) {
  const cls = compact ? 'ef-token-grid ef-tokens-compact' : 'ef-token-grid';
  let html = `<div class="${cls}">`;
  for (let b = 0; b < eB; b++) {
    html += '<div class="ef-token-row">';
    for (let l = 0; l < eL; l++) {
      const p = blToPos(b, l);
      const active = efStep === p;
      const done = efStep > p;
      const tcls = active ? 'ef-token active' : done ? 'ef-token done' : 'ef-token';
      html += `<div class="${tcls}" onclick="efJumpToPos(${p})" title="batch ${b}, pos ${l}">`;
      html += `<span class="ef-tok-id">${tokenIds[b][l]}</span>`;
      html += `<span class="ef-tok-pos">[${b},${l}]</span>`;
      html += renderMiniOneHot(tokenIds[b][l]);
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// ── One-hot column for active position ──
function renderOneHot(b, l) {
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

// ── W table with row fading ──
function renderWTable(activeTokenId) {
  const fading = activeTokenId >= 0;
  let html = `<div class="ef-w-grid" style="grid-template-columns: auto repeat(${eC}, 40px)">`;
  // Header row
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

// ── Output vector for active position ──
function renderOutputVec(b, l) {
  let html = '<div style="display:flex;flex-direction:column;gap:3px">';
  for (let c = 0; c < eC; c++) {
    html += `<div class="mat-cell r cur" style="width:36px;height:36px;font-size:0.78rem" `
      + `onclick="efTraceBack(${b},${l},${c})">${Y[b][l][c]}</div>`;
  }
  html += '</div>';
  return html;
}

// ── Rendering ──
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
  let html = '<div class="ef-layout">';

  // Token grid with mini one-hot dots
  html += '<div class="ef-section">';
  html += '<div class="ef-section-label">Tokens X <span class="ef-dim">(B=' + eB + ', L=' + eL + ')</span></div>';
  html += renderTokenGrid(false);
  html += '</div>';

  // Embedding table W (no fading in overview)
  html += '<div class="ef-section">';
  html += '<div class="ef-section-label">Embedding W <span class="ef-dim">(H=' + eH + ', C=' + eC + ')</span></div>';
  html += renderWTable(-1);
  html += '</div>';

  // Output Y (all empty in overview)
  html += '<div class="ef-section">';
  html += '<div class="ef-section-label">Output Y <span class="ef-dim">(B=' + eB + ', L=' + eL + ', C=' + eC + ')</span></div>';
  html += '<div class="ef-output-grid">';
  for (let b = 0; b < eB; b++) {
    html += '<div class="ef-output-row">';
    for (let l = 0; l < eL; l++) {
      html += '<div class="ef-output-cell-group">';
      html += `<span class="ef-output-pos">[${b},${l}]</span>`;
      html += '<div class="ef-output-vec">';
      for (let c = 0; c < eC; c++) {
        html += `<div class="mat-cell r empty" style="width:36px;height:36px;font-size:0.78rem" `
          + `onclick="efTraceBack(${b},${l},${c})"></div>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div></div>';

  html += '</div>'; // ef-layout
  wrap.innerHTML = html;
}

function renderActivePosition(wrap) {
  const [b, l] = posTobl(efStep);
  const tok = tokenIds[b][l];

  let html = '';

  // Top row: compact token grid + output grid (positions filled so far)
  html += '<div class="ef-layout">';

  // Compact token grid
  html += '<div class="ef-section">';
  html += '<div class="ef-section-label">Tokens <span class="ef-dim">(B=' + eB + ', L=' + eL + ')</span></div>';
  html += renderTokenGrid(true);
  html += '</div>';

  // Output Y (filled up to current step)
  html += '<div class="ef-section">';
  html += '<div class="ef-section-label">Output Y <span class="ef-dim">(B=' + eB + ', L=' + eL + ', C=' + eC + ')</span></div>';
  html += '<div class="ef-output-grid">';
  for (let ob = 0; ob < eB; ob++) {
    html += '<div class="ef-output-row">';
    for (let ol = 0; ol < eL; ol++) {
      const p = blToPos(ob, ol);
      const active = efStep === p;
      const done = p <= efStep;
      html += '<div class="ef-output-cell-group' + (active ? ' active' : '') + '">';
      html += `<span class="ef-output-pos">[${ob},${ol}]</span>`;
      html += '<div class="ef-output-vec">';
      for (let c = 0; c < eC; c++) {
        const cellCls = active ? 'mat-cell r cur' :
                        done ? 'mat-cell r done' : 'mat-cell r empty';
        const val = done ? Y[ob][ol][c] : '';
        html += `<div class="${cellCls}" style="width:36px;height:36px;font-size:0.78rem" `
          + `onclick="efTraceBack(${ob},${ol},${c})">${val}</div>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div></div>';

  html += '</div>'; // ef-layout

  // Matmul flow: One-Hot × W = Intermediate Σ_h→ Output
  html += '<div class="ef-matmul-flow">';

  // One-hot column
  html += '<div class="ef-flow-section">';
  html += `<div class="ef-flow-label">X[${b},${l},:]</div>`;
  html += renderOneHot(b, l);
  html += '</div>';

  html += '<div class="ef-flow-sym">&times;</div>';

  // W table with fading
  html += '<div class="ef-flow-section">';
  html += '<div class="ef-flow-label">W</div>';
  html += renderWTable(tok);
  html += '</div>';

  html += '<div class="ef-flow-sym">=</div>';

  // Intermediate H×C grid
  html += '<div class="ef-flow-section">';
  html += `<div class="ef-flow-label">X[${b},${l},:] &middot; W</div>`;
  html += renderIntermediate(b, l);
  html += '</div>';

  html += '<div class="ef-flow-sym">&Sigma;<sub style="font-size:0.6em">h</sub>&rarr;</div>';

  // Output vector
  html += '<div class="ef-flow-section">';
  html += `<div class="ef-flow-label">Y[${b},${l},:]</div>`;
  html += renderOutputVec(b, l);
  html += '</div>';

  html += '</div>'; // ef-matmul-flow

  wrap.innerHTML = html;
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
      const style = h === tok ? 'font-weight:700' : 'opacity:0.3';
      terms.push(`<span style="${style}"><span class="fa">X[${b},${l},${h}]</span>&middot;<span class="fb">W[${h},${c}]</span> = ${xVal}&times;${wVal}</span>`);
    }
    f.innerHTML = `Y[${b},${l},${c}] = &Sigma;<sub>h</sub> X[${b},${l},h]&middot;W[h,${c}] = ${terms.join(' + ')} = <span class="fc">${Y[b][l][c]}</span>`
      + `<br><em style="color:#999;font-size:0.78rem">One-hot selects row ${tok} of W &mdash; it's just a lookup!</em>`;
    return;
  }

  if (efStep < 0) {
    f.innerHTML = `Each position (b,l) holds a one-hot vector. Multiplying by W selects a row &mdash; embedding lookup IS matrix multiplication. Press &#9654; to step through positions.`;
  } else {
    const [b, l] = posTobl(efStep);
    const tok = tokenIds[b][l];
    // Full matmul decomposition
    let terms = [];
    for (let h = 0; h < eH; h++) {
      const style = h === tok ? 'font-weight:700' : 'opacity:0.3';
      terms.push(`<span style="${style}">${X[b][l][h]}&middot;<span class="fb">W[${h},:]</span></span>`);
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
    efSelectedCell = null; // toggle off
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
  if (btn) btn.textContent = '⏸';
  efTick();
}

export function efPause() {
  efPlaying = false;
  clearTimeout(efTm);
  const btn = document.getElementById('pbEF');
  if (btn) btn.textContent = '▶';
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
