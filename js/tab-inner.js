// ══════════════════════════════════════════════════
// TAB — INNER PRODUCT: a · b = Σᵢ a[i] × b[i]
// 2D only, no Three.js. Step-through animation.
// ══════════════════════════════════════════════════
import { rand, editCellInline } from './shared.js';

// ── State ──
export let ipA = [], ipB = [];
let ipN = 3;
let ipStep = -1;          // -1 = ready, 0..N-1 = highlighting term j
let ipPlaying = false;
let ipTm = null;

export function ipInit(rnd) {
  ipA = Array.from({length: ipN}, () => rnd ? rand() : 1);
  ipB = Array.from({length: ipN}, () => rnd ? rand() : 1);
}

export function ipResize(delta) {
  const oldN = ipN;
  ipN = Math.max(1, Math.min(8, ipN + delta));
  if (ipN === oldN) return;
  ipA = Array.from({length: ipN}, (_, i) => i < oldN ? ipA[i] : rand());
  ipB = Array.from({length: ipN}, (_, i) => i < oldN ? ipB[i] : rand());
  ipPause();
  ipStep = -1;
  ipRender();
}

// ── Rendering ──
export function ipRender() {
  const wrap = document.getElementById('innerDisplay');
  if (!wrap) return;

  const products = ipA.map((v, i) => v * ipB[i]);
  const total = products.reduce((s, v) => s + v, 0);

  let html = '<div class="intro-stage" style="flex-direction:column;gap:16px">';

  // Vectors + products row
  html += '<div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;justify-content:center">';

  // Vector a
  html += '<div class="intro-block">';
  html += '<div class="intro-block-label"><span style="color:#e06000;font-weight:700">a</span></div>';
  html += `<div class="intro-grid" style="grid-template-columns:repeat(${ipN},44px)">`;
  for (let i = 0; i < ipN; i++) {
    let cls = 'mat-cell a editable';
    if (ipStep >= 0 && i === ipStep) cls += ' cur';
    else if (ipStep >= 0 && i < ipStep) cls += ' hi';
    html += `<div class="${cls}" onclick="ipEditCell('a',${i})">${ipA[i]}</div>`;
  }
  html += '</div>';
  html += ipDimBtns();
  html += '</div>';

  // Dot symbol
  html += '<div class="intro-sym" style="padding-top:18px">·</div>';

  // Vector b
  html += '<div class="intro-block">';
  html += '<div class="intro-block-label"><span style="color:#1a60b0;font-weight:700">b</span></div>';
  html += `<div class="intro-grid" style="grid-template-columns:repeat(${ipN},44px)">`;
  for (let i = 0; i < ipN; i++) {
    let cls = 'mat-cell b editable';
    if (ipStep >= 0 && i === ipStep) cls += ' cur';
    else if (ipStep >= 0 && i < ipStep) cls += ' hi';
    html += `<div class="${cls}" onclick="ipEditCell('b',${i})">${ipB[i]}</div>`;
  }
  html += '</div>';
  html += ipDimBtns();
  html += '</div>';

  // Equals
  html += '<div class="intro-sym" style="padding-top:18px">=</div>';

  // Result scalar
  html += '<div class="intro-block">';
  html += '<div class="intro-block-label"><span style="color:#1a9a40;font-weight:700">a · b</span></div>';
  const showTotal = ipStep < 0 ? total : products.slice(0, ipStep + 1).reduce((s, v) => s + v, 0);
  const resultCls = ipStep < 0 || ipStep >= ipN - 1 ? 'mat-cell r done' : 'mat-cell r cur';
  html += `<div class="${resultCls}" style="width:56px;font-size:1rem">${ipStep < 0 ? total : showTotal}</div>`;
  html += '</div>';

  html += '</div>';

  // Element-wise products row
  html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px">';
  for (let i = 0; i < ipN; i++) {
    let termCls = '';
    if (ipStep >= 0) {
      if (i === ipStep) termCls = ' style="background:#50c878;color:#fff;border-radius:4px;padding:2px 6px;font-weight:700"';
      else if (i > ipStep) termCls = ' style="opacity:0.3"';
    }
    const prod = products[i];
    html += `<span${termCls}>`;
    html += `<span class="fa">${ipA[i]}</span>`;
    html += `<span style="color:#bbb">×</span>`;
    html += `<span class="fb">${ipB[i]}</span>`;
    html += `<span style="color:#bbb">=</span>`;
    html += `<span class="fc">${prod}</span>`;
    html += `</span>`;
    if (i < ipN - 1) html += '<span style="color:#ccc;margin:0 2px">+</span>';
  }
  if (ipStep >= 0 && ipStep < ipN - 1) {
    html += `<span style="color:#999;margin-left:6px">= <span class="fc" style="font-weight:700">${showTotal}</span> so far</span>`;
  } else {
    html += `<span style="color:#999;margin-left:6px">= <span class="fc" style="font-weight:700">${total}</span></span>`;
  }
  html += '</div>';

  html += '</div>';
  wrap.innerHTML = html;

  ipRenderDots();
  ipRenderFormula();
}

function ipDimBtns() {
  return `<div class="dim-btns-h" style="margin-top:4px">`
    + `<button class="dim-btn" onclick="ipResize(-1)"${ipN <= 1 ? ' disabled' : ''}>−</button>`
    + `<span class="dim-label">n=${ipN}</span>`
    + `<button class="dim-btn" onclick="ipResize(+1)"${ipN >= 8 ? ' disabled' : ''}>+</button>`
    + `</div>`;
}

function ipRenderDots() {
  const el = document.getElementById('dInner');
  if (!el) return;
  el.innerHTML = '';
  for (let d = 0; d < ipN; d++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    if (ipStep > d) dot.classList.add('done');
    else if (ipStep === d) dot.classList.add('cur');
    el.appendChild(dot);
  }
}

function ipRenderFormula() {
  const f = document.getElementById('fInner');
  if (!f) return;
  if (ipStep < 0) {
    f.innerHTML = `<span class="fa">a</span> · <span class="fb">b</span> = Σᵢ <span class="fa">a[i]</span> × <span class="fb">b[i]</span>. Press ▶ to step through each term.`;
  } else if (ipStep >= ipN - 1) {
    const total = ipA.reduce((s, v, i) => s + v * ipB[i], 0);
    f.innerHTML = `All ${ipN} terms summed → <span class="fc" style="font-weight:700">${total}</span>. This scalar is one cell of a matrix multiply.`;
  } else {
    const prod = ipA[ipStep] * ipB[ipStep];
    f.innerHTML = `Term i=${ipStep}: <span class="fa">${ipA[ipStep]}</span> × <span class="fb">${ipB[ipStep]}</span> = <span class="fc">${prod}</span>`;
  }
}

// ── Playback ──
function ipDelay() { return 1400 - parseInt(document.getElementById('spInner').value || 600); }

export function ipPause() {
  ipPlaying = false;
  clearTimeout(ipTm);
  const btn = document.getElementById('pbInner');
  if (btn) btn.textContent = '▶';
}

export function ipToggle() {
  if (ipPlaying) ipPause();
  else ipPlay();
}

function ipPlay() {
  if (ipStep >= ipN - 1) ipStep = -1;
  ipPlaying = true;
  const btn = document.getElementById('pbInner');
  if (btn) btn.textContent = '⏸';
  ipTick();
}

function ipTick() {
  if (!ipPlaying) return;
  if (ipStep < ipN - 1) {
    ipStep++;
    ipRender();
    ipTm = setTimeout(ipTick, ipDelay());
  } else {
    ipPause();
  }
}

export function ipFwd() {
  ipPause();
  if (ipStep < ipN - 1) { ipStep++; ipRender(); }
}

export function ipBack() {
  ipPause();
  if (ipStep > -1) { ipStep--; ipRender(); }
}

export function ipReset() {
  ipPause();
  ipStep = -1;
  ipRender();
}

export function ipEditCell(vec, idx) {
  const cur = vec === 'a' ? ipA[idx] : ipB[idx];
  const el = event.target.closest('.mat-cell') || event.target;
  editCellInline(el, cur, vec === 'a' ? '#e06000' : '#1a60b0', function(v) {
    if (vec === 'a') ipA[idx] = v; else ipB[idx] = v;
    ipRender();
  });
}

/* @testable */
export function getIpState() { return { ipStep, ipN, ipA: [...ipA], ipB: [...ipB] }; }
