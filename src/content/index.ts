// Content: the 60 shipped levels (1-20 tuned in the engine, 21-60 from level files), endless levels 61+,
// level names, intro cards and booster unlock levels. Every built level and picture is cached in memory.
import type { BoosterKey, ContentApi, IntroKey, LevelMeta } from '../app/contracts';
import { fromFile, hash, level, paramsFor, PICTURES, raster, recolor, solve, sprite, V1_COUNT, type Level, type LevelFileV1, type Picture } from '../engine';
import FILES from './levels-21-60.json';
import { contentParams, FIRST_FILE_LEVEL, LAST_FILE_LEVEL } from './params';

export const SHIPPED = LAST_FILE_LEVEL;
/** Level files for 21-60, in order (written by tools/levels.ts). */
export const LEVEL_FILES = FILES as unknown as readonly LevelFileV1[];

export const INTROS: Readonly<Record<number, IntroKey>> = { 1: 'basics', 2: 'tray', 5: 'spicy', 7: 'mystery', 12: 'linked', 18: 'background' };
export const UNLOCKS: Readonly<Record<number, BoosterKey>> = { 4: 'slot', 6: 'shuffle', 9: 'nap', 13: 'xray' };

const CARDS: Readonly<Record<IntroKey, { title: string; body: string }>> = {
  basics: { title: 'Tap a Purrlet', body: 'Tap the kitten at the front of a queue and it rides the belt, painting every pixel of its colour it can see.' },
  tray: { title: 'Leftovers take a nap', body: 'A Purrlet with paint left naps on a cushion until you tap it again, but if every cushion is taken the level ends.' },
  spicy: { title: 'Colours under colours', body: 'Some colours are buried beneath others, so think about who goes first and keep a cushion free.' },
  mystery: { title: 'Mystery Purrlet', body: 'A grey Purrlet shows its colour once it reaches the front of its queue.' },
  linked: { title: 'Linked Purrlets', body: 'Two friends tied with a ribbon ride together, so both must be at the front before you tap.' },
  background: { title: 'Paint the whole board', body: 'This picture fills every pixel, so start from the edges and work your way in.' },
};

function fileFor(n: number): LevelFileV1 {
  const f = LEVEL_FILES[n - FIRST_FILE_LEVEL];
  if (!f || f.n !== n) throw new Error(`level file ${n} is missing (run npx tsx tools/levels.ts)`);
  return f;
}

/** Decode a level file's picture without building the level. */
export function filePicture(f: LevelFileV1): Picture {
  return { w: f.w, h: f.h, px: Uint8Array.from(f.picture, ch => parseInt(ch, 36)), name: f.name };
}

/** Endless picture, exactly as the engine's level(n) chooses it: a seeded charm sprite or a recoloured library picture. */
export function endlessPicture(n: number): Picture {
  const h = hash(n), N = paramsFor(n).size;
  return h % 3 === 0 ? sprite(h, N) : recolor(raster(PICTURES[h % PICTURES.length]!, N), h);
}

/** A shipped level 21-60: replay its file, restore its generator knobs and prove it with the solver once. */
function fileLevel(n: number): Level {
  const f = fileFor(n), L = fromFile(f);
  L.P = contentParams(n, { size: f.w, bg: !f.picture.includes('0') });
  L.intro = null;
  L.solution = solve(L);
  return L;
}

/** The level that introduces mystery Purrlets must have one, even when the generator's low early rate dealt none. */
export function ensureMystery(L: Level): Level {
  if (L.queues.some(q => q.some(p => p.hidden))) return L;
  // the deepest unlinked Purrlet of the longest queue: it is revealed late, so the player sees the grey pot for a while
  let pick: Level['queues'][number][number] | undefined;
  for (const q of L.queues) for (const p of q) if (p.d > 0 && p.link === undefined && (!pick || p.d > pick.d)) pick = p;
  if (pick) pick.hidden = true;
  return L;
}

const levels = new Map<number, Level>(), pictures = new Map<number, Picture>();

function check(n: number): void {
  if (!Number.isInteger(n) || n < 1) throw new Error(`bad level number ${n}`);
}

export const content: ContentApi = {
  shipped: SHIPPED,

  getLevel(n) {
    check(n);
    let L = levels.get(n);
    if (!L) {
      L = n >= FIRST_FILE_LEVEL && n <= LAST_FILE_LEVEL ? fileLevel(n) : level(n);
      if (INTROS[n] === 'mystery') ensureMystery(L); // hiding a colour never changes the solution
      levels.set(n, L);
    }
    return L;
  },

  levelPicture(n) {
    check(n);
    let p = pictures.get(n);
    if (!p) {
      const built = levels.get(n);
      p = built ? { w: built.w, h: built.h, px: built.px, name: built.name }
        : n <= V1_COUNT ? raster(PICTURES[n - 1]!, paramsFor(n).size)
        : n <= LAST_FILE_LEVEL ? filePicture(fileFor(n))
        : endlessPicture(n);
      pictures.set(n, p);
    }
    return p;
  },

  levelMeta(n): LevelMeta {
    check(n);
    const name = n <= V1_COUNT ? PICTURES[n - 1]!.name : n <= LAST_FILE_LEVEL ? fileFor(n).name : content.levelPicture(n).name;
    return { n, name, spicy: n % 5 === 0, intro: INTROS[n] ?? null, unlocks: UNLOCKS[n] ?? null };
  },

  introCard: k => CARDS[k],
};
