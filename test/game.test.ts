import { describe, expect, it } from 'vitest';
import { assemble, C, Game, level, mulberry32, paramsFor, type Level, type Purrlet } from '../src/engine';

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
    L.byId[1]!.hidden = true;
    const g = new Game(L), p = g.purrlet(1)!;
    expect(g.isRevealed(p)).toBe(false);
    expect(g.launchQueue(0)).toContainEqual({ type: 'reveal', id: 1 });
    expect(g.isRevealed(p)).toBe(true);
  });

  it('launch levels from 7 on include mystery Purrlets', () => {
    const hidden = Array.from({ length: 14 }, (_, i) => level(i + 7).queues.flat().filter(s => s.hidden).length);
    expect(hidden.reduce((a, b) => a + b)).toBeGreaterThan(0);
  });

  it('does not change the level it was built from', () => {
    const L = level(3), before = JSON.stringify(L.queues);
    const g = new Game(L);
    g.launchQueue(0); g.settle(); g.shuffleQueues(mulberry32(1));
    expect(JSON.stringify(L.queues)).toBe(before);
  });
});

describe('boosters', () => {
  it('Extra Cushion adds a slot, and as a continue it resumes a lost game', () => {
    const g = new Game(make(ring, [[[C.cherry, 1]], [[C.soda, 8]]], 0));
    g.launchQueue(0); g.settle();
    expect(g.status).toBe('lost');
    expect(g.addTraySlot()).toEqual([{ type: 'traySlots', cap: 1 }, { type: 'resumed' }]);
    expect(g.status).toBe('playing');
    g.launchQueue(1); g.settle(); g.launchTray(0); g.settle();
    expect(g.status).toBe('won');
  });

  it('Yarn Shuffle re-deals waiting Purrlets, keeps paint, and leaves linked pairs in place', () => {
    const L = level(12), g = new Game(L);
    const linked = g.queues.flat().filter(p => p.link !== undefined).map(p => [p.id, p.q, p.d]);
    const paint = (gg: Game) => gg.queues.flat().map(p => `${p.c}:${p.a}`).sort().join();
    const before = paint(g), order0 = g.queues.map(q => q.map(p => p.id)).join('|');
    const ev = g.shuffleQueues(mulberry32(7));
    expect(ev[0]?.type).toBe('shuffle');
    expect(paint(g)).toBe(before);
    expect(g.queues.map(q => q.map(p => p.id)).join('|')).not.toBe(order0);
    for (const [id, q, d] of linked) { const p = g.purrlet(id!)!; expect([p.q, p.d]).toEqual([q, d]); expect(g.queues[q!]![d!]).toBe(p); }
    g.queues.forEach((q, qi) => q.forEach((p, d) => expect([p.q, p.d]).toEqual([qi, d])));
  });

  it('Yarn Shuffle is only offered when it can change what the player sees, and always changes it', () => {
    // one waiting Purrlet, or several that look the same: nothing to re-deal
    expect(new Game(make(ring, [[[C.soda, 8]]])).canShuffle()).toBe(false);
    expect(new Game(make(ring, [[[C.soda, 4]], [[C.soda, 4]]])).canShuffle()).toBe(false);
    for (let seed = 1; seed <= 40; seed++) {
      const g = new Game(make(ring, [[[C.cherry, 1]], [[C.soda, 8]]]));
      expect(g.canShuffle()).toBe(true);
      expect(g.shuffleQueues(mulberry32(seed))[0]).toEqual({ type: 'shuffle', order: [[1], [0]] });
    }
  });

  it('a revealed mystery Purrlet stays revealed after a shuffle, and is revealed only once', () => {
    const L = make(ring, [[[C.cherry, 1]], [[C.soda, 4], [C.soda, 4]]]);
    L.queues[1]![1]!.hidden = true;
    const g = new Game(L), m = g.purrlet(2)!;
    expect(g.isRevealed(m)).toBe(false);
    expect(g.launchQueue(1)).toContainEqual({ type: 'reveal', id: 2 });
    expect(g.isRevealed(m)).toBe(true);
    g.settle();
    let revealed = 0;
    for (let seed = 1; seed <= 10 && g.canShuffle(); seed++) {
      revealed += g.shuffleQueues(mulberry32(seed)).filter(e => e.type === 'reveal').length;
      expect(g.isRevealed(m)).toBe(true);
    }
    expect(revealed).toBe(0);
  });

  it('X-Ray Specs on a linked pair go to the first Purrlet only', () => {
    const L = make(ring, [[[C.soda, 4]], [[C.soda, 4]], [[C.cherry, 1]]]);
    L.queues[0]![0]!.link = 1; L.queues[1]![0]!.link = 0;
    const g = new Game(L);
    g.armXray();
    expect(g.launchQueue(0)[0]).toEqual({ type: 'launch', ids: [0, 1], from: 'queue', xray: true });
    expect(g.riders.map(r => !!r.xray)).toEqual([true, false]);
  });

  it('Cat Nap sends tray Purrlets to the end of the shortest queues', () => {
    const g = new Game(make(ring, [[[C.cherry, 1]], [[C.soda, 8], [C.cherry, 0 + 1]]]));
    g.launchQueue(0); g.settle();
    expect(g.tray).toHaveLength(1);
    const ev = g.napTray();
    expect(ev).toEqual([{ type: 'napBack', moves: [{ id: 0, q: 0 }] }]);
    expect(g.tray).toHaveLength(0);
    expect(g.queues[0]!.map(p => p.id)).toEqual([0]);
    expect(g.launchQueue(0)).not.toEqual([]); // can be launched again from the queue
  });

  it('X-Ray Specs lets the next Purrlet paint through other colours', () => {
    const g = new Game(make(ring, [[[C.cherry, 1]], [[C.soda, 8]]]));
    expect(g.armXray()).toEqual([{ type: 'xrayArmed' }]);
    expect(g.launchQueue(0)[0]).toEqual({ type: 'launch', ids: [0], from: 'queue', xray: true });
    const ev = g.settle();
    expect(ev).toContainEqual({ type: 'pop', id: 0 }); // reached the hidden centre pixel
    expect(g.xrayArmed).toBe(false);
    g.launchQueue(1); g.settle();
    expect(g.status).toBe('won');
  });
});
