// The 20 launch levels: rules hold and the stored solutions clear them, in both the solver model and the real-time game.
import { describe, expect, it } from 'vitest';
import { AMMO, apply, Game, level, needSlots, start, V1_COUNT, V1_NEED, validate, type Move, type State } from '../src/engine';

/** Play a solver move in the real-time game, one Purrlet (or linked pair) at a time. */
function playInGame(g: Game, m: Move) {
  if (m.kind === 'q') expect(g.launchQueue(m.qs[0]!).length).toBeGreaterThan(0);
  else expect(g.launchTray(m.i).length).toBeGreaterThan(0);
  g.settle();
}

describe.each(Array.from({ length: V1_COUNT }, (_, i) => i + 1))('level %i', n => {
  const L = level(n);

  it('keeps paint conservation and ammo bounds', () => {
    expect(() => validate(L)).not.toThrow();
    for (const q of L.queues) for (const s of q) expect(s.a).toBeLessThanOrEqual(AMMO.max);
    for (const q of L.queues) expect(q[0]?.hidden).toBeFalsy(); // mystery Purrlets never start at the front
  });

  it('has a stored solution that clears it', () => {
    expect(L.solution?.ok).toBe(true);
    let st: State = start(L);
    for (const m of L.solution!.plan!) {
      const nx = apply(L, st, m);
      expect(nx.dead).toBe(false);
      st = nx;
    }
    expect(st.left).toBe(0);
  });

  it('the same solution clears it in the real-time game, state for state', () => {
    const g = new Game(L);
    let st: State = start(L);
    for (const m of L.solution!.plan!) {
      playInGame(g, m);
      st = apply(L, st, m);
      expect(g.left).toBe(st.left);
      expect(Array.from(g.px)).toEqual(Array.from(st.px));
      expect(g.tray.map(t => [t.c, t.a])).toEqual(st.tray.map(t => [t.c, t.a]));
    }
    expect(g.status).toBe('won');
  });

  it('needs the tuned number of tray slots', () => {
    expect(needSlots(L, 2000)).toBe(V1_NEED[n - 1]);
  });
});
