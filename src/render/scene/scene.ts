// The 3D play field: board pixels, belt and dock, cushion tray, queues, riders and effects, with tap input.
// Layout is computed in CSS px (layout.ts) and projected onto a tilted orthographic camera (project.ts), so what
// is drawn, what is tapped and screenPoint() all agree without ray casting.
import {
  AdditiveBlending, Color, DirectionalLight, Fog, Group, HemisphereLight, MeshBasicMaterial, OrthographicCamera,
  Scene, WebGLRenderer,
} from 'three';
import { PALETTE, type BeltRider, type Game, type GameEvent } from '../../engine';
import type { GameSceneApi, Point, ScreenInsets, TapTarget } from '../../app/contracts';
import { PurrletView, warmupPurrlets } from '../purrlet';
import { fontsReady } from '../../fonts';
import { BeltView, decalMaterial } from './belt';
import { CatSlot, STYLE, type Place, type Style } from './cats';
import { clamp01 } from './ease';
import { FlatQuad } from './flat';
import {
  CAT_H, computeLayout, gridFor, hitTest, queueCatW, queueCatY, queueDim, queueXs, riderArc, spotArcs, topColors, QUEUE_SHOWN,
  type Grid, type Insets, type Layout, type Pt,
} from './layout';
import { LinkView } from './links';
import { Confetti, Dots, Stars } from './particles';
import { PixelBoard } from './pixels';
import { CAM_DIST, Projector, unsmooth } from './project';
import { canvasTexture, drawBow, drawGlow, drawRibbon, drawRing, makeCanvas } from './textures';
import { TrayView } from './tray';

/** Riders stand this far (× their width) below the lane centre line, so they look centred on it. */
const RIDER_DROP = 0.3;
/** Paint dot flight, cat → pixel. */
const DOT_TIME = 0.1;
const CELEBRATE = 1.8;
/** Seconds into a pop when the cat vanishes into its star burst (the pop lasts 0.7 s). */
const POP_BURST = 0.56;
const STAGE = '#2A2163';
const BELT_PLACE: Place = { k: 'belt' };
const GOLD = new Color('#FFD43B'), WHITE = new Color('#FFFFFF'), PINK = new Color('#FF7EC8');

const pt: Pt = { x: 0, y: 0 }, pt2: Pt = { x: 0, y: 0 };

export class GameScene implements GameSceneApi {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  private readonly P = new Projector();
  private readonly field = new Group();
  private readonly pixels: PixelBoard;
  private readonly belt = new BeltView();
  private readonly tray = new TrayView();
  private readonly dots = new Dots();
  private readonly stars = new Stars();
  private readonly confetti = new Confetti();
  private readonly paints = PALETTE.map(p => new Color(p ? p.hex : '#ffffff'));
  private readonly lights = paintLights();
  // decal materials shared by every ring, ribbon and glow
  private readonly ringTex = canvasTexture(makeCanvas(128, 128));
  private readonly ring: FlatQuad;
  private readonly glowTex = canvasTexture(makeCanvas(64, 64));
  private readonly glowMat: MeshBasicMaterial;
  private readonly glows: FlatQuad[] = [];
  private readonly ribbonTex = canvasTexture(makeCanvas(64, 16), true);
  private readonly bowTex = canvasTexture(makeCanvas(64, 48));
  private readonly ribbonMat: MeshBasicMaterial;
  private readonly bowMat: MeshBasicMaterial;
  private readonly links: LinkView[] = [];
  private pairs: [CatSlot, CatSlot][] = [];

  private L: Layout;
  private insets: Insets = { top: 0, bottom: 0, left: 0, right: 0 };
  private dpr = 1;
  private fogNear = 80;
  private fogFar = 180;
  private game: Game | null = null;
  private grid: Grid = { x0: 0, y0: 0, cell: 1, w: 1, h: 1 };
  private arcs: Float64Array = new Float64Array(1);
  private qx: number[] = [];
  private readonly qLens: number[] = [];
  private cats: CatSlot[] = [];
  private readonly byId = new Map<number, CatSlot>();
  private readonly keep = new Set<number>();
  private dead: CatSlot[] = [];
  private reduced: boolean;
  private tapCb: ((t: TapTarget) => void) | null = null;
  private hl: TapTarget | null = null;
  private time = 0;
  private frac = 0;
  /** Bumped by clear()/load() so callbacks from an old game (pop promises, timers) are ignored. */
  private gen = 0;
  private timers: { at: number; fn: () => void }[] = [];
  private nextTimer = Infinity;
  private celebration: { done: () => void; at: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, reducedMotion: boolean) {
    this.reduced = reducedMotion;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.scene.fog = new Fog(STAGE, this.fogNear, this.fogFar);
    this.scene.add(...this.lights, this.field);
    this.pixels = new PixelBoard(this.P);
    this.field.add(this.pixels.mesh, this.belt.group, this.tray.group);
    for (const p of [this.dots, this.stars, this.confetti]) this.field.add(p.mesh);

    drawRing(this.ringTex.image as HTMLCanvasElement);
    drawGlow(this.glowTex.image as HTMLCanvasElement);
    drawRibbon(this.ribbonTex.image as HTMLCanvasElement);
    drawBow(this.bowTex.image as HTMLCanvasElement);
    this.ring = new FlatQuad(decalMaterial(this.ringTex));
    this.ring.mesh.renderOrder = 6;
    this.ring.mesh.visible = false;
    this.glowMat = decalMaterial(this.glowTex, { blending: AdditiveBlending, color: new Color('#3FF4FF') });
    this.ribbonMat = decalMaterial(this.ribbonTex);
    this.bowMat = decalMaterial(this.bowTex);
    this.field.add(this.ring.mesh);
    this.field.visible = false;

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onPointer);
    this.L = computeLayout(1, 1, this.insets);
    this.resize();
    void fontsReady().then(() => this.belt.refreshText());
    // Compile the kitten shaders under the game's own lights now, so the first level doesn't hitch.
    void warmupPurrlets(this.renderer, { scene: this.scene, camera: this.camera }).catch(e => console.warn('scene: warmup failed', e));
  }

  // ---------------------------------------------------------------- layout

  setInsets(i: ScreenInsets): void { this.insets = { ...i }; this.resize(); }

  resize(): void {
    const c = this.canvas;
    const w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    const L = (this.L = computeLayout(w, h, this.insets)), k = 1 / L.unit, P = this.P;
    P.set(w, h, k);
    const cam = this.camera;
    cam.left = (-w / 2) * k; cam.right = (w / 2) * k; cam.top = (h / 2) * k; cam.bottom = (-h / 2) * k;
    cam.position.set(0, CAM_DIST * P.sin, CAM_DIST * P.cos);
    cam.lookAt(0, 0, 0);
    cam.far = CAM_DIST * 4;
    cam.updateProjectionMatrix();
    // Fog starts just past the farthest ground point, so only cats pushed back (dimmed) fade into the stage.
    this.fogNear = P.viewDepth(h) + 2; this.fogFar = this.fogNear + 100;
    const fog = this.scene.fog as Fog;
    fog.near = this.fogNear; fog.far = this.fogFar;
    this.belt.layout(L, P, this.dpr);
    this.tray.place(L, P, this.dpr);
    if (this.game) this.layoutGame(this.game);
  }

  private layoutGame(g: Game): void {
    const { w, h } = g.level;
    this.grid = gridFor(this.L, w, h);
    this.pixels.layout(this.grid);
    this.arcs = spotArcs(this.belt.path, this.grid);
    this.qx = queueXs(this.L, g.queues.length);
  }

  // ---------------------------------------------------------------- game

  load(game: Game): void {
    this.clear();
    this.game = game;
    this.pixels.build(game.level.px, game.px);
    this.layoutGame(game);
    this.tray.set(game.trayCap, game.level.tray);
    this.field.visible = true;
    this.sync(true);
  }

  apply(events: readonly GameEvent[]): void {
    const g = this.game;
    if (!g || !events.length) return;
    for (const e of events) {
      switch (e.type) {
        case 'launch':
          for (const id of e.ids) { const c = this.byId.get(id); if (c) { c.view.hop(); c.xray = !!e.xray && id === e.ids[0]; } }
          break;
        case 'shot': this.shot(e.id, e.s, e.j); break;
        case 'pop': this.popCat(e.id); break;
        case 'park': { const c = this.byId.get(e.id); if (c) { c.view.setAmmo(e.a); c.xray = false; } break; }
        case 'reveal': { const c = this.byId.get(e.id); if (c?.view.hidden) c.view.setHidden(false, true); break; }
        case 'traySlots': this.tray.set(e.cap, g.level.tray, true); break;
        case 'xrayArmed': this.belt.setXray(true); break;
        default: break; // won, lost, resumed, shuffle, napBack: the sync below moves everyone to their new places
      }
    }
    this.sync(false);
  }

  /** Reconcile the views with the game: who is visible, where each cat belongs, moods and mystery flags. */
  private sync(snap: boolean): void {
    const g = this.game!, keep = this.keep;
    keep.clear();
    for (const r of g.riders) {
      keep.add(r.id);
      const c = this.byId.get(r.id) ?? this.spawn(r.id, r.c, r.a, false, BELT_PLACE);
      if (c.place.k !== 'belt') this.move(c, BELT_PLACE, snap);
      c.setMood('ride');
    }
    const full = g.tray.length >= g.trayCap;
    g.tray.forEach((t, i) => {
      keep.add(t.id);
      const c = this.byId.get(t.id) ?? this.spawn(t.id, t.c, t.a, false, { k: 'tray', i });
      if (c.place.k !== 'tray' || c.place.i !== i) this.move(c, { k: 'tray', i }, snap);
      if (!c.onArrive) c.setMood(full ? 'worry' : 'nap');
    });
    g.queues.forEach((qq, q) => {
      for (let d = 0; d < qq.length; d++) {
        const p = qq[d]!;
        let c = this.byId.get(p.id);
        if (d >= QUEUE_SHOWN) {
          if (c && c.place.k !== 'leave') { keep.add(p.id); this.leave(c, q); }
          continue;
        }
        keep.add(p.id);
        const hide = !g.isRevealed(p);
        if (!c) {
          c = this.spawn(p.id, p.c, p.a, hide, { k: 'queue', q, d });
          if (!snap) c.go(c.place, STYLE.appear, 1);
        } else if (c.place.k !== 'queue' || c.place.q !== q || c.place.d !== d) this.move(c, { k: 'queue', q, d }, snap);
        if (c.view.hidden !== hide) c.view.setHidden(hide, !hide && !snap);
        c.setMood('idle');
      }
    });
    for (const c of this.cats) {
      const k = c.place.k;
      if (!keep.has(c.id) && (k === 'queue' || k === 'tray' || k === 'belt')) this.leave(c, -1);
    }
    this.syncLinks();
    this.belt.setFree(g.beltFree, g.level.belt);
    this.belt.setXray(g.xrayArmed);
  }

  private spawn(id: number, color: number, ammo: number, hidden: boolean, place: Place): CatSlot {
    const view = new PurrletView({ color, ammo, hidden, reducedMotion: this.reduced, seed: id });
    const c = new CatSlot(id, view, place);
    c.go(place, STYLE.snap, 1);
    this.field.add(c.holder);
    this.cats.push(c);
    this.byId.set(id, c);
    return c;
  }

  private move(c: CatSlot, place: Place, snap: boolean): void {
    const from = c.place, to = place.k;
    let s: Style = STYLE.fly;
    if (snap) s = STYLE.snap;
    else if (to === 'belt') s = STYLE.hop;
    else if (from.k === 'queue' && place.k === 'queue' && from.q === place.q) s = STYLE.slide;
    else if (from.k === 'tray' && to === 'tray') s = STYLE.slide;
    c.go(place, s, this.arcScale);
    if (snap) return;
    if (to === 'belt') c.onArrive = () => this.belt.bump();
    else if (from.k === 'belt' && to === 'tray') {
      c.onArrive = () => { c.view.land(); c.setMood(this.trayMood()); };
    }
  }

  /** Off it goes: deeper into queue q (or just away), shrinking; the view is removed when it gets there. */
  private leave(c: CatSlot, q: number): void {
    const L = this.L, x = q >= 0 ? (this.qx[q] ?? c.x) : c.x;
    const y = q >= 0 ? queueCatY(L, QUEUE_SHOWN) : c.y + 0.05 * L.col.w;
    c.go({ k: 'leave', x, y, w: queueCatW(L, QUEUE_SHOWN), dim: queueDim(QUEUE_SHOWN) }, STYLE.leave, this.arcScale);
    c.setMood('idle');
    c.onArrive = () => this.dead.push(c);
  }

  private trayMood(): 'worry' | 'nap' {
    const g = this.game;
    return g && g.tray.length >= g.trayCap ? 'worry' : 'nap';
  }

  private get arcScale(): number { return this.reduced ? 0 : this.L.col.w / 100; }

  private riderOf(id: number): BeltRider | undefined {
    const rs = this.game?.riders;
    if (rs) for (let i = 0; i < rs.length; i++) if (rs[i]!.id === id) return rs[i];
    return undefined;
  }

  private shot(id: number, s: number, j: number): void {
    const g = this.game!, c = this.byId.get(id);
    if (c) { c.view.shoot(); c.view.setAmmo(Math.max(0, c.view.ammo - 1)); }
    const L = this.L, rw = L.riderW;
    this.belt.path.point(this.arcs[s] ?? 0, pt);
    this.pixels.centre(j, pt2);
    const col = g.level.px[j] ?? 1;
    this.dots.spawn(pt.x, pt.y + (RIDER_DROP - 0.5) * rw, pt2.x, pt2.y, DOT_TIME, Math.max(5, this.grid.cell * 0.75), this.paints[col]!);
    this.pixels.paint(j, DOT_TIME);
  }

  private popCat(id: number): void {
    const c = this.byId.get(id);
    if (!c) return;
    c.place = { k: 'pop', x: c.tx, y: c.ty, w: c.tw }; // keep any hop going: it lands where it popped
    c.xray = false;
    const gen = this.gen;
    let done = false;
    const finish = () => {
      if (done || gen !== this.gen || !this.byId.has(id)) return;
      done = true;
      this.stars.burst(c.x, c.y - c.w * CAT_H * 0.55, c.w, GOLD, this.paints[c.view.color] ?? WHITE);
      this.dead.push(c);
    };
    void c.view.pop().then(finish);
    this.after(POP_BURST, finish); // the burst is the moment the cat vanishes (and covers a pop that never settles)
  }

  private syncLinks(): void {
    const g = this.game!;
    this.pairs = [];
    for (const c of this.cats) {
      if (c.place.k !== 'queue') continue;
      const p = g.purrlet(c.id);
      if (p?.link === undefined || p.id > p.link) continue;
      const o = this.byId.get(p.link);
      if (o && o.place.k === 'queue') this.pairs.push(c.x <= o.x ? [c, o] : [o, c]);
    }
    while (this.links.length < this.pairs.length) {
      const l = new LinkView(this.ribbonMat, this.bowMat);
      this.links.push(l); this.field.add(l.group);
    }
  }

  // ---------------------------------------------------------------- frame

  /** render = false advances animations without drawing (dev tools fast-forward). */
  frame(dt: number, stepFrac: number, render = true): void {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.time += dt;
    this.frac = clamp01(stepFrac);
    this.runTimers();
    if (this.game) {
      this.pixels.update(dt);
      this.belt.update(dt, this.reduced);
      this.tray.update(dt, this.reduced);
      for (let i = 0; i < this.cats.length; i++) {
        const c = this.cats[i]!;
        this.target(c);
        c.step(dt);
        this.pose(c);
        c.view.update(dt);
      }
      if (this.dead.length) this.purge();
      this.updateLinks();
      this.updateRing();
      this.updateGlows();
    }
    const camQ = this.camera.quaternion;
    this.dots.update(dt, this.P, camQ);
    this.stars.update(dt, this.P, camQ);
    this.confetti.update(dt, this.P, camQ);
    if (this.celebration && this.time >= this.celebration.at) this.endCelebration();
    if (render) this.renderer.render(this.scene, this.camera);
  }

  /** Where the cat's place says it should be right now. */
  private target(c: CatSlot): void {
    const L = this.L, p = c.place;
    switch (p.k) {
      case 'queue':
        c.tx = this.qx[p.q] ?? c.tx; c.ty = queueCatY(L, p.d); c.tw = queueCatW(L, p.d); c.tdim = queueDim(p.d);
        break;
      case 'tray': {
        const T = this.tray.layout;
        if (T) { c.tx = T.xs[Math.min(p.i, T.xs.length - 1)]!; c.ty = T.catY; c.tw = T.catW; }
        c.tdim = 0;
        break;
      }
      case 'belt': {
        const r = this.riderOf(c.id);
        if (r) {
          // glide from the spot it just painted from (r.s - 1) to the next one, so it faces the line it paints
          this.belt.path.point(riderArc(this.arcs, r.s > 0 ? r.s - 1 : r.s, r.s > 0 ? this.frac : 0, this.grid.cell), pt);
          c.tx = pt.x; c.ty = pt.y + RIDER_DROP * L.riderW;
        }
        c.tw = L.riderW; c.tdim = 0;
        break;
      }
      case 'leave': c.tx = p.x; c.ty = p.y; c.tw = p.w; c.tdim = p.dim; break;
      case 'pop': c.tx = p.x; c.ty = p.y; c.tw = p.w; c.tdim = 0; break;
      case 'dance': {
        const T = this.tray.layout;
        c.tx = L.col.x + L.col.w * (0.5 + (p.i - 1) * 0.25); c.ty = (T ? T.catY : L.tray.y + L.tray.h) + 0.01 * L.col.w;
        c.tw = 0.2 * L.col.w; c.tdim = 0;
        break;
      }
    }
  }

  /** Shown state → world transform. Dimmed cats slide back along the view ray into the fog. */
  private pose(c: CatSlot): void {
    const L = this.L, P = this.P, wig = c.wiggle(this.reduced);
    let push = 0;
    // (only in the queue area: pushed back over the tray, a cat would hide behind its panel)
    if (c.dim > 0.002 && c.y > L.queue.y + L.frontW * CAT_H * 0.6) {
      push = this.fogNear + unsmooth(c.dim) * (this.fogFar - this.fogNear) - P.viewDepth(c.y);
    }
    c.push = push;
    P.toWorld(c.x, c.y, push, c.holder.position);
    c.holder.scale.setScalar(Math.max(1e-4, c.w * P.k * c.mul * wig.pulse));
    c.holder.rotation.z = wig.roll;
    c.holder.visible = c.mul > 0.001;
  }

  private purge(): void {
    const dead = new Set(this.dead);
    this.dead = [];
    for (const c of dead) {
      if (this.byId.get(c.id) === c) this.byId.delete(c.id);
      this.field.remove(c.holder);
      c.view.dispose();
    }
    this.cats = this.cats.filter(c => !dead.has(c));
    if (this.game) this.syncLinks();
  }

  private updateLinks(): void {
    const P = this.P;
    for (let i = 0; i < this.links.length; i++) {
      const l = this.links[i]!, pair = this.pairs[i];
      l.group.visible = !!pair && pair[0].mul > 0.05 && pair[1].mul > 0.05 && pair[0].place.k === 'queue' && pair[1].place.k === 'queue';
      if (!pair || !l.group.visible) continue;
      const [a, b] = pair, aw = a.w * a.mul, bw = b.w * b.mul, w = (aw + bw) / 2;
      l.set(P, a.x + aw * 0.36, a.y - aw * 0.4, a.push, b.x - bw * 0.36, b.y - bw * 0.4, b.push, w * 0.12, w * 0.38);
    }
  }

  private updateRing(): void {
    const ring = this.ring.mesh, c = this.hlCat();
    ring.visible = !!c;
    if (!c) return;
    const s = this.reduced ? 1.7 : 1.7 + 0.12 * Math.sin(this.time * 6), w = c.w * c.mul * s;
    this.ring.set(this.P, c.x - w / 2, c.y - c.w * 0.04 - w / 2, w, w, 0, false);
    (ring.material as MeshBasicMaterial).opacity = this.reduced ? 0.6 + 0.4 * Math.sin(this.time * 4) ** 2 : 1;
  }

  private hlCat(): CatSlot | undefined {
    const t = this.hl, g = this.game;
    if (!t || !g) return undefined;
    const id = t.kind === 'queue' ? g.front(t.q)?.id : g.tray[t.i]?.id;
    return id === undefined ? undefined : this.byId.get(id);
  }

  private updateGlows(): void {
    let n = 0;
    const P = this.P;
    for (const c of this.cats) {
      if (!c.xray || c.place.k === 'pop') continue;
      let q = this.glows[n];
      if (!q) { q = new FlatQuad(this.glowMat); q.mesh.renderOrder = 3; this.glows.push(q); this.field.add(q.mesh); }
      const w = c.w * c.mul * 1.9, cy = c.y - c.w * CAT_H * 0.5;
      q.face(P, c.x - w / 2, cy - w / 2, w, w, P.viewDepth(c.y) + c.push + 0.3 * c.w * P.k);
      q.mesh.visible = true;
      n++;
    }
    for (let i = n; i < this.glows.length; i++) this.glows[i]!.mesh.visible = false;
    if (n) this.glowMat.opacity = this.reduced ? 0.75 : 0.6 + 0.3 * Math.sin(this.time * 7);
  }

  private after(sec: number, fn: () => void): void {
    const at = this.time + sec;
    this.timers.push({ at, fn });
    this.nextTimer = Math.min(this.nextTimer, at);
  }

  private runTimers(): void {
    if (this.time < this.nextTimer) return;
    const due = this.timers.filter(t => t.at <= this.time);
    this.timers = this.timers.filter(t => t.at > this.time);
    this.nextTimer = this.timers.reduce((m, t) => Math.min(m, t.at), Infinity);
    for (const t of due) t.fn();
  }

  // ---------------------------------------------------------------- input and tutorial

  onTap(cb: (t: TapTarget) => void): void { this.tapCb = cb; }

  private readonly onPointer = (e: PointerEvent): void => {
    const g = this.game;
    if (!g || !this.field.visible || e.button > 0) return;
    const r = this.canvas.getBoundingClientRect();
    this.qLens.length = 0;
    for (const q of g.queues) this.qLens.push(q.length);
    const t = hitTest(this.L, e.clientX - r.left, e.clientY - r.top, this.qLens, g.tray.length, this.tray.cushions);
    if (!t) return;
    const ok = t.kind === 'queue' ? g.canLaunchQueue(t.q) : g.canLaunchTray(t.i);
    if (!ok) {
      const id = t.kind === 'queue' ? g.front(t.q)?.id : g.tray[t.i]?.id;
      if (id !== undefined) this.byId.get(id)?.no();
    }
    this.tapCb?.(t);
  };

  highlight(t: TapTarget | null): void { this.hl = t; }

  screenPoint(t: TapTarget | 'board' | 'dock'): Point | null {
    const r = this.canvas.getBoundingClientRect(), L = this.L, g = this.game;
    let x: number, y: number;
    if (t === 'board') { x = L.block.x + L.block.w / 2; y = L.block.y + L.block.h / 2; }
    else if (t === 'dock') { this.belt.dockPoint(pt); x = pt.x; y = pt.y; }
    else if (t.kind === 'queue') {
      if (!g || !g.front(t.q)) return null;
      x = this.qx[t.q] ?? 0; y = queueCatY(L, 0) - L.frontW * CAT_H * 0.5;
    } else {
      const T = this.tray.layout;
      if (!T || t.i < 0 || t.i >= T.xs.length - 1) return null;
      x = T.xs[t.i]!; y = T.cy;
    }
    return { x: x + r.left, y: y + r.top };
  }

  // ---------------------------------------------------------------- win

  celebrate(): Promise<void> {
    const g = this.game;
    if (!g) return Promise.resolve();
    this.endCelebration();
    this.pixels.reform(0.85, 0.12);
    topColors(g.level.px, 3).forEach((col, i) => this.after(0.3 + i * 0.15, () => {
      const id = -1 - i;
      if (this.byId.has(id)) return;
      const c = this.spawn(id, col, 0, false, { k: 'dance', i });
      c.go(c.place, STYLE.dance, 1);
      c.setMood('dance');
    }));
    this.after(0.15, () => this.dropConfetti());
    return new Promise<void>(resolve => {
      const gen = this.gen;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      this.celebration = { done: finish, at: this.time + CELEBRATE };
      // frames may stop (app in background): never leave the controller waiting
      setTimeout(() => { if (gen === this.gen && this.celebration?.done === finish) this.celebration = null; finish(); }, CELEBRATE * 1000 + 800);
    });
  }

  private endCelebration(): void {
    const c = this.celebration;
    this.celebration = null;
    c?.done();
  }

  private dropConfetti(): void {
    const L = this.L, g = this.game, s = L.col.w / 390, n = this.reduced ? 50 : 120;
    const cols = [GOLD, PINK, WHITE, ...(g ? g.level.colors.map(c => this.paints[c]!) : [])];
    for (let i = 0; i < n; i++) {
      this.confetti.drop(L.col.x + Math.random() * L.col.w, L.block.y - 10 - Math.random() * 60 * s, (7 + Math.random() * 6) * s,
        (150 + Math.random() * 110) * s, cols[i % cols.length]!, Math.random() * 1.3, !this.reduced);
    }
  }

  // ---------------------------------------------------------------- lifecycle

  setReducedMotion(on: boolean): void {
    this.reduced = on;
    for (const c of this.cats) c.view.setReducedMotion(on);
  }

  clear(): void {
    this.gen++;
    for (const c of this.cats) { this.field.remove(c.holder); c.view.dispose(); }
    this.cats = []; this.byId.clear(); this.dead = []; this.pairs = [];
    for (const l of this.links) l.group.visible = false;
    for (const q of this.glows) q.mesh.visible = false;
    this.pixels.clear();
    this.dots.clear(); this.stars.clear(); this.confetti.clear();
    this.timers = []; this.nextTimer = Infinity;
    this.hl = null; this.ring.mesh.visible = false;
    this.belt.setXray(false);
    this.endCelebration();
    this.game = null;
    this.field.visible = false;
  }

  dispose(): void {
    this.clear();
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    this.pixels.dispose(); this.belt.dispose(); this.tray.dispose();
    this.dots.dispose(); this.stars.dispose(); this.confetti.dispose();
    for (const l of this.links) l.dispose();
    for (const q of [this.ring, ...this.glows]) q.dispose();
    for (const m of [this.ring.mesh.material as MeshBasicMaterial, this.glowMat, this.ribbonMat, this.bowMat]) m.dispose();
    for (const t of [this.ringTex, this.glowTex, this.ribbonTex, this.bowTex]) t.dispose();
    this.renderer.dispose();
  }
}

/** Soft sky fill plus a key light from the top-left front: friendly to toon materials. */
function paintLights(): [HemisphereLight, DirectionalLight] {
  const hemi = new HemisphereLight(0xffffff, 0xa79de6, 1.5);
  const key = new DirectionalLight(0xffffff, 1.9);
  key.position.set(-3, 8, 6);
  return [hemi, key];
}

export function createGameScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }): GameSceneApi {
  return new GameScene(canvas, opts.reducedMotion);
}
