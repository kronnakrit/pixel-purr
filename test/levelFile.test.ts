import { describe, expect, it } from 'vitest';
import { fromFile, level, solve, toFile } from '../src/engine';

describe('level files', () => {
  it('round-trips every launch level and the result still solves', () => {
    for (let n = 1; n <= 20; n++) {
      const L = level(n), f = toFile(n, L), back = fromFile(JSON.parse(JSON.stringify(f)));
      expect(toFile(n, back)).toEqual(f);
      expect(solve(back).plan).toEqual(L.solution!.plan);
    }
  });

  it('rejects a level that breaks paint conservation', () => {
    const f = toFile(1, level(1));
    f.queues[0]![0]!.a += 1;
    expect(() => fromFile(f)).toThrow(/paint for/);
  });

  it('rejects a broken link', () => {
    const f = toFile(12, level(12));
    const s = f.queues.flat().find(p => p.link !== undefined)!;
    s.link = 0;
    expect(() => fromFile(f)).toThrow(/broken link/);
  });
});
