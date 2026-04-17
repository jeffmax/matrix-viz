// ══════════════════════════════════════════════════
// TAB — QUANTUM GATES: single-qubit classical gates in Dirac notation
// 2D only, no Three.js. Click-driven (no playback animation).
// State |ψ⟩ = α|0⟩ + β|1⟩ stored as [α, β]. A gate is a 2×2 matrix;
// U|ψ⟩ is shown as column-mixing: α·U|0⟩ + β·U|1⟩.
// ══════════════════════════════════════════════════

// 2×2 gate matrices (integer-valued — stays strictly classical + sign flip).
const GATES = {
  I: {
    label: 'I',
    full: 'Identity',
    matrix: [[1, 0], [0, 1]],
    blurb: 'Leaves every state unchanged.',
  },
  X: {
    label: 'X',
    full: 'NOT (Pauli-X)',
    matrix: [[0, 1], [1, 0]],
    blurb: 'Bit flip: swaps |0⟩ and |1⟩. This IS the classical NOT gate.',
  },
  Z: {
    label: 'Z',
    full: 'Phase flip (Pauli-Z)',
    matrix: [[1, 0], [0, -1]],
    blurb: 'Flips the sign of |1⟩. Produces negative amplitudes — no classical analogue.',
  },
};

// State as [α, β] where |ψ⟩ = α|0⟩ + β|1⟩
let state = [1, 0];
let prevState = null;
let lastGate = null;
let history = []; // [{ gate, before: [α,β], after: [α',β'] }]

export function qInit() {
  state = [1, 0];
  prevState = null;
  lastGate = null;
  history = [];
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

export function qPause() { /* no playback — no-op */ }

// ── Helpers ──

function ketLabel(s) {
  const [a, b] = s;
  if (a === 0 && b === 0) return '0';
  const parts = [];
  // α|0⟩
  if (a !== 0) {
    if (a === 1) parts.push({ sign: '+', body: '|0⟩' });
    else if (a === -1) parts.push({ sign: '−', body: '|0⟩' });
    else parts.push({ sign: a > 0 ? '+' : '−', body: `${Math.abs(a)}|0⟩` });
  }
  // β|1⟩
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

function ketHtml(s, cls) {
  return `<div class="q-ket-wrap">`
    + `<span class="q-bracket">[</span>`
    + `<div class="q-ket">${cellHtml(s[0], cls)}${cellHtml(s[1], cls)}</div>`
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

// ── Main render ──
export function qRender() {
  const wrap = document.getElementById('qDisplay');
  if (!wrap) return;

  let html = '';

  // ── Current state ──
  html += `<div class="q-panel" style="text-align:center">`;
  html += `<div class="q-panel-title">Current state</div>`;
  html += `<div class="q-row" style="gap:10px">`;
  html += `<span style="font-size:1.1rem;color:#1a9a40;font-weight:700">|ψ⟩</span>`;
  html += `<span class="q-sym">=</span>`;
  html += ketHtml(state, 'r');
  html += `<span class="q-sym">=</span>`;
  html += `<span style="font-family:'SF Mono',Menlo,monospace;font-size:1rem;color:#1a9a40;font-weight:700">${ketLabel(state)}</span>`;
  html += `</div>`;
  html += `</div>`;

  // ── Gate buttons ──
  html += `<div class="q-row" style="gap:14px">`;
  html += `<span style="font-size:0.70rem;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-right:4px">Apply gate:</span>`;
  for (const name of ['I', 'X', 'Z']) {
    const g = GATES[name];
    html += `<button class="q-gate-btn" title="${g.full} — ${g.blurb}" onclick="qApply('${name}')">${g.label}</button>`;
  }
  html += `</div>`;

  // ── Last operation breakdown ──
  if (lastGate !== null) {
    const G = GATES[lastGate];
    const [[a, b], [c, d]] = G.matrix;
    const [α, β] = prevState;

    html += `<div class="q-panel">`;
    html += `<div class="q-panel-title">Last operation — column mixing</div>`;
    html += `<div class="q-row" style="gap:4px">`;
    // U
    html += gateMatHtml(lastGate);
    html += `<span class="q-sym">·</span>`;
    // |ψ_prev⟩
    html += ketHtml(prevState, 'b');
    html += `<span class="q-sym">=</span>`;
    // α · col0  +  β · col1
    html += `<span class="q-coef" style="color:${α < 0 ? '#d04080' : '#1a60b0'}">${α}</span>`;
    html += `<span class="q-sym">·</span>`;
    html += ketHtml([a, c], 'u');
    html += `<span class="q-sym">+</span>`;
    html += `<span class="q-coef" style="color:${β < 0 ? '#d04080' : '#1a60b0'}">${β}</span>`;
    html += `<span class="q-sym">·</span>`;
    html += ketHtml([b, d], 'u');
    html += `<span class="q-sym">=</span>`;
    // result
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

  // ── History ──
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

  // ── Dirac notation reference ──
  html += `<div class="q-panel">`;
  html += `<div class="q-panel-title">Dirac notation reference</div>`;
  html += `<div class="q-ref-grid">`;
  html += `<div>|0⟩ = [1, 0]<sup>T</sup>  <span style="color:#aaa">(ket — column)</span></div>`;
  html += `<div>⟨0| = [1, 0]  <span style="color:#aaa">(bra — row)</span></div>`;
  html += `<div>|1⟩ = [0, 1]<sup>T</sup></div>`;
  html += `<div>⟨1| = [0, 1]</div>`;
  html += `<div>⟨0|0⟩ = 1,  ⟨1|1⟩ = 1</div>`;
  html += `<div>⟨0|1⟩ = 0,  ⟨1|0⟩ = 0  <span style="color:#aaa">(orthogonal)</span></div>`;
  html += `<div class="q-ref-note">The inner product ⟨φ|ψ⟩ is exactly the dot product from the Inner Product tab. `;
  html += `The outer product |ψ⟩⟨φ| is the Outer Product tab. A gate <b>U</b> applied to |ψ⟩ is matrix&ndash;vector multiplication — einsum <code>ij,j&rarr;i</code>. `;
  html += `Classical reversible computing lives entirely on the basis states |0⟩ and |1⟩; the sign-flip from Z (negative amplitudes) is where quantum starts to diverge.</div>`;
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
  };
}

/* @testable */
export { GATES };
