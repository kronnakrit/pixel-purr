// Pixel Purr level editor (internal, dev only: npm run editor → /editor.html). Draw or import a picture, generate a
// level for it with editable knobs, play it or watch the solver's plan, and export it as a LevelFileV1.
import '../fonts';
import './editor.css';
import { colorsOf, countPixels, measure, PALETTE, paramsFor, PICTURES, raster, solve, type Level, type Picture } from '../engine';
import { content } from '../content';
import { PICTURES_21_60 } from '../content/pictures';
import { button, h, numField, section, toast } from './dom';
import { generate, presetFor, type GenParams, type GenResult } from './generate';
import { copyText, download, levelJson, parseLevel, pictureFromImage, readFile } from './io';
import { PaintCanvas, type Tool } from './paint';
import { PlayView, type PlayState } from './play';

// ---------------------------------------------------------------- state

let levelN = 61;
let result: GenResult | null = null;
/** The level shown in Play: generated, loaded from the game or imported. */
let current: Level | null = null;
let tab: 'picture' | 'play' = 'picture';

const status = h('div.status');
const paint = new PaintCanvas(() => onPictureEdited(), c => { selectColor(c); selectTool('draw'); });
const play = new PlayView(s => showPlayState(s));

// ---------------------------------------------------------------- header

const nField = numField('Level', levelN, { min: 1, max: 999, title: 'Level number: sets the file\'s n and the spicy flag' });
const nameInput = h('input', { type: 'text', value: 'Untitled', title: 'Picture name', oninput: () => { paint.picture.name = nameInput.value; } });
const importInput = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: () => void importJson() });
nField.input.addEventListener('change', () => { levelN = nField.get(); });

const header = h('header.top', {},
  h('div', {}, h('h1', { text: 'Level editor' }), h('div.sub', { text: 'Pixel Purr · internal tool, not shipped' })),
  h('div.grow'),
  h('label.field', {}, h('span', { text: 'Name' }), nameInput),
  nField.el,
  button('Import JSON', () => importInput.click(), 'blue', 'Load a LevelFileV1 (or levels-21-60.json, picks the level number)'),
  button('Copy JSON', () => void exportJson(false), '', 'Copy the generated level as LevelFileV1'),
  button('Download', () => void exportJson(true), 'go', 'Save the generated level as a .json file'),
  importInput);

// ---------------------------------------------------------------- picture panel

const libSelect = h('select', { title: 'Library pictures' },
  h('optgroup', { label: 'Levels 1-20' }, ...PICTURES.map((p, i) => h('option', { value: `e${i}`, text: `${i + 1} · ${p.name}` }))),
  h('optgroup', { label: 'Levels 21-60' }, ...PICTURES_21_60.map((p, i) => h('option', { value: `c${i}`, text: `${i + 21} · ${p.name}` }))));
const sizeInput = h('input', { type: 'range', min: 12, max: 32, step: 1, value: 24 });
const sizeLabel = h('b', { text: '24' });
sizeInput.addEventListener('input', () => { paint.resize(Number(sizeInput.value)); sizeLabel.textContent = sizeInput.value; onPictureEdited(); });
const kInput = h('input', { type: 'range', min: 2, max: 8, step: 1, value: 6 });
const kLabel = h('b', { text: '6' });
kInput.addEventListener('input', () => { kLabel.textContent = kInput.value; });
const pngInput = h('input', { type: 'file', accept: 'image/*', onchange: () => void importPng() });
const loadN = numField('Game level', 1, { min: 1, max: 999 });

const picturePanel = section('Picture',
  h('div.row', {}, libSelect, button('Use', () => useLibrary(), 'blue')),
  h('div.row', {}, loadN.el, button('Load game level', () => loadGameLevel(loadN.get()), '', 'Picture, queues and solution of a level from the game (1-60 shipped, 61+ endless)')),
  h('div.row', {}, h('label.field', { style: 'flex:1' }, h('span', {}, 'Grid size ', sizeLabel), sizeInput)),
  h('div.row', {}, h('label.field', { style: 'flex:1' }, h('span', {}, 'Import PNG · max colours ', kLabel), kInput, pngInput)));

// ---------------------------------------------------------------- tools + palette

const toolButtons = new Map<Tool, HTMLButtonElement>();
const toolRow = h('div.row.tools');
for (const [t, name, key] of [['draw', 'Draw', 'B'], ['erase', 'Erase', 'E'], ['fill', 'Fill', 'F'], ['pick', 'Pick', 'I']] as const) {
  const b = button(name, () => selectTool(t), '', `${name} (${key}); right-drag erases`);
  toolButtons.set(t, b); toolRow.append(b);
}
const swatches = h('div.swatches');
const swatchEls: HTMLElement[] = [];
for (let c = 1; c < PALETTE.length; c++) {
  const p = PALETTE[c]!, el = h('div.swatch', { title: p.name, style: `background:${p.hex}`, onclick: () => selectColor(c) }, h('i'));
  swatchEls[c] = el; swatches.append(el);
}
const curColor = h('div.cur');
const toolsPanel = section('Paint',
  toolRow,
  h('div.row', {}, button('Undo', () => { paint.undo(); }, '', 'Ctrl+Z'), button('Redo', () => { paint.redo(); }, '', 'Ctrl+Shift+Z'), button('Clear', () => paint.clear(), 'pink')),
  h('div', { style: 'height:8px' }), swatches, curColor,
  h('div.hint', { style: 'margin-top:6px', text: 'Numbers show how many pixels use each colour. Every colour becomes one or more Purrlets.' }));

function selectTool(t: Tool): void {
  paint.tool = t;
  for (const [k, b] of toolButtons) b.classList.toggle('on', k === t);
}
function selectColor(c: number): void {
  paint.color = c;
  swatchEls.forEach((el, i) => el?.classList.toggle('sel', i === c));
  const p = PALETTE[c]!;
  curColor.replaceChildren(h('b', { style: `background:${p.hex}` }), document.createTextNode(`${p.name} · ${p.key}`));
}

// ---------------------------------------------------------------- generate panel

const preset = presetFor(levelN);
const F = {
  queues: numField('Queues', preset.queues, { min: 1, max: 6 }),
  shooters: numField('Purrlets', preset.shooters, { min: 2, max: 60, title: 'Target Purrlet count: fewer means bigger paint pots' }),
  disorder: numField('Disorder', preset.disorder, { min: 0, max: 1, step: 0.05, title: '0 = ideal peel order, 1 = buried colours dealt first' }),
  hidden: numField('Mystery', preset.hidden, { min: 0, max: 0.9, step: 0.05, title: 'Share of mystery Purrlets (never at a queue front)' }),
  links: numField('Links', preset.links, { min: 0, max: 6, title: 'Linked pairs' }),
  seed: numField('Seed', 1, { min: 1, max: 999999 }),
  needLo: numField('Need min', preset.need[0], { min: 0, max: 5, title: 'Band for slots needed under perfect play' }),
  needHi: numField('Need max', preset.need[1], { min: 0, max: 5 }),
  tries: numField('Tries', 16, { min: 1, max: 200, title: 'Seeds to try until slots needed is in the band' }),
};
const adapt = h('input', { type: 'checkbox', checked: true });
const genButton = button('Generate', () => runGenerate(), 'pink big');
const genPanel = section('Generate',
  h('div.fields', {}, ...Object.values(F).map(f => f.el)),
  h('div.row', {}, h('label.check', {}, adapt, 'Steer disorder towards the band'), h('div', { style: 'flex:1' }), button('Preset from level', () => applyPreset(), '', 'Knobs the game uses for the level number above')),
  h('div.row', {}, genButton, button('Next seed', () => { F.seed.set(F.seed.get() + F.tries.get()); runGenerate(); }, '', 'Try the next batch of seeds')));

const resultBody = h('div', {}, h('div.empty', { text: 'Draw or pick a picture, then Generate.' }));
const resultPanel = section('Level', resultBody);

function applyPreset(quiet = false): void {
  const p = presetFor(levelN = nField.get());
  F.queues.set(p.queues); F.shooters.set(p.shooters); F.disorder.set(p.disorder); F.hidden.set(p.hidden); F.links.set(p.links);
  F.needLo.set(p.need[0]); F.needHi.set(p.need[1]);
  if (!quiet) toast(`Knobs for level ${levelN}${levelN % 5 === 0 ? ' (spicy)' : ''}`);
}

function genParams(): GenParams {
  return {
    n: nField.get(), queues: F.queues.get(), shooters: F.shooters.get(), disorder: F.disorder.get(), hidden: F.hidden.get(), links: F.links.get(),
    need: [F.needLo.get(), F.needHi.get()], seed: F.seed.get(), tries: F.tries.get(), adapt: adapt.checked,
  };
}

function runGenerate(): void {
  genButton.textContent = 'Generating…';
  genButton.disabled = true;
  setTimeout(() => { // let the button repaint before the (blocking) search
    try {
      levelN = nField.get();
      result = generate({ ...paint.picture, name: nameInput.value || 'Untitled' }, genParams());
      if (!result) toast('Nothing to generate: draw some pixels first');
      else { setLevel(result.level); F.disorder.set(result.level.disorder ?? F.disorder.get()); }
    } finally {
      genButton.textContent = 'Generate';
      genButton.disabled = false;
    }
  }, 30);
}

// ---------------------------------------------------------------- result view

function setLevel(L: Level, note?: string): void {
  current = L;
  play.load(L);
  renderResult(L, note);
}

function renderResult(L: Level, note?: string): void {
  const all = L.queues.flat(), sol = L.solution, r = result?.level === L ? result : null, fail = r ? r.fail : measure(L, L.seed ?? 1, 40);
  const band = L.P.need, need = L.need ?? r?.need;
  const tile = (k: string, v: string, cls = '') => h(`div.tile${cls ? '.' + cls : ''}` as 'div', {}, h('i', { text: k }), h('b', { text: v }));
  const tiles = h('div.tiles', {},
    tile('Purrlets', String(all.length)), tile('Queues', String(L.queues.length)),
    tile('Slots needed', need === undefined ? '?' : `${need} of 5`, need !== undefined && need >= band[0] && need <= band[1] ? 'ok' : 'warn'),
    tile('Naive fail', `${Math.round(fail * 100)}%`),
    tile('Mystery', String(all.filter(s => s.hidden).length)), tile('Links', String(all.filter(s => s.link !== undefined).length / 2)),
    tile('Solver', sol?.ok ? `${sol.nodes} nodes` : 'unsolved', sol?.ok && !sol.exhausted && sol.nodes <= 4000 ? '' : 'warn'),
    tile(r ? 'Tries' : 'Pixels', r ? `${r.tried} · ${Math.round(r.ms)}ms` : String(L.total)));
  const queues = h('div.queues', {}, ...L.queues.map((q, qi) => h('div.queue', {}, h('span', { text: `Q${qi + 1}` }),
    ...q.map(s => h(`div.chip${s.hidden ? '.hid' : ''}${s.link !== undefined ? '.link' : ''}` as 'div', { style: `background:${PALETTE[s.c]!.hex}`, title: `${PALETTE[s.c]!.name} ${s.a}${s.hidden ? ', mystery' : ''}${s.link !== undefined ? ', linked' : ''}`, text: String(s.a) })))));
  const moves = h('div.moves', {}, ...(sol?.plan ?? []).map((m, i) =>
    h(`span.move${m.kind === 't' ? '.t' : ''}` as 'span', { 'data-i': i, text: m.kind === 'q' ? 'Q' + m.qs.map(q => q + 1).join('+') : `Tray ${m.i + 1}` })));
  resultBody.replaceChildren(
    h('div.hint', { style: 'margin-bottom:6px', text: `${L.name} · ${L.w}×${L.h} · ${L.colors.length} colours · seed ${L.seed ?? '–'} · disorder ${L.disorder ?? '–'} · band ${band[0]}-${band[1]}${note ? ' · ' + note : ''}${r && !r.inBand ? ' · no seed hit the band, showing the closest' : ''}` }),
    tiles, queues,
    h('div.row', { style: 'margin-top:10px' }, h('h2', { style: 'margin:0;flex:1', text: `Solution · ${sol?.plan?.length ?? 0} taps` }),
      button('Play', () => showTab('play'), 'go'), button('Autoplay', () => { showTab('play'); play.autoplay(true); }, 'blue')), moves);
}

// ---------------------------------------------------------------- center: tabs, picture grid, play

const tabPicture = button('Picture', () => showTab('picture'));
const tabPlay = button('Play', () => showTab('play'));
const speedRow = h('div.row', {}, ...([[1, '1×'], [2, '2×'], [5, '5×'], [20, '20×']] as const).map(([k, t]) => {
  const b = button(t, () => { play.speed = 36 * k; speedRow.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  if (k === 1) b.classList.add('on');
  return b;
}));
const playControls = h('div.row', { style: 'display:none' },
  button('Restart', () => play.autoplay(false), ''), button('Autoplay', () => play.autoplay(!play.autoplaying), 'blue'), speedRow);
const stage = h('div.stage');
const center = h('div.center', {}, h('div.tabs', {}, tabPicture, tabPlay), stage, playControls, status);

function showTab(t: typeof tab): void {
  tab = t;
  tabPicture.classList.toggle('on', t === 'picture');
  tabPlay.classList.toggle('on', t === 'play');
  playControls.style.display = t === 'play' ? '' : 'none';
  if (t === 'play') {
    stage.replaceChildren(play.canvas);
    layout();
    play.start();
    if (!current) status.textContent = 'Generate a level first.';
  } else {
    play.stop();
    stage.replaceChildren(paint.canvas);
    layout();
    showPictureStats();
  }
}

function layout(): void {
  const r = stage.getBoundingClientRect(), H = Math.max(300, r.height - 8), W = Math.max(300, r.width - 8);
  paint.setDisplaySize(Math.min(H, W, 640));
  play.setSize(Math.min(W, 480), H);
}

function showPictureStats(): void {
  const p = paint.picture, cnt = new Map<number, number>();
  for (const c of p.px) if (c) cnt.set(c, (cnt.get(c) ?? 0) + 1);
  swatchEls.forEach((el, c) => { if (el) el.querySelector('i')!.textContent = cnt.get(c) ? String(cnt.get(c)) : ''; });
  if (tab !== 'picture') return;
  const cols = colorsOf(p.px).length, n = countPixels(p.px);
  status.innerHTML = `<b>${p.w}×${p.h}</b> · ${n} pixels · ${cols} colour${cols === 1 ? '' : 's'}${cols > 7 ? ' · the game uses at most 7' : ''}${n === p.w * p.h ? ' · full background' : ''}`;
}

function showPlayState(s: PlayState): void {
  if (tab !== 'play') return;
  const word = s.status === 'won' ? '<b>Won!</b>' : s.status === 'lost' ? '<b>Tray full: lost</b>' : `${s.riders} riding`;
  status.innerHTML = `${word} · ${s.total - s.left}/${s.total} painted · tray ${s.tray}/${s.cap} · step ${s.step}${s.planLen ? ` · plan ${s.plan}/${s.planLen}` : ''}`;
  resultBody.querySelectorAll('.move').forEach((el, i) => el.classList.toggle('at', i === s.plan - 1));
}

// ---------------------------------------------------------------- picture sources

function setPicture(p: Picture, name = p.name): void {
  paint.setPicture({ ...p, name });
  nameInput.value = name;
  sizeInput.value = String(p.w); sizeLabel.textContent = String(p.w);
  showPictureStats();
}

function onPictureEdited(): void { showPictureStats(); }

function useLibrary(): void {
  const v = libSelect.value, i = Number(v.slice(1));
  if (v[0] === 'e') { const n = i + 1; setPicture(raster(PICTURES[i]!, paramsFor(n).size)); nField.set(levelN = n); }
  else { const d = PICTURES_21_60[i]!; setPicture(raster(d, d.size)); nField.set(levelN = i + 21); }
  applyPreset();
  showTab('picture');
}

function loadGameLevel(n: number): void {
  try {
    const L = content.getLevel(n);
    setPicture({ w: L.w, h: L.h, px: L.px, name: L.name });
    nField.set(levelN = n);
    if (n <= 60) libSelect.value = n <= 20 ? `e${n - 1}` : `c${n - 21}`;
    applyPreset(true);
    result = null;
    setLevel(L, `game level ${n}`);
    showTab('play');
  } catch (e) { toast(String((e as Error).message)); }
}

async function importPng(): Promise<void> {
  const f = pngInput.files?.[0];
  if (!f) return;
  try { setPicture(await pictureFromImage(f, Number(sizeInput.value), Number(kInput.value))); showTab('picture'); toast(`Imported ${f.name}`); }
  catch { toast('Could not read that image'); }
  pngInput.value = '';
}

async function importJson(): Promise<void> {
  const f = importInput.files?.[0];
  importInput.value = '';
  if (!f) return;
  try {
    const { n, level } = parseLevel(await readFile(f), nField.get());
    setPicture({ w: level.w, h: level.h, px: level.px, name: level.name });
    nField.set(levelN = n);
    applyPreset(true);
    result = null;
    level.solution = solve(level);
    setLevel(level, `imported ${f.name}`);
    toast(`Loaded level ${n}: ${level.name}`);
  } catch (e) { toast(`Not a level file: ${(e as Error).message}`); }
}

async function exportJson(file: boolean): Promise<void> {
  if (!current) { toast('Generate a level first'); return; }
  const n = nField.get(), text = levelJson(n, { ...current, name: nameInput.value || current.name });
  if (file) { download(`level-${n}.json`, text); toast(`Saved level-${n}.json`); }
  else toast((await copyText(text)) ? 'Level JSON copied' : 'Clipboard blocked: use Download');
}

// ---------------------------------------------------------------- boot

document.getElementById('app')!.append(header, h('main.cols', {}, h('aside', {}, picturePanel, toolsPanel), center, h('aside', {}, genPanel, resultPanel)));
window.addEventListener('resize', () => layout());
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) paint.redo(); else paint.undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); paint.redo(); return; }
  const t = ({ b: 'draw', e: 'erase', f: 'fill', i: 'pick' } as const)[k as 'b'];
  if (t) selectTool(t);
});

selectTool('draw');
selectColor(1);
libSelect.value = 'c0';
useLibrary();
// Deep links for quick checks: ?level=33 loads a game level, ?generate=1 generates for the library picture.
const q = new URLSearchParams(location.search);
if (q.get('level')) loadGameLevel(Number(q.get('level')));
else if (q.get('generate')) runGenerate();
if (q.get('tab') === 'play') showTab('play');
if (q.get('auto')) { showTab('play'); play.autoplay(true); }
