import { describe, expect, it } from 'vitest';
import { assemble, C, Game, level, paramsFor, type Level, type Purrlet } from '../src/engine';

/** Build a test level from a picture string (rows of colour digits) and queues of [colour, ammo]. */
function make(rows: string[], queues: [number, number][][], tray = 5): Level {
  const h = rows.length, w = rows[0]!.length;
  const px = Uint8Array.from(rows.join(''), ch => parseInt(ch, 36));
  let id = 0;
  const Q: Purrlet[][] = queues.map((q, qi) => q.map(([c, a], d) => ({ id: id++, q: qi, d, c, a })));
  return { ...assemble({ w, h, px, name: 'test' }, Q, paramsFor(1)), tray };
}
const ring = ['666', '616', '666']; // soda ring around one cherry pixel

describe('Game', () => {
  it('paints the first matching pixel in line and parks leftovers', () => {
    const g = new Game(make(ring, [[[C.cherry, 1]], [[C.soda, 8]]]));
    g.launchQueue(0);
    const ev = g.settle();
    expect(ev).toContainEqual({ type: 'park', id: 0, a: 1 }); // cherry pixel is hidden behind soda
    g.launchQueue(1);
    expect(g.settle().filter(e => e.type === 'shot')).toHaveLength(8);
    g.launchTray(0);
    g.settle();
    expect(g.status).toBe('won');
    expect(g.tray).toHaveLength(0);
  });

  it('loses when the tray overflows', () => {
    const g = new Game(make(ring, [[[C.cherry, 1]], [[C.soda, 8]]], 0));
    g.launchQueue(0);
    expect(g.settle().at(-1)).toEqual({ type: 'lost' });
    expect(g.launchQueue(1)).toEqual([]);
  });

  it('pops a Purrlet the moment its paint runs out', () => {
    const g = new Game(make(['11', '11'], [[[C.cherry, 4]]]));
    g.launchQueue(0);
    const ev = g.settle();
    expect(ev.filter(e => e.type === 'shot')).toHaveLength(4);
    expect(ev).toContainEqual({ type: 'pop', id: 0 });
    expect(g.tick).toBeLessThan(g.beltLength);
  });

  it('keeps the entry clear and holds at most five riders', () => {
    const rows = Array.from({ length: 10 }, () => '1'.repeat(10));
    const g = new Game(make(rows, Array.from({ length: 6 }, () => [[C.soda, 5]])));
    expect(g.launchQueue(0)).not.toEqual([]);
    expect(g.canLaunchQueue(1)).toBe(false); // too close behind
    g.step(); g.step();
    for (let q = 1; q < 5; q++) { expect(g.launchQueue(q)).not.toEqual([]); g.step(); g.step(); }
    expect(g.riders).toHaveLength(5);
    expect(g.canLaunchQueue(5)).toBe(false); // belt full
    g.settle();
    expect(g.tray).toHaveLength(5);
    expect(g.canLaunchQueue(5)).toBe(true);
  });

  it('launches linked Purrlets together, two spots apart', () => {
    const L = make(['11', '11'], [[[C.cherry, 2]], [[C.cherry, 2]]]);
    L.byId[0]!.link = 1; L.byId[1]!.link = 0;
    const g = new Game(L);
    expect(g.launchQueue(1)).toEqual([{ type: 'launch', ids: [0, 1], from: 'queue' }]);
    expect(g.riders.map(r => r.s)).toEqual([0, -2]);
    g.settle();
    expect(g.status).toBe('won');
  });

  it('reveals a mystery Purrlet when it reaches the front', () => {
    const L = make(['11', '11'], [[[C.cherry, 2], [C.cherry, 2]]]);
    const p = L.byId[1]!;
    p.hidden = true;
    const g = new Game(L);
    expect(g.isRevealed(p)).toBe(false);
    expect(g.launchQueue(0)).toContainEqual({ type: 'reveal', id: 1 });
    expect(g.isRevealed(p)).toBe(true);
  });

  it('launch levels from 7 on include mystery Purrlets', () => {
    const hidden = Array.from({ length: 14 }, (_, i) => level(i + 7).queues.flat().filter(s => s.hidden).length);
    expect(hidden.reduce((a, b) => a + b)).toBeGreaterThan(0);
  });
});
