// ══════════════════════════════════════════════════
// APP — ENTRY POINT, MODE SWITCHING, INIT
// ══════════════════════════════════════════════════
import { I, J, K, A, B, currentMode, setCurrentMode, computeData, changeDim,
         registerCallbacks, toggleInfo, recomputeFromMatrices, resetLabels,
         setData, infoOpen, setOnShelfOpen, setBuildComplete } from './shared.js';
import { sc, initScene, moveCanvasTo, snapToDefault } from './scene.js';
import { boxes, rebuildBoxes, addPlusPlanes, removePlusPlanes, ensureAllGreen, clearBoxes, toggleAxisLabels } from './cube-manager.js';
import { initIntroVecs, renderIntro, pauseIntro, resetIntroStep,
         resizeIntroVecs, stepFwdIntro, stepBackIntro, togglePlayIntro, resetIntro,
         introEditCell, introHover, introClearHover, introToggleDirac } from './tab-intro.js';
import { mmPauseAll, mmReset, mmToggle, mmFwd, mmBack, mmScrubCollapse,
         resetMmBuildState, applyS1, applyStep, renderA, renderB,
         mmUpdateCanvasTitle, collapseT, mmPhase, applyCollapse, mmRestoreView,
         mmRenderResult, mmSelectResultCell, mmJumpToCell, mmHoverCell, mmClearHover,
         setBuildMode, dpRenderVectorIntro, buildMode, mmToggleDetail } from './tab-matmul.js';
import { efInit, efRender, efFwd, efBack, efToggle, efReset, efPause,
         efJumpToPos, efTraceBack, efChangeDim, efToggleDetail, getEfState } from './tab-embed-fwd.js';
import { ebInit, ebRender, ebFwd, ebBack, ebToggle, ebReset, ebPause,
         ebJumpToPos, ebTraceBack, ebChangeDim } from './tab-embed-bwd.js';
import { qInit, qRender, qReset, qApply, qPause, getQState,
         qSelectFn, qApplyClassical, qSelectStoch, qApplyStoch,
         qSetSubTab } from './tab-quantum.js';
import { PRESETS, loadPreset, clearPreset, fullClearPreset, activePreset } from './presets.js';
import { ipInit, ipRender, ipPause, ipReset, ipToggle, ipFwd, ipBack,
         ipEditCell, ipResize, ipToggleDirac } from './tab-inner.js';
import { EINSUM_INFO, renderEinsumBadge, einsumToggleLoops, einsumToggleInfo,
         einsumToggleTorch, einsumCopyTorch, einsumCopyLoops,
         einsumIndexHover, einsumIndexClear, setTorchCodeGenerator } from './einsum-info.js';

// ══════════════════════════════════════════════════
// TIER STATE
// ══════════════════════════════════════════════════
let currentTier = 'blocks';
let lastBlocksMode = 'inner';
let lastEmbedMode = 'embed-fwd';

// ── Register callbacks for shared.js ──
registerCallbacks({
  onDimChange: (oldI, oldJ, oldK) => {
    resizeIntroVecs();
    deselectPreset();

    mmPauseAll();
    resetMmBuildState();
    pauseIntro();
    resetIntroStep();

    if (currentMode === 'matmul') {
      try { rebuildBoxes(); removePlusPlanes(); } catch (e) { /* WebGL unavailable */ }
      applyS1(-1); renderA(-1, -1, -1); renderB(-1, -1, -1);
      document.getElementById('spCollapse').value = 0;
      document.getElementById('spCollapse').disabled = true;
      renderEinsumBadge('einsumMatmul', 'matmul');
    } else {
      clearBoxes();
      removePlusPlanes();
    }
    if (currentMode === 'intro') { renderIntro(); renderEinsumBadge('einsumIntro', 'intro'); }
  },

  onRecompute: () => {
    if (currentMode === 'matmul') {
      mmReset();
      rebuildBoxes(); removePlusPlanes();
      applyS1(-1);
      renderA(-1, -1, -1); renderB(-1, -1, -1);
    }
  }
});

// ══════════════════════════════════════════════════
// TIER SWITCHING
// ══════════════════════════════════════════════════
function setTier(tier) {
  currentTier = tier;
  document.getElementById('tier1-blocks').classList.toggle('active', tier === 'blocks');
  document.getElementById('tier1-matmul').classList.toggle('active', tier === 'matmul');
  document.getElementById('tier1-embed').classList.toggle('active', tier === 'embed');
  document.getElementById('tier1-quantum').classList.toggle('active', tier === 'quantum');
  document.getElementById('tier2-blocks').classList.toggle('hidden', tier !== 'blocks');
  document.getElementById('tier2-matmul').classList.add('hidden'); // single tab, always hidden
  document.getElementById('tier2-embed').classList.toggle('hidden', tier !== 'embed');
  document.getElementById('tier2-quantum').classList.toggle('hidden', tier !== 'quantum');
  const descEl = document.getElementById('presetDesc');
  if (tier !== 'matmul') descEl.classList.add('hidden');
  else if (activePreset) descEl.classList.remove('hidden');

  if (tier === 'blocks') {
    setMode(lastBlocksMode);
  } else if (tier === 'matmul') {
    setMode('matmul');
  } else if (tier === 'quantum') {
    setMode('quantum');
  } else {
    setMode(lastEmbedMode);
  }
}

// ══════════════════════════════════════════════════
// MODE TABS
// ══════════════════════════════════════════════════
function setMode(m) {
  const prev = currentMode;
  setCurrentMode(m);

  if (m === 'inner' || m === 'intro') lastBlocksMode = m;
  if (m === 'embed-fwd' || m === 'embed-bwd') lastEmbedMode = m;

  if (prev === 'inner') ipPause();
  if (prev === 'intro') pauseIntro();
  if (prev === 'matmul') mmPauseAll();
  if (prev === 'embed-fwd') efPause();
  if (prev === 'embed-bwd') ebPause();
  if (prev === 'quantum') qPause();

  const allTabs = ['inner', 'intro', 'matmul', 'embed-fwd', 'embed-bwd', 'quantum'];
  for (const t of allTabs) {
    const tabBtn = document.getElementById('tab-' + t);
    const navBtn = document.getElementById('tab-' + t + '-nav');
    const ctrl = document.getElementById('ctrl-' + t);
    if (tabBtn) tabBtn.classList.toggle('active', m === t);
    if (navBtn) navBtn.classList.toggle('active', m === t);
    if (ctrl) ctrl.classList.toggle('hidden', m !== t);
  }

  // Ensure correct tier is shown
  if ((m === 'inner' || m === 'intro') && currentTier !== 'blocks') {
    currentTier = 'blocks';
    document.getElementById('tier1-blocks').classList.add('active');
    document.getElementById('tier1-matmul').classList.remove('active');
    document.getElementById('tier1-embed').classList.remove('active');
    document.getElementById('tier1-quantum').classList.remove('active');
    document.getElementById('tier2-blocks').classList.remove('hidden');
    document.getElementById('tier2-matmul').classList.add('hidden');
    document.getElementById('tier2-embed').classList.add('hidden');
    document.getElementById('tier2-quantum').classList.add('hidden');
    document.getElementById('presetDesc').classList.add('hidden');
  } else if (m === 'matmul' && currentTier !== 'matmul') {
    currentTier = 'matmul';
    document.getElementById('tier1-matmul').classList.add('active');
    document.getElementById('tier1-blocks').classList.remove('active');
    document.getElementById('tier1-embed').classList.remove('active');
    document.getElementById('tier1-quantum').classList.remove('active');
    document.getElementById('tier2-matmul').classList.add('hidden'); // single tab, always hidden
    document.getElementById('tier2-blocks').classList.add('hidden');
    document.getElementById('tier2-embed').classList.add('hidden');
    document.getElementById('tier2-quantum').classList.add('hidden');
    if (activePreset) document.getElementById('presetDesc').classList.remove('hidden');
  } else if ((m === 'embed-fwd' || m === 'embed-bwd') && currentTier !== 'embed') {
    currentTier = 'embed';
    document.getElementById('tier1-embed').classList.add('active');
    document.getElementById('tier1-blocks').classList.remove('active');
    document.getElementById('tier1-matmul').classList.remove('active');
    document.getElementById('tier1-quantum').classList.remove('active');
    document.getElementById('tier2-embed').classList.remove('hidden');
    document.getElementById('tier2-blocks').classList.add('hidden');
    document.getElementById('tier2-matmul').classList.add('hidden');
    document.getElementById('tier2-quantum').classList.add('hidden');
    document.getElementById('presetDesc').classList.add('hidden');
  } else if (m === 'quantum' && currentTier !== 'quantum') {
    currentTier = 'quantum';
    document.getElementById('tier1-quantum').classList.add('active');
    document.getElementById('tier1-blocks').classList.remove('active');
    document.getElementById('tier1-matmul').classList.remove('active');
    document.getElementById('tier1-embed').classList.remove('active');
    document.getElementById('tier2-blocks').classList.add('hidden');
    document.getElementById('tier2-matmul').classList.add('hidden');
    document.getElementById('tier2-embed').classList.add('hidden');
    document.getElementById('tier2-quantum').classList.remove('hidden');
    document.getElementById('presetDesc').classList.add('hidden');
  }

  if (m === 'inner') {
    ipRender();
    renderEinsumBadge('einsumInner', 'inner');
  }
  if (m === 'matmul') {
    moveCanvasTo('mmCanvasHost');
    rebuildBoxes();
    mmRestoreView();
    renderEinsumBadge('einsumMatmul', 'matmul');
  }
  if (m === 'intro') {
    renderIntro();
    renderEinsumBadge('einsumIntro', 'intro');
  }
  if (m === 'embed-fwd') {
    efRender();
    renderEinsumBadge('einsumEmbedFwd', 'embed-fwd');
  }
  if (m === 'embed-bwd') {
    ebRender();
    renderEinsumBadge('einsumEmbedBwd', 'embed-bwd');
  }
  if (m === 'quantum') {
    qSetSubTab(getQState().qSubTab);
    renderEinsumBadge('einsumQuantum', 'quantum');
  }
  if (infoOpen) updateShelfContent();
}

// ══════════════════════════════════════════════════
// PRESET SYSTEM
// ══════════════════════════════════════════════════
function buildPresetBar() {
  const sel = document.getElementById('presetSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">Example matrices…</option>'
    + PRESETS.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
}

function selectPreset(id) {
  if (!id) { deselectPreset({ clearFills: true }); return; }
  const data = loadPreset(id);
  if (!data) return;

  // 1. Update DOM state BEFORE WebGL operations (safe even if WebGL fails)
  const sel = document.getElementById('presetSelect');
  if (sel) sel.value = id;

  const descEl = document.getElementById('presetDesc');
  if (descEl && data.desc) {
    descEl.innerHTML = data.desc;
    descEl.classList.remove('hidden');
  }

  // 2. Set data, build mode (quiet — no mmReset on stale boxes), and recompute
  setData({ I: data.I, J: data.J, K: data.K, A: data.A, B: data.B, labelA: data.labelA, labelB: data.labelB });

  if (data.buildMode) {
    updateSegControl(data.buildMode);
    setBuildMode(data.buildMode, { quiet: true });
  }

  recomputeFromMatrices({ notify: false });
  mmPauseAll(); resetMmBuildState();

  // 3. Navigate to matmul tab if not already there, then rebuild scene
  if (currentMode !== 'matmul') {
    setMode('matmul');
  } else {
    try { rebuildBoxes(); removePlusPlanes(); } catch (e) { /* WebGL unavailable */ }
    document.getElementById('spCollapse').value = 0;
    document.getElementById('spCollapse').disabled = true;
    applyStep(-1);
    renderA(-1, -1, -1); renderB(-1, -1, -1);
    mmUpdateCanvasTitle();
    renderEinsumBadge('einsumMatmul', 'matmul');
  }
}

function deselectPreset({ clearFills = false } = {}) {
  if (clearFills) fullClearPreset();
  else clearPreset();
  resetLabels();
  const sel = document.getElementById('presetSelect');
  if (sel) sel.value = '';
  const descEl = document.getElementById('presetDesc');
  if (descEl) descEl.classList.add('hidden');
}

// ══════════════════════════════════════════════════
// REBUILD
// ══════════════════════════════════════════════════
function rebuild(rnd) {
  mmPauseAll();
  resetMmBuildState();
  ipPause();
  pauseIntro(); resetIntroStep();
  efPause(); ebPause();
  setBuildComplete(false);

  deselectPreset({ clearFills: true });

  computeData(rnd);
  ipInit(rnd);
  initIntroVecs(rnd);
  efInit(rnd);
  ebInit(rnd);
  qInit();

  if (currentMode === 'matmul') {
    rebuildBoxes();
    removePlusPlanes();
  } else {
    clearBoxes();
    removePlusPlanes();
  }

  document.getElementById('spCollapse').value = 0;
  document.getElementById('spCollapse').disabled = true;

  renderA(-1, -1, -1); renderB(-1, -1, -1);
  applyS1(-1);
  if (currentMode === 'inner') { ipRender(); renderEinsumBadge('einsumInner', 'inner'); }
  if (currentMode === 'intro') { renderIntro(); renderEinsumBadge('einsumIntro', 'intro'); }
  if (currentMode === 'matmul') { renderEinsumBadge('einsumMatmul', 'matmul'); }
  if (currentMode === 'embed-fwd') { efRender(); renderEinsumBadge('einsumEmbedFwd', 'embed-fwd'); }
  if (currentMode === 'embed-bwd') { ebRender(); renderEinsumBadge('einsumEmbedBwd', 'embed-bwd'); }
  if (currentMode === 'quantum') { qRender(); renderEinsumBadge('einsumQuantum', 'quantum'); }
}

// ══════════════════════════════════════════════════
// COPY PYTORCH CODE
// ══════════════════════════════════════════════════
export function getTorchCode(tab) {
  let code = 'import torch\n';
  if (tab === 'inner') {
    code += `a = torch.tensor([1., 2., 3.])\n`;
    code += `b = torch.tensor([4., 5., 6.])\n`;
    code += `result = torch.dot(a, b)  # or torch.einsum('i,i->', a, b)\n`;
  } else if (tab === 'intro') {
    const aVals = introA.join(', ');
    const bVals = introB.join(', ');
    code += `a = torch.tensor([${aVals}])\n`;
    code += `b = torch.tensor([${bVals}])\n`;
    code += `result = torch.einsum('i,k->ik', a, b)\n`;
  } else if (tab === 'embed-fwd') {
    code += `import torch.nn.functional as F\n\n`;
    code += `# Embedding forward: one-hot × weight = row lookup\n`;
    code += `B, T, V, C = 2, 3, 4, 3  # batch, time, vocab, channels\n`;
    code += `tokens = torch.randint(0, V, (B, T))\n`;
    code += `X = F.one_hot(tokens, V).float()  # (B, T, V)\n`;
    code += `W = torch.randn(V, C)\n\n`;
    code += `# These are equivalent:\n`;
    code += `Y_einsum = torch.einsum('btv,vc->btc', X, W)\n`;
    code += `Y_lookup = W[tokens]  # simple row selection\n`;
    code += `assert torch.allclose(Y_einsum, Y_lookup)\n`;
  } else if (tab === 'embed-bwd') {
    code += `import torch.nn.functional as F\n\n`;
    code += `# Embedding backward: scatter gradients into weight update\n`;
    code += `B, T, V, C = 2, 3, 4, 3  # batch, time, vocab, channels\n`;
    code += `tokens = torch.randint(0, V, (B, T))\n`;
    code += `X = F.one_hot(tokens, V).float()  # (B, T, V)\n`;
    code += `G = torch.randn(B, T, C)  # upstream gradients\n\n`;
    code += `# Weight gradient via einsum:\n`;
    code += `dW = torch.einsum('btv,btc->vc', X, G)\n`;
    code += `# Equivalent scatter-add:\n`;
    code += `dW2 = torch.zeros(V, C)\n`;
    code += `dW2.index_add_(0, tokens.reshape(-1), G.reshape(-1, C))\n`;
    code += `assert torch.allclose(dW, dW2)\n`;
  } else if (tab === 'quantum') {
    code += `# Single-qubit classical gates in Dirac notation\n`;
    code += `# |ψ⟩ = α|0⟩ + β|1⟩ as a column vector [α, β]\n\n`;
    code += `ket0 = torch.tensor([1., 0.])  # |0⟩\n`;
    code += `ket1 = torch.tensor([0., 1.])  # |1⟩\n\n`;
    code += `I = torch.tensor([[1., 0.], [0., 1.]])   # Identity\n`;
    code += `X = torch.tensor([[0., 1.], [1., 0.]])   # NOT / Pauli-X\n`;
    code += `Z = torch.tensor([[1., 0.], [0.,-1.]])   # Phase flip / Pauli-Z\n\n`;
    code += `# Apply a gate: U|ψ⟩ is matrix-vector multiplication\n`;
    code += `psi = X @ ket0                              # X|0⟩ = |1⟩\n`;
    code += `psi_einsum = torch.einsum('ij,j->i', X, ket0)  # equivalent\n`;
    code += `assert torch.allclose(psi, ket1)\n\n`;
    code += `# Inner product ⟨φ|ψ⟩ is the dot product:\n`;
    code += `print(torch.dot(ket0, ket1))  # 0 — orthogonal\n`;
    code += `print(torch.dot(ket0, ket0))  # 1 — normalized\n`;
  } else {
    const aRows = [];
    for (let i = 0; i < I; i++) {
      const row = [];
      for (let j = 0; j < J; j++) row.push(A[i][j]);
      aRows.push('[' + row.join(', ') + ']');
    }
    const bRows = [];
    for (let j = 0; j < J; j++) {
      const row = [];
      for (let k = 0; k < K; k++) row.push(B[j][k]);
      bRows.push('[' + row.join(', ') + ']');
    }
    code += `A = torch.tensor([${aRows.join(', ')}])\n`;
    code += `B = torch.tensor([${bRows.join(', ')}])\n`;
    code += `result = A @ B  # or torch.einsum('ij,jk->ik', A, B)\n`;
  }
  return code;
}

// Register the torch code generator for the einsum badge panels
setTorchCodeGenerator(getTorchCode);

// ── renderEinsumBadge, einsumToggleLoops, einsumCopyLoops,
// ── einsumIndexHover, einsumIndexClear → imported from einsum-info.js

// ── Shelf content routing ──
function updateShelfContent() {
  const el = document.getElementById('shelfContent');
  if (!el) return;
  if (currentMode === 'inner') {
    el.innerHTML =
      `<div class="broadcast-rules">`
      + `<strong>Inner (dot) product</strong>`
      + `<p style="margin-top:6px">The dot product of two vectors: multiply matching elements, then sum to a scalar.</p>`
      + `<p style="margin-top:4px"><strong>a · b = Σᵢ a[i] × b[i]</strong></p>`
      + `<p style="margin-top:6px">This is the fundamental building block of matrix multiplication — each cell of A @ B is the dot product of a row of A and a column of B.</p>`
      + `<p style="margin-top:6px;font-size:0.68rem;color:#999;font-style:italic">In einsum notation, repeated indices with no output = contraction (summation).</p>`
      + `</div>`;
  } else if (currentMode === 'intro') {
    el.innerHTML =
      `<div class="broadcast-rules">`
      + `<strong>Broadcasting rules</strong> (NumPy / PyTorch):`
      + `<ol>`
      + `<li>Right-align the shapes</li>`
      + `<li>Dimensions of size 1 stretch to match</li>`
      + `<li>Missing dimensions are treated as size 1</li>`
      + `</ol>`
      + `<p style="margin-top:6px"><strong><code>None</code> / <code>np.newaxis</code></strong> adds a size-1 dimension:</p>`
      + `<ul style="font-size:0.70rem;color:#666;margin:4px 0 0 1.2em"><li><code>a[:, None]</code> reshapes <code>(I,)</code> → <code>(I, 1)</code></li>`
      + `<li><code>b[None, :]</code> reshapes <code>(K,)</code> → <code>(1, K)</code></li></ul>`
      + `<p style="margin-top:4px;font-size:0.68rem;color:#999">Once both have compatible shapes, NumPy/PyTorch broadcasts the size-1 dimensions to match.</p>`
      + `<div class="sidebar-link" style="margin-top:6px">See also: <a href="https://github.com/srush/Tensor-Puzzles" target="_blank">Sasha Rush's Tensor Puzzles</a></div>`
      + `</div>`;
  } else if (currentMode === 'matmul') {
    el.innerHTML =
      `<div class="broadcast-rules">`
      + `<strong>Matrix multiply perspectives</strong>`
      + `<p style="margin-top:6px"><strong>Outer product:</strong> Result = &Sigma;<sub>j</sub> A[:,j] &otimes; B[j,:] — each slice j is one rank-1 outer product.</p>`
      + `<p style="margin-top:6px"><strong>Dot product:</strong> Result[i,k] = A[i,:] &middot; B[:,k] — each cell is a row-column dot product.</p>`
      + `<p style="margin-top:6px">Both perspectives build the same 3D cube Cube[i,j,k] = A[i,j]&times;B[j,k]. The outer product fills it slice by slice (along j); the dot product fills it column by column (along i,k). Collapsing sums along j to produce the result.</p>`
      + `<p style="margin-top:6px;font-size:0.68rem;color:#999;font-style:italic">The rank-1 decomposition is key to LoRA and attention head analysis. The dot product view is the standard algorithm.</p>`
      + `</div>`;
  } else if (currentMode === 'embed-fwd') {
    el.innerHTML =
      `<div class="broadcast-rules">`
      + `<strong>Embedding Forward: btv,vc→btc</strong>`
      + `<p style="margin-top:6px">Each token is a one-hot vector. Multiplying by the embedding table W selects a row — embedding lookup <em>is</em> matrix multiplication.</p>`
      + `<p style="margin-top:6px"><code>Y[b,t,:] = X[b,t,:] @ W = W[token_id, :]</code></p>`
      + `<p style="margin-top:6px">The einsum contracts over <strong>v</strong> (vocab size). Since X is one-hot, all but one term in that sum is zero — the "matrix multiply" collapses to copying a single row of W.</p>`
      + `<p style="margin-top:6px;font-size:0.68rem;color:#999;font-style:italic"><strong>Notation:</strong> We follow Karpathy's <a href="https://github.com/karpathy/nanochat/blob/master/nanochat/gpt.py#L83" target="_blank" style="color:#69c"><code>B, T, C = x.size()</code></a>: `
      + `<strong>B</strong>=batch, <strong>T</strong>=sequence position, <strong>C</strong>=embedding channels. `
      + `<strong>V</strong>=vocab size. We reserve <strong>h</strong> for attention heads (as in the <a href="https://arxiv.org/abs/1706.03762" target="_blank" style="color:#69c">original transformer paper</a>). `
      + `You'll also see <strong>l</strong> for sequence length (<a href="https://github.com/pixqc/einsum-puzzles/blob/master/main.ipynb" target="_blank" style="color:#69c">einsum-puzzles</a>) and <strong>S,N,E</strong> in <a href="https://docs.pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html" target="_blank" style="color:#69c">PyTorch docs</a>.</p>`
      + `</div>`;
  } else if (currentMode === 'embed-bwd') {
    el.innerHTML =
      `<div class="broadcast-rules">`
      + `<strong>Embedding Backward: btv,btc→vc</strong>`
      + `<p style="margin-top:6px">The weight gradient accumulates upstream gradients: each position scatters its gradient to the row of its token.</p>`
      + `<p style="margin-top:6px"><code>dW[v,:] = Σ G[b,t,:] for all (b,t) where token==v</code></p>`
      + `<p style="margin-top:6px">This is the reverse of forward's "gather" — forward selects rows, backward <em>scatters</em> gradients back. Rare tokens get smaller updates (fewer terms in the sum).</p>`
      + `<p style="margin-top:6px;font-size:0.68rem;color:#999;font-style:italic">Each position contributes a rank-1 outer product X[b,t,:]⊗G[b,t,:]. The weight update is a sum of these rank-1 terms — the same structure as the Outer Product View.</p>`
      + `</div>`;
  } else if (currentMode === 'quantum') {
    el.innerHTML =
      `<div class="broadcast-rules">`
      + `<strong>Dirac notation — classical → quantum</strong>`
      + `<p style="margin-top:6px"><strong>Kets &amp; bras:</strong> <code>|x⟩</code> is a column vector, <code>⟨x|</code> is its row-vector transpose. The basis <code>|0⟩</code>, <code>|1⟩</code> encodes one bit.</p>`
      + `<p style="margin-top:6px"><strong>Inner product:</strong> <code>⟨a|b⟩ = δ<sub>ab</sub></code> (1 when equal, else 0). Acts as an indicator / dot product.</p>`
      + `<p style="margin-top:6px"><strong>Outer product:</strong> <code>|a⟩⟨b|</code> is a matrix with a single 1 at (a, b).</p>`
      + `<p style="margin-top:6px"><strong>Deterministic ops:</strong> any function <code>f: Σ→Σ</code> becomes a matrix <code>M = Σ<sub>b</sub> |f(b)⟩⟨b|</code>. Then <code>M|a⟩ = |f(a)⟩</code> because <code>⟨b|a⟩</code> selects b = a.</p>`
      + `<p style="margin-top:6px"><strong>Quantum gates:</strong> same outer-product form but coefficients can be negative. <code>Z = |0⟩⟨0| − |1⟩⟨1|</code> — the −1 is where classical ends.</p>`
      + `<p style="margin-top:6px;font-size:0.68rem;color:#999;font-style:italic">Einsum: <code>U|ψ⟩ = ij,j→i</code>. The Inner and Outer tabs have a "Dirac" toggle for the same operations in bra-ket notation.</p>`
      + `</div>`;
  }
}
setOnShelfOpen(updateShelfContent);

// ══════════════════════════════════════════════════
// RIGHT-SIDE RULES DRAWER
// ══════════════════════════════════════════════════
let rulesOpen = false;
function toggleRules() {
  rulesOpen = !rulesOpen;
  const shelf = document.getElementById('rulesShelf');
  const handle = document.getElementById('rulesShelfHandle');
  const backdrop = document.getElementById('rulesShelfBackdrop');
  if (shelf) shelf.classList.toggle('open', rulesOpen);
  if (handle) handle.classList.toggle('open', rulesOpen);
  if (backdrop) backdrop.classList.toggle('open', rulesOpen);
}

function updateSegControl(mode) {
  document.querySelectorAll('#buildModeToggle label').forEach(lbl => {
    const radio = lbl.querySelector('input[type="radio"]');
    lbl.classList.toggle('seg-active', radio.value === mode);
    radio.checked = radio.value === mode;
  });
}
window.updateSegControl = updateSegControl;

// ── Wire up window globals for HTML onclick handlers ──
window.rebuild = rebuild;
window.setMode = setMode;
window.setTier = setTier;
window.selectPreset = selectPreset;
window.toggleInfo = toggleInfo;
window.toggleRules = toggleRules;
window.changeDim = changeDim;
// Building Blocks — Inner Product
window.ipFwd = ipFwd;
window.ipBack = ipBack;
window.ipToggle = ipToggle;
window.ipReset = ipReset;
window.ipEditCell = ipEditCell;
window.ipResize = ipResize;
window.ipToggleDirac = ipToggleDirac;
// Building Blocks — Outer Product
window.stepFwdIntro = stepFwdIntro;
window.stepBackIntro = stepBackIntro;
window.togglePlayIntro = togglePlayIntro;
window.resetIntro = resetIntro;
window.introEditCell = introEditCell;
window.introHover = introHover;
window.introClearHover = introClearHover;
window.introToggleDirac = introToggleDirac;
// Matrix Multiply
window.mmBack = mmBack;
window.mmFwd = mmFwd;
window.mmToggle = mmToggle;
window.mmReset = mmReset;
window.mmScrubCollapse = mmScrubCollapse;
window.mmRenderResult = mmRenderResult;
window.mmSelectResultCell = mmSelectResultCell;
window.mmJumpToCell = mmJumpToCell;
window.mmHoverCell = mmHoverCell;
window.mmClearHover = mmClearHover;
window.mmToggleDetail = mmToggleDetail;
window.setBuildMode = (mode) => {
  setBuildMode(mode);
  updateSegControl(mode);
};
// Embedding Forward (hidden, kept for future use)
window.efFwd = efFwd;
window.efBack = efBack;
window.efToggle = efToggle;
window.efReset = efReset;
window.efJumpToPos = efJumpToPos;
window.efTraceBack = efTraceBack;
window.efChangeDim = efChangeDim;
window.efToggleDetail = efToggleDetail;
window.getEfState = getEfState;
// Embedding Backward (hidden, kept for future use)
window.ebFwd = ebFwd;
window.ebBack = ebBack;
window.ebToggle = ebToggle;
window.ebReset = ebReset;
window.ebJumpToPos = ebJumpToPos;
window.ebTraceBack = ebTraceBack;
window.ebChangeDim = ebChangeDim;
// Dirac tab: sub-tab switching + per-section handlers
window.qSetSubTab = qSetSubTab;
window.qApply = qApply;
window.qReset = qReset;
window.qSelectFn = qSelectFn;
window.qApplyClassical = qApplyClassical;
window.qSelectStoch = qSelectStoch;
window.qApplyStoch = qApplyStoch;
// Snap-back
window.snapToDefault = snapToDefault;
window.toggleAxisLabels = toggleAxisLabels;
// Einsum info
window.einsumToggleTorch = einsumToggleTorch;
window.einsumCopyTorch = einsumCopyTorch;
window.einsumToggleLoops = einsumToggleLoops;
window.einsumToggleInfo = einsumToggleInfo;
window.einsumCopyLoops = einsumCopyLoops;

// ── Init ──
buildPresetBar();
rebuild(true);

// ── URL query parameter deep linking ──
// Supports: ?tab=matmul&preset=identity&mode=dot
// tab: inner, intro, matmul, embed-fwd, embed-bwd, quantum
// preset: any preset id (basic, identity, row-select, etc.)
// mode: outer, dot (build mode for matmul tab)
function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const preset = params.get('preset');
  const mode = params.get('mode');
  const validMode = mode === 'outer' || mode === 'dot';

  // If preset is specified, go straight to matmul with preset
  if (preset) {
    try { setMode('matmul'); } catch (e) { /* WebGL unavailable */ }
    if (validMode) {
      setBuildMode(mode, { quiet: true });
      updateSegControl(mode);
    }
    selectPreset(preset);
    // Override preset's default build mode if mode param was specified
    if (validMode) {
      setBuildMode(mode, { quiet: true });
      updateSegControl(mode);
    }
    return;
  }

  // Navigate to requested tab (defaults to 'inner')
  try { setMode(tab || 'inner'); } catch (e) { /* WebGL unavailable */ }

  // Set build mode (only meaningful on matmul tab)
  if (validMode) {
    setBuildMode(mode, { quiet: true });
    updateSegControl(mode);
  }
}
applyUrlParams();
