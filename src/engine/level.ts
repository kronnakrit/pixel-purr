import { colorsOf, countPixels, type Picture } from './picture';
import { RULES } from './rules';
import type { SolveResult } from './solver';

/** One Purrlet in a queue. q = queue, d = depth in the queue (0 = front). */
export interface Purrlet { id: number; c: number; a: number; q: number; d: number; hidden?: boolean; link?: number }

/** Generator knobs for one level number. */
export interface LevelParams {
  n: number; D: number; spicy: boolean; size: number; queues: number; shooters: number;
  disorder: number; hidden: number; links: number;
  /** Target band for "slots needed": the fewest tray slots a perfect player needs. */
  need: readonly [number, number];
}

export interface Level {
  name: string; w: number; h: number; px: Uint8Array;
  queues: Purrlet[][]; byId: Purrlet[]; total: number; colors: number[];
  tray: number; belt: number; P: LevelParams;
  seed?: number; disorder?: number; need?: number; intro?: string | null;
  solution?: SolveResult; miss?: number; tries?: number;
}

/** D rises on a gentle curve; every 5th level is a "Spicy" spike and the level after it relaxes. */
export function difficulty(n: number): number {
  const base = 1 + 8 * (1 - Math.exp(-(n - 1) / 12));
  const saw = n % 5 === 0 ? 1.2 : n % 5 === 1 && n > 1 ? -0.6 : 0;
  return Math.round((base + saw) * 10) / 10;
}
const SIZES = [16, 18, 18, 20, 20, 20, 22, 22, 24, 24, 24, 26, 26, 26, 28, 28, 30, 30, 32, 32];
export const isSpicy = (n: number): boolean => n % 5 === 0;

export function paramsFor(n: number): LevelParams {
  const D = difficulty(n), spicy = isSpicy(n);
  return {
    n, D, spicy,
    size: SIZES[Math.min(n, 20) - 1] ?? 32,
    queues: n <= 2 ? 2 : spicy ? (n >= 15 ? 2 : 3) : n <= 8 ? 3 : 4, // spicy levels give fewer queues = fewer choices
    shooters: Math.round(5 + D * 1.6),        // target count of Purrlets (bigger ammo = more parking)
    disorder: Math.min(0.9, 0.05 + D * 0.07), // 0 = ideal peel order, 1 = deepest colours dealt first
    hidden: n >= 7 ? Math.min(0.3, (D - 4) * 0.06) : 0, // share of mystery Purrlets
    links: n >= 12 ? (D > 7 ? 2 : 1) : 0,     // linked pairs
    need: n <= 4 ? [0, 1] : spicy ? (n >= 10 ? [2, 3] : [1, 2]) : n < 10 ? [1, 1] : [1, 2],
  };
}

export const INTRO: Readonly<Record<number, string>> = {
  1: 'Tap a Purrlet: it rides the belt and paints matching pixels',
  2: 'Leftover ammo parks in the tray',
  5: 'Spicy level: colours buried under colours',
  7: 'Mystery Purrlets (?) show their colour at the front',
  12: 'Linked Purrlets ride together',
  18: 'Full-background pictures',
};

// v1 levels replay these tuned (seed, disorder) pairs so they load instantly and never change.
// Written by `npm run tune`; do not edit by hand.
export const V1: readonly (readonly [number, number])[] = /*V1*/[[1,0.1],[1,0.1],[1,0.25],[1,0.25],[1,0.4],[1,0.25],[1,0.4],[1,0.4],[1,0.4],[10,0.7],[1,0.4],[4,0.4],[10,0.55],[3,0.55],[12,0.55],[1,0.55],[7,0.55],[4,0.55],[4,0.55],[39,1]];
export const V1_NEED: readonly number[] = /*NEED*/[1,1,1,1,1,1,1,1,1,2,1,2,2,2,3,2,2,2,2,3];
export const V1_COUNT = V1.length;

/** Number ids queue-major, fill q/d, and wrap a picture + queues into a playable level. */
export function assemble(pic: Picture, Q: Purrlet[][], P: LevelParams): Level {
  const byId: Purrlet[] = [];
  Q.forEach(q => q.forEach(s => { byId[s.id] = s; }));
  return { name: pic.name, w: pic.w, h: pic.h, px: pic.px, queues: Q, byId, total: countPixels(pic.px), colors: colorsOf(pic.px), tray: RULES.tray, belt: RULES.belt, P };
}
