// ══════════════════════════════════════════════════
// 3D CUBE MANAGEMENT
// ══════════════════════════════════════════════════
import { I, J, K, Cube } from './shared.js';
import { sc, orb, CELL, STEP, FIXED_THETA, FIXED_PHI, makeTex, makePlusTex, initScene, cancelSnap } from './scene.js';

const THREE = window.THREE;

export let boxes = [];
export let plusPlanes = [];
let axisLabels = [];   // sprites + lines
let axisLabelsBuilt = false;  // true once addAxisLabels has run for current boxes
let axisLabelsVisible = false;

// Draw letter + arrow on a canvas sprite texture
// dir: 'right' | 'up' | 'down-z' controls arrow direction
function makeAxisTex(letter, color, dir) {
  const S = 128, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  // Letter
  ctx.font = `bold ${Math.round(S * 0.38)}px 'SF Mono', Menlo, Consolas, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (dir === 'right') {
    ctx.fillText(letter, S * 0.28, S * 0.5);
    // Arrow →
    const ax = S * 0.52, ay = S * 0.5, aw = S * 0.32;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + aw, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + aw - 6, ay - 5); ctx.lineTo(ax + aw, ay); ctx.lineTo(ax + aw - 6, ay + 5); ctx.stroke();
  } else if (dir === 'up') {
    ctx.fillText(letter, S * 0.5, S * 0.72);
    // Arrow ↑
    const ax = S * 0.5, ay = S * 0.48, ah = S * 0.32;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - ah); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax - 5, ay - ah + 6); ctx.lineTo(ax, ay - ah); ctx.lineTo(ax + 5, ay - ah + 6); ctx.stroke();
  } else { // 'down-z' — arrow pointing toward viewer (down-right in screen space)
    ctx.fillText(letter, S * 0.28, S * 0.35);
    const ax = S * 0.50, ay = S * 0.45, al = S * 0.30;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + al * 0.6, ay + al * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + al * 0.6 - 7, ay + al * 0.8 - 2); ctx.lineTo(ax + al * 0.6, ay + al * 0.8); ctx.lineTo(ax + al * 0.6 - 1, ay + al * 0.8 - 7); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

function addAxisLabels() {
  removeAxisLabels();
  if (!sc) return;
  const pad = STEP * 0.45;
  // Cube extents (centered at origin)
  const xMax =  (K - 1) * STEP / 2 + CELL / 2;
  const yMin = packedY(J - 1) - CELL / 2;
  const yMax = packedY(0) + CELL / 2;
  const zMax =  (I - 1) * STEP / 2 + CELL / 2;
  const sz = CELL * 0.48;
  // k along X axis — bottom-front edge, right end
  const kSpr = new THREE.Sprite(new THREE.SpriteMaterial({map: makeAxisTex('k', '#5588cc', 'right'), depthTest: false, transparent: true}));
  kSpr.scale.set(sz, sz, 1);
  kSpr.position.set(xMax + pad, yMin - pad * 0.15, zMax + pad * 0.15);
  sc.scene.add(kSpr); axisLabels.push(kSpr);
  // j along Y axis — right-front edge, top (contracted = red)
  const jSpr = new THREE.Sprite(new THREE.SpriteMaterial({map: makeAxisTex('j', '#d04040', 'up'), depthTest: false, transparent: true}));
  jSpr.scale.set(sz, sz, 1);
  jSpr.position.set(xMax + pad * 0.15, yMax + pad, zMax + pad * 0.15);
  sc.scene.add(jSpr); axisLabels.push(jSpr);
  // i along Z axis — bottom-right edge, front
  const iSpr = new THREE.Sprite(new THREE.SpriteMaterial({map: makeAxisTex('i', '#5588cc', 'down-z'), depthTest: false, transparent: true}));
  iSpr.scale.set(sz, sz, 1);
  iSpr.position.set(xMax + pad * 0.15, yMin - pad * 0.15, zMax + pad);
  sc.scene.add(iSpr); axisLabels.push(iSpr);
  axisLabelsBuilt = true;
  // Respect current visibility (hidden until first box populated + checkbox on)
  setAxisLabelsVisible(axisLabelsVisible);
}

function removeAxisLabels() {
  if (sc) axisLabels.forEach(s => sc.scene.remove(s));
  axisLabels = [];
  axisLabelsBuilt = false;
}

function setAxisLabelsVisible(v) {
  axisLabelsVisible = v;
  axisLabels.forEach(s => { s.visible = v; });
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
