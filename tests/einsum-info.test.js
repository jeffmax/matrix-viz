import { describe, it, expect, beforeEach } from 'vitest';
import { EINSUM_INFO, getEinsumInfo, renderEinsumBadge,
         einsumToggleLoops, einsumToggleInfo, einsumToggleTorch,
         einsumCopyTorch, setTorchCodeGenerator,
         einsumIndexHover, einsumIndexClear,
         getActiveEinsumHover } from '../js/einsum-info.js';

describe('EINSUM_INFO data', () => {
  const TABS = ['inner', 'intro', 'matmul', 'embed-fwd', 'embed-bwd'];

  it('has entries for all five tabs', () => {
    for (const tab of TABS) {
      expect(EINSUM_INFO[tab]).toBeDefined();
    }
  });

  it('each entry has english, shape, loops, and indices', () => {
    for (const tab of TABS) {
      const info = EINSUM_INFO[tab];
      expect(info.english).toBeTypeOf('string');
      expect(info.shape).toBeTypeOf('string');
      expect(info.loops).toBeTypeOf('string');
      expect(Array.isArray(info.indices)).toBe(true);
      expect(info.indices.length).toBeGreaterThan(0);
    }
  });

  it('indices have ch, role, and label', () => {
    for (const tab of TABS) {
      for (const idx of EINSUM_INFO[tab].indices) {
        expect(idx.ch).toBeTypeOf('string');
        expect(idx.ch.length).toBe(1);
        expect(['free', 'contracted']).toContain(idx.role);
        expect(idx.label).toBeTypeOf('string');
      }
    }
  });

  it('inner product has only contracted index i', () => {
    const info = EINSUM_INFO.inner;
    expect(info.indices).toHaveLength(1);
    expect(info.indices[0]).toEqual({ ch: 'i', role: 'contracted', label: 'position (summed out)' });
  });

  it('outer product has two free indices, no contracted', () => {
    const info = EINSUM_INFO.intro;
    expect(info.indices.every(idx => idx.role === 'free')).toBe(true);
    expect(info.indices.map(idx => idx.ch)).toEqual(['i', 'k']);
  });

  it('matmul has j as contracted, i and k as free', () => {
    const info = EINSUM_INFO.matmul;
    const contracted = info.indices.filter(idx => idx.role === 'contracted');
    const free = info.indices.filter(idx => idx.role === 'free');
    expect(contracted.map(c => c.ch)).toEqual(['j']);
    expect(free.map(f => f.ch)).toEqual(['i', 'k']);
  });

  it('embed-fwd has v as contracted', () => {
    const info = EINSUM_INFO['embed-fwd'];
    const contracted = info.indices.filter(idx => idx.role === 'contracted');
    expect(contracted.map(c => c.ch)).toEqual(['v']);
  });

  it('embed-bwd has b,t as contracted and v,c as free', () => {
    const info = EINSUM_INFO['embed-bwd'];
    const contracted = info.indices.filter(idx => idx.role === 'contracted');
    const free = info.indices.filter(idx => idx.role === 'free');
    expect(contracted.map(c => c.ch)).toEqual(['b', 't']);
    expect(free.map(f => f.ch)).toEqual(['v', 'c']);
  });

  it('loops contain valid Python comments with einsum signature', () => {
    expect(EINSUM_INFO.inner.loops).toContain('i,i→');
    expect(EINSUM_INFO.intro.loops).toContain('i,k→ik');
    expect(EINSUM_INFO.matmul.loops).toContain('ij,jk→ik');
    expect(EINSUM_INFO['embed-fwd'].loops).toContain('btv,vc→btc');
    expect(EINSUM_INFO['embed-bwd'].loops).toContain('btv,btc→vc');
  });

  it('loops contain "contracted" and "free" comments where applicable', () => {
    for (const tab of TABS) {
      const loops = EINSUM_INFO[tab].loops;
      if (tab !== 'intro') expect(loops).toContain('contracted');
      if (tab !== 'inner') expect(loops).toContain('free');
    }
  });

  it('english mentions contracted indices with ei-contract class', () => {
    expect(EINSUM_INFO.inner.english).toContain('ei-contract');
    expect(EINSUM_INFO.matmul.english).toContain('sum over j');
    expect(EINSUM_INFO['embed-fwd'].english).toContain('sum over v');
    expect(EINSUM_INFO['embed-bwd'].english).toContain('sum over b,t');
  });

  it('shape mentions intermediate rank', () => {
    expect(EINSUM_INFO.inner.shape).toContain('1D vector');
    expect(EINSUM_INFO.intro.shape).toContain('2D matrix');
    expect(EINSUM_INFO.matmul.shape).toContain('3D cube');
    expect(EINSUM_INFO['embed-fwd'].shape).toContain('4D tensor');
    expect(EINSUM_INFO['embed-bwd'].shape).toContain('4D tensor');
  });
});

describe('getEinsumInfo', () => {
  it('returns info for valid tab', () => {
    expect(getEinsumInfo('matmul')).toBe(EINSUM_INFO.matmul);
  });

  it('returns null for unknown tab', () => {
    expect(getEinsumInfo('bogus')).toBeNull();
  });
});

describe('renderEinsumBadge', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="ctrl-matmul">
        <div class="einsum-badge" id="einsumMatmul"></div>
        <div id="mmPanelA"><div id="gridA" class="grid"></div></div>
        <div id="mmPanelB"><div id="gridB" class="grid"></div></div>
      </div>
      <div id="ctrl-inner">
        <div class="einsum-badge" id="einsumInner"></div>
        <div id="innerDisplay"></div>
      </div>
    `;
    einsumIndexClear('matmul');
    einsumIndexClear('inner');
  });

  it('renders signature with ei-idx spans having data-op attributes', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const el = document.getElementById('einsumMatmul');
    const idxSpans = el.querySelectorAll('.ei-idx[data-op]');
    expect(idxSpans.length).toBeGreaterThanOrEqual(5); // i,j in A + j,k in B + output
    // Check operand attributes
    const op0Spans = el.querySelectorAll('.ei-idx[data-op="0"]');
    const op1Spans = el.querySelectorAll('.ei-idx[data-op="1"]');
    const outSpans = el.querySelectorAll('.ei-idx[data-op="out"]');
    expect(op0Spans.length).toBe(2); // i, j in A
    expect(op1Spans.length).toBe(2); // j, k in B
    expect(outSpans.length).toBe(1); // ik output
  });

  it('inner product has separate operands for each i', () => {
    renderEinsumBadge('einsumInner', 'inner');
    const el = document.getElementById('einsumInner');
    const op0 = el.querySelectorAll('.ei-idx[data-op="0"]');
    const op1 = el.querySelectorAll('.ei-idx[data-op="1"]');
    expect(op0.length).toBe(1); // first i → a
    expect(op1.length).toBe(1); // second i → b
  });

  it('renders info panel (hidden by default)', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const panel = document.getElementById('einsumMatmulInfo');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('open')).toBe(false);
    const english = panel.querySelector('.ei-english');
    expect(english.textContent).toContain('sum over j');
  });

  it('renders loops panel (hidden by default)', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const panel = document.getElementById('einsumMatmulLoops');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('open')).toBe(false);
    const code = panel.querySelector('.ei-loops-code');
    expect(code.textContent).toContain('for j in range(J)');
  });

  it('renders info, loops, and torch buttons', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    expect(document.querySelector('.ei-info-btn')).not.toBeNull();
    expect(document.querySelector('.ei-loops-btn')).not.toBeNull();
    expect(document.querySelector('.ei-torch-btn')).not.toBeNull();
  });

  it('renders all five tabs without error', () => {
    document.body.innerHTML = `
      <div id="ctrl-inner"><div id="einsumInner" class="einsum-badge"></div></div>
      <div id="ctrl-intro"><div id="einsumIntro" class="einsum-badge"></div></div>
      <div id="ctrl-matmul"><div id="einsumMatmul" class="einsum-badge"></div></div>
      <div id="ctrl-embed-fwd"><div id="einsumEmbedFwd" class="einsum-badge"></div></div>
      <div id="ctrl-embed-bwd"><div id="einsumEmbedBwd" class="einsum-badge"></div></div>
    `;
    renderEinsumBadge('einsumInner', 'inner');
    renderEinsumBadge('einsumIntro', 'intro');
    renderEinsumBadge('einsumMatmul', 'matmul');
    renderEinsumBadge('einsumEmbedFwd', 'embed-fwd');
    renderEinsumBadge('einsumEmbedBwd', 'embed-bwd');
    for (const id of ['einsumInner', 'einsumIntro', 'einsumMatmul', 'einsumEmbedFwd', 'einsumEmbedBwd']) {
      expect(document.getElementById(id).querySelector('.ei-info-btn')).not.toBeNull();
      expect(document.getElementById(id).querySelector('.ei-loops-btn')).not.toBeNull();
    }
  });
});

describe('einsumToggleLoops', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="ctrl-matmul"><div id="einsumMatmul" class="einsum-badge"></div></div>
    `;
    renderEinsumBadge('einsumMatmul', 'matmul');
  });

  it('toggles open class on loops panel', () => {
    const panel = document.getElementById('einsumMatmulLoops');
    expect(panel.classList.contains('open')).toBe(false);
    einsumToggleLoops('einsumMatmul');
    expect(panel.classList.contains('open')).toBe(true);
    einsumToggleLoops('einsumMatmul');
    expect(panel.classList.contains('open')).toBe(false);
  });
});

describe('einsumToggleInfo', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="ctrl-matmul"><div id="einsumMatmul" class="einsum-badge"></div></div>
    `;
    renderEinsumBadge('einsumMatmul', 'matmul');
  });

  it('toggles open class on info panel', () => {
    const panel = document.getElementById('einsumMatmulInfo');
    expect(panel.classList.contains('open')).toBe(false);
    einsumToggleInfo('einsumMatmul');
    expect(panel.classList.contains('open')).toBe(true);
    einsumToggleInfo('einsumMatmul');
    expect(panel.classList.contains('open')).toBe(false);
  });
});

describe('mutual exclusion of panels', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="ctrl-matmul"><div id="einsumMatmul" class="einsum-badge"></div></div>
    `;
    setTorchCodeGenerator(() => 'import torch\n');
    renderEinsumBadge('einsumMatmul', 'matmul');
  });

  it('opening loops closes info', () => {
    einsumToggleInfo('einsumMatmul');
    expect(document.getElementById('einsumMatmulInfo').classList.contains('open')).toBe(true);
    einsumToggleLoops('einsumMatmul');
    expect(document.getElementById('einsumMatmulLoops').classList.contains('open')).toBe(true);
    expect(document.getElementById('einsumMatmulInfo').classList.contains('open')).toBe(false);
  });

  it('opening info closes loops', () => {
    einsumToggleLoops('einsumMatmul');
    expect(document.getElementById('einsumMatmulLoops').classList.contains('open')).toBe(true);
    einsumToggleInfo('einsumMatmul');
    expect(document.getElementById('einsumMatmulInfo').classList.contains('open')).toBe(true);
    expect(document.getElementById('einsumMatmulLoops').classList.contains('open')).toBe(false);
  });

  it('opening torch closes loops and info', () => {
    einsumToggleLoops('einsumMatmul');
    einsumToggleTorch('einsumMatmul', 'matmul');
    expect(document.getElementById('einsumMatmulTorch').classList.contains('open')).toBe(true);
    expect(document.getElementById('einsumMatmulLoops').classList.contains('open')).toBe(false);
  });

  it('torch panel shows generated code', () => {
    setTorchCodeGenerator(() => 'test_code_here');
    einsumToggleTorch('einsumMatmul', 'matmul');
    expect(document.getElementById('einsumMatmulTorchCode').textContent).toBe('test_code_here');
  });
});

describe('operand-aware einsumIndexHover / einsumIndexClear', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="ctrl-matmul">
        <div id="einsumMatmul" class="einsum-badge"></div>
        <div id="mmPanelA"><div id="gridA" class="grid"><div class="mat-cell"></div></div></div>
        <div id="mmPanelB"><div id="gridB" class="grid"><div class="mat-cell"></div></div></div>
      </div>
      <div id="ctrl-inner">
        <div id="einsumInner" class="einsum-badge"></div>
        <div id="innerDisplay"><div class="mat-cell a"></div><div class="mat-cell b"></div></div>
      </div>
    `;
    renderEinsumBadge('einsumMatmul', 'matmul');
    renderEinsumBadge('einsumInner', 'inner');
  });

  it('adds ei-hl-op0 class for first operand hover', () => {
    const container = document.getElementById('ctrl-matmul');
    einsumIndexHover('matmul', '0', 'i');
    expect(container.classList.contains('ei-hl-active')).toBe(true);
    expect(container.classList.contains('ei-hl-op0')).toBe(true);
  });

  it('adds ei-hl-op1 class for second operand hover', () => {
    const container = document.getElementById('ctrl-matmul');
    einsumIndexHover('matmul', '1', 'k');
    expect(container.classList.contains('ei-hl-op1')).toBe(true);
  });

  it('adds ei-hl-opout for output hover', () => {
    const container = document.getElementById('ctrl-matmul');
    einsumIndexHover('matmul', 'out', undefined);
    expect(container.classList.contains('ei-hl-opout')).toBe(true);
  });

  it('highlights matching operand spans in badge', () => {
    einsumIndexHover('matmul', '0', 'i');
    // All op=0 spans should be active
    const op0Spans = document.querySelectorAll('#einsumMatmul .ei-idx[data-op="0"]');
    op0Spans.forEach(s => expect(s.classList.contains('ei-idx-active')).toBe(true));
    // op=1 spans should NOT be active
    const op1Spans = document.querySelectorAll('#einsumMatmul .ei-idx[data-op="1"]');
    op1Spans.forEach(s => expect(s.classList.contains('ei-idx-active')).toBe(false));
  });

  it('inner product: op0 highlights only a, op1 highlights only b', () => {
    // Hover first i (operand 0 = vector a)
    einsumIndexHover('inner', '0', 'i');
    const innerContainer = document.getElementById('ctrl-inner');
    expect(innerContainer.classList.contains('ei-hl-op0')).toBe(true);
    expect(innerContainer.classList.contains('ei-hl-op1')).toBe(false);
    einsumIndexClear('inner');

    // Hover second i (operand 1 = vector b)
    einsumIndexHover('inner', '1', 'i');
    expect(innerContainer.classList.contains('ei-hl-op1')).toBe(true);
    expect(innerContainer.classList.contains('ei-hl-op0')).toBe(false);
  });

  it('clears previous hover when hovering a different operand', () => {
    einsumIndexHover('matmul', '0', 'i');
    einsumIndexHover('matmul', '1', 'k');
    const container = document.getElementById('ctrl-matmul');
    expect(container.classList.contains('ei-hl-op0')).toBe(false);
    expect(container.classList.contains('ei-hl-op1')).toBe(true);
  });

  it('clears all hover state', () => {
    einsumIndexHover('matmul', '0', 'i');
    einsumIndexClear('matmul');
    const container = document.getElementById('ctrl-matmul');
    expect(container.classList.contains('ei-hl-active')).toBe(false);
    expect(container.classList.contains('ei-hl-op0')).toBe(false);
    expect(document.querySelectorAll('.ei-idx-active').length).toBe(0);
  });

  it('getActiveEinsumHover returns operand and index', () => {
    expect(getActiveEinsumHover()).toBeNull();
    einsumIndexHover('matmul', '1', 'k');
    expect(getActiveEinsumHover()).toEqual({ op: '1', idx: 'k' });
    einsumIndexClear('matmul');
    expect(getActiveEinsumHover()).toBeNull();
  });

  it('clear is a no-op when nothing is hovered', () => {
    einsumIndexClear('matmul');
    expect(getActiveEinsumHover()).toBeNull();
  });
});
