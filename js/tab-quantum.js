// ══════════════════════════════════════════════════
// TAB — DIRAC NOTATION: notation → deterministic → stochastic → quantum
// 2D only, no Three.js. Click-driven (no playback animation).
//
// Four sub-tabs (qSubTab):
//   basics  — |0⟩, |1⟩, ⟨0|, ⟨1|, ⟨a|b⟩ indicator, |a⟩⟨b| matrix
//   det     — pick f: {0,1}→{0,1}; build M = Σ_b |f(b)⟩⟨b|; apply M|a⟩
//   stoch   — stochastic matrices: columns are probability distributions,
//             closed under composition because sums-to-1 is preserved.
//   quantum — I, X, Z gates on |ψ⟩ = α|0⟩ + β|1⟩. Unitary constraint U†U = I:
//             each column's squared entries sum to 1.
// ══════════════════════════════════════════════════

// ── 2×2 gate matrices ──
const GATES = {
  I: {
    label: 'I',
    full: 'Identity',
    matrix: [[1, 0], [0, 1]],
    blurb: 'Leaves every state unchanged.',
    dirac: '|0⟩⟨0| + |1⟩⟨1|',
  },
  X: {
    label: 'X',
    full: 'NOT (Pauli-X)',
    matrix: [[0, 1], [1, 0]],
    blurb: 'Bit flip: swaps |0⟩ and |1⟩. This IS the classical NOT gate.',
    dirac: '|1⟩⟨0| + |0⟩⟨1|',
  },
  Z: {
    label: 'Z',
    full: 'Phase flip (Pauli-Z)',
    matrix: [[1, 0], [0, -1]],
    blurb: 'Flips the sign of |1⟩. Produces negative amplitudes — no classical analogue.',
    dirac: '|0⟩⟨0| − |1⟩⟨1|',
  },
};

// ── Classical 1-bit functions ──
const CLASSICAL_FNS = {
  id:     { label: 'identity', f: [0, 1], name: 'id',  gate: 'I' },
  not:    { label: 'NOT',      f: [1, 0], name: 'not', gate: 'X' },
  const0: { label: 'const-0',  f: [0, 0], name: 'c₀',  gate: null },
  const1: { label: 'const-1',  f: [1, 1], name: 'c₁',  gate: null },
};

// ── Stochastic 2×2 matrices (columns sum to 1, entries ≥ 0) ──
// Chosen fractions display cleanly as ½, ¼, ¾.
const STOCH_MATRICES = {
  'det-id':    { label: 'identity',         matrix: [[1, 0], [0, 1]] },
  'det-not':   { label: 'NOT (sharp)',      matrix: [[0, 1], [1, 0]] },
  'noisy-id':  { label: 'noisy identity',   matrix: [[0.75, 0.25], [0.25, 0.75]] },
  'fair-flip': { label: 'fair coin',        matrix: [[0.5, 0.5], [0.5, 0.5]] },
};

// ── State ──
let qSubTab = 'basics';

// Quantum section
let state = [1, 0];
let prevState = null;
let lastGate = null;
let history = []; // [{ gate, before: [α,β], after: [α',β'] }]

// Classical section
let cFn = 'id';
let cInput = 0;
let cLastApplied = false;
let cLastResult = [1, 0];

// Stochastic section
let sMat = 'noisy-id';
let sInput = [1, 0];       // input distribution [p, 1-p]
let sLastApplied = false;
let sLastResult = [1, 0];

export function qInit() {
  state = [1, 0];
  prevState = null;
  lastGate = null;
  history = [];
  cFn = 'id';
  cInput = 0;
  cLastApplied = false;
  cLastResult = [1, 0];
  sMat = 'noisy-id';
  sInput = [1, 0];
  sLastApplied = false;
  sLastResult = [1, 0];
  // qSubTab is intentionally preserved across inits so tab switches don't lose user's view
}

export function qReset() {
  qInit();
  qRender();
}

// Quantum: apply a gate to the current state
export function qApply(name) {
  const g = GATES[name];
  if (!g) return;
  const [[a, b], [c, d]] = g.matrix;
  prevState = [...state];
  state = [
    a * state[0] + b * state[1],
    c * state[0] + d * state[1],
  ];
  lastGate = name;
  history.push({ gate: name, before: prevState, after: [...state] });
  qRender();
}

// Classical: pick function / apply M|a⟩
export function qSelectFn(id) {
  if (!CLASSICAL_FNS[id]) return;
  cFn = id;
  cLastApplied = false;
  qRender();
}

export function qApplyClassical(a) {
  const fn = CLASSICAL_FNS[cFn];
  if (!fn || (a !== 0 && a !== 1)) return;
  cInput = a;
  cLastResult = a === 0 ? ket(fn.f[0]) : ket(fn.f[1]);
  cLastApplied = true;
  qRender();
}

// Stochastic: pick matrix / apply to distribution
export function qSelectStoch(id) {
  if (!STOCH_MATRICES[id]) return;
  sMat = id;
  sLastApplied = false;
  qRender();
}

export function qApplyStoch(p0, p1) {
  const m = STOCH_MATRICES[sMat];
  if (!m) return;
  sInput = [p0, p1];
  const [[a, b], [c, d]] = m.matrix;
  sLastResult = [
    a * p0 + b * p1,
    c * p0 + d * p1,
  ];
  sLastApplied = true;
  qRender();
}

// Sub-tab switching
export function qSetSubTab(name) {
  if (!['basics', 'det', 'stoch', 'quantum'].includes(name)) return;
  qSubTab = name;
  const ids = {
    basics:  'tab-dirac-basics',
    det:     'tab-dirac-det',
    stoch:   'tab-dirac-stoch',
    quantum: 'tab-dirac-quantum',
  };
  for (const k of Object.keys(ids)) {
    const el = document.getElementById(ids[k]);
    if (el) el.classList.toggle('active', k === name);
  }
  qRender();
}

export function qPause() { /* no playback */ }

// ── Helpers ──

function ket(bit) { return bit === 0 ? [1, 0] : [0, 1]; }

function cellHtml(v, cls) {
  const signCls = v < 0 ? ' neg' : '';
  return `<div class="mat-cell ${cls}${signCls}">${fmt(v)}</div>`;
}

// Format numbers: integers as-is; common fractions as unicode; else decimal.
function fmt(v) {
  if (v === 0) return '0';
  if (v === 1) return '1';
  if (v === -1) return '−1';
  if (Number.isInteger(v)) return String(v);
  if (Math.abs(v - 0.5) < 1e-9) return '½';
  if (Math.abs(v - 0.25) < 1e-9) return '¼';
  if (Math.abs(v - 0.75) < 1e-9) return '¾';
  // Fallback: 1 decimal
  return v.toFixed(2).replace(/\.?0+$/, '');
}

function ketLabel(s) {
  const [a, b] = s;
  if (a === 0 && b === 0) return '0';
  const parts = [];
  if (a !== 0) {
    if (a === 1) parts.push({ sign: '+', body: '|0⟩' });
    else if (a === -1) parts.push({ sign: '−', body: '|0⟩' });
    else parts.push({ sign: a > 0 ? '+' : '−', body: `${Math.abs(a)}|0⟩` });
  }
  if (b !== 0) {
    if (b === 1) parts.push({ sign: '+', body: '|1⟩' });
    else if (b === -1) parts.push({ sign: '−', body: '|1⟩' });
    else parts.push({ sign: b > 0 ? '+' : '−', body: `${Math.abs(b)}|1⟩` });
  }
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === 0) out += (p.sign === '−' ? '−' : '') + p.body;
    else out += ` ${p.sign} ` + p.body;
  }
  return out;
}

function ketHtml(s, cls) {
  return `<div class="q-ket-wrap">`
    + `<span class="q-bracket">[</span>`
    + `<div class="q-ket">${cellHtml(s[0], cls)}${cellHtml(s[1], cls)}</div>`
    + `<span class="q-bracket">]</span>`
    + `</div>`;
}

function braHtml(s, cls) {
  return `<div class="q-ket-wrap">`
    + `<span class="q-bracket">[</span>`
    + `<div class="q-bra">${cellHtml(s[0], cls)}${cellHtml(s[1], cls)}</div>`
    + `<span class="q-bracket">]</span>`
    + `</div>`;
}

function outerHtml(aBit, bBit, cls = 'u') {
  const a = ket(aBit), b = ket(bBit);
  const M = [
    [a[0] * b[0], a[0] * b[1]],
    [a[1] * b[0], a[1] * b[1]],
  ];
  return `<div class="q-ket-wrap">`
    + `<span class="q-bracket">[</span>`
    + `<div class="q-outer">${cellHtml(M[0][0], cls)}${cellHtml(M[0][1], cls)}${cellHtml(M[1][0], cls)}${cellHtml(M[1][1], cls)}</div>`
    + `<span class="q-bracket">]</span>`
    + `</div>`;
}

function gateMatHtml(name) {
  return matHtml(GATES[name].matrix, 'u');
}

function matHtml(m, cls = 'u') {
  const [[a, b], [c, d]] = m;
  return `<div class="q-ket-wrap">`
    + `<span class="q-bracket">[</span>`
    + `<div class="q-gate-mat">${cellHtml(a, cls)}${cellHtml(b, cls)}${cellHtml(c, cls)}${cellHtml(d, cls)}</div>`
    + `<span class="q-bracket">]</span>`
    + `</div>`;
}

// Σ-notation matrix M = Σ_b |f(b)⟩⟨b| as a concrete 2×2
function fnMatrix(fn) {
  const m = [[0, 0], [0, 0]];
  for (let b = 0; b < 2; b++) {
    m[fn.f[b]][b] += 1;
  }
  return m;
}

function fnMatHtml(fn) {
  return matHtml(fnMatrix(fn), 'u');
}

// 2×2 matrix product
function matMul(A, B) {
  const r = [[0, 0], [0, 0]];
  for (let i = 0; i < 2; i++)
    for (let k = 0; k < 2; k++)
      for (let j = 0; j < 2; j++)
        r[i][k] += A[i][j] * B[j][k];
  return r;
}

function colSumHtml(m, col) {
  const a = m[0][col], b = m[1][col];
  const sum = a + b;
  const ok = Math.abs(sum - 1) < 1e-9;
  return `<span class="q-check">col ${col}: ${fmt(a)} + ${fmt(b)} = ${fmt(sum)} ${ok ? '<span class="q-ok">✓</span>' : '<span class="q-bad">✗</span>'}</span>`;
}

function colSqSumHtml(m, col) {
  const a = m[0][col], b = m[1][col];
  const aa = a * a, bb = b * b;
  const sum = aa + bb;
  const ok = Math.abs(sum - 1) < 1e-9;
  const sq = (v) => (v < 0 ? `(${fmt(v)})²` : `${fmt(v)}²`);
  return `<span class="q-check">col ${col}: ${sq(a)} + ${sq(b)} = ${fmt(aa)} + ${fmt(bb)} = ${fmt(sum)} ${ok ? '<span class="q-ok">✓</span>' : '<span class="q-bad">✗</span>'}</span>`;
}

// ── Sub-tab nav ──

function subTabNavHtml() {
  const tabs = [
    { id: 'basics',  label: '1 · Basics' },
    { id: 'det',     label: '2 · Deterministic' },
    { id: 'stoch',   label: '3 · Stochastic' },
    { id: 'quantum', label: '4 · Quantum' },
  ];
  // Rendered inside qDisplay as a secondary progress indicator — the real
  // sub-tab buttons live in the tier-2 bar. This is optional.
  return '';
}

// ── Sub-tab renderers ──

function renderBasicsSection() {
  let html = '';
  html += `<div class="q-section-header">Basics: kets, bras, inner &amp; outer products</div>`;
  html += `<div class="q-section-lede">A <b>ket</b> <code>|x⟩</code> is a column vector; a <b>bra</b> <code>⟨x|</code> is its row-vector transpose. `
        + `The two basis states <code>|0⟩</code> and <code>|1⟩</code> encode a classical bit. Everything else in this tier is built from these pieces.</div>`;

  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Kets — column vectors</div>`;
  html += `<div class="q-row" style="gap:24px">`;
  html += `<div class="q-kv"><span class="q-label">|0⟩</span><span class="q-sym">=</span>${ketHtml([1, 0], 'u')}</div>`;
  html += `<div class="q-kv"><span class="q-label">|1⟩</span><span class="q-sym">=</span>${ketHtml([0, 1], 'u')}</div>`;
  html += `</div>`;

  html += `<div class="q-panel-title" style="margin-top:14px">Bras — row vectors (transposes of kets)</div>`;
  html += `<div class="q-row" style="gap:24px">`;
  html += `<div class="q-kv"><span class="q-label">⟨0|</span><span class="q-sym">=</span>${braHtml([1, 0], 'u')}</div>`;
  html += `<div class="q-kv"><span class="q-label">⟨1|</span><span class="q-sym">=</span>${braHtml([0, 1], 'u')}</div>`;
  html += `</div>`;

  html += `<div class="q-panel-title" style="margin-top:14px">Inner product ⟨a|b⟩ — bra · ket = scalar</div>`;
  html += `<div class="q-row" style="gap:4px">`;
  html += `<span class="q-label">⟨a|b⟩</span><span class="q-sym">=</span>`;
  html += `${braHtml([1, 0], 'u')}<span class="q-sym">·</span>${ketHtml([0, 1], 'u')}`;
  html += `<span class="q-sym">=</span><span class="q-ind">1·0 + 0·1 = 0</span>`;
  html += `</div>`;
  html += `<div class="q-gate-info">Acts as an <b>indicator</b>: <code>⟨a|b⟩ = 1</code> when a=b, else 0. This is exactly the dot product — the "Inner Product" tab with vectors of length 2.</div>`;
  html += `<div class="q-row" style="gap:14px;margin-top:6px;font-family:'SF Mono',Menlo,monospace;font-size:0.86rem">`;
  html += `<span>⟨0|0⟩ = <span class="q-ind">1</span></span>`;
  html += `<span>⟨0|1⟩ = <span class="q-ind">0</span></span>`;
  html += `<span>⟨1|0⟩ = <span class="q-ind">0</span></span>`;
  html += `<span>⟨1|1⟩ = <span class="q-ind">1</span></span>`;
  html += `</div>`;

  html += `<div class="q-panel-title" style="margin-top:14px">Outer product |a⟩⟨b| — ket · bra = matrix</div>`;
  html += `<div class="q-row" style="gap:4px">`;
  html += `<span class="q-label">|1⟩⟨0|</span><span class="q-sym">=</span>`;
  html += `${ketHtml([0, 1], 'u')}<span class="q-sym">·</span>${braHtml([1, 0], 'u')}`;
  html += `<span class="q-sym">=</span>${outerHtml(1, 0)}`;
  html += `</div>`;
  html += `<div class="q-gate-info">A 2×2 matrix with a single <code>1</code> at row a, column b. Multiplying this matrix by <code>|b⟩</code> yields <code>|a⟩</code>; by any other basis ket yields 0. These are the building blocks of every 1-bit operation.</div>`;
  html += `</div>`;

  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Where this goes next</div>`;
  html += `<div class="q-ref-grid">`;
  html += `<div><b>Deterministic</b> — every function <code>f : {0,1} → {0,1}</code> is <code>M = Σ<sub>b</sub> |f(b)⟩⟨b|</code>. Columns of M are basis kets.</div>`;
  html += `<div><b>Stochastic</b> — columns of M are probability distributions (entries ≥ 0, each column sums to 1). Deterministic is the special case where each column is a basis ket.</div>`;
  html += `<div><b>Quantum</b> — columns of U are unit vectors under <i>squared</i>-sum, and orthogonal to each other (<code>U†U = I</code>). Allows negative entries, since squaring kills the sign.</div>`;
  html += `<div class="q-ref-note">Each layer relaxes one rule: "basis ket per column" → "distribution per column" → "orthonormal column under squared norm". Pick a tab above to explore.</div>`;
  html += `</div>`;
  html += `</div>`;

  return html;
}

function renderDeterministicSection() {
  const fn = CLASSICAL_FNS[cFn];
  let html = '';

  html += `<div class="q-section-header">Deterministic operations on classical bits</div>`;
  html += `<div class="q-section-lede">Every function <code>f : Σ → Σ</code> becomes a matrix <code>M = Σ<sub>b</sub> |f(b)⟩⟨b|</code>. `
        + `Applying it gives <code>M|a⟩ = Σ<sub>b</sub> |f(b)⟩⟨b|a⟩ = |f(a)⟩</code> — the indicator <code>⟨b|a⟩</code> picks the term where b = a.</div>`;

  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Choose a 1-bit function f : {0,1} → {0,1}</div>`;
  html += `<div class="q-fn-picker">`;
  for (const id of Object.keys(CLASSICAL_FNS)) {
    const f = CLASSICAL_FNS[id];
    const active = id === cFn ? ' active' : '';
    html += `<button class="q-fn-btn${active}" onclick="qSelectFn('${id}')">${f.label}</button>`;
  }
  html += `</div>`;

  html += `<div class="q-row" style="gap:30px;margin-top:10px">`;
  html += `<div class="q-fn-table">`;
  html += `<div class="q-fn-head">b</div><div class="q-fn-head">f(b)</div>`;
  for (let b = 0; b < 2; b++) {
    html += `<div>${b}</div><div>${fn.f[b]}</div>`;
  }
  html += `</div>`;

  html += `<div class="q-kv">`;
  html += `<span class="q-label">M</span><span class="q-sym">=</span>`;
  html += `<span style="font-family:'SF Mono',Menlo,monospace;font-size:0.94rem">`;
  html += `|${fn.f[0]}⟩⟨0| + |${fn.f[1]}⟩⟨1|`;
  html += `</span>`;
  html += `</div>`;

  html += `<div class="q-kv">`;
  html += `<span class="q-sym">=</span>`;
  html += outerHtml(fn.f[0], 0);
  html += `<span class="q-sym">+</span>`;
  html += outerHtml(fn.f[1], 1);
  html += `<span class="q-sym">=</span>`;
  html += fnMatHtml(fn);
  html += `</div>`;
  html += `</div>`;

  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Apply: M|a⟩ = |f(a)⟩</div>`;
  html += `<div class="q-row" style="gap:10px">`;
  html += `<span style="font-size:0.78rem;color:#777;text-transform:uppercase;letter-spacing:.05em">Input a:</span>`;
  html += `<button class="q-apply-btn${cLastApplied && cInput === 0 ? ' active' : ''}" onclick="qApplyClassical(0)">|0⟩</button>`;
  html += `<button class="q-apply-btn${cLastApplied && cInput === 1 ? ' active' : ''}" onclick="qApplyClassical(1)">|1⟩</button>`;
  html += `</div>`;

  if (cLastApplied) {
    const aKet = ket(cInput);
    html += `<div class="q-row" style="gap:4px;margin-top:10px">`;
    html += `<span class="q-label">M|${cInput}⟩</span><span class="q-sym">=</span>`;
    html += fnMatHtml(fn);
    html += `<span class="q-sym">·</span>`;
    html += ketHtml(aKet, 'b');
    html += `</div>`;

    html += `<div class="q-sum-row" style="margin-top:8px">`;
    html += `<span class="q-sym">=</span>`;
    for (let b = 0; b < 2; b++) {
      const bra_a = (b === cInput) ? 1 : 0;
      const match = bra_a === 1;
      html += `<span class="q-sum-term${match ? ' match' : ' zero'}">`;
      html += `<span style="font-family:'SF Mono',Menlo,monospace">|${fn.f[b]}⟩</span>`;
      html += `<span style="color:#888">·</span>`;
      html += `<span style="font-family:'SF Mono',Menlo,monospace">⟨${b}|${cInput}⟩</span>`;
      html += `<span style="color:#888">=</span>`;
      html += `<span class="q-ind">${bra_a}</span>`;
      html += `·<span style="font-family:'SF Mono',Menlo,monospace">|${fn.f[b]}⟩</span>`;
      html += `</span>`;
      if (b === 0) html += `<span class="q-sym">+</span>`;
    }
    html += `<span class="q-sym">=</span>`;
    html += `<span style="font-family:'SF Mono',Menlo,monospace;color:#1a9a40;font-weight:700">|${fn.f[cInput]}⟩</span>`;
    html += `<span class="q-sym">=</span>`;
    html += ketHtml(cLastResult, 'r');
    html += `</div>`;
    html += `<div class="q-gate-info">Only the term with <code>⟨b|a⟩ = 1</code> (i.e. b = ${cInput}) survives. The others are zeroed out by orthogonality — that's how <code>Σ<sub>b</sub> |f(b)⟩⟨b|</code> acts as "the matrix version of f".</div>`;
  }
  html += `</div>`;

  // Closed under composition
  const fnId = fnMatrix(fn);
  const prod = matMul(fnId, fnId);
  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Closed under composition</div>`;
  html += `<div class="q-gate-info" style="margin-top:0">Function composition <code>g∘f</code> corresponds to matrix product <code>M<sub>g</sub> · M<sub>f</sub></code>. Each column of the product is still a basis ket — so the product is still a deterministic function matrix.</div>`;
  html += `<div class="q-row" style="gap:4px;margin-top:10px">`;
  html += `<span class="q-label">${fn.label}∘${fn.label}</span><span class="q-sym">=</span>`;
  html += fnMatHtml(fn);
  html += `<span class="q-sym">·</span>`;
  html += fnMatHtml(fn);
  html += `<span class="q-sym">=</span>`;
  html += matHtml(prod, 'u');
  html += `</div>`;
  html += `</div>`;

  return html;
}

function renderStochasticSection() {
  const m = STOCH_MATRICES[sMat];
  let html = '';

  html += `<div class="q-section-header">Stochastic — probabilistic operations</div>`;
  html += `<div class="q-section-lede">A <b>stochastic matrix</b> has columns that are probability distributions: each entry ≥ 0, and <b>each column sums to 1</b>. `
        + `Applying it to a distribution <code>p</code> produces another distribution <code>Mp</code> — so stochastic matrices are <b>closed under composition</b>. Deterministic matrices are the special case where each column is a single 1.</div>`;

  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Pick a stochastic matrix</div>`;
  html += `<div class="q-fn-picker">`;
  for (const id of Object.keys(STOCH_MATRICES)) {
    const s = STOCH_MATRICES[id];
    const active = id === sMat ? ' active' : '';
    html += `<button class="q-fn-btn${active}" onclick="qSelectStoch('${id}')">${s.label}</button>`;
  }
  html += `</div>`;

  html += `<div class="q-row" style="gap:20px;margin-top:12px">`;
  html += `<div class="q-kv"><span class="q-label">M</span><span class="q-sym">=</span>${matHtml(m.matrix, 'u')}</div>`;
  html += `</div>`;

  // Constraint check: each column sums to 1
  html += `<div class="q-panel-title" style="margin-top:14px">Constraint — each column sums to 1</div>`;
  html += `<div class="q-check-list">`;
  html += colSumHtml(m.matrix, 0);
  html += colSumHtml(m.matrix, 1);
  html += `</div>`;
  html += `<div class="q-gate-info">Entries ≥ 0 means "no negative probabilities". Column j sums to 1 means "given input b=j, the output is some distribution over {0,1} with total mass 1".</div>`;
  html += `</div>`;

  // Apply to a distribution
  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Apply: Mp — distribution in, distribution out</div>`;
  html += `<div class="q-row" style="gap:10px">`;
  html += `<span style="font-size:0.78rem;color:#777;text-transform:uppercase;letter-spacing:.05em">Input p:</span>`;
  const inputs = [
    { p: [1, 0], label: '|0⟩' },
    { p: [0, 1], label: '|1⟩' },
    { p: [0.5, 0.5], label: '½|0⟩+½|1⟩' },
  ];
  for (const inp of inputs) {
    const active = sLastApplied && sInput[0] === inp.p[0] && sInput[1] === inp.p[1] ? ' active' : '';
    html += `<button class="q-apply-btn${active}" onclick="qApplyStoch(${inp.p[0]},${inp.p[1]})">${inp.label}</button>`;
  }
  html += `</div>`;

  if (sLastApplied) {
    html += `<div class="q-row" style="gap:4px;margin-top:10px">`;
    html += `<span class="q-label">Mp</span><span class="q-sym">=</span>`;
    html += matHtml(m.matrix, 'u');
    html += `<span class="q-sym">·</span>`;
    html += ketHtml(sInput, 'b');
    html += `<span class="q-sym">=</span>`;
    html += ketHtml(sLastResult, 'r');
    html += `</div>`;
    // Check that result sums to 1
    const resSum = sLastResult[0] + sLastResult[1];
    html += `<div class="q-check-list" style="margin-top:8px">`;
    html += `<span class="q-check">Mp sums to: ${fmt(sLastResult[0])} + ${fmt(sLastResult[1])} = ${fmt(resSum)} <span class="q-ok">✓</span></span>`;
    html += `</div>`;
    html += `<div class="q-gate-info">Think of column <code>b</code> of M as "the distribution you get from input <code>b</code>". Applying M to a distribution <code>p</code> is a weighted average of those column-distributions — mixing distributions gives another distribution.</div>`;
  }
  html += `</div>`;

  // Closed under composition
  const prod = matMul(m.matrix, m.matrix);
  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Closed under composition — M·M is still stochastic</div>`;
  html += `<div class="q-row" style="gap:4px">`;
  html += `<span class="q-label">M²</span><span class="q-sym">=</span>`;
  html += matHtml(m.matrix, 'u');
  html += `<span class="q-sym">·</span>`;
  html += matHtml(m.matrix, 'u');
  html += `<span class="q-sym">=</span>`;
  html += matHtml(prod, 'u');
  html += `</div>`;
  html += `<div class="q-check-list" style="margin-top:8px">`;
  html += colSumHtml(prod, 0);
  html += colSumHtml(prod, 1);
  html += `</div>`;
  html += `<div class="q-gate-info">Each column of <code>M·M</code> is <code>M · (column of M)</code> — applying a stochastic matrix to a distribution gives a distribution. So the columns of the product still sum to 1. This is why Markov chains work: chaining together probabilistic steps keeps you in the world of probability distributions.</div>`;
  html += `</div>`;

  return html;
}

function renderQuantumSection() {
  let html = '';
  html += `<div class="q-section-header">Quantum gates — the unitary layer</div>`;
  html += `<div class="q-section-lede">Gates keep the outer-product form but <b>relax</b> the stochastic rule: columns don't need to be distributions. Instead, the <b>squared entries of each column sum to 1</b>, and different columns are orthogonal. Together: <code>U†U = I</code>. Squaring kills the sign — which is why negative entries (like Z's <code>−1</code>) are allowed.</div>`;

  // State normalization intro
  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Why "squared entries sum to 1" — a gentle intro</div>`;
  html += `<div class="q-gate-info" style="margin-top:0">For a state <code>|ψ⟩ = α|0⟩ + β|1⟩</code>, the rule of quantum mechanics is:`;
  html += `<ul style="margin:6px 0 6px 18px;padding:0">`;
  html += `<li>probability of measuring <code>0</code> is <code>α²</code></li>`;
  html += `<li>probability of measuring <code>1</code> is <code>β²</code></li>`;
  html += `</ul>`;
  html += `These must sum to 1, so <code>α² + β² = 1</code>. If you apply a matrix U and want the result <code>U|ψ⟩</code> to still be a valid state, U has to preserve this squared sum. Writing it out column by column: each column of U must itself satisfy <code>x² + y² = 1</code>, and different columns must be orthogonal (otherwise the squared sum can shift between terms). That's exactly <code>U†U = I</code>.`;
  html += `</div>`;
  html += `<div class="q-gate-info">Compare the three layers — each generalizes the previous:`;
  html += `<ul style="margin:6px 0 0 18px;padding:0">`;
  html += `<li><b>Deterministic:</b> each column is a basis ket (one 1, rest 0).</li>`;
  html += `<li><b>Stochastic:</b> each column sums to 1, entries ≥ 0.</li>`;
  html += `<li><b>Quantum:</b> <i>squared</i> entries of each column sum to 1; columns pairwise orthogonal.</li>`;
  html += `</ul>`;
  html += `</div>`;
  html += `</div>`;

  // Gate cheat-sheet + U†U check
  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">The gates — and their U†U = I check</div>`;
  for (const name of ['I', 'X', 'Z']) {
    const g = GATES[name];
    html += `<div class="q-row" style="gap:10px;margin-top:8px">`;
    html += `<span class="q-label" style="min-width:28px"><b>${name}</b></span>`;
    html += gateMatHtml(name);
    html += `<span class="q-sym" style="font-family:'SF Mono',Menlo,monospace;font-size:0.92rem">${g.dirac}</span>`;
    html += `</div>`;
    html += `<div class="q-check-list">`;
    html += colSqSumHtml(g.matrix, 0);
    html += colSqSumHtml(g.matrix, 1);
    html += `</div>`;
  }
  html += `<div class="q-gate-info">I and X are identical to the identity and NOT from the Deterministic tab (entries in {0,1} — they're also stochastic). Z has a <code>−1</code>: it's not stochastic (entries would be negative probabilities), but <code>(−1)² = 1</code> so it still passes the quantum check. Sign flips are "free" because probability only sees squared magnitudes.</div>`;
  html += `</div>`;

  // Current state
  html += `<div class="q-panel" style="text-align:center">`;
  html += `<div class="q-panel-title">Current state |ψ⟩</div>`;
  html += `<div class="q-row" style="gap:10px">`;
  html += `<span style="font-size:1.1rem;color:#1a9a40;font-weight:700">|ψ⟩</span>`;
  html += `<span class="q-sym">=</span>`;
  html += ketHtml(state, 'r');
  html += `<span class="q-sym">=</span>`;
  html += `<span style="font-family:'SF Mono',Menlo,monospace;font-size:1rem;color:#1a9a40;font-weight:700">${ketLabel(state)}</span>`;
  html += `</div>`;
  html += `</div>`;

  // Gate buttons
  html += `<div class="q-row" style="gap:14px">`;
  html += `<span style="font-size:0.70rem;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-right:4px">Apply gate:</span>`;
  for (const name of ['I', 'X', 'Z']) {
    const g = GATES[name];
    html += `<button class="q-gate-btn" title="${g.full} — ${g.blurb}" onclick="qApply('${name}')">${g.label}</button>`;
  }
  html += `</div>`;

  // Last operation
  if (lastGate !== null) {
    const G = GATES[lastGate];
    const [[a, b], [c, d]] = G.matrix;
    const [α, β] = prevState;

    html += `<div class="q-panel">`;
    html += `<div class="q-panel-title">Last operation — column mixing</div>`;
    html += `<div class="q-row" style="gap:4px">`;
    html += gateMatHtml(lastGate);
    html += `<span class="q-sym">·</span>`;
    html += ketHtml(prevState, 'b');
    html += `<span class="q-sym">=</span>`;
    html += `<span class="q-coef" style="color:${α < 0 ? '#d04080' : '#1a60b0'}">${α}</span>`;
    html += `<span class="q-sym">·</span>`;
    html += ketHtml([a, c], 'u');
    html += `<span class="q-sym">+</span>`;
    html += `<span class="q-coef" style="color:${β < 0 ? '#d04080' : '#1a60b0'}">${β}</span>`;
    html += `<span class="q-sym">·</span>`;
    html += ketHtml([b, d], 'u');
    html += `<span class="q-sym">=</span>`;
    html += ketHtml(state, 'r');
    html += `</div>`;
    html += `<div class="q-gate-info">`;
    html += `<b>${G.label}</b> = <b>${G.full}</b>. ${G.blurb}<br>`;
    html += `Column 0 of <b>${G.label}</b> is <b>${G.label}</b>|0⟩; column 1 is <b>${G.label}</b>|1⟩. `;
    html += `The coefficients <span style="color:${α < 0 ? '#d04080' : '#1a60b0'};font-weight:700">${α}</span> and `;
    html += `<span style="color:${β < 0 ? '#d04080' : '#1a60b0'};font-weight:700">${β}</span> from |ψ_prev⟩ select how much of each column goes into the result.`;
    html += `</div>`;
    html += `</div>`;
  }

  // History
  if (history.length > 0) {
    html += `<div class="q-panel">`;
    html += `<div class="q-panel-title">Circuit so far (${history.length} gate${history.length === 1 ? '' : 's'})</div>`;
    html += `<div class="q-history">`;
    html += `<span>|0⟩</span>`;
    for (const step of history) {
      html += `<span class="q-history-arrow">→</span>`;
      html += `<span class="q-history-gate">${step.gate}</span>`;
      html += `<span class="q-history-arrow">→</span>`;
      html += `<span>${ketLabel(step.after)}</span>`;
    }
    html += `</div>`;
    html += `</div>`;
  }

  // Closed under composition
  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Closed under composition — products of unitaries are unitary</div>`;
  html += `<div class="q-gate-info" style="margin-top:0">If <code>U†U = I</code> and <code>V†V = I</code>, then <code>(UV)†(UV) = V†U†UV = V†V = I</code>. Chaining gates keeps you in the unitary family, just like chaining stochastic matrices keeps you stochastic.</div>`;
  const xz = matMul(GATES.X.matrix, GATES.Z.matrix);
  html += `<div class="q-row" style="gap:4px;margin-top:10px">`;
  html += `<span class="q-label">XZ</span><span class="q-sym">=</span>`;
  html += gateMatHtml('X');
  html += `<span class="q-sym">·</span>`;
  html += gateMatHtml('Z');
  html += `<span class="q-sym">=</span>`;
  html += matHtml(xz, 'u');
  html += `</div>`;
  html += `<div class="q-check-list" style="margin-top:6px">`;
  html += colSqSumHtml(xz, 0);
  html += colSqSumHtml(xz, 1);
  html += `</div>`;
  html += `</div>`;

  return html;
}

// ── Main render ──
export function qRender() {
  const wrap = document.getElementById('qDisplay');
  if (!wrap) return;

  let html = '';
  if (qSubTab === 'basics')  html += renderBasicsSection();
  if (qSubTab === 'det')     html += renderDeterministicSection();
  if (qSubTab === 'stoch')   html += renderStochasticSection();
  if (qSubTab === 'quantum') html += renderQuantumSection();

  wrap.innerHTML = html;
}

/* @testable */
export function getQState() {
  return {
    state: [...state],
    prevState: prevState ? [...prevState] : null,
    lastGate,
    history: history.map(h => ({ gate: h.gate, before: [...h.before], after: [...h.after] })),
    cFn,
    cInput,
    cLastApplied,
    cLastResult: [...cLastResult],
    sMat,
    sInput: [...sInput],
    sLastApplied,
    sLastResult: [...sLastResult],
    qSubTab,
  };
}

/* @testable */
export { GATES, CLASSICAL_FNS, STOCH_MATRICES, fnMatrix, matMul };
