// The picture: one InstancedMesh of rounded candy cubes (one draw call). Per-instance base/light/dark colours
// feed a small shader: base top, darker bevel bottom-right, light glint top-left, dark front face.
// Painting a pixel swells it 30% then pops it away; celebrate() brings the picture back in a diagonal wave.
import {
  Color, InstancedBufferAttribute, InstancedMesh, ShaderMaterial, Vector3,
  DynamicDrawUsage, type BufferGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { paint } from '../../engine';
import { backOut, outCubic } from './ease';
import { cellCentre, type Grid, type Pt } from './layout';
import type { Projector } from './project';

/** Cube height relative to its width, and its size within the cell. */
const HEIGHT = 0.42, FILL = 0.9;
export const PAINT_POP = 0.25;
const REFORM = 0.36;

/** Animation kinds. */
const A = { None: 0, Pop: 1, Reform: 2 } as const;
type A = (typeof A)[keyof typeof A];

const VERT = /* glsl */ `
attribute vec3 aBase; attribute vec3 aLight; attribute vec3 aDark; attribute float aFlash;
uniform vec3 uHalf;
varying vec3 vBase; varying vec3 vLight; varying vec3 vDark; varying float vFlash; varying vec3 vP; varying vec3 vN;
void main() {
  vBase = aBase; vLight = aLight; vDark = aDark; vFlash = aFlash;
  vP = position / uHalf * 0.5; vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
varying vec3 vBase; varying vec3 vLight; varying vec3 vDark; varying float vFlash; varying vec3 vP; varying vec3 vN;
float box(float v, float a, float b, float s) { return smoothstep(a - s, a + s, v) - smoothstep(b - s, b + s, v); }
void main() {
  vec3 n = normalize(vN);
  float top = smoothstep(0.45, 0.85, n.y);
  vec3 c = vBase;
  // darker bevel along the right and bottom (front) edges of the top face
  c = mix(c, vDark, 0.85 * smoothstep(0.27, 0.33, vP.x));
  c = mix(c, vDark, 0.6 * smoothstep(0.33, 0.4, vP.z));
  // light glint top-left
  c = mix(c, vLight, box(vP.x, -0.34, -0.06, 0.025) * box(vP.z, -0.34, -0.13, 0.025));
  // gentle sheen from the top-left
  c = mix(c, vLight, 0.12 * clamp(-vP.x - vP.z, 0.0, 1.0));
  vec3 side = mix(vDark * 0.82, vDark, smoothstep(-0.5, 0.4, vP.y));
  c = mix(side, c, top);
  c = mix(c, vLight, vFlash);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const tmp = new Vector3(), pt: Pt = { x: 0, y: 0 }, col = new Color();

export class PixelBoard {
  readonly geo: BufferGeometry;
  readonly mat: ShaderMaterial;
  mesh: InstancedMesh;
  private cap = 0;
  private n = 0;
  private G: Grid = { x0: 0, y0: 0, cell: 1, w: 1, h: 1 };
  /** Instance → pixel index; pixel index → instance. */
  private pix = new Int32Array(0);
  private inst = new Int32Array(0);
  /** Per instance: world position of the cube centre, world size, animation kind / clock, shown scale. */
  private cx = new Float32Array(0); private cy = new Float32Array(0); private cz = new Float32Array(0);
  private size = 1;
  private kind = new Uint8Array(0);
  private clock = new Float32Array(0);
  private scale = new Float32Array(0);
  private active = new Int32Array(0);
  private nActive = 0;
  private flash!: InstancedBufferAttribute;

  constructor(private readonly P: Projector) {
    // Built with the on-screen aspect (z stretched by 1/sin(tilt)) so the top face looks square and the rounding even.
    const hz = 1 / P.sin;
    this.geo = new RoundedBoxGeometry(1, HEIGHT, hz, 1, 0.13);
    this.mat = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uHalf: { value: new Vector3(0.5, HEIGHT / 2, hz / 2) } } });
    this.mesh = this.alloc(256);
  }

  private alloc(cap: number): InstancedMesh {
    this.cap = cap;
    const m = new InstancedMesh(this.geo, this.mat, cap);
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    for (const k of ['aBase', 'aLight', 'aDark'] as const) this.geo.setAttribute(k, new InstancedBufferAttribute(new Float32Array(cap * 3), 3));
    this.flash = new InstancedBufferAttribute(new Float32Array(cap), 1);
    this.flash.setUsage(DynamicDrawUsage);
    this.geo.setAttribute('aFlash', this.flash);
    this.cx = new Float32Array(cap); this.cy = new Float32Array(cap); this.cz = new Float32Array(cap);
    this.kind = new Uint8Array(cap); this.clock = new Float32Array(cap); this.scale = new Float32Array(cap);
    this.active = new Int32Array(cap); this.pix = new Int32Array(cap);
    return m;
  }

  /** Build the instances for a picture. `orig` is the full picture; `live` what is still unpainted. Place them with layout(). */
  build(orig: Uint8Array, live: Uint8Array): void {
    let n = 0;
    for (let j = 0; j < orig.length; j++) if (orig[j]) n++;
    if (n > this.cap) {
      const parent = this.mesh.parent;
      parent?.remove(this.mesh); this.mesh.dispose(); this.geo.dispose();
      this.mesh = this.alloc(Math.max(n, this.cap * 2));
      parent?.add(this.mesh);
    }
    this.n = n; this.mesh.count = n; this.nActive = 0;
    this.inst = new Int32Array(orig.length).fill(-1);
    const base = this.geo.getAttribute('aBase') as InstancedBufferAttribute;
    const light = this.geo.getAttribute('aLight') as InstancedBufferAttribute;
    const dark = this.geo.getAttribute('aDark') as InstancedBufferAttribute;
    let i = 0;
    for (let j = 0; j < orig.length; j++) {
      const c = orig[j]!;
      if (!c) continue;
      const p = paint(c);
      base.setXYZ(i, ...col.set(p.hex).toArray() as [number, number, number]);
      light.setXYZ(i, ...col.set(p.light).toArray() as [number, number, number]);
      dark.setXYZ(i, ...col.set(p.dark).toArray() as [number, number, number]);
      this.pix[i] = j; this.inst[j] = i;
      this.kind[i] = A.None; this.scale[i] = live[j] ? 1 : 0; this.flash.setX(i, 0);
      i++;
    }
    base.needsUpdate = light.needsUpdate = dark.needsUpdate = this.flash.needsUpdate = true;
  }

  /** Recompute cube positions for a new grid (resize). */
  layout(G: Grid): void {
    this.G = G;
    const P = this.P, s = G.cell * FILL * P.k, h = HEIGHT * s;
    this.size = s;
    for (let i = 0; i < this.n; i++) {
      cellCentre(G, this.pix[i]!, pt);
      P.toWorld(pt.x, pt.y, P.lift(h), tmp); // top face over the CSS cell
      this.cx[i] = tmp.x; this.cy[i] = tmp.y - h / 2; this.cz[i] = tmp.z;
      this.write(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get grid(): Grid { return this.G; }

  private write(i: number): void {
    const e = this.mesh.instanceMatrix.array as Float32Array, o = i * 16, f = this.scale[i]!, s = this.size * f;
    e[o] = s; e[o + 1] = 0; e[o + 2] = 0; e[o + 3] = 0;
    e[o + 4] = 0; e[o + 5] = s; e[o + 6] = 0; e[o + 7] = 0;
    e[o + 8] = 0; e[o + 9] = 0; e[o + 10] = s; e[o + 11] = 0;
    // grow from the cube's bottom so a swell rises off the board
    e[o + 12] = this.cx[i]!; e[o + 13] = this.cy[i]! + (HEIGHT * this.size * (f - 1)) / 2; e[o + 14] = this.cz[i]!; e[o + 15] = 1;
  }

  private start(i: number, k: A, delay: number): void {
    if (this.kind[i] === A.None) this.active[this.nActive++] = i;
    this.kind[i] = k; this.clock[i] = -delay;
  }

  /** Painted: after `delay` (the paint dot's flight) swell 30% and pop away. */
  paint(j: number, delay = 0): void {
    const i = this.inst[j] ?? -1;
    if (i >= 0) this.start(i, A.Pop, delay);
  }

  /** Celebrate: hide everything, then pop every pixel back in a diagonal wave from the top-left. Returns its length. */
  reform(wave: number, delay = 0): number {
    const { w, h } = this.G, span = Math.max(1, w + h - 2);
    for (let i = 0; i < this.n; i++) {
      const j = this.pix[i]!, x = j % w, y = Math.floor(j / w);
      this.scale[i] = 0; this.write(i);
      this.start(i, A.Reform, delay + ((x + y) / span) * wave);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    return delay + wave + REFORM;
  }

  /** CSS centre of pixel j's top face. */
  centre(j: number, out: Pt): Pt { return cellCentre(this.G, j, out); }

  update(dt: number): void {
    if (!this.nActive) return;
    let flashDirty = false;
    for (let a = 0; a < this.nActive; a++) {
      const i = this.active[a]!, t = (this.clock[i]! += dt);
      if (t < 0) continue;
      let f: number, fl = 0, done = false;
      if (this.kind[i] === A.Pop) {
        const u = t / PAINT_POP;
        if (u >= 1) { f = 0; done = true; }
        else if (u < 0.4) { f = 1 + 0.3 * outCubic(u / 0.4); fl = 0.55 * (u / 0.4); }
        else { const v = (u - 0.4) / 0.6; f = 1.3 * (1 - v * v); fl = 0.55; }
      } else {
        const u = t / REFORM;
        if (u >= 1) { f = 1; done = true; } else f = Math.max(0, backOut(u));
        fl = 0.4 * Math.max(0, 1 - u * 1.5);
      }
      this.scale[i] = f; this.write(i);
      if (this.flash.getX(i) !== fl) { this.flash.setX(i, fl); flashDirty = true; }
      if (done) { this.kind[i] = A.None; this.active[a--] = this.active[--this.nActive]!; }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (flashDirty) this.flash.needsUpdate = true;
  }

  /** Remove the picture (home screen). */
  clear(): void { this.n = 0; this.mesh.count = 0; this.nActive = 0; }

  dispose(): void { this.mesh.dispose(); this.geo.dispose(); this.mat.dispose(); }
}
