// ══════════════════════════════════════════════════
// TAB — DIRAC NOTATION: classical bits → deterministic ops → quantum gates
// 2D only, no Three.js. Click-driven (no playback animation).
//
// Three sections:
//   1. Basics       — |0⟩, |1⟩, ⟨0|, ⟨1|, ⟨a|b⟩ indicator, |a⟩⟨b| matrix
//   2. Classical    — pick f: {0,1}→{0,1}; build M = Σ_b |f(b)⟩⟨b|; apply M|a⟩
//   3. Quantum      — I, X, Z gates on |ψ⟩ = α|0⟩ + β|1⟩, column mixing view
// ══════════════════════════════════════════════════

// ── 2×2 gate matrices (section 3) ──
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

// ── Classical 1-bit functions (section 2) ──
// Σ = {0,1}; each entry gives f(0) and f(1) plus its matrix M = Σ_b |f(b)⟩⟨b|.
const CLASSICAL_FNS = {
  id:     { label: 'identity', f: [0, 1], name: 'id',  gate: 'I' },
  not:    { label: 'NOT',      f: [1, 0], name: 'not', gate: 'X' },
  const0: { label: 'const-0',  f: [0, 0], name: 'c₀',  gate: null },
  const1: { label: 'const-1',  f: [1, 1], name: 'c₁',  gate: null },
};

// Classical section state
let cFn = 'id';                 // selected function id
let cInput = 0;                 // last applied input (0 or 1)
let cLastApplied = false;       // whether M|a⟩ has been computed
let cLastResult = [1, 0];       // result of last M|a⟩ application

// ── Quantum section state ──
let state = [1, 0];
let prevState = null;
let lastGate = null;
let history = []; // [{ gate, before: [α,β], after: [α',β'] }]

// Whether to expand the examples in the Basics panel
let basicExamples = { aEx: 0, bEx: 1, outerA: 1, outerB: 0 };

export function qInit() {
  state = [1, 0];
  prevState = null;
  lastGate = null;
  history = [];
  cFn = 'id';
  cInput = 0;
  cLastApplied = false;
  cLastResult = [1, 0];
}

export function qReset() {
  qInit();
  qRender();
}

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

// Classical section: pick function
export function qSelectFn(id) {
  if (!CLASSICAL_FNS[id]) return;
  cFn = id;
  cLastApplied = false;
  qRender();
}

// Classical section: apply M|a⟩
export function qApplyClassical(a) {
  const fn = CLASSICAL_FNS[cFn];
  if (!fn || (a !== 0 && a !== 1)) return;
  cInput = a;
  // M|a⟩ = Σ_b |f(b)⟩⟨b|a⟩ = |f(a)⟩
  cLastResult = a === 0 ? ket(fn.f[0]) : ket(fn.f[1]);
  cLastApplied = true;
  qRender();
}

export function qPause() { /* no playback — no-op */ }

// ── Helpers ──

function ket(bit) { return bit === 0 ? [1, 0] : [0, 1]; }

function ketSymbol(bit) { return `|${bit}⟩`; }
function braSymbol(bit) { return `⟨${bit}|`; }

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

function cellHtml(v, cls) {
  const signCls = v < 0 ? ' neg' : '';
  return `<div class="mat-cell ${cls}${signCls}">${v}</div>`;
}

// Column ket: [col of values] wrapped in brackets
function ketHtml(s, cls) {
  return `<div class="q-ket-wrap">`
    + `<span class="q-bracket">[</span>`
    + `<div class="q-ket">${cellHtml(s[0], cls)}${cellHtml(s[1], cls)}</div>`
    + `<span class="q-bracket">]</span>`
    + `</div>`;
}

// Row bra: [row of values] wrapped in brackets
function braHtml(s, cls) {
  return `<div class="q-ket-wrap">`
    + `<span class="q-bracket">[</span>`
    + `<div class="q-bra">${cellHtml(s[0], cls)}${cellHtml(s[1], cls)}</div>`
    + `<span class="q-bracket">]</span>`
    + `</div>`;
}

// |a⟩⟨b| as 2x2 matrix
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
  const [[a, b], [c, d]] = GATES[name].matrix;
  return `<div class="q-ket-wrap">`
    + `<span class="q-bracket">[</span>`
    + `<div class="q-gate-mat">${cellHtml(a, 'u')}${cellHtml(b, 'u')}${cellHtml(c, 'u')}${cellHtml(d, 'u')}</div>`
    + `<span class="q-bracket">]</span>`
    + `</div>`;
}

// Σ-notation matrix M = Σ_b |f(b)⟩⟨b| as a concrete 2x2
function fnMatrix(fn) {
  const m = [[0, 0], [0, 0]];
  for (let b = 0; b < 2; b++) {
    const fb = fn.f[b];
    m[fb][b] += 1;
  }
  return m;
}

function fnMatHtml(fn) {
  const m = fnMatrix(fn);
  return `<div class="q-ket-wrap">`
    + `<span class="q-bracket">[</span>`
    + `<div class="q-gate-mat">${cellHtml(m[0][0], 'u')}${cellHtml(m[0][1], 'u')}${cellHtml(m[1][0], 'u')}${cellHtml(m[1][1], 'u')}</div>`
    + `<span class="q-bracket">]</span>`
    + `</div>`;
}

// ── Section renderers ──

function renderBasicsSection() {
  let html = '';
  html += `<div class="q-section-header">1 · Basics: kets, bras, inner &amp; outer products</div>`;
  html += `<div class="q-section-lede">A <b>ket</b> <code>|x⟩</code> is a column vector; a <b>bra</b> <code>⟨x|</code> is its row-vector transpose. `
        + `The two basis states <code>|0⟩</code> and <code>|1⟩</code> encode a classical bit.</div>`;

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

  // Inner product ⟨a|b⟩
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

  // Outer product |a⟩⟨b|
  html += `<div class="q-panel-title" style="margin-top:14px">Outer product |a⟩⟨b| — ket · bra = matrix</div>`;
  html += `<div class="q-row" style="gap:4px">`;
  html += `<span class="q-label">|1⟩⟨0|</span><span class="q-sym">=</span>`;
  html += `${ketHtml([0, 1], 'u')}<span class="q-sym">·</span>${braHtml([1, 0], 'u')}`;
  html += `<span class="q-sym">=</span>${outerHtml(1, 0)}`;
  html += `</div>`;
  html += `<div class="q-gate-info">A 2×2 matrix with a single <code>1</code> at row a, column b. Multiplying this matrix by <code>|b⟩</code> yields <code>|a⟩</code>; by any other basis ket yields 0. These are the building blocks of every 1-bit operation — see the next section.</div>`;
  html += `</div>`;

  return html;
}

function renderClassicalSection() {
  const fn = CLASSICAL_FNS[cFn];
  let html = '';

  html += `<div class="q-section-header">2 · Deterministic operations on classical bits</div>`;
  html += `<div class="q-section-lede">Every function <code>f : Σ → Σ</code> becomes a matrix <code>M = Σ<sub>b</sub> |f(b)⟩⟨b|</code>. `
        + `Applying it gives <code>M|a⟩ = Σ<sub>b</sub> |f(b)⟩⟨b|a⟩ = |f(a)⟩</code> — the indicator <code>⟨b|a⟩</code> picks the term where b = a.</div>`;

  html += `<div class="q-panel">`;

  // Function picker
  html += `<div class="q-panel-title">Choose a 1-bit function f : {0,1} → {0,1}</div>`;
  html += `<div class="q-fn-picker">`;
  for (const id of Object.keys(CLASSICAL_FNS)) {
    const f = CLASSICAL_FNS[id];
    const active = id === cFn ? ' active' : '';
    html += `<button class="q-fn-btn${active}" onclick="qSelectFn('${id}')">${f.label}</button>`;
  }
  html += `</div>`;

  // Truth table
  html += `<div class="q-row" style="gap:30px;margin-top:10px">`;
  html += `<div class="q-fn-table">`;
  html += `<div class="q-fn-head">b</div><div class="q-fn-head">f(b)</div>`;
  for (let b = 0; b < 2; b++) {
    html += `<div>${b}</div><div>${fn.f[b]}</div>`;
  }
  html += `</div>`;

  // Σ-form
  html += `<div class="q-kv">`;
  html += `<span class="q-label">M</span><span class="q-sym">=</span>`;
  html += `<span style="font-family:'SF Mono',Menlo,monospace;font-size:0.94rem">`;
  html += `|${fn.f[0]}⟩⟨0| + |${fn.f[1]}⟩⟨1|`;
  html += `</span>`;
  html += `</div>`;

  // Built-up matrix
  html += `<div class="q-kv">`;
  html += `<span class="q-sym">=</span>`;
  html += outerHtml(fn.f[0], 0);
  html += `<span class="q-sym">+</span>`;
  html += outerHtml(fn.f[1], 1);
  html += `<span class="q-sym">=</span>`;
  html += fnMatHtml(fn);
  html += `</div>`;
  html += `</div>`;

  // Apply M|a⟩ section
  html += `<div class="q-panel-title" style="margin-top:14px">Apply: M|a⟩ = |f(a)⟩</div>`;
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

    // Expansion: Σ_b |f(b)⟩⟨b|a⟩
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
    html += `<div class="q-gate-info">Only the term with <code>⟨b|a⟩ = 1</code> (i.e. b = ${cInput}) survives. The others are zeroed out by orthogonality — that's how Σ_b |f(b)⟩⟨b| acts as "the matrix version of f".</div>`;
  }
  html += `</div>`;
  return html;
}

function renderQuantumSection() {
  let html = '';
  html += `<div class="q-section-header">3 · Quantum gates — where amplitudes can go negative</div>`;
  html += `<div class="q-section-lede">Gates keep the outer-product form from section 2 but allow coefficients other than 0 and 1. `
        + `<b>I</b> and <b>X</b> are the identity and NOT from classical — just re-read as quantum matrices. `
        + `<b>Z</b> introduces a <code>−1</code>; that's where classical ends.</div>`;

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

  // Gate cheat-sheet in Dirac form
  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Gates in Dirac form — outer-product sums (compare section 2)</div>`;
  html += `<div class="q-ref-grid">`;
  for (const name of ['I', 'X', 'Z']) {
    const g = GATES[name];
    html += `<div><b>${g.label}</b> = ${g.dirac}</div>`;
  }
  html += `<div class="q-ref-note">I and X are identical to the identity and NOT matrices from section 2 (coefficients all 1 — they're classical). Z has a <code>−1</code> coefficient: it cannot be written as <code>Σ_b |f(b)⟩⟨b|</code> for any function f, so it has no classical analogue.</div>`;
  html += `</div>`;
  html += `</div>`;

  // Last operation breakdown — column mixing
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

  return html;
}

// ── Main render ──
export function qRender() {
  const wrap = document.getElementById('qDisplay');
  if (!wrap) return;

  let html = '';
  html += renderBasicsSection();
  html += renderClassicalSection();
  html += renderQuantumSection();

  // Global connection note
  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Dirac notation — connections across the app</div>`;
  html += `<div class="q-ref-grid">`;
  html += `<div>⟨a|b⟩ &nbsp;= &nbsp;inner / dot product  <span style="color:#aaa">(Inner Product tab)</span></div>`;
  html += `<div>|a⟩⟨b| &nbsp;= &nbsp;outer product  <span style="color:#aaa">(Outer Product tab)</span></div>`;
  html += `<div>U|ψ⟩ &nbsp;= &nbsp;matrix–vector multiply  <span style="color:#aaa">(einsum <code>ij,j→i</code>)</span></div>`;
  html += `<div>Σ<sub>b</sub>|f(b)⟩⟨b| &nbsp;= &nbsp;classical function as a matrix</div>`;
  html += `<div class="q-ref-note">Toggle "Dirac" on the Inner and Outer Product tabs to see the same operations re-skinned in bra-ket form. The machinery is identical; only the notation changes.</div>`;
  html += `</div>`;
  html += `</div>`;

  wrap.innerHTML = html;
}

/* @testable */
export function getQState() {
  return {
    state: [...state],
    prevState: prevState ? [...prevState] : null,
    lastGate,
    history: history.map(h => ({ gate: h.gate, before: [...h.before], after: [...h.after] })),
    // Classical section
    cFn,
    cInput,
    cLastApplied,
    cLastResult: [...cLastResult],
  };
}

/* @testable */
export { GATES, CLASSICAL_FNS, fnMatrix };
