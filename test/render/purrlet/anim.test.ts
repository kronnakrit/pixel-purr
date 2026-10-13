import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../../src/engine';
import * as A from '../../../src/render/purrlet/anim';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const sample = (dur: number, n = 200) => Array.from({ length: n + 1 }, (_, i) => (dur * i) / n);

describe('easing', () => {
  it('starts at 0 and ends at 1', () => {
    for (const e of [A.linear, A.easeInOut, A.easeOut, A.easeIn, A.backOut()]) {
      expect(near(e(0), 0)).toBe(true);
      expect(near(e(1), 1)).toBe(true);
    }
  });
  it('clamps outside 0..1', () => {
    expect(A.easeOut(-1)).toBe(0);
    expect(A.easeInOut(2)).toBe(1);
  });
  it('back-out overshoots past 1 before settling', () => {
    const peak = Math.max(...sample(1).map(A.backOut()));
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.2);
  });
});

describe('track', () => {
  const keys: A.Key[] = [{ t: 0, v: 0 }, { t: 1, v: 10, e: A.linear }, { t: 2, v: 4 }];
  it('hits every key exactly and holds outside', () => {
    expect(A.track(keys, -1)).toBe(0);
    expect(A.track(keys, 0)).toBe(0);
    expect(A.track(keys, 1)).toBe(10);
    expect(A.track(keys, 2)).toBe(4);
    expect(A.track(keys, 5)).toBe(4);
  });
  it('interpolates with the easing of the key it moves into', () => {
    expect(A.track(keys, 0.25)).toBeCloseTo(2.5);
    expect(A.track(keys, 1.5)).toBeCloseTo(7); // sine in-out is 0.5 at the midpoint
  });
  it('handles an empty track', () => { expect(A.track([], 1)).toBe(0); });
});

describe('squash and stretch', () => {
  it('preserves volume', () => {
    for (const sy of [0.7, 0.82, 1, 1.16, 1.3]) {
      const s = A.squash(sy);
      expect(s.x * s.y * s.z).toBeCloseTo(1, 9);
      expect(s.y).toBe(sy);
      expect(s.x).toBe(s.z);
    }
  });
  it('squashing widens, stretching narrows', () => {
    expect(A.squash(0.8).x).toBeGreaterThan(1);
    expect(A.squash(1.2).x).toBeLessThan(1);
  });
});

describe('spring', () => {
  const run = (zeta: number, dt = 1 / 60, secs = 3) => {
    let s: A.Spring = { x: 0, v: 0 }, max = 0;
    for (let t = 0; t < secs; t += dt) { s = A.spring(s, 1, dt, 3, zeta); max = Math.max(max, s.x); }
    return { s, max };
  };
  it('settles on the target', () => {
    const { s } = run(0.6);
    expect(s.x).toBeCloseTo(1, 3);
    expect(Math.abs(s.v)).toBeLessThan(1e-2);
  });
  it('overshoots when under-damped, not when critically damped', () => {
    expect(run(0.4).max).toBeGreaterThan(1.05);
    expect(run(1).max).toBeLessThanOrEqual(1 + 1e-6);
  });
  it('stays stable on a long frame', () => {
    const s = A.spring({ x: 0, v: 0 }, 1, 0.5, 8, 0.3);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x)).toBeLessThan(3);
  });
  it('is pure', () => {
    const s0 = { x: 0, v: 0 };
    A.spring(s0, 1, 0.1);
    expect(s0).toEqual({ x: 0, v: 0 });
  });
});

describe('loops', () => {
  it('phase, wave and tri wrap and stay in range', () => {
    expect(A.phase(-0.25, 1)).toBeCloseTo(0.75);
    for (const t of sample(10)) {
      const w = A.wave(t, 0.7), k = A.tri(t, 0.3);
      expect(w).toBeGreaterThanOrEqual(0); expect(w).toBeLessThanOrEqual(1);
      expect(k).toBeGreaterThanOrEqual(-1 - 1e-9); expect(k).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(A.tri(0, 1)).toBeCloseTo(0);
  });
  it('idle breathing is 2.5-3% over a 3.4 s loop', () => {
    const v = sample(A.T.idle).map(A.idleBreath);
    expect(Math.min(...v)).toBeGreaterThan(0.965);
    expect(Math.max(...v)).toBeCloseTo(1);
    expect(A.idleBreath(0)).toBeCloseTo(A.idleBreath(A.T.idle));
  });
  it('peek rests most of the loop and pops up once', () => {
    expect(A.peek(0)).toBe(0);
    expect(A.peek(0.3 * A.T.peek)).toBe(0);
    expect(A.peek(0.7 * A.T.peek)).toBeCloseTo(0.05);
  });
  it('blink closes fully mid-blink and is open outside it', () => {
    expect(A.blink(-1)).toBe(0);
    expect(A.blink(A.T.blink / 2)).toBeCloseTo(1);
    expect(A.blink(A.T.blink + 0.01)).toBe(0);
  });
  it('ride ears lag the body by 0.1 s', () => {
    // the ear flap peaks a tenth of a second after the bob loop's midpoint
    const peakAt = sample(A.T.ride, 700).reduce((best, t) => (A.ride(t).ear > A.ride(best).ear ? t : best), 0);
    expect(peakAt).toBeCloseTo(A.T.ride / 2 + A.T.earLag, 2);
    expect(Math.max(...sample(A.T.ride).map(t => Math.abs(A.ride(t).rz)))).toBeCloseTo(2 * Math.PI / 180, 4);
  });
  it('dance loops back to rest every 0.9 s', () => {
    const a = A.dance(0), b = A.dance(A.T.dance * 3);
    expect(a.y).toBeCloseTo(0); expect(a.sy).toBeCloseTo(1); expect(b.rz).toBeCloseTo(0);
    expect(Math.max(...sample(A.T.dance).map(t => A.dance(t).y))).toBeCloseTo(0.27, 2);
  });
  it('worry shakes for 0.5 s then holds still', () => {
    const during = sample(A.T.worry).slice(1, -1).map(t => Math.abs(A.worryShake(t).x));
    expect(Math.max(...during)).toBeGreaterThan(0.04);
    expect(A.worryShake(A.T.worry)).toEqual({ x: 0, rz: 0 });
    expect(A.worryShake(3)).toEqual({ x: 0, rz: 0 });
  });
  it('z and sweat fade in and out', () => {
    expect(A.zz(0).a).toBeCloseTo(0);
    expect(A.zz(0.2 * A.T.zz).a).toBeCloseTo(1);
    expect(A.sweat(0).a).toBe(0);
    expect(A.sweat(0.3 * A.T.sweat).a).toBe(1);
  });
});

describe('one-shots', () => {
  const atRest = (p: A.Pose) => near(p.y, 0, 1e-9) && near(p.sy, 1, 1e-9) && near(p.s, 1, 1e-9) && near(p.rz, 0, 1e-9) && near(p.ry, 0, 1e-9);
  it('hop: anticipation squash 14-18%, stretch in the air, land squash, ends at rest', () => {
    expect(atRest(A.hop(0))).toBe(true);
    expect(A.hop(0.1 * A.T.hop).sy).toBeCloseTo(0.82);
    expect(A.hop(0.1 * A.T.hop).y).toBe(0);
    const air = A.hop(0.3 * A.T.hop);
    expect(air.sy).toBeGreaterThan(1.1);
    expect(air.y).toBeGreaterThan(0.3);
    expect(A.hop(0.5 * A.T.hop, 0.5).y).toBeCloseTo(0.5);
    expect(A.hop(0.7 * A.T.hop).sy).toBeLessThan(0.9);
    expect(atRest(A.hop(A.T.hop))).toBe(true);
  });
  it('shoot: 7% recoil within 0.25 s', () => {
    expect(Math.max(...sample(A.T.shoot).map(t => A.shoot(t).back))).toBeCloseTo(0.07);
    expect(Math.max(...sample(A.T.shoot).map(t => A.shoot(t).sy))).toBeCloseTo(1.07);
    expect(atRest(A.shoot(A.T.shoot))).toBe(true);
    expect(A.shoot(A.T.shoot).back).toBeCloseTo(0);
  });
  it('land: arrives squashed and settles', () => {
    expect(A.land(0).sy).toBeCloseTo(0.8);
    expect(atRest(A.land(A.T.land))).toBe(true);
  });
  it('pop: squash, jump, grow 22%, vanish by 0.7 s', () => {
    const t = sample(A.T.pop).map(A.pop);
    expect(Math.min(...t.map(p => p.sy))).toBeCloseTo(0.84);
    expect(Math.max(...t.map(p => p.y))).toBeCloseTo(0.37);
    const grow = Math.max(...t.map(p => p.s));
    expect(grow).toBeGreaterThan(1.21); expect(grow).toBeLessThan(1.3);
    expect(A.pop(0.8 * A.T.pop).s).toBeCloseTo(1.22);
    expect(A.pop(A.T.pop).s).toBe(0);
    expect(A.POP_BURST).toBeLessThan(A.T.pop);
  });
  it('reveal: wiggle, swap exactly at the half-turn (edge-on), 15% overshoot, ends at rest', () => {
    const half = sample(A.T.reveal, 600).find(t => A.reveal(t).swapped)!;
    expect(Math.abs(A.reveal(half - 1e-3).ry)).toBeCloseTo(Math.PI / 2, 1);
    expect(Math.abs(A.reveal(half).ry)).toBeCloseTo(Math.PI / 2, 1);
    expect(Math.max(...sample(A.T.reveal).map(t => Math.abs(A.reveal(t).rz)))).toBeGreaterThan(0.1);
    expect(Math.max(...sample(A.T.reveal).map(t => A.reveal(t).s))).toBeCloseTo(1.15, 2);
    const end = A.reveal(A.T.reveal);
    expect(end.swapped).toBe(true);
    expect(atRest(end)).toBe(true);
  });
  it('reduced motion versions never move the cat, only scale it', () => {
    for (const f of [A.tapPulse, A.popCalm]) for (const t of sample(0.6)) {
      const p = f(t);
      expect(p.y).toBe(0); expect(p.x).toBe(0); expect(p.rz).toBe(0); expect(p.sy).toBe(1);
      expect(p.s).toBeLessThanOrEqual(1.06 + 1e-9);
    }
    expect(A.popCalm(A.POP_CALM).s).toBe(0);
    expect(A.tapPulse(A.T.tapPulse).s).toBe(1);
  });
});

describe('random timers', () => {
  it('blinks land every 4 to 6 seconds and differ per seed', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const s = A.nextIn(r, A.T.blinkMin, A.T.blinkMax);
      expect(s).toBeGreaterThanOrEqual(4); expect(s).toBeLessThan(6);
    }
    expect(A.nextIn(mulberry32(1), 4, 6)).not.toBe(A.nextIn(mulberry32(2), 4, 6));
  });
});
