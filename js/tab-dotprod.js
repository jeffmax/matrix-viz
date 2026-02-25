// ══════════════════════════════════════════════════
// TAB 2 — DOT PRODUCT: ROW · COLUMN
// ══════════════════════════════════════════════════
import { I, J, K, A, B, Cube, Res, currentMode, editCellInline, recomputeFromMatrices, dimBtnsH, dimBtnsV } from './shared.js';
import { boxes, paintBox, packedY } from './cube-manager.js';

let dpStep = -1, dpPlaying = false, dpTm = null;
export let dpCollapseT = 0;
let dpSelectedI = -1, dpSelectedK = -1;

export function resetDpState() {
  dpStep = -1; dpSelectedI = -1; dpSelectedK = -1; dpCollapseT = 0;
}

export function setDpCollapseT(t) { dpCollapseT = t; }

// Apply collapse to cube on the dot product tab
export function dpApplyCollapse(t) {
  if (!boxes.length) return;
  dpCollapseT = t;
  const e = -(Math.cos(Math.PI * t) - 1) / 2;
  for (let j = 0; j < J; j++) {
    const startY = packedY(j);
    const y = startY * (1 - e);
    const showJ = (t < 1) || (j === 0);
    for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
      const b = boxes[i][j][k];
      b.mesh.visible = showJ; b.edges.visible = showJ; b.spr.visible = showJ;
      if (!showJ) continue;
      b.mesh.position.y = y; b.edges.position.y = y; b.spr.position.y = y;
    }
  }
  dpHighlightCubeColumn();
}

export function dpScrubCollapse(t) {
  dpApplyCollapse(t);
  const title = document.getElementById('dpCanvasTitle');
  if (title) {
    if (t <= 0) title.textContent = 'The same cube — click a result cell to select a column';
    else if (t >= 1) title.textContent = 'Collapsed — each cell is a dot product sum';
    else title.textContent = `Collapsing… (${Math.round(t * 100)}%) — click a result cell to explore`;
  }
}

function dpTermByTerm() { return document.getElementById('chkDpTerm').checked; }
function dpTotalSteps() { return dpTermByTerm() ? I * K * J : I * K; }
function dpDelay() { return 1400 - parseInt(document.getElementById('spDP').value || 600); }

function dpDecodeStep(s) {
  if (s < 0) return {i: -1, k: -1, j: -1};
  if (dpTermByTerm()) {
    const cellIdx = Math.floor(s / J);
    const j = s % J;
    if (cellIdx >= I * K) return {i: -1, k: -1, j: -1};
    return {i: Math.floor(cellIdx / K), k: cellIdx % K, j: j};
  } else {
    if (s >= I * K) return {i: -1, k: -1, j: -1};
    return {i: Math.floor(s / K), k: s % K, j: -1};
  }
}

export function dpRenderAll() {
  dpRenderVectorIntro();
  dpRenderMatrices();
  dpRenderDots();
  dpRenderFormula();
  dpHighlightCubeColumn();
  dpRenderColumnDetail();
}

function dpRenderVectorIntro() {
  const el = document.getElementById('dpVectorIntro');
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

function dpRenderMatrices() {
  const container = document.getElementById('dpMatrices');
  if (!container) return;
  let curI, curK, curJ;
  if (dpSelectedI >= 0 && dpSelectedK >= 0 && dpStep < 0) {
    curI = dpSelectedI; curK = dpSelectedK; curJ = -1;
  } else {
    const dec = dpDecodeStep(dpStep);
    curI = dec.i; curK = dec.k; curJ = dec.j;
  }
  const completedUpTo = dpStep < 0 ? -1 : (dpTermByTerm() ? Math.floor((dpStep) / J) - ((dpStep % J === J - 1) ? 0 : 1) : dpStep - 1);

  let aHtml = '<div class="dp-mat-block">';
  aHtml += `<div class="dp-mat-label"><span style="color:#e06000;font-weight:600">A</span> (${I}×${J})</div>`;
  aHtml += `<div class="grid-with-row-btns">`;
  aHtml += `<div class="dp-grid" style="grid-template-columns:repeat(${J},44px)">`;
  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) {
    let cls = 'mat-cell neutral editable';
    if (curI >= 0 && i === curI) {
      if (curJ >= 0 && j === curJ) cls += ' cur';
      else cls += ' hi';
    }
    aHtml += `<div class="${cls}" data-edit-a="${i},${j}">${A[i][j]}</div>`;
  }
  aHtml += `</div>${dimBtnsV('I')}</div>`;
  aHtml += dimBtnsH('J');
  aHtml += '</div>';

  let bHtml = '<div class="dp-mat-block">';
  bHtml += `<div class="dp-mat-label"><span style="color:#1a60b0;font-weight:600">B</span> (${J}×${K})</div>`;
  bHtml += `<div class="grid-with-row-btns">`;
  bHtml += `<div class="dp-grid" style="grid-template-columns:repeat(${K},44px)">`;
  for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
    let cls = 'mat-cell neutral-b editable';
    if (curK >= 0 && k === curK) {
      if (curJ >= 0 && j === curJ) cls += ' cur';
      else cls += ' hi';
    }
    bHtml += `<div class="${cls}" data-edit-b="${j},${k}">${B[j][k]}</div>`;
  }
  bHtml += `</div>${dimBtnsV('J')}</div>`;
  bHtml += dimBtnsH('K');
  bHtml += '</div>';

  const exploring = dpSelectedI >= 0 && dpStep < 0;
  let rHtml = '<div class="dp-mat-block">';
  rHtml += `<div class="dp-mat-label"><span style="color:#1a9a40;font-weight:600">Result</span> (${I}×${K})</div>`;
  rHtml += `<div class="dp-grid" style="grid-template-columns:repeat(${K},44px)">`;
  for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
    const cellIdx = i * K + k;
    const curCellIdx = curI >= 0 ? curI * K + curK : -1;
    let cls = 'mat-cell r';
    let val = '';
    if (exploring) {
      val = Res[i][k];
      if (cellIdx === curCellIdx) cls += ' cur';
      else cls += ' done';
    } else if (cellIdx === curCellIdx) {
      cls += ' cur';
      if (dpTermByTerm() && curJ >= 0) {
        let partial = 0;
        for (let jj = 0; jj <= curJ; jj++) partial += A[i][jj] * B[jj][k];
        val = partial;
      } else {
        val = Res[i][k];
      }
    } else if (cellIdx <= completedUpTo) {
      cls += ' done';
      val = Res[i][k];
    } else if (dpStep < 0) {
      val = Res[i][k];
      cls += ' done';
    } else {
      cls += ' empty';
    }
    rHtml += `<div class="${cls}" onclick="dpJumpToCell(${i},${k})" style="cursor:pointer">${val}</div>`;
  }
  rHtml += '</div></div>';

  container.innerHTML = aHtml + bHtml + rHtml;

  container.querySelectorAll('[data-edit-a]').forEach(el => {
    const [ci, cj] = el.dataset.editA.split(',').map(Number);
    el.onclick = function() { editCellInline(this, A[ci][cj], '#e06000', function(v) { A[ci][cj] = v; recomputeFromMatrices(); }); };
  });
  container.querySelectorAll('[data-edit-b]').forEach(el => {
    const [cj, ck] = el.dataset.editB.split(',').map(Number);
    el.onclick = function() { editCellInline(this, B[cj][ck], '#1a60b0', function(v) { B[cj][ck] = v; recomputeFromMatrices(); }); };
  });
}

function dpRenderDots() {
  const el = document.getElementById('dDP');
  if (!el) return;
  el.innerHTML = '';
  const total = I * K;
  for (let d = 0; d < total; d++) {
    const dot = document.createElement('div'); dot.className = 'step-dot';
    const doneThresh = dpTermByTerm() ? (d + 1) * J - 1 : d;
    const curThresh = dpTermByTerm() ? d * J : d;
    if (dpStep > doneThresh) dot.classList.add('done');
    else if (dpStep >= curThresh) dot.classList.add('cur');
    el.appendChild(dot);
  }
}

function dpRenderFormula() {
  const f = document.getElementById('fDP');
  if (!f) return;
  let i, k, curJ;
  if (dpSelectedI >= 0 && dpSelectedK >= 0 && dpStep < 0) {
    i = dpSelectedI; k = dpSelectedK; curJ = J - 1;
    f.innerHTML = `Result[<span class="fa">${i}</span>,<span class="fb">${k}</span>] = `
      + Array.from({length: J}, (_, j) => `<span class="fa">${A[i][j]}</span>·<span class="fb">${B[j][k]}</span>`).join(' + ')
      + ` = <span class="fc">${Res[i][k]}</span>`
      + `  <em class="dp-connection">This is cube column [${i}, ·, ${k}] summed along j.</em>`;
    return;
  }
  const dec = dpDecodeStep(dpStep);
  i = dec.i; k = dec.k; curJ = dec.j;
  if (dpStep < 0) {
    f.innerHTML = 'Click a result cell to see its dot product as a column through the cube. Or press ▶ to step through all.';
    return;
  }
  if (dpTermByTerm()) {
    f.innerHTML = `Result[<span class="fa">${i}</span>,<span class="fb">${k}</span>]: term j=<span class="fc">${curJ}</span>: `
      + `<span class="fa">${A[i][curJ]}</span> × <span class="fb">${B[curJ][k]}</span> = <span class="fc">${A[i][curJ] * B[curJ][k]}</span>`
      + `  <em class="dp-connection">Each term is one cell in tab ①'s cube at [${i},${curJ},${k}]. The dot product looks DOWN through the cube.</em>`;
  } else {
    f.innerHTML = `Result[<span class="fa">${i}</span>,<span class="fb">${k}</span>] = `
      + Array.from({length: J}, (_, j) => `<span class="fa">${A[i][j]}</span>·<span class="fb">${B[j][k]}</span>`).join(' + ')
      + ` = <span class="fc">${Res[i][k]}</span>`;
  }
}

function dpHighlightCubeColumn() {
  if (!boxes.length || currentMode !== 'dotprod') return;

  let selI, selK, selJ = -1;
  if (dpSelectedI >= 0 && dpSelectedK >= 0 && dpStep < 0) {
    selI = dpSelectedI; selK = dpSelectedK;
  } else {
    const dec = dpDecodeStep(dpStep);
    selI = dec.i; selK = dec.k; selJ = dec.j;
  }

  const completedUpTo = dpStep < 0 ? -1 : (dpTermByTerm() ? Math.floor((dpStep) / J) - ((dpStep % J === J - 1) ? 0 : 1) : dpStep - 1);
  const collapsed = dpCollapseT >= 1;

  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
    const b = boxes[i][j][k];
    if (!b.mesh.visible) continue;

    const cellIdx = i * K + k;

    if (collapsed) {
      if (selI >= 0 && i === selI && k === selK) {
        paintBox(i, j, k, 0xf0a040, 0.95, 0x2a0e00, Res[i][k]);
      } else {
        paintBox(i, j, k, 0x50c878, 0.78, 0, Res[i][k]);
      }
    } else if (selI >= 0 && i === selI && k === selK) {
      if (dpTermByTerm() && selJ >= 0 && j === selJ) {
        paintBox(i, j, k, 0xe06000, 0.95, 0x2a0e00, Cube[i][j][k]);
      } else if (dpTermByTerm() && selJ >= 0 && j < selJ) {
        paintBox(i, j, k, 0x50c878, 0.78, 0, Cube[i][j][k]);
      } else if (!dpTermByTerm() || selJ < 0) {
        paintBox(i, j, k, 0xf0a040, 0.95, 0x2a0e00, Cube[i][j][k]);
      } else {
        paintBox(i, j, k, 0xeeeeee, 0.30, 0, Cube[i][j][k]);
      }
    } else if (dpStep >= 0 && cellIdx <= completedUpTo) {
      paintBox(i, j, k, 0x50c878, 0.55, 0, Cube[i][j][k]);
    } else if (dpStep < 0 && dpSelectedI < 0) {
      paintBox(i, j, k, 0x50c878, 0.78, 0, Cube[i][j][k]);
    } else if (dpStep < 0 && dpSelectedI >= 0) {
      paintBox(i, j, k, 0x50c878, 0.25, 0, Cube[i][j][k]);
    } else {
      paintBox(i, j, k, 0x50c878, 0.12, 0, null);
    }
  }
}

function dpRenderColumnDetail() {
  const el = document.getElementById('dpColumnDetail');
  if (!el) return;

  let i, k, curJ;
  if (dpSelectedI >= 0 && dpSelectedK >= 0 && dpStep < 0) {
    i = dpSelectedI; k = dpSelectedK; curJ = J - 1;
  } else {
    const dec = dpDecodeStep(dpStep);
    i = dec.i; k = dec.k; curJ = dec.j;
  }
  if (i < 0) {
    el.innerHTML = '<div class="dp-detail-title">Column detail</div>Click a result cell to see the dot product extracted from the cube';
    return;
  }

  const upToJ = (dpStep >= 0 && dpTermByTerm()) ? curJ : J - 1;

  let html = '<div class="dp-detail-title">Cube column [' + i + ', ·, ' + k + '] = element-wise products</div>';
  html += '<div class="dp-row-vals"><span style="color:#e06000;font-weight:600">A[' + i + ',:]</span> = [ ';
  for (let j = 0; j < J; j++) {
    let cls = 'dp-term dp-term-a';
    if (dpTermByTerm() && j === curJ) cls += ' cur';
    html += `<span class="${cls}">${A[i][j]}</span>`;
    if (j < J - 1) html += ' ';
  }
  html += ' ]</div>';

  html += '<div class="dp-col-vals"><span style="color:#1a60b0;font-weight:600">B[:,' + k + ']</span> = [ ';
  for (let j = 0; j < J; j++) {
    let cls = 'dp-term dp-term-b';
    if (dpTermByTerm() && j === curJ) cls += ' cur';
    html += `<span class="${cls}">${B[j][k]}</span>`;
    if (j < J - 1) html += ' ';
  }
  html += ' ]</div>';

  html += '<div class="dp-products"><span style="color:#666">Cube[' + i + ',j,' + k + ']:</span> ';
  let sum = 0;
  for (let j = 0; j < J; j++) {
    const prod = A[i][j] * B[j][k];
    let cls = 'dp-term dp-term-prod';
    if (dpTermByTerm()) {
      if (j === curJ) cls += ' cur';
      else if (j > upToJ) cls += ' dim';
    }
    if (j <= upToJ) sum += prod;
    html += `<span class="${cls}">${prod}</span>`;
    if (j < J - 1) html += ' <span style="color:#ccc">+</span> ';
  }
  html += '</div>';

  if (dpTermByTerm() && curJ < J - 1) {
    html += `<div class="dp-sum-line"><span style="color:#666">Partial sum (j=0..${curJ}):</span> <span class="dp-accum">${sum}</span></div>`;
  } else {
    html += `<div class="dp-sum-line"><span style="color:#666">Sum:</span> <span class="dp-accum">${sum}</span> = Result[${i},${k}]</div>`;
  }

  el.innerHTML = html;
}

export function dpJumpToCell(ti, tk) {
  dpPause();
  if (dpStep < 0) {
    dpSelectedI = ti; dpSelectedK = tk;
    dpRenderAll();
    return;
  }
  const cellIdx = ti * K + tk;
  if (dpTermByTerm()) {
    dpStep = cellIdx * J;
  } else {
    dpStep = cellIdx;
  }
  dpRenderAll();
}

export function dpToggle() {
  if (dpPlaying) dpPause();
  else dpPlay();
}

function dpPlay() {
  if (dpStep >= dpTotalSteps() - 1) dpStep = -1;
  dpSelectedI = -1; dpSelectedK = -1;
  dpPlaying = true;
  document.getElementById('pbDP').textContent = '⏸';
  dpTick();
}

export function dpPause() {
  dpPlaying = false;
  clearTimeout(dpTm);
  const btn = document.getElementById('pbDP');
  if (btn) btn.textContent = '▶';
}

function dpTick() {
  if (!dpPlaying) return;
  if (dpStep < dpTotalSteps() - 1) {
    dpStep++;
    dpRenderAll();
    dpTm = setTimeout(dpTick, dpDelay());
  } else {
    dpPause();
  }
}

export function dpFwd() {
  dpPause();
  if (dpStep < dpTotalSteps() - 1) { dpStep++; dpRenderAll(); }
}

export function dpBack() {
  dpPause();
  if (dpStep > -1) { dpStep--; dpRenderAll(); }
}

export function dpReset() {
  dpPause();
  dpStep = -1;
  dpSelectedI = -1; dpSelectedK = -1;
  dpRenderAll();
}

export function dpTermToggle() {
  dpPause();
  dpStep = -1;
  dpSelectedI = -1; dpSelectedK = -1;
  dpRenderAll();
}
