import { RULES } from './rules';

/** Side of the picture a belt spot is on: 0 bottom (aims up), 1 right (aims left), 2 top (aims down), 3 left (aims right). */
export type Side = 0 | 1 | 2 | 3;
export interface BeltSpot { side: Side; i: number }

const beltCache = new Map<string, readonly BeltSpot[]>();

/** Belt spots around the picture, counter-clockwise from the entry at bottom-left:
 *  bottom (left→right), right (bottom→top), top (right→left), left (top→bottom). */
export function beltOf(w: number, h: number): readonly BeltSpot[] {
  const k = w + 'x' + h;
  let P = beltCache.get(k);
  if (!P) {
    const spots: BeltSpot[] = [];
    for (let x = 0; x < w; x++) spots.push({ side: 0, i: x });
    for (let y = h - 1; y >= 0; y--) spots.push({ side: 1, i: y });
    for (let x = w - 1; x >= 0; x--) spots.push({ side: 2, i: x });
    for (let y = 0; y < h; y++) spots.push({ side: 3, i: y });
    P = spots; beltCache.set(k, P);
  }
  return P;
}

/** Index of the first pixel a Purrlet sees from this belt spot, or -1. */
export function target(px: Uint8Array, w: number, h: number, pos: BeltSpot): number {
  const { side, i } = pos;
  if (side === 0) { for (let y = h - 1; y >= 0; y--) if (px[y * w + i]) return y * w + i; }
  else if (side === 1) { for (let x = w - 1; x >= 0; x--) if (px[i * w + x]) return i * w + x; }
  else if (side === 2) { for (let y = 0; y < h; y++) if (px[y * w + i]) return y * w + i; }
  else { for (let x = 0; x < w; x++) if (px[i * w + x]) return i * w + x; }
  return -1;
}

export interface Rider { c: number; a: number; id?: number }
/** t = tick, k = rider index in the group, s = belt spot, j = pixel painted. */
export interface ShotLog { t: number; k: number; s: number; j: number }

/** One lap of a group of riders (1, or 2 when linked, `gap` spots apart). Mutates px and rider ammo; returns shots fired. */
export function lap(px: Uint8Array, w: number, h: number, riders: Rider[], log?: ShotLog[]): number {
  const B = beltOf(w, h), L = B.length;
  let shots = 0;
  for (let t = 0; t < L + (riders.length - 1) * RULES.gap; t++) {
    riders.forEach((r, k) => {
      const s = t - k * RULES.gap;
      if (s < 0 || s >= L || r.a <= 0) return;
      const j = target(px, w, h, B[s]!);
      if (j >= 0 && px[j] === r.c) { px[j] = 0; r.a--; shots++; log?.push({ t, k, s, j }); }
    });
  }
  return shots;
}
