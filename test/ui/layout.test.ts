import { describe, expect, it } from 'vitest';
import { arcPoints, fitScale, mapLayout, mapPath, streakIndex } from '../../src/ui/layout';

describe('mapLayout', () => {
  const levels = [4, 5, 6, 7, 8, 9, 10];
  it('stacks levels bottom to top with even spacing', () => {
    const { pts, height } = mapLayout(levels, 390, { spacing: 92, pad: 72 });
    expect(height).toBe(72 * 2 + 6 * 92);
    expect(pts[0]!.y).toBe(height - 72);
    expect(pts[6]!.y).toBe(72);
    for (let i = 1; i < pts.length; i++) expect(pts[i - 1]!.y - pts[i]!.y).toBe(92);
  });
  it('winds side to side and stays inside the column', () => {
    for (const W of [320, 360, 390, 430, 480]) {
      const { pts, amp } = mapLayout(levels, W);
      expect(amp).toBeLessThanOrEqual(96);
      for (const p of pts) { expect(p.x).toBeGreaterThanOrEqual(46); expect(p.x).toBeLessThanOrEqual(W - 46); }
      const xs = pts.map(p => p.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(amp); // it really winds
    }
  });
  it('keeps a level at the same x however the window slides', () => {
    const a = mapLayout([5, 6, 7], 390).pts, b = mapLayout([6, 7, 8, 9], 390).pts;
    expect(a[1]!.x).toBe(b[0]!.x);
    expect(a[2]!.x).toBe(b[1]!.x);
  });
  it('handles empty and single maps', () => {
    expect(mapLayout([], 390).pts).toEqual([]);
    const one = mapLayout([1], 390);
    expect(one.pts).toHaveLength(1);
    expect(one.height).toBe(144);
  });
});

describe('mapPath', () => {
  it('draws one curve per gap', () => {
    const d = mapPath([{ x: 10, y: 100 }, { x: 50, y: 60 }, { x: 20, y: 20 }]);
    expect(d.startsWith('M10 100')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
    expect(d.endsWith('20 20')).toBe(true);
    expect(mapPath([])).toBe('');
  });
});

describe('fitScale', () => {
  it('never enlarges and shrinks to fit the tighter side', () => {
    expect(fitScale({ w: 318, h: 500 }, { w: 390, h: 800 })).toBe(1);
    expect(fitScale({ w: 318, h: 600 }, { w: 390, h: 540 })).toBeCloseTo(0.9);
    expect(fitScale({ w: 318, h: 400 }, { w: 286, h: 800 })).toBeCloseTo(286 / 318);
  });
  it('has a floor and survives zero sizes', () => {
    expect(fitScale({ w: 318, h: 2000 }, { w: 390, h: 100 })).toBe(0.55);
    expect(fitScale({ w: 0, h: 0 }, { w: 390, h: 800 })).toBe(1);
  });
});

describe('arcPoints', () => {
  it('starts and ends on the given points and rises above both', () => {
    const from = { x: 200, y: 500 }, to = { x: 330, y: 60 };
    const pts = arcPoints(from, to, 10, 120);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual(from);
    expect(pts[10]!.x).toBeCloseTo(to.x);
    expect(pts[10]!.y).toBeCloseTo(to.y);
    expect(Math.min(...pts.map(p => p.y))).toBeLessThan(to.y);
  });
});

describe('streakIndex', () => {
  it('maps streak days onto the 7 tiles, day 7 repeating', () => {
    expect(streakIndex(1)).toBe(0);
    expect(streakIndex(3)).toBe(2);
    expect(streakIndex(7)).toBe(6);
    expect(streakIndex(12)).toBe(6);
    expect(streakIndex(0)).toBe(0);
  });
});
