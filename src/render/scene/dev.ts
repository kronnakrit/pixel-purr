// Dev harness for the play field (dev/scene.html): loads ?level=N, autoplays the stored solution at 36 steps/s
// (or manual taps), booster buttons and a celebrate button. Fake HUD insets: top 96, bottom 120.
// Query: level, moves (solution moves played before loading), greedy (careless moves after those, fills the tray),
// manual=1, paused=1, rm=1 (reduced motion).
// window.__scene exposes helpers for screenshots.
import '../../fonts';
import { Game, level, mulberry32, type GameEvent, type Level, type Move } from '../../engine';
import { createGameScene, type GameScene } from './index';

const STEPS_PER_SEC = 36;
const qs = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const scene = createGameScene(canvas, { reducedMotion: qs.get('rm') === '1' });
scene.setInsets({ top: 96, bottom: 120, left: 0, right: 0 });
addEventListener('resize', () => scene.resize());

let n = Math.max(1, Number(qs.get('level')) || 1), L: Level, game: Game, plan: Move[] = [], k = 0;
let auto = qs.get('manual') !== '1', paused = qs.get('paused') === '1', acc = 0, wait = 0, rng = mulberry32(7);
const $ = (s: string) => document.querySelector<HTMLElement>(s)!;

function load(lv: number, moves = 0, greedy = 0) {
  n = Math.max(1, lv);
  L = level(n);
  game = new Game(L);
  plan = L.solution?.plan ?? [];
  k = 0; acc = 0; wait = 0.5; rng = mulberry32(7 + n);
  for (; k < Math.min(moves, plan.length); k++) { play(plan[k]!); game.settle(); } // jump to mid-game without animation
  // careless play (always the last queue that can go) to fill the tray, for testing tray states
  for (let i = 0; i < greedy && game.status === 'playing'; i++) {
    let q = game.queues.length - 1;
    while (q >= 0 && !game.canLaunchQueue(q)) q--;
    if (q < 0) break;
    game.launchQueue(q); game.settle();
  }
  scene.load(game);
  $('#title').textContent = `Level ${n}`;
  status();
}

function play(m: Move): GameEvent[] {
  return m.kind === 'q' ? game.launchQueue(m.qs[0]!) : game.launchTray(m.i);
}

/** Next solution move; after boosters change the state, any move that can go. */
function launchNext(): GameEvent[] {
  const m = plan[k];
  let ev = m ? play(m) : [];
  if (ev.length) { k++; return ev; }
  for (let q = 0; q < game.queues.length && !ev.length; q++) ev = game.launchQueue(q);
  for (let i = 0; i < game.tray.length && !ev.length; i++) ev = game.launchTray(i);
  return ev;
}

function apply(ev: GameEvent[]) {
  if (!ev.length) return;
  scene.apply(ev);
  if (ev.some(e => e.type === 'won')) void scene.celebrate().then(() => status('· celebrated'));
  status();
}

function status(extra = '') {
  $('#status').textContent = `${L.name} ${L.w}×${L.h} · ${game.left} px left · belt ${game.beltFree}/${L.belt} · tray ${game.tray.length}/${game.trayCap} · move ${k}/${plan.length} · ${game.status} ${extra}`;
}

/** Advance the simulation by dt: autoplay, engine steps at 36/s. */
function sim(dt: number, render = true) {
  if (!paused) {
    if (auto && game.status === 'playing' && !game.riders.length && (wait -= dt) <= 0) { apply(launchNext()); wait = 0.35; }
    acc += dt;
    const step = 1 / STEPS_PER_SEC;
    while (acc >= step) { acc -= step; apply(game.step()); }
  }
  (scene as GameScene).frame(dt, acc * STEPS_PER_SEC, render);
}

let last = performance.now();
function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  sim(dt);
  requestAnimationFrame(tick);
}

scene.onTap(t => {
  if (auto) return;
  apply(t.kind === 'queue' ? game.launchQueue(t.q) : game.launchTray(t.i));
});

$('#prev').onclick = () => load(n - 1);
$('#next').onclick = () => load(n + 1);
$('#restart').onclick = () => load(n);
$('#mode').onclick = () => { auto = !auto; $('#mode').textContent = auto ? 'Auto' : 'Manual'; $('#mode').classList.toggle('on', !auto); };
$('#win').onclick = () => void scene.celebrate().then(() => status('· celebrated'));
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-b]')) {
  b.onclick = () => {
    const key = b.dataset.b;
    apply(key === 'slot' ? game.addTraySlot() : key === 'shuffle' ? game.shuffleQueues(rng) : key === 'nap' ? game.napTray() : game.armXray());
  };
}

load(n, Number(qs.get('moves')) || 0, Number(qs.get('greedy')) || 0);
$('#mode').textContent = auto ? 'Auto' : 'Manual';
$('#mode').classList.toggle('on', !auto);
requestAnimationFrame(tick);

/** Screenshot helpers: drive the field deterministically from tools/dev/shot.cjs --eval. */
Object.assign(window, {
  __scene: {
    scene, get game() { return game; },
    load, launch: () => apply(launchNext()),
    /** Simulate `sec` seconds in fixed 1/60 s frames (autoplay and engine steps included unless paused). */
    advance(sec: number) { const was = paused; paused = false; for (let t = 0; t < sec; t += 1 / 60) sim(1 / 60, false); paused = was; status(); return game.status; },
    /** Only animate (no engine steps) for `sec` seconds. */
    animate(sec: number) { const was = paused; paused = true; for (let t = 0; t < sec; t += 1 / 60) sim(1 / 60, false); paused = was; },
    pause(on: boolean) { paused = on; },
    setAuto(on: boolean) { auto = on; },
    boost(key: 'slot' | 'shuffle' | 'nap' | 'xray') { apply(key === 'slot' ? game.addTraySlot() : key === 'shuffle' ? game.shuffleQueues(rng) : key === 'nap' ? game.napTray() : game.armXray()); },
    celebrate: () => scene.celebrate(),
    point: (t: Parameters<typeof scene.screenPoint>[0]) => scene.screenPoint(t),
    /** Contact sheet: every `step` seconds (cols × rows shots) render the field into a grid overlay, for reviewing motion. */
    film(step: number, cols = 4, rows = 3, scale = 0.5, crop?: [number, number, number, number]) {
      const k = canvas.width / canvas.clientWidth, [cx, cy, cw, ch] = crop ?? [0, 0, canvas.clientWidth, canvas.clientHeight];
      const w = cw * k * scale, h = ch * k * scale, out = document.createElement('canvas');
      out.width = w * cols; out.height = h * rows;
      const g = out.getContext('2d')!;
      g.fillStyle = '#33276F'; g.fillRect(0, 0, out.width, out.height);
      paused = false;
      for (let i = 0; i < cols * rows; i++) {
        for (let t = 0; t < step - 1e-6; t += 1 / 60) sim(1 / 60, false);
        sim(0, true);
        g.drawImage(canvas, cx * k, cy * k, cw * k, ch * k, (i % cols) * w, Math.floor(i / cols) * h, w, h);
        g.fillStyle = '#fff'; g.font = '700 22px sans-serif'; g.fillText(`${(i + 1) * step}s`.slice(0, 5), (i % cols) * w + 8, Math.floor(i / cols) * h + 26);
      }
      paused = true;
      out.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;z-index:9;background:#1a1240';
      document.body.append(out);
    },
    /** Play the whole solution instantly, leaving the board empty on 'won'. */
    finish() { while (game.status === 'playing') { const ev = launchNext(); if (!ev.length) break; apply(ev); apply(game.settle()); } return game.status; },
  },
});
