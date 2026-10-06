// Sound effects synthesised with Web Audio: no sample files. Soft and rounded on purpose: sines and filtered
// triangles, quick (never instant) attacks, exponential tails, little energy above 3 kHz.
// Every recipe works on any BaseAudioContext, so the dev check can render it offline and measure it.
import type { Sfx } from '../app/contracts';
import { mulberry32 } from '../engine/rng';

export type Ctx = BaseAudioContext;

/** MIDI note to Hz. */
export const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

const FLOOR = 1e-4; // exponential ramps can't reach 0; -80 dB is silence here
const MIN_ATTACK = 0.004;

export interface Voice {
  f: number;
  /** Glide to this frequency over `glide` s (exponential). */
  f2?: number; glide?: number;
  type?: OscillatorType;
  /** Attack and decay (s); decay is an exponential fall to -80 dB. Hold keeps the level before the decay. */
  a?: number; hold?: number; d: number;
  g: number;
  /** Lowpass cutoff (Hz) for triangles and noise. */
  lp?: number;
  detune?: number;
  /** Vibrato: rate Hz, depth cents. */
  vib?: [number, number];
}

/** Gain envelope on a fresh GainNode: 0 → g in a, hold, exponential fall. Returns the gain and the end time. */
function env(c: Ctx, t: number, a: number, hold: number, d: number, g: number): [GainNode, number] {
  const n = c.createGain(), p = n.gain;
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(g, t + a);
  if (hold > 0) p.setValueAtTime(g, t + a + hold);
  p.exponentialRampToValueAtTime(FLOOR, t + a + hold + d);
  p.setValueAtTime(0, t + a + hold + d);
  return [n, t + a + hold + d];
}

function lowpass(c: Ctx, f: number, q = 0.7): BiquadFilterNode {
  const n = c.createBiquadFilter();
  n.type = 'lowpass'; n.frequency.value = f; n.Q.value = q;
  return n;
}

/** One oscillator voice into out. Returns its end time. */
export function tone(c: Ctx, out: AudioNode, t: number, v: Voice): number {
  const o = c.createOscillator();
  o.type = v.type ?? 'sine';
  o.frequency.setValueAtTime(v.f, t);
  if (v.f2 !== undefined) o.frequency.exponentialRampToValueAtTime(v.f2, t + (v.glide ?? v.d));
  if (v.detune) o.detune.value = v.detune;
  // attacks shorter than ~4 ms click (a broadband tick on every note); this keeps every onset rounded
  const [g, end] = env(c, t, Math.max(MIN_ATTACK, v.a ?? 0.005), v.hold ?? 0, v.d, v.g);
  let head: AudioNode = o;
  if (v.lp) { const f = lowpass(c, v.lp); head.connect(f); head = f; }
  head.connect(g).connect(out);
  if (v.vib) {
    const l = c.createOscillator(), ld = c.createGain();
    l.frequency.value = v.vib[0]; ld.gain.value = v.vib[1];
    l.connect(ld).connect(o.detune);
    l.start(t); l.stop(end + 0.02);
  }
  o.start(t); o.stop(end + 0.02);
  return end;
}

/** Glassy bell: a sine plus a soft inharmonic partial that dies first (the "ting" on top). */
export function bell(c: Ctx, out: AudioNode, t: number, f: number, g: number, d: number): number {
  tone(c, out, t, { f: f * (f < 1200 ? 2.76 : 2), d: d * 0.3, g: g * 0.22, a: 0.002 });
  return tone(c, out, t, { f, d, g, a: 0.003 });
}

/** Wooden mallet: sine with a fast fourth-harmonic knock on the front. */
export function mallet(c: Ctx, out: AudioNode, t: number, f: number, g: number, d: number): number {
  tone(c, out, t, { f: f * 4, d: 0.025, g: g * 0.25, a: 0.001 });
  return tone(c, out, t, { f, d, g, a: 0.003 });
}

const noiseBufs = new WeakMap<Ctx, AudioBuffer>();
/** One second of seeded white noise per context (seeded so the offline check is repeatable). */
function noiseBuf(c: Ctx): AudioBuffer {
  let b = noiseBufs.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = b.getChannelData(0), r = mulberry32(0x9a77);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    noiseBufs.set(c, b);
  }
  return b;
}

export interface NoiseVoice {
  filter: BiquadFilterType;
  /** Filter sweep f → f2 over the sound. */
  f: number; f2?: number; q?: number;
  a?: number; hold?: number; d: number; g: number;
}

/** Filtered noise burst (whoosh, swish, poof, shaker). Returns its end time. */
export function noise(c: Ctx, out: AudioNode, t: number, v: NoiseVoice): number {
  const s = c.createBufferSource(), f = c.createBiquadFilter();
  s.buffer = noiseBuf(c); s.loop = true;
  f.type = v.filter; f.Q.value = v.q ?? 0.8;
  f.frequency.setValueAtTime(v.f, t);
  const [g, end] = env(c, t, v.a ?? 0.005, v.hold ?? 0, v.d, v.g);
  if (v.f2 !== undefined) f.frequency.exponentialRampToValueAtTime(v.f2, end);
  s.connect(f).connect(g).connect(out);
  // a random offset into the loop, so repeated swishes don't sound stamped
  s.start(t, (t * 7.31) % 0.9); s.stop(end + 0.02);
  return end;
}

// ---------------------------------------------------------------- recipes

type Recipe = (c: Ctx, out: AudioNode, t: number, semi: number) => number;

const C5 = 72, G5 = 79;

/** Each recipe schedules its voices at t and returns when the last one has faded (its length). */
export const SFX: Readonly<Record<Sfx, Recipe>> = {
  // a soft wooden "tock"
  button: (c, o, t) => Math.max(
    tone(c, o, t, { f: 1250, f2: 820, glide: 0.03, a: 0.002, d: 0.055, g: 0.3 }),
    tone(c, o, t, { type: 'triangle', f: 640, f2: 520, glide: 0.04, a: 0.002, d: 0.045, g: 0.14, lp: 2400 })),

  // bubble pop: a quick upward bloop
  tap: (c, o, t) => Math.max(
    tone(c, o, t, { f: 380, f2: 980, glide: 0.07, a: 0.005, d: 0.11, g: 0.42 }),
    tone(c, o, t, { f: 760, f2: 1960, glide: 0.07, a: 0.005, d: 0.05, g: 0.06 })),

  // gentle bonk: rounded, falling, low
  blocked: (c, o, t) => Math.max(
    tone(c, o, t, { type: 'triangle', f: 360, f2: 230, glide: 0.12, a: 0.006, d: 0.17, g: 0.34, lp: 1500 }),
    tone(c, o, t, { f: 180, f2: 120, glide: 0.12, a: 0.006, d: 0.15, g: 0.22 })),

  // tiny plink; semi carries the streak pitch
  paint: (c, o, t, s) => {
    const f = hz(G5 + s);
    tone(c, o, t, { f: f * 2, d: 0.04, g: 0.05, a: 0.001 });
    return tone(c, o, t, { f, d: 0.13, g: 0.24, a: 0.002 });
  },

  // sparkle chime: a soft pop, then a quick major arpeggio of bells
  pop: (c, o, t) => {
    tone(c, o, t, { f: 520, f2: 1150, glide: 0.05, a: 0.003, d: 0.08, g: 0.22 });
    return Math.max(...[84, 88, 91, 96].map((m, i) => bell(c, o, t + 0.02 + i * 0.032, hz(m), 0.13 - i * 0.012, 0.28)));
  },

  // soft cushion thud
  park: (c, o, t) => Math.max(
    tone(c, o, t, { type: 'triangle', f: 520, f2: 240, glide: 0.07, a: 0.004, d: 0.12, g: 0.26, lp: 1400 }),
    tone(c, o, t, { f: 260, f2: 120, glide: 0.08, a: 0.004, d: 0.15, g: 0.2 }),
    noise(c, o, t, { filter: 'lowpass', f: 1600, f2: 300, a: 0.003, d: 0.07, g: 0.25 })),

  // ta-da: a pickup and a bright landing chord
  reveal: (c, o, t) => {
    tone(c, o, t, { type: 'triangle', f: hz(G5), a: 0.005, d: 0.1, g: 0.22, lp: 3000 });
    const t2 = t + 0.11;
    bell(c, o, t2 + 0.03, hz(96), 0.05, 0.3);
    return Math.max(...[72, 76, 79].map(m => tone(c, o, t2, { type: 'triangle', f: hz(m), a: 0.006, hold: 0.05, d: 0.34, g: 0.12, lp: 3200 })));
  },

  // short fanfare: rising arpeggio, then a held chord with a little shimmer on top
  win: (c, o, t) => {
    [C5, C5 + 4, C5 + 7].forEach((m, i) => {
      tone(c, o, t + i * 0.1, { type: 'triangle', f: hz(m), a: 0.006, d: 0.24, g: 0.18, lp: 2600 });
      tone(c, o, t + i * 0.1, { f: hz(m + 12), a: 0.004, d: 0.12, g: 0.06 });
    });
    const t2 = t + 0.3;
    const ends = [C5, C5 + 7, C5 + 12, C5 + 16].map(m =>
      tone(c, o, t2, { type: 'triangle', f: hz(m), a: 0.01, hold: 0.25, d: 0.6, g: 0.1, lp: 2400, vib: [5.5, 6] }));
    [96, 100, 103, 108].forEach((m, i) => bell(c, o, t2 + 0.06 + i * 0.05, hz(m), 0.04, 0.35));
    return Math.max(...ends);
  },

  // low gentle "oh no": two sighing notes, the second sagging
  lose: (c, o, t) => {
    tone(c, o, t, { type: 'triangle', f: hz(65), a: 0.03, hold: 0.06, d: 0.24, g: 0.26, lp: 1500, vib: [4.5, 10] });
    tone(c, o, t, { f: hz(53), a: 0.03, hold: 0.06, d: 0.2, g: 0.05 });
    const t2 = t + 0.27;
    tone(c, o, t2, { f: hz(50), f2: hz(48), glide: 0.5, a: 0.03, hold: 0.12, d: 0.42, g: 0.05 });
    return tone(c, o, t2, { type: 'triangle', f: hz(62), f2: hz(60), glide: 0.5, a: 0.03, hold: 0.12, d: 0.42, g: 0.27, lp: 1400, vib: [4.5, 12] });
  },

  // nervous little "uh-oh" with a wobble
  worry: (c, o, t) => {
    tone(c, o, t, { type: 'triangle', f: hz(71), a: 0.01, d: 0.12, g: 0.2, lp: 1600, vib: [11, 25] });
    return tone(c, o, t + 0.13, { type: 'triangle', f: hz(67), f2: hz(66), glide: 0.2, a: 0.01, d: 0.22, g: 0.22, lp: 1400, vib: [11, 30] });
  },

  // coin tick: a tiny two-partial ting; semi climbs in a run
  coin: (c, o, t, s) => {
    const f = hz(91 + s);
    tone(c, o, t, { type: 'triangle', f: f * 1.5, a: 0.001, d: 0.035, g: 0.06, lp: 4200 });
    return tone(c, o, t, { f, a: 0.002, d: 0.085, g: 0.2 });
  },

  // magic whoosh with a sparkle at the end
  booster: (c, o, t) => {
    noise(c, o, t, { filter: 'bandpass', f: 450, f2: 2600, q: 1.3, a: 0.12, d: 0.22, g: 0.75 });
    tone(c, o, t, { f: 330, f2: 990, glide: 0.28, a: 0.08, d: 0.24, g: 0.07 });
    return bell(c, o, t + 0.22, hz(96), 0.07, 0.17);
  },

  // unlock jingle: rising bells into a soft chord
  unlock: (c, o, t) => {
    const ns = [79, 84, 88, 91, 96];
    const ends = ns.map((m, i) => bell(c, o, t + i * 0.065, hz(m), 0.1, i === ns.length - 1 ? 0.48 : 0.32));
    [72, 76, 79].forEach(m => tone(c, o, t + 0.26, { type: 'triangle', f: hz(m), a: 0.02, hold: 0.06, d: 0.42, g: 0.06, lp: 2400 }));
    return Math.max(...ends);
  },

  // yarn swish: three soft brushes, back and forth, with tiny playful plucks
  shuffle: (c, o, t) => Math.max(...[0, 0.1, 0.2].map((dt, i) => {
    tone(c, o, t + dt + 0.02, { type: 'triangle', f: hz([76, 79, 81][i]!), a: 0.003, d: 0.07, g: 0.07, lp: 2500 });
    return noise(c, o, t + dt, { filter: 'bandpass', f: i % 2 ? 2200 : 1100, f2: i % 2 ? 1100 : 2200, q: 1.6, a: 0.03, d: 0.12, g: 0.7 });
  })),

  // sleepy slide: a slow yawn downwards
  nap: (c, o, t) => {
    tone(c, o, t, { type: 'triangle', f: 440, f2: 165, glide: 0.55, a: 0.06, hold: 0.1, d: 0.5, g: 0.14, lp: 1200, vib: [5, 20] });
    return tone(c, o, t, { f: 880, f2: 330, glide: 0.55, a: 0.06, hold: 0.1, d: 0.5, g: 0.2, vib: [5, 20] });
  },

  // zap shimmer: a quick wobbly rise and a twinkle on top
  xray: (c, o, t) => {
    tone(c, o, t, { type: 'triangle', f: 420, f2: 1500, glide: 0.18, a: 0.01, d: 0.25, g: 0.16, lp: 2800, vib: [28, 45] });
    return Math.max(...[96, 100, 103].map((m, i) => bell(c, o, t + 0.1 + i * 0.045, hz(m), 0.05, 0.24)));
  },

  // poof: a puff of air and a soft low bump
  cushion: (c, o, t) => Math.max(
    noise(c, o, t, { filter: 'lowpass', f: 2400, f2: 300, a: 0.01, d: 0.22, g: 0.5 }),
    tone(c, o, t, { f: 240, f2: 120, glide: 0.12, a: 0.006, d: 0.15, g: 0.24 })),

  // gift jingle: bouncy bells with a little sleigh shimmer
  gift: (c, o, t) => {
    noise(c, o, t, { filter: 'bandpass', f: 4200, q: 2.5, a: 0.02, hold: 0.16, d: 0.2, g: 0.07 });
    return Math.max(...[88, 91, 88, 96].map((m, i) => bell(c, o, t + i * 0.075, hz(m), 0.11, i === 3 ? 0.4 : 0.2)));
  },
};

/** Lengths each sound is designed to have (s): the dev check verifies the rendered audio matches. */
export const SFX_LEN: Readonly<Record<Sfx, number>> = {
  button: 0.06, tap: 0.12, blocked: 0.18, paint: 0.13, pop: 0.39, park: 0.15, reveal: 0.51, win: 1.17,
  lose: 0.84, worry: 0.36, coin: 0.09, booster: 0.39, unlock: 0.74, shuffle: 0.35, nap: 0.66, xray: 0.43,
  cushion: 0.23, gift: 0.63,
};

export const SFX_NAMES = Object.keys(SFX) as Sfx[];

// ---------------------------------------------------------------- master chain

export interface Mix {
  sfx: GainNode; music: GainNode; master: GainNode;
  /** Per-sound trims into the sfx bus. */
  bus: Record<Sfx, GainNode>;
  /** Last node before the destination (for meters). */
  out: AudioNode;
}

/** Bus levels: effects up front, music well underneath them. */
export const SFX_LEVEL = 1, MUSIC_LEVEL = 0.55;
/** The limiter adds automatic make-up gain (+2.1 dB at these settings, measured); this pays it back so
 *  everything under the threshold passes at unity. */
export const LIMITER_UNDO = 0.78;
/** Per-sound trims, tuned with the offline check so each sound peaks where it should: the frequent small ones
 *  (plink, coin, click) lower, the rewards higher. Peaks stay under the limiter's threshold (0.5). */
export const SFX_TRIM: Readonly<Record<Sfx, number>> = {
  button: 0.67, tap: 0.7, blocked: 0.63, paint: 0.96, pop: 1.9, park: 1, reveal: 1.3, win: 1.26, lose: 1,
  worry: 1.72, coin: 1.08, booster: 1.95, unlock: 1.9, shuffle: 1.08, nap: 1.09, xray: 2.47, cushion: 0.76, gift: 3,
};

/** Soft-clip curve: straight up to `knee`, then eases into `ceil`. The shaper sees input / 2 (see buildMix),
 *  so it shapes signals up to ±2 before the hard edge. */
export function softClip(knee = 0.7, ceil = 0.88, n = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(n), room = ceil - knee;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 4 - 2, a = Math.abs(x);
    curve[i] = Math.sign(x) * (a < knee ? a : knee + room * Math.tanh((a - knee) / room));
  }
  return curve;
}

/** Per-sound trims → sfx bus, music bus → master → limiter → make-up undo → soft clipper → out.
 *  One sound alone passes untouched; a pile-up is held by the limiter (about 0.72 at 2x overload) and the
 *  clipper is the hard ceiling for the few milliseconds a compressor attack lets through. */
export function buildMix(c: Ctx, opts: { clip?: boolean; out?: AudioNode } = {}): Mix {
  const sfx = c.createGain(), music = c.createGain(), master = c.createGain(), lim = c.createDynamicsCompressor(), undo = c.createGain();
  lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.15;
  sfx.gain.value = SFX_LEVEL; music.gain.value = MUSIC_LEVEL; undo.gain.value = LIMITER_UNDO;
  sfx.connect(master); music.connect(master);
  let tail: AudioNode = master.connect(lim).connect(undo);
  if (opts.clip !== false) {
    const pre = c.createGain(), clip = c.createWaveShaper();
    pre.gain.value = 0.5; clip.curve = softClip();
    tail = tail.connect(pre).connect(clip);
  }
  tail.connect(opts.out ?? c.destination);
  const bus = {} as Record<Sfx, GainNode>;
  for (const s of SFX_NAMES) { const g = bus[s] = c.createGain(); g.gain.value = SFX_TRIM[s]; g.connect(sfx); }
  return { sfx, music, master, bus, out: tail };
}

/** Start sound s at time t through its trim. Returns when it has faded. */
export function playSfx(c: Ctx, mix: Mix, s: Sfx, t: number, semi = 0): number { return SFX[s](c, mix.bus[s], t, semi); }
