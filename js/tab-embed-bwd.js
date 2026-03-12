// ══════════════════════════════════════════════════
// TAB 4 — EMBEDDING BACKWARD: btv,btc→vc (gradient accumulation)
// ══════════════════════════════════════════════════
// 2D accumulation view: steps through (b,l) pairs showing
// how each position's rank-1 outer product accumulates into dW.

import { generateTokens, generateGradients, computeBackward } from './embed-data.js';

// ── State ──
let eB = 2, eT = 3, eV = 4, eC = 3;
let tokenIds = [], X = [], G = [], dW = [];
// Running accumulator at each step
let dWAccum = [];   // current accumulated dW (updates as we step)
let ebStep = -1;    // -1 = overview, 0..P-1 = stepping through positions
let ebPlaying = false;
let ebTm = null;
let ebSelectedCell = null; // {v, c} for trace-back

const totalPositions = () => eB * eT;
const posTobl = (p) => [Math.floor(p / eT), p % eT];

// ── Init ──
export function ebInit(randomize = true) {
  if (randomize) {
    const tok = generateTokens(eB, eT, eV);
    tokenIds = tok.tokenIds;
    X = tok.X;
    G = generateGradients(eB, eT, eC);
  } else {
    tokenIds = Array.from({ length: eB }, () => Array.from({ length: eT }, (_, l) => l % eV));
    X = tokenIds.map(seq => seq.map(tok => { const oh = Array(eV).fill(0); oh[tok] = 1; return oh; }));
    G = Array.from({ length: eB }, () => Array.from({ length: eT }, () => Array(eC).fill(1)));
  }
  dW = computeBackward(X, G);
  resetAccum();
  ebStep = -1;
  ebPlaying = false;
  ebSelectedCell = null;
}

function resetAccum() {
  dWAccum = Array.from({ length: eV }, () => Array(eC).fill(0));
}

function accumUpToStep(step) {
  resetAccum();
  for (let p = 0; p <= step; p++) {
    const [b, l] = posTobl(p);
    const tok = tokenIds[b][l];
    for (let c = 0; c < eC; c++) {
      dWAccum[tok][c] += G[b][l][c];
    }
  }
}

// ── Rendering ──
export function ebRender() {
  const wrap = document.getElementById('ebDisplay');
  if (!wrap) return;

  // Recompute accumulator up to current step
  if (ebStep >= 0) accumUpToStep(ebStep);
  else resetAccum();

  let html = '<div class="eb-layout">';

  // Left: Token + gradient grid
  html += '<div class="eb-section">';
  html += '<div class="ef-section-label">Tokens & Gradients</div>';
  html += '<div class="eb-token-grid">';
  for (let b = 0; b < eB; b++) {
    html += '<div class="ef-token-row">';
    for (let l = 0; l < eT; l++) {
      const p = b * eT + l;
      const active = ebStep === p;
      const done = ebStep >= 0 && p <= ebStep;
      const cls = active ? 'eb-pos active' : done ? 'eb-pos done' : 'eb-pos';
      html += `<div class="${cls}" onclick="ebJumpToPos(${p})" title="batch ${b}, pos ${l}">`;
      html += `<div class="ef-tok-id">tok=${tokenIds[b][l]}</div>`;
      html += `<div class="eb-grad-vec">∇=[${G[b][l].join(',')}]</div>`;
      html += `<span class="ef-tok-pos">[${b},${l}]</span>`;
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div></div>';

  // Center: Current contribution (outer product)
  if (ebStep >= 0) {
    const [b, l] = posTobl(ebStep);
    const tok = tokenIds[b][l];
    html += '<div class="eb-section eb-contrib">';
    html += '<div class="ef-section-label">Contribution at [' + b + ',' + l + ']</div>';
    html += '<div class="eb-outer-product">';
    html += '<div class="eb-op-label">X[' + b + ',' + l + ',:] ⊗ G[' + b + ',' + l + ',:]</div>';
    html += `<div class="eb-op-grid" style="grid-template-columns: auto repeat(${eC}, 36px)">`;
    // Header
    html += '<div class="ef-w-header"></div>';
    for (let c = 0; c < eC; c++) html += '<div class="ef-w-header">c' + c + '</div>';
    for (let v = 0; v < eV; v++) {
      const isActive = v === tok;
      html += `<div class="ef-w-rowlabel${isActive ? ' active' : ''}">v=${v}</div>`;
      for (let c = 0; c < eC; c++) {
        const val = X[b][l][v] * G[b][l][c];
        const cls = isActive ? 'mat-cell r cur' : 'mat-cell neutral';
        const style = isActive ? '' : 'opacity:0.3;';
        html += `<div class="${cls}" style="width:36px;height:36px;font-size:0.78rem;${style}">${val}</div>`;
      }
    }
    html += '</div></div></div>';
  }

  // Right: dW accumulator
  html += '<div class="eb-section">';
  html += '<div class="ef-section-label">dW accumulator <span class="ef-dim">(V=' + eV + ', C=' + eC + ')</span></div>';
  html += `<div class="eb-dw-grid" style="grid-template-columns: auto repeat(${eC}, 40px)">`;
  // Header
  html += '<div class="ef-w-header"></div>';
  for (let c = 0; c < eC; c++) html += '<div class="ef-w-header">c' + c + '</div>';
  // Find which row was just contributed to
  const activeRow = ebStep >= 0 ? tokenIds[posTobl(ebStep)[0]][posTobl(ebStep)[1]] : -1;
  for (let v = 0; v < eV; v++) {
    const isActive = v === activeRow && ebStep >= 0;
    html += `<div class="ef-w-rowlabel${isActive ? ' active' : ''}">v=${v}</div>`;
    for (let c = 0; c < eC; c++) {
      const val = dWAccum[v][c];
      const isFinal = ebStep === totalPositions() - 1;
      // Color intensity based on magnitude
      const maxVal = Math.max(1, ...dWAccum.flat().map(Math.abs));
      const intensity = Math.min(1, Math.abs(val) / maxVal);
      const bg = val === 0 ? '#f5f5f5' :
                 isActive ? `rgba(80,200,120,${0.3 + intensity * 0.5})` :
                 `rgba(26,154,64,${0.1 + intensity * 0.3})`;
      const color = Math.abs(val) > maxVal * 0.5 ? '#fff' : '#1a9a40';
      html += `<div class="mat-cell r${isFinal ? ' done' : ''}" `
        + `style="width:40px;height:40px;font-size:0.82rem;background:${bg};color:${color}" `
        + `onclick="ebTraceBack(${v},${c})">${val}</div>`;
    }
  }
  html += '</div></div>';

  html += '</div>'; // eb-layout
  wrap.innerHTML = html;
  ebUpdateFormula();
  ebUpdateDots();
}

function ebUpdateFormula() {
  const f = document.getElementById('fEB');
  if (!f) return;

  if (ebSelectedCell) {
    const { v, c } = ebSelectedCell;
    // Show all positions that contribute to this cell
    let terms = [];
    for (let b = 0; b < eB; b++) {
      for (let t = 0; t < eT; t++) {
        if (tokenIds[b][t] === v) {
          terms.push(`<span class="fa">G[${b},${t},${c}]</span>=${G[b][t][c]}`);
        }
      }
    }
    if (terms.length === 0) {
      f.innerHTML = `dW[${v},${c}] = 0 — <em style="color:#999">no tokens had id=${v}</em>`;
    } else {
      f.innerHTML = `dW[${v},${c}] = ${terms.join(' + ')} = <span class="fc">${dW[v][c]}</span>`
        + ` <em style="color:#999">— sum of gradients at positions where token=${v}</em>`;
    }
    return;
  }

  if (ebStep < 0) {
    f.innerHTML = `Backward pass: <code>dW[v,c] = Σ<sub>b,t</sub> X[b,t,v]·G[b,t,c]</code>. `
      + `Each position scatters its gradient to the row of its token. Press ▶ to step through.`;
  } else {
    const [b, l] = posTobl(ebStep);
    const tok = tokenIds[b][l];
    f.innerHTML = `Position [${b},${l}]: token=<span class="fa">${tok}</span> → `
      + `scatter <span class="fb">G[${b},${l},:]=[${G[b][l].join(',')}]</span> `
      + `into <span class="fc">dW[${tok},:]</span> `
      + `<em style="color:#999">— the reverse of forward's gather</em>`;
  }
}

function ebUpdateDots() {
  const el = document.getElementById('dEB');
  if (!el) return;
  el.innerHTML = '';
  const P = totalPositions();
  for (let p = 0; p < P; p++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    if (ebStep >= 0 && ebStep > p) dot.classList.add('done');
    else if (ebStep === p) dot.classList.add('cur');
    el.appendChild(dot);
  }
}

// ── Trace-back ──
export function ebTraceBack(v, c) {
  if (ebSelectedCell && ebSelectedCell.v === v && ebSelectedCell.c === c) {
    ebSelectedCell = null;
  } else {
    ebSelectedCell = { v, c };
  }
  ebUpdateFormula();
}

// ── Playback ──
function ebDelay() { return 1400 - parseInt(document.getElementById('spEB')?.value || 600); }

export function ebFwd() {
  ebPause();
  ebSelectedCell = null;
  if (ebStep < totalPositions() - 1) { ebStep++; ebRender(); }
}

export function ebBack() {
  ebPause();
  ebSelectedCell = null;
  if (ebStep > -1) { ebStep--; ebRender(); }
}

export function ebToggle() {
  if (ebPlaying) ebPause();
  else ebPlay();
}

function ebPlay() {
  if (ebStep >= totalPositions() - 1) ebStep = -1;
  ebPlaying = true;
  const btn = document.getElementById('pbEB');
  if (btn) btn.textContent = '⏸';
  ebTick();
}

export function ebPause() {
  ebPlaying = false;
  clearTimeout(ebTm);
  const btn = document.getElementById('pbEB');
  if (btn) btn.textContent = '▶';
}

function ebTick() {
  if (!ebPlaying) return;
  if (ebStep < totalPositions() - 1) {
    ebStep++;
    ebRender();
    ebTm = setTimeout(ebTick, ebDelay());
  } else {
    ebPause();
  }
}

export function ebReset() {
  ebPause();
  ebStep = -1;
  ebSelectedCell = null;
  ebRender();
}

export function ebJumpToPos(p) {
  ebPause();
  ebSelectedCell = null;
  ebStep = p;
  ebRender();
}

// ── Dimension changes ──
export function ebChangeDim(dim, delta) {
  if (dim === 'B') eB = Math.max(1, Math.min(4, eB + delta));
  else if (dim === 'T') eT = Math.max(1, Math.min(4, eT + delta));
  else if (dim === 'V') eV = Math.max(2, Math.min(5, eV + delta));
  else if (dim === 'C') eC = Math.max(1, Math.min(5, eC + delta));
  ebInit(true);
  ebRender();
}

// ── Getters for tests ──
/* @testable */
export function getEbState() {
  return { eB, eT, eV, eC, tokenIds, X, G, dW, dWAccum, ebStep, ebPlaying, ebSelectedCell };
  // Note: eV=vocab size, eT=sequence length, eC=embedding dim (Karpathy's B,T,C convention)
}
