// Dev-only: render every sound effect and both music loops through the real master chain in an
// OfflineAudioContext and measure them (dev/audio.html exposes this as window.__audioCheck()).
// Not imported by the app.
import type { Sfx } from '../app/contracts';
import { STREAK_SCALE, streakSemi } from './logic';
import { renderBand, XFADE, type TrackName } from './music';
import { buildMix, playSfx, SFX, SFX_LEN, SFX_LEVEL, SFX_NAMES, SFX_TRIM, type Ctx, type Mix } from './synth';

const SR = 48000;
/** Audible threshold for lengths: -60 dBFS. */
const AUDIBLE = 1e-3;
const db = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const r2 = (x: number, k = 3): number => Math.round(x * 10 ** k) / 10 ** k;

/** Render `seconds` of stereo audio. `clip: false` stops before the soft clipper (to see what reaches it). */
export async function render(seconds: number, fill: (c: Ctx, mix: Mix) => void, clip = true): Promise<Float32Array> {
  const c = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
  fill(c, buildMix(c, { clip }));
  const b = await c.startRendering();
  const l = b.getChannelData(0), r = b.getChannelData(1), m = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) m[i] = Math.abs(l[i]!) > Math.abs(r[i]!) ? l[i]! : r[i]!; // louder side
  return m;
}

function peak(x: Float32Array, from = 0, to = x.length): number {
  let p = 0;
  for (let i = from; i < to; i++) { const a = Math.abs(x[i]!); if (a > p) p = a; }
  return p;
}

function rms(x: Float32Array, from = 0, to = x.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, to - from));
}

/** First and last audible sample (s). */
function span(x: Float32Array): [number, number] {
  let a = -1, b = -1;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]!) > AUDIBLE) { if (a < 0) a = i; b = i; }
  return [a / SR, b / SR];
}

/** In-place radix-2 FFT magnitude of one Hann-windowed frame. */
function spectrum(x: Float32Array, at: number, n: number): Float32Array {
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[i] = (x[at + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = a + len / 2;
      const tr = re[b]! * wr - im[b]! * wi, ti = re[b]! * wi + im[b]! * wr;
      re[b] = re[a]! - tr; im[b] = im[a]! - ti; re[a] = re[a]! + tr; im[a] = im[a]! + ti;
    }
  }
  const mag = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i]!, im[i]!);
  return mag;
}

/** Brightness: spectral centroid (Hz), the share of energy above 4 kHz (harshness lives up there) and the share
 *  in 300 Hz–4 kHz (what a phone speaker actually plays). */
function brightness(x: Float32Array, from: number, to: number): { centroid: number; hi: number; phone: number } {
  const n = 2048, acc = new Float64Array(n / 2);
  for (let at = from; at + n <= Math.max(to, from + n); at += n / 2) {
    const m = spectrum(x, at, n);
    for (let i = 0; i < m.length; i++) acc[i]! += m[i]! * m[i]!;
  }
  let e = 0, ef = 0, hi = 0, ph = 0;
  for (let i = 1; i < acc.length; i++) {
    const f = (i * SR) / n, p = acc[i]!;
    e += p; ef += p * f;
    if (f > 4000) hi += p; else if (f >= 300) ph += p;
  }
  return { centroid: e ? ef / e : 0, hi: e ? hi / e : 0, phone: e ? ph / e : 0 };
}

export interface SfxStats {
  sfx: Sfx; ok: boolean; why: string[];
  /** Designed length (recipe) and the table's intended length. */
  len: number; intended: number;
  /** Measured: audible start and length (s), peak after the limiter and before the soft clipper, RMS dBFS. */
  onset: number; dur: number; peak: number; prePeak: number; rawPeak: number; rmsDb: number;
  centroid: number; hiPct: number; phonePct: number;
  /** Downsampled envelope for a little waveform picture. */
  wave: number[];
}

function envelope(x: Float32Array, seconds: number, cols = 64, from = 0): number[] {
  const per = Math.max(1, Math.floor((seconds * SR) / cols)), o = Math.round(from * SR), out: number[] = [];
  for (let k = 0; k < cols; k++) out.push(r2(peak(x, o + k * per, Math.min(x.length, o + (k + 1) * per)), 3));
  return out;
}

/** Sounds start after this: Chrome's compressor squashes the first ~0.1 s after a context starts, and the
 *  real app's context has been running long before any sound. */
const WARM = 0.25;

/** Peak of a sound through its trim and the bus levels only (what reaches the limiter). */
async function rawPeak(s: Sfx, secs: number, semi: number): Promise<number> {
  const c = new OfflineAudioContext(1, Math.ceil(secs * SR), SR), g = c.createGain();
  g.gain.value = SFX_TRIM[s] * SFX_LEVEL;
  g.connect(c.destination);
  SFX[s](c, g, 0.01, semi);
  return peak((await c.startRendering()).getChannelData(0));
}

export async function checkSfx(s: Sfx, semi = 0): Promise<SfxStats> {
  const intended = SFX_LEN[s], at = WARM, secs = at + intended + 0.3;
  let len = 0;
  const x = await render(secs, (c, m) => { len = playSfx(c, m, s, at, semi) - at; });
  const pre = await render(secs, (c, m) => { playSfx(c, m, s, at, semi); }, false);
  const [a, b] = span(x), p = peak(x), from = Math.round(a * SR), to = Math.round(b * SR);
  const br = brightness(x, from, to), dur = b - a, why: string[] = [];
  if (a < 0) why.push('silent');
  if (p >= 0.9) why.push(`peak ${r2(p)} ≥ 0.9`);
  if (p < 0.05) why.push(`too quiet (${r2(p)})`);
  if (Math.abs(len - intended) > 0.02) why.push(`designed ${r2(len)} s vs intended ${intended} s`);
  if (dur > intended + 0.03 || dur < intended * 0.5) why.push(`audible ${r2(dur)} s vs intended ${intended} s`);
  if (a - at > 0.03) why.push(`late start ${r2(a - at)} s`);
  if (br.hi > 0.2) why.push(`bright: ${Math.round(br.hi * 100)}% above 4 kHz`);
  const pr = peak(pre);
  if (pr > 0.7) why.push(`reaches the soft clipper (${r2(pr)})`);
  return {
    sfx: s, ok: !why.length, why, len: r2(len), intended, onset: r2(a - at), dur: r2(dur), peak: r2(p), prePeak: r2(peak(pre)), rawPeak: r2(await rawPeak(s, intended + 0.3, semi)),
    rmsDb: r2(db(rms(x, from, to)), 1), centroid: Math.round(br.centroid), hiPct: r2(br.hi * 100, 1), phonePct: r2(br.phone * 100, 1),
    wave: envelope(x, intended + 0.1, 64, at),
  };
}

export interface MusicStats {
  track: string; ok: boolean; why: string[]; seconds: number;
  peak: number; rmsDb: number;
  /** Quietest and loudest 1 s window after the fade-in (dBFS): steady, never silent. */
  minWinDb: number; maxWinDb: number;
  centroid: number; hiPct: number; phonePct: number;
  wave: number[];
}

function windows(x: Float32Array, from: number, win: number): number[] {
  const out: number[] = [], n = Math.round(win * SR);
  for (let i = Math.round(from * SR); i + n <= x.length; i += n) out.push(db(rms(x, i, i + n)));
  return out;
}

function musicStats(track: string, x: Float32Array, seconds: number, settle: number): MusicStats {
  const p = peak(x), w = windows(x, settle, 1), br = brightness(x, Math.round(settle * SR), x.length), why: string[] = [];
  const minW = Math.min(...w), maxW = Math.max(...w), r = db(rms(x, Math.round(settle * SR)));
  if (p >= 0.9) why.push(`peak ${r2(p)} ≥ 0.9`);
  if (minW < -50) why.push(`near-silent window (${r2(minW, 1)} dB)`);
  if (r > -18) why.push(`too loud for background music (${r2(r, 1)} dB RMS)`);
  if (br.hi > 0.08) why.push(`bright: ${Math.round(br.hi * 100)}% above 4 kHz`);
  return {
    track, ok: !why.length, why, seconds, peak: r2(p), rmsDb: r2(r, 1), minWinDb: r2(minW, 1), maxWinDb: r2(maxW, 1),
    centroid: Math.round(br.centroid), hiPct: r2(br.hi * 100, 1), phonePct: r2(br.phone * 100, 1), wave: envelope(x, seconds, 96),
  };
}

export async function checkMusic(track: TrackName, seconds = 8, seed = 7): Promise<MusicStats> {
  const x = await render(seconds, (c, m) => { renderBand(c, m.music, track, 0, seconds, seed); });
  return musicStats(track, x, seconds, 1.2);
}

/** Home for 5 s, then a crossfade into play: no gap, no bump. */
export async function checkCrossfade(): Promise<MusicStats> {
  const sw = 5, seconds = 11;
  const x = await render(seconds, (c, m) => {
    const home = renderBand(c, m.music, 'home', 0, sw, 3);
    home.stop(sw, XFADE); home.pump(seconds);
    renderBand(c, m.music, 'play', sw, seconds, 4, XFADE);
  });
  const s = musicStats('home → play', x, seconds, 1.2);
  // around the switch, half-second windows must stay audible
  const around = windows(x, sw - 1, 0.5).slice(0, 8), dip = Math.min(...around);
  if (dip < -45) { s.ok = false; s.why.push(`crossfade dip ${r2(dip, 1)} dB`); }
  return s;
}

/** The worst pile-up a hectic moment could make, on top of the play music: the limiter must hold it. */
export async function checkStack(): Promise<{ ok: boolean; peak: number; prePeak: number; why: string[] }> {
  const fill = (c: Ctx, m: Mix) => {
    renderBand(c, m.music, 'play', 0, 3, 5, 0.05);
    const at = 0.6;
    for (const s of SFX_NAMES) playSfx(c, m, s, at);
    for (let k = 0; k < 3; k++) playSfx(c, m, 'pop', at + k * 0.028);
    for (let k = 0; k < 10; k++) playSfx(c, m, 'paint', at + k / 14, streakSemi(k));
    for (let k = 0; k < 8; k++) playSfx(c, m, 'coin', at + k * 0.05);
  };
  const x = await render(3, fill), pre = await render(3, fill, false), p = peak(x), why: string[] = [];
  if (p >= 0.9) why.push(`peak ${r2(p)} ≥ 0.9`);
  return { ok: !why.length, peak: r2(p), prePeak: r2(peak(pre)), why };
}

/** A painting streak as the game plays it: 14 plinks a second up the scale and back. */
export async function checkStreak(): Promise<{ ok: boolean; peak: number; notes: number; why: string[] }> {
  const n = STREAK_SCALE.length * 2;
  const x = await render(WARM + n / 14 + 0.4, (c, m) => { for (let k = 0; k < n; k++) playSfx(c, m, 'paint', WARM + k / 14, streakSemi(k)); });
  const p = peak(x), why: string[] = [];
  if (p >= 0.9) why.push(`peak ${r2(p)} ≥ 0.9`);
  if (p < 0.05) why.push('silent');
  return { ok: !why.length, peak: r2(p), notes: n, why };
}

export async function audioCheck(): Promise<{
  ok: boolean; sampleRate: number; sfx: SfxStats[]; music: MusicStats[]; stack: Awaited<ReturnType<typeof checkStack>>;
  streak: Awaited<ReturnType<typeof checkStreak>>; ms: number;
}> {
  const t0 = performance.now(), sfx: SfxStats[] = [];
  for (const s of SFX_NAMES) sfx.push(await checkSfx(s));
  const music = [await checkMusic('home'), await checkMusic('play'), await checkCrossfade()];
  const stack = await checkStack(), streak = await checkStreak();
  const ok = sfx.every(s => s.ok) && music.every(m => m.ok) && stack.ok && streak.ok;
  return { ok, sampleRate: SR, sfx, music, stack, streak, ms: Math.round(performance.now() - t0) };
}
