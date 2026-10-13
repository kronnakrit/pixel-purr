// Every hand-made level picture 21-100 as a recipe, in level order. For the level builder, the editor, dev pages
// and tests; the app itself ships only the level files.
import { FIRST_FILE_LEVEL } from './params';
import { PICTURES_21_60 } from './pictures';
import { PICTURES_61_100 } from './pictures-61-100';
import type { ContentPicture } from './shapes';

export const FILE_PICTURES: readonly ContentPicture[] = [...PICTURES_21_60, ...PICTURES_61_100];

/** The recipe for hand-made level n. */
export function recipeFor(n: number): ContentPicture {
  const def = FILE_PICTURES[n - FIRST_FILE_LEVEL];
  if (!def) throw new Error(`level ${n} has no picture recipe`);
  return def;
}
