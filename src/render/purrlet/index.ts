// The Purrlet: a cream kitten peeking out of a paint pot, in toon-shaded 3D with a plum outline.
// Rig: object (placed by the scene) > lean (tilts the cat back to face the tilted game camera) > body
// (squash, jump, tilt) > flip (mystery reveal) > pot + count, and kitten (rises and sinks) > head, ears, tail.
// Every cat shares geometry, textures and materials (see look.ts); one cat is 8 draw calls.
import * as THREE from 'three';
import '../../fonts';
import { mulberry32, type Rng } from '../../engine';
import * as A from './anim';
import {
  DIM, allColours, faceGeometry, faceMaterial, lookFor, numberGeometry, numberMaterial, shadowGeometry, shadowMaterial,
  sweatGeometry, tailGeometry, toonMaterial, zMaterial,
} from './look';
import { FACES, loadFonts, numberTexture, type Face } from './textures';

export type PurrletMood = 'idle' | 'ride' | 'nap' | 'worry' | 'dance' | 'cheer';

export interface PurrletInit {
  color: number;
  ammo: number;
  hidden?: boolean;
  reducedMotion?: boolean;
  /** Varies idle timing so cats in a row are out of step. */
  seed?: number;
  /** Lean back towards the camera (radians); defaults to the module setting (setPurrletLean). */
  lean?: number;
  /** Soft contact shadow under the pot (default true). */
  shadow?: boolean;
}

export { POP_BURST } from './anim';

let defaultLean = 0.6;
/** How far every cat leans back so its face reads under the tilted orthographic game camera (radians).
 *  About (camera pitch - 25 degrees) reads like the 2D art; 0 stands the cats upright. */
export function setPurrletLean(rad: number): void { defaultLean = rad; }
export function purrletLean(): number { return defaultLean; }

/** How much the head looks up (radians) so the face stays clear from above. */
const LOOK_UP = 0.12;

type ShotKind = 'hop' | 'shoot' | 'land' | 'pop' | 'popCalm' | 'reveal' | 'pulse';
interface Shot { kind: ShotKind; t: number; dur: number; height: number; done?: () => void }
const DUR: Record<ShotKind, number> = {
  hop: A.T.hop, shoot: A.T.shoot, land: A.T.land, pop: A.T.pop, popCalm: A.POP_CALM, reveal: A.T.reveal, pulse: A.T.tapPulse,
};

let seedCounter = 0;
const Z_COUNT = 3;
const DEG = Math.PI / 180;

/** A paint pot kitten. Size: about 1 world unit wide and 1.1 tall, origin at the bottom centre of the pot, facing +Z. */
export class PurrletView {
  readonly object = new THREE.Group();
  color: number;
  ammo: number;
  hidden: boolean;

  private readonly leanG = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly flip = new THREE.Group();
  private readonly kitten = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly earL = new THREE.Group();
  private readonly earR = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly pot: THREE.Mesh;
  private readonly headMesh: THREE.Mesh;
  private readonly earLMesh: THREE.Mesh;
  private readonly earRMesh: THREE.Mesh;
  private readonly faceMesh: THREE.Mesh;
  private readonly numberMesh: THREE.Mesh;
  private readonly shadow: THREE.Mesh | null;
  private zzz: THREE.Mesh | null = null;
  private sweat: THREE.Mesh | null = null;

  private shown = -1;          // colour whose look is on screen (0 = mystery)
  private reduced: boolean;
  private leanRad: number | null;
  private readonly rng: Rng;
  private readonly ph: { breath: number; tail: number; peek: number; peekPeriod: number; tilt: number };
  private t = 0;
  private mood: PurrletMood = 'idle';
  private moodT = 0;
  private moodDelay = 0;
  private loop = A.rest();
  private from: A.Pose | null = null;
  private blendT = 1;
  private shots: Shot[] = [];
  private aim: { x: number; z: number } | null = null;
  private rise: A.Spring = { x: 0, v: 0 };
  private droop: A.Spring = { x: 0, v: 0 };
  private tailDroop: A.Spring = { x: 0, v: 0 };
  private tilt: A.Spring = { x: 0, v: 0 };
  private nextBlink: number;
  private blinkAt = -10;
  private nextTwitch: number;
  private twitchAt = -10;
  private twitchSide = 1;
  private squintUntil = -1;
  private face: Face = 'open';
  private popping: Promise<void> | null = null;

  constructor(init: PurrletInit) {
    this.color = init.color; this.ammo = init.ammo; this.hidden = !!init.hidden;
    this.reduced = !!init.reducedMotion;
    this.leanRad = init.lean ?? null;
    this.rng = mulberry32((init.seed ?? ++seedCounter * 7919) ^ 0x5eed);
    const r = this.rng;
    this.ph = { breath: r() * A.T.idle, tail: r() * A.T.tail, peek: r() * 5, peekPeriod: A.T.peek * (0.85 + 0.3 * r()), tilt: r() * 7 };
    this.nextBlink = A.nextIn(r, 0.5, A.T.blinkMax);
    this.nextTwitch = A.nextIn(r, 1.5, 6);

    const mat = toonMaterial(), look = lookFor(this.hidden ? 0 : this.color);
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material = mat) => new THREE.Mesh(g, m);
    this.pot = mesh(look.pot);
    this.headMesh = mesh(look.head);
    this.earLMesh = mesh(look.earL);
    this.earRMesh = mesh(look.earR);
    this.faceMesh = mesh(faceGeometry('open'), faceMaterial());
    this.numberMesh = mesh(numberGeometry(), numberMaterial('?'));
    const tailMesh = mesh(tailGeometry());

    const p = DIM.earPivot;
    this.earL.position.copy(p); this.earR.position.set(-p.x, p.y, p.z);
    this.earL.add(this.earLMesh); this.earR.add(this.earRMesh);
    this.head.add(this.headMesh, this.faceMesh, this.earL, this.earR);
    this.tail.position.copy(DIM.tailRoot); this.tail.add(tailMesh);
    this.kitten.position.y = DIM.neckY;
    this.kitten.add(this.tail, this.head);
    this.flip.add(this.pot, this.numberMesh, this.kitten);
    this.body.add(this.flip);
    this.leanG.add(this.body);
    this.object.add(this.leanG);
    this.shadow = init.shadow === false ? null : mesh(shadowGeometry(), shadowMaterial());
    if (this.shadow) { this.shadow.position.y = 0.004; this.shadow.renderOrder = -1; this.object.add(this.shadow); }
    this.object.name = 'purrlet';
    this.applyLook();
    this.update(0);
  }

  setAmmo(n: number): void { this.ammo = n; this.applyNumber(); }

  /** Change the paint colour (and its accessory) immediately. */
  setColor(c: number): void { this.color = c; this.applyLook(); }

  /** Mystery: hidden shows a grey pot with "?"; revealing flips to the real colour (animated unless reduced motion). */
  setHidden(hidden: boolean, animate = true): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (hidden || !animate) this.applyLook();
    else if (this.reduced) { this.applyLook(); this.start('pulse'); }
    else this.start('reveal'); // the look swaps at the half-turn, in update()
  }

  /** Mood loop. Dance takes an optional delay so a row of cats can dance in a wave (0.15 s stagger). */
  setMood(m: PurrletMood, opts: { delay?: number } = {}): void {
    if (m === this.mood && opts.delay == null) return;
    this.from = { ...this.loop }; this.blendT = 0;
    this.mood = m; this.moodT = 0; this.moodDelay = opts.delay ?? 0;
  }

  /** Tap-and-hop one-shot (0.45 s). Height in world units. */
  hop(height = 0.42): void { this.start(this.reduced ? 'pulse' : 'hop', height); }

  /** Paint-a-pixel one-shot: squint and recoil (0.25 s). aim (object-local x/z) pushes the recoil away from the shot. */
  shoot(aim?: { x: number; z: number }): void {
    this.squintUntil = this.t + 0.22;
    if (aim) { const l = Math.hypot(aim.x, aim.z) || 1; this.aim = { x: aim.x / l, z: aim.z / l }; }
    if (!this.reduced) this.start('shoot');
  }

  /** Landing squash (arriving on a tray cushion). */
  land(): void { this.start(this.reduced ? 'pulse' : 'land'); }

  /** Out of paint: jump, grow, vanish (the star burst belongs to the scene; POP_BURST is the moment). Resolves when gone (0.7 s). */
  pop(): Promise<void> {
    if (this.popping) return this.popping;
    this.popping = new Promise<void>(resolve => {
      let finished = false;
      const finish = () => { if (finished) return; finished = true; this.object.visible = false; resolve(); };
      this.shots = this.shots.filter(s => s.kind === 'reveal');
      this.start(this.reduced ? 'popCalm' : 'pop', 0, finish);
      // Never leave the game flow hanging if frames stop (backgrounded app, view removed).
      setTimeout(finish, (DUR.pop + 2.5) * 1000);
    });
    return this.popping;
  }

  /** Bring a popped cat back (for pooling): visible, at rest, idle. */
  reset(): void {
    this.popping = null; this.shots = []; this.object.visible = true;
    this.mood = 'idle'; this.moodT = 0; this.from = null; this.blendT = 1;
    this.rise = { x: 0, v: 0 }; this.droop = { x: 0, v: 0 }; this.tailDroop = { x: 0, v: 0 };
    this.update(0);
  }

  setReducedMotion(on: boolean): void { this.reduced = on; }
  /** Per-cat lean override (radians), or null to follow setPurrletLean. */
  setLean(rad: number | null): void { this.leanRad = rad; }

  update(dt: number): void {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.t += dt; this.moodT += dt;
    const t = this.t, rm = this.reduced, m = this.mood, rng = this.rng;

    // ---- mood loop
    let L = A.rest(), flap = 0, sway = 0, riseTo = 0, droopTo = 0, tailDroopTo = 0, tiltTo = 0;
    const mt = this.moodT - this.moodDelay;
    switch (m) {
      case 'idle':
        L.sy = A.idleBreath(t + this.ph.breath);
        riseTo = A.peek(t + this.ph.peek, this.ph.peekPeriod);
        sway = 9 * DEG * Math.sin(2 * Math.PI * (t + this.ph.tail) / A.T.tail);
        tiltTo = 3 * DEG * Math.sin(2 * Math.PI * (t + this.ph.tilt) / 6.8);
        break;
      case 'ride': {
        const r = A.ride(mt);
        L.y = r.y; L.rz = r.rz; flap = r.ear; sway = r.tail; riseTo = 0.015;
        break;
      }
      case 'nap':
        L.sy = A.napBreath(t + this.ph.breath);
        sway = 4 * DEG * Math.sin(2 * Math.PI * (t + this.ph.tail) / 5);
        riseTo = -0.055; droopTo = 0.12; tiltTo = 6 * DEG;
        break;
      case 'worry': {
        const s = A.worryShake(mt);
        L.x = s.x; L.rz = s.rz; riseTo = -0.03; droopTo = 0.32; tailDroopTo = -0.34;
        break;
      }
      case 'dance':
        if (mt >= 0) L = A.dance(mt);
        sway = 14 * DEG * Math.sin(2 * Math.PI * t / 0.45); riseTo = 0.05;
        break;
      case 'cheer':
        L = A.cheer(mt);
        sway = 12 * DEG * Math.sin(2 * Math.PI * t / 0.5); riseTo = 0.08;
        break;
    }
    if (rm) { L = A.rest(); flap = 0; sway = 0; tiltTo = m === 'nap' ? tiltTo : 0; riseTo = m === 'idle' ? 0 : riseTo; }
    if (this.blendT < 1 && this.from) {
      this.blendT = Math.min(1, this.blendT + dt / 0.22);
      const k = A.easeInOut(this.blendT), f = this.from;
      L = { y: A.lerp(f.y, L.y, k), sy: A.lerp(f.sy, L.sy, k), s: A.lerp(f.s, L.s, k), rz: A.lerp(f.rz, L.rz, k), ry: A.lerp(f.ry, L.ry, k), x: A.lerp(f.x, L.x, k), back: 0 };
    }
    this.loop = L;

    // ---- one-shots layered on top
    const P = { ...L };
    let popping = false, landing = false;
    for (const s of this.shots) {
      s.t += dt;
      const q = this.shotPose(s);
      P.y += q.y; P.sy *= q.sy; P.s *= q.s; P.rz += q.rz; P.ry += q.ry; P.x += q.x; P.back += q.back;
      if (s.kind === 'pop' || s.kind === 'popCalm') popping = true;
      if (s.kind === 'land' && s.t < 0.16) landing = true;
    }
    for (const s of this.shots) if (s.t >= s.dur) { if (s.kind === 'reveal') this.applyLook(); s.done?.(); }
    this.shots = this.shots.filter(s => s.t < s.dur);

    const shooting = t < this.squintUntil;
    if (shooting && !rm) riseTo += 0.06; // pops up to paint
    if (popping && !rm) riseTo += 0.1;

    // ---- springs: the kitten pops up out of the pot and sinks into it, ears and tail follow through
    const calm = rm ? 1 : 0.45;
    this.rise = A.spring(this.rise, riseTo, dt, 4.5, calm);
    this.droop = A.spring(this.droop, droopTo, dt, 3, rm ? 1 : 0.5);
    this.tailDroop = A.spring(this.tailDroop, tailDroopTo, dt, 2.5, rm ? 1 : 0.6);
    this.tilt = A.spring(this.tilt, tiltTo + P.rz * 0.4, dt, 2.5, 0.7);

    // ---- blinks and ear twitches on random per-cat timers
    if (t >= this.nextBlink) { this.blinkAt = t; this.nextBlink = t + (rng() < 0.2 ? 0.32 : A.nextIn(rng, A.T.blinkMin, A.T.blinkMax)); }
    let twL = 0, twR = 0;
    if (!rm && (m === 'idle' || m === 'ride')) {
      if (t >= this.nextTwitch) { this.twitchAt = t; this.twitchSide = rng() < 0.5 ? 1 : -1; this.nextTwitch = t + A.nextIn(rng, 3, 8); }
      const tw = A.twitch(t - this.twitchAt);
      if (this.twitchSide > 0) twL = tw; else twR = tw;
    }

    // ---- face
    const b = A.blink(t - this.blinkAt);
    const happy = popping || m === 'cheer' || m === 'dance';
    const f: Face = happy ? 'happy' : shooting ? 'squint' : m === 'nap' ? 'nap' : landing ? 'closed'
      : b > 0.66 ? 'closed' : b > 0.2 ? 'half' : m === 'worry' ? 'worry' : 'open';
    if (f !== this.face) { this.face = f; this.faceMesh.geometry = faceGeometry(f); }

    // ---- apply transforms
    const lean = this.leanRad ?? defaultLean, zp = DIM.potBottom;
    this.leanG.position.set(0, 0, zp);
    this.leanG.rotation.x = -lean;
    const sq = A.squash(P.sy), aim = this.aim, back = aim ? P.back : 0;
    this.body.scale.set(sq.x * P.s, sq.y * P.s, sq.z * P.s);
    this.body.position.set(P.x - (aim?.x ?? 0) * back, P.y, -zp - (aim?.z ?? 0) * back);
    this.body.rotation.z = P.rz;
    this.flip.rotation.y = P.ry;
    this.kitten.position.y = DIM.neckY + this.rise.x;
    this.head.rotation.set(-LOOK_UP, 0, this.tilt.x);
    this.earL.rotation.z = this.droop.x + flap + twL;
    this.earR.rotation.z = -(this.droop.x + flap + twR);
    this.tail.rotation.z = this.tailDroop.x + sway;
    this.tail.rotation.y = 0.25 * sway;
    if (this.shadow) {
      const k = 1 - 0.45 * A.clamp(P.y / 0.45);
      this.shadow.scale.set(k * P.s * sq.x, 1, k * 0.9 * P.s * sq.z);
      this.shadow.position.z = 0.04 - zp * (1 - Math.cos(lean));
    }
    this.updateZzz(m === 'nap');
    this.updateSweat(m === 'worry');
  }

  dispose(): void {
    this.object.removeFromParent();
    this.zzz?.geometry.dispose(); // the only per-cat geometry; everything else is shared
    this.zzz = null;
    this.shots = [];
  }

  // ---------------------------------------------------------------- internals

  private start(kind: ShotKind, height = 0, done?: () => void): void {
    this.shots = this.shots.filter(s => s.kind !== kind && !(kind === 'hop' && s.kind === 'land'));
    this.shots.push({ kind, t: 0, dur: DUR[kind], height, done });
  }

  private shotPose(s: Shot): A.Pose {
    switch (s.kind) {
      case 'hop': return A.hop(s.t, s.height || 0.42);
      case 'shoot': return A.shoot(s.t);
      case 'land': return A.land(s.t);
      case 'pop': return A.pop(s.t);
      case 'popCalm': return A.popCalm(s.t);
      case 'pulse': return A.tapPulse(s.t);
      case 'reveal': {
        const r = A.reveal(s.t);
        if (r.swapped && this.shown !== this.lookColour()) this.applyLook();
        return r;
      }
    }
  }

  private lookColour(): number { return this.hidden ? 0 : this.color; }

  /** Swap geometry to the current colour (or the mystery look) and refresh the count. */
  private applyLook(): void {
    const c = this.lookColour(), look = lookFor(c);
    this.shown = c;
    this.pot.geometry = look.pot; this.headMesh.geometry = look.head;
    this.earLMesh.geometry = look.earL; this.earRMesh.geometry = look.earR;
    this.applyNumber();
  }

  private applyNumber(): void {
    const mystery = this.shown === 0;
    this.numberMesh.visible = mystery || this.ammo > 0;
    if (this.numberMesh.visible) this.numberMesh.material = numberMaterial(mystery ? '?' : String(this.ammo));
  }

  /** Three floating z's in one mesh (vertex alpha fades them); built the first time the cat naps. */
  private updateZzz(on: boolean): void {
    if (!on) { if (this.zzz) this.zzz.visible = false; return; }
    if (!this.zzz) {
      const g = new THREE.BufferGeometry(), n = Z_COUNT * 4, idx: number[] = [], uv: number[] = [];
      for (let i = 0; i < Z_COUNT; i++) { const o = i * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3); uv.push(0, 0, 1, 0, 1, 1, 0, 1); }
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4).fill(1), 4).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.3, 0.6, 0), 0.6);
      this.zzz = new THREE.Mesh(g, zMaterial());
      this.zzz.renderOrder = 2;
      this.kitten.add(this.zzz);
    }
    const z = this.zzz, pos = z.geometry.getAttribute('position') as THREE.BufferAttribute, col = z.geometry.getAttribute('color') as THREE.BufferAttribute;
    z.visible = true;
    const fadeIn = A.clamp(this.moodT / 0.6);
    for (let i = 0; i < Z_COUNT; i++) {
      const q = A.zz(this.moodT + i * (A.T.zz / Z_COUNT) - 0.4), size = 0.26 * q.s / 2;
      const cx = 0.3 + (this.reduced ? 0.06 * i : q.x), cy = 0.36 + (this.reduced ? 0.14 * i : q.y);
      const a = q.a * fadeIn;
      for (let k = 0; k < 4; k++) {
        pos.setXYZ(i * 4 + k, cx + (k === 1 || k === 2 ? size : -size), cy + (k >= 2 ? size : -size), 0.12);
        col.setW(i * 4 + k, a);
      }
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  private updateSweat(on: boolean): void {
    if (!on) { if (this.sweat) this.sweat.visible = false; return; }
    if (!this.sweat) {
      this.sweat = new THREE.Mesh(sweatGeometry(), toonMaterial());
      this.head.add(this.sweat);
    }
    const s = A.sweat(this.moodT), k = this.reduced ? A.clamp(this.moodT / 0.4) : s.s * (0.4 + 0.6 * s.a);
    this.sweat.visible = k > 0.02;
    this.sweat.position.set(DIM.sweat.x, DIM.sweat.y + (this.reduced ? 0 : s.y), DIM.sweat.z);
    this.sweat.scale.setScalar(Math.max(k, 0.001));
  }
}

/** Load fonts / build shared textures and geometry before the first cat is shown. Pass the renderer (and
 *  ideally the game scene and camera, so the light setup matches) to also compile the shaders up front. */
export async function warmupPurrlets(renderer?: THREE.WebGLRenderer, target?: { scene: THREE.Scene; camera: THREE.Camera }): Promise<void> {
  await loadFonts();
  for (const c of allColours()) lookFor(c);
  for (const f of FACES) faceGeometry(f);
  for (let n = 0; n <= 40; n++) numberTexture(String(n));
  numberMaterial('?');
  if (!renderer) return;
  const cat = new PurrletView({ color: 1, ammo: 1 });
  cat.setMood('nap'); cat.update(0.1); // builds the z mesh too
  const scene = target?.scene ?? new THREE.Scene();
  if (!target) scene.add(new THREE.HemisphereLight(), new THREE.DirectionalLight());
  scene.add(cat.object);
  renderer.compile(scene, target?.camera ?? new THREE.PerspectiveCamera());
  cat.dispose();
}
