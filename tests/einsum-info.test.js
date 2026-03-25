import { describe, it, expect, beforeEach } from 'vitest';
import { EINSUM_INFO, getEinsumInfo, renderEinsumBadge,
         einsumToggleLoops, einsumIndexHover, einsumIndexClear,
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
      // Outer product has no contraction
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

  it('english or shape has hoverable data-idx spans for each index', () => {
    for (const tab of TABS) {
      const info = EINSUM_INFO[tab];
      const combined = info.english + info.shape;
      for (const idx of info.indices) {
        expect(combined).toContain(`data-idx="${idx.ch}"`);
      }
    }
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
    // Minimal DOM for badge rendering
    document.body.innerHTML = `
      <div id="ctrl-matmul">
        <div class="einsum-badge" id="einsumMatmul"></div>
        <div id="gridA" class="grid"></div>
        <div id="gridB" class="grid"></div>
      </div>
      <div id="ctrl-inner">
        <div class="einsum-badge" id="einsumInner"></div>
        <div id="innerDisplay"></div>
      </div>
    `;
    // Clear any lingering hover state
    einsumIndexClear('matmul');
    einsumIndexClear('inner');
  });

  it('renders signature with ei-idx spans for matmul', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const el = document.getElementById('einsumMatmul');
    const idxSpans = el.querySelectorAll('.ei-idx');
    expect(idxSpans.length).toBeGreaterThanOrEqual(4); // i, j, j, k
    // Check data-idx attributes
    const indices = [...idxSpans].map(s => s.dataset.idx);
    expect(indices).toContain('i');
    expect(indices).toContain('j');
    expect(indices).toContain('k');
  });

  it('renders English translation', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const el = document.getElementById('einsumMatmul');
    const english = el.querySelector('.ei-english');
    expect(english).not.toBeNull();
    expect(english.textContent).toContain('sum over j');
  });

  it('renders shape story', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const el = document.getElementById('einsumMatmul');
    const shape = el.querySelector('.ei-shape');
    expect(shape).not.toBeNull();
    expect(shape.textContent).toContain('3D cube');
  });

  it('renders loops panel (hidden by default)', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const panel = document.getElementById('einsumMatmulLoops');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('open')).toBe(false);
    const code = panel.querySelector('.ei-loops-code');
    expect(code.textContent).toContain('for j in range(J)');
  });

  it('renders loops button', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const btn = document.querySelector('.ei-loops-btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('loops');
  });

  it('renders torch copy button', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const btn = document.querySelector('.copy-torch-btn');
    expect(btn).not.toBeNull();
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
    // Each should have english + shape
    for (const id of ['einsumInner', 'einsumIntro', 'einsumMatmul', 'einsumEmbedFwd', 'einsumEmbedBwd']) {
      expect(document.getElementById(id).querySelector('.ei-english')).not.toBeNull();
      expect(document.getElementById(id).querySelector('.ei-shape')).not.toBeNull();
    }
  });

  it('escapes HTML in loops code', () => {
    renderEinsumBadge('einsumMatmul', 'matmul');
    const code = document.querySelector('.ei-loops-code');
    // Should not contain raw < or > (they should be escaped)
    expect(code.innerHTML).not.toContain('<span');
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

describe('einsumIndexHover / einsumIndexClear', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="ctrl-matmul">
        <div id="einsumMatmul" class="einsum-badge"></div>
        <div id="gridA" class="grid"><div class="mat-cell"></div></div>
        <div id="gridB" class="grid"><div class="mat-cell"></div></div>
      </div>
    `;
    renderEinsumBadge('einsumMatmul', 'matmul');
  });

  it('adds ei-hover and ei-hover-{idx} to tab container', () => {
    const container = document.getElementById('ctrl-matmul');
    einsumIndexHover('matmul', 'j');
    expect(container.classList.contains('ei-hover')).toBe(true);
    expect(container.classList.contains('ei-hover-j')).toBe(true);
  });

  it('highlights matching ei-idx spans', () => {
    einsumIndexHover('matmul', 'j');
    const jSpans = document.querySelectorAll('.ei-idx[data-idx="j"]');
    expect(jSpans.length).toBeGreaterThan(0);
    jSpans.forEach(s => expect(s.classList.contains('ei-idx-active')).toBe(true));
  });

  it('highlights matching ei-hl spans in english text', () => {
    einsumIndexHover('matmul', 'j');
    const hlSpans = document.querySelectorAll('.ei-hl[data-idx="j"]');
    expect(hlSpans.length).toBeGreaterThan(0);
    hlSpans.forEach(s => expect(s.classList.contains('ei-idx-active')).toBe(true));
  });

  it('clears previous hover when hovering a new index', () => {
    einsumIndexHover('matmul', 'j');
    einsumIndexHover('matmul', 'i');
    const container = document.getElementById('ctrl-matmul');
    expect(container.classList.contains('ei-hover-j')).toBe(false);
    expect(container.classList.contains('ei-hover-i')).toBe(true);
  });

  it('clears all hover state', () => {
    einsumIndexHover('matmul', 'j');
    einsumIndexClear('matmul');
    const container = document.getElementById('ctrl-matmul');
    expect(container.classList.contains('ei-hover')).toBe(false);
    expect(container.classList.contains('ei-hover-j')).toBe(false);
    expect(document.querySelectorAll('.ei-idx-active').length).toBe(0);
  });

  it('getActiveEinsumHover tracks state', () => {
    expect(getActiveEinsumHover()).toBeNull();
    einsumIndexHover('matmul', 'k');
    expect(getActiveEinsumHover()).toBe('k');
    einsumIndexClear('matmul');
    expect(getActiveEinsumHover()).toBeNull();
  });

  it('clear is a no-op when nothing is hovered', () => {
    // Should not throw
    einsumIndexClear('matmul');
    expect(getActiveEinsumHover()).toBeNull();
  });
});
