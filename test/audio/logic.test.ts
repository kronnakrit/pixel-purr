import { describe, expect, it } from 'vitest';
import {
  COIN_RUN, DELAY, HAPTIC_GAP, PLINK_RATE, PLINK_SLACK, STREAK_RESET, STREAK_SCALE, coinSemi, eventCues, hapticReady, newStreak,
  sfxReady, shot, streakSemi, type Streak, type TrayLike,
} from '../../src/audio/logic';
import { Game, level, type GameEvent } from '../../src/engine';

const STEP = 1 / 36; // the controller's belt rate
const tray = (length: number, trayCap = 5): TrayLike => ({ tray: { length }, trayCap });

/** Feed shots at the given times through the streak; returns the plinks that played. */
function plinks(times: number[], s: Streak = newStreak()): { t: number; semi: number }[] {
  const out: { t: number; semi: number }[] = [];
  for (const t of times) { const r = shot(s, t); s = r.s; if (r.semi !== null) out.push({ t, semi: r.semi }); }
  return out;
}

describe('streak pitch', () => {
  it('climbs the major pentatonic scale, then walks back down and up again', () => {
    const first = STREAK_SCALE.map((_, n) => streakSemi(n));
    expect(first).toEqual([...STREAK_SCALE]);
    for (let n = 1; n < STREAK_SCALE.length; n++) expect(streakSemi(n)).toBeGreaterThan(streakSemi(n - 1));
    const top = STREAK_SCALE.length - 1;
    expect(streakSemi(top + 1)).toBe(STREAK_SCALE[top - 1]);
    expect(streakSemi(2 * top)).toBe(0);
    expect(streakSemi(2 * top + 1)).toBe(STREAK_SCALE[1]);
    // G5-based: every note is in C major pentatonic (G A C D E)
    for (let n = 0; n < 40; n++) expect([0, 2, 4, 7, 9]).toContain((streakSemi(n) + 7) % 12);
  });

  it('rises along consecutive plinks and resets after a quiet gap', () => {
    const p = plinks([0, 0.1, 0.2, 0.3, 0.3 + STREAK_RESET + 0.01, 0.8]);
    expect(p.map(x => x.semi)).toEqual([streakSemi(0), streakSemi(1), streakSemi(2), streakSemi(3), streakSemi(0), streakSemi(1)]);
  });

  it('keeps the streak alive across throttled shots', () => {
    // a rider shooting every step for a whole second: shots never stop, so the pitch never resets
    const times = Array.from({ length: 36 }, (_, k) => k * STEP);
    const p = plinks(times);
    expect(p.map(x => x.semi)).toEqual(p.map((_, n) => streakSemi(n)));
  });
});

describe('plink throttle', () => {
  it('holds a step-rate stream of shots to about 14 plinks a second', () => {
    const times = Array.from({ length: 36 * 3 }, (_, k) => k * STEP); // 3 s at 36 shots/s
    const p = plinks(times);
    expect(p.length).toBeGreaterThanOrEqual(PLINK_RATE * 3 - 1);
    expect(p.length).toBeLessThanOrEqual(PLINK_RATE * 3 + 1);
    for (let k = 1; k < p.length; k++) expect(p[k]!.t - p[k - 1]!.t).toBeGreaterThanOrEqual(1 / PLINK_RATE - PLINK_SLACK - 1e-9);
  });

  it('never bursts: any one-second window holds at most 15 plinks, even with several riders per step', () => {
    const times: number[] = [];
    for (let k = 0; k < 36 * 4; k++) for (let r = 0; r < 4; r++) times.push(k * STEP); // 4 riders shooting every step
    const p = plinks(times);
    for (const a of p) expect(p.filter(b => b.t >= a.t && b.t < a.t + 1).length).toBeLessThanOrEqual(PLINK_RATE + 1);
  });

  it('plays every shot when they are slower than the limit', () => {
    const times = Array.from({ length: 10 }, (_, k) => k * 0.1);
    expect(plinks(times)).toHaveLength(10);
  });

  it('plays only one plink for shots in the same step', () => {
    expect(plinks([1, 1, 1])).toHaveLength(1);
  });
});

describe('re-trigger gaps', () => {
  it('lets a sound start again only after its gap', () => {
    const last = { pop: 1 };
    expect(sfxReady(last, 'pop', 1.02)).toBe(false);
    expect(sfxReady(last, 'pop', 1.07)).toBe(true);
    expect(sfxReady(last, 'tap', 1.0)).toBe(true); // other sounds are independent
  });

  it('merges close light haptics but never drops success or warning', () => {
    expect(hapticReady(1, 'light', 1 + HAPTIC_GAP / 2)).toBe(false);
    expect(hapticReady(1, 'medium', 1 + HAPTIC_GAP)).toBe(true);
    expect(hapticReady(1, 'warning', 1.001)).toBe(true);
    expect(hapticReady(1, 'success', 1.001)).toBe(true);
  });

  it('climbs coin ticks in a run', () => {
    expect(COIN_RUN.map((_, i) => coinSemi(i))).toEqual([...COIN_RUN]);
    expect(coinSemi(COIN_RUN.length)).toBe(COIN_RUN[0]);
  });
});

describe('engine events → sounds and haptics', () => {
  const cues = (events: GameEvent[], t = tray(0)) => eventCues(events, t, newStreak(), 10);
  const sfx = (events: GameEvent[], t = tray(0)) => cues(events, t).cues.map(c => c.sfx);

  it.each<[GameEvent, string[], string | null]>([
    [{ type: 'launch', ids: [1], from: 'queue' }, ['tap'], 'light'],
    [{ type: 'shot', id: 1, s: 0, j: 0 }, ['paint'], null],
    [{ type: 'pop', id: 1 }, ['pop'], 'medium'],
    [{ type: 'park', id: 1, a: 3 }, ['park'], null],
    [{ type: 'reveal', id: 1 }, ['reveal'], 'light'],
    [{ type: 'won' }, ['win'], 'success'],
    [{ type: 'lost' }, ['lose'], 'warning'],
    [{ type: 'traySlots', cap: 6 }, ['cushion'], null],
    [{ type: 'shuffle', order: [[1, 2]] }, ['shuffle'], null],
    [{ type: 'napBack', moves: [{ id: 1, q: 0 }] }, ['nap'], null],
    [{ type: 'xrayArmed' }, ['xray'], null],
    [{ type: 'resumed' }, [], null],
  ])('%o', (e, want, haptic) => {
    const r = cues([e]);
    expect(r.cues.map(c => c.sfx)).toEqual(want);
    expect(r.haptic?.kind ?? null).toBe(haptic);
  });

  it('worries (with a warning buzz) when a park fills the tray', () => {
    const r = cues([{ type: 'park', id: 1, a: 2 }], tray(5));
    expect(r.cues).toEqual([{ sfx: 'park', delay: 0 }, { sfx: 'worry', delay: DELAY.worry }]);
    expect(r.haptic).toEqual({ kind: 'warning', delay: DELAY.worry });
    // with the extra cushion the same tray is not full yet
    expect(sfx([{ type: 'park', id: 1, a: 2 }], tray(5, 6))).toEqual(['park']);
    // the losing park plays "oh no", not the worry
    expect(sfx([{ type: 'park', id: 1, a: 2 }, { type: 'lost' }], tray(6))).toEqual(['park', 'lose']);
    // the tray being full without a park in this batch is not news
    expect(sfx([{ type: 'pop', id: 2 }], tray(5))).toEqual(['pop']);
  });

  it('plays each sound once per batch and keeps the strongest haptic', () => {
    const r = cues([{ type: 'pop', id: 1 }, { type: 'pop', id: 2 }, { type: 'launch', ids: [3], from: 'tray' }]);
    expect(r.cues.map(c => c.sfx)).toEqual(['pop', 'tap']);
    expect(r.haptic?.kind).toBe('medium');
  });

  it('times the reveal after the hop, and the fanfare after the last chime', () => {
    const r = cues([{ type: 'launch', ids: [1], from: 'queue' }, { type: 'reveal', id: 2 }]);
    expect(r.cues).toEqual([{ sfx: 'tap', delay: 0 }, { sfx: 'reveal', delay: DELAY.reveal }]);
    const w = cues([{ type: 'shot', id: 1, s: 3, j: 4 }, { type: 'pop', id: 1 }, { type: 'won' }]);
    expect(w.cues.map(c => c.sfx)).toEqual(['paint', 'pop', 'win']);
    expect(w.cues[2]!.delay).toBe(DELAY.win);
    expect(w.haptic).toEqual({ kind: 'success', delay: DELAY.win });
  });

  it('carries the paint streak across batches', () => {
    let s = newStreak();
    const semis: number[] = [];
    for (let k = 0; k < 6; k++) {
      const r = eventCues([{ type: 'shot', id: 1, s: k, j: k }, { type: 'shot', id: 2, s: k + 9, j: 50 + k }], tray(0), s, k * 0.08);
      s = r.streak;
      semis.push(r.cues[0]!.semi!);
      expect(r.cues).toHaveLength(1); // two riders in one step: one plink
    }
    expect(semis).toEqual([0, 1, 2, 3, 4, 5].map(streakSemi));
  });
});

describe('a real level through the mapping', () => {
  /** Play level n at 36 steps/s on a fake clock (careless taps when greedy), collecting every cue. */
  function run(n: number, greedy: boolean) {
    const L = level(n), g = new Game(L), plan = L.solution?.plan ?? [];
    let s = newStreak(), t = 0, k = 0, wait = 0, shots = 0;
    const out: { t: number; sfx: string; semi?: number; trayLen: number; cap: number }[] = [];
    const feed = (ev: GameEvent[]) => {
      shots += ev.filter(e => e.type === 'shot').length;
      const r = eventCues(ev, g, s, t);
      s = r.streak;
      for (const c of r.cues) out.push({ t: t + c.delay, sfx: c.sfx, ...(c.semi === undefined ? {} : { semi: c.semi }), trayLen: g.tray.length, cap: g.trayCap });
    };
    for (let i = 0; i < 200_000 && g.status === 'playing'; i++) {
      if ((wait -= STEP) <= 0) {
        let ev: GameEvent[] = [];
        if (greedy) { for (let q = g.queues.length - 1; q >= 0 && !ev.length; q--) ev = g.launchQueue(q); }
        else { const m = plan[k]; ev = m ? (m.kind === 'q' ? g.launchQueue(m.qs[0]!) : g.launchTray(m.i)) : []; if (ev.length) k++; }
        feed(ev);
        wait = ev.length ? 0.5 : 0.1;
      }
      feed(g.step());
      t += STEP;
      if (!g.riders.length && !g.queues.some(q => q.length) && !g.tray.length) break;
    }
    return { out, status: g.status, shots, t };
  }

  it('wins level 3 with a fanfare, paints at no more than 14 plinks a second', () => {
    const r = run(3, false);
    expect(r.status).toBe('won');
    expect(r.out.filter(c => c.sfx === 'win')).toHaveLength(1);
    const p = r.out.filter(c => c.sfx === 'paint');
    expect(p.length).toBeGreaterThan(0);
    expect(p.length).toBeLessThanOrEqual(r.shots);
    for (const a of p) expect(p.filter(b => b.t >= a.t && b.t < a.t + 1).length).toBeLessThanOrEqual(PLINK_RATE + 1);
    expect(r.out.some(c => c.sfx === 'pop')).toBe(true);
    expect(r.out.some(c => c.sfx === 'lose' || c.sfx === 'worry')).toBe(false);
  });

  it('careless play fills the tray: worry exactly when it fills, then "oh no"', () => {
    const r = run(8, true);
    expect(r.status).toBe('lost');
    const worry = r.out.filter(c => c.sfx === 'worry');
    expect(worry.length).toBeGreaterThan(0);
    for (const w of worry) expect(w.trayLen).toBe(w.cap);
    expect(r.out.filter(c => c.sfx === 'lose')).toHaveLength(1);
  });
});
