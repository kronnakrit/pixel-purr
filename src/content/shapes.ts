// Shared pieces for the hand-made level pictures (pictures.ts for 21-60, pictures-61-100.ts for 61-100): the recipe
// type and kawaii bits (eyes, blush, sparkles, stars). Shapes work in a 0..1 square, see src/engine/picture.ts.
import type { Layer, PictureDef, Shape, Shapes } from '../engine/picture';

export interface ContentPicture extends PictureDef {
  /** Grid size of its level (24-32): small, simple pictures early, full scenes late. */
  size: number;
  /** Fills the whole board (like Sakura Sky and Moon Night). */
  bg?: true;
}

// Kawaii bits shared by many pictures. gap = half the distance between the two eyes / cheeks.
export const pair = (s: Shapes, cx: number, cy: number, gap: number, rx: number, ry: number): Shape =>
  s.or(s.ell(cx - gap, cy, rx, ry), s.ell(cx + gap, cy, rx, ry));
export const eyes = (s: Shapes, cx: number, cy: number, gap: number, r = 0.032): Shape => pair(s, cx, cy, gap, r, r * 1.35);
export const blush = (s: Shapes, cx: number, cy: number, gap: number, r = 0.05): Shape => pair(s, cx, cy, gap, r, r * 0.6);
export const face = (s: Shapes, cx: number, cy: number, gap: number, r = 0.032): Layer[] => [
  [eyes(s, cx, cy, gap, r), 'licorice'],
  [blush(s, cx, cy + r * 2.4, gap + r * 1.9, r * 1.5), 'bubblegum'],
];
/** Closed sleepy eyes: two little arcs. */
export const sleepy = (s: Shapes, cx: number, cy: number, gap: number, r = 0.05): Shape => s.or(
  s.and(s.circ(cx - gap, cy - r * 0.6, r), s.not(s.circ(cx - gap, cy - r * 1.3, r)), s.rect(0, cy - r * 0.4, 1, 1)),
  s.and(s.circ(cx + gap, cy - r * 0.6, r), s.not(s.circ(cx + gap, cy - r * 1.3, r)), s.rect(0, cy - r * 0.4, 1, 1)));
export const dots = (s: Shapes, pts: readonly (readonly [number, number])[], r: number): Shape => s.or(...pts.map(([x, y]) => s.circ(x, y, r)));
export const stars = (s: Shapes, pts: readonly (readonly [number, number, number])[]): Shape => s.or(...pts.map(([x, y, r]) => s.star(x, y, r)));
export const sparkle = (s: Shapes, x: number, y: number, r: number): Shape => s.or(s.rect(x - r, y - .02, x + r, y + .02), s.rect(x - .02, y - r, x + .02, y + r));
/** "z" for sleepy things. */
export const zee = (s: Shapes, x: number, y: number, r: number): Shape =>
  s.or(s.rect(x - r, y - r - .02, x + r, y - r + .02), s.line(x + r, y - r, x - r, y + r, .045), s.rect(x - r, y + r - .02, x + r, y + r + .02));
/** A rain streak one pixel wide on a 30 grid: (x, y) in pixels so it lands on pixel centres. */
export const streak = (s: Shapes, x: number, y: number): Shape => s.rect((x + .5) / 30 - .017, (y + .5) / 30 - .05, (x + .5) / 30 + .017, (y + .5) / 30 + .05);
