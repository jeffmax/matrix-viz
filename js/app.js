// ══════════════════════════════════════════════════
// APP — ENTRY POINT, MODE SWITCHING, INIT
// ══════════════════════════════════════════════════
import { I, J, K, currentMode, setCurrentMode, computeData, changeDim,
         registerCallbacks, applyInfoState, toggleInfo, recomputeFromMatrices } from './shared.js';
import { sc, initScene, moveCanvasTo } from './scene.js';
import { boxes, rebuildBoxes, addPlusPlanes, removePlusPlanes, ensureAllGreen, clearBoxes } from './cube-manager.js';
import { introA, introB, initIntroVecs, renderIntro, pauseIntro, resetIntroStep,
         resizeIntroVecs, stepFwdIntro, stepBackIntro, togglePlayIntro, resetIntro,
         introEditCell, introHover, introClearHover } from './tab-intro.js';
import { mmPauseAll, mmReset, mmToggle, mmFwd, mmBack, mmScrubCollapse,
         resetMmBuildState, applyS1, renderA, renderB, carryIntroToMatmul,
         mmUpdateCanvasTitle, collapseT, mmPhase, applyCollapse } from './tab-matmul.js';
import { dpPause, dpRenderAll, dpReset, dpApplyCollapse, dpScrubCollapse,
         dpToggle, dpFwd, dpBack, dpJumpToCell, dpTermToggle,
         resetDpState, dpCollapseT, setDpCollapseT } from './tab-dotprod.js';

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

  if (prev === 'intro' && m !== 'intro' && introA.length > 0) {
    carryIntroToMatmul(introA, introB);
  }

  if (m === 'matmul') {
    moveCanvasTo('mmCanvasHost');
    mmPauseAll();
    resetMmBuildState();
    document.getElementById('spCollapse').disabled = true;
    document.getElementById('spCollapse').value = 0;
    rebuildBoxes(); removePlusPlanes();
    applyS1(-1);
    renderA(-1, -1, -1); renderB(-1, -1, -1);
    mmUpdateCanvasTitle();
    renderEinsumBadge('einsumMatmul', 'matmul');
  }
  if (m === 'intro') {
    renderIntro();
    renderEinsumBadge('einsumIntro', 'intro');
  }
  if (m === 'dotprod') {
    moveCanvasTo('dpCanvasHost');
    if (!sc) initScene();
    let savedCollapseT = 0;
    if (!boxes.length) {
      rebuildBoxes();
    } else {
      savedCollapseT = collapseT;
    }
    removePlusPlanes(); // clear matmul's plus planes before rebuilding for dotprod
    const dpSlider = document.getElementById('dpCollapseSlider');
    if (dpSlider) dpSlider.value = Math.round(savedCollapseT * 1000);
    ensureAllGreen();
    setDpCollapseT(savedCollapseT);
    dpApplyCollapse(savedCollapseT); // this will add plus planes if t < 1
    resetDpState();
    // resetDpState clears dpCollapseT, restore it
    setDpCollapseT(savedCollapseT);
    renderEinsumBadge('einsumDotprod', 'dotprod');
    dpRenderAll();
  }
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
window.dpTermToggle = dpTermToggle;
window.dpScrubCollapse = dpScrubCollapse;

// ── Init ──
rebuild(true);
setMode('intro');
applyInfoState();
