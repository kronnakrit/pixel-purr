// Generate a level for the editor's picture with editable knobs, using the engine's deal → needSlots → solve →
// measure pipeline. Like the engine's build(): reroll seeds (and optionally steer disorder) until "slots needed"
// lands in the band, then prove it with the solver and measure how often a naive player fails.
import { assemble, deal, measure, needSlots, paramsFor, RULES, solve, type Level, type LevelParams, type Picture } from '../engine';
import { contentParams, FIRST_FILE_LEVEL, LAST_FILE_LEVEL } from '../content/params';
import { PICTURES_21_60 } from '../content/pictures';

export interface GenParams {
  /** Level number: sets the spicy flag and the file's n. */
  n: number;
  queues: number;
  /** Target Purrlet count (bigger paint pots with fewer). */
  shooters: number;
  disorder: number;
  /** Share of mystery Purrlets (never at a queue front). */
  hidden: number;
  links: number;
  need: [number, number];
  seed: number;
  tries: number;
  /** Steer disorder towards the need band between tries (as the engine's build does). */
  adapt: boolean;
}

export interface GenResult { level: Level; need: number; fail: number; inBand: boolean; tried: number; ms: number }

/** The knobs a level number would get in the game (content params for 21-60, the engine's curve otherwise). */
export function presetFor(n: number): Omit<GenParams, 'seed' | 'tries' | 'adapt'> {
  const P = n >= FIRST_FILE_LEVEL && n <= LAST_FILE_LEVEL ? contentParams(n, PICTURES_21_60[n - FIRST_FILE_LEVEL]!) : paramsFor(n);
  return { n, queues: P.queues, shooters: P.shooters, disorder: round2(P.disorder), hidden: round2(P.hidden), links: P.links, need: [P.need[0], P.need[1]] };
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function paramsOf(g: GenParams, size: number): LevelParams {
  const base = paramsFor(Math.max(1, g.n));
  return {
    ...base, size,
    queues: clamp(Math.round(g.queues), 1, 6), shooters: clamp(Math.round(g.shooters), 2, 60),
    disorder: clamp(g.disorder, 0, 1), hidden: clamp(g.hidden, 0, 0.9), links: clamp(Math.round(g.links), 0, 6),
    need: [clamp(g.need[0], 0, RULES.tray), clamp(Math.max(g.need[0], g.need[1]), 0, RULES.tray)],
  };
}

/** Returns null when no deal fits the tray at all (e.g. an empty picture). */
export function generate(pic: Picture, g: GenParams): GenResult | null {
  const t0 = performance.now(), P = paramsOf(g, pic.w);
  if (!pic.px.some(Boolean)) return null;
  let best: { L: Level; need: number; miss: number; seed: number; dis: number } | null = null, dis = P.disorder, tried = 0;
  for (let t = 0; t < Math.max(1, g.tries); t++) {
    const seed = g.seed + t;
    tried++;
    const L = assemble(pic, deal(pic, { ...P, disorder: dis }, seed), P);
    const need = needSlots(L);
    if (need > RULES.tray) { if (g.adapt) dis *= 0.8; continue; }
    const miss = need < P.need[0] ? P.need[0] - need : need > P.need[1] ? need - P.need[1] : 0;
    if (!best || miss < best.miss) best = { L, need, miss, seed, dis: round2(dis) };
    if (miss === 0) break;
    if (g.adapt) dis = need < P.need[0] ? Math.min(1, dis + 0.12) : Math.max(0, dis - 0.12);
  }
  if (!best) return null;
  const L = Object.assign(best.L, { seed: best.seed, disorder: best.dis, need: best.need, intro: null });
  L.solution = solve(L);
  if (!L.solution.ok) L.solution = solve(L, 50_000); // the app proves levels with the default budget: flag it below
  return { level: L, need: best.need, fail: measure(L, best.seed, 40), inBand: best.miss === 0, tried, ms: performance.now() - t0 };
}
