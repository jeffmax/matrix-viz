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

// ── Rendering ──
export function efRender() {
  const wrap = document.getElementById('efDisplay');
  if (!wrap) return;

  let html = '<div class="ef-layout">';

  // Token grid
  html += '<div class="ef-section">';
  html += '<div class="ef-section-label">Tokens X <span class="ef-dim">(B=' + eB + ', L=' + eL + ')</span></div>';
  html += '<div class="ef-token-grid">';
  for (let b = 0; b < eB; b++) {
    html += '<div class="ef-token-row">';
    for (let l = 0; l < eL; l++) {
      const p = blToPos(b, l);
      const active = efStep === p;
      const done = efStep > p;
      const cls = active ? 'ef-token active' : done ? 'ef-token done' : 'ef-token';
      html += `<div class="${cls}" onclick="efJumpToPos(${p})" title="batch ${b}, pos ${l}">`;
      html += `<span class="ef-tok-id">${tokenIds[b][l]}</span>`;
      html += `<span class="ef-tok-pos">[${b},${l}]</span>`;
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div></div>';

  // Embedding table W
  html += '<div class="ef-section">';
  html += '<div class="ef-section-label">Embedding W <span class="ef-dim">(H=' + eH + ', C=' + eC + ')</span></div>';
  html += `<div class="ef-w-grid" style="grid-template-columns: auto repeat(${eC}, 40px)">`;
  // Header row (c indices)
  html += '<div class="ef-w-header"></div>';
  for (let c = 0; c < eC; c++) html += '<div class="ef-w-header">c' + c + '</div>';
  for (let h = 0; h < eH; h++) {
    const [ab, al] = efStep >= 0 ? posTobl(efStep) : [-1, -1];
    const isActiveRow = efStep >= 0 && tokenIds[ab]?.[al] === h;
    html += `<div class="ef-w-rowlabel${isActiveRow ? ' active' : ''}">h=${h}</div>`;
    for (let c = 0; c < eC; c++) {
      const cls = isActiveRow ? 'mat-cell b cur' : 'mat-cell b';
      html += `<div class="${cls}" style="width:40px;height:40px;font-size:0.82rem">${W[h][c]}</div>`;
    }
  }
  html += '</div></div>';

  // Output Y
  html += '<div class="ef-section">';
  html += '<div class="ef-section-label">Output Y <span class="ef-dim">(B=' + eB + ', L=' + eL + ', C=' + eC + ')</span></div>';
  html += '<div class="ef-output-grid">';
  for (let b = 0; b < eB; b++) {
    html += '<div class="ef-output-row">';
    for (let l = 0; l < eL; l++) {
      const p = blToPos(b, l);
      const active = efStep === p;
      const done = efStep >= 0 && p <= efStep;
      html += '<div class="ef-output-cell-group' + (active ? ' active' : '') + '">';
      html += `<span class="ef-output-pos">[${b},${l}]</span>`;
      html += '<div class="ef-output-vec">';
      for (let c = 0; c < eC; c++) {
        const cellCls = active ? 'mat-cell r cur' :
                        done ? 'mat-cell r done' : 'mat-cell r empty';
        const val = done ? Y[b][l][c] : '';
        html += `<div class="${cellCls}" style="width:36px;height:36px;font-size:0.78rem" `
          + `onclick="efTraceBack(${b},${l},${c})">${val}</div>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div></div>';

  html += '</div>'; // ef-layout
  wrap.innerHTML = html;
  efUpdateFormula();
  efUpdateDots();
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
      terms.push(`<span style="${style}"><span class="fa">X[${b},${l},${h}]</span>·<span class="fb">W[${h},${c}]</span> = ${xVal}×${wVal}</span>`);
    }
    f.innerHTML = `Y[${b},${l},${c}] = Σ<sub>h</sub> X[${b},${l},h]·W[h,${c}] = ${terms.join(' + ')} = <span class="fc">${Y[b][l][c]}</span>`
      + `<br><em style="color:#999;font-size:0.78rem">One-hot selects row ${tok} of W → it's just a lookup!</em>`;
    return;
  }

  if (efStep < 0) {
    f.innerHTML = `Each position (b,l) holds a one-hot vector. Multiplying by W selects a row — embedding lookup IS matrix multiplication. Press ▶ to step through positions.`;
  } else {
    const [b, l] = posTobl(efStep);
    const tok = tokenIds[b][l];
    f.innerHTML = `Position [${b},${l}]: token = <span class="fa">${tok}</span> → `
      + `Y[${b},${l},:] = <span class="fb">W[${tok},:]</span> = `
      + `<span class="fc">[${Y[b][l].join(', ')}]</span> `
      + `<em style="color:#999">— row selection from the embedding table</em>`;
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
