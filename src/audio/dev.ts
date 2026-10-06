// Dev harness for sound and haptics (dev/audio.html): a button per sound, music and settings controls, engine-driven
// moments (paint streak, autoplay a level, fill the tray) and the offline check. window.__audioCheck() runs the
// check headlessly and returns the numbers.
import '../fonts';
import type { Sfx } from '../app/contracts';
import { Game, level, type GameEvent, type Level } from '../engine';
import { audioCheck, checkSfx, type SfxStats } from './check';
import { audio, audioDebug, audioLevel } from './index';
import { SFX_NAMES } from './synth';

declare global {
  interface Window { __audioCheck: typeof audioCheck; __audio: typeof audio; __audioLevel: typeof audioLevel; __audioDebug: typeof audioDebug }
}
window.__audioCheck = audioCheck;
window.__audio = audio;
window.__audioLevel = audioLevel;
window.__audioDebug = audioDebug;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

addEventListener('pointerdown', () => audio.unlock(), { capture: true });

const WHAT: Record<Sfx, string> = {
  button: 'click', tap: 'soft pop', blocked: 'gentle bonk', paint: 'plink, rising', pop: 'sparkle chime', park: 'soft thud',
  reveal: 'ta-da', win: 'fanfare', lose: 'low "oh no"', worry: '"uh-oh"', coin: 'tick', booster: 'whoosh', unlock: 'jingle',
  shuffle: 'yarn swish', nap: 'sleepy slide', xray: 'zap shimmer', cushion: 'poof', gift: 'jingle',
};

// ---------------------------------------------------------------- settings + music

const set = { sound: true, music: true, vibration: true, background: false };
function toggles() {
  const row = $('#toggles');
  row.replaceChildren();
  for (const k of Object.keys(set) as (keyof typeof set)[]) {
    const b = el('button', set[k] ? (k === 'background' ? 'go' : 'on') : 'off', `${k[0]!.toUpperCase()}${k.slice(1)} ${set[k] ? 'on' : 'off'}`);
    b.onclick = () => {
      set[k] = !set[k];
      if (k === 'sound') audio.setSound(set.sound);
      else if (k === 'music') audio.setMusic(set.music);
      else if (k === 'vibration') audio.setVibration(set.vibration);
      else audio.suspend(set.background);
      toggles();
    };
    row.append(b);
  }
}

let track: 'home' | 'play' | null = null;
function musicRow() {
  const row = $('#music');
  row.replaceChildren();
  for (const t of ['home', 'play', null] as const) {
    const b = el('button', track === t ? 'on' : '', t ? `${t[0]!.toUpperCase()}${t.slice(1)} loop` : 'Stop');
    b.onclick = () => { track = t; audio.music(t); audio.play('button'); musicRow(); };
    row.append(b);
  }
}

// ---------------------------------------------------------------- effect buttons

const cards = new Map<Sfx, { b: HTMLButtonElement; c: HTMLCanvasElement; i: HTMLElement }>();
for (const s of SFX_NAMES) {
  const b = el('button', 'sfx'), c = el('canvas'), i = el('em'), head = el('span', 'head');
  head.append(el('b', '', s), i);
  b.append(head, el('i', '', WHAT[s]), c);
  b.onclick = () => {
    audio.play(s);
    if (s === 'pop') audio.haptic('medium'); else if (s === 'win') audio.haptic('success'); else if (s === 'lose' || s === 'worry') audio.haptic('warning'); else audio.haptic('light');
    b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
  };
  cards.set(s, { b, c, i });
  $('#sfx').append(b);
}

/** Peak envelope on a dB scale (-54 dB at the centre line, 0 dB at the edges); gold ticks mark the 0.9 ceiling. */
function drawWave(c: HTMLCanvasElement, wave: number[], color: string) {
  const r = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight, FLOOR = -54;
  c.width = Math.round(w * r); c.height = Math.round(h * r);
  const g = c.getContext('2d')!;
  g.scale(r, r);
  const bw = w / wave.length, unit = (v: number) => Math.max(0, Math.min(1, (20 * Math.log10(Math.max(v, 1e-6)) - FLOOR) / -FLOOR));
  g.fillStyle = color;
  wave.forEach((v, k) => { const bh = Math.max(1, unit(v) * (h - 6)); g.fillRect(k * bw + 0.5, (h - bh) / 2, Math.max(1, bw - 1), bh); });
  const ceil = unit(0.9) * (h - 6) / 2;
  g.fillStyle = 'rgba(255,201,59,.55)';
  g.fillRect(0, h / 2 - ceil - 1, w, 1); g.fillRect(0, h / 2 + ceil, w, 1);
}

function showSfx(st: SfxStats) {
  const k = cards.get(st.sfx)!;
  drawWave(k.c, st.wave, st.ok ? '#9FF0A8' : '#FFB0A4');
  k.i.textContent = `${st.dur.toFixed(2)} s`;
  k.b.classList.toggle('bad', !st.ok);
}

// ---------------------------------------------------------------- moments

const status = (t: string) => { $('#status').textContent = t; };
const fakeTray = { tray: [] as unknown[], trayCap: 5 } as unknown as Game;
let stopSim: (() => void) | null = null;

/** Two riders painting 18 pixels along a row at 36 steps/s: shows the 14/s throttle and the rising streak. */
function streak() {
  let k = 0;
  const id = setInterval(() => {
    const ev: GameEvent[] = [{ type: 'shot', id: 1, s: k, j: k }];
    if (k % 3 === 1) ev.push({ type: 'shot', id: 2, s: k + 9, j: 100 + k });
    audio.gameEvents(ev, fakeTray);
    if (++k >= 18) { clearInterval(id); setTimeout(() => audio.gameEvents([{ type: 'pop', id: 1 }], fakeTray), 60); }
  }, 1000 / 36);
  status('paint streak: 18 steps, 24 shots → throttled plinks, then a pop');
}

function coins() {
  let k = 0;
  const id = setInterval(() => { audio.play('coin'); if (++k >= 10) clearInterval(id); }, 70);
}

/** Run a level in real time and feed every engine batch to audio.gameEvents. greedy: careless taps fill the tray. */
function autoplay(n: number, greedy: boolean) {
  stopSim?.();
  const L: Level = level(n), game = new Game(L), plan = L.solution?.plan ?? [];
  let k = 0, acc = 0, wait = 0.3, last = performance.now(), raf = 0, events = 0;
  const feed = (ev: GameEvent[]) => { if (ev.length) { events += ev.length; audio.gameEvents(ev, game); } };
  const launch = (): GameEvent[] => {
    if (greedy) {
      for (let q = game.queues.length - 1; q >= 0; q--) if (game.canLaunchQueue(q)) return game.launchQueue(q);
      return [];
    }
    const m = plan[k];
    const ev = m ? (m.kind === 'q' ? game.launchQueue(m.qs[0]!) : game.launchTray(m.i)) : [];
    if (ev.length) k++;
    return ev;
  };
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if ((wait -= dt) <= 0 && game.status === 'playing') { const ev = launch(); feed(ev); wait = ev.length ? 0.55 : 0.1; }
    for (acc += dt; acc >= 1 / 36 && game.status === 'playing'; acc -= 1 / 36) feed(game.step());
    status(`${L.name} · ${game.left} px left · tray ${game.tray.length}/${game.trayCap} · ${game.status} · ${events} events`);
    if (game.status === 'playing' && (game.riders.length || game.queues.some(q => q.length) || game.tray.length)) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  stopSim = () => cancelAnimationFrame(raf);
}

const moments: [string, () => void, string?][] = [
  ['Paint streak', streak, 'go'],
  ['Coin shower', coins],
  ['Autoplay level 3', () => autoplay(3, false), 'blue'],
  ['Autoplay level 12', () => autoplay(12, false), 'blue'],
  ['Fill the tray', () => autoplay(8, true)],
  ['Stop', () => { stopSim?.(); status('stopped'); }, 'off'],
];
for (const [label, fn, cls] of moments) { const b = el('button', cls ?? '', label); b.onclick = fn; $('#moments').append(b); }

// ---------------------------------------------------------------- offline check

const f2 = (x: number) => x.toFixed(2);
async function runCheck() {
  $('#check').textContent = 'Rendering…';
  const r = await audioCheck();
  for (const s of r.sfx) showSfx(s);
  const t = el('table', 'tbl');
  t.innerHTML = '<tr><th>sound</th><th>len s</th><th>heard s</th><th>peak</th><th>pre</th><th>rms dB</th><th>Hz</th><th></th></tr>';
  for (const s of r.sfx) {
    const tr = el('tr');
    tr.innerHTML = `<td>${s.sfx}</td><td>${f2(s.intended)}</td><td>${f2(s.dur)}</td><td>${f2(s.peak)}</td><td>${f2(s.prePeak)}</td>`
      + `<td>${s.rmsDb.toFixed(0)}</td><td>${s.centroid}</td><td class="${s.ok ? 'ok' : 'no'}">${s.ok ? 'ok' : s.why.join('; ')}</td>`;
    t.append(tr);
  }
  const m = el('table', 'tbl');
  m.innerHTML = '<tr><th>music</th><th>s</th><th>peak</th><th>rms dB</th><th>min 1 s</th><th>max 1 s</th><th>Hz</th><th></th></tr>';
  for (const s of r.music) {
    const tr = el('tr');
    tr.innerHTML = `<td>${s.track}</td><td>${s.seconds}</td><td>${f2(s.peak)}</td><td>${s.rmsDb.toFixed(0)}</td><td>${s.minWinDb.toFixed(0)}</td>`
      + `<td>${s.maxWinDb.toFixed(0)}</td><td>${s.centroid}</td><td class="${s.ok ? 'ok' : 'no'}">${s.ok ? 'ok' : s.why.join('; ')}</td>`;
    m.append(tr);
  }
  const waves = r.music.map(s => { const c = el('canvas', 'music-wave'); return [c, s.wave, s.ok, s.track] as const; });
  const extra = el('p', 'note', `Pile-up (every sound at once + 3 pops + 10 plinks + 8 coins over play music): peak ${f2(r.stack.peak)}, `
    + `${f2(r.stack.prePeak)} before the soft clipper. Streak of ${r.streak.notes} plinks: peak ${f2(r.streak.peak)}. Rendered in ${r.ms} ms at ${r.sampleRate} Hz.`);
  $('#report').replaceChildren(t, m, ...waves.flatMap(w => [el('div', 'wave-label', `${w[3]} · dB scale`), w[0]]), extra);
  for (const [c, w, ok] of waves) drawWave(c, w, ok ? '#9FD8FF' : '#FFB0A4');
  const v = $('#verdict');
  v.textContent = r.ok ? 'all good' : 'needs work'; v.className = r.ok ? 'ok' : 'no';
  $('#check').textContent = 'Render and measure everything';
  return r;
}
$('#check').onclick = () => { void runCheck(); };
/** Headless: render the report into the page too (for screenshots). */
(window as unknown as { __audioReport: typeof runCheck }).__audioReport = runCheck;
(window as unknown as { __checkSfx: typeof checkSfx }).__checkSfx = checkSfx;

// ---------------------------------------------------------------- state chip

let hold = 0;
setInterval(() => {
  const d = audioDebug(), c = $('#state');
  hold = Math.max(audioLevel(), hold * 0.8);
  c.textContent = `audio: ${d.state}${d.native ? ' · native' : ''}${d.state === 'running' ? ` · ${hold.toFixed(2)}` : ''}`;
  c.classList.toggle('on', d.state === 'running');
  $('#track').textContent = d.track ?? 'off';
}, 250);

toggles();
musicRow();
// fill the little waveforms right away (offline renders need no gesture)
void (async () => { for (const s of SFX_NAMES) showSfx(await checkSfx(s)); })();
