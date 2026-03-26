// ══════════════════════════════════════════════════
// EINSUM INFO — English translations, shape stories,
// for-loop code, and operand-aware index highlighting
// ══════════════════════════════════════════════════

/**
 * Per-tab einsum metadata.
 * Each entry has:
 *   english   – plain-English description with shape story
 *   loops     – copyable Python for-loop equivalent
 *   indices   – list of index chars with role and label for hover
 */
export const EINSUM_INFO = {
  inner: {
    english:
      'For each position <b class="ei-contract">i</b>: multiply a[i] × b[i], then <b class="ei-contract">sum over i</b> → scalar.',
    shape:
      'Intermediate: 1D vector [i] → sum out <b class="ei-contract">i</b> → scalar (rank 0)',
    loops: `import numpy as np

# i,i→  (dot product → scalar)
N = 4
a = np.random.randn(N)
b = np.random.randn(N)

result = 0
for i in range(N):        # contracted → summed out
    result += a[i] * b[i]

# verify: np.einsum('i,i->', a, b)`,
    indices: [
      { ch: 'i', role: 'contracted', label: 'position (summed out)' },
    ],
  },

  intro: {
    english:
      'For each row <b>i</b> and column <b>k</b>: compute a[i] × b[k]. Nothing is summed.',
    shape:
      'Result: 2D matrix [i, k] — all indices free, no contraction',
    loops: `import numpy as np

# i,k→ik  (outer product → matrix)
I, K = 3, 4
a = np.random.randn(I)
b = np.random.randn(K)

result = np.zeros((I, K))
for i in range(I):        # free → row of result
    for k in range(K):    # free → col of result
        result[i,k] = a[i] * b[k]

# verify: np.einsum('i,k->ik', a, b)`,
    indices: [
      { ch: 'i', role: 'free', label: 'row (from a)' },
      { ch: 'k', role: 'free', label: 'column (from b)' },
    ],
  },

  matmul: {
    english:
      'For each output cell (<b>i</b>,<b>k</b>): multiply along shared dim <b class="ei-contract">j</b>, then <b class="ei-contract">sum over j</b>.',
    shape:
      'Intermediate: 3D cube [i, j, k] → sum out <b class="ei-contract">j</b> → 2D result [i, k]',
    loops: `import numpy as np

# ij,jk→ik  (matrix multiply)
I, J, K = 3, 3, 4
A = np.random.randn(I, J)
B = np.random.randn(J, K)

result = np.zeros((I, K))
for i in range(I):        # free → row of result
    for k in range(K):    # free → col of result
        for j in range(J):  # contracted → summed out
            result[i,k] += A[i,j] * B[j,k]

# verify: np.einsum('ij,jk->ik', A, B)`,
    indices: [
      { ch: 'i', role: 'free', label: 'row of A / row of result' },
      { ch: 'j', role: 'contracted', label: 'shared dim (summed out)' },
      { ch: 'k', role: 'free', label: 'col of B / col of result' },
    ],
  },

  'embed-fwd': {
    english:
      'For each batch <b>b</b>, token <b>t</b>, channel <b>c</b>: multiply along vocab dim <b class="ei-contract">v</b>, then <b class="ei-contract">sum over v</b>. One-hot X makes this a row lookup.',
    shape:
      'Intermediate: 4D tensor [b, t, v, c] → sum out <b class="ei-contract">v</b> → 3D result [b, t, c]',
    loops: `import numpy as np

# btv,vc→btc  (embedding forward)
B, T, V, C = 1, 3, 5, 4
X = np.zeros((B, T, V))            # one-hot encoded tokens
for b_ in range(B):
    for t_ in range(T):
        X[b_, t_, np.random.randint(V)] = 1
W = np.random.randn(V, C)          # embedding weight matrix

Y = np.zeros((B, T, C))
for b in range(B):        # free → batch
    for t in range(T):    # free → token position
        for c in range(C):  # free → embedding channel
            for v in range(V):  # contracted → summed out
                Y[b,t,c] += X[b,t,v] * W[v,c]

# Since X is one-hot, only one v is nonzero per (b,t)
# so this simplifies to: Y[b,t,:] = W[token_id, :]
# verify: np.einsum('btv,vc->btc', X, W)`,
    indices: [
      { ch: 'b', role: 'free', label: 'batch' },
      { ch: 't', role: 'free', label: 'token position' },
      { ch: 'v', role: 'contracted', label: 'vocab dim (summed out)' },
      { ch: 'c', role: 'free', label: 'embedding channel' },
    ],
  },

  'embed-bwd': {
    english:
      'For each vocab row <b>v</b>, channel <b>c</b>: multiply across all positions, then <b class="ei-contract">sum over b,t</b>. Each position contributes a rank-1 outer product to the gradient.',
    shape:
      'Intermediate: 4D tensor [b, t, v, c] → sum out <b class="ei-contract">b, t</b> → 2D result [v, c]',
    loops: `import numpy as np

# btv,btc→vc  (embedding backward / weight gradient)
B, T, V, C = 1, 3, 5, 4
X = np.zeros((B, T, V))            # one-hot encoded tokens
for b_ in range(B):
    for t_ in range(T):
        X[b_, t_, np.random.randint(V)] = 1
G = np.random.randn(B, T, C)       # upstream gradient

dW = np.zeros((V, C))
for v in range(V):        # free → vocab row
    for c in range(C):    # free → channel
        for b in range(B):  # contracted → summed out
            for t in range(T):  # contracted → summed out
                dW[v,c] += X[b,t,v] * G[b,t,c]

# Since X is one-hot, only positions where token==v contribute
# so this simplifies to: dW[v,:] = sum of G[b,t,:] where token==v
# verify: np.einsum('btv,btc->vc', X, G)`,
    indices: [
      { ch: 'b', role: 'contracted', label: 'batch (summed out)' },
      { ch: 't', role: 'contracted', label: 'token position (summed out)' },
      { ch: 'v', role: 'free', label: 'vocab row' },
      { ch: 'c', role: 'free', label: 'embedding channel' },
    ],
  },
};

/**
 * Get the EINSUM_INFO entry for a tab.
 * @param {string} tab — 'inner'|'intro'|'matmul'|'embed-fwd'|'embed-bwd'
 * @returns {object|null}
 */
export function getEinsumInfo(tab) {
  return EINSUM_INFO[tab] || null;
}

// ══════════════════════════════════════════════════
// BADGE RENDERING & OPERAND-AWARE INDEX HOVER
// ══════════════════════════════════════════════════

// Signature HTML per tab.
// Each ei-idx span has:
//   data-idx = index letter (i, j, k, etc.)
//   data-op  = operand: "0" (1st input), "1" (2nd input), "out" (output)
// Hovering highlights the *operand*, not the index letter globally.
const BADGE_SIG = {
  inner: `einsum('<span class="ei-contract ei-idx" data-idx="i" data-op="0">i</span>, <span class="ei-contract ei-idx" data-idx="i" data-op="1">i</span> → ', a, b)`,
  intro: `einsum('<span class="ei-free ei-idx" data-idx="i" data-op="0">i</span>, <span class="ei-free ei-idx" data-idx="k" data-op="1">k</span> → <span class="ei-free ei-idx" data-op="out">ik</span>', a, b)`,
  matmul: `einsum('<span class="ei-free ei-idx" data-idx="i" data-op="0">i</span><span class="ei-contract ei-idx" data-idx="j" data-op="0">j</span>, <span class="ei-contract ei-idx" data-idx="j" data-op="1">j</span><span class="ei-free ei-idx" data-idx="k" data-op="1">k</span> → <span class="ei-free ei-idx" data-op="out">ik</span>', A, B)`,
  'embed-fwd': `einsum('<span class="ei-free ei-idx" data-idx="b" data-op="0">b</span><span class="ei-free ei-idx" data-idx="t" data-op="0">t</span><span class="ei-contract ei-idx" data-idx="v" data-op="0">v</span>, <span class="ei-contract ei-idx" data-idx="v" data-op="1">v</span><span class="ei-free ei-idx" data-idx="c" data-op="1">c</span> → <span class="ei-free ei-idx" data-op="out">btc</span>', X, W)`,
  'embed-bwd': `einsum('<span class="ei-contract ei-idx" data-idx="b" data-op="0">b</span><span class="ei-contract ei-idx" data-idx="t" data-op="0">t</span><span class="ei-free ei-idx" data-idx="v" data-op="0">v</span>, <span class="ei-contract ei-idx" data-idx="b" data-op="1">b</span><span class="ei-contract ei-idx" data-idx="t" data-op="1">t</span><span class="ei-free ei-idx" data-idx="c" data-op="1">c</span> → <span class="ei-free ei-idx" data-op="out">vc</span>', X, G)`,
};

const TAB_CONTAINER = {
  inner: 'ctrl-inner', intro: 'ctrl-intro', matmul: 'ctrl-matmul',
  'embed-fwd': 'ctrl-embed-fwd', 'embed-bwd': 'ctrl-embed-bwd',
};

let activeEinsumHover = null; // { op, idx } or null

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Callback to generate torch code — set by app.js via setTorchCodeGenerator
let torchCodeGenerator = null;
export function setTorchCodeGenerator(fn) { torchCodeGenerator = fn; }

/* @testable */
export function renderEinsumBadge(containerId, tab) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const info = EINSUM_INFO[tab];
  const sig = BADGE_SIG[tab] || '';

  // Build badge row: signature + buttons
  let html = `<span class="ei-sig">${sig}</span>`;
  html += ` <button class="ei-torch-btn" onclick="einsumToggleTorch('${containerId}', '${tab}')">🔥 torch</button>`;
  html += ` <button class="ei-loops-btn" onclick="einsumToggleLoops('${containerId}')">{ } loops</button>`;
  html += ` <button class="ei-info-btn" onclick="einsumToggleInfo('${containerId}')">? info</button>`;

  // Torch overlay (hidden by default) — populated dynamically
  html += `<div class="ei-loops-panel" id="${containerId}Torch">`;
  html += `<div class="ei-loops-header"><span>PyTorch equivalent</span>`;
  html += `<button class="ei-loops-copy" onclick="einsumCopyTorch('${containerId}', this)">📋 copy</button>`;
  html += `<button class="ei-loops-close" onclick="einsumToggleTorch('${containerId}', '${tab}')">✕</button></div>`;
  html += `<pre class="ei-loops-code" id="${containerId}TorchCode"></pre>`;
  html += `</div>`;

  // Info overlay (hidden by default) — English + shape
  if (info) {
    html += `<div class="ei-info-panel" id="${containerId}Info">`;
    html += `<div class="ei-info-header"><span>What this einsum does</span>`;
    html += `<button class="ei-info-close" onclick="einsumToggleInfo('${containerId}')">✕</button></div>`;
    html += `<div class="ei-info-body">`;
    html += `<div class="ei-english">${info.english}</div>`;
    html += `<div class="ei-shape">${info.shape}</div>`;
    html += `</div></div>`;
  }

  // Loops overlay (hidden by default)
  if (info) {
    html += `<div class="ei-loops-panel" id="${containerId}Loops">`;
    html += `<div class="ei-loops-header"><span>Python for-loop equivalent</span>`;
    html += `<button class="ei-loops-copy" onclick="einsumCopyLoops('${tab}', this)">📋 copy</button>`;
    html += `<button class="ei-loops-close" onclick="einsumToggleLoops('${containerId}')">✕</button></div>`;
    html += `<pre class="ei-loops-code">${escapeHtml(info.loops)}</pre>`;
    html += `</div>`;
  }

  el.innerHTML = html;

  // Wire up hover on index spans — operand-aware
  el.querySelectorAll('.ei-idx').forEach(span => {
    span.addEventListener('mouseenter', () => einsumIndexHover(tab, span.dataset.op, span.dataset.idx));
    span.addEventListener('mouseleave', () => einsumIndexClear(tab));
  });
}

// Close all panels in a badge container except the one with the given suffix
function closeOtherPanels(containerId, exceptSuffix) {
  const suffixes = ['Torch', 'Loops', 'Info'];
  for (const s of suffixes) {
    if (s === exceptSuffix) continue;
    const p = document.getElementById(containerId + s);
    if (p) p.classList.remove('open');
  }
}

/* @testable */
export function einsumToggleTorch(containerId, tab) {
  closeOtherPanels(containerId, 'Torch');
  const panel = document.getElementById(containerId + 'Torch');
  if (!panel) return;
  // Populate code fresh each time we open
  if (!panel.classList.contains('open') && torchCodeGenerator) {
    const codeEl = document.getElementById(containerId + 'TorchCode');
    if (codeEl) codeEl.textContent = torchCodeGenerator(tab);
  }
  panel.classList.toggle('open');
}

/* @testable */
export function einsumCopyTorch(containerId, btn) {
  const codeEl = document.getElementById(containerId + 'TorchCode');
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.textContent).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ copied';
    setTimeout(() => btn.textContent = orig, 1500);
  });
}

/* @testable */
export function einsumToggleLoops(containerId) {
  closeOtherPanels(containerId, 'Loops');
  const panel = document.getElementById(containerId + 'Loops');
  if (panel) panel.classList.toggle('open');
}

/* @testable */
export function einsumToggleInfo(containerId) {
  closeOtherPanels(containerId, 'Info');
  const panel = document.getElementById(containerId + 'Info');
  if (panel) panel.classList.toggle('open');
}

/* @testable */
export function einsumCopyLoops(tab, btn) {
  const info = EINSUM_INFO[tab];
  if (!info) return;
  navigator.clipboard.writeText(info.loops).then(() => {
    if (btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = '📋 copy'; }, 1200);
    }
  });
}

// ── Operand-aware index hover highlighting ──
// Adds 'ei-hl-op0', 'ei-hl-op1', or 'ei-hl-out' to the tab container.
// CSS per tab maps these to the correct visual elements:
//   op0 = first input (a, A, X)
//   op1 = second input (b, B, W/G)
//   out = result

/* @testable */
export function einsumIndexHover(tab, op, idx) {
  einsumIndexClear(tab);
  activeEinsumHover = { op, idx };
  const container = document.getElementById(TAB_CONTAINER[tab]);
  if (container) container.classList.add('ei-hl-active', `ei-hl-op${op}`);
  // Highlight the hovered span and matching operand spans
  document.querySelectorAll(`.ei-idx[data-op="${op}"]`).forEach(s => s.classList.add('ei-idx-active'));
}

/* @testable */
export function einsumIndexClear(tab) {
  if (!activeEinsumHover) return;
  const { op } = activeEinsumHover;
  const container = document.getElementById(TAB_CONTAINER[tab]);
  if (container) {
    container.classList.remove('ei-hl-active', `ei-hl-op${op}`);
  }
  document.querySelectorAll('.ei-idx-active').forEach(s => s.classList.remove('ei-idx-active'));
  activeEinsumHover = null;
}

/* @testable */
export function getActiveEinsumHover() { return activeEinsumHover; }
