// ══════════════════════════════════════════════════
// APP — ENTRY POINT, MODE SWITCHING, INIT
// ══════════════════════════════════════════════════
import { I, J, K, A, B, currentMode, setCurrentMode, computeData, changeDim,
         registerCallbacks, toggleInfo, recomputeFromMatrices, resetLabels,
         setData, infoOpen, setOnShelfOpen, setBuildComplete } from './shared.js';
import { sc, initScene, moveCanvasTo, snapToDefault } from './scene.js';
import { boxes, rebuildBoxes, addPlusPlanes, removePlusPlanes, ensureAllGreen, clearBoxes } from './cube-manager.js';
import { initIntroVecs, renderIntro, pauseIntro, resetIntroStep,
         resizeIntroVecs, stepFwdIntro, stepBackIntro, togglePlayIntro, resetIntro,
         introEditCell, introHover, introClearHover } from './tab-intro.js';
import { mmPauseAll, mmReset, mmToggle, mmFwd, mmBack, mmScrubCollapse,
         resetMmBuildState, applyS1, applyStep, renderA, renderB,
         mmUpdateCanvasTitle, collapseT, mmPhase, applyCollapse, mmRestoreView,
         mmRenderResult, mmSelectResultCell, mmJumpToCell, mmHoverCell, mmClearHover,
         setBuildMode, dpRenderVectorIntro, buildMode, mmToggleDetail } from './tab-matmul.js';
import { efInit, efRender, efFwd, efBack, efToggle, efReset, efPause,
         efJumpToPos, efTraceBack, efChangeDim, efToggleDetail, getEfState } from './tab-embed-fwd.js';
import { ebInit, ebRender, ebFwd, ebBack, ebToggle, ebReset, ebPause,
         ebJumpToPos, ebTraceBack, ebChangeDim } from './tab-embed-bwd.js';
import { PRESETS, loadPreset, clearPreset, fullClearPreset, activePreset } from './presets.js';
import { ipInit, ipRender, ipPause, ipReset, ipToggle, ipFwd, ipBack,
         ipEditCell, ipResize } from './tab-inner.js';

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
  document.getElementById('tier2-blocks').classList.toggle('hidden', tier !== 'blocks');
  document.getElementById('tier2-matmul').classList.add('hidden'); // single tab, always hidden
  document.getElementById('tier2-embed').classList.toggle('hidden', tier !== 'embed');
  const descEl = document.getElementById('presetDesc');
  if (tier !== 'matmul') descEl.classList.add('hidden');
  else if (activePreset) descEl.classList.remove('hidden');

  if (tier === 'blocks') {
    setMode(lastBlocksMode);
  } else if (tier === 'matmul') {
    setMode('matmul');
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

  const allTabs = ['inner', 'intro', 'matmul', 'embed-fwd', 'embed-bwd'];
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
    document.getElementById('tier2-blocks').classList.remove('hidden');
    document.getElementById('tier2-matmul').classList.add('hidden');
    document.getElementById('tier2-embed').classList.add('hidden');
    document.getElementById('presetDesc').classList.add('hidden');
  } else if (m === 'matmul' && currentTier !== 'matmul') {
    currentTier = 'matmul';
    document.getElementById('tier1-matmul').classList.add('active');
    document.getElementById('tier1-blocks').classList.remove('active');
    document.getElementById('tier1-embed').classList.remove('active');
    document.getElementById('tier2-matmul').classList.add('hidden'); // single tab, always hidden
    document.getElementById('tier2-blocks').classList.add('hidden');
    document.getElementById('tier2-embed').classList.add('hidden');
    if (activePreset) document.getElementById('presetDesc').classList.remove('hidden');
  } else if ((m === 'embed-fwd' || m === 'embed-bwd') && currentTier !== 'embed') {
    currentTier = 'embed';
    document.getElementById('tier1-embed').classList.add('active');
    document.getElementById('tier1-blocks').classList.remove('active');
    document.getElementById('tier1-matmul').classList.remove('active');
    document.getElementById('tier2-embed').classList.remove('hidden');
    document.getElementById('tier2-blocks').classList.add('hidden');
    document.getElementById('tier2-matmul').classList.add('hidden');
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

  // 3. Rebuild scene and render initial state
  if (currentMode === 'matmul') {
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
}

// ══════════════════════════════════════════════════
// COPY PYTORCH CODE
// ══════════════════════════════════════════════════
export function copyTorchCode(tab) {
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
    code += `B, L, H, C = 2, 3, 4, 3\n`;
    code += `tokens = torch.randint(0, H, (B, L))\n`;
    code += `X = F.one_hot(tokens, H).float()  # (B, L, H)\n`;
    code += `W = torch.randn(H, C)\n\n`;
    code += `# These are equivalent:\n`;
    code += `Y_einsum = torch.einsum('blh,hc->blc', X, W)\n`;
    code += `Y_lookup = W[tokens]  # simple row selection\n`;
    code += `assert torch.allclose(Y_einsum, Y_lookup)\n`;
  } else if (tab === 'embed-bwd') {
    code += `import torch.nn.functional as F\n\n`;
    code += `# Embedding backward: scatter gradients into weight update\n`;
    code += `B, L, H, C = 2, 3, 4, 3\n`;
    code += `tokens = torch.randint(0, H, (B, L))\n`;
    code += `X = F.one_hot(tokens, H).float()  # (B, L, H)\n`;
    code += `G = torch.randn(B, L, C)  # upstream gradients\n\n`;
    code += `# Weight gradient via einsum:\n`;
    code += `dW = torch.einsum('blh,blc->hc', X, G)\n`;
    code += `# Equivalent scatter-add:\n`;
    code += `dW2 = torch.zeros(H, C)\n`;
    code += `dW2.index_add_(0, tokens.reshape(-1), G.reshape(-1, C))\n`;
    code += `assert torch.allclose(dW, dW2)\n`;
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
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.querySelector('.copy-torch-btn.active-tab');
    if (btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = '📋 torch'; }, 1200);
    }
  });
}

// ══════════════════════════════════════════════════
// EINSUM BADGE RENDERER
// ══════════════════════════════════════════════════
export function renderEinsumBadge(containerId, tab) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (tab === 'inner') {
    el.innerHTML = `einsum('<span class="ei-contract">i</span>, <span class="ei-contract">i</span> → ', a, b)`;
  } else if (tab === 'intro') {
    el.innerHTML = `einsum('<span class="ei-free">i</span>, <span class="ei-free">k</span> → <span class="ei-free">ik</span>', a, b)`;
  } else if (tab === 'matmul') {
    el.innerHTML = `einsum('<span class="ei-free">i</span><span class="ei-contract">j</span>, <span class="ei-contract">j</span><span class="ei-free">k</span> → <span class="ei-free">ik</span>', A, B)`;
  } else if (tab === 'embed-fwd') {
    el.innerHTML = `einsum('<span class="ei-free">b</span><span class="ei-free">l</span><span class="ei-contract">h</span>, <span class="ei-contract">h</span><span class="ei-free">c</span> → <span class="ei-free">b</span><span class="ei-free">l</span><span class="ei-free">c</span>', X, W)`;
  } else if (tab === 'embed-bwd') {
    el.innerHTML = `einsum('<span class="ei-contract">b</span><span class="ei-contract">l</span><span class="ei-free">h</span>, <span class="ei-contract">b</span><span class="ei-contract">l</span><span class="ei-free">c</span> → <span class="ei-free">h</span><span class="ei-free">c</span>', X, G)`;
  }
  document.querySelectorAll('.copy-torch-btn.active-tab').forEach(b => b.classList.remove('active-tab'));
  el.innerHTML += ` <button class="copy-torch-btn active-tab" onclick="copyTorchCode('${tab}')">📋 torch</button>`;
}

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
      + `<strong>Embedding Forward: blh,hc→blc</strong>`
      + `<p style="margin-top:6px">Each token is a one-hot vector. Multiplying by the embedding table W selects a row — embedding lookup <em>is</em> matrix multiplication.</p>`
      + `<p style="margin-top:6px"><code>Y[b,l,:] = X[b,l,:] @ W = W[token_id, :]</code></p>`
      + `<p style="margin-top:6px;font-size:0.68rem;color:#999;font-style:italic">This is nn.Embedding forward from Karpathy's makemore Part 4. The contraction over h is the "lookup" — only the h=token_id term survives.</p>`
      + `</div>`;
  } else if (currentMode === 'embed-bwd') {
    el.innerHTML =
      `<div class="broadcast-rules">`
      + `<strong>Embedding Backward: blh,blc→hc</strong>`
      + `<p style="margin-top:6px">The weight gradient accumulates upstream gradients: each position scatters its gradient to the row of its token.</p>`
      + `<p style="margin-top:6px"><code>dW[h,:] = Σ G[b,l,:] for all (b,l) where token==h</code></p>`
      + `<p style="margin-top:6px">This is the reverse of forward's "gather" — forward selects rows, backward <em>scatters</em> gradients back. Rare tokens get smaller updates (fewer terms in the sum).</p>`
      + `<p style="margin-top:6px;font-size:0.68rem;color:#999;font-style:italic">Each position contributes a rank-1 outer product X[b,l,:]⊗G[b,l,:]. The weight update is a sum of these rank-1 terms — the same structure as the Outer Product View.</p>`
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
// Building Blocks — Outer Product
window.stepFwdIntro = stepFwdIntro;
window.stepBackIntro = stepBackIntro;
window.togglePlayIntro = togglePlayIntro;
window.resetIntro = resetIntro;
window.introEditCell = introEditCell;
window.introHover = introHover;
window.introClearHover = introClearHover;
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
// Snap-back
window.snapToDefault = snapToDefault;
// Copy torch code
window.copyTorchCode = copyTorchCode;

// ── Init ──
buildPresetBar();
rebuild(true);
setMode('inner');
