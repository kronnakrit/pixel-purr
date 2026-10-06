// Phase 0 sandbox: renders a launch level and autoplays its stored solution, with an fps meter.
// Used to check Three.js performance inside the Capacitor WebView on real (and cheap) phones.
import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Game, level, V1_COUNT, type Level, type Move } from './engine';
import { BoardView } from './render/BoardView';

const STEPS_PER_SEC = 40;
const native = Capacitor.isNativePlatform();

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x2a1f4a);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5c8e, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(-6, 14, 10);
scene.add(sun);

// Orthographic with a slight top-down tilt, like the reference.
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
camera.position.set(0, 60, 26);
camera.lookAt(0, 0, 0);

let n = 1, L: Level, game: Game, view: BoardView | null = null, plan: Move[] = [], step = 0, acc = 0;

function load(k: number) {
  n = ((k - 1 + V1_COUNT) % V1_COUNT) + 1;
  L = level(n);
  if (view) { scene.remove(view.group); view.dispose(); }
  game = new Game(L);
  view = new BoardView(game);
  scene.add(view.group);
  plan = L.solution?.plan ?? [];
  step = 0; acc = 0;
  resize();
  hud();
}

function hud() {
  document.querySelector('#title')!.textContent = `${n}. ${L.name}`;
  document.querySelector('#info')!.textContent =
    `${L.w}×${L.h} · ${L.total} pixels · ${L.queues.flat().length} Purrlets · tray ${game.tray.length}/${L.tray} · ${game.status}`;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight, aspect = w / h, ext = view ? view.extent : 30;
  const half = Math.max(ext / 2 / aspect, ext / 2) * 1.12; // fit the board in the narrower direction
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function tick() {
  if (game.status !== 'playing') return;
  if (!game.riders.length && step < plan.length) { // one Purrlet at a time, following the stored solution
    const m = plan[step++]!;
    view!.handle(m.kind === 'q' ? game.launchQueue(m.qs[0]!) : game.launchTray(m.i));
  }
  const ev = game.step();
  view!.handle(ev);
  if (native && ev.some(e => e.type === 'pop' || e.type === 'won')) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  if (ev.length) hud();
}

let last = performance.now(), fpsT = 0, fpsN = 0;
renderer.setAnimationLoop(now => {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  acc += dt * STEPS_PER_SEC;
  while (acc >= 1) { tick(); acc -= 1; }
  view?.update(dt, acc);
  renderer.render(scene, camera);
  fpsT += dt; fpsN++;
  if (fpsT >= 0.5) { document.querySelector('#fps')!.textContent = `${Math.round(fpsN / fpsT)} fps`; fpsT = 0; fpsN = 0; }
});

window.addEventListener('resize', resize);
document.querySelector('#prev')!.addEventListener('click', () => load(n - 1));
document.querySelector('#next')!.addEventListener('click', () => load(n + 1));
document.querySelector('#play')!.addEventListener('click', () => load(n));
load(Number(new URLSearchParams(location.search).get('level')) || 1);
