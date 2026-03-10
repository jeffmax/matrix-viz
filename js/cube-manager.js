// ══════════════════════════════════════════════════
// 3D CUBE MANAGEMENT
// ══════════════════════════════════════════════════
import { I, J, K, Cube } from './shared.js';
import { sc, orb, CELL, STEP, FIXED_THETA, FIXED_PHI, makeTex, makePlusTex, initScene, cancelSnap } from './scene.js';

const THREE = window.THREE;

export let boxes = [];
export let plusPlanes = [];

export function rebuildBoxes() {
  cancelSnap();
  if (!sc) initScene();
  boxes.forEach(l => l.forEach(r => r.forEach(b => { sc.scene.remove(b.mesh); sc.scene.remove(b.edges); sc.scene.remove(b.spr); })));
  plusPlanes.forEach(pl => pl.forEach(s => sc.scene.remove(s)));
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
}
