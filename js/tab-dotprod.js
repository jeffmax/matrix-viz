// ══════════════════════════════════════════════════
// TAB 2 — DOT PRODUCT: ROW · COLUMN
// ══════════════════════════════════════════════════
import { I, J, K, A, B, Cube, Res, currentMode, labelA, labelB, editCellInline, recomputeFromMatrices, dimBtnsH, dimBtnsV } from './shared.js';
import { boxes, paintBox, packedY, plusPlanes, addPlusPlanes, removePlusPlanes } from './cube-manager.js';

let dpStep = -1, dpPlaying = false, dpTm = null;
export let dpCollapseT = 1;
let dpSelectedI = -1, dpSelectedK = -1;
let dpHoverJ = -1;

export function resetDpState() {
  dpStep = -1; dpSelectedI = -1; dpSelectedK = -1; dpCollapseT = 1; dpHoverJ = -1;
}

/* @testable */
export function getDpState() { return { dpStep, dpSelectedI, dpSelectedK, dpCollapseT }; }

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

  // Handle plus planes (same logic as matmul collapse)
  if (t < 1 && plusPlanes.length === 0 && J > 1) addPlusPlanes();
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
  if (t >= 1) removePlusPlanes();

  dpHighlightCubeColumn();
}

export function dpScrubCollapse(t) {
  dpApplyCollapse(t);
  const title = document.getElementById('dpCanvasTitle');
  if (title) {
    if (t >= 1) title.textContent = 'Result — collapsed';
    else if (t <= 0) title.textContent = 'Result — stacked';
    else title.textContent = `Result — collapsing (${Math.round(t * 100)}%)`;
  }
}

/* @testable */
export function dpTermByTerm() {
  const chk = document.getElementById('chkDpCol');
  return !chk || !chk.checked;
}
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
  dpRenderGridA();
  dpRenderGridB();
  dpRenderResult();
  dpRenderDots();
  dpRenderFormula();
  dpHighlightCubeColumn();
  dpRenderSubViz();
}

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

// ── Decode current selection state ──
function dpCurrentSelection() {
  let curI, curK, curJ;
  if (dpSelectedI >= 0 && dpSelectedK >= 0 && dpStep < 0) {
    curI = dpSelectedI; curK = dpSelectedK; curJ = -1;
  } else {
    const dec = dpDecodeStep(dpStep);
    curI = dec.i; curK = dec.k; curJ = dec.j;
  }
  const completedUpTo = dpStep < 0 ? -1 : (dpTermByTerm() ? Math.floor((dpStep) / J) - ((dpStep % J === J - 1) ? 0 : 1) : dpStep - 1);
  const exploring = dpSelectedI >= 0 && dpStep < 0;
  return { curI, curK, curJ, completedUpTo, exploring };
}

function dpRenderGridA() {
  const container = document.getElementById('dpGridA');
  if (!container) return;
  const { curI, curJ, exploring } = dpCurrentSelection();

  let html = '';
  container.style.gridTemplateColumns = `repeat(${J},44px)`;
  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) {
    let cls = 'mat-cell neutral editable';
    if (curI >= 0 && i === curI) {
      if (curJ >= 0 && j === curJ) cls += ' cur';
      else cls += ' hi';
    }
    const hoverAttr = (exploring && i === curI) ? ` data-hover-j="${j}"` : '';
    html += `<div class="${cls}" data-edit-a="${i},${j}"${hoverAttr}>${A[i][j]}</div>`;
  }
  container.innerHTML = html;

  // Title
  const titleEl = document.getElementById('dpTitleA');
  if (titleEl) titleEl.innerHTML = `<span style="color:#e06000;font-weight:600">${labelA}</span> <span style="color:#aaa;font-size:0.68rem">(${I}×${J})</span>`;

  // Dim buttons
  const rowBtns = document.getElementById('dpDimRowBtnsA');
  if (rowBtns) rowBtns.innerHTML = dimBtnsV('I');
  const colBtns = document.getElementById('dpDimColBtnsA');
  if (colBtns) colBtns.innerHTML = dimBtnsH('J');

  // Wire up edit handlers
  container.querySelectorAll('[data-edit-a]').forEach(el => {
    const [ci, cj] = el.dataset.editA.split(',').map(Number);
    el.onclick = function() { editCellInline(this, A[ci][cj], '#e06000', function(v) { A[ci][cj] = v; recomputeFromMatrices(); }); };
  });
  // Hover handlers
  container.querySelectorAll('[data-hover-j]').forEach(el => {
    const hj = +el.dataset.hoverJ;
    el.onmouseenter = () => dpHoverCell(hj);
    el.onmouseleave = () => dpClearHover();
  });
}

function dpRenderGridB() {
  const container = document.getElementById('dpGridB');
  if (!container) return;
  const { curK, curJ, exploring } = dpCurrentSelection();

  let html = '';
  container.style.gridTemplateColumns = `repeat(${K},44px)`;
  for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
    let cls = 'mat-cell neutral-b editable';
    if (curK >= 0 && k === curK) {
      if (curJ >= 0 && j === curJ) cls += ' cur';
      else cls += ' hi';
    }
    const hoverAttr = (exploring && k === curK) ? ` data-hover-j="${j}"` : '';
    html += `<div class="${cls}" data-edit-b="${j},${k}"${hoverAttr}>${B[j][k]}</div>`;
  }
  container.innerHTML = html;

  // Title
  const titleEl = document.getElementById('dpTitleB');
  if (titleEl) titleEl.innerHTML = `<span style="color:#1a60b0;font-weight:600">${labelB}</span> <span style="color:#aaa;font-size:0.68rem">(${J}×${K})</span>`;

  // Dim buttons
  const rowBtns = document.getElementById('dpDimRowBtnsB');
  if (rowBtns) rowBtns.innerHTML = dimBtnsV('J');
  const colBtns = document.getElementById('dpDimColBtnsB');
  if (colBtns) colBtns.innerHTML = dimBtnsH('K');

  // Wire up edit handlers
  container.querySelectorAll('[data-edit-b]').forEach(el => {
    const [cj, ck] = el.dataset.editB.split(',').map(Number);
    el.onclick = function() { editCellInline(this, B[cj][ck], '#1a60b0', function(v) { B[cj][ck] = v; recomputeFromMatrices(); }); };
  });
  // Hover handlers
  container.querySelectorAll('[data-hover-j]').forEach(el => {
    const hj = +el.dataset.hoverJ;
    el.onmouseenter = () => dpHoverCell(hj);
    el.onmouseleave = () => dpClearHover();
  });
}

function dpRenderResult() {
  const container = document.getElementById('dpResultGrid');
  if (!container) return;
  const { curI, curK, curJ, completedUpTo, exploring } = dpCurrentSelection();
  const collapsed = dpCollapseT >= 1;

  let html = '';
  container.style.gridTemplateColumns = `repeat(${K},44px)`;
  for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
    const cellIdx = i * K + k;
    const curCellIdx = curI >= 0 ? curI * K + curK : -1;
    let cls = 'mat-cell r';
    let val = '';
    if (exploring) {
      val = Res[i][k];
      if (cellIdx === curCellIdx) cls += ' cur';
      else if (collapsed) cls += ' muted';
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
      if (collapsed && dpSelectedI < 0) cls += ' done';
      else cls += ' done';
    } else {
      cls += ' empty';
    }
    html += `<div class="${cls}" onclick="dpJumpToCell(${i},${k})" style="cursor:pointer">${val}</div>`;
  }
  container.innerHTML = html;

  // Update result hint
  const hint = document.getElementById('dpResultHint');
  if (hint) {
    if (dpSelectedI >= 0 && dpSelectedK >= 0) hint.textContent = `Result[${dpSelectedI}, ${dpSelectedK}] — row ${dpSelectedI} · col ${dpSelectedK}`;
    else hint.textContent = 'click cell to trace inputs';
  }
}

function dpRenderSubViz() {
  const el = document.getElementById('dpSubViz');
  if (!el) return;

  let i, k, curJ;
  if (dpSelectedI >= 0 && dpSelectedK >= 0 && dpStep < 0) {
    i = dpSelectedI; k = dpSelectedK; curJ = J - 1;
  } else {
    const dec = dpDecodeStep(dpStep);
    i = dec.i; k = dec.k; curJ = dec.j;
  }
  if (i < 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';

  const upToJ = (dpStep >= 0 && dpTermByTerm()) ? curJ : J - 1;

  let html = `<div style="font-size:0.72rem;color:#888;font-weight:500">Row ${i} of ${labelA} · Column ${k} of ${labelB}</div>`;

  // Visual: row vector · column vector = scalar
  html += '<div class="dp-sub-viz-vectors">';
  // A[i,:] as horizontal row
  html += '<div class="dp-sub-viz-vec">';
  for (let j = 0; j < J; j++) {
    let cls = 'mat-cell neutral';
    if (dpTermByTerm() && j === curJ) cls += ' cur';
    html += `<div class="${cls}" style="width:36px;height:36px;font-size:0.78rem">${A[i][j]}</div>`;
  }
  html += '</div>';
  html += '<span style="font-size:1.1rem;color:#bbb;font-weight:300">·</span>';
  // B[:,k] as vertical column
  html += '<div class="dp-sub-viz-vec col">';
  for (let j = 0; j < J; j++) {
    let cls = 'mat-cell neutral-b';
    if (dpTermByTerm() && j === curJ) cls += ' cur';
    html += `<div class="${cls}" style="width:36px;height:36px;font-size:0.78rem">${B[j][k]}</div>`;
  }
  html += '</div>';
  html += '<span style="font-size:1.1rem;color:#bbb;font-weight:300">=</span>';
  // Result scalar
  let sum = 0;
  for (let j = 0; j <= upToJ; j++) sum += A[i][j] * B[j][k];
  const finalSum = (dpStep >= 0 && dpTermByTerm() && curJ < J - 1);
  html += `<div class="mat-cell r cur" style="width:40px;height:40px;font-size:0.95rem;font-weight:700">${finalSum ? sum : Res[i][k]}</div>`;
  html += '</div>';

  // Element-wise products
  html += '<div class="dp-products" style="justify-content:center"><span style="color:#666;font-size:0.75rem">Products:</span> ';
  for (let j = 0; j < J; j++) {
    const prod = A[i][j] * B[j][k];
    let cls = 'dp-term dp-term-prod';
    if (dpTermByTerm()) {
      if (j === curJ) cls += ' cur';
      else if (j > upToJ) cls += ' dim';
    }
    html += `<span class="${cls}">${prod}</span>`;
    if (j < J - 1) html += ' <span style="color:#ccc">+</span> ';
  }
  html += '</div>';

  // Partial/full sum
  if (dpTermByTerm() && dpStep >= 0 && curJ < J - 1) {
    html += `<div class="dp-sum-line" style="justify-content:center"><span style="color:#666;font-size:0.75rem">Partial sum (j=0..${curJ}):</span> <span class="dp-accum">${sum}</span></div>`;
  } else {
    let fullSum = 0;
    for (let j = 0; j < J; j++) fullSum += A[i][j] * B[j][k];
    html += `<div class="dp-sum-line" style="justify-content:center"><span style="color:#666;font-size:0.75rem">Sum:</span> <span class="dp-accum">${fullSum}</span> = Result[${i},${k}]</div>`;
  }

  el.innerHTML = html;
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
      + ` = <span class="fc">${Res[i][k]}</span>`;
    return;
  }
  const dec = dpDecodeStep(dpStep);
  i = dec.i; k = dec.k; curJ = dec.j;
  if (dpStep < 0) {
    f.innerHTML = 'Click a result cell to see its dot product. Or press ▶ to step through all.';
    return;
  }
  if (dpTermByTerm()) {
    f.innerHTML = `Result[<span class="fa">${i}</span>,<span class="fb">${k}</span>]: term j=<span class="fc">${curJ}</span>: `
      + `<span class="fa">${A[i][curJ]}</span> × <span class="fb">${B[curJ][k]}</span> = <span class="fc">${A[i][curJ] * B[curJ][k]}</span>`;
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
      if (dpHoverJ >= 0 && j === dpHoverJ) {
        // Hovered cell: bright orange with factor display
        const factorStr = A[i][j] + '×' + B[j][k];
        paintBox(i, j, k, 0xe06000, 0.95, 0x2a0e00, factorStr);
      } else if (dpHoverJ >= 0) {
        // Non-hovered cells in column: dimmed
        paintBox(i, j, k, 0xf0a040, 0.50, 0, Cube[i][j][k]);
      } else if (dpTermByTerm() && selJ >= 0 && j === selJ) {
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

export function dpJumpToCell(ti, tk) {
  dpPause();
  dpStep = -1;
  dpHoverJ = -1;
  dpSelectedI = ti;
  dpSelectedK = tk;
  dpRenderAll();
}

export function dpHoverCell(j) {
  if (dpSelectedI < 0 || dpSelectedK < 0 || dpStep >= 0) return;
  dpHoverJ = j;
  document.querySelectorAll('[data-hover-j]').forEach(el => {
    el.classList.toggle('cur', +el.dataset.hoverJ === j);
  });
  dpHighlightCubeColumn();
}

export function dpClearHover() {
  if (dpHoverJ < 0) return;
  dpHoverJ = -1;
  document.querySelectorAll('[data-hover-j]').forEach(el => {
    el.classList.remove('cur');
  });
  dpHighlightCubeColumn();
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
  dpCollapseT = 1;
  const dpSlider = document.getElementById('dpCollapseSlider');
  if (dpSlider) dpSlider.value = 1000;
  if (boxes.length) {
    dpApplyCollapse(1);
  }
  dpRenderAll();
}

// dpTermToggle removed — dot product tab always shows terms one by one
