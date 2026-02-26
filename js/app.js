// ══════════════════════════════════════════════════
// APP — ENTRY POINT, MODE SWITCHING, INIT
// ══════════════════════════════════════════════════
import { I, J, K, currentMode, setCurrentMode, computeData, changeDim,
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
         dpRenderVectorIntro } from './tab-dotprod.js';

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

  document.getElementById('tab-intro').classList.toggle('active', m === 'intro');
  document.getElementById('tab-dotprod').classList.toggle('active', m === 'dotprod');
  document.getElementById('tab-matmul').classList.toggle('active', m === 'matmul');
  document.getElementById('ctrl-intro').classList.toggle('hidden', m !== 'intro');
  document.getElementById('ctrl-dotprod').classList.toggle('hidden', m !== 'dotprod');
  document.getElementById('ctrl-matmul').classList.toggle('hidden', m !== 'matmul');

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

  computeData(rnd);
  initIntroVecs(rnd);

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
    if (mmPhase === 'build') {
      el.innerHTML = `einsum('<span class="ei-free">i</span><span class="ei-free">j</span>, <span class="ei-free">j</span><span class="ei-free">k</span> → <span class="ei-free">ijk</span>', A, B) &nbsp;<span class="ei-note">build cube</span>`;
    } else {
      el.innerHTML = `einsum('<span class="ei-free">i</span><span class="ei-contract">j</span><span class="ei-free">k</span> → <span class="ei-free">ik</span>', Cube) &nbsp;<span class="ei-note">sum out <span class="ei-contract">j</span></span>`;
    }
  }
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
// Snap-back
window.snapToDefault = snapToDefault;

// ── Init ──
rebuild(true);
setMode('intro');
