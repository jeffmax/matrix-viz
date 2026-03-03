// ══════════════════════════════════════════════════
// APP — ENTRY POINT, MODE SWITCHING, INIT
// ══════════════════════════════════════════════════
import { I, J, K, A, B, currentMode, setCurrentMode, computeData, changeDim,
         registerCallbacks, toggleInfo, recomputeFromMatrices, resetLabels,
         setData, infoOpen, setOnShelfOpen } from './shared.js';
import { sc, initScene, moveCanvasTo, snapToDefault } from './scene.js';
import { boxes, rebuildBoxes, addPlusPlanes, removePlusPlanes, ensureAllGreen, clearBoxes } from './cube-manager.js';
import { introA, introB, initIntroVecs, renderIntro, pauseIntro, resetIntroStep,
         resizeIntroVecs, stepFwdIntro, stepBackIntro, togglePlayIntro, resetIntro,
         introEditCell, introHover, introClearHover } from './tab-intro.js';
import { mmPauseAll, mmReset, mmToggle, mmFwd, mmBack, mmScrubCollapse,
         resetMmBuildState, applyS1, renderA, renderB, carryIntroToMatmul,
         mmUpdateCanvasTitle, collapseT, mmPhase, applyCollapse, mmRestoreView } from './tab-matmul.js';
import { dpPause, dpRenderAll, dpReset, dpApplyCollapse, dpScrubCollapse,
         dpToggle, dpFwd, dpBack, dpJumpToCell,
         resetDpState, dpCollapseT, setDpCollapseT,
         dpRenderVectorIntro, dpHoverCell, dpClearHover } from './tab-dotprod.js';
import { efInit, efRender, efFwd, efBack, efToggle, efReset, efPause,
         efJumpToPos, efTraceBack, efChangeDim } from './tab-embed-fwd.js';
import { ebInit, ebRender, ebFwd, ebBack, ebToggle, ebReset, ebPause,
         ebJumpToPos, ebTraceBack, ebChangeDim } from './tab-embed-bwd.js';
import { PRESETS, loadPreset, clearPreset, activePreset } from './presets.js';
import { ipInit, ipRender, ipPause, ipReset, ipToggle, ipFwd, ipBack,
         ipEditCell, ipResize } from './tab-inner.js';

// ══════════════════════════════════════════════════
// TIER STATE
// ══════════════════════════════════════════════════
let currentTier = 'blocks';
let lastBlocksMode = 'inner';   // remember last sub-tab per tier
let lastMatmulMode = 'matmul';

// ── Register callbacks for shared.js ──
registerCallbacks({
  onDimChange: (oldI, oldJ, oldK) => {
    // Resize intro vectors
    resizeIntroVecs();
    // Clear preset on dimension change
    deselectPreset();

    // Reset animation state across all tabs
    mmPauseAll();
    resetMmBuildState();
    pauseIntro();
    resetIntroStep();
    dpPause();
    resetDpState();

    if (currentMode === 'matmul') {
      rebuildBoxes(); removePlusPlanes();
      applyS1(-1); renderA(-1, -1, -1); renderB(-1, -1, -1);
      document.getElementById('spCollapse').value = 0;
      document.getElementById('spCollapse').disabled = true;
      renderEinsumBadge('einsumMatmul', 'matmul');
    } else if (currentMode === 'dotprod') {
      rebuildBoxes(); removePlusPlanes();
      ensureAllGreen(); addPlusPlanes();
      dpRenderAll(); renderEinsumBadge('einsumDotprod', 'dotprod');
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
    } else if (currentMode === 'dotprod') {
      dpReset();
      dpRenderAll();
    }
  }
});

// ══════════════════════════════════════════════════
// TIER SWITCHING
// ══════════════════════════════════════════════════
function setTier(tier) {
  currentTier = tier;
  // Update tier1 buttons
  document.getElementById('tier1-blocks').classList.toggle('active', tier === 'blocks');
  document.getElementById('tier1-matmul').classList.toggle('active', tier === 'matmul');
  // Show/hide tier2 rows
  document.getElementById('tier2-blocks').classList.toggle('hidden', tier !== 'blocks');
  document.getElementById('tier2-matmul').classList.toggle('hidden', tier !== 'matmul');
  // Show/hide preset bar
  document.getElementById('presetBar').classList.toggle('hidden', tier !== 'matmul');
  const descEl = document.getElementById('presetDesc');
  if (tier !== 'matmul') descEl.classList.add('hidden');
  else if (activePreset) descEl.classList.remove('hidden');

  // Switch to last-used sub-tab for this tier
  if (tier === 'blocks') {
    setMode(lastBlocksMode);
  } else {
    setMode(lastMatmulMode);
  }
}

// ══════════════════════════════════════════════════
// MODE TABS
// ══════════════════════════════════════════════════
function setMode(m) {
  const prev = currentMode;
  setCurrentMode(m);

  // Track last sub-tab per tier
  if (m === 'inner' || m === 'intro') lastBlocksMode = m;
  if (m === 'matmul' || m === 'dotprod') lastMatmulMode = m;

  if (prev === 'inner') ipPause();
  if (prev === 'intro') pauseIntro();
  if (prev === 'dotprod') dpPause();
  if (prev === 'matmul') mmPauseAll();
  if (prev === 'embed-fwd') efPause();
  if (prev === 'embed-bwd') ebPause();

  const allTabs = ['inner', 'intro', 'dotprod', 'matmul', 'embed-fwd', 'embed-bwd'];
  for (const t of allTabs) {
    const tabBtn = document.getElementById('tab-' + t);
    const ctrl = document.getElementById('ctrl-' + t);
    if (tabBtn) tabBtn.classList.toggle('active', m === t);
    if (ctrl) ctrl.classList.toggle('hidden', m !== t);
  }

  // Ensure correct tier is shown
  if ((m === 'inner' || m === 'intro') && currentTier !== 'blocks') {
    currentTier = 'blocks';
    document.getElementById('tier1-blocks').classList.add('active');
    document.getElementById('tier1-matmul').classList.remove('active');
    document.getElementById('tier2-blocks').classList.remove('hidden');
    document.getElementById('tier2-matmul').classList.add('hidden');
    document.getElementById('presetBar').classList.add('hidden');
    document.getElementById('presetDesc').classList.add('hidden');
  } else if ((m === 'matmul' || m === 'dotprod') && currentTier !== 'matmul') {
    currentTier = 'matmul';
    document.getElementById('tier1-matmul').classList.add('active');
    document.getElementById('tier1-blocks').classList.remove('active');
    document.getElementById('tier2-matmul').classList.remove('hidden');
    document.getElementById('tier2-blocks').classList.add('hidden');
    document.getElementById('presetBar').classList.remove('hidden');
    if (activePreset) document.getElementById('presetDesc').classList.remove('hidden');
  }

  const introCarry = prev === 'intro' && (m === 'matmul' || m === 'dotprod') && introA.length > 0;
  if (introCarry) {
    carryIntroToMatmul(introA, introB);
  }

  if (m === 'inner') {
    ipRender();
    renderEinsumBadge('einsumInner', 'inner');
  }
  if (m === 'matmul') {
    moveCanvasTo('mmCanvasHost');
    if (introCarry) {
      mmPauseAll();
      resetMmBuildState();
      document.getElementById('spCollapse').disabled = true;
      document.getElementById('spCollapse').value = 0;
      rebuildBoxes(); removePlusPlanes();
      applyS1(-1);
      renderA(-1, -1, -1); renderB(-1, -1, -1);
      mmUpdateCanvasTitle();
    } else {
      rebuildBoxes();
      mmRestoreView();
    }
    renderEinsumBadge('einsumMatmul', 'matmul');
  }
  if (m === 'intro') {
    renderIntro();
    renderEinsumBadge('einsumIntro', 'intro');
  }
  if (m === 'dotprod') {
    moveCanvasTo('dpCanvasHost');
    if (!sc) initScene();
    if (!boxes.length) rebuildBoxes();
    removePlusPlanes();
    const savedT = dpCollapseT;
    const dpSlider = document.getElementById('dpCollapseSlider');
    if (dpSlider) dpSlider.value = Math.round(savedT * 1000);
    ensureAllGreen();
    setDpCollapseT(savedT);
    dpApplyCollapse(savedT);
    renderEinsumBadge('einsumDotprod', 'dotprod');
    dpRenderAll();
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
  const bar = document.getElementById('presetBar');
  if (!bar) return;
  bar.innerHTML = PRESETS.map(p =>
    `<button class="preset-pill" id="preset-${p.id}" onclick="selectPreset('${p.id}')">${p.label}</button>`
  ).join('');
}

function selectPreset(id) {
  const data = loadPreset(id);
  if (!data) return;

  // Update shared state with preset data
  setData({ I: data.I, J: data.J, K: data.K, A: data.A, B: data.B, labelA: data.labelA, labelB: data.labelB });
  recomputeFromMatrices();

  // Reset animation state
  mmPauseAll(); resetMmBuildState();
  dpPause(); resetDpState();

  // Rebuild 3D if on a matmul tab
  if (currentMode === 'matmul' || currentMode === 'dotprod') {
    rebuildBoxes(); removePlusPlanes();
    if (currentMode === 'matmul') {
      document.getElementById('spCollapse').value = 0;
      document.getElementById('spCollapse').disabled = true;
      applyS1(-1); renderA(-1, -1, -1); renderB(-1, -1, -1);
      mmUpdateCanvasTitle();
      renderEinsumBadge('einsumMatmul', 'matmul');
    } else {
      ensureAllGreen(); addPlusPlanes();
      dpRenderAll();
      renderEinsumBadge('einsumDotprod', 'dotprod');
    }
  }

  // Update preset pill highlights
  document.querySelectorAll('.preset-pill').forEach(el => el.classList.remove('active'));
  const pill = document.getElementById('preset-' + id);
  if (pill) pill.classList.add('active');

  // Show description
  const descEl = document.getElementById('presetDesc');
  if (descEl && data.desc) {
    descEl.innerHTML = data.desc;
    descEl.classList.remove('hidden');
  }
}

function deselectPreset() {
  clearPreset();
  resetLabels();
  document.querySelectorAll('.preset-pill').forEach(el => el.classList.remove('active'));
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
  dpPause(); resetDpState();
  efPause(); ebPause();

  // Clear preset on randomize/reset
  deselectPreset();

  computeData(rnd);
  ipInit(rnd);
  initIntroVecs(rnd);
  efInit(rnd);
  ebInit(rnd);

  if (currentMode === 'matmul' || currentMode === 'dotprod') {
    rebuildBoxes();
    removePlusPlanes();
    if (currentMode === 'dotprod') { ensureAllGreen(); addPlusPlanes(); }
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
  if (currentMode === 'dotprod') { dpRenderAll(); renderEinsumBadge('einsumDotprod', 'dotprod'); }
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
    el.innerHTML = `einsum('<span class="ei-contract">i</span>, <span class="ei-contract">i</span> → <span style="color:#999">scalar</span>', a, b)`;
  } else if (tab === 'intro') {
    el.innerHTML = `einsum('<span class="ei-free">i</span>, <span class="ei-free">k</span> → <span class="ei-free">ik</span>', a, b)`;
  } else if (tab === 'dotprod') {
    el.innerHTML = `einsum('<span class="ei-free">i</span><span class="ei-contract">j</span>, <span class="ei-contract">j</span><span class="ei-free">k</span> → <span class="ei-free">ik</span>', A, B)`;
  } else if (tab === 'matmul') {
    el.innerHTML = `einsum('<span class="ei-free">i</span><span class="ei-contract">j</span>, <span class="ei-contract">j</span><span class="ei-free">k</span> → <span class="ei-free">ik</span>', A, B)`;
  } else if (tab === 'embed-fwd') {
    el.innerHTML = `einsum('<span class="ei-free">b</span><span class="ei-free">l</span><span class="ei-contract">h</span>, <span class="ei-contract">h</span><span class="ei-free">c</span> → <span class="ei-free">b</span><span class="ei-free">l</span><span class="ei-free">c</span>', X, W)`;
  } else if (tab === 'embed-bwd') {
    el.innerHTML = `einsum('<span class="ei-contract">b</span><span class="ei-contract">l</span><span class="ei-free">h</span>, <span class="ei-contract">b</span><span class="ei-contract">l</span><span class="ei-free">c</span> → <span class="ei-free">h</span><span class="ei-free">c</span>', X, G)`;
  }
  // Remove old active-tab markers
  document.querySelectorAll('.copy-torch-btn.active-tab').forEach(b => b.classList.remove('active-tab'));
  // Append copy button
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
      + `<div class="sidebar-link" style="margin-top:6px">See also: <a href="https://github.com/srush/Tensor-Puzzles" target="_blank">Sasha Rush's Tensor Puzzles</a></div>`
      + `</div>`;
  } else if (currentMode === 'matmul') {
    el.innerHTML =
      `<div class="broadcast-rules">`
      + `<strong>Outer product perspective</strong>`
      + `<p style="margin-top:6px">Matrix multiplication as a sum of rank-1 outer products:</p>`
      + `<p style="margin-top:4px"><strong>Result = &Sigma;<sub>j</sub> A[:,j] &otimes; B[j,:]</strong></p>`
      + `<p style="margin-top:6px">Each slice j of the cube is one outer product A[:,j] &otimes; B[j,:]. `
      + `Building the cube shows all J slices; collapsing sums them along the j axis into the final result.</p>`
      + `<p style="margin-top:6px;font-size:0.68rem;color:#999;font-style:italic">This decomposition is key to understanding LoRA (low-rank adaptation) and why attention heads can be viewed as outer product accumulators.</p>`
      + `</div>`;
  } else if (currentMode === 'dotprod') {
    el.innerHTML = '<div class="dp-vector-intro" id="shelfDpIntro"></div>';
    dpRenderVectorIntro('shelfDpIntro');
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

// ── Wire up window globals for HTML onclick handlers ──
window.rebuild = rebuild;
window.setMode = setMode;
window.setTier = setTier;
window.selectPreset = selectPreset;
window.toggleInfo = toggleInfo;
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
// Matrix Multiply — Outer Product View
window.mmBack = mmBack;
window.mmFwd = mmFwd;
window.mmToggle = mmToggle;
window.mmReset = mmReset;
window.mmScrubCollapse = mmScrubCollapse;
// Matrix Multiply — Dot Product View
window.dpBack = dpBack;
window.dpFwd = dpFwd;
window.dpToggle = dpToggle;
window.dpReset = dpReset;
window.dpJumpToCell = dpJumpToCell;
window.dpScrubCollapse = dpScrubCollapse;
window.dpHoverCell = dpHoverCell;
window.dpClearHover = dpClearHover;
// Embedding Forward (hidden, kept for future use)
window.efFwd = efFwd;
window.efBack = efBack;
window.efToggle = efToggle;
window.efReset = efReset;
window.efJumpToPos = efJumpToPos;
window.efTraceBack = efTraceBack;
window.efChangeDim = efChangeDim;
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
