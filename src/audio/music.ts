// Gentle generative lo-fi music: two loops built from soft synth voices and scheduled ahead of time.
// 'home' is a calm pad with sparse plucks; 'play' is light and bouncy but stays under the sound effects.
// A Band is one playing track; the realtime player pumps it from a timer, the dev check pumps it straight
// into an OfflineAudioContext, so both hear exactly the same notes.
import { mulberry32, type Rng } from '../engine/rng';
import { hz, mallet, noise, tone, type Ctx } from './synth';

export type TrackName = 'home' | 'play';

/** Schedule this far ahead (s); the timer wakes every TICK_MS. Generous because phones throttle timers. */
export const LOOKAHEAD = 0.3;
export const TICK_MS = 60;
/** Crossfade between tracks, fade-in from silence, fade-out to silence (s). */
export const XFADE = 1.6, FADE_IN = 1.2, FADE_OUT = 0.9;

interface Chord { root: number; pad: readonly number[]; tones: readonly number[] }

interface TrackDef {
  bpm: number;
  /** Late off-beats, as a fraction of a step (swing). */
  swing: number;
  /** Track level into the music bus. */
  gain: number;
  chords: readonly Chord[];
  /** Melody notes (MIDI), low to high; the tune random-walks along them. */
  scale: readonly number[];
  step(b: Band, i: number, t: number): void;
}

const STEPS = 8; // eighth notes per 4/4 bar

/** One running track: its buses, its random tune state and its place on the grid. */
export class Band {
  readonly out: GainNode;
  /** Soft lowpassed bus for pads; echo bus for plucks (dotted-eighth delay with a darkening feedback loop). */
  readonly pad: AudioNode; readonly echo: AudioNode; readonly dry: AudioNode;
  /** Slow pitch wow shared by pad voices (the lo-fi tape feel). */
  readonly wow: OscillatorNode; readonly wowDepth: GainNode;
  readonly rng: Rng;
  readonly stepDur: number;
  i = 0; next: number; end = Infinity;
  /** Melody position in def.scale. */
  mel: number;
  private readonly nodes: AudioNode[] = [];

  constructor(readonly c: Ctx, dest: AudioNode, readonly def: TrackDef, private readonly t0: number, private readonly fadeIn: number, seed: number) {
    const at = t0;
    this.rng = mulberry32(seed);
    this.stepDur = 60 / def.bpm / 2;
    this.next = at;
    this.mel = Math.floor(def.scale.length / 2);
    const out = this.out = c.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(def.gain, at + fadeIn);
    out.connect(dest);
    this.dry = out;
    const pad = c.createBiquadFilter();
    pad.type = 'lowpass'; pad.frequency.value = 1300; pad.Q.value = 0.4;
    pad.connect(out);
    this.pad = pad;
    const echoIn = c.createGain(), delay = c.createDelay(2), fb = c.createGain(), dark = c.createBiquadFilter(), wet = c.createGain();
    delay.delayTime.value = this.stepDur * 1.5;
    fb.gain.value = 0.32; dark.type = 'lowpass'; dark.frequency.value = 1700; wet.gain.value = 0.38;
    echoIn.connect(out); echoIn.connect(delay);
    delay.connect(dark).connect(fb).connect(delay);
    dark.connect(wet).connect(out);
    this.echo = echoIn;
    this.wow = c.createOscillator(); this.wowDepth = c.createGain();
    this.wow.frequency.value = 0.23; this.wowDepth.gain.value = 7;
    this.wow.connect(this.wowDepth);
    this.wow.start(at);
    this.nodes.push(out, pad, echoIn, delay, fb, dark, wet, this.wow, this.wowDepth);
  }

  /** Schedule every step that starts before `until`. Steps already in the past are skipped (not crammed in)
   *  when the timer was late, so a throttled tab never bursts out a pile of notes. */
  pump(until: number, now = -Infinity): void {
    while (this.next < now - 0.02 && this.next < this.end) { this.i++; this.next += this.stepDur; }
    while (this.next < until && this.next < this.end) {
      const late = this.i % 2 ? this.def.swing * this.stepDur : 0;
      this.def.step(this, this.i, this.next + late);
      this.i++; this.next += this.stepDur;
    }
  }

  /** Fade out from `at` over `dur` s and stop scheduling. */
  stop(at: number, dur: number): void {
    if (this.end !== Infinity) return;
    const g = this.out.gain;
    // Pin the level the fade-in has reached at `at` (computed: cancelAndHoldAtTime is missing in some engines,
    // and Chrome's inserts no hold point once the fade-in has ended, so the ramp would start back at that end).
    g.cancelScheduledValues(at);
    g.setValueAtTime(this.def.gain * Math.min(1, Math.max(0, (at - this.t0) / this.fadeIn)), at);
    g.linearRampToValueAtTime(0, at + dur);
    this.end = at + dur;
    this.wow.stop(this.end + 0.05);
  }

  dispose(): void { for (const n of this.nodes) n.disconnect(); }

  /** Pick a melody note: a random walk with small steps, sometimes landing on a chord tone. */
  walk(chord: Chord, land: boolean): number {
    const sc = this.def.scale, r = this.rng();
    this.mel += r < 0.35 ? -1 : r < 0.7 ? 1 : r < 0.82 ? -2 : r < 0.94 ? 2 : 0;
    if (this.mel < 1) this.mel = 2; else if (this.mel > sc.length - 2) this.mel = sc.length - 3; // bounce off the ends
    let m = sc[this.mel]!;
    if (land) { // nearest chord tone (any octave)
      let best = m, bd = 99;
      for (const n of sc) if (chord.tones.includes(n % 12) && Math.abs(n - m) < bd) { best = n; bd = Math.abs(n - m); }
      m = best; this.mel = sc.indexOf(m);
    }
    return m;
  }

  /** Soft detuned pad chord held for `len` s (attack and release overlap the neighbours). */
  padChord(ch: Chord, t: number, len: number, g: number): void {
    for (const m of ch.pad) for (const [type, det] of [['triangle', -7], ['sine', 7]] as const) {
      const o = this.c.createOscillator(), e = this.c.createGain();
      o.type = type; o.frequency.value = hz(m); o.detune.value = det;
      this.wowDepth.connect(o.detune);
      // the shared wow would otherwise keep every old voice alive (it may already be gone if the band was disposed)
      o.onended = () => { try { this.wowDepth.disconnect(o.detune); } catch { /* already disconnected */ } };
      const a = Math.min(1.6, len * 0.4), rel = 1.8;
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(g, t + a);
      e.gain.setValueAtTime(g, t + len);
      e.gain.exponentialRampToValueAtTime(1e-4, t + len + rel);
      o.connect(e).connect(this.pad);
      o.start(t); o.stop(t + len + rel + 0.05);
    }
  }
}

const chord = (root: number, pad: number[]): Chord => ({ root, pad, tones: [...new Set([root, ...pad].map(m => m % 12))] });

// ---------------------------------------------------------------- home: calm pad + plucks

const HOME: TrackDef = {
  bpm: 70, swing: 0.08, gain: 0.75,
  // Fmaj7 → Em7 → Dm9 → Cmaj7 (IV iii ii I), two bars each, voiced close for a soft pad
  chords: [chord(41, [57, 60, 64, 65]), chord(40, [55, 59, 62, 64]), chord(38, [57, 60, 62, 65]), chord(36, [55, 59, 60, 64])],
  scale: [67, 69, 72, 74, 76, 79, 81, 84, 86],
  step(b, i, t) {
    const bar = Math.floor(i / STEPS), s = i % STEPS, ch = this.chords[Math.floor(bar / 2) % this.chords.length]!;
    const barDur = b.stepDur * STEPS;
    if (s === 0 && bar % 2 === 0) b.padChord(ch, t, barDur * 2, 0.034);
    if (s === 0) {
      tone(b.c, b.dry, t, { f: hz(ch.root + 12), a: 0.06, hold: 0.3, d: 1.6, g: 0.065 });
      tone(b.c, b.dry, t, { type: 'triangle', f: hz(ch.root + 12), a: 0.06, hold: 0.3, d: 1.2, g: 0.045, lp: 900 });
    }
    if (s === 4 && b.rng() < 0.45) tone(b.c, b.dry, t, { f: hz(ch.root + 19), a: 0.05, d: 1.1, g: 0.04 });
    // plucks: sparse, more on the beat, a breath every fourth bar
    const p = (s % 2 ? 0.16 : 0.4) * (bar % 4 === 3 ? 0.4 : 1);
    if (b.rng() < p) {
      const m = b.walk(ch, s === 0 || s === 4), g = 0.075 + b.rng() * 0.025;
      tone(b.c, b.echo, t, { f: hz(m), a: 0.006, d: 0.9, g });
      tone(b.c, b.echo, t, { type: 'triangle', f: hz(m), a: 0.004, d: 0.25, g: g * 0.5, lp: 2200 });
    }
  },
};

// ---------------------------------------------------------------- play: light and bouncy

const PLAY: TrackDef = {
  bpm: 100, swing: 0.16, gain: 1.8,
  // Cadd9 → Am7 → Fmaj7 → G6, a bar each
  chords: [chord(48, [64, 67, 74]), chord(45, [64, 67, 72]), chord(41, [64, 69, 72]), chord(43, [62, 64, 71])],
  scale: [72, 74, 76, 79, 81, 84, 86, 88],
  step(b, i, t) {
    const bar = Math.floor(i / STEPS), s = i % STEPS, ch = this.chords[bar % this.chords.length]!, r = b.rng;
    // a faint pad holds the bar together between the bouncy bits
    if (s === 0) b.padChord(ch, t, b.stepDur * STEPS, 0.011);
    // soft pulse: a round little thump on 1 and 3, a hushed shaker on the off-beats
    if (s === 0 || s === 4) {
      tone(b.c, b.dry, t, { f: 150, f2: 70, glide: 0.08, a: 0.003, d: 0.12, g: 0.09 });
      tone(b.c, b.dry, t, { type: 'triangle', f: 300, f2: 160, glide: 0.05, a: 0.002, d: 0.05, g: 0.04, lp: 1200 });
    }
    if (s % 2) noise(b.c, b.dry, t, { filter: 'bandpass', f: 4800, q: 0.9, a: 0.004, d: 0.045, g: 0.05 });
    else if (s === 2 || s === 6) noise(b.c, b.dry, t, { filter: 'bandpass', f: 3600, q: 1.2, a: 0.004, d: 0.06, g: 0.035 });
    // bouncy bass: root on 1 and 3, pickups between
    const bass = (m: number, d: number, g: number) => {
      tone(b.c, b.dry, t, { type: 'triangle', f: hz(m), a: 0.006, d, g, lp: 1000 });
      tone(b.c, b.dry, t, { f: hz(m), a: 0.006, d, g: g * 0.5 });
    };
    if (s === 0) bass(ch.root, 0.32, 0.085);
    else if (s === 4) bass(ch.root + (r() < 0.3 ? 12 : 0), 0.26, 0.07);
    else if ((s === 3 || s === 7) && r() < 0.4) bass(ch.root + 7, 0.14, 0.05);
    // marimba chord stabs on 2 and 4
    if ((s === 2 || s === 6) && r() < 0.85) for (const m of ch.pad) mallet(b.c, b.dry, t, hz(m), 0.045, 0.22);
    // tune: call (bars 1, 3) and a sparser answer (bars 2, 4)
    const p = (s % 2 ? 0.14 : 0.36) * (bar % 2 ? 0.55 : 1);
    if (r() < p) mallet(b.c, b.echo, t, hz(b.walk(ch, s === 0)), 0.085 + r() * 0.02, 0.4);
  },
};

export const TRACKS: Readonly<Record<TrackName, TrackDef>> = { home: HOME, play: PLAY };

/** Realtime player: one current band, older bands fading out, pumped by a timer while running. */
export class MusicPlayer {
  private bands: Band[] = [];
  private cur: { name: TrackName; band: Band } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seed = (Math.random() * 2 ** 31) | 0;

  constructor(private readonly c: AudioContext, private readonly out: AudioNode) {}

  get track(): TrackName | null { return this.cur?.name ?? null; }

  /** Switch tracks with a crossfade; null fades out. Same track again keeps playing. */
  play(name: TrackName | null): void {
    if (name === this.track) return;
    const t = this.c.currentTime + 0.03, prev = this.cur;
    prev?.band.stop(t, name ? XFADE : FADE_OUT);
    this.cur = null;
    if (name) {
      const band = new Band(this.c, this.out, TRACKS[name], t, prev ? XFADE : FADE_IN, this.seed++);
      this.bands.push(band);
      this.cur = { name, band };
    }
    this.tick();
    this.run(true);
  }

  /** Start or stop the scheduler timer (stopped while the app is in the background). */
  run(on: boolean): void {
    if (on && !this.timer && this.bands.length) this.timer = setInterval(() => this.tick(), TICK_MS);
    else if (!on && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private tick(): void {
    const now = this.c.currentTime; // frozen while suspended, so pumping then schedules nothing new
    for (const b of this.bands) b.pump(now + LOOKAHEAD, now);
    // drop bands whose fade-out has finished (plus a pad release)
    this.bands = this.bands.filter(b => { const done = b.end + 2 < now; if (done) b.dispose(); return !done; });
    if (!this.bands.length) this.run(false);
  }
}

/** Offline: play `name` from `at` until `until` into dest (used by the dev check). Returns the band. */
export function renderBand(c: Ctx, dest: AudioNode, name: TrackName, at: number, until: number, seed = 1, fadeIn = FADE_IN): Band {
  const b = new Band(c, dest, TRACKS[name], at, fadeIn, seed);
  b.pump(until);
  return b;
}
