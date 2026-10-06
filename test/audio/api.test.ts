import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioApi } from '../../src/app/contracts';

// A small stand-in for Web Audio: enough surface for the synth, music and mix code, counting what gets made.
class Param {
  value = 1;
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  setTargetAtTime(v: number) { this.value = v; return this; }
  cancelScheduledValues() { return this; }
}
class Node {
  gain = new Param(); frequency = new Param(); detune = new Param(); Q = new Param(); delayTime = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  type = ''; loop = false; buffer: unknown = null; curve: unknown = null; onended: (() => void) | null = null;
  constructor(readonly kind: string, readonly ctx: FakeCtx) {}
  connect<T>(n: T) { return n; }
  disconnect() {}
  start() { this.ctx.started[this.kind] = (this.ctx.started[this.kind] ?? 0) + 1; }
  stop() {}
}
class FakeCtx {
  static made: FakeCtx[] = [];
  state = 'suspended'; currentTime = 0; sampleRate = 48000; destination = new Node('dest', this);
  started: Record<string, number> = {};
  calls: string[] = [];
  constructor() { FakeCtx.made.push(this); }
  resume() { this.calls.push('resume'); this.state = 'running'; return Promise.resolve(); }
  suspend() { this.calls.push('suspend'); this.state = 'suspended'; return Promise.resolve(); }
  createBuffer(_c: number, n: number) { return { getChannelData: () => new Float32Array(n) }; }
  createOscillator() { return new Node('osc', this); }
  createBufferSource() { return new Node('src', this); }
  createGain() { return new Node('gain', this); }
  createBiquadFilter() { return new Node('filter', this); }
  createDynamicsCompressor() { return new Node('comp', this); }
  createWaveShaper() { return new Node('shaper', this); }
  createDelay() { return new Node('delay', this); }
  get oscs() { return this.started.osc ?? 0; }
}

async function load(withWindow: boolean): Promise<AudioApi> {
  vi.resetModules();
  FakeCtx.made = [];
  if (withWindow) vi.stubGlobal('window', { AudioContext: FakeCtx, addEventListener: () => {} });
  return (await import('../../src/audio/index')).audio;
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('audio api', () => {
  it('is a quiet no-op where there is no Web Audio (tests, SSR)', async () => {
    const a = await load(false);
    expect(() => {
      a.unlock(); a.play('pop'); a.music('home'); a.setSound(false); a.setMusic(false); a.setVibration(false);
      a.haptic('success'); a.suspend(true); a.suspend(false); a.music(null);
      a.gameEvents([{ type: 'won' }], { tray: [], trayCap: 5 } as never);
    }).not.toThrow();
  });

  it('makes the AudioContext lazily: not on import, not before a gesture on the web, once on unlock', async () => {
    const a = await load(true);
    expect(FakeCtx.made).toHaveLength(0);
    a.music('home'); a.play('tap');
    expect(FakeCtx.made).toHaveLength(0);
    a.unlock(); a.unlock();
    expect(FakeCtx.made).toHaveLength(1);
    expect(FakeCtx.made[0]!.calls).toContain('resume');
  });

  it('starts the wanted music on unlock, and plays sounds once running', async () => {
    vi.useFakeTimers();
    const a = await load(true);
    a.music('home');
    a.unlock();
    const c = FakeCtx.made[0]!;
    const afterMusic = c.oscs;
    expect(afterMusic).toBeGreaterThan(0); // the first pad chord is scheduled right away
    a.play('pop');
    expect(c.oscs).toBeGreaterThan(afterMusic);
    // the scheduler keeps pumping as time moves on (past the bar line at 3.4 s, where the bass always plays)
    const before = c.oscs;
    for (let k = 0; k < 70; k++) { c.currentTime += 0.06; vi.advanceTimersByTime(60); }
    expect(c.oscs).toBeGreaterThan(before);
  });

  it('respects setSound and suspend', async () => {
    const a = await load(true);
    a.unlock();
    const c = FakeCtx.made[0]!;
    a.setSound(false);
    let n = c.oscs;
    a.play('win');
    expect(c.oscs).toBe(n);
    a.setSound(true);
    a.suspend(true);
    expect(c.calls.at(-1)).toBe('suspend');
    n = c.oscs;
    a.play('win');
    expect(c.oscs).toBe(n);
    a.suspend(false);
    expect(c.calls.at(-1)).toBe('resume');
    a.play('win');
    expect(c.oscs).toBeGreaterThan(n);
  });

  it('stops scheduling music when music is switched off or the track is null', async () => {
    vi.useFakeTimers();
    const a = await load(true);
    a.unlock();
    const c = FakeCtx.made[0]!;
    a.music('play');
    a.setMusic(false);
    // after the fade-out, time passing schedules nothing new
    for (let k = 0; k < 80; k++) { c.currentTime += 0.06; vi.advanceTimersByTime(60); }
    const n = c.oscs;
    for (let k = 0; k < 80; k++) { c.currentTime += 0.06; vi.advanceTimersByTime(60); }
    expect(c.oscs).toBe(n);
    a.setMusic(true);
    for (let k = 0; k < 10; k++) { c.currentTime += 0.06; vi.advanceTimersByTime(60); }
    expect(c.oscs).toBeGreaterThan(n);
    a.music(null);
    for (let k = 0; k < 80; k++) { c.currentTime += 0.06; vi.advanceTimersByTime(60); }
    const m = c.oscs;
    for (let k = 0; k < 80; k++) { c.currentTime += 0.06; vi.advanceTimersByTime(60); }
    expect(c.oscs).toBe(m);
  });
});
