// ══════════════════════════════════════════════════
// 3D CUBE MANAGEMENT
// ══════════════════════════════════════════════════
import { I, J, K, Cube } from './shared.js';
import { sc, orb, CELL, STEP, FIXED_THETA, FIXED_PHI, makeTex, makePlusTex, initScene, cancelSnap } from './scene.js';

const THREE = window.THREE;

export let boxes = [];
export let plusPlanes = [];
let axisLabels = [];   // arrows + label sprites
let axisLabelsBuilt = false;  // true once addAxisLabels has run for current boxes
let axisLabelsVisible = false;
let jAxisArrow = null;  // j-axis arrow (separate ref for collapse animation)
let jAxisLabel = null;  // j-axis label sprite
let jAxisFullLen = 0;   // full length of j arrow at t=0
let jAxisHeadLen = 0;   // arrow head length
let jAxisHeadW = 0;     // arrow head width
let jAxisOriginY = 0;   // top of j arrow (yMax)

function makeLabelTex(letter, color) {
  const S = 128, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(S * 0.5)}px 'SF Mono', Menlo, Consolas, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(letter, S / 2, S / 2);
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

function addAxisLabels() {
  removeAxisLabels();
  if (!sc) return;
  const off = STEP * 0.35;  // offset from cube surface
  // Cube extents
  const xMin = -(K - 1) * STEP / 2 - CELL / 2;
  const xMax =  (K - 1) * STEP / 2 + CELL / 2;
  const yMin = packedY(J - 1) - CELL / 2;
  const yMax = packedY(0) + CELL / 2;
  const zMin = -(I - 1) * STEP / 2 - CELL / 2;
  const zMax =  (I - 1) * STEP / 2 + CELL / 2;
  const xSpan = xMax - xMin, ySpan = yMax - yMin, zSpan = zMax - zMin;
  const headFrac = 0.18, headW = 0.08;
  const labelSz = CELL * 0.38;

  // k → X axis: arrow along bottom-front edge, pointing right (+X)
  const kY = yMin - off, kZ = zMax + off;
  const kArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(xMin, kY, kZ),
    xSpan, 0x5588cc, xSpan * headFrac, headW
  );
  kArrow.line.material.transparent = true; kArrow.line.material.opacity = 0.6;
  kArrow.cone.material.transparent = true; kArrow.cone.material.opacity = 0.6;
  sc.scene.add(kArrow); axisLabels.push(kArrow);
  const kLbl = new THREE.Sprite(new THREE.SpriteMaterial({map: makeLabelTex('k', '#5588cc'), depthTest: false, transparent: true}));
  kLbl.scale.set(labelSz, labelSz, 1);
  kLbl.position.set(xMax + off * 0.5, kY, kZ);
  sc.scene.add(kLbl); axisLabels.push(kLbl);

  // j → Y axis: arrow along right-front edge, pointing down (-Y, j increases downward)
  const jX = xMax + off, jZ = zMax + off;
  jAxisFullLen = ySpan; jAxisHeadLen = ySpan * headFrac; jAxisHeadW = headW; jAxisOriginY = yMax;
  const jArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(jX, yMax, jZ),
    ySpan, 0xd04040, jAxisHeadLen, headW
  );
  jArrow.line.material.transparent = true; jArrow.line.material.opacity = 0.6;
  jArrow.cone.material.transparent = true; jArrow.cone.material.opacity = 0.6;
  sc.scene.add(jArrow); axisLabels.push(jArrow);
  jAxisArrow = jArrow;
  const jLbl = new THREE.Sprite(new THREE.SpriteMaterial({map: makeLabelTex('j', '#d04040'), depthTest: false, transparent: true}));
  jLbl.scale.set(labelSz, labelSz, 1);
  jLbl.position.set(jX, yMin - off * 0.5, jZ);
  sc.scene.add(jLbl); axisLabels.push(jLbl);
  jAxisLabel = jLbl;

  // i → Z axis: arrow along bottom-right edge, pointing forward (+Z toward viewer)
  const iX = xMax + off, iY = yMin - off;
  const iArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(iX, iY, zMin),
    zSpan, 0x5588cc, zSpan * headFrac, headW
  );
  iArrow.line.material.transparent = true; iArrow.line.material.opacity = 0.6;
  iArrow.cone.material.transparent = true; iArrow.cone.material.opacity = 0.6;
  sc.scene.add(iArrow); axisLabels.push(iArrow);
  const iLbl = new THREE.Sprite(new THREE.SpriteMaterial({map: makeLabelTex('i', '#5588cc'), depthTest: false, transparent: true}));
  iLbl.scale.set(labelSz, labelSz, 1);
  iLbl.position.set(iX, iY, zMax + off * 0.5);
  sc.scene.add(iLbl); axisLabels.push(iLbl);

  axisLabelsBuilt = true;
  setAxisLabelsVisible(axisLabelsVisible);
}

function removeAxisLabels() {
  if (sc) axisLabels.forEach(obj => sc.scene.remove(obj));
  axisLabels = [];
  axisLabelsBuilt = false;
  jAxisArrow = null; jAxisLabel = null;
}

function setAxisLabelsVisible(v) {
  axisLabelsVisible = v;
  axisLabels.forEach(obj => { obj.visible = v; });
}

/* @testable */ export function showAxisLabels() {
  if (!axisLabelsBuilt) return;
  const chk = document.getElementById('chkAxes');
  if (chk && !chk.checked) return;
  setAxisLabelsVisible(true);
}

/* @testable */ export function hideAxisLabels() {
  setAxisLabelsVisible(false);
}

/* @testable */ export function toggleAxisLabels() {
  const chk = document.getElementById('chkAxes');
  if (!chk) return;
  if (chk.checked) showAxisLabels();
  else hideAxisLabels();
}

/* @testable */ export function updateJAxisCollapse(t) {
  if (!jAxisArrow || !jAxisLabel) return;
  // e is the eased collapse value matching applyCollapse's easing
  const e = -(Math.cos(Math.PI * t) - 1) / 2;
  const opacity = Math.max(0, 0.6 * (1 - e));
  // Shrink arrow length toward zero
  const len = Math.max(0.001, jAxisFullLen * (1 - e));  // min 0.001 to avoid ArrowHelper issues
  jAxisArrow.setLength(len, Math.min(jAxisHeadLen, len * 0.5), jAxisHeadW);
  jAxisArrow.line.material.opacity = opacity;
  jAxisArrow.cone.material.opacity = opacity;
  // Move label up toward the arrow origin as it shrinks, and fade
  const off = STEP * 0.35;
  const labelY = jAxisOriginY - len - off * 0.5;
  jAxisLabel.position.y = labelY;
  jAxisLabel.material.opacity = 1 - e;
  // Hide completely when fully collapsed
  if (t >= 1) { jAxisArrow.visible = false; jAxisLabel.visible = false; }
  else { jAxisArrow.visible = axisLabelsVisible; jAxisLabel.visible = axisLabelsVisible; }
}

export function rebuildBoxes() {
  cancelSnap();
  if (!sc) initScene();
  boxes.forEach(l => l.forEach(r => r.forEach(b => { sc.scene.remove(b.mesh); sc.scene.remove(b.edges); sc.scene.remove(b.spr); })));
  plusPlanes.forEach(pl => pl.forEach(s => sc.scene.remove(s)));
  removeAxisLabels();
  boxes = []; plusPlanes = [];
  const ox = -(K - 1) * STEP / 2, oz = -(I - 1) * STEP / 2;
  for (let i = 0; i < I; i++) {
    const layer = [];
    for (let j = 0; j < J; j++) {
      const row = [];
      for (let k = 0; k < K; k++) {
        const geo = new THREE.BoxGeometry(CELL, CELL, CELL);
        const mat = new THREE.MeshPhongMaterial({color: 0xeeeeee, transparent: true, opacity: 0.10, shininess: 30});
        const mesh = new THREE.Mesh(geo, mat);
        const px = ox + k * STEP, py = packedY(j), pz = oz + i * STEP;
        mesh.position.set(px, py, pz); sc.scene.add(mesh);
        const eg = new THREE.EdgesGeometry(geo);
        const em = new THREE.LineBasicMaterial({color: 0xcccccc, transparent: true, opacity: 0.22});
        const edges = new THREE.LineSegments(eg, em); edges.position.copy(mesh.position); sc.scene.add(edges);
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({transparent: true, depthTest: false}));
        spr.scale.set(CELL * 0.65, CELL * 0.65, 1); spr.position.set(px, py, pz); spr.visible = false; sc.scene.add(spr);
        row.push({mesh, mat, edges, em, spr, px, py, pz});
      }
      layer.push(row);
    }
    boxes.push(layer);
  }
  orb.theta = FIXED_THETA; orb.phi = FIXED_PHI;
  addAxisLabels(); // built but hidden until first box is populated
}

export function paintBox(i, j, k, col, opacity, emissive, val, textColor) {
  const b = boxes[i][j][k];
  b.mat.color.setHex(col); b.mat.opacity = opacity; b.mat.emissive.setHex(emissive || 0);
  b.em.color.setHex(col === 0xeeeeee ? 0xcccccc : col); b.em.opacity = opacity < 0.2 ? 0.18 : 0.65;
  b.mesh.visible = true; b.edges.visible = true;
  if (val != null) { b.spr.material.map = makeTex(val, textColor || '#ffffff'); b.spr.material.needsUpdate = true; b.spr.material.opacity = 1; b.spr.visible = true; }
  else { b.spr.visible = false; }
}

export function paintSlice(j, state) {
  for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
    if (state === 'empty') paintBox(i, j, k, 0xeeeeee, 0.10, 0, null);
    else if (state === 'active') paintBox(i, j, k, 0x2ab0a0, 0.95, 0x0a3030, Cube[i][j][k]);
    else if (state === 'building') paintBox(i, j, k, 0x2ab0a0, 0.40, 0, null);
    else paintBox(i, j, k, 0x50c878, 0.78, 0, Cube[i][j][k]);
  }
  if (state !== 'empty') showAxisLabels();
}

export function ensureAllGreen() { for (let j = 0; j < J; j++) paintSlice(j, 'done'); }

export function packedY(j) { return (J - 1) * STEP / 2 - j * STEP; }

export function addPlusPlanes() {
  removePlusPlanes();
  const tex = makePlusTex();
  for (let g = 0; g < J - 1; g++) {
    const midY = (packedY(g) + packedY(g + 1)) / 2;
    const plane = [];
    for (let i = 0; i < I; i++) for (let k = 0; k < K; k++) {
      const b = boxes[i][g][k];
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true, depthTest: false}));
      spr.scale.set(0.35, 0.35, 1);
      spr.position.set(b.px, midY, b.pz);
      sc.scene.add(spr);
      plane.push(spr);
    }
    plusPlanes.push(plane);
  }
}

export function removePlusPlanes() {
  if (sc) plusPlanes.forEach(pl => pl.forEach(s => sc.scene.remove(s)));
  plusPlanes = [];
}

// Clear all boxes from scene (used when switching away from 3D tabs)
export function clearBoxes() {
  if (sc) boxes.forEach(l => l.forEach(r => r.forEach(b => { sc.scene.remove(b.mesh); sc.scene.remove(b.edges); sc.scene.remove(b.spr); })));
  boxes = [];
  removeAxisLabels();
}
