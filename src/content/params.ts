// Generator knobs for the hand-made levels 21-100. They start from the engine's paramsFor(n) and keep its shape
// (gentle rise, spicy spike every 5th level, relaxed level after it), but follow each picture's own grid size and
// ease the late curve so it keeps rising instead of flattening at the engine's caps.
// The levels come in packs: each has its own pictures (pictures*.ts) and level file (levels-<first>-<last>.json).
// A new pack starts a little gentler than the last one ended, then climbs past it.
// Takes the picture's grid size and background flag as input so the app never needs the recipes (pictures*.ts).
import { difficulty, isSpicy, paramsFor, type LevelParams } from '../engine';

export interface Pack { readonly first: number; readonly last: number }
/** Hand-made level packs, in order and back to back. Levels after the last pack are endless (generated on the phone). */
export const PACKS: readonly Pack[] = [{ first: 21, last: 60 }, { first: 61, last: 100 }];
export const FIRST_FILE_LEVEL = PACKS[0]!.first;
export const LAST_FILE_LEVEL = PACKS[PACKS.length - 1]!.last;

/** The pack holding level n, and n's place in it (0 at the first level, 1 at the last). */
export function packOf(n: number): { pack: Pack; index: number; t: number } {
  const index = PACKS.findIndex(p => n >= p.first && n <= p.last);
  if (index < 0) throw new Error(`level ${n} is not a shipped level file`);
  const pack = PACKS[index]!;
  return { pack, index, t: (n - pack.first) / (pack.last - pack.first) };
}

/** Spicy every 5th level; the level after a spicy one relaxes. */
export const isRelaxed = (n: number): boolean => n > 1 && n % 5 === 1;

/** pic: the level picture's grid size and whether it fills the whole board. */
export function contentParams(n: number, pic: { size: number; bg?: boolean }): LevelParams {
  const { index, t } = packOf(n); // t: 0..1 across the pack
  const base = paramsFor(n), D = difficulty(n), spicy = isSpicy(n), relaxed = isRelaxed(n);
  if (index === 0) return {
    ...base,
    size: pic.size,
    // Spicy: 2 queues (few choices). Late normal levels drop to 3 queues before a spicy one.
    queues: spicy ? 2 : relaxed ? 4 : t > 0.45 && n % 5 === 4 ? 3 : 4,
    // More Purrlets as the pack goes on (more decisions); full-background pictures need more to stay under 60 paint each.
    shooters: Math.round(14 + t * 6 + (spicy ? 2 : relaxed ? -2 : 0) + (pic.bg ? 2 : 0)),
    disorder: Math.min(0.9, 0.05 + D * 0.07),
    hidden: relaxed ? 0.12 + t * 0.08 : Math.min(0.3, 0.16 + t * 0.14 + (spicy ? 0.04 : 0)),
    links: relaxed ? 1 : spicy && t > 0.5 ? 3 : 2,
    // Slots needed under perfect play: relaxed levels forgive 4 careless parks, late spicy ones only 1-2.
    need: spicy ? (n >= 45 ? [3, 4] : [2, 3]) : relaxed ? [1, 1] : [1, 2],
  };
  // Later packs: start about where the last pack's middle sat, end a step past its end.
  return {
    ...base,
    size: pic.size,
    queues: spicy ? 2 : relaxed ? 4 : n % 5 === 4 ? 3 : 4,
    shooters: Math.round(17 + t * 6 + (spicy ? 2 : relaxed ? -2 : 0) + (pic.bg ? 2 : 0)),
    disorder: Math.min(0.9, 0.05 + D * 0.07),
    hidden: relaxed ? 0.18 + t * 0.06 : Math.min(0.34, 0.24 + t * 0.08 + (spicy ? 0.04 : 0)),
    links: relaxed ? 1 : spicy ? 3 : 2,
    need: spicy ? [3, 4] : relaxed ? [1, 1] : [1, 2],
  };
}
