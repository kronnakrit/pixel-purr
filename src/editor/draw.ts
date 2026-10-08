// Canvas drawing shared by the editor grid, the play view and the dev contact sheet: pixels as glossy candy cubes.
import { PALETTE, type Picture } from '../engine';

export const BOARD = '#2A2058', INK = '#24193F', EMPTY = '#231A4F', EMPTY2 = '#2B2160';

/** One candy cube: dark bevel bottom-right, base colour, light glint top-left. */
export function cube(g: CanvasRenderingContext2D, c: number, x: number, y: number, s: number): void {
  const p = PALETTE[c];
  if (!p) return;
  const k = Math.max(1, Math.round(s * 0.16));
  g.fillStyle = p.dark; g.fillRect(x, y, s, s);
  g.fillStyle = p.hex; g.fillRect(x, y, s - k, s - k);
  if (s >= 5) { g.fillStyle = p.light; g.fillRect(x + k, y + k, Math.max(1, k), Math.max(1, k)); }
}

/** Whole picture as cubes at `s` px per pixel; empty pixels get a faint checker so the grid stays readable. */
export function drawPicture(g: CanvasRenderingContext2D, pic: Picture, ox: number, oy: number, s: number, checker = true): void {
  for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
    const c = pic.px[y * pic.w + x]!, X = ox + x * s, Y = oy + y * s;
    if (c) cube(g, c, X, Y, s);
    else if (checker) { g.fillStyle = (x + y) % 2 ? EMPTY : EMPTY2; g.fillRect(X, Y, s, s); }
  }
}

/** Size a canvas for crisp drawing at the device pixel ratio; returns its 2D context scaled to CSS px. */
export function crisp(cv: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const r = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * r); cv.height = Math.round(h * r);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const g = cv.getContext('2d')!;
  g.setTransform(r, 0, 0, r, 0, 0);
  g.imageSmoothingEnabled = false;
  return g;
}

/** Rounded rectangle path. */
export function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** White number with a plum outline (the game's Lilita One look). */
export function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill = '#fff'): void {
  g.font = `${size}px 'Lilita One', sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = Math.max(2, size * 0.28); g.strokeStyle = INK;
  g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y);
}
