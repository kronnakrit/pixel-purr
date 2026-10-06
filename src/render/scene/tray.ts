// The cushion tray under the board: a dark panel with 5 cushions; Extra Cushions (6th+) are dashed gold.
import { Group } from 'three';
import { FlatQuad } from './flat';
import { decalMaterial } from './belt';
import { trayLayout, type Layout, type TrayLayout } from './layout';
import type { Projector } from './project';
import { canvasTexture, drawTray, makeCanvas } from './textures';
import { backOut, clamp01 } from './ease';

export class TrayView {
  readonly group = new Group();
  private readonly canvas = makeCanvas(4, 4);
  private readonly tex = canvasTexture(this.canvas);
  private readonly quad = new FlatQuad(decalMaterial(this.tex));
  /** Cushions shown, and how many of them are standard (the rest are Extra Cushions). */
  private n = 5;
  private base = 5;
  private T: TrayLayout | null = null;
  private L: Layout | null = null;
  private P: Projector | null = null;
  private dpr = 1;
  private popT = 1;

  constructor() { this.quad.mesh.renderOrder = 1; this.group.add(this.quad.mesh); }

  get layout(): TrayLayout | null { return this.T; }
  get cushions(): number { return this.n; }

  /** n cushions, of which the first `base` are standard. `pop` animates a newly added cushion. */
  set(n: number, base: number, pop = false): void {
    const changed = n !== this.n || base !== this.base;
    this.n = n; this.base = base;
    if (pop) this.popT = 0;
    if (changed && this.L && this.P) this.place(this.L, this.P, this.dpr);
  }

  place(L: Layout, P: Projector, dpr: number): void {
    this.L = L; this.P = P; this.dpr = dpr;
    const T = (this.T = trayLayout(L, this.n));
    const k = dpr, gap = 0.018 * L.col.w, pad = 0.022 * L.col.w;
    this.canvas.width = Math.round(T.panel.w * k); this.canvas.height = Math.round(T.panel.h * k);
    drawTray(this.canvas, this.n, this.base, T.cs * k, gap * k, pad * k);
    this.tex.dispose(); this.tex.needsUpdate = true;
    this.placeQuad(1);
  }

  private placeQuad(s: number): void {
    const T = this.T, P = this.P;
    if (!T || !P) return;
    const r = T.panel, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    this.quad.set(P, cx - (r.w * s) / 2, cy - (r.h * s) / 2, r.w * s, r.h * s, 0, false);
  }

  update(dt: number, reduced: boolean): void {
    if (this.popT >= 1) return;
    this.popT = clamp01(this.popT + dt / 0.45);
    this.placeQuad(reduced ? 1 : 1 + 0.06 * Math.sin(Math.PI * backOut(this.popT)));
  }

  dispose(): void { this.quad.dispose(); (this.quad.mesh.material as { dispose(): void }).dispose(); this.tex.dispose(); }
}
