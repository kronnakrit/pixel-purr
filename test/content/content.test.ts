// Content: every shipped level loads, keeps the rules, is proven solvable and sits in its difficulty band;
// pictures and names are unique; the cheap picture path matches the built levels; metadata and intro cards.
import { describe, expect, it } from 'vitest';
import { BOOSTER_KEYS, type IntroKey } from '../../src/app/contracts';
import { content, LEVEL_FILES, SHIPPED } from '../../src/content';
import { contentParams, FIRST_FILE_LEVEL, LAST_FILE_LEVEL } from '../../src/content/params';
import { PICTURES_21_60 } from '../../src/content/pictures';
import { AMMO, apply, colorsOf, Game, needSlots, raster, start, validate, type Level, type Move, type Picture, type State } from '../../src/engine';

const SHIPPED_LEVELS = Array.from({ length: 60 }, (_, i) => i + 1);
const pxKey = (p: { w: number; h: number; px: Uint8Array }) => `${p.w}x${p.h}:` + Array.from(p.px, c => c.toString(36)).join('');

// Take the cheap pictures before anything builds a level, so levelPicture can't reuse a built level.
const SAMPLES = [1, 7, 18, 20, 21, 22, 35, 47, 60, 61, 62, 63, 64, 75, 100];
const cheap = new Map<number, Picture>(SAMPLES.map(n => [n, content.levelPicture(n)]));

/** Replay a solver plan in the real-time game, one Purrlet (or linked pair) at a time, checking every state. */
function replay(L: Level, plan: Move[]): void {
  const g = new Game(L);
  let st: State = start(L);
  for (const m of plan) {
    const ev = m.kind === 'q' ? g.launchQueue(m.qs[0]!) : g.launchTray(m.i);
    expect(ev.length).toBeGreaterThan(0);
    g.settle();
    st = apply(L, st, m);
    expect(st.tray.length).toBeLessThanOrEqual(L.tray);
    expect(g.left).toBe(st.left);
    expect(g.tray.map(t => [t.c, t.a])).toEqual(st.tray.map(t => [t.c, t.a]));
  }
  expect(st.left).toBe(0);
  expect(g.status).toBe('won');
}

describe('shipped levels', () => {
  it('ships 60 levels', () => {
    expect(SHIPPED).toBe(60);
    expect(content.shipped).toBe(60);
  });

  describe.each(SHIPPED_LEVELS)('level %i', n => {
    const L = content.getLevel(n);

    it('keeps paint conservation, ammo bounds and fair starts', () => {
      expect(() => validate(L)).not.toThrow();
      for (const q of L.queues) {
        for (const s of q) expect(s.a).toBeLessThanOrEqual(AMMO.max);
        expect(q[0]?.hidden).toBeFalsy(); // mystery Purrlets never start at the front
      }
      expect(L.queues.length).toBeGreaterThanOrEqual(2);
      if (n > 20) expect(L.intro).toBeNull();
    });

    it('is proven solvable at load and the plan clears it in the real-time game', () => {
      expect(L.solution?.ok).toBe(true);
      expect(L.solution!.nodes).toBeLessThanOrEqual(4000);
      replay(L, L.solution!.plan!);
    });

    it('needs a number of tray slots inside its band', () => {
      const need = needSlots(L, 2000);
      expect(need).toBe(L.need);
      expect(need).toBeGreaterThanOrEqual(L.P.need[0]);
      expect(need).toBeLessThanOrEqual(L.P.need[1]);
    });

    it('has a 24-32 picture with 2-7 colours (3+ from level 21)', () => {
      const cols = colorsOf(L.px).length;
      expect(cols).toBeLessThanOrEqual(7);
      expect(cols).toBeGreaterThanOrEqual(n > 20 ? 3 : 2);
      if (n > 20) expect(L.w).toBeGreaterThanOrEqual(24);
      expect(L.w).toBeLessThanOrEqual(32);
    });
  });

  it('caches built levels', () => {
    expect(content.getLevel(33)).toBe(content.getLevel(33));
    expect(content.getLevel(3)).toBe(content.getLevel(3));
  });

  it('has unique names and unique pictures across 1-60', () => {
    const names = SHIPPED_LEVELS.map(n => content.levelMeta(n).name);
    expect(new Set(names).size).toBe(60);
    const pics = SHIPPED_LEVELS.map(n => pxKey(content.levelPicture(n)));
    expect(new Set(pics).size).toBe(60);
    for (const n of SHIPPED_LEVELS) expect(content.levelMeta(n).name).toBe(content.getLevel(n).name);
  });
});

describe('level files 21-60', () => {
  it('has one file per level, in order', () => {
    expect(LEVEL_FILES.map(f => f.n)).toEqual(Array.from({ length: LAST_FILE_LEVEL - FIRST_FILE_LEVEL + 1 }, (_, i) => FIRST_FILE_LEVEL + i));
  });

  it('matches the picture recipes (rerun tools/levels.ts after changing a picture)', () => {
    LEVEL_FILES.forEach((f, i) => {
      const def = PICTURES_21_60[i]!;
      expect(f.name).toBe(def.name);
      expect(pxKey(content.levelPicture(f.n))).toBe(pxKey(raster(def, def.size)));
    });
  });

  it('keeps full-background pictures full and the generator knobs in range', () => {
    PICTURES_21_60.forEach((def, i) => {
      const n = FIRST_FILE_LEVEL + i, P = contentParams(n, def);
      if (def.bg) expect(raster(def, def.size).px.every(c => c > 0)).toBe(true);
      expect(P.size).toBe(def.size);
      expect(P.need[0]).toBeLessThanOrEqual(P.need[1]);
      expect(P.queues).toBe(n % 5 === 0 ? 2 : P.queues);
      expect(content.getLevel(n).P).toEqual(P); // the app restores the same knobs from the file alone
    });
  });

  it('gets harder on spicy levels and relaxes right after', () => {
    for (let n = 25; n <= 60; n += 5) {
      const spicy = content.getLevel(n).need!, before = content.getLevel(n - 1).need!, after = content.getLevel(n + 1 <= 60 ? n + 1 : n - 4).need!;
      expect(spicy).toBeGreaterThan(before);
      expect(spicy).toBeGreaterThan(after);
    }
  });
});

describe('levelPicture', () => {
  it.each(SAMPLES)('level %i: the cheap picture equals the built level', n => {
    const p = cheap.get(n)!, L = content.getLevel(n);
    expect(p.name).toBe(L.name);
    expect(pxKey(p)).toBe(pxKey(L));
    expect(content.levelMeta(n).name).toBe(L.name);
  });
});

describe('levelMeta', () => {
  it('marks spicy levels, intro cards and booster unlocks', () => {
    const intros: Record<number, IntroKey> = { 1: 'basics', 2: 'tray', 5: 'spicy', 7: 'mystery', 12: 'linked', 18: 'background' };
    const unlocks = { 4: 'slot', 6: 'shuffle', 9: 'nap', 13: 'xray' } as const;
    for (let n = 1; n <= 80; n++) {
      const m = content.levelMeta(n);
      expect(m.n).toBe(n);
      expect(m.spicy).toBe(n % 5 === 0);
      expect(m.intro).toBe(intros[n] ?? null);
      expect(m.unlocks).toBe(unlocks[n as keyof typeof unlocks] ?? null);
      expect(m.name.length).toBeGreaterThan(0);
    }
    expect(Object.values(unlocks).sort()).toEqual([...BOOSTER_KEYS].sort());
  });

  it('rejects bad level numbers', () => {
    expect(() => content.levelMeta(0)).toThrow();
    expect(() => content.getLevel(1.5)).toThrow();
  });
});

describe('introCard', () => {
  it.each(['basics', 'tray', 'spicy', 'mystery', 'linked', 'background'] as IntroKey[])('%s has a short title and a one-sentence body', k => {
    const c = content.introCard(k);
    expect(c.title.length).toBeGreaterThan(3);
    expect(c.title.length).toBeLessThanOrEqual(24);
    expect(c.body).toMatch(/^[A-Z][^.!?]*[.!]$/);
    expect(c.body.length).toBeLessThanOrEqual(120);
  });
});
