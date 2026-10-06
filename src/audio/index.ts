// Sound and haptics (AudioApi): synthesised effects, two generative music loops, Capacitor haptics.
// The AudioContext is made lazily: on unlock(), or on the first sound once the page may play audio
// (a native app, or a page that has had a tap). Sounds asked for while audio can't run are dropped, not
// queued, so a suspended context never releases a pile of stale sounds at once.
import type { AudioApi, Sfx } from '../app/contracts';
import type { Game, GameEvent } from '../engine';
import { buzz, isNative } from './haptics';
import { COIN_RUN_RESET, coinSemi, eventCues, hapticReady, newStreak, sfxReady, shot, type Cue, type HapticKind } from './logic';
import { MusicPlayer, type TrackName } from './music';
import { buildMix, playSfx, SFX_LEVEL, type Mix } from './synth';

/** Sounds start this far ahead of currentTime so their envelopes begin cleanly. */
const START = 0.008;
/** After unlock() calls resume(), sounds may be scheduled for this long while the resume is pending. */
const RESUME_GRACE = 0.5;

type Win = Window & { webkitAudioContext?: typeof AudioContext };
type Nav = Navigator & { audioSession?: { type: string }; userActivation?: { hasBeenActive: boolean } };

class Sound implements AudioApi {
  private ctx: AudioContext | null = null;
  private mix: Mix | null = null;
  private player: MusicPlayer | null = null;
  private sound = true;
  private musicOn = true;
  private vibration = true;
  private paused = false;
  private want: TrackName | null = null;
  private gestured = false;
  private primed = false;
  private resumeAt = -Infinity;
  private streak = newStreak();
  private last: Partial<Record<Sfx, number>> = {};
  private lastHaptic = -Infinity;
  private coinRun = { n: 0, at: -Infinity };

  constructor() {
    // Fallback wake-up: if the phone interrupted audio (a call, Siri) or the app never called unlock(),
    // the next tap anywhere resumes it. Passive and cheap when audio is already running.
    if (typeof window === 'undefined') return;
    const wake = () => { if (this.ctx && this.ctx.state !== 'running' && !this.paused) this.unlock(); };
    for (const ev of ['pointerup', 'touchend', 'keydown']) window.addEventListener(ev, wake, { capture: true, passive: true });
  }

  private now(): number { return performance.now() / 1000; }

  /** May an AudioContext start now without a fresh gesture? */
  private mayStart(): boolean {
    return this.gestured || isNative() || ((navigator as Nav).userActivation?.hasBeenActive ?? false);
  }

  private context(create: boolean): AudioContext | null {
    if (this.ctx || !create || typeof window === 'undefined') return this.ctx;
    const AC = window.AudioContext ?? (window as Win).webkitAudioContext;
    if (!AC) return null;
    // iOS 17+: 'ambient' mixes with the player's own music or podcast and follows the silent switch
    try { const s = (navigator as Nav).audioSession; if (s) s.type = 'ambient'; } catch { /* older WebKit */ }
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { return null; }
    this.mix = buildMix(this.ctx);
    if (!this.sound) this.mix.sfx.gain.value = 0;
    if (this.paused) this.ctx.suspend().catch(() => {});
    return this.ctx;
  }

  /** The context when sounds can be scheduled right now, else null (and a quiet attempt to wake it). */
  private live(): AudioContext | null {
    if (this.paused) return null;
    const c = this.context(this.mayStart());
    if (!c) return null;
    const st = c.state as string; // iOS adds 'interrupted'
    if (st === 'running') return c;
    if (st === 'closed') return null;
    if (this.now() - this.resumeAt < RESUME_GRACE) return c; // unlock() just asked to resume
    if (this.mayStart()) c.resume().catch(() => {});
    return null;
  }

  unlock(): void {
    this.gestured = true;
    const c = this.context(true);
    if (!c) return;
    if (!this.paused && c.state !== 'running') { this.resumeAt = this.now(); c.resume().catch(() => {}); }
    if (!this.primed) { // older iOS WebKit only opens the audio route for a source started inside the gesture
      const s = c.createBufferSource();
      s.buffer = c.createBuffer(1, 1, c.sampleRate);
      s.connect(c.destination); s.start(0);
      this.primed = true;
    }
    this.syncMusic();
  }

  play(s: Sfx): void {
    let semi = 0;
    const t = this.now();
    if (s === 'paint') { // manual plinks use the same streak and throttle as painting riders
      const r = shot(this.streak, t);
      this.streak = r.s;
      if (r.semi === null) return;
      semi = r.semi;
    } else if (s === 'coin') {
      const run = this.coinRun;
      if (t - run.at > COIN_RUN_RESET) run.n = 0;
      semi = coinSemi(run.n++); run.at = t;
    }
    this.start({ sfx: s, delay: 0, semi });
  }

  gameEvents(events: readonly GameEvent[], game: Game): void {
    if (!events.length) return;
    const r = eventCues(events, game, this.streak, this.now());
    this.streak = r.streak;
    for (const c of r.cues) this.start(c);
    if (r.haptic) this.haptic(r.haptic.kind, r.haptic.delay);
  }

  private start(cue: Cue): void {
    if (!this.sound) return;
    const at = this.now() + cue.delay;
    if (!sfxReady(this.last, cue.sfx, at)) return;
    const c = this.live();
    if (!c || !this.mix) return;
    this.last[cue.sfx] = at;
    playSfx(c, this.mix, cue.sfx, c.currentTime + START + cue.delay, cue.semi ?? 0);
  }

  music(track: 'home' | 'play' | null): void {
    this.want = track;
    this.syncMusic();
  }

  private syncMusic(): void {
    const c = this.context(this.want !== null && this.musicOn && this.mayStart());
    if (!c || !this.mix) return;
    this.player ??= new MusicPlayer(c, this.mix.music);
    this.player.play(this.musicOn ? this.want : null);
    this.player.run(!this.paused);
  }

  setSound(on: boolean): void {
    this.sound = on;
    if (this.ctx && this.mix) this.mix.sfx.gain.setTargetAtTime(on ? SFX_LEVEL : 0, this.ctx.currentTime, 0.02); // cut tails too
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    this.syncMusic();
  }

  setVibration(on: boolean): void { this.vibration = on; }

  haptic(kind: HapticKind, delay = 0): void {
    if (!this.vibration || this.paused) return;
    const at = this.now() + delay;
    if (!hapticReady(this.lastHaptic, kind, at)) return;
    this.lastHaptic = at;
    if (delay > 0) setTimeout(() => { if (!this.paused) buzz(kind); }, delay * 1000);
    else buzz(kind);
  }

  suspend(on: boolean): void {
    if (on === this.paused) return;
    this.paused = on;
    this.player?.run(!on);
    const c = this.ctx;
    if (!c) return;
    if (on) c.suspend().catch(() => {});
    else { this.resumeAt = this.now(); c.resume().catch(() => {}); }
  }

  private meter: { a: AnalyserNode; buf: Float32Array<ArrayBuffer> } | null = null;

  /** Dev and diagnostics: peak of the final output over the last ~20 ms (0 when there is no context). */
  level(): number {
    if (!this.ctx || !this.mix) return 0;
    if (!this.meter) {
      const a = this.ctx.createAnalyser();
      a.fftSize = 1024;
      this.mix.out.connect(a);
      this.meter = { a, buf: new Float32Array(a.fftSize) };
    }
    this.meter.a.getFloatTimeDomainData(this.meter.buf);
    let p = 0;
    for (const v of this.meter.buf) p = Math.max(p, Math.abs(v));
    return p;
  }

  /** Dev and diagnostics: what the audio is doing. */
  debug(): { state: string; track: TrackName | null; sound: boolean; music: boolean; vibration: boolean; paused: boolean; native: boolean } {
    return {
      state: this.ctx?.state ?? 'none', track: this.player?.track ?? null, sound: this.sound, music: this.musicOn,
      vibration: this.vibration, paused: this.paused, native: isNative(),
    };
  }
}

const sound = new Sound();
export const audio: AudioApi = sound;
export const audioDebug = (): ReturnType<Sound['debug']> => sound.debug();
export const audioLevel = (): number => sound.level();
