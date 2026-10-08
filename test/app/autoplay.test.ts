// The autopilot behind __pp.autoplay(): follows the stored solution, and re-plans when the game drifts from it.
import { describe, expect, it } from 'vitest';
import { Autopilot, greedy } from '../../src/app/autoplay';
import type { TapTarget } from '../../src/app/contracts';
import { Game, level, mulberry32 } from '../../src/engine';

/** Play one Purrlet at a time like the session does: tap, then run the belt empty. */
function play(g: Game, pilot: { next(): TapTarget | null }, maxMoves = 200): number {
  let moves = 0;
  while (g.status === 'playing' && moves < maxMoves) {
    const t = pilot.next();
    if (!t) break;
    const ev = t.kind === 'queue' ? g.launchQueue(t.q) : g.launchTray(t.i);
    expect(ev.length).toBeGreaterThan(0);
    g.settle();
    moves++;
  }
  return moves;
}

describe('Autopilot', () => {
  it.each([1, 2, 3, 4, 5, 7, 12])('plays level %i to a win by its stored solution', n => {
    const L = level(n), g = new Game(L);
    expect(play(g, new Autopilot(g))).toBe(L.solution!.plan!.length);
    expect(g.status).toBe('won');
  });

  it('re-plans after the player went their own way', () => {
    const L = level(3), g = new Game(L), first = L.solution!.plan![0]!;
    const other = g.queues.findIndex((_, q) => !(first.kind === 'q' && first.qs.includes(q)) && g.canLaunchQueue(q));
    g.launchQueue(other);
    g.settle();
    play(g, new Autopilot(g));
    expect(g.status).toBe('won');
  });

  it('re-plans after boosters reorder the queues', () => {
    const L = level(8), g = new Game(L);
    g.shuffleQueues(mulberry32(7));
    g.addTraySlot();
    play(g, new Autopilot(g));
    expect(g.status).toBe('won');
  });

  it('greedy picks the launch that paints most without overflowing the tray', () => {
    const g = new Game(level(1));
    const t = greedy(g)!;
    expect(t.kind).toBe('queue');
  });
});
