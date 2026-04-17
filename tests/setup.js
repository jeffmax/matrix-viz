// ══════════════════════════════════════════════════
// TEST SETUP — DOM stubs, THREE.js mock, canvas mock
// ══════════════════════════════════════════════════
import { beforeEach } from 'vitest';

// ── Canvas mock (jsdom lacks canvas support) ──
HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === '2d') {
    return {
      fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
      lineWidth: 1, lineCap: 'butt',
      fillText() {}, fillRect() {}, clearRect() {},
      beginPath() {}, arc() {}, fill() {}, stroke() {},
      moveTo() {}, lineTo() {},
      measureText() { return { width: 0 }; },
    };
  }
  if (type === 'webgl' || type === 'webgl2') {
    return {
      getExtension() { return null; },
      getParameter() { return 0; },
      createShader() { return {}; },
      shaderSource() {}, compileShader() {}, getShaderParameter() { return true; },
      createProgram() { return {}; }, attachShader() {}, linkProgram() {},
      getProgramParameter() { return true; },
      canvas: this,
    };
  }
  return null;
};

// ── THREE.js mock ──
class MockColor {
  constructor(hex) { this.r = 0; this.g = 0; this.b = 0; this._hex = hex || 0; }
  setHex(h) { this._hex = h; return this; }
  getHex() { return this._hex; }
  copy(c) { this._hex = c._hex; this.r = c.r; this.g = c.g; this.b = c.b; return this; }
  clone() { const c = new MockColor(this._hex); c.r = this.r; c.g = this.g; c.b = this.b; return c; }
  lerp() { return this; }
}

class MockMaterial {
  constructor() {
    this.color = new MockColor();
    this.emissive = new MockColor();
    this.opacity = 1;
    this.transparent = true;
    this.visible = true;
    this.map = null;
    this.needsUpdate = false;
    this.depthTest = true;
    this.shininess = 0;
  }
  dispose() {}
}

class MockObject3D {
  constructor() {
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(p) { this.x = p.x; this.y = p.y; this.z = p.z; } };
    this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.visible = true;
    this.material = new MockMaterial();
  }
}

const mockScene = {
  add() {},
  remove() {},
};

globalThis.THREE = {
  Color: MockColor,
  BoxGeometry: class { },
  EdgesGeometry: class { constructor() {} },
  MeshPhongMaterial: MockMaterial,
  LineBasicMaterial: MockMaterial,
  SpriteMaterial: MockMaterial,
  Mesh: class extends MockObject3D { constructor() { super(); this.mat = this.material; this.em = new MockMaterial(); } },
  LineSegments: class extends MockObject3D {},
  Sprite: class extends MockObject3D {},
  Scene: class { add() {} remove() {} },
  PerspectiveCamera: class extends MockObject3D { constructor() { super(); } lookAt() {} },
  WebGLRenderer: class {
    constructor() {}
    setPixelRatio() {}
    setSize() {}
    setClearColor() {}
    render() {}
  },
  AmbientLight: class extends MockObject3D {},
  DirectionalLight: class extends MockObject3D {},
  CanvasTexture: class { constructor() { this.needsUpdate = false; } },
  Vector3: class { constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; } },
  ArrowHelper: class extends MockObject3D {
    constructor() { super(); this.line = { material: new MockMaterial() }; this.cone = { material: new MockMaterial() }; }
  },
};

// ── rAF polyfill ──
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  let rafId = 0;
  globalThis.requestAnimationFrame = (cb) => { rafId++; setTimeout(() => cb(performance.now()), 0); return rafId; };
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

// ── Build all DOM elements that the code expects ──
function buildDOM() {
  document.body.innerHTML = `
    <!-- Tier navigation -->
    <button id="tier1-blocks" class="tier1-tab active"></button>
    <button id="tier1-matmul" class="tier1-tab"></button>
    <button id="tier1-embed" class="tier1-tab"></button>
    <button id="tier1-quantum" class="tier1-tab"></button>
    <div id="tier2-blocks"><button id="tab-inner" class="tier2-tab active"></button><button id="tab-intro" class="tier2-tab"></button></div>
    <div id="tier2-matmul" class="hidden"><button id="tab-matmul" class="tier2-tab active"></button></div>
    <div id="tier2-embed" class="hidden"><button id="tab-embed-fwd-nav" class="tier2-tab active"></button><button id="tab-embed-bwd-nav" class="tier2-tab"></button></div>
    <div id="tier2-quantum" class="hidden"><button id="tab-quantum" class="tier2-tab active"></button></div>
    <div id="presetDesc" class="hidden"></div>

    <!-- Info shelf -->
    <div id="infoShelfHandle"></div>
    <div id="infoShelfBackdrop"></div>
    <div id="infoShelf"><div id="shelfContent"></div></div>

    <!-- Rules shelf -->
    <div id="rulesShelfHandle"></div>
    <div id="rulesShelfBackdrop"></div>
    <div id="rulesShelf"></div>

    <!-- Inner Product tab -->
    <div id="ctrl-inner" class="hidden">
      <button id="pbInner">▶</button>
      <input type="range" id="spInner" value="600">
      <div id="einsumInner"></div>
      <div id="innerDisplay"></div>
      <div id="fInner"></div>
      <div id="dInner"></div>
    </div>

    <!-- Tab 0 — Intro -->
    <div id="ctrl-intro">
      <button id="pbIntro">▶</button>
      <input type="range" id="spIntro" value="600">
      <div id="introDisplay"></div>
      <div id="fIntro"></div>
      <div id="dIntro"></div>
      <div id="einsumIntro"></div>
    </div>

    <!-- Tab — Matmul (unified) -->
    <div id="ctrl-matmul" class="hidden">
      <select id="presetSelect"><option value="">Presets...</option></select>
      <div id="buildModeToggle">
        <label class="seg-active"><input type="radio" name="buildMode" value="outer" checked><span>Outer Product</span></label>
        <label><input type="radio" name="buildMode" value="dot"><span>Dot Product</span></label>
      </div>
      <button id="pbMM">▶</button>
      <input type="range" id="spMM" value="700">
      <input type="checkbox" id="chkDetail">
      <span id="chkDetailLabel">Element by element</span>
      <input type="range" id="spCollapse" min="0" max="1000" value="0" disabled>
      <input type="checkbox" id="chkAxes" checked>
      <div id="mmCanvasHost"><canvas id="mainCanvas" width="420" height="380"></canvas></div>
      <div id="canvasTitle"></div>
      <div id="mmTitleA">A</div>
      <div id="mmTitleB">B</div>
      <div id="gridA" class="grid"></div>
      <div id="gridB" class="grid"></div>
      <div id="dimRowBtnsA"></div>
      <div id="dimColBtnsA"></div>
      <div id="dimRowBtnsB"></div>
      <div id="dimColBtnsB"></div>
      <div id="mmResultHint"></div>
      <div id="mmResultGrid"></div>
      <div id="opDisplay" class="hidden"></div>
      <div id="dpSubViz" style="display:none"></div>
      <div id="fMM"></div>
      <div id="dMM"></div>
      <div id="einsumMatmul"></div>
    </div>

    <!-- Tab 3 — Embedding Forward -->
    <div id="ctrl-embed-fwd" class="hidden">
      <button id="pbEF">▶</button>
      <input type="range" id="spEF" value="600">
      <input type="checkbox" id="chkEfDetail" checked>
      <div id="efDisplay"></div>
      <div id="fEF"></div>
      <div id="dEF"></div>
      <div id="einsumEmbedFwd"></div>
    </div>

    <!-- Tab 4 — Embedding Backward -->
    <div id="ctrl-embed-bwd" class="hidden">
      <button id="pbEB">▶</button>
      <input type="range" id="spEB" value="600">
      <div id="ebDisplay"></div>
      <div id="fEB"></div>
      <div id="dEB"></div>
      <div id="einsumEmbedBwd"></div>
    </div>

    <!-- Tab — Quantum Gates -->
    <div id="ctrl-quantum" class="hidden">
      <div id="qDisplay"></div>
      <div id="einsumQuantum"></div>
    </div>
  `;
}

beforeEach(() => {
  buildDOM();
});
