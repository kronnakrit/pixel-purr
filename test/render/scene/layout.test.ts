import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { beltOf } from '../../../src/engine';
import {
  BELT, CAT_H, LanePath, MAX_COL, computeLayout, gridFor, hitTest, queueCatW, queueCatY, queueXs, riderArc, spotArcs,
  topColors, trayLayout, type Insets, type Pt,
} from '../../../src/render/scene/layout';
import { Projector, unsmooth } from '../../../src/render/scene/project';

const HUD: Insets = { top: 96, bottom: 120, left: 0, right: 0 };
const SIZES: [number, number][] = [[360, 640], [390, 844], [430, 932], [768, 1024], [1024, 1366]];
const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('computeLayout', () => {
  it.each(SIZES)('fits a %ix%i screen inside the HUD insets, centred and capped', (W, H) => {
    const L = computeLayout(W, H, HUD);
    expect(L.col.w).toBeLessThanOrEqual(MAX_COL);
    near(L.col.x + L.col.w / 2, W / 2);
    near(L.block.x + L.block.w / 2, W / 2);
    expect(L.block.w).toBe(L.block.h);
    // the dock sticks out on the left but stays on screen
    expect(L.dock.x).toBeGreaterThanOrEqual(0);
    expect(L.block.x + L.block.w).toBeLessThanOrEqual(W);
    // top to bottom: HUD, belt block, counter, tray, queues, bottom HUD
    expect(L.block.y).toBeGreaterThanOrEqual(HUD.top);
    expect(L.counter.y).toBeGreaterThan(L.block.y + L.block.h);
    expect(L.tray.y).toBeGreaterThan(L.counter.y);
    expect(L.queue.y).toBeGreaterThan(L.tray.y + L.tray.h * 0.7);
    expect(queueCatY(L, 2)).toBeLessThanOrEqual(H - HUD.bottom);
    // each deeper cat shows below the one in front, so its paint count stays readable
    expect(queueCatY(L, 1) - queueCatY(L, 0)).toBeGreaterThanOrEqual(0.06 * L.col.w - 1e-9);
    expect(queueCatW(L, 1)).toBeLessThan(queueCatW(L, 0));
    // the front cat's head stays clear of the dark tray panel
    const T = trayLayout(L, 5);
    expect(queueCatY(L, 0) - L.frontW * CAT_H).toBeGreaterThan(T.panel.y + T.panel.h - 0.05 * L.col.w);
  });

  it('uses the full width on a phone and caps the column on a tablet', () => {
    expect(computeLayout(390, 844, HUD).col.w).toBeGreaterThan(370);
    expect(computeLayout(1024, 1366, HUD).col.w).toBe(MAX_COL);
  });

  it('respects side insets', () => {
    const L = computeLayout(390, 844, { ...HUD, left: 40, right: 0 });
    expect(L.col.x).toBeGreaterThanOrEqual(40);
    near(L.col.x + L.col.w / 2, 40 + (390 - 40) / 2);
  });
});

describe('belt lane', () => {
  const L = computeLayout(390, 844, HUD);
  const path = new LanePath().set(L.lane);
  const p: Pt = { x: 0, y: 0 }, q: Pt = { x: 0, y: 0 };

  it('is a closed, continuous rounded rectangle walked counter-clockwise on screen', () => {
    path.point(0, p);
    near(p.x, L.lane.l + L.lane.rc); near(p.y, L.lane.b);
    path.point(path.perimeter, q);
    near(p.x, q.x); near(p.y, q.y);
    const n = 2000, step = path.perimeter / n;
    let maxJump = 0, area = 0;
    for (let i = 0; i < n; i++) {
      path.point(i * step, p); path.point((i + 1) * step, q);
      maxJump = Math.max(maxJump, Math.hypot(q.x - p.x, q.y - p.y));
      area += p.x * q.y - q.x * p.y;
    }
    expect(maxJump).toBeLessThan(step * 1.01);
    // shoelace in y-down screen space: negative = counter-clockwise as seen on screen
    expect(area).toBeLessThan(0);
  });

  it.each([[16, 16], [22, 22], [32, 32], [20, 12]])('puts every spot of a %ix%i board level with its row or column', (w, h) => {
    const G = gridFor(L, w, h), arcs = spotArcs(path, G), spots = beltOf(w, h);
    expect(arcs.length).toBe(spots.length + 1);
    for (let k = 0; k < arcs.length - 1; k++) expect(arcs[k + 1]!).toBeGreaterThan(arcs[k]!);
    near(arcs[spots.length]! - arcs[0]!, path.perimeter);
    spots.forEach((s, k) => {
      path.point(arcs[k]!, p);
      const cx = G.x0 + (s.i + 0.5) * G.cell, cy = G.y0 + (s.i + 0.5) * G.cell;
      if (s.side === 0) { near(p.x, cx, 1e-6); near(p.y, L.lane.b); }
      if (s.side === 1) { near(p.x, L.lane.r); near(p.y, cy, 1e-6); }
      if (s.side === 2) { near(p.x, cx, 1e-6); near(p.y, L.lane.t); }
      if (s.side === 3) { near(p.x, L.lane.l); near(p.y, cy, 1e-6); }
    });
  });

  it('keeps the lane between the board and the outer edge of the belt', () => {
    const G = gridFor(L, 32, 32);
    expect(L.lane.l).toBeLessThan(G.x0);
    expect(L.lane.l).toBeGreaterThan(L.block.x);
    near(L.lane.l - L.block.x, BELT.lane * L.block.w);
  });

  it('interpolates riders between spots and parks negative spots behind the entry', () => {
    const G = gridFor(L, 16, 16), arcs = spotArcs(path, G);
    near(riderArc(arcs, 3, 0.5, G.cell), (arcs[3]! + arcs[4]!) / 2);
    near(riderArc(arcs, 63, 1, G.cell), arcs[64]!);
    expect(riderArc(arcs, -2, 0, G.cell)).toBeLessThan(arcs[0]!);
    near(riderArc(arcs, -1, 1, G.cell), arcs[0]!);
    // around the corner the rider follows the arc, never cutting inside the lane
    for (let f = 0; f <= 1; f += 0.1) {
      path.point(riderArc(arcs, 15, f, G.cell), p);
      expect(p.x).toBeLessThanOrEqual(L.lane.r + 1e-9);
      expect(p.y).toBeLessThanOrEqual(L.lane.b + 1e-9);
      expect(Math.max(p.x - (L.lane.r - L.lane.rc), 0) ** 2 + Math.max(p.y - (L.lane.b - L.lane.rc), 0) ** 2).toBeLessThanOrEqual(L.lane.rc ** 2 + 1e-6);
    }
  });
});

describe('tray and queues', () => {
  const L = computeLayout(390, 844, HUD);

  it.each([5, 6, 7])('fits %i cushions in the column', n => {
    const T = trayLayout(L, n);
    expect(T.panel.x).toBeGreaterThanOrEqual(L.col.x - 1e-9);
    expect(T.panel.x + T.panel.w).toBeLessThanOrEqual(L.col.x + L.col.w + 1e-9);
    near(T.panel.x + T.panel.w / 2, L.col.x + L.col.w / 2);
    for (let i = 1; i < n; i++) expect(T.xs[i]! - T.xs[i - 1]!).toBeGreaterThan(T.cs);
    expect(T.xs.length).toBe(n + 1); // plus the overflow spot when lost
    expect(T.catW).toBeLessThan(T.cs);
  });

  it('centres the queue columns', () => {
    for (const nq of [2, 3, 4]) {
      const xs = queueXs(L, nq);
      near((xs[0]! + xs[nq - 1]!) / 2, L.col.x + L.col.w / 2);
      expect(xs[1]! - xs[0]!).toBeGreaterThan(queueCatW(L, 0));
    }
  });
});

describe('hitTest', () => {
  const L = computeLayout(390, 844, HUD), xs = queueXs(L, 3), T = trayLayout(L, 5);

  it('targets a queue front from anywhere on its column', () => {
    for (const d of [0, 1, 2]) expect(hitTest(L, xs[1]!, queueCatY(L, d) - 10, [3, 3, 3], 0, 5)).toEqual({ kind: 'queue', q: 1 });
    expect(hitTest(L, xs[2]! + 20, queueCatY(L, 0) - 30, [3, 3, 3], 0, 5)).toEqual({ kind: 'queue', q: 2 });
    expect(hitTest(L, xs[0]!, queueCatY(L, 0), [0, 3, 3], 0, 5)).toBeNull(); // empty queue
  });

  it('targets tray cats only where a cat naps', () => {
    expect(hitTest(L, T.xs[1]!, T.cy, [3, 3, 3], 2, 5)).toEqual({ kind: 'tray', i: 1 });
    expect(hitTest(L, T.xs[3]!, T.cy, [3, 3, 3], 2, 5)).toBeNull();
  });

  it('ignores the board and the HUD', () => {
    expect(hitTest(L, L.block.x + L.block.w / 2, L.block.y + L.block.h / 2, [3, 3, 3], 2, 5)).toBeNull();
    expect(hitTest(L, xs[0]!, 40, [3, 3, 3], 2, 5)).toBeNull();
  });
});

describe('projection', () => {
  const P = new Projector();
  P.set(390, 844, 1 / 37.8);

  it('maps CSS px to the ground and back, and depth never moves a point on screen', () => {
    const v = new Vector3(), out: Pt = { x: 0, y: 0 };
    for (const [x, y] of [[0, 0], [195, 422], [390, 844], [50, 700]] as const) {
      for (const depth of [0, -3, 12]) {
        P.toWorld(x, y, depth, v);
        P.toCss(v, out);
        near(out.x, x, 1e-6); near(out.y, y, 1e-6);
      }
      P.toWorld(x, y, 0, v);
      near(v.y, 0);
      near(P.viewDepth(y, 5) - P.viewDepth(y), 5);
    }
    P.toWorld(10, 10, P.lift(2), v);
    near(v.y, 2);
  });

  it('inverts smoothstep for the fog dimming', () => {
    for (const a of [0, 0.1, 0.22, 0.44, 0.8, 1]) {
      const x = unsmooth(a);
      near(x * x * (3 - 2 * x), a, 1e-9);
    }
  });
});

describe('topColors', () => {
  it('picks the most common colours, repeating when the picture has fewer', () => {
    expect(topColors(new Uint8Array([1, 2, 2, 0, 3, 3, 3]), 3)).toEqual([3, 2, 1]);
    expect(topColors(new Uint8Array([5, 5, 0]), 3)).toEqual([5, 5, 5]);
    expect(topColors(new Uint8Array([0, 0]), 3)).toEqual([]);
  });
});
