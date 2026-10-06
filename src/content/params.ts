// Generator knobs for the shipped levels 21-60. They start from the engine's paramsFor(n) and keep its shape
// (gentle rise, spicy spike every 5th level, relaxed level after it), but follow each picture's own grid size and
// ease the late curve so it keeps rising instead of flattening at the engine's caps.
// Takes the picture's grid size and background flag as input so the app never needs the recipes (pictures.ts).
import { difficulty, isSpicy, paramsFor, type LevelParams } from '../engine';

export const FIRST_FILE_LEVEL = 21;
export const LAST_FILE_LEVEL = 60;

/** Spicy every 5th level; the level after a spicy one relaxes. */
export const isRelaxed = (n: number): boolean => n > 1 && n % 5 === 1;

/** pic: the level picture's grid size and whether it fills the whole board. */
export function contentParams(n: number, pic: { size: number; bg?: boolean }): LevelParams {
  if (n < FIRST_FILE_LEVEL || n > LAST_FILE_LEVEL) throw new Error(`level ${n} is not a shipped level file`);
  const base = paramsFor(n), D = difficulty(n), spicy = isSpicy(n), relaxed = isRelaxed(n);
  const t = (n - FIRST_FILE_LEVEL) / (LAST_FILE_LEVEL - FIRST_FILE_LEVEL); // 0..1 across the pack
  return {
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
}
