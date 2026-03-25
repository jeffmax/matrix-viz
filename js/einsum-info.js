// ══════════════════════════════════════════════════
// EINSUM INFO — English translations, shape stories,
// for-loop code, and index highlight mappings
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
      'For each position <b class="ei-hl" data-idx="i">i</b>: multiply a[i] × b[i], then <b class="ei-contract">sum over i</b> → scalar.',
    shape:
      'Intermediate: 1D vector [<b class="ei-hl" data-idx="i">i</b>] → sum out <b class="ei-contract">i</b> → scalar (rank 0)',
    loops: `# i,i→  (dot product → scalar)
result = 0
for i in range(N):        # contracted → summed out
    result += a[i] * b[i]`,
    indices: [
      { ch: 'i', role: 'contracted', label: 'position (summed out)' },
    ],
  },

  intro: {
    english:
      'For each row <b class="ei-hl" data-idx="i">i</b> and column <b class="ei-hl" data-idx="k">k</b>: compute a[i] × b[k]. Nothing is summed.',
    shape:
      'Result: 2D matrix [<b class="ei-hl" data-idx="i">i</b>, <b class="ei-hl" data-idx="k">k</b>] — all indices free, no contraction',
    loops: `# i,k→ik  (outer product → matrix)
result = zeros(I, K)
for i in range(I):        # free → row of result
    for k in range(K):    # free → col of result
        result[i,k] = a[i] * b[k]`,
    indices: [
      { ch: 'i', role: 'free', label: 'row (from a)' },
      { ch: 'k', role: 'free', label: 'column (from b)' },
    ],
  },

  matmul: {
    english:
      'For each output cell (<b class="ei-hl" data-idx="i">i</b>,<b class="ei-hl" data-idx="k">k</b>): multiply along shared dim <b class="ei-hl" data-idx="j">j</b>, then <b class="ei-contract">sum over j</b>.',
    shape:
      'Intermediate: 3D cube [<b class="ei-hl" data-idx="i">i</b>, <b class="ei-hl" data-idx="j">j</b>, <b class="ei-hl" data-idx="k">k</b>] → sum out <b class="ei-contract">j</b> → 2D result [i, k]',
    loops: `# ij,jk→ik  (matrix multiply)
result = zeros(I, K)
for i in range(I):        # free → row of result
    for k in range(K):    # free → col of result
        for j in range(J):  # contracted → summed out
            result[i,k] += A[i,j] * B[j,k]`,
    indices: [
      { ch: 'i', role: 'free', label: 'row of A / row of result' },
      { ch: 'j', role: 'contracted', label: 'shared dim (summed out)' },
      { ch: 'k', role: 'free', label: 'col of B / col of result' },
    ],
  },

  'embed-fwd': {
    english:
      'For each batch <b class="ei-hl" data-idx="b">b</b>, token <b class="ei-hl" data-idx="t">t</b>, channel <b class="ei-hl" data-idx="c">c</b>: multiply along vocab dim <b class="ei-hl" data-idx="v">v</b>, then <b class="ei-contract">sum over v</b>. One-hot X makes this a row lookup.',
    shape:
      'Intermediate: 4D tensor [<b class="ei-hl" data-idx="b">b</b>, <b class="ei-hl" data-idx="t">t</b>, <b class="ei-hl" data-idx="v">v</b>, <b class="ei-hl" data-idx="c">c</b>] → sum out <b class="ei-contract">v</b> → 3D result [b, t, c]',
    loops: `# btv,vc→btc  (embedding forward)
Y = zeros(B, T, C)
for b in range(B):        # free → batch
    for t in range(T):    # free → token position
        for c in range(C):  # free → embedding channel
            for v in range(V):  # contracted → summed out
                Y[b,t,c] += X[b,t,v] * W[v,c]
# Since X is one-hot, only one v is nonzero per (b,t)
# so this simplifies to: Y[b,t,:] = W[token_id, :]`,
    indices: [
      { ch: 'b', role: 'free', label: 'batch' },
      { ch: 't', role: 'free', label: 'token position' },
      { ch: 'v', role: 'contracted', label: 'vocab dim (summed out)' },
      { ch: 'c', role: 'free', label: 'embedding channel' },
    ],
  },

  'embed-bwd': {
    english:
      'For each vocab row <b class="ei-hl" data-idx="v">v</b>, channel <b class="ei-hl" data-idx="c">c</b>: multiply across all positions, then <b class="ei-contract">sum over b,t</b>. Each position contributes a rank-1 outer product to the gradient.',
    shape:
      'Intermediate: 4D tensor [<b class="ei-hl" data-idx="b">b</b>, <b class="ei-hl" data-idx="t">t</b>, <b class="ei-hl" data-idx="v">v</b>, <b class="ei-hl" data-idx="c">c</b>] → sum out <b class="ei-contract">b, t</b> → 2D result [v, c]',
    loops: `# btv,btc→vc  (embedding backward / weight gradient)
dW = zeros(V, C)
for v in range(V):        # free → vocab row
    for c in range(C):    # free → channel
        for b in range(B):  # contracted → summed out
            for t in range(T):  # contracted → summed out
                dW[v,c] += X[b,t,v] * G[b,t,c]
# Since X is one-hot, only positions where token==v contribute
# so this simplifies to: dW[v,:] = sum of G[b,t,:] where token==v`,
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
// BADGE RENDERING & INDEX HOVER
// ══════════════════════════════════════════════════

// Signature HTML per tab (index spans with data-idx for hover)
const BADGE_SIG = {
  inner:       `einsum('<span class="ei-contract ei-idx" data-idx="i">i</span>, <span class="ei-contract ei-idx" data-idx="i">i</span> → ', a, b)`,
  intro:       `einsum('<span class="ei-free ei-idx" data-idx="i">i</span>, <span class="ei-free ei-idx" data-idx="k">k</span> → <span class="ei-free">ik</span>', a, b)`,
  matmul:      `einsum('<span class="ei-free ei-idx" data-idx="i">i</span><span class="ei-contract ei-idx" data-idx="j">j</span>, <span class="ei-contract ei-idx" data-idx="j">j</span><span class="ei-free ei-idx" data-idx="k">k</span> → <span class="ei-free">ik</span>', A, B)`,
  'embed-fwd': `einsum('<span class="ei-free ei-idx" data-idx="b">b</span><span class="ei-free ei-idx" data-idx="t">t</span><span class="ei-contract ei-idx" data-idx="v">v</span>, <span class="ei-contract ei-idx" data-idx="v">v</span><span class="ei-free ei-idx" data-idx="c">c</span> → <span class="ei-free">btc</span>', X, W)`,
  'embed-bwd': `einsum('<span class="ei-contract ei-idx" data-idx="b">b</span><span class="ei-contract ei-idx" data-idx="t">t</span><span class="ei-free ei-idx" data-idx="v">v</span>, <span class="ei-contract ei-idx" data-idx="b">b</span><span class="ei-contract ei-idx" data-idx="t">t</span><span class="ei-free ei-idx" data-idx="c">c</span> → <span class="ei-free">vc</span>', X, G)`,
};

const TAB_CONTAINER = {
  inner: 'ctrl-inner', intro: 'ctrl-intro', matmul: 'ctrl-matmul',
  'embed-fwd': 'ctrl-embed-fwd', 'embed-bwd': 'ctrl-embed-bwd',
};

let activeEinsumHover = null;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* @testable */
export function renderEinsumBadge(containerId, tab) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const info = EINSUM_INFO[tab];
  const sig = BADGE_SIG[tab] || '';

  // Build badge row: signature + torch button + loops toggle
  let html = `<span class="ei-sig">${sig}</span>`;
  html += ` <button class="copy-torch-btn active-tab" onclick="copyTorchCode('${tab}')">📋 torch</button>`;
  html += ` <button class="ei-loops-btn" onclick="einsumToggleLoops('${containerId}')">{ } loops</button>`;

  // English + shape story (always visible below badge)
  if (info) {
    html += `<div class="ei-english">${info.english}</div>`;
    html += `<div class="ei-shape">${info.shape}</div>`;
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

  // Clear old active-tab buttons from other badges
  document.querySelectorAll('.copy-torch-btn.active-tab').forEach(b => {
    if (!el.contains(b)) b.classList.remove('active-tab');
  });

  // Wire up hover on index spans
  el.querySelectorAll('.ei-idx').forEach(span => {
    span.addEventListener('mouseenter', () => einsumIndexHover(tab, span.dataset.idx));
    span.addEventListener('mouseleave', () => einsumIndexClear(tab));
  });
  // Also wire up hoverable index refs in english/shape text
  el.querySelectorAll('.ei-hl[data-idx]').forEach(span => {
    span.addEventListener('mouseenter', () => einsumIndexHover(tab, span.dataset.idx));
    span.addEventListener('mouseleave', () => einsumIndexClear(tab));
  });
}

/* @testable */
export function einsumToggleLoops(containerId) {
  const panel = document.getElementById(containerId + 'Loops');
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

/* @testable */
export function einsumIndexHover(tab, idx) {
  einsumIndexClear(tab);
  activeEinsumHover = idx;
  const container = document.getElementById(TAB_CONTAINER[tab]);
  if (container) container.classList.add('ei-hover', `ei-hover-${idx}`);
  document.querySelectorAll(`.ei-idx[data-idx="${idx}"]`).forEach(s => s.classList.add('ei-idx-active'));
  document.querySelectorAll(`.ei-hl[data-idx="${idx}"]`).forEach(s => s.classList.add('ei-idx-active'));
}

/* @testable */
export function einsumIndexClear(tab) {
  if (!activeEinsumHover) return;
  const container = document.getElementById(TAB_CONTAINER[tab]);
  if (container) {
    container.classList.remove('ei-hover', `ei-hover-${activeEinsumHover}`);
  }
  document.querySelectorAll('.ei-idx-active').forEach(s => s.classList.remove('ei-idx-active'));
  activeEinsumHover = null;
}

/* @testable */
export function getActiveEinsumHover() { return activeEinsumHover; }
