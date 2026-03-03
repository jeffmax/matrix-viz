// ══════════════════════════════════════════════════
// APP — ENTRY POINT, MODE SWITCHING, INIT
// ══════════════════════════════════════════════════
import { I, J, K, A, B, currentMode, setCurrentMode, computeData, changeDim,
         registerCallbacks, toggleInfo, recomputeFromMatrices,
         infoOpen, setOnShelfOpen } from './shared.js';
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

// ── Register callbacks for shared.js ──
registerCallbacks({
  onDimChange: (oldI, oldJ, oldK) => {
    // Resize intro vectors
    resizeIntroVecs();

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
// MODE TABS
// ══════════════════════════════════════════════════
function setMode(m) {
  const prev = currentMode;
  setCurrentMode(m);

  if (prev === 'intro') pauseIntro();
  if (prev === 'dotprod') dpPause();
  if (prev === 'matmul') mmPauseAll();
  if (prev === 'embed-fwd') efPause();
  if (prev === 'embed-bwd') ebPause();

  const tabs = ['intro', 'dotprod', 'matmul', 'embed-fwd', 'embed-bwd'];
  for (const t of tabs) {
    const tabBtn = document.getElementById('tab-' + t);
    const ctrl = document.getElementById('ctrl-' + t);
    if (tabBtn) tabBtn.classList.toggle('active', m === t);
    if (ctrl) ctrl.classList.toggle('hidden', m !== t);
  }

  const introCarry = prev === 'intro' && m !== 'intro' && introA.length > 0;
  if (introCarry) {
    carryIntroToMatmul(introA, introB);
  }

  if (m === 'matmul') {
    moveCanvasTo('mmCanvasHost');
    if (introCarry) {
      // Data changed from intro carry-over — full reset
      mmPauseAll();
      resetMmBuildState();
      document.getElementById('spCollapse').disabled = true;
      document.getElementById('spCollapse').value = 0;
      rebuildBoxes(); removePlusPlanes();
      applyS1(-1);
      renderA(-1, -1, -1); renderB(-1, -1, -1);
      mmUpdateCanvasTitle();
    } else {
      // Returning to matmul — restore existing state
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
// REBUILD
// ══════════════════════════════════════════════════
function rebuild(rnd) {
  mmPauseAll();
  resetMmBuildState();
  pauseIntro(); resetIntroStep();
  dpPause(); resetDpState();
  efPause(); ebPause();

  computeData(rnd);
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
  if (tab === 'intro') {
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
  if (tab === 'intro') {
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
  if (currentMode === 'intro') {
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
      + `<p style="margin-top:6px;font-size:0.68rem;color:#999;font-style:italic">Each position contributes a rank-1 outer product X[b,l,:]⊗G[b,l,:]. The weight update is a sum of these rank-1 terms — the same structure as Tab ①.</p>`
      + `</div>`;
  }
}
setOnShelfOpen(updateShelfContent);

// ── Wire up window globals for HTML onclick handlers ──
window.rebuild = rebuild;
window.setMode = setMode;
window.toggleInfo = toggleInfo;
window.changeDim = changeDim;
// Tab 0
window.stepFwdIntro = stepFwdIntro;
window.stepBackIntro = stepBackIntro;
window.togglePlayIntro = togglePlayIntro;
window.resetIntro = resetIntro;
window.introEditCell = introEditCell;
window.introHover = introHover;
window.introClearHover = introClearHover;
// Tab 1
window.mmBack = mmBack;
window.mmFwd = mmFwd;
window.mmToggle = mmToggle;
window.mmReset = mmReset;
window.mmScrubCollapse = mmScrubCollapse;
// Tab 2
window.dpBack = dpBack;
window.dpFwd = dpFwd;
window.dpToggle = dpToggle;
window.dpReset = dpReset;
window.dpJumpToCell = dpJumpToCell;
window.dpScrubCollapse = dpScrubCollapse;
window.dpHoverCell = dpHoverCell;
window.dpClearHover = dpClearHover;
// Tab 3 — Embedding Forward
window.efFwd = efFwd;
window.efBack = efBack;
window.efToggle = efToggle;
window.efReset = efReset;
window.efJumpToPos = efJumpToPos;
window.efTraceBack = efTraceBack;
window.efChangeDim = efChangeDim;
// Tab 4 — Embedding Backward
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
rebuild(true);
setMode('intro');
