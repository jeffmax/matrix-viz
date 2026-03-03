// ══════════════════════════════════════════════════
// TAB 1 — OUTER PRODUCTS, SLICE BY SLICE
// Build cube slice by slice, then collapse via scrubable animation
// ══════════════════════════════════════════════════
import { I, J, K, A, B, Cube, Res, rand, labelA, labelB, editCellInline, recomputeFromMatrices, dimBtnsH, dimBtnsV, setData } from './shared.js';
import { makeTex } from './scene.js';
import { boxes, plusPlanes, paintBox, paintSlice, ensureAllGreen, packedY, addPlusPlanes, removePlusPlanes } from './cube-manager.js';

const THREE = window.THREE;

// ── Build state ──
let t1 = -1, pl1 = false, tm1 = null, lastOpJ = -1;

// ── Collapse state ──
export let collapseT = 0;
let colAnimId = null;
let colDir = 0;
const COL_SPEED = 0.0005;

// ── Unified state machine ──
export let mmPhase = 'build'; // 'build' | 'collapse' | 'done'

function elemByElem() { return document.getElementById('chkElem').checked; }
function totalSteps1() { return elemByElem() ? J * I * K : J; }

function decodeS1(s) {
  if (s < 0) return {j: -1, cellI: -1, cellK: -1};
  if (elemByElem()) {
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

export function applyS1(s) {
  if (!boxes.length) return;
  const {j, cellI, cellK} = decodeS1(s);
  for (let jj = 0; jj < J; jj++) {
    if (jj < j) paintSlice(jj, 'done');
    else paintSlice(jj, 'empty');
  }
  if (j < 0) { renderA(-1, -1, -1); renderB(-1, -1, -1); setF1(s); setD1(s); updateOpDisplay(s); return; }
  if (j >= J) { ensureAllGreen(); renderA(-1, -1, -1); renderB(-1, -1, -1); setF1(s); setD1(s); updateOpDisplay(s); return; }

  if (cellI < 0) {
    paintSlice(j, 'active');
    renderA(j, -1, -1); renderB(j, -1, -1);
  } else {
    const cur = cellI * K + cellK;
    for (let ii = 0; ii < I; ii++) for (let kk = 0; kk < K; kk++) {
      const flat = ii * K + kk;
      if (flat < cur) paintBox(ii, j, kk, 0x50c878, 0.78, 0, Cube[ii][j][kk]);
      else if (flat === cur) paintBox(ii, j, kk, 0xe06000, 0.95, 0x2a0e00, Cube[ii][j][kk]);
      else paintBox(ii, j, kk, 0xeeeeee, 0.10, 0, null);
    }
    renderA(j, cellI, -1);
    renderB(j, -1, cellK);
  }
  setF1(s); setD1(s); updateOpDisplay(s);
}

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

// ── Outer product visual display ──
function updateOpDisplay(s) {
  const panel = document.getElementById('opDisplay');
  const {j, cellI, cellK} = decodeS1(s);
  if (j < 0 || j >= J) { panel.classList.add('hidden'); panel.innerHTML = ''; lastOpJ = -1; opStopHi(); return; }
  panel.classList.remove('hidden');

  const ebe = elemByElem() && cellI >= 0;
  const sz = 32;

  if (!ebe) {
    const animate = j !== lastOpJ;
    lastOpJ = j;
    opStopHi();
    const bDelay = 120, rDelay = 70;
    const rBase = animate ? Math.max(K - 1, I - 1) * bDelay + 200 : 0;

    // A[:,j] with dotted border around original column
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

    // B[j,:] with dotted border around original row
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

    // Highlight input cells as each result cell appears
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

function setF1(s) {
  const el = document.getElementById('fMM');
  const {j, cellI, cellK} = decodeS1(s);
  if (s < 0) {
    el.innerHTML = elemByElem()
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

function setD1(s) {
  const el = document.getElementById('dMM'); el.innerHTML = '';
  const dotCount = J;
  for (let d = 0; d < dotCount; d++) {
    const dot = document.createElement('div'); dot.className = 'step-dot';
    const doneThresh = elemByElem() ? (d + 1) * I * K - 1 : d;
    const curThresh = elemByElem() ? d * I * K : d;
    if (s > doneThresh) dot.classList.add('done');
    else if (s >= curThresh) dot.classList.add('cur');
    el.appendChild(dot);
  }
}

function spdMM() { return 1900 - parseInt(document.getElementById('spMM').value || 700); }

// ── Playback ──
function mmStopBuildTimer() { pl1 = false; clearTimeout(tm1); }
export function mmPauseBuild() { mmStopBuildTimer(); opStopHi(); }
export function mmPauseAll() {
  mmPauseBuild();
  stopColAnim();
  document.getElementById('pbMM').textContent = '▶';
}

export function mmToggle() {
  if (mmPhase === 'build') {
    if (pl1) { mmPauseAll(); return; }
    if (t1 >= totalSteps1() - 1) t1 = -1;
    pl1 = true;
    document.getElementById('pbMM').textContent = '⏸';
    mmTickBuild();
  } else if (mmPhase === 'collapse') {
    if (colDir !== 0) { mmPauseAll(); return; }
    if (collapseT >= 1) collapseT = 0;
    if (plusPlanes.length === 0) addPlusPlanes();
    document.getElementById('pbMM').textContent = '⏸';
    runColAnim(+1);
  } else {
    mmReset();
    mmToggle();
  }
}

function mmTickBuild() {
  if (!pl1) return;
  if (t1 < totalSteps1() - 1) {
    t1++; applyS1(t1);
    if (t1 >= totalSteps1() - 1) { mmBuildDone(); return; }
    tm1 = setTimeout(mmTickBuild, spdMM());
  }
}

/* @testable */
export function mmBuildDone() {
  mmStopBuildTimer();
  mmPhase = 'collapse';
  collapseT = 0;
  addPlusPlanes();
  document.getElementById('spCollapse').disabled = false;
  document.getElementById('pbMM').textContent = '▶';
  mmUpdateCanvasTitle();
  const fEl = document.getElementById('fMM');
  if (fEl) fEl.innerHTML = `All <span class="fc">${J}</span> slices built. Press ▶ to collapse them into the result, or drag the slider.`;
}

export function mmFwd() {
  if (mmPhase === 'build') {
    mmPauseAll();
    if (t1 < totalSteps1() - 1) {
      t1++; applyS1(t1);
      if (t1 >= totalSteps1() - 1) mmBuildDone();
    }
  } else if (mmPhase === 'collapse') {
    mmPauseAll();
    collapseT = Math.min(1, collapseT + 0.1);
    applyCollapse(collapseT);
    mmUpdateCanvasTitle();
    if (collapseT >= 1) mmPhase = 'done';
  }
}

export function mmBack() {
  if (mmPhase === 'build') {
    mmPauseAll();
    if (t1 > -1) { t1--; applyS1(t1); }
  } else if (mmPhase === 'collapse') {
    mmPauseAll();
    if (collapseT <= 0) {
      mmPhase = 'build';
      removePlusPlanes();
      document.getElementById('spCollapse').disabled = true;
      collapseT = 0;
      t1 = totalSteps1() - 1;
      ensureAllGreen();
      for (let j = 0; j < J; j++) {
        const py = packedY(j);
        for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
          const b = boxes[i][j][k];
          b.mesh.position.y = py; b.edges.position.y = py; b.spr.position.y = py;
        }
      }
      applyS1(t1);
      mmUpdateCanvasTitle();
      return;
    }
    collapseT = Math.max(0, collapseT - 0.1);
    applyCollapse(collapseT);
    mmUpdateCanvasTitle();
  } else {
    mmPauseAll();
    mmPhase = 'collapse';
    collapseT = Math.max(0, 1 - 0.1);
    if (plusPlanes.length === 0) addPlusPlanes();
    applyCollapse(collapseT);
    mmUpdateCanvasTitle();
  }
}

export function mmReset() {
  mmPauseAll();
  mmPhase = 'build';
  t1 = -1; collapseT = 0; lastOpJ = -1;
  removePlusPlanes();
  document.getElementById('spCollapse').disabled = true;
  document.getElementById('spCollapse').value = 0;
  if (boxes.length) {
    for (let j = 0; j < J; j++) {
      const py = packedY(j);
      for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
        const b = boxes[i][j][k];
        b.mesh.position.y = py; b.edges.position.y = py; b.spr.position.y = py;
      }
    }
  }
  applyS1(-1);
  mmUpdateCanvasTitle();
}

export function mmScrubCollapse(t) {
  stopColAnim();
  if (mmPhase === 'build') {
    ensureAllGreen();
    t1 = totalSteps1() - 1;
  }
  mmPhase = 'collapse';
  collapseT = t;
  if (t > 0 && plusPlanes.length === 0) addPlusPlanes();
  applyCollapse(collapseT);
  document.getElementById('spCollapse').disabled = false;
  document.getElementById('pbMM').textContent = '▶';
  if (collapseT >= 1) mmPhase = 'done';
  mmUpdateCanvasTitle();
}

export function resetMmBuildState() {
  t1 = -1; collapseT = 0; lastOpJ = -1;
  mmPhase = 'build';
  opStopHi();
}

// Restore the current matmul view without resetting state (for tab switching)
export function mmRestoreView() {
  mmPauseAll();
  if (mmPhase === 'build') {
    removePlusPlanes();
    applyS1(t1);
    renderA(-1, -1, -1); renderB(-1, -1, -1);
    if (t1 >= 0) {
      const {j, cellI, cellK} = decodeS1(t1);
      if (j >= 0 && j < J) { renderA(j, cellI, -1); renderB(j, -1, cellK); }
    }
    document.getElementById('spCollapse').disabled = true;
    document.getElementById('spCollapse').value = 0;
  } else if (mmPhase === 'collapse' || mmPhase === 'done') {
    removePlusPlanes();
    ensureAllGreen();
    addPlusPlanes();
    document.getElementById('spCollapse').disabled = false;
    document.getElementById('spCollapse').value = Math.round(collapseT * 1000);
    applyCollapse(collapseT);
    renderA(-1, -1, -1); renderB(-1, -1, -1);
  }
  mmUpdateCanvasTitle();
}

// ── Collapse animation ──
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
      if (j === 0 && t > 0) {
        const displayVal = Math.round(Cube[i][0][k] + (Res[i][k] - Cube[i][0][k]) * e);
        b.spr.material.map = makeTex(displayVal, '#ffffff'); b.spr.material.needsUpdate = true;
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
    if (t <= 0) fEl.innerHTML = `The <span class="fc">${J}</span> slices are each A[:,j]⊗B[j,:]. Drag the slider or press ▶ to merge them.`;
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

export function carryIntroToMatmul(introAVec, introBVec) {
  const newJ = introBVec.length;
  const newK = Math.max(1, newJ - 1); // non-square B for pedagogical clarity
  const newA = Array.from({length: I}, (_, i) => Array.from({length: newJ}, (_, j) => introAVec[i] * introBVec[j]));
  const newB = Array.from({length: newJ}, () => Array.from({length: newK}, () => rand()));
  const newCube = Array.from({length: I}, (_, i) => Array.from({length: newJ}, (_, j) => Array.from({length: newK}, (_, k) => newA[i][j] * newB[j][k])));
  const newRes = Array.from({length: I}, (_, i) => Array.from({length: newK}, (_, k) => newA[i].reduce((s, _, j) => s + newA[i][j] * newB[j][k], 0)));
  setData({J: newJ, K: newK, A: newA, B: newB, Cube: newCube, Res: newRes});
}

export function mmUpdateCanvasTitle() {
  const el = document.getElementById('canvasTitle');
  if (!el) return;
  if (mmPhase === 'build') el.textContent = 'Cube[i, j, k] = A[i,j] × B[j,k]';
  else el.textContent = 'Summing out j — slices collapse to result';
}

// ── 2D Side Grids ──
export function renderA(j, curI, curK) {
  const el = document.getElementById('gridA');
  if (!el || !A.length) return;
  const titleEl = document.getElementById('mmTitleA');
  if (titleEl) titleEl.textContent = labelA;
  el.style.gridTemplateColumns = `repeat(${J},44px)`; el.innerHTML = '';
  for (let i = 0; i < I; i++) for (let jj = 0; jj < J; jj++) {
    const d = document.createElement('div'); d.className = 'mat-cell neutral editable';
    if (j >= 0) { if (jj === j) { if (i === curI) d.classList.add('cur'); else d.classList.add('hi'); } else d.classList.add('dim'); }
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
    d.textContent = B[jj][k];
    ((cj, ck) => { d.onclick = function() { editCellInline(this, B[cj][ck], '#1a60b0', function(v) { B[cj][ck] = v; recomputeFromMatrices(); }); }; })(jj, k);
    el.appendChild(d);
  }
  const rb = document.getElementById('dimRowBtnsB'); if (rb) rb.innerHTML = dimBtnsV('J', true);
  const cb = document.getElementById('dimColBtnsB'); if (cb) cb.innerHTML = dimBtnsH('K');
}
