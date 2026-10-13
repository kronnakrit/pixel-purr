// The belt: lavender frame around the board (canvas texture on the ground), chevrons scrolling counter-clockwise
// along the lane, and the blue coil dock at the bottom-left with its free-spaces counter.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, Vector3, type CanvasTexture,
} from 'three';
import { BELT, LanePath, type Layout, type Pt } from './layout';
import type { Projector } from './project';
import { FlatQuad } from './flat';
import { BELT_SIDE, canvasTexture, drawBelt, drawChevron, drawDock, drawGlow, drawLabel, makeCanvas } from './textures';
import { outCubic } from './ease';

const CHEVRON_SPACING = 0.1; // of the block side
const SAMPLE_PX = 3;
const v = new Vector3(), p: Pt = { x: 0, y: 0 }, q: Pt = { x: 0, y: 0 };

/** Basic material for flat decals: drawn after the opaque 3D parts, in renderOrder, never writing depth. */
export function decalMaterial(map: CanvasTexture | null, extra: Partial<ConstructorParameters<typeof MeshBasicMaterial>[0]> = {}): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false, ...extra });
}

export class BeltView {
  readonly group = new Group();
  readonly path = new LanePath();
  private readonly frameCanvas = makeCanvas(4, 4);
  private readonly frameTex = canvasTexture(this.frameCanvas);
  private readonly frame = new FlatQuad(decalMaterial(this.frameTex));
  private readonly chevTex = canvasTexture(makeCanvas(96, 32), true);
  private readonly chevMat = decalMaterial(this.chevTex);
  private readonly chev: Mesh;
  private readonly dockCanvas = makeCanvas(64, 128);
  private readonly dockTex = canvasTexture(this.dockCanvas);
  private readonly dock = new FlatQuad(decalMaterial(this.dockTex));
  private readonly countCanvas = makeCanvas(160, 64);
  private readonly countTex = canvasTexture(this.countCanvas);
  private readonly count = new FlatQuad(decalMaterial(this.countTex));
  private readonly glowTex = canvasTexture(makeCanvas(64, 64));
  private readonly glow = new FlatQuad(decalMaterial(this.glowTex, { blending: AdditiveBlending, color: new Color('#3FF4FF'), opacity: 0 }));
  private L: Layout | null = null;
  private P: Projector | null = null;
  private blockPx = 0;
  private spacing = 30;
  private freeText = '';
  private xray = false;
  private bumpT = 1;
  private t = 0;

  constructor() {
    drawChevron(this.chevTex.image as HTMLCanvasElement);
    drawGlow(this.glowTex.image as HTMLCanvasElement);
    drawDock(this.dockCanvas, false);
    this.chev = new Mesh(new BufferGeometry(), this.chevMat);
    this.chev.frustumCulled = false;
    const parts: [Mesh, number][] = [[this.frame.mesh, 1], [this.chev, 2], [this.glow.mesh, 3], [this.dock.mesh, 4], [this.count.mesh, 5]];
    for (const [m, o] of parts) { m.renderOrder = o; this.group.add(m); }
  }

  layout(L: Layout, P: Projector, dpr: number): void {
    this.L = L; this.P = P;
    const B = L.block.w, px = Math.min(2048, Math.round(B * dpr));
    if (px !== this.blockPx) {
      this.blockPx = px;
      this.frameCanvas.width = px; this.frameCanvas.height = Math.round(px * (1 + BELT_SIDE));
      drawBelt(this.frameCanvas);
      this.frameTex.dispose(); // canvas size changed: re-upload at the new size
      this.frameTex.needsUpdate = true;
    }
    this.frame.place(P, { ...L.block, h: B * (1 + BELT_SIDE) });
    this.path.set(L.lane);
    this.spacing = CHEVRON_SPACING * B;
    this.buildChevrons(P, BELT.laneHalf * B * 0.95);
    this.placeDock(1);
    const c = L.counter;
    this.count.place(P, { x: c.x - c.size * 1.6, y: c.y - c.size * 0.64, w: c.size * 3.2, h: c.size * 1.28 });
  }

  /** Free belt spaces, e.g. 4/5. */
  setFree(free: number, cap: number): void {
    const s = `${free}/${cap}`;
    if (s === this.freeText) return;
    this.freeText = s;
    drawLabel(this.countCanvas, s);
    this.countTex.needsUpdate = true;
  }

  /** Redraw text after the display font has loaded. */
  refreshText(): void { const s = this.freeText; this.freeText = ''; if (s) { const [f, c] = s.split('/'); this.setFree(+f!, +c!); } }

  /** X-Ray Specs armed: the dock turns cyan and glows. */
  setXray(on: boolean): void {
    if (on === this.xray) return;
    this.xray = on;
    drawDock(this.dockCanvas, on);
    this.dockTex.needsUpdate = true;
  }

  /** A cat just hopped on: the dock pops. */
  bump(): void { this.bumpT = 0; }

  /** CSS centre of the dock. */
  dockPoint(out: Pt): Pt {
    const d = this.L?.dock;
    out.x = d ? d.x + d.w / 2 : 0; out.y = d ? d.y + d.h / 2 : 0;
    return out;
  }

  private placeDock(s: number): void {
    const L = this.L, P = this.P;
    if (!L || !P) return;
    const d = L.dock, cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    this.dock.set(P, cx - (d.w * s) / 2, cy - (d.h * s) / 2, d.w * s, d.h * s, 0, false);
    const gw = d.w * 3.2, gh = d.h * 1.6;
    this.glow.set(P, cx - gw / 2, cy - gh / 2, gw, gh, 0, false);
  }

  /** A strip along the lane centre with u = arc length / chevron spacing. */
  private buildChevrons(P: Projector, half: number): void {
    const path = this.path, n = Math.max(8, Math.ceil(path.perimeter / SAMPLE_PX)), step = path.perimeter / n;
    const pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i * step;
      path.point(t, p); path.point(t + 0.5, q);
      const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      for (let s = 0; s < 2; s++) {
        const sg = s ? 1 : -1;
        P.toWorld(p.x + nx * half * sg, p.y + ny * half * sg, 0, v);
        pos.set([v.x, v.y, v.z], (i * 2 + s) * 3);
        uv.set([t / this.spacing, s], (i * 2 + s) * 2);
      }
      if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = this.chev.geometry;
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    g.setIndex(idx);
    // the strip's u restarts at the seam; snap the repeat so the chevrons meet cleanly
    this.chevTex.repeat.x = Math.round(path.perimeter / this.spacing) / (path.perimeter / this.spacing);
  }

  update(dt: number, reduced: boolean): void {
    this.t += dt;
    this.chevTex.offset.x -= (dt * (reduced ? 10 : 26)) / this.spacing;
    if (this.chevTex.offset.x < -1000) this.chevTex.offset.x += 1000;
    if (this.bumpT < 1) {
      this.bumpT = Math.min(1, this.bumpT + dt / 0.3);
      this.placeDock(reduced ? 1 : 1 + 0.14 * Math.sin(Math.PI * outCubic(this.bumpT)));
    }
    const gm = this.glow.mesh.material as MeshBasicMaterial;
    gm.opacity = this.xray ? 0.55 + (reduced ? 0 : 0.3 * Math.sin(this.t * 5)) : 0;
    this.glow.mesh.visible = this.xray;
  }

  dispose(): void {
    for (const f of [this.frame, this.dock, this.count, this.glow]) { f.dispose(); (f.mesh.material as MeshBasicMaterial).dispose(); }
    this.chev.geometry.dispose(); this.chevMat.dispose();
    for (const t of [this.frameTex, this.chevTex, this.dockTex, this.countTex, this.glowTex]) t.dispose();
  }
}
