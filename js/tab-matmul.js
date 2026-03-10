// ══════════════════════════════════════════════════
// MATRIX MULTIPLY — unified tab
// Build mode: outer product (j-slices) or dot product (i,k cells)
// Post-build: shared exploration with sub-viz, hover, collapse slider
// ══════════════════════════════════════════════════
import { I, J, K, A, B, Cube, Res, labelA, labelB, editCellInline, recomputeFromMatrices, dimBtnsH, dimBtnsV, setBuildComplete, buildComplete } from './shared.js';
import { makeTex } from './scene.js';
import { boxes, plusPlanes, paintBox, paintSlice, ensureAllGreen, packedY, addPlusPlanes, removePlusPlanes } from './cube-manager.js';

const THREE = window.THREE;

// ══════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════

// ── Build mode ──
export let buildMode = 'outer'; // 'outer' | 'dot'

// ── Build state ──
let t1 = -1, pl1 = false, tm1 = null, lastOpJ = -1;
let sliceRevealTm = null;

// ── Result cell selection state (exploration) ──
let mmSelectedI = -1, mmSelectedK = -1;
let mmHoverJVal = -1;

// ── Collapse state ──
export let collapseT = 0;
let colAnimId = null;
let colDir = 0;
const COL_SPEED = 0.0005;

// ── Unified state machine ──
export let mmPhase = 'build'; // 'build' | 'collapse' | 'done'

// ══════════════════════════════════════════════════
// BUILD MODE TOGGLE
// ══════════════════════════════════════════════════

export function setBuildMode(mode, { quiet = false } = {}) {
  if (mode === buildMode) return;
  buildMode = mode;
  // Update checkbox label
  const lbl = document.getElementById('chkDetailLabel');
  if (lbl) lbl.textContent = mode === 'outer' ? 'Element by element' : 'Term by term';
  // Full reset (skip when caller handles reset, e.g. selectPreset)
  if (!quiet) mmReset();
}

/* @testable */
export function getBuildMode() { return buildMode; }

// ── Detail checkbox ──
function detailMode() {
  const chk = document.getElementById('chkDetail');
  return chk && chk.checked;
}

// ══════════════════════════════════════════════════
// OUTER PRODUCT BUILD — step decoding
// ══════════════════════════════════════════════════

function opTotalSteps() { return detailMode() ? J * I * K : J; }

function opDecodeStep(s) {
  if (s < 0) return {j: -1, cellI: -1, cellK: -1};
  if (detailMode()) {
    const sliceSize = I * K;
    const j = Math.floor(s / sliceSize);
    if (j >= J) return {j: J, cellI: -1, cellK: -1};
    const cell = s % sliceSize;
    return {j, cellI: Math.floor(cell / K), cellK: cell % K};
  } else {
    if (s >= J) return {j: J, cellI: -1, cellK: -1};
    return {j: s, cellI: -1, cellK: -1};
  }
}

// ══════════════════════════════════════════════════
// DOT PRODUCT BUILD — step decoding
// ══════════════════════════════════════════════════

function dpTotalSteps() { return detailMode() ? I * K * J : I * K; }

function dpDecodeStep(s) {
  if (s < 0) return {i: -1, k: -1, j: -1};
  if (detailMode()) {
    const cellIdx = Math.floor(s / J);
    const j = s % J;
    if (cellIdx >= I * K) return {i: -1, k: -1, j: -1};
    return {i: Math.floor(cellIdx / K), k: cellIdx % K, j};
  } else {
    if (s >= I * K) return {i: -1, k: -1, j: -1};
    return {i: Math.floor(s / K), k: s % K, j: -1};
  }
}

// ── Unified step count ──
function totalSteps() { return buildMode === 'outer' ? opTotalSteps() : dpTotalSteps(); }

// ══════════════════════════════════════════════════
// OUTER PRODUCT BUILD — cube painting
// ══════════════════════════════════════════════════

export function applyS1(s) {
  const hasBoxes = boxes.length > 0;
  const {j, cellI, cellK} = opDecodeStep(s);

  // Paint cube (WebGL — needs boxes)
  if (hasBoxes) {
    for (let jj = 0; jj < J; jj++) {
      if (jj < j) paintSlice(jj, 'done');
      else paintSlice(jj, 'empty');
    }
  }

  if (j < 0) { renderA(-1, -1, -1); renderB(-1, -1, -1); setOpFormula(s); setOpDots(s); updateOpDisplay(s); mmRenderResult(); return; }
  if (j >= J) { if (hasBoxes) ensureAllGreen(); renderA(-1, -1, -1); renderB(-1, -1, -1); setOpFormula(s); setOpDots(s); updateOpDisplay(s); mmRenderResult(); return; }

  if (cellI < 0) {
    const isNewSlice = j !== lastOpJ;
    // Render 2D grids and animation display first (DOM-only, no WebGL)
    renderA(j, -1, -1); renderB(j, -1, -1);
    setOpFormula(s); setOpDots(s); updateOpDisplay(s); mmRenderResult();
    if (hasBoxes) {
      if (isNewSlice && lastAnimDuration > 0) {
        clearTimeout(sliceRevealTm);
        paintSlice(j, 'building');
        sliceRevealTm = setTimeout(() => { if (boxes.length) paintSlice(j, 'active'); }, lastAnimDuration);
      } else {
        paintSlice(j, 'active');
      }
    }
    return;
  } else {
    if (hasBoxes) {
      const cur = cellI * K + cellK;
      for (let ii = 0; ii < I; ii++) for (let kk = 0; kk < K; kk++) {
        const flat = ii * K + kk;
        if (flat < cur) paintBox(ii, j, kk, 0x50c878, 0.78, 0, Cube[ii][j][kk]);
        else if (flat === cur) paintBox(ii, j, kk, 0x2ab0a0, 0.95, 0x0a3030, Cube[ii][j][kk]);
        else paintBox(ii, j, kk, 0xeeeeee, 0.10, 0, null);
      }
    }
    renderA(j, cellI, -1);
    renderB(j, -1, cellK);
  }
  setOpFormula(s); setOpDots(s); updateOpDisplay(s); mmRenderResult();
}

// ══════════════════════════════════════════════════
// DOT PRODUCT BUILD — cube painting
// ══════════════════════════════════════════════════

function applyDpStep(s) {
  const hasBoxes = boxes.length > 0;
  const dec = dpDecodeStep(s);
  const curI = dec.i, curK = dec.k, curJ = dec.j;
  const completedUpTo = s < 0 ? -1 : (detailMode() ? Math.floor(s / J) - ((s % J === J - 1) ? 0 : 1) : s - 1);

  // Paint cube (WebGL — needs boxes)
  if (hasBoxes) {
    for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
      const cellIdx = i * K + k;
      if (curI >= 0 && i === curI && k === curK) {
        if (detailMode() && curJ >= 0 && j === curJ) {
          paintBox(i, j, k, 0xe06000, 0.95, 0x2a0e00, Cube[i][j][k]);
        } else if (detailMode() && curJ >= 0 && j < curJ) {
          paintBox(i, j, k, 0x50c878, 0.78, 0, Cube[i][j][k]);
        } else if (!detailMode() || curJ < 0) {
          paintBox(i, j, k, 0xf0a040, 0.95, 0x2a0e00, Cube[i][j][k]);
        } else {
          paintBox(i, j, k, 0xeeeeee, 0.30, 0, null);
        }
      } else if (s >= 0 && cellIdx <= completedUpTo) {
        paintBox(i, j, k, 0x50c878, 0.55, 0, Cube[i][j][k]);
      } else if (s < 0) {
        paintBox(i, j, k, buildComplete ? 0x50c878 : 0xeeeeee, buildComplete ? 0.78 : 0.10, 0, buildComplete ? Cube[i][j][k] : null);
      } else {
        paintBox(i, j, k, 0x50c878, 0.12, 0, null);
      }
    }
  }

  // Render grids (DOM-only)
  if (curI >= 0) {
    renderA_dp(curI, curJ); renderB_dp(curK, curJ);
  } else {
    renderA(-1, -1, -1); renderB(-1, -1, -1);
  }

  dpRenderFormula(s);
  dpRenderDots(s);
  dpRenderResult(s);
  dpRenderSubViz(s);
}

// ── DP grid rendering (during build) ──
function renderA_dp(curI, curJ) {
  const el = document.getElementById('gridA');
  if (!el || !A.length) return;
  const titleEl = document.getElementById('mmTitleA');
  if (titleEl) titleEl.textContent = labelA;
  el.style.gridTemplateColumns = `repeat(${J},44px)`;
  let html = '';
  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) {
    let cls = 'mat-cell neutral editable';
    if (curI >= 0 && i === curI) {
      if (curJ >= 0 && j === curJ) cls += ' cur';
      else cls += ' hi';
    }
    html += `<div class="${cls}" data-edit-a="${i},${j}">${A[i][j]}</div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-edit-a]').forEach(cell => {
    const [ci, cj] = cell.dataset.editA.split(',').map(Number);
    cell.onclick = function() { editCellInline(this, A[ci][cj], '#e06000', function(v) { A[ci][cj] = v; recomputeFromMatrices(); }); };
  });
  const rb = document.getElementById('dimRowBtnsA'); if (rb) rb.innerHTML = dimBtnsV('I');
  const cb = document.getElementById('dimColBtnsA'); if (cb) cb.innerHTML = dimBtnsH('J', true);
}

function renderB_dp(curK, curJ) {
  const el = document.getElementById('gridB');
  if (!el || !B.length) return;
  const titleEl = document.getElementById('mmTitleB');
  if (titleEl) titleEl.textContent = labelB;
  el.style.gridTemplateColumns = `repeat(${K},44px)`;
  let html = '';
  for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
    let cls = 'mat-cell neutral-b editable';
    if (curK >= 0 && k === curK) {
      if (curJ >= 0 && j === curJ) cls += ' cur';
      else cls += ' hi';
    }
    html += `<div class="${cls}" data-edit-b="${j},${k}">${B[j][k]}</div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-edit-b]').forEach(cell => {
    const [cj, ck] = cell.dataset.editB.split(',').map(Number);
    cell.onclick = function() { editCellInline(this, B[cj][ck], '#1a60b0', function(v) { B[cj][ck] = v; recomputeFromMatrices(); }); };
  });
  const rb = document.getElementById('dimRowBtnsB'); if (rb) rb.innerHTML = dimBtnsV('J', true);
  const cb = document.getElementById('dimColBtnsB'); if (cb) cb.innerHTML = dimBtnsH('K');
}

function dpRenderFormula(s) {
  const f = document.getElementById('fMM');
  if (!f) return;
  const dec = dpDecodeStep(s);
  const i = dec.i, k = dec.k, curJ = dec.j;
  if (s < 0) {
    f.innerHTML = 'Click a result cell or press ▶ to step through each row · column.';
    return;
  }
  if (detailMode()) {
    f.innerHTML = `Result[<span class="fa">${i}</span>,<span class="fb">${k}</span>]: term j=<span class="fc">${curJ}</span>: `
      + `<span class="fa">${A[i][curJ]}</span> × <span class="fb">${B[curJ][k]}</span> = <span class="fc">${A[i][curJ] * B[curJ][k]}</span>`;
  } else {
    f.innerHTML = `Result[<span class="fa">${i}</span>,<span class="fb">${k}</span>] = `
      + Array.from({length: J}, (_, j) => `<span class="fa">${A[i][j]}</span>·<span class="fb">${B[j][k]}</span>`).join(' + ')
      + ` = <span class="fc">${Res[i][k]}</span>`;
  }
}

function dpRenderDots(s) {
  const el = document.getElementById('dMM');
  if (!el) return;
  el.innerHTML = '';
  const total = I * K;
  for (let d = 0; d < total; d++) {
    const dot = document.createElement('div'); dot.className = 'step-dot';
    const doneThresh = detailMode() ? (d + 1) * J - 1 : d;
    const curThresh = detailMode() ? d * J : d;
    if (s > doneThresh) dot.classList.add('done');
    else if (s >= curThresh) dot.classList.add('cur');
    el.appendChild(dot);
  }
}

function dpRenderResult(s) {
  const container = document.getElementById('mmResultGrid');
  if (!container) return;
  const dec = dpDecodeStep(s);
  const curI = dec.i, curK = dec.k, curJ = dec.j;
  const completedUpTo = s < 0 ? -1 : (detailMode() ? Math.floor(s / J) - ((s % J === J - 1) ? 0 : 1) : s - 1);

  container.style.gridTemplateColumns = `repeat(${K},44px)`;
  let html = '';
  for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
    const cellIdx = i * K + k;
    const curCellIdx = curI >= 0 ? curI * K + curK : -1;
    let cls = 'mat-cell r';
    let val = '';
    if (cellIdx === curCellIdx) {
      cls += ' cur';
      if (detailMode() && curJ >= 0) {
        let partial = 0;
        for (let jj = 0; jj <= curJ; jj++) partial += A[i][jj] * B[jj][k];
        val = partial;
      } else {
        val = Res[i][k];
      }
    } else if (cellIdx <= completedUpTo) {
      cls += ' done';
      val = Res[i][k];
    } else if (s < 0) {
      if (buildComplete) {
        val = Res[i][k];
        cls += ' done';
      } else {
        cls += ' empty';
      }
    } else {
      cls += ' empty';
    }
    const clickable = val !== '';
    if (clickable) {
      html += `<div class="${cls}" onclick="mmJumpToCell(${i},${k})" style="cursor:pointer">${val}</div>`;
    } else {
      html += `<div class="${cls}">${val}</div>`;
    }
  }
  container.innerHTML = html;

  const hint = document.getElementById('mmResultHint');
  const hasClickable = s >= 0 || buildComplete;
  if (hint) hint.textContent = hasClickable ? 'click cell to trace inputs' : '';
}

function dpRenderSubViz(s) {
  const el = document.getElementById('dpSubViz');
  if (!el) return;
  const dec = dpDecodeStep(s);
  const i = dec.i, k = dec.k, curJ = dec.j;
  if (i < 0) { el.style.display = 'none'; return; }
  el.style.display = '';

  const upToJ = (s >= 0 && detailMode()) ? curJ : J - 1;
  renderSubVizHTML(el, i, k, curJ, upToJ, s >= 0 && detailMode());
}

// ══════════════════════════════════════════════════
// SHARED SUB-VIZ RENDERING (exploration + dp build)
// ══════════════════════════════════════════════════

function renderSubVizHTML(el, i, k, curJ, upToJ, showPartial) {
  let html = `<div style="font-size:0.72rem;color:#888;font-weight:500">Row ${i} of ${labelA} · Column ${k} of ${labelB}</div>`;

  html += '<div class="dp-sub-viz-vectors">';
  // A[i,:] as horizontal row
  html += '<div class="dp-sub-viz-vec">';
  for (let j = 0; j < J; j++) {
    let cls = 'mat-cell neutral';
    if (showPartial && j === curJ) cls += ' cur';
    html += `<div class="${cls}" style="width:36px;height:36px;font-size:0.78rem">${A[i][j]}</div>`;
  }
  html += '</div>';
  html += '<span style="font-size:1.1rem;color:#bbb;font-weight:300">·</span>';
  // B[:,k] as vertical column
  html += '<div class="dp-sub-viz-vec col">';
  for (let j = 0; j < J; j++) {
    let cls = 'mat-cell neutral-b';
    if (showPartial && j === curJ) cls += ' cur';
    html += `<div class="${cls}" style="width:36px;height:36px;font-size:0.78rem">${B[j][k]}</div>`;
  }
  html += '</div>';
  html += '<span style="font-size:1.1rem;color:#bbb;font-weight:300">=</span>';
  // Result scalar
  let sum = 0;
  for (let j = 0; j <= upToJ; j++) sum += A[i][j] * B[j][k];
  const finalSum = (showPartial && curJ < J - 1);
  html += `<div class="mat-cell r cur" style="width:40px;height:40px;font-size:0.95rem;font-weight:700">${finalSum ? sum : Res[i][k]}</div>`;
  html += '</div>';

  // Element-wise products
  html += '<div class="dp-products" style="justify-content:center"><span style="color:#666;font-size:0.75rem">Products:</span> ';
  for (let j = 0; j < J; j++) {
    const prod = A[i][j] * B[j][k];
    let cls = 'dp-term dp-term-prod';
    if (showPartial) {
      if (j === curJ) cls += ' cur';
      else if (j > upToJ) cls += ' dim';
    }
    html += `<span class="${cls}">${prod}</span>`;
    if (j < J - 1) html += ' <span style="color:#ccc">+</span> ';
  }
  html += '</div>';

  // Partial/full sum
  if (showPartial && curJ < J - 1) {
    html += `<div class="dp-sum-line" style="justify-content:center"><span style="color:#666;font-size:0.75rem">Partial sum (j=0..${curJ}):</span> <span class="dp-accum">${sum}</span></div>`;
  } else {
    let fullSum = 0;
    for (let j = 0; j < J; j++) fullSum += A[i][j] * B[j][k];
    html += `<div class="dp-sum-line" style="justify-content:center"><span style="color:#666;font-size:0.75rem">Sum:</span> <span class="dp-accum">${fullSum}</span> = Result[${i},${k}]</div>`;
  }

  el.innerHTML = html;
}

// ══════════════════════════════════════════════════
// OUTER PRODUCT ANIMATION DISPLAY
// ══════════════════════════════════════════════════

let lastAnimDuration = 0;

// ── Outer product highlight animation ──
let opHiTm = null;
/* @testable */ export function getOpHiTm() { return opHiTm; }
/* @testable */ export function setOpHiTm(v) { opHiTm = v; }
function opStopHi() { clearTimeout(opHiTm); opHiTm = null; }

function opHighlight(ci, ck) {
  const panel = document.getElementById('opDisplay');
  if (!panel) return;
  panel.querySelectorAll('.op-hi').forEach(el => el.classList.remove('op-hi'));
  panel.querySelectorAll(`[data-opa-i="${ci}"]`).forEach(el => el.classList.add('op-hi'));
  panel.querySelectorAll(`[data-opb-k="${ck}"]`).forEach(el => el.classList.add('op-hi'));
}

function opClearHi() {
  const panel = document.getElementById('opDisplay');
  if (!panel) return;
  panel.querySelectorAll('.op-hi').forEach(el => el.classList.remove('op-hi'));
}

function updateOpDisplay(s) {
  const panel = document.getElementById('opDisplay');
  if (!panel) return;
  const {j, cellI, cellK} = opDecodeStep(s);
  if (j < 0 || j >= J) { panel.classList.add('hidden'); panel.innerHTML = ''; lastOpJ = -1; opStopHi(); return; }
  panel.classList.remove('hidden');

  const ebe = detailMode() && cellI >= 0;
  const sz = 32;

  if (!ebe) {
    const animate = j !== lastOpJ;
    lastOpJ = j;
    opStopHi();
    const bDelay = 120, rDelay = 70;
    const rBase = animate ? Math.max(K - 1, I - 1) * bDelay + 200 : 0;

    let aGrid = '<div style="display:flex;gap:3px">';
    aGrid += '<div class="intro-orig-vec intro-orig-a"><div style="display:flex;flex-direction:column;gap:3px">';
    for (let i = 0; i < I; i++) {
      aGrid += `<div class="op-cell op-cell-a" data-opa-i="${i}" style="width:${sz}px;height:${sz}px">${A[i][j]}</div>`;
    }
    aGrid += '</div></div>';
    if (K > 1) {
      aGrid += `<div style="display:grid;grid-template-columns:repeat(${K - 1},${sz}px);gap:3px">`;
      for (let i = 0; i < I; i++) for (let k = 1; k < K; k++) {
        const cls = animate ? 'op-cell op-cell-a intro-anim-right' : 'op-cell op-cell-a';
        const dly = animate ? `animation-delay:${(k - 1) * bDelay}ms;` : '';
        aGrid += `<div class="${cls}" data-opa-i="${i}" style="width:${sz}px;height:${sz}px;${dly}">${A[i][j]}</div>`;
      }
      aGrid += '</div>';
    }
    aGrid += '</div>';

    let bGrid = '<div style="display:flex;flex-direction:column;gap:3px">';
    bGrid += '<div class="intro-orig-vec intro-orig-b"><div style="display:flex;gap:3px">';
    for (let k = 0; k < K; k++) {
      bGrid += `<div class="op-cell op-cell-b" data-opb-k="${k}" style="width:${sz}px;height:${sz}px">${B[j][k]}</div>`;
    }
    bGrid += '</div></div>';
    if (I > 1) {
      bGrid += `<div style="display:grid;grid-template-columns:repeat(${K},${sz}px);gap:3px">`;
      for (let i = 1; i < I; i++) for (let k = 0; k < K; k++) {
        const cls = animate ? 'op-cell op-cell-b intro-anim-down' : 'op-cell op-cell-b';
        const dly = animate ? `animation-delay:${(i - 1) * bDelay}ms;` : '';
        bGrid += `<div class="${cls}" data-opb-k="${k}" style="width:${sz}px;height:${sz}px;${dly}">${B[j][k]}</div>`;
      }
      bGrid += '</div>';
    }
    bGrid += '</div>';

    let rGrid = `<div class="op-grid" style="grid-template-columns:repeat(${K},${sz + 4}px)">`;
    for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
      if (animate) {
        const dly = rBase + (k * I + i) * rDelay;
        rGrid += `<div class="op-cell-r op-anim" style="width:${sz + 4}px;height:${sz + 4}px;animation-delay:${dly}ms">${Cube[i][j][k]}</div>`;
      } else {
        rGrid += `<div class="op-cell-r" style="width:${sz + 4}px;height:${sz + 4}px">${Cube[i][j][k]}</div>`;
      }
    }
    rGrid += '</div>';

    panel.innerHTML =
      `<div style="font-size:0.7rem;color:#aaa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;width:100%;text-align:center">Slice j = <span style="color:#1a9a40;font-weight:700">${j}</span>: &nbsp;<span style="color:#e06000">A[:,${j}]</span> ⊗ <span style="color:#1a60b0">B[${j},:]</span></div>` +
      `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center">` +
      `<div style="text-align:center"><div style="font-size:0.58rem;color:#aaa;margin-bottom:3px">A[:,${j}] broadcast →</div>${aGrid}</div>` +
      `<div class="op-sym">⊙</div>` +
      `<div style="text-align:center"><div style="font-size:0.58rem;color:#aaa;margin-bottom:3px">B[${j},:] broadcast ↓</div>${bGrid}</div>` +
      `<div class="op-sym">=</div>` +
      `<div style="text-align:center"><div style="font-size:0.58rem;color:#aaa;margin-bottom:3px">outer product</div>${rGrid}</div>` +
      `</div>`;

    lastAnimDuration = animate ? rBase + (I * K - 1) * rDelay + 450 : 0;

    if (animate) {
      const total = I * K;
      let idx = 0;
      function hiTick() {
        const ck = Math.floor(idx / I), ci = idx % I;
        opHighlight(ci, ck);
        idx++;
        if (idx < total) opHiTm = setTimeout(hiTick, rDelay);
        else opHiTm = setTimeout(opClearHi, rDelay);
      }
      opHiTm = setTimeout(hiTick, rBase);
    }
    return;
  }

  // Elem-by-elem mode
  lastAnimDuration = 0;
  lastOpJ = j;
  let aVec = '<div class="op-vec">';
  for (let i = 0; i < I; i++) {
    aVec += `<div class="op-cell op-cell-a${i === cellI ? ' op-cur' : ''}">${A[i][j]}</div>`;
  }
  aVec += '</div>';

  let bVec = '<div class="op-vec"><div class="op-vec-row">';
  for (let k = 0; k < K; k++) {
    bVec += `<div class="op-cell op-cell-b${k === cellK ? ' op-cur' : ''}">${B[j][k]}</div>`;
  }
  bVec += '</div></div>';

  let rGrid = `<div class="op-grid" style="grid-template-columns:repeat(${K},36px)">`;
  for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
    rGrid += `<div class="op-cell-r${i === cellI && k === cellK ? ' op-cur' : ''}">${Cube[i][j][k]}</div>`;
  }
  rGrid += '</div>';

  const detail = `<div style="font-size:0.82rem;color:#666;margin-top:4px;text-align:center">`
    + `[<span style="color:#e06000;font-weight:700">${cellI}</span>, <span style="color:#1a60b0;font-weight:700">${cellK}</span>]: `
    + `<span style="color:#e06000;font-weight:700">${A[cellI][j]}</span>`
    + ` × <span style="color:#1a60b0;font-weight:700">${B[j][cellK]}</span>`
    + ` = <span style="color:#1a9a40;font-weight:700">${Cube[cellI][j][cellK]}</span></div>`;

  panel.innerHTML =
    `<div style="font-size:0.7rem;color:#aaa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;width:100%;text-align:center">Slice j = <span style="color:#1a9a40;font-weight:700">${j}</span> &nbsp;outer product</div>` +
    `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center">` +
    `${aVec}` +
    `<div class="op-sym">⊗</div>` +
    `${bVec}` +
    `<div class="op-sym">=</div>` +
    `${rGrid}` +
    `</div>` +
    detail;
}

function setOpFormula(s) {
  const el = document.getElementById('fMM');
  if (!el) return;
  const {j, cellI, cellK} = opDecodeStep(s);
  if (s < 0) {
    el.innerHTML = detailMode()
      ? `Press ▶ — each slice fills element by element, showing A[:,j] ⊗ B[j,:]`
      : `Press ▶ — each j-slice fills all at once as A[:,j] ⊗ B[j,:]`;
    return;
  }
  if (j >= J) { el.innerHTML = `All <span class="fc">${J}</span> outer-product slices built — collapsing…`; return; }
  if (cellI >= 0) {
    el.innerHTML = `Slice j=<span class="fc">${j}</span>, entry [<span class="fa">${cellI}</span>,<span class="fb">${cellK}</span>]: `
      + `<span class="fa">${A[cellI][j]}</span> × <span class="fb">${B[j][cellK]}</span> = <span class="fc">${Cube[cellI][j][cellK]}</span>`;
  } else {
    const aCol = Array.from({length: I}, (_, i) => `<span class="fa">${A[i][j]}</span>`).join(', ');
    const bRow = Array.from({length: K}, (_, k) => `<span class="fb">${B[j][k]}</span>`).join(', ');
    el.innerHTML = `Slice j=<span class="fc">${j}</span>: &nbsp;[${aCol}] &nbsp;<span style="font-size:1.1em">⊗</span>&nbsp; [${bRow}]`;
  }
}

function setOpDots(s) {
  const el = document.getElementById('dMM'); if (!el) return;
  el.innerHTML = '';
  const dotCount = J;
  for (let d = 0; d < dotCount; d++) {
    const dot = document.createElement('div'); dot.className = 'step-dot';
    const doneThresh = detailMode() ? (d + 1) * I * K - 1 : d;
    const curThresh = detailMode() ? d * I * K : d;
    if (s > doneThresh) dot.classList.add('done');
    else if (s >= curThresh) dot.classList.add('cur');
    el.appendChild(dot);
  }
}

// ══════════════════════════════════════════════════
// SPEED
// ══════════════════════════════════════════════════

function spdMM() { return 1900 - parseInt(document.getElementById('spMM').value || 700); }

// ══════════════════════════════════════════════════
// PLAYBACK — dispatches to outer/dot based on buildMode
// ══════════════════════════════════════════════════

function mmStopBuildTimer() { pl1 = false; clearTimeout(tm1); clearTimeout(sliceRevealTm); }
export function mmPauseBuild() { mmStopBuildTimer(); opStopHi(); }
export function mmPauseAll() {
  mmPauseBuild();
  stopColAnim();
  const btn = document.getElementById('pbMM');
  if (btn) btn.textContent = '▶';
}

// ── Detail mode toggle: remap t1 between detail/non-detail step spaces ──
export function mmToggleDetail() {
  if (mmPhase !== 'build') return;
  const wasPlaying = pl1;
  if (wasPlaying) mmPauseAll();

  if (t1 < 0) {
    // Not started — just re-render
    applyStep(-1);
  } else if (detailMode()) {
    // Toggled ON: was in non-detail, now in detail
    // Non-detail step t1 = one unit (slice or cell). Map to start of that unit's detail.
    if (buildMode === 'outer') {
      t1 = t1 * I * K; // start of this slice's detail breakdown
    } else {
      t1 = t1 * J; // start of this cell's term breakdown
    }
    // Clamp to valid range
    t1 = Math.min(t1, totalSteps() - 1);
    applyStep(t1);
  } else {
    // Toggled OFF: was in detail, now in non-detail
    // Map back to the containing unit
    if (buildMode === 'outer') {
      t1 = Math.floor(t1 / (I * K));
    } else {
      t1 = Math.floor(t1 / J);
    }
    t1 = Math.min(t1, totalSteps() - 1);
    applyStep(t1);
  }

  if (wasPlaying) mmToggle();
}

export function applyStep(s) {
  if (buildMode === 'outer') {
    applyS1(s);
  } else {
    applyDpStep(s);
  }
}

export function mmToggle() {
  if (mmPhase === 'build') {
    if (pl1) { mmPauseAll(); return; }
    if (t1 >= totalSteps() - 1) t1 = -1;
    mmClearSelection();
    pl1 = true;
    document.getElementById('pbMM').textContent = '⏸';
    mmTickBuild();
  } else if (mmPhase === 'collapse' || mmPhase === 'done') {
    mmReset();
    mmToggle();
  }
}

function mmTickBuild() {
  if (!pl1) return;
  if (t1 < totalSteps() - 1) {
    t1++; applyStep(t1);
    if (t1 >= totalSteps() - 1) { mmBuildDone(); return; }
    const delay = buildMode === 'outer' ? Math.max(spdMM(), lastAnimDuration) : spdMM();
    tm1 = setTimeout(mmTickBuild, delay);
  }
}

/* @testable */
export function mmBuildDone() {
  mmStopBuildTimer();
  setBuildComplete(true);
  mmPhase = 'collapse';
  collapseT = 0;
  if (buildMode === 'outer' && boxes.length) {
    ensureAllGreen();
  }
  if (boxes.length) addPlusPlanes();
  document.getElementById('spCollapse').disabled = false;
  document.getElementById('pbMM').textContent = '▶';
  mmUpdateCanvasTitle();
  mmRenderResult();
  const fEl = document.getElementById('fMM');
  if (fEl) {
    if (buildMode === 'outer') {
      fEl.innerHTML = `All <span class="fc">${J}</span> slices built. Drag the slider to collapse them into the result.`;
    } else {
      fEl.innerHTML = `All <span class="fc">${I * K}</span> cells computed. Drag the slider to collapse the cube.`;
    }
  }
}

export function mmFwd() {
  if (mmPhase === 'build') {
    mmPauseAll();
    if (t1 < totalSteps() - 1) {
      t1++; applyStep(t1);
      if (t1 >= totalSteps() - 1) mmBuildDone();
    }
  }
}

export function mmBack() {
  if (mmPhase === 'build') {
    mmPauseAll();
    if (t1 > -1) { t1--; applyStep(t1); }
  }
}

export function mmReset() {
  mmPauseAll();
  mmPhase = 'build';
  setBuildComplete(false);
  t1 = -1; collapseT = 0; lastOpJ = -1; mmClearSelection();
  removePlusPlanes();
  const colSlider = document.getElementById('spCollapse');
  if (colSlider) { colSlider.disabled = true; colSlider.value = 0; }
  // Hide op display and sub-viz
  const opPanel = document.getElementById('opDisplay');
  if (opPanel) { opPanel.classList.add('hidden'); opPanel.innerHTML = ''; }
  const subViz = document.getElementById('dpSubViz');
  if (subViz) subViz.style.display = 'none';
  if (boxes.length) {
    for (let j = 0; j < J; j++) {
      const py = packedY(j);
      for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
        const b = boxes[i][j][k];
        b.mesh.position.y = py; b.edges.position.y = py; b.spr.position.y = py;
      }
    }
  }
  applyStep(-1);
  mmUpdateCanvasTitle();
}

export function mmScrubCollapse(t) {
  stopColAnim();
  mmClearSelection();
  // Hide both sub-viz panels during collapse
  const opPanel = document.getElementById('opDisplay');
  if (opPanel) { opPanel.classList.add('hidden'); opPanel.innerHTML = ''; }
  const subViz = document.getElementById('dpSubViz');
  if (subViz) subViz.style.display = 'none';
  if (mmPhase === 'build') {
    ensureAllGreen();
    t1 = totalSteps() - 1;
  }
  mmPhase = 'collapse';
  collapseT = t;
  setBuildComplete(true);
  if (t > 0 && plusPlanes.length === 0) addPlusPlanes();
  applyCollapse(collapseT);
  document.getElementById('spCollapse').disabled = false;
  document.getElementById('pbMM').textContent = '▶';
  if (collapseT >= 1) mmPhase = 'done';
  mmUpdateCanvasTitle();
  mmRenderResult();
}

export function resetMmBuildState() {
  t1 = -1; collapseT = 0; lastOpJ = -1;
  mmPhase = 'build';
  setBuildComplete(false);
  mmClearSelection();
  opStopHi();
  clearTimeout(sliceRevealTm);
  // Hide sub-viz panels
  const opPanel = document.getElementById('opDisplay');
  if (opPanel) { opPanel.classList.add('hidden'); opPanel.innerHTML = ''; }
  const subViz = document.getElementById('dpSubViz');
  if (subViz) subViz.style.display = 'none';
}

// Restore the current matmul view without resetting state (for tab switching)
export function mmRestoreView() {
  mmPauseAll();
  if (mmPhase === 'build') {
    removePlusPlanes();
    if (buildMode === 'outer') {
      if (t1 >= 0) {
        const {j} = opDecodeStep(t1);
        lastOpJ = j;
      }
      applyS1(t1);
      renderA(-1, -1, -1); renderB(-1, -1, -1);
      if (t1 >= 0) {
        const {j, cellI, cellK} = opDecodeStep(t1);
        if (j >= 0 && j < J) { renderA(j, cellI, -1); renderB(j, -1, cellK); }
      }
    } else {
      applyDpStep(t1);
    }
    document.getElementById('spCollapse').disabled = true;
    document.getElementById('spCollapse').value = 0;
  } else if (mmPhase === 'collapse' || mmPhase === 'done') {
    lastOpJ = -1;
    const opPanel = document.getElementById('opDisplay');
    if (opPanel) { opPanel.classList.add('hidden'); opPanel.innerHTML = ''; }
    removePlusPlanes();
    ensureAllGreen();
    addPlusPlanes();
    document.getElementById('spCollapse').disabled = false;
    document.getElementById('spCollapse').value = Math.round(collapseT * 1000);
    applyCollapse(collapseT);
    renderA(-1, -1, -1); renderB(-1, -1, -1);
  }
  mmUpdateCanvasTitle();
  mmRenderResult();
}

// ══════════════════════════════════════════════════
// COLLAPSE ANIMATION
// ══════════════════════════════════════════════════

const grColor = new THREE.Color(0x50c878), puColor = new THREE.Color(0x7c6ff5);

export function applyCollapse(t) {
  const e = -(Math.cos(Math.PI * t) - 1) / 2;
  const col = grColor.clone().lerp(puColor, e);

  for (let j = 0; j < J; j++) {
    const startY = packedY(j);
    const y = startY * (1 - e);
    const showJ = (t < 1) || (j === 0);
    for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
      const b = boxes[i][j][k];
      b.mesh.visible = showJ; b.edges.visible = showJ; b.spr.visible = showJ;
      if (!showJ) continue;
      b.mesh.position.y = y; b.edges.position.y = y; b.spr.position.y = y;
      b.mat.color.copy(col); b.em.color.copy(col);
      if (j === 0 && t >= 1) {
        b.spr.material.map = makeTex(Res[i][k], '#ffffff'); b.spr.material.needsUpdate = true;
      }
    }
  }

  for (let g = 0; g < J - 1; g++) {
    if (!plusPlanes[g]) continue;
    const y1 = packedY(g) * (1 - e);
    const y2 = packedY(g + 1) * (1 - e);
    const midY = (y1 + y2) / 2;
    const opacity = Math.max(0, 1 - e * 1.8);
    plusPlanes[g].forEach(spr => {
      spr.position.y = midY;
      spr.material.opacity = opacity;
      spr.visible = opacity > 0.01;
    });
  }

  const colSlider = document.getElementById('spCollapse');
  if (colSlider) colSlider.value = Math.round(t * 1000);

  const fEl = document.getElementById('fMM');
  if (fEl) {
    if (t <= 0) fEl.innerHTML = `The <span class="fc">${J}</span> slices are each A[:,j]⊗B[j,:]. Drag the slider to merge them.`;
    else if (t >= 1) fEl.innerHTML = `Done — <span class="fc">${J}</span> slices collapsed into one <span class="fr">${I}×${K}</span> result matrix = A @ B.`;
    else fEl.innerHTML = `Collapsing… (${Math.round(t * 100)}%)`;
  }
}

function stopColAnim() { cancelAnimationFrame(colAnimId); colDir = 0; }

function runColAnim(dir) {
  stopColAnim(); colDir = dir;
  document.getElementById('pbMM').textContent = '⏸';
  let last = null;
  function frame(now) {
    if (!last) { last = now; colAnimId = requestAnimationFrame(frame); return; }
    const dt = now - last; last = now;
    collapseT = Math.max(0, Math.min(1, collapseT + colDir * COL_SPEED * dt));
    applyCollapse(collapseT);
    if (collapseT <= 0 || collapseT >= 1) {
      stopColAnim();
      document.getElementById('pbMM').textContent = '▶';
      if (collapseT >= 1) mmPhase = 'done';
      return;
    }
    colAnimId = requestAnimationFrame(frame);
  }
  colAnimId = requestAnimationFrame(frame);
}

// ══════════════════════════════════════════════════
// CANVAS TITLE
// ══════════════════════════════════════════════════

export function mmUpdateCanvasTitle() {
  const el = document.getElementById('canvasTitle');
  if (!el) return;
  if (mmPhase === 'build') {
    el.textContent = 'Cube[i,j,k] = A[i,j]×B[j,k]';
  } else if (mmPhase === 'collapse') {
    const pct = Math.round(collapseT * 100);
    el.textContent = `Σⱼ Cube[i,j,k] → Result[i,k] (${pct}%)`;
  } else {
    el.textContent = 'Result[i,k]';
  }
}

// ══════════════════════════════════════════════════
// EXPLORATION MODE (post-build cell selection + hover)
// ══════════════════════════════════════════════════

export function mmJumpToCell(i, k) {
  // Only allow exploration after build completes (collapse or done phase)
  if (!buildComplete) return;
  // Toggle: clicking the already-selected cell deselects it
  if (mmSelectedI === i && mmSelectedK === k) {
    mmClearSelection();
    mmRenderResult();
    mmHighlightCubeForExploration();
    const fEl = document.getElementById('fMM');
    if (fEl) fEl.innerHTML = buildMode === 'outer'
      ? `All <span class="fc">${J}</span> slices built. Drag the slider to collapse them into the result.`
      : `All <span class="fc">${I * K}</span> cells computed. Drag the slider to collapse the cube.`;
    // Re-render standard A/B grids
    renderA(-1, -1, -1); renderB(-1, -1, -1);
    return;
  }
  mmPauseAll();
  t1 = -1;
  mmHoverJVal = -1;
  mmSelectedI = i; mmSelectedK = k;
  // Hide outer product display when entering exploration
  const opPanel = document.getElementById('opDisplay');
  if (opPanel) { opPanel.classList.add('hidden'); opPanel.innerHTML = ''; }
  // Render exploration state
  mmRenderExploreGridA();
  mmRenderExploreGridB();
  mmRenderResult();
  mmRenderExploreSubViz();
  mmHighlightCubeForExploration();
  const fEl = document.getElementById('fMM');
  if (fEl) {
    fEl.innerHTML = `Result[<span class="fa">${i}</span>,<span class="fb">${k}</span>] = `
      + Array.from({length: J}, (_, j) => `<span class="fa">${A[i][j]}</span>·<span class="fb">${B[j][k]}</span>`).join(' + ')
      + ` = <span class="fc">${Res[i][k]}</span>`;
  }
}

/* @testable */
export function getMmState() { return { t1, mmSelectedI, mmSelectedK, collapseT, mmPhase: mmPhase, buildMode }; }

export function mmHoverCell(j) {
  if (mmSelectedI < 0 || mmSelectedK < 0 || t1 >= 0) return;
  mmHoverJVal = j;
  document.querySelectorAll('[data-hover-j]').forEach(el => {
    el.classList.toggle('cur', +el.dataset.hoverJ === j);
  });
  mmHighlightCubeForExploration();
}

export function mmClearHover() {
  if (mmHoverJVal < 0) return;
  mmHoverJVal = -1;
  document.querySelectorAll('[data-hover-j]').forEach(el => {
    el.classList.remove('cur');
  });
  mmHighlightCubeForExploration();
}

export function mmSelectResultCell(i, k) {
  // During build, clicking result cells enters exploration via mmJumpToCell
  // Post-build, same thing
  mmJumpToCell(i, k);
}

function mmClearSelection() {
  mmSelectedI = -1; mmSelectedK = -1; mmHoverJVal = -1;
}

function mmHighlightCubeForExploration() {
  if (!boxes.length) return;
  const collapsed = collapseT >= 1;
  const selI = mmSelectedI, selK = mmSelectedK;

  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
    const b = boxes[i][j][k];
    if (!b.mesh.visible) continue;

    if (collapsed) {
      if (selI >= 0 && i === selI && k === selK) {
        paintBox(i, j, k, 0x20c0e0, 0.95, 0x0a3040, Res[i][k]);
      } else {
        paintBox(i, j, k, 0x50c878, 0.78, 0, Res[i][k]);
      }
    } else if (selI >= 0 && i === selI && k === selK) {
      if (mmHoverJVal >= 0 && j === mmHoverJVal) {
        const factorStr = A[i][j] + '×' + B[j][k];
        paintBox(i, j, k, 0xe06000, 0.95, 0x2a0e00, factorStr);
      } else if (mmHoverJVal >= 0) {
        paintBox(i, j, k, 0x20c0e0, 0.50, 0, Cube[i][j][k]);
      } else {
        paintBox(i, j, k, 0x20c0e0, 0.95, 0x0a3040, Cube[i][j][k]);
      }
    } else if (selI >= 0) {
      paintBox(i, j, k, 0x50c878, 0.25, 0, Cube[i][j][k]);
    } else {
      paintBox(i, j, k, 0x50c878, buildComplete ? 0.78 : 0.40, 0, Cube[i][j][k]);
    }
  }
}

function mmRenderExploreGridA() {
  const el = document.getElementById('gridA');
  if (!el || !A.length) return;
  const titleEl = document.getElementById('mmTitleA');
  if (titleEl) titleEl.textContent = labelA;
  el.style.gridTemplateColumns = `repeat(${J},44px)`;
  const exploring = mmSelectedI >= 0 && t1 < 0;
  let html = '';
  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) {
    let cls = 'mat-cell neutral editable';
    if (mmSelectedI >= 0 && i === mmSelectedI) cls += ' hi';
    const hoverAttr = (exploring && i === mmSelectedI) ? ` data-hover-j="${j}"` : '';
    html += `<div class="${cls}" data-edit-a="${i},${j}"${hoverAttr}>${A[i][j]}</div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-edit-a]').forEach(cell => {
    const [ci, cj] = cell.dataset.editA.split(',').map(Number);
    cell.onclick = function() { editCellInline(this, A[ci][cj], '#e06000', function(v) { A[ci][cj] = v; recomputeFromMatrices(); }); };
  });
  el.querySelectorAll('[data-hover-j]').forEach(cell => {
    const hj = +cell.dataset.hoverJ;
    cell.onmouseenter = () => mmHoverCell(hj);
    cell.onmouseleave = () => mmClearHover();
  });
  const rb = document.getElementById('dimRowBtnsA'); if (rb) rb.innerHTML = dimBtnsV('I');
  const cb = document.getElementById('dimColBtnsA'); if (cb) cb.innerHTML = dimBtnsH('J', true);
}

function mmRenderExploreGridB() {
  const el = document.getElementById('gridB');
  if (!el || !B.length) return;
  const titleEl = document.getElementById('mmTitleB');
  if (titleEl) titleEl.textContent = labelB;
  el.style.gridTemplateColumns = `repeat(${K},44px)`;
  const exploring = mmSelectedK >= 0 && t1 < 0;
  let html = '';
  for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
    let cls = 'mat-cell neutral-b editable';
    if (mmSelectedK >= 0 && k === mmSelectedK) cls += ' hi';
    const hoverAttr = (exploring && k === mmSelectedK) ? ` data-hover-j="${j}"` : '';
    html += `<div class="${cls}" data-edit-b="${j},${k}"${hoverAttr}>${B[j][k]}</div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-edit-b]').forEach(cell => {
    const [cj, ck] = cell.dataset.editB.split(',').map(Number);
    cell.onclick = function() { editCellInline(this, B[cj][ck], '#1a60b0', function(v) { B[cj][ck] = v; recomputeFromMatrices(); }); };
  });
  el.querySelectorAll('[data-hover-j]').forEach(cell => {
    const hj = +cell.dataset.hoverJ;
    cell.onmouseenter = () => mmHoverCell(hj);
    cell.onmouseleave = () => mmClearHover();
  });
  const rb = document.getElementById('dimRowBtnsB'); if (rb) rb.innerHTML = dimBtnsV('J', true);
  const cb = document.getElementById('dimColBtnsB'); if (cb) cb.innerHTML = dimBtnsH('K');
}

function mmRenderExploreSubViz() {
  const el = document.getElementById('dpSubViz');
  if (!el) return;
  if (mmSelectedI < 0 || mmSelectedK < 0) { el.style.display = 'none'; return; }
  el.style.display = '';
  renderSubVizHTML(el, mmSelectedI, mmSelectedK, J - 1, J - 1, false);
}

// ══════════════════════════════════════════════════
// 2D SIDE GRIDS (during outer-product build)
// ══════════════════════════════════════════════════

export function renderA(j, curI, curK) {
  const el = document.getElementById('gridA');
  if (!el || !A.length) return;
  const titleEl = document.getElementById('mmTitleA');
  if (titleEl) titleEl.textContent = labelA;
  el.style.gridTemplateColumns = `repeat(${J},44px)`; el.innerHTML = '';
  for (let i = 0; i < I; i++) for (let jj = 0; jj < J; jj++) {
    const d = document.createElement('div'); d.className = 'mat-cell neutral editable';
    if (j >= 0) { if (jj === j) { if (i === curI) d.classList.add('cur'); else d.classList.add('hi'); } else d.classList.add('dim'); }
    else if (mmSelectedI >= 0 && i === mmSelectedI) d.classList.add('hi');
    d.textContent = A[i][jj];
    ((ci, cj) => { d.onclick = function() { editCellInline(this, A[ci][cj], '#e06000', function(v) { A[ci][cj] = v; recomputeFromMatrices(); }); }; })(i, jj);
    el.appendChild(d);
  }
  const rb = document.getElementById('dimRowBtnsA'); if (rb) rb.innerHTML = dimBtnsV('I');
  const cb = document.getElementById('dimColBtnsA'); if (cb) cb.innerHTML = dimBtnsH('J', true);
}

export function renderB(j, curI, curK) {
  const el = document.getElementById('gridB');
  if (!el || !B.length) return;
  const titleEl = document.getElementById('mmTitleB');
  if (titleEl) titleEl.textContent = labelB;
  el.style.gridTemplateColumns = `repeat(${K},44px)`; el.innerHTML = '';
  for (let jj = 0; jj < J; jj++) for (let k = 0; k < K; k++) {
    const d = document.createElement('div'); d.className = 'mat-cell neutral-b editable';
    if (j >= 0) { if (jj === j) { if (k === curK) d.classList.add('cur'); else d.classList.add('hi'); } else d.classList.add('dim'); }
    else if (mmSelectedK >= 0 && k === mmSelectedK) d.classList.add('hi');
    d.textContent = B[jj][k];
    ((cj, ck) => { d.onclick = function() { editCellInline(this, B[cj][ck], '#1a60b0', function(v) { B[cj][ck] = v; recomputeFromMatrices(); }); }; })(jj, k);
    el.appendChild(d);
  }
  const rb = document.getElementById('dimRowBtnsB'); if (rb) rb.innerHTML = dimBtnsV('J', true);
  const cb = document.getElementById('dimColBtnsB'); if (cb) cb.innerHTML = dimBtnsH('K');
}

// ══════════════════════════════════════════════════
// RESULT GRID
// ══════════════════════════════════════════════════

export function mmRenderResult() {
  const container = document.getElementById('mmResultGrid');
  if (!container) return;
  container.style.gridTemplateColumns = `repeat(${K},44px)`;
  let html = '';
  const showValues = mmPhase === 'done' || mmPhase === 'collapse' || collapseT >= 1;
  const hasSelection = mmSelectedI >= 0 && mmSelectedK >= 0;
  const exploring = hasSelection && t1 < 0;

  if (exploring || showValues) {
    // Post-build or exploration mode
    for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
      let cls = 'mat-cell r';
      if (hasSelection && i === mmSelectedI && k === mmSelectedK) cls += ' cur';
      else cls += ' done';
      html += `<div class="${cls}" onclick="mmSelectResultCell(${i},${k})" style="cursor:pointer">${Res[i][k]}</div>`;
    }
  } else if (buildMode === 'outer' && mmPhase === 'build') {
    // OP build: partial sums
    const buildPartial = t1 >= 0;
    let completedJ = -1;
    if (buildPartial) {
      const {j} = opDecodeStep(t1);
      completedJ = j >= J ? J - 1 : j;
    }
    for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
      let cls = 'mat-cell r';
      let val = '';
      if (buildPartial) {
        cls += ' partial';
        let partial = 0;
        for (let jj = 0; jj <= completedJ; jj++) partial += Cube[i][jj][k];
        val = partial;
      } else {
        cls += ' empty';
      }
      html += `<div class="${cls}">${val}</div>`;
    }
  } else {
    // DP build or empty: handled by dpRenderResult
    return;
  }
  container.innerHTML = html;

  const hint = document.getElementById('mmResultHint');
  if (hint) {
    if (hasSelection) hint.textContent = `Result[${mmSelectedI}, ${mmSelectedK}] — row ${mmSelectedI} · col ${mmSelectedK}`;
    else if (showValues) hint.textContent = 'click cell to trace inputs';
    else hint.textContent = '';
  }
}

// ══════════════════════════════════════════════════
// DOT PRODUCT VECTOR INTRO (shelf content)
// ══════════════════════════════════════════════════

export function dpRenderVectorIntro(targetId) {
  const el = document.getElementById(targetId || 'shelfContent');
  if (!el) return;
  const aRow = Array.from({length: J}, (_, j) => A[0][j]);
  const bCol = Array.from({length: J}, (_, j) => B[j][0]);
  const products = aRow.map((v, j) => v * bCol[j]);
  const sum = products.reduce((s, v) => s + v, 0);

  const aVals = aRow.join(', ');
  const bVals = bCol.join(', ');
  const mulStr = aRow.map((v, j) => `<span class="fa">${v}</span>×<span class="fb">${bCol[j]}</span>`).join(' + ');
  const prodStr = products.join(' + ');

  el.innerHTML =
    `<span class="dvi-title">What is a dot product?</span>`
    + `\n<span style="color:#999"># two vectors (from row 0 of A, col 0 of B):</span>`
    + `\n<span class="fa">a</span> = torch.tensor([${aVals}])`
    + `\n<span class="fb">b</span> = torch.tensor([${bVals}])`
    + `\n`
    + `\n<span style="color:#999"># the dot product:</span>`
    + `\ntorch.dot(<span class="fa">a</span>, <span class="fb">b</span>)  <span style="color:#999"># = <span class="fc" style="font-weight:700">${sum}</span></span>`
    + `\n`
    + `\n<span style="color:#999"># what it does:</span>`
    + `\n  ${mulStr}`
    + `\n  = ${prodStr}`
    + `\n  = <span class="fc" style="font-weight:700">${sum}</span>`
    + `<span class="dvi-note">Multiply matching elements, then sum.</span>`
    + `\n\n<span style="color:#999;font-size:0.68rem">einsum('<span class="ei-contract" style="font-weight:700">j</span>,<span class="ei-contract" style="font-weight:700">j</span>->', <span class="fa">a</span>, <span class="fb">b</span>)</span>`
    + `\n<span style="color:#999;font-size:0.62rem;font-style:italic"><span class="ei-contract" style="font-weight:700">j</span> in both inputs, not in output → summed</span>`;
}
