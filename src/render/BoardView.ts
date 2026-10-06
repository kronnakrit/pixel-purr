// Draws a Game with Three.js: instanced rounded-cube pixels (one draw call), the belt, and riding Purrlets.
// Riders move by belt-spot index, so what you see and the rules run on one clock.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { beltOf, paint, type BeltSpot, type Game, type GameEvent } from '../engine';

const POP_TIME = 0.22; // seconds for a painted pixel to scale-pop away
const BELT_OUT = 1.6;  // belt distance from the picture edge, in pixels

export class BoardView {
  readonly group = new THREE.Group();
  private pixels: THREE.InstancedMesh;
  private popping = new Map<number, number>(); // pixel index -> seconds since painted
  private riders = new Map<number, THREE.Group>();
  private spotPos: THREE.Vector3[];
  private readonly dummy = new THREE.Object3D();
  private readonly riderGeo = { body: new THREE.SphereGeometry(0.62, 20, 14), pot: new THREE.CylinderGeometry(0.62, 0.5, 0.8, 20) };
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
    const { w, h, px } = game.level;
    const geo = new RoundedBoxGeometry(0.9, 0.6, 0.9, 2, 0.16);
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff });
    this.pixels = new THREE.InstancedMesh(geo, mat, w * h);
    this.pixels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.Color();
    for (let j = 0; j < w * h; j++) {
      const c = px[j]!;
      this.place(j, c ? 1 : 0);
      this.pixels.setColorAt(j, c ? col.set(paint(c).hex) : col.set(0x000000));
    }
    this.group.add(this.pixels);

    const spots = beltOf(w, h);
    this.spotPos = spots.map(s => this.spotToWorld(s));
    this.group.add(this.makeBelt());
  }

  /** Board size in world units including the belt, for camera framing. */
  get extent(): number { const { w, h } = this.game.level; return Math.max(w, h) + BELT_OUT * 2 + 2; }

  private cell(x: number, y: number): THREE.Vector3 {
    const { w, h } = this.game.level;
    return new THREE.Vector3(x - (w - 1) / 2, 0, y - (h - 1) / 2);
  }

  private spotToWorld({ side, i }: BeltSpot): THREE.Vector3 {
    const { w, h } = this.game.level;
    if (side === 0) return this.cell(i, h - 1 + BELT_OUT);
    if (side === 1) return this.cell(w - 1 + BELT_OUT, i);
    if (side === 2) return this.cell(i, -BELT_OUT);
    return this.cell(-BELT_OUT, i);
  }

  private makeBelt(): THREE.Mesh {
    const { w, h } = this.game.level;
    const W = w - 1 + BELT_OUT * 2, H = h - 1 + BELT_OUT * 2, r = BELT_OUT, shape = new THREE.Shape();
    const x0 = -W / 2, y0 = -H / 2;
    shape.moveTo(x0 + r, y0); shape.lineTo(x0 + W - r, y0); shape.quadraticCurveTo(x0 + W, y0, x0 + W, y0 + r);
    shape.lineTo(x0 + W, y0 + H - r); shape.quadraticCurveTo(x0 + W, y0 + H, x0 + W - r, y0 + H);
    shape.lineTo(x0 + r, y0 + H); shape.quadraticCurveTo(x0, y0 + H, x0, y0 + H - r);
    shape.lineTo(x0, y0 + r); shape.quadraticCurveTo(x0, y0, x0 + r, y0);
    const inner = new THREE.Path(), m = BELT_OUT * 0.55, iw = W - m * 2, ih = H - m * 2;
    inner.moveTo(-iw / 2, -ih / 2); inner.lineTo(-iw / 2, ih / 2); inner.lineTo(iw / 2, ih / 2); inner.lineTo(iw / 2, -ih / 2); inner.lineTo(-iw / 2, -ih / 2);
    shape.holes.push(inner);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshToonMaterial({ color: 0x4b3a80 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.31;
    return mesh;
  }

  private place(j: number, scale: number) {
    const { w } = this.game.level;
    this.dummy.position.copy(this.cell(j % w, Math.floor(j / w)));
    this.dummy.position.y = (1 - scale) * 0.4;
    this.dummy.scale.setScalar(Math.max(scale, 0.0001));
    this.dummy.updateMatrix();
    this.pixels.setMatrixAt(j, this.dummy.matrix);
  }

  private makeRider(c: number): THREE.Group {
    const p = paint(c), g = new THREE.Group();
    const pot = new THREE.Mesh(this.riderGeo.pot, new THREE.MeshToonMaterial({ color: p.hex }));
    const head = new THREE.Mesh(this.riderGeo.body, new THREE.MeshToonMaterial({ color: 0xfff4e6 }));
    pot.position.y = 0.2; head.position.y = 0.85; head.scale.set(1, 0.85, 1);
    g.add(pot, head);
    return g;
  }

  handle(events: GameEvent[]) {
    for (const e of events) {
      if (e.type === 'shot') this.popping.set(e.j, 0);
      else if (e.type === 'pop' || e.type === 'park') {
        const m = this.riders.get(e.id);
        if (m) { this.group.remove(m); this.riders.delete(e.id); }
      }
    }
  }

  /** frac = progress (0..1) from the current belt spot to the next, for smooth motion between rule steps. */
  update(dt: number, frac: number) {
    for (const [j, t] of this.popping) {
      const nt = t + dt, k = Math.min(1, nt / POP_TIME);
      this.place(j, k < 0.35 ? 1 + k * 0.6 : (1.21 * (1 - k)) / 0.65); // swell, then shrink away
      if (k >= 1) this.popping.delete(j); else this.popping.set(j, nt);
    }
    this.pixels.instanceMatrix.needsUpdate = true;

    const L = this.spotPos.length;
    for (const r of this.game.riders) {
      let m = this.riders.get(r.id);
      if (!m) { m = this.makeRider(r.c); this.riders.set(r.id, m); this.group.add(m); }
      m.visible = r.s >= 0;
      if (r.s < 0) continue;
      const a = this.spotPos[r.s % L]!, b = this.spotPos[(r.s + 1) % L]!;
      m.position.lerpVectors(a, b, frac);
      m.position.y = Math.abs(Math.sin((r.s + frac) * Math.PI)) * 0.25; // little hop per spot
    }
  }

  dispose() {
    this.pixels.geometry.dispose();
    (this.pixels.material as THREE.Material).dispose();
    this.riderGeo.body.dispose(); this.riderGeo.pot.dispose();
  }
}
