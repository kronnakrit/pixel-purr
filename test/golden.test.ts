// The TypeScript engine must reproduce the design-page generator exactly (fixtures from `npm run golden`).
import { describe, expect, it } from 'vitest';
import golden from './fixtures/golden.json';
import { level, type Level } from '../src/engine';

const pxStr = (px: Uint8Array) => Array.from(px, c => c.toString(36)).join('');
const queuesOf = (L: Level) => L.queues.map(q => q.map(s => ({ id: s.id, c: s.c, a: s.a, ...(s.hidden ? { hidden: true } : {}), ...(s.link !== undefined ? { link: s.link } : {}) })));

interface GoldenLevel {
  name: string; w: number; h: number; px: string; total: number; seed: number; disorder: number; need: number;
  queues: { id: number; c: number; a: number; hidden?: boolean; link?: number }[][];
  solution: { ok: boolean; plan: unknown; nodes: number; peakTray: number };
}

function expectSame(L: Level, g: GoldenLevel) {
  expect(L.name).toBe(g.name);
  expect([L.w, L.h]).toEqual([g.w, g.h]);
  expect(pxStr(L.px)).toBe(g.px);
  expect(L.total).toBe(g.total);
  expect(L.seed).toBe(g.seed);
  expect(L.disorder).toBe(g.disorder);
  expect(L.need).toBe(g.need);
  expect(queuesOf(L)).toEqual(g.queues);
  expect({ ok: L.solution!.ok, plan: L.solution!.plan, nodes: L.solution!.nodes, peakTray: L.solution!.peakTray }).toEqual(g.solution);
}

describe('matches the design generator', () => {
  golden.v1.forEach((g, i) => it(`level ${i + 1} ${g.name}`, () => expectSame(level(i + 1), g)));
  golden.endless.forEach(g => it(`endless level ${g.n} ${g.name}`, () => expectSame(level(g.n), g)));
});
