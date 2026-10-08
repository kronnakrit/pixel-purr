// Dev harness (dev/purrlet.html): every colour plus a mystery cat under the tilted orthographic game camera,
// a big close-up, and buttons for every mood and one-shot. window.pp drives it from scripts/screenshots.
import * as THREE from 'three';
import '../../fonts';
import { PALETTE } from '../../engine';
import { PurrletView, purrletLean, setPurrletLean, warmupPurrlets, type PurrletMood } from './index';

const q = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.info.autoReset = false;

/** The lights the game scene uses (src/main.ts sandbox): hemisphere fill plus a sun from the upper left. */
function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5c8e, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-6, 14, 10);
  scene.add(sun);
}

const state = {
  pitch: Number(q.get('pitch') ?? 60) * Math.PI / 180,
  close: Number(q.get('close') ?? 1),
  paused: false,
  /** Grid zoom-out: 1 fits the grid; about 2.2 shows cats at belt size (~25 px), 1.4 at queue size (~40 px). */
  zoom: Number(q.get('zoom') ?? 1),
  reduced: q.get('reduced') === '1',
};
if (q.get('lean') != null) setPurrletLean(Number(q.get('lean')));

const gridScene = new THREE.Scene(), closeScene = new THREE.Scene();
lights(gridScene); lights(closeScene);
const ground = (s: THREE.Scene, size: number) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a2058, transparent: true, opacity: 0.35 }));
  m.position.y = -0.002; s.add(m);
};
ground(gridScene, 30);

const cats: PurrletView[] = [];
const COLS = 5, DX = 1.22, DZ = 1.5;
const n = PALETTE.length - 1;
for (let i = 0; i <= n; i++) {
  const mystery = i === n, c = mystery ? 7 : i + 1;
  const cat = new PurrletView({ color: c, ammo: [20, 30, 40, 50][i % 4]!, hidden: mystery, seed: i * 31 + 5, reducedMotion: state.reduced });
  const col = i % COLS, row = Math.floor(i / COLS);
  cat.object.position.set((col - (COLS - 1) / 2) * DX, 0, (1 - row) * DZ);
  gridScene.add(cat.object);
  cats.push(cat);
}
let close = makeClose(state.close);
function makeClose(c: number): PurrletView {
  const cat = new PurrletView({ color: c === 0 ? 7 : c, ammo: 30, hidden: c === 0, seed: 99, reducedMotion: state.reduced });
  closeScene.add(cat.object);
  return cat;
}
const all = () => [...cats, close];

const gridCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const closeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
function aim(cam: THREE.OrthographicCamera, target: THREE.Vector3, halfH: number, aspect: number): void {
  cam.position.set(target.x, target.y + Math.sin(state.pitch) * 30, target.z + Math.cos(state.pitch) * 30);
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  cam.top = halfH; cam.bottom = -halfH; cam.left = -halfH * aspect; cam.right = halfH * aspect;
  cam.updateProjectionMatrix();
}

// ---------------------------------------------------------------- controls

const MOODS: PurrletMood[] = ['idle', 'ride', 'nap', 'worry', 'dance', 'cheer'];
let mood: PurrletMood = (q.get('mood') as PurrletMood | null) ?? 'idle';
const btn = (parent: string, label: string, cls: string, fn: () => void) => {
  const b = document.createElement('button'); b.textContent = label; b.className = cls; b.onclick = fn;
  document.getElementById(parent)!.append(b); return b;
};
const moodBtns = MOODS.map(m => btn('moods', m, '', () => setMood(m)));
function setMood(m: PurrletMood): void {
  mood = m;
  all().forEach((c, i) => c.setMood(m, m === 'dance' ? { delay: (i % COLS) * 0.15 } : {}));
  moodBtns.forEach((b, i) => b.classList.toggle('on', MOODS[i] === m));
}
function act(a: string): void {
  for (const c of all()) {
    if (a === 'hop') c.hop();
    else if (a === 'shoot') c.shoot({ x: 0, z: -1 });
    else if (a === 'land') c.land();
    else if (a === 'pop') void c.pop().then(() => setTimeout(() => { c.reset(); c.setMood(mood); }, 1200));
    else if (a === 'reveal') { if (c.hidden) c.setHidden(false); else { c.setHidden(true); setTimeout(() => c.setHidden(false), 400); } }
  }
}
for (const a of ['hop', 'shoot', 'land', 'pop', 'reveal']) btn('acts', a, 'act', () => act(a));
btn('acts', 'burst', 'act', () => { let k = 0; const id = setInterval(() => { act('shoot'); if (++k >= 6) clearInterval(id); }, 120); });
btn('opts', '‹', '', () => swapClose(-1));
btn('opts', '›', '', () => swapClose(1));
btn('opts', 'lean−', '', () => setPurrletLean(Math.max(0, purrletLean() - 0.1)));
btn('opts', 'lean+', '', () => setPurrletLean(purrletLean() + 0.1));
btn('opts', 'pitch−', '', () => { state.pitch = Math.max(0, state.pitch - 5 * Math.PI / 180); });
btn('opts', 'pitch+', '', () => { state.pitch = Math.min(Math.PI / 2, state.pitch + 5 * Math.PI / 180); });
const rmBtn = btn('opts', 'calm', '', () => { state.reduced = !state.reduced; all().forEach(c => c.setReducedMotion(state.reduced)); rmBtn.classList.toggle('on', state.reduced); });
rmBtn.classList.toggle('on', state.reduced);
function swapClose(d: number): void {
  state.close = (state.close + d + n + 1) % (n + 1);
  close.dispose();
  close = makeClose(state.close);
  close.setMood(mood);
}
setMood(mood);

// ---------------------------------------------------------------- loop

function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const closeH = Math.round(h * 0.4), gridTop = closeH + 10, gridH = Math.round(h * 0.38);
  return { w, h, close: { x: 0, y: h - closeH, w, h: closeH - 30 + 30 }, grid: { x: 0, y: h - gridTop - gridH, w, h: gridH } };
}

function render(): void {
  const L = layout();
  renderer.info.reset();
  renderer.setScissorTest(true);
  renderer.clear();
  const cv = L.close;
  aim(closeCam, new THREE.Vector3(0, 0.5, 0), 0.82, cv.w / cv.h);
  renderer.setViewport(cv.x, cv.y, cv.w, cv.h); renderer.setScissor(cv.x, cv.y, cv.w, cv.h);
  renderer.render(closeScene, closeCam);
  const gv = L.grid;
  aim(gridCam, new THREE.Vector3(0, 0.45, -0.1), state.zoom * Math.max(2.3, 3.4 / (gv.w / gv.h)), gv.w / gv.h);
  renderer.setViewport(gv.x, gv.y, gv.w, gv.h); renderer.setScissor(gv.x, gv.y, gv.w, gv.h);
  renderer.render(gridScene, gridCam);
  document.getElementById('stats')!.textContent =
    `${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · lean ${(purrletLean() * 180 / Math.PI).toFixed(0)}° · pitch ${(state.pitch * 180 / Math.PI).toFixed(0)}°`;
}

function step(dt: number): void { for (const c of all()) c.update(dt); }

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (!state.paused) step(dt);
  render();
  requestAnimationFrame(frame);
}

// Scripted control for screenshots: pp.pause(true); pp.act('hop'); pp.step(0.15)
Object.assign(window, {
  pp: {
    mood: setMood, act, render,
    pause: (on: boolean) => { state.paused = on; },
    step: (sec: number) => { for (let t = 0; t < sec - 1e-6; t += 1 / 60) step(Math.min(1 / 60, sec - t)); render(); },
    set: (o: { pitch?: number; lean?: number; close?: number; zoom?: number }) => {
      if (o.zoom != null) state.zoom = o.zoom;
      if (o.pitch != null) state.pitch = o.pitch * Math.PI / 180;
      if (o.lean != null) setPurrletLean(o.lean);
      if (o.close != null) { state.close = o.close; swapClose(0); }
      render();
    },
    cats: all,
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length }),
  },
});

void warmupPurrlets(renderer, { scene: gridScene, camera: gridCam }).then(() => requestAnimationFrame(frame));
