// ══════════════════════════════════════════════════
// SHARED STATE & UTILITIES
// ══════════════════════════════════════════════════

// Dimensions
export let I = 3, J = 3, K = 3;

// Data arrays
export let A = [], B = [], Cube = [], Res = [];

// Matrix labels (overridden by presets)
export let labelA = 'A', labelB = 'B';

// Current mode
export let currentMode = 'intro';
export function setCurrentMode(m) { currentMode = m; }

// ── Info shelf toggle ──
export let infoOpen = false;

// Callback set by app.js to populate shelf content for current tab
export let onShelfOpen = null;
export function setOnShelfOpen(fn) { onShelfOpen = fn; }

export function toggleInfo() {
  infoOpen = !infoOpen;
  applyInfoState();
}

export function applyInfoState() {
  const shelf = document.getElementById('infoShelf');
  const backdrop = document.getElementById('infoShelfBackdrop');
  const handle = document.getElementById('infoShelfHandle');
  if (shelf) shelf.classList.toggle('open', infoOpen);
  if (backdrop) backdrop.classList.toggle('open', infoOpen);
  if (handle) handle.classList.toggle('open', infoOpen);
  if (infoOpen && onShelfOpen) onShelfOpen();
}

// ── Callback registry (avoids circular imports) ──
const tabCallbacks = {};
export function registerCallbacks(cbs) { Object.assign(tabCallbacks, cbs); }

// Bulk setter for shared state (used by carryIntroToMatmul)
export function setData(d) {
  if ('I' in d) I = d.I;
  if ('J' in d) J = d.J;
  if ('K' in d) K = d.K;
  if ('A' in d) A = d.A;
  if ('B' in d) B = d.B;
  if ('Cube' in d) Cube = d.Cube;
  if ('Res' in d) Res = d.Res;
  if ('labelA' in d) labelA = d.labelA;
  if ('labelB' in d) labelB = d.labelB;
}

// ── Data utilities ──
export function rand() { return Math.floor(Math.random() * 9) + 1; }

export function resetLabels() { labelA = 'A'; labelB = 'B'; }

export function computeData(rnd) {
  A = Array.from({length: I}, () => Array.from({length: J}, () => rnd ? rand() : 1));
  B = Array.from({length: J}, () => Array.from({length: K}, () => rnd ? rand() : 1));
  Cube = Array.from({length: I}, (_, i) => Array.from({length: J}, (_, j) => Array.from({length: K}, (_, k) => A[i][j] * B[j][k])));
  Res = Array.from({length: I}, (_, i) => Array.from({length: K}, (_, k) => A[i].reduce((s, _, j) => s + A[i][j] * B[j][k], 0)));
}

// Resize dimensions preserving existing values, new cells get random values
export function changeDim(dim, delta) {
  const oldI = I, oldJ = J, oldK = K;
  if (dim === 'I') I = Math.max(1, Math.min(5, I + delta));
  else if (dim === 'J') J = Math.max(1, Math.min(5, J + delta));
  else if (dim === 'K') K = Math.max(1, Math.min(5, K + delta));
  if (I === oldI && J === oldJ && K === oldK) return;

  const newA = Array.from({length: I}, (_, i) => Array.from({length: J}, (_, j) => (i < oldI && j < oldJ) ? A[i][j] : rand()));
  const newB = Array.from({length: J}, (_, j) => Array.from({length: K}, (_, k) => (j < oldJ && k < oldK) ? B[j][k] : rand()));
  A = newA; B = newB;

  Cube = Array.from({length: I}, (_, i) => Array.from({length: J}, (_, j) => Array.from({length: K}, (_, k) => A[i][j] * B[j][k])));
  Res = Array.from({length: I}, (_, i) => Array.from({length: K}, (_, k) => A[i].reduce((s, _, j) => s + A[i][j] * B[j][k], 0)));

  if (tabCallbacks.onDimChange) tabCallbacks.onDimChange(oldI, oldJ, oldK);
}

// Recompute Cube and Res from current A/B, then notify current tab
export function recomputeFromMatrices() {
  Cube = Array.from({length: I}, (_, i) => Array.from({length: J}, (_, j) => Array.from({length: K}, (_, k) => A[i][j] * B[j][k])));
  Res = Array.from({length: I}, (_, i) => Array.from({length: K}, (_, k) => A[i].reduce((s, _, j) => s + A[i][j] * B[j][k], 0)));
  if (tabCallbacks.onRecompute) tabCallbacks.onRecompute();
}

// Shared inline cell editor: click a cell → replace with input → commit on blur/Enter, cancel on Escape
export function editCellInline(el, cur, color, onCommit) {
  if (el.querySelector('input')) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.value = cur;
  input.style.cssText = 'width:36px;height:36px;text-align:center;font-size:0.88rem;font-weight:600;border:2px solid '
    + color + ';border-radius:4px;outline:none;background:#fff;color:' + color + ';padding:0;';
  el.textContent = '';
  el.appendChild(input);
  input.focus();
  input.select();
  let committed = false;
  function commit() {
    if (committed) return;
    committed = true;
    let v = parseInt(input.value);
    if (isNaN(v)) v = 0;
    v = Math.max(-99, Math.min(99, v));
    onCommit(v);
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { committed = true; el.textContent = cur; }
  });
}

export function codeSpan(text) {
  return `<code style="background:#f5f5f5;padding:2px 5px;border-radius:3px;font-size:0.82em">${text}</code>`;
}

// Horizontal +/- (for columns — placed below grid)
export function dimBtnsH(dim, highlight) {
  const val = dim === 'I' ? I : dim === 'J' ? J : K;
  const cls = highlight ? 'dim-label dim-shared' : 'dim-label';
  return `<div class="dim-btns-h">`
    + `<button class="dim-btn" onclick="changeDim('${dim}',-1)"${val <= 1 ? ' disabled' : ''}>−</button>`
    + `<span class="${cls}">${dim.toLowerCase()}=${val}</span>`
    + `<button class="dim-btn" onclick="changeDim('${dim}',+1)"${val >= 5 ? ' disabled' : ''}>+</button>`
    + `</div>`;
}

// Vertical +/- (for rows — placed to the right of grid)
export function dimBtnsV(dim, highlight) {
  const val = dim === 'I' ? I : dim === 'J' ? J : K;
  const cls = highlight ? 'dim-label dim-shared' : 'dim-label';
  return `<div class="dim-btns-v">`
    + `<button class="dim-btn" onclick="changeDim('${dim}',-1)"${val <= 1 ? ' disabled' : ''}>−</button>`
    + `<span class="${cls}">${dim.toLowerCase()}=${val}</span>`
    + `<button class="dim-btn" onclick="changeDim('${dim}',+1)"${val >= 5 ? ' disabled' : ''}>+</button>`
    + `</div>`;
}
