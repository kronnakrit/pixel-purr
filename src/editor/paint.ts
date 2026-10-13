// The picture grid: draw, erase, flood fill and eyedropper on an N×N picture, with undo/redo.
import type { Picture } from '../engine';
import { crisp, drawPicture, INK } from './draw';

export type Tool = 'draw' | 'erase' | 'fill' | 'pick';

export class PaintCanvas {
  readonly canvas = document.createElement('canvas');
  tool: Tool = 'draw';
  color = 1;
  private pic: Picture = { w: 24, h: 24, px: new Uint8Array(24 * 24), name: 'Untitled' };
  private undoStack: Uint8Array[] = [];
  private redoStack: Uint8Array[] = [];
  private hover = -1;
  private dragging = false;
  private size = 560;

  /** onChange: the picture's pixels changed (by the user). onPick: the eyedropper chose a colour. */
  constructor(private readonly onChange: () => void, private readonly onPick: (c: number) => void) {
    const cv = this.canvas;
    cv.className = 'grid';
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); this.dragging = true; this.snapshot(); this.apply(this.cellAt(e), e.button === 2); });
    cv.addEventListener('pointermove', e => {
      const j = this.cellAt(e);
      if (j !== this.hover) { this.hover = j; if (this.dragging && (this.tool === 'draw' || this.tool === 'erase')) this.apply(j, (e.buttons & 2) !== 0); else this.render(); }
    });
    cv.addEventListener('pointerup', () => { this.dragging = false; });
    cv.addEventListener('pointerleave', () => { this.hover = -1; this.render(); });
    cv.addEventListener('contextmenu', e => e.preventDefault()); // right button erases
  }

  get picture(): Picture { return this.pic; }

  /** Replace the picture (library, PNG, imported level). Undoable. */
  setPicture(p: Picture, undoable = true): void {
    if (undoable) this.snapshot();
    this.pic = { ...p, px: p.px.slice() };
    this.render();
  }

  /** Change the grid size, resampling the drawing (nearest neighbour). */
  resize(N: number): void {
    const { w, px } = this.pic;
    if (N === w) return;
    this.snapshot();
    const out = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out[y * N + x] = px[Math.floor(((y + 0.5) * w) / N) * w + Math.floor(((x + 0.5) * w) / N)]!;
    this.pic = { ...this.pic, w: N, h: N, px: out };
    this.render();
  }

  clear(): void { this.snapshot(); this.pic.px.fill(0); this.render(); this.onChange(); }

  undo(): void { this.swap(this.undoStack, this.redoStack); }
  redo(): void { this.swap(this.redoStack, this.undoStack); }

  setDisplaySize(px: number): void { this.size = px; this.render(); }

  render(): void {
    const { w } = this.pic, s = Math.floor(this.size / w), W = s * w;
    const g = crisp(this.canvas, W, W);
    drawPicture(g, this.pic, 0, 0, s);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; // faint grid
    g.beginPath();
    for (let i = 1; i < w; i++) { g.moveTo(i * s + 0.5, 0); g.lineTo(i * s + 0.5, W); g.moveTo(0, i * s + 0.5); g.lineTo(W, i * s + 0.5); }
    g.stroke();
    if (this.hover >= 0) {
      const x = this.hover % w, y = Math.floor(this.hover / w);
      g.lineWidth = 2; g.strokeStyle = '#fff'; g.strokeRect(x * s + 1, y * s + 1, s - 2, s - 2);
      g.strokeStyle = INK; g.strokeRect(x * s - 1, y * s - 1, s + 2, s + 2);
    }
  }

  private cellAt(e: PointerEvent): number {
    const r = this.canvas.getBoundingClientRect(), { w } = this.pic;
    const x = Math.floor(((e.clientX - r.left) / r.width) * w), y = Math.floor(((e.clientY - r.top) / r.height) * w);
    return x < 0 || y < 0 || x >= w || y >= w ? -1 : y * w + x;
  }

  private apply(j: number, erase: boolean): void {
    if (j < 0) return;
    const px = this.pic.px, tool = erase ? 'erase' : this.tool;
    if (tool === 'pick') { if (px[j]) this.onPick(px[j]!); this.undoStack.pop(); return; }
    if (tool === 'fill') this.fill(j, this.color);
    else px[j] = tool === 'erase' ? 0 : this.color;
    this.render();
    this.onChange();
  }

  /** 4-neighbour flood fill of the region sharing pixel j's colour. */
  private fill(j: number, c: number): void {
    const { w, px } = this.pic, from = px[j]!;
    if (from === c) return;
    const stack = [j];
    while (stack.length) {
      const k = stack.pop()!;
      if (px[k] !== from) continue;
      px[k] = c;
      const x = k % w;
      if (x > 0) stack.push(k - 1);
      if (x < w - 1) stack.push(k + 1);
      if (k >= w) stack.push(k - w);
      if (k < px.length - w) stack.push(k + w);
    }
  }

  private snapshot(): void {
    this.undoStack.push(this.encode());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Size is stored in the first byte so undo also restores grid-size changes. */
  private encode(): Uint8Array { const a = new Uint8Array(this.pic.px.length + 1); a[0] = this.pic.w; a.set(this.pic.px, 1); return a; }

  private swap(from: Uint8Array[], to: Uint8Array[]): void {
    const s = from.pop();
    if (!s) return;
    to.push(this.encode());
    const N = s[0]!;
    this.pic = { ...this.pic, w: N, h: N, px: s.slice(1) };
    this.render();
    this.onChange();
  }
}
