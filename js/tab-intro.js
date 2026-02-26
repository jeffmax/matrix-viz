// ══════════════════════════════════════════════════
// TAB 0 — INTRO: OUTER PRODUCT a ⊗ b
// Step 0: show vectors a (column) and b (row)
// Step 1: a broadcasts rightward — columns appear one by one
// Step 2: b broadcasts downward — rows appear one by one + result
// ══════════════════════════════════════════════════
import { I, J, K, rand, editCellInline, dimBtnsH, dimBtnsV } from './shared.js';

export let introA = [], introB = [];
export let introStep = 0, introPlaying = false;
let introTm = null, introHiTm = null;
const INTRO_STEPS = 3;

export function initIntroVecs(rnd) {
  introA = Array.from({length: I}, () => rnd ? rand() : 1);
  introB = Array.from({length: K}, () => rnd ? rand() : 1);
}

export function resizeIntroVecs() {
  introA = Array.from({length: I}, (_, i) => i < introA.length ? introA[i] : rand());
  introB = Array.from({length: K}, (_, k) => k < introB.length ? introB[k] : rand());
}

export function resetIntroStep() { introStep = 0; }

// Speed slider: left=slow (1200ms/copy), right=fast (200ms/copy)
function introDelay() { return 1400 - parseInt(document.getElementById('spIntro').value || 600); }

export function renderIntro() {
  const wrap = document.getElementById('introDisplay');
  if (!wrap) return;
  if (introStep === 0) renderIntroStep0(wrap);
  else if (introStep === 1) renderIntroStep1(wrap);
  else renderIntroStep2(wrap);
  updateIntroDots();
  updateIntroFormula();
}

function shapeTag(text) { return `<div class="intro-shape">${text}</div>`; }

function vecTipA() {
  const vals = introA.map(v => String(v)).join(', ');
  return `<div class="vec-tip"><span class="fa">a</span> = torch.tensor([${vals}])</div>`;
}

function vecTipB() {
  const vals = introB.map(v => String(v)).join(', ');
  return `<div class="vec-tip"><span class="fb">b</span> = torch.tensor([${vals}])</div>`;
}

function renderIntroStep0(wrap) {
  let html = '<div class="intro-stage">';
  html += '<div class="intro-block">';
  html += '<div class="intro-block-label"><span style="color:#e06000;font-weight:700">a</span><span style="color:#aaa">[:, None]</span></div>';
  html += '<div class="grid-with-row-btns">';
  html += '<div class="intro-grid" style="grid-template-columns:44px">';
  for (let i = 0; i < I; i++) {
    html += `<div class="mat-cell a editable" onclick="introEditCell('a',${i})">${introA[i]}</div>`;
  }
  html += '</div>';
  html += dimBtnsV('I');
  html += '</div>';
  html += shapeTag(`shape (${I}, <strong>1</strong>) — the <strong>1</strong> stretches →`);
  html += vecTipA();
  html += '</div>';
  html += '<div class="intro-sym">⊗</div>';
  html += '<div class="intro-block">';
  html += '<div class="intro-block-label"><span style="color:#1a60b0;font-weight:700">b</span><span style="color:#aaa">[None, :]</span></div>';
  html += `<div class="intro-grid" style="grid-template-columns:repeat(${K},44px)">`;
  for (let k = 0; k < K; k++) {
    html += `<div class="mat-cell b editable" onclick="introEditCell('b',${k})">${introB[k]}</div>`;
  }
  html += '</div>';
  html += dimBtnsH('K');
  html += shapeTag(`shape (<strong>1</strong>, ${K}) — the <strong>1</strong> stretches ↓`);
  html += vecTipB();
  html += '</div>';
  html += '</div>';
  wrap.innerHTML = html;
}

function renderIntroStep1(wrap) {
  const delay = introDelay();
  const broadcastTime = Math.max((K - 2) * delay, (I - 2) * delay) + 400;
  let html = '<div class="intro-stage">';

  html += '<div class="intro-block">';
  html += '<div class="intro-block-label"><span style="color:#e06000;font-weight:700">a</span><span style="color:#aaa">[:, None]</span> broadcast →</div>';
  html += '<div style="display:flex;gap:3px">';
  html += '<div class="intro-orig-vec intro-orig-a">';
  html += '<div style="display:flex;flex-direction:column;gap:3px">';
  for (let i = 0; i < I; i++) html += `<div class="mat-cell a" data-ba-i="${i}" data-ba-k="0">${introA[i]}</div>`;
  html += '</div>';
  html += vecTipA();
  html += '</div>';
  if (K > 1) {
    html += `<div style="display:grid;grid-template-columns:repeat(${K - 1},44px);gap:3px">`;
    for (let i = 0; i < I; i++) for (let k = 1; k < K; k++) {
      html += `<div class="mat-cell a intro-anim-right" data-ba-i="${i}" data-ba-k="${k}" style="animation-delay:${(k - 1) * delay}ms">${introA[i]}</div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  html += shapeTag(`(${I}, <strong>1</strong>) → (${I}, ${K})`);
  html += '</div>';

  html += '<div class="intro-sym">⊙</div>';

  html += '<div class="intro-block">';
  html += '<div class="intro-block-label"><span style="color:#1a60b0;font-weight:700">b</span><span style="color:#aaa">[None, :]</span> broadcast ↓</div>';
  html += '<div style="display:flex;flex-direction:column;gap:3px">';
  html += '<div class="intro-orig-vec intro-orig-b">';
  html += '<div style="display:flex;gap:3px">';
  for (let k = 0; k < K; k++) html += `<div class="mat-cell b" data-bb-i="0" data-bb-k="${k}">${introB[k]}</div>`;
  html += '</div>';
  html += vecTipB();
  html += '</div>';
  if (I > 1) {
    html += `<div style="display:grid;grid-template-columns:repeat(${K},44px);gap:3px">`;
    for (let i = 1; i < I; i++) for (let k = 0; k < K; k++) {
      html += `<div class="mat-cell b intro-anim-down" data-bb-i="${i}" data-bb-k="${k}" style="animation-delay:${(i - 1) * delay}ms">${introB[k]}</div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  html += shapeTag(`(<strong>1</strong>, ${K}) → (${I}, ${K})`);
  html += '</div>';

  html += '<div class="intro-sym">=</div>';

  html += '<div class="intro-block">';
  html += '<div class="intro-block-label"><span style="color:#1a9a40;font-weight:700">a ⊗ b</span> <span style="color:#aaa">= a[:, None] * b[None, :]</span></div>';
  html += `<div class="intro-grid" style="grid-template-columns:repeat(${K},44px)">`;
  for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
    const val = introA[i] * introB[k];
    const cellDelay = broadcastTime + (i * K + k) * Math.max(delay * 0.3, 60);
    html += `<div class="mat-cell r anim" data-ri="${i}" data-rk="${k}" `
      + `onmouseenter="introHover(${i},${k})" onmouseleave="introClearHover()" `
      + `style="animation-delay:${cellDelay}ms;cursor:pointer">${val}</div>`;
  }
  html += '</div>';
  html += shapeTag(`(${I}, ${K})`);
  html += '</div>';
  html += '</div>';
  wrap.innerHTML = html;

  // Highlight input cells as each result cell appears
  introStopHiAnim();
  const hiCellDelay = Math.max(delay * 0.3, 60);
  const total = I * K;
  let idx = 0;
  function hiTick() {
    const ci = Math.floor(idx / K), ck = idx % K;
    introHover(ci, ck);
    idx++;
    if (idx < total) introHiTm = setTimeout(hiTick, hiCellDelay);
    else introHiTm = setTimeout(() => { introClearHover(); }, hiCellDelay);
  }
  introHiTm = setTimeout(hiTick, broadcastTime);
}

function renderIntroStep2(wrap) {
  const delay = introDelay();
  let html = '<div class="intro-stage">';

  html += '<div class="intro-block">';
  html += `<div class="intro-block-label">(${I}, ${K})</div>`;
  html += '<div style="display:flex;gap:3px">';
  html += '<div class="intro-orig-vec intro-orig-a">';
  html += '<div style="display:flex;flex-direction:column;gap:3px">';
  for (let i = 0; i < I; i++) html += `<div class="mat-cell a" data-ba-i="${i}" data-ba-k="0">${introA[i]}</div>`;
  html += '</div>';
  html += vecTipA();
  html += '</div>';
  if (K > 1) {
    html += `<div style="display:grid;grid-template-columns:repeat(${K - 1},44px);gap:3px">`;
    for (let i = 0; i < I; i++) for (let k = 1; k < K; k++) {
      html += `<div class="mat-cell a" data-ba-i="${i}" data-ba-k="${k}">${introA[i]}</div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';

  html += '<div class="intro-sym">⊙</div>';

  html += '<div class="intro-block">';
  html += `<div class="intro-block-label">(${I}, ${K})</div>`;
  html += '<div style="display:flex;flex-direction:column;gap:3px">';
  html += '<div class="intro-orig-vec intro-orig-b">';
  html += '<div style="display:flex;gap:3px">';
  for (let k = 0; k < K; k++) html += `<div class="mat-cell b" data-bb-i="0" data-bb-k="${k}">${introB[k]}</div>`;
  html += '</div>';
  html += vecTipB();
  html += '</div>';
  if (I > 1) {
    html += `<div style="display:grid;grid-template-columns:repeat(${K},44px);gap:3px">`;
    for (let i = 1; i < I; i++) for (let k = 0; k < K; k++) {
      html += `<div class="mat-cell b" data-bb-i="${i}" data-bb-k="${k}">${introB[k]}</div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';

  html += '<div class="intro-sym">=</div>';

  html += '<div class="intro-block">';
  html += '<div class="intro-block-label"><span style="color:#1a9a40;font-weight:700">a ⊗ b</span> <span style="color:#aaa">= a[:, None] * b[None, :]</span></div>';
  html += `<div class="intro-grid" style="grid-template-columns:repeat(${K},44px)">`;
  for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
    const val = introA[i] * introB[k];
    html += `<div class="mat-cell r" data-ri="${i}" data-rk="${k}" `
      + `onmouseenter="introHover(${i},${k})" onmouseleave="introClearHover()" `
      + `style="cursor:pointer">${val}</div>`;
  }
  html += '</div></div>';
  html += '</div>';
  wrap.innerHTML = html;
}

export function introHover(hi, hk) {
  document.querySelectorAll('[data-ba-i]').forEach(el => {
    el.classList.toggle('hi-cell', +el.dataset.baI === hi && +el.dataset.baK === hk);
  });
  document.querySelectorAll('[data-bb-i]').forEach(el => {
    el.classList.toggle('hi-cell', +el.dataset.bbI === hi && +el.dataset.bbK === hk);
  });
  document.querySelectorAll('[data-ri]').forEach(el => {
    el.classList.toggle('hi-res', +el.dataset.ri === hi && +el.dataset.rk === hk);
  });
  const f = document.getElementById('fIntro');
  f.innerHTML = `Cell [${hi}, ${hk}]: `
    + `<span class="fa">a[${hi}]</span> = <span class="fa">${introA[hi]}</span> &nbsp;× &nbsp;`
    + `<span class="fb">b[${hk}]</span> = <span class="fb">${introB[hk]}</span> &nbsp;= &nbsp;`
    + `<span class="fc">${introA[hi] * introB[hk]}</span>`;
}

export function introClearHover() {
  document.querySelectorAll('.hi-cell').forEach(el => el.classList.remove('hi-cell'));
  document.querySelectorAll('.hi-res').forEach(el => el.classList.remove('hi-res'));
  updateIntroFormula();
}

function introStopHiAnim() { if (introHiTm) { clearTimeout(introHiTm); introHiTm = null; } }

function introRunHiAnim() {
  introStopHiAnim();
  const cellDelay = Math.max(introDelay() * 0.3, 60);
  const total = I * K;
  let idx = 0;
  function tick() {
    const i = Math.floor(idx / K), k = idx % K;
    introHover(i, k);
    idx++;
    if (idx < total) introHiTm = setTimeout(tick, cellDelay);
    else introHiTm = setTimeout(() => { introClearHover(); }, cellDelay);
  }
  tick();
}

export function introEditCell(vec, idx) {
  const cur = vec === 'a' ? introA[idx] : introB[idx];
  const el = event.target.closest('.mat-cell') || event.target;
  editCellInline(el, cur, vec === 'a' ? '#e06000' : '#1a60b0', function(v) {
    if (vec === 'a') introA[idx] = v; else introB[idx] = v;
    renderIntro();
  });
}

function updateIntroFormula() {
  const f = document.getElementById('fIntro');
  if (introStep === 0) {
    f.innerHTML = `<span class="fa">a</span> is (${I},1) and <span class="fb">b</span> is (1,${K}). Press ▶ to broadcast and multiply.`;
  } else if (introStep === 1) {
    f.innerHTML = `Broadcasting <span class="fa">a</span> across columns and <span class="fb">b</span> across rows, then multiplying element-wise, computes the outer product <span class="fc">a ⊗ b</span>.`;
  } else {
    f.innerHTML = `Each cell [i,k] = <span class="fa">a[i]</span> × <span class="fb">b[k]</span>. Hover to inspect. `
      + `<em style="color:#999">This outer product is one slice of a matrix multiply. In tab ①, we sum <span class="fc">${J}</span> such slices — one per shared dimension j — to get A @ B.</em>`;
  }
}

function updateIntroDots() {
  const el = document.getElementById('dIntro'); el.innerHTML = '';
  for (let d = 0; d < INTRO_STEPS; d++) {
    const dot = document.createElement('div'); dot.className = 'step-dot';
    if (introStep > d) dot.classList.add('done');
    else if (introStep === d) dot.classList.add('cur');
    el.appendChild(dot);
  }
}

/* @testable */
export function introAnimDuration() {
  const delay = introDelay();
  if (introStep === 1) {
    const broadcastTime = Math.max((K - 2) * delay, (I - 2) * delay) + 400;
    const resultTime = (I * K - 1) * Math.max(delay * 0.3, 60);
    return broadcastTime + resultTime + 500;
  }
  if (introStep === 2) {
    return 800; // No animation in step 2 — cells appear instantly
  }
  return 600;
}

export function stepFwdIntro() {
  pauseIntro();
  if (introStep < INTRO_STEPS - 1) { introStep++; renderIntro(); }
}

export function stepBackIntro() {
  pauseIntro();
  if (introStep > 0) { introStep--; renderIntro(); }
}

export function togglePlayIntro() {
  if (introPlaying) pauseIntro();
  else playIntro();
}

function playIntro() {
  if (introStep >= INTRO_STEPS - 1) introStep = 0;
  introPlaying = true;
  document.getElementById('pbIntro').textContent = '⏸';
  tickIntro();
}

export function pauseIntro() {
  introPlaying = false;
  clearTimeout(introTm);
  introStopHiAnim();
  document.getElementById('pbIntro').textContent = '▶';
}

function tickIntro() {
  if (!introPlaying) return;
  if (introStep < INTRO_STEPS - 1) {
    introStep++;
    renderIntro();
    introTm = setTimeout(tickIntro, introAnimDuration() + 300);
  } else {
    pauseIntro();
  }
}

export function resetIntro() {
  pauseIntro();
  introStep = 0;
  renderIntro();
}
