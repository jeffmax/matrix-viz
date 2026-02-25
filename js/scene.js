// ══════════════════════════════════════════════════
// THREE.JS — ONE SCENE, ONE CANVAS
// ══════════════════════════════════════════════════
import { I, J, K } from './shared.js';

const THREE = window.THREE;

export const CELL = 0.78, GAP = 0.13, STEP = CELL + GAP;
export const FIXED_THETA = 0.50, FIXED_PHI = 0.62;

export let sc = null, orb = null;

export function makeTex(text, color) {
  const S = 128, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color || '#fff';
  ctx.font = `bold ${Math.round(S * 0.40)}px Helvetica Neue,Helvetica,Arial,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(text), S / 2, S / 2);
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

export function makePlusTex() {
  const S = 128, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
  ctx.fillStyle = '#50c878';
  ctx.font = `bold ${Math.round(S * 0.75)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('+', S / 2, S / 2);
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

export function initScene() {
  const canvas = document.getElementById('mainCanvas');
  const W = canvas.width, H = canvas.height;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H); renderer.setClearColor(0xfafafa, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 0.82));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.48); d1.position.set(6, 9, 7); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.18); d2.position.set(-4, 2, -4); scene.add(d2);
  const o = {theta: FIXED_THETA, phi: FIXED_PHI, dragging: false, lx: 0, ly: 0};
  canvas.addEventListener('mousedown', e => { o.dragging = true; o.lx = e.clientX; o.ly = e.clientY; });
  window.addEventListener('mouseup', () => { o.dragging = false; });
  window.addEventListener('mousemove', e => {
    if (!o.dragging) return;
    o.theta -= (e.clientX - o.lx) * 0.015; o.phi -= (e.clientY - o.ly) * 0.015;
    o.phi = Math.max(0.08, Math.min(Math.PI - 0.08, o.phi));
    o.lx = e.clientX; o.ly = e.clientY;
  });
  canvas.addEventListener('touchstart', e => { o.dragging = true; o.lx = e.touches[0].clientX; o.ly = e.touches[0].clientY; e.preventDefault(); }, {passive: false});
  canvas.addEventListener('touchend', () => { o.dragging = false; });
  canvas.addEventListener('touchmove', e => {
    if (!o.dragging) return;
    o.theta -= (e.touches[0].clientX - o.lx) * 0.015;
    o.phi -= (e.touches[0].clientY - o.ly) * 0.015;
    o.phi = Math.max(0.08, Math.min(Math.PI - 0.08, o.phi));
    o.lx = e.touches[0].clientX; o.ly = e.touches[0].clientY; e.preventDefault();
  }, {passive: false});
  sc = {scene, camera, renderer}; orb = o;
  (function loop() {
    requestAnimationFrame(loop);
    const r = Math.max(I, J, K) * STEP * 2.2 + 1.4;
    camera.position.set(r * Math.sin(o.phi) * Math.sin(o.theta), r * Math.cos(o.phi), r * Math.sin(o.phi) * Math.cos(o.theta));
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  })();
}

export function moveCanvasTo(hostId) {
  const canvas = document.getElementById('mainCanvas');
  if (!canvas) return;
  const host = document.getElementById(hostId);
  if (!host) return;
  if (canvas.parentElement !== host) host.appendChild(canvas);
}
