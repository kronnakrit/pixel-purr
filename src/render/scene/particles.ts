// Pooled particles, one InstancedMesh (one draw call) per kind: paint dots, star bursts, confetti.
// Particles live in CSS px (x, y) plus a view-depth push, like everything else in the field, and are
// projected each frame. Dead particles are swapped out so only live ones are drawn; nothing allocates per frame.
import {
  Color, DoubleSide, DynamicDrawUsage, IcosahedronGeometry, InstancedMesh, Matrix4, MeshBasicMaterial,
  PlaneGeometry, Quaternion, Shape, ShapeGeometry, Vector3, type BufferGeometry, type Material,
} from 'three';
import type { Projector } from './project';

const m4 = new Matrix4(), pos = new Vector3(), scl = new Vector3(), q = new Quaternion(), qs = new Quaternion(), axis = new Vector3();
const Z = new Vector3(0, 0, 1);

/** Fields per particle: x, y, depth, vx, vy, age, life, size, rot, vr, a, b, c, d (kind-specific). */
const NF = 15;
const X = 0, Y = 1, D = 2, VX = 3, VY = 4, AGE = 5, LIFE = 6, SIZE = 7, ROT = 8, VR = 9, A = 10, B = 11, C = 12, DD = 13, SW = 14;

abstract class Pool {
  readonly mesh: InstancedMesh;
  protected readonly f: Float32Array;
  protected n = 0;
  private colorDirty = false;

  constructor(geo: BufferGeometry, mat: Material, readonly cap: number) {
    this.mesh = new InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, new Color(1, 1, 1));
    this.f = new Float32Array(cap * NF);
  }

  get alive(): number { return this.n; }

  /** Claim a slot (the oldest one is recycled when the pool is full). */
  protected add(color: Color): number {
    const i = this.n < this.cap ? this.n++ : 0;
    this.f.fill(0, i * NF, i * NF + NF);
    this.mesh.setColorAt(i, color);
    this.colorDirty = true;
    return i;
  }

  private kill(i: number): void {
    const last = --this.n;
    if (i === last) return;
    this.f.copyWithin(i * NF, last * NF, last * NF + NF);
    const c = this.mesh.instanceColor!.array as Float32Array;
    c[i * 3] = c[last * 3]!; c[i * 3 + 1] = c[last * 3 + 1]!; c[i * 3 + 2] = c[last * 3 + 2]!;
    this.colorDirty = true;
  }

  /** Move particle i (fields at offset o) and return its scale in CSS px (<= 0 hides it). Sets pos (CSS x, y, depth) and q. */
  protected abstract step(o: number, dt: number, u: number, camQ: Quaternion): number;

  update(dt: number, P: Projector, camQ: Quaternion): void {
    if (!this.n && !this.mesh.count) return;
    const f = this.f;
    for (let i = 0; i < this.n; i++) {
      const o = i * NF;
      f[o + AGE]! += dt;
      if (f[o + AGE]! >= f[o + LIFE]!) { this.kill(i--); continue; }
      const s = this.step(o, dt, f[o + AGE]! / f[o + LIFE]!, camQ);
      P.toWorld(f[o + X]!, f[o + Y]!, f[o + D]!, pos);
      const w = Math.max(1e-4, s * P.k);
      m4.compose(pos, q, scl.set(w, w, w));
      this.mesh.setMatrixAt(i, m4);
    }
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.colorDirty && this.mesh.instanceColor) { this.mesh.instanceColor.needsUpdate = true; this.colorDirty = false; }
  }

  clear(): void { this.n = 0; this.mesh.count = 0; this.mesh.visible = false; }

  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as Material).dispose(); this.mesh.dispose(); }
}

/** Paint dots: fly from a cat to the pixel it paints, on a small arc. */
export class Dots extends Pool {
  constructor(cap = 64) {
    super(new IcosahedronGeometry(0.5, 1), new MeshBasicMaterial({ fog: false }), cap);
  }

  /** From (x0, y0) to (x1, y1) in `time` seconds; size in CSS px. */
  spawn(x0: number, y0: number, x1: number, y1: number, time: number, size: number, color: Color): void {
    const i = this.add(color), o = i * NF, f = this.f;
    f[o + X] = x0; f[o + Y] = y0; f[o + A] = x0; f[o + B] = y0; f[o + C] = x1; f[o + DD] = y1;
    f[o + LIFE] = time; f[o + SIZE] = size; f[o + D] = -4;
  }

  protected step(o: number, _dt: number, u: number): number {
    const f = this.f, e = 1 - (1 - u) * (1 - u);
    f[o + X] = f[o + A]! + (f[o + C]! - f[o + A]!) * e;
    f[o + Y] = f[o + B]! + (f[o + DD]! - f[o + B]!) * e - Math.sin(Math.PI * u) * f[o + SIZE]! * 1.5;
    q.identity();
    return f[o + SIZE]! * (1 - 0.35 * u);
  }
}

function starShape(): Shape {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.22 : 0.5;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/** Star burst: stars fly out from a point, slow down, spin and shrink. */
export class Stars extends Pool {
  constructor(cap = 96) {
    super(new ShapeGeometry(starShape()), new MeshBasicMaterial({ fog: false, side: DoubleSide }), cap);
  }

  /** Burst around (x, y) sized for a cat w px wide: stars travel about 0.8 w. Still (Reduce Motion): one star grows
   *  and fades where the cat was. */
  burst(x: number, y: number, w: number, color: Color, accent: Color, count = 9, still = false): void {
    if (still) count = 1;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + Math.random() * 0.4, sp = still ? 0 : w * (3.4 + Math.random() * 1.6);
      const i = this.add(k % 3 === 2 ? accent : color), o = i * NF, f = this.f;
      f[o + X] = x; f[o + Y] = y; f[o + VX] = Math.cos(a) * sp; f[o + VY] = Math.sin(a) * sp;
      f[o + LIFE] = 0.55 + Math.random() * 0.2; f[o + SIZE] = w * (still ? 0.5 : 0.24 + Math.random() * 0.1);
      f[o + VR] = still ? 0 : (Math.random() - 0.5) * 10; f[o + D] = -6;
    }
  }

  protected step(o: number, dt: number, u: number, camQ: Quaternion): number {
    const f = this.f, drag = Math.exp(-dt * 5);
    f[o + VX]! *= drag; f[o + VY]! *= drag;
    f[o + X]! += f[o + VX]! * dt; f[o + Y]! += f[o + VY]! * dt;
    f[o + ROT]! += f[o + VR]! * dt;
    q.copy(camQ).multiply(qs.setFromAxisAngle(Z, f[o + ROT]!));
    return f[o + SIZE]! * (u < 0.15 ? u / 0.15 : 1 - ((u - 0.15) / 0.85) ** 2);
  }
}

/** Confetti: paper rectangles tumbling down with a sway. */
export class Confetti extends Pool {
  constructor(cap = 160) {
    super(new PlaneGeometry(1, 0.55), new MeshBasicMaterial({ fog: false, side: DoubleSide }), cap);
  }

  /** Drop one piece from (x, y), starting after `delay` seconds. Without `moving` (Reduce Motion) it stays where it
   *  appears: no fall, drift, sway or spin. */
  drop(x: number, y: number, size: number, fall: number, color: Color, delay: number, moving: boolean): void {
    const i = this.add(color), o = i * NF, f = this.f;
    f[o + X] = x; f[o + Y] = y; f[o + VY] = moving ? fall : 0; f[o + VX] = moving ? (Math.random() - 0.5) * 50 : 0;
    f[o + AGE] = -delay; f[o + LIFE] = 3.2; f[o + SIZE] = size; f[o + D] = -8; f[o + SW] = moving ? 40 : 0;
    f[o + VR] = moving ? 4 + Math.random() * 6 : 0; f[o + ROT] = Math.random() * 6;
    const ax = Math.random() - 0.5, ay = Math.random() - 0.5, az = Math.random() * 0.6 + 0.2, l = Math.hypot(ax, ay, az);
    f[o + A] = ax / l; f[o + B] = ay / l; f[o + C] = az / l; f[o + DD] = Math.random() * 6;
  }

  protected step(o: number, dt: number, u: number, camQ: Quaternion): number {
    const f = this.f;
    if (f[o + AGE]! < 0) return 0;
    f[o + Y]! += f[o + VY]! * dt;
    f[o + X]! += (f[o + VX]! + Math.sin(f[o + AGE]! * 3 + f[o + DD]!) * f[o + SW]!) * dt;
    f[o + ROT]! += f[o + VR]! * dt;
    q.copy(camQ).multiply(qs.setFromAxisAngle(axis.set(f[o + A]!, f[o + B]!, f[o + C]!), f[o + ROT]!));
    return f[o + SIZE]! * (u > 0.85 ? (1 - u) / 0.15 : 1);
  }
}
