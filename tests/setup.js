// ══════════════════════════════════════════════════
// TEST SETUP — DOM stubs, THREE.js mock, canvas mock
// ══════════════════════════════════════════════════
import { beforeEach } from 'vitest';

// ── Canvas mock (jsdom lacks canvas support) ──
HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === '2d') {
    return {
      fillStyle: '', font: '', textAlign: '', textBaseline: '',
      fillText() {}, fillRect() {}, clearRect() {},
      beginPath() {}, arc() {}, fill() {},
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
  constructor() { this.r = 0; this.g = 0; this.b = 0; }
  setHex() { return this; }
  copy() { return this; }
  clone() { return new MockColor(); }
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
    <!-- Tab buttons -->
    <button id="tab-intro" class="mode-tab active"></button>
    <button id="tab-matmul" class="mode-tab"></button>
    <button id="tab-dotprod" class="mode-tab"></button>

    <!-- Info shelf -->
    <div id="infoShelfHandle"></div>
    <div id="infoShelfBackdrop"></div>
    <div id="infoShelf"><div id="shelfContent"></div></div>

    <!-- Tab 0 — Intro -->
    <div id="ctrl-intro">
      <button id="pbIntro">▶</button>
      <input type="range" id="spIntro" value="600">
      <div id="introDisplay"></div>
      <div id="fIntro"></div>
      <div id="dIntro"></div>
      <div id="einsumIntro"></div>
    </div>

    <!-- Tab 1 — Matmul -->
    <div id="ctrl-matmul" class="hidden">
      <button id="pbMM">▶</button>
      <input type="range" id="spMM" value="700">
      <input type="checkbox" id="chkElem">
      <input type="range" id="spCollapse" min="0" max="1000" value="0" disabled>
      <div id="mmCanvasHost"><canvas id="mainCanvas" width="420" height="380"></canvas></div>
      <div id="canvasTitle"></div>
      <div id="gridA" class="grid"></div>
      <div id="gridB" class="grid"></div>
      <div id="dimRowBtnsA"></div>
      <div id="dimColBtnsA"></div>
      <div id="dimRowBtnsB"></div>
      <div id="dimColBtnsB"></div>
      <div id="opDisplay" class="hidden"></div>
      <div id="fMM"></div>
      <div id="dMM"></div>
      <div id="einsumMatmul"></div>
    </div>

    <!-- Tab 2 — Dot product -->
    <div id="ctrl-dotprod" class="hidden">
      <button id="pbDP">▶</button>
      <input type="range" id="spDP" value="600">
      <input type="checkbox" id="chkDpCol">
      <input type="range" id="dpCollapseSlider" min="0" max="1000" value="0">
      <div id="dpCanvasHost"></div>
      <div id="dpCanvasTitle"></div>
      <div id="dpMatrices"></div>
      <div id="fDP"></div>
      <div id="dDP"></div>
      <div id="dpColumnDetail"></div>
      <div id="einsumDotprod"></div>
    </div>
  `;
}

beforeEach(() => {
  buildDOM();
});
