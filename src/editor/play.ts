// A simple 2D play view for the editor: the board with its belt, riders, dock, tray and queues on one canvas.
// Tap a queue front or a napping Purrlet; the engine's Game steps at a fixed rate. Autoplay replays the solver's
// plan one Purrlet (or linked pair) at a time, exactly like the solver model.
import { beltOf, Game, PALETTE, type GameEvent, type Level, type Move } from '../engine';
import { BOARD, crisp, cube, INK, label, rrect } from './draw';

const CREAM = '#FFF4E4', MYSTERY = '#6C6390', CUSHION = '#1C1540', BELT = '#9C92E8', BELT_DARK = '#6F64C9', DOCK = '#5AA2FF', RIBBON = '#FF7EC8';

export interface PlayState { status: Game['status']; left: number; total: number; tray: number; cap: number; riders: number; step: number; plan: number; planLen: number }

type Hit = { kind: 'queue'; q: number; x: number; y: number; w: number; h: number } | { kind: 'tray'; i: number; x: number; y: number; w: number; h: number };

export class PlayView {
  readonly canvas = document.createElement('canvas');
  private game: Game | null = null;
  private level: Level | null = null;
  private hits: Hit[] = [];
  private flashes = new Map<number, number>(); // pixel → time painted
  private acc = 0;
  private last = 0;
  private raf = 0;
  private auto = false;
  private planAt = 0;
  /** Engine steps per second (the app runs 36). */
  speed = 36;
  private W = 520;
  private H = 720;
  private maxH = 720;

  constructor(private readonly onState: (s: PlayState) => void) {
    this.canvas.className = 'play';
    this.canvas.addEventListener('pointerdown', e => this.tap(e));
  }

  load(L: Level): void {
    this.level = L;
    this.restart();
  }

  restart(): void {
    if (!this.level) return;
    this.game = new Game(this.level);
    this.flashes.clear();
    this.planAt = 0;
    this.acc = 0;
    this.emit();
  }

  /** Autoplay the stored solution from a fresh start. */
  autoplay(on: boolean): void {
    if (on) this.restart();
    this.auto = on && !!this.level?.solution?.plan;
    this.emit();
  }

  get autoplaying(): boolean { return this.auto; }

  /** Width to use and the most height available; the canvas takes only the height its board needs. */
  setSize(w: number, maxH: number): void { this.W = w; this.maxH = maxH; }

  start(): void {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (t: number) => { this.frame(t); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void { cancelAnimationFrame(this.raf); }

  private frame(t: number): void {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    const g = this.game;
    if (g && g.status === 'playing') {
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= 1 && steps++ < 2000) {
        this.acc -= 1;
        if (this.auto && !g.riders.length) this.nextMove();
        this.handle(g.step());
        if (g.status !== 'playing') { this.auto = false; break; }
      }
      if (!g.riders.length) this.acc = Math.min(this.acc, 1);
      if (steps) this.emit();
    }
    this.render(Math.min(1, this.acc));
  }

  private nextMove(): void {
    const g = this.game!, plan = this.level?.solution?.plan;
    const m: Move | undefined = plan?.[this.planAt];
    if (!m) { this.auto = false; return; }
    this.planAt++;
    this.handle(m.kind === 'q' ? g.launchQueue(m.qs[0]!) : g.launchTray(m.i));
  }

  private handle(ev: GameEvent[]): void {
    const now = performance.now();
    for (const e of ev) if (e.type === 'shot') this.flashes.set(e.j, now);
  }

  private tap(e: PointerEvent): void {
    const g = this.game;
    if (!g || this.auto) return;
    const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = this.hits.find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    if (!hit) return;
    this.handle(hit.kind === 'queue' ? g.launchQueue(hit.q) : g.launchTray(hit.i));
    this.emit();
  }

  private emit(): void {
    const g = this.game, L = this.level;
    if (!g || !L) return;
    this.onState({ status: g.status, left: g.left, total: L.total, tray: g.tray.length, cap: g.trayCap, riders: g.riders.length, step: g.tick, plan: this.planAt, planLen: L.solution?.plan?.length ?? 0 });
  }

  // ---------------------------------------------------------------- drawing

  private render(frac: number): void {
    const game = this.game, L = this.level, W = this.W, bt = 22, gap = 4;
    // Fixed parts: margins and belt, dock counter, tray row, three rows of queue.
    const N = L?.w ?? 24, fixed = 14 + 2 * (bt + gap) + 30 + 58 + 22 + 140;
    const s = Math.max(4, Math.floor(Math.min((W - 2 * 14 - 2 * (bt + gap)) / N, (this.maxH - fixed) / N)));
    const H = this.H = L ? Math.min(this.maxH, fixed + s * N) : Math.min(this.maxH, 400);
    const gx = crisp(this.canvas, W, H);
    gx.fillStyle = '#1B1440'; gx.fillRect(0, 0, W, H);
    if (!game || !L) { label(gx, 'Generate or load a level to play', W / 2, H / 2, 18); return; }
    this.hits = [];
    const side = s * N, px0 = Math.round((W - side) / 2), py0 = 14 + bt + gap;

    // Belt ring with chevrons pointing the way round (counter-clockwise from the bottom-left dock).
    const bx = px0 - gap - bt, by = py0 - gap - bt, bw = side + 2 * (gap + bt);
    rrect(gx, bx, by, bw, bw, 18); gx.fillStyle = BELT; gx.fill(); gx.lineWidth = 3; gx.strokeStyle = INK; gx.stroke();
    rrect(gx, px0 - gap, py0 - gap, side + 2 * gap, side + 2 * gap, 8); gx.fillStyle = BOARD; gx.fill(); gx.stroke();

    // Pixels, with a white flash for 160 ms after being painted.
    const now = performance.now();
    for (let j = 0; j < game.px.length; j++) {
      const c = game.px[j]!, x = px0 + (j % N) * s, y = py0 + Math.floor(j / N) * s, t = this.flashes.get(j);
      if (c) cube(gx, c, x, y, s);
      else if (t !== undefined && now - t < 160) { gx.globalAlpha = 1 - (now - t) / 160; gx.fillStyle = '#fff'; gx.fillRect(x, y, s, s); gx.globalAlpha = 1; }
    }

    const B = beltOf(N, N), spot = (k: number): [number, number] => {
      const p = B[Math.max(0, Math.min(B.length - 1, k))]!, m = gap + bt / 2;
      return p.side === 0 ? [px0 + (p.i + 0.5) * s, py0 + side + m] : p.side === 1 ? [px0 + side + m, py0 + (p.i + 0.5) * s]
        : p.side === 2 ? [px0 + (p.i + 0.5) * s, py0 - m] : [px0 - m, py0 + (p.i + 0.5) * s];
    };
    gx.fillStyle = BELT_DARK;
    for (let k = 3; k < B.length; k += 6) { const [x, y] = spot(k); gx.beginPath(); gx.arc(x, y, 2, 0, Math.PI * 2); gx.fill(); }

    // Dock at the bottom-left corner, with its free-space counter.
    rrect(gx, bx - 6, py0 + side - 18, 16, 40, 6); gx.fillStyle = DOCK; gx.fill(); gx.lineWidth = 2.5; gx.strokeStyle = INK; gx.stroke();
    label(gx, `${game.beltFree}/${L.belt}`, bx + 18, by + bw + 14, 15);

    // Riders, sliding between spots with the step fraction.
    for (const r of game.riders) {
      if (r.s < 0) continue;
      const [x0, y0] = spot(r.s), [x1, y1] = spot(r.s + 1), f = r.s + 1 < B.length ? frac : 0;
      this.cat(gx, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 13, r.c, r.a, false, r.xray);
    }

    // Tray cushions (6th+ is the dashed gold extra cushion).
    const ty = by + bw + 30, n = Math.max(5, game.trayCap), ts = Math.min(58, Math.floor((W - 28 - (n - 1) * 8) / n)), tx0 = (W - (n * ts + (n - 1) * 8)) / 2;
    for (let i = 0; i < n; i++) {
      const x = tx0 + i * (ts + 8), open = i < game.trayCap;
      rrect(gx, x, ty, ts, ts, 12);
      gx.fillStyle = CUSHION; gx.fill();
      gx.setLineDash(i >= 5 ? [5, 4] : []); gx.lineWidth = 2.5; gx.strokeStyle = i >= 5 ? '#FFC93B' : open ? '#3A2D86' : '#5B1F3A'; gx.stroke(); gx.setLineDash([]);
      const t = game.tray[i];
      if (t) { this.cat(gx, x + ts / 2, ty + ts / 2 + 2, ts * 0.36, t.c, t.a, false); this.hits.push({ kind: 'tray', i, x, y: ty, w: ts, h: ts }); }
    }

    // Queues: front biggest, two more behind getting smaller and dimmer; ribbons tie linked pairs.
    const qy = ty + ts + 22, Q = game.queues.length, qw = Math.min(120, (W - 28) / Q), qx0 = (W - Q * qw) / 2;
    const at = (q: number, d: number): [number, number] => [qx0 + (q + 0.5) * qw, qy + 26 + d * 42 - d * d * 4];
    game.queues.forEach((queue, q) => queue.slice(0, 3).forEach((p, d) => { // ribbons first, cats on top
      const o = p.link !== undefined ? game.purrlet(p.link) : undefined;
      const od = o ? game.queues[o.q]?.indexOf(o) ?? -1 : -1;
      if (o && o.q > q && od >= 0 && od < 3) {
        const [x0, y0] = at(q, d), [x1, y1] = at(o.q, od);
        gx.strokeStyle = RIBBON; gx.lineWidth = 5; gx.lineCap = 'round'; gx.beginPath(); gx.moveTo(x0, y0 + 6); gx.lineTo(x1, y1 + 6); gx.stroke();
      }
    }));
    game.queues.forEach((queue, q) => {
      const blocked = game.status === 'playing' && !game.canLaunchQueue(q); // full belt, busy entry or partner not at the front
      for (let d = Math.min(2, queue.length - 1); d >= 0; d--) {
        const p = queue[d]!, [x, y] = at(q, d);
        gx.globalAlpha = (d === 0 ? 1 : d === 1 ? 0.75 : 0.5) * (d === 0 && blocked ? 0.55 : 1);
        this.cat(gx, x, y, d === 0 ? 22 : d === 1 ? 17 : 14, p.c, p.a, !game.isRevealed(p));
        gx.globalAlpha = 1;
      }
      if (queue.length > 3) label(gx, `+${queue.length - 3}`, at(q, 0)[0] + qw * 0.32, at(q, 0)[1] + 14, 12, '#BFAEE6');
      if (queue.length) { const [x, y] = at(q, 0); this.hits.push({ kind: 'queue', q, x: x - qw / 2, y: y - 30, w: qw, h: 140 }); }
    });

    if (game.status !== 'playing') {
      gx.fillStyle = 'rgba(20,14,48,.55)'; gx.fillRect(0, 0, W, H);
      label(gx, game.status === 'won' ? 'Purrfect!' : 'Tray full!', W / 2, py0 + side / 2, 44, game.status === 'won' ? '#FFD43B' : '#FF9AAE');
    }
  }

  /** A Purrlet: paint pot in its colour (grey with "?" while hidden) with a cream kitten peeking out. */
  private cat(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: number, a: number, hidden: boolean, xray = false): void {
    const p = PALETTE[c], pot = hidden || !p ? MYSTERY : p.hex, dark = hidden || !p ? '#4A4370' : p.dark;
    g.lineWidth = Math.max(1.5, r * 0.12); g.strokeStyle = INK; g.lineJoin = 'round';
    // ears + head
    g.fillStyle = CREAM;
    for (const k of [-1, 1]) { g.beginPath(); g.moveTo(x + k * r * 0.62, y - r * 0.55); g.lineTo(x + k * r * 0.5, y - r * 1.15); g.lineTo(x + k * r * 0.12, y - r * 0.8); g.closePath(); g.fill(); g.stroke(); }
    g.beginPath(); g.ellipse(x, y - r * 0.45, r * 0.7, r * 0.55, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = INK;
    for (const k of [-1, 1]) { g.beginPath(); g.arc(x + k * r * 0.27, y - r * 0.45, Math.max(1.2, r * 0.09), 0, Math.PI * 2); g.fill(); }
    // pot
    g.beginPath(); g.moveTo(x - r * 0.95, y - r * 0.08); g.lineTo(x + r * 0.95, y - r * 0.08); g.lineTo(x + r * 0.75, y + r * 0.95); g.lineTo(x - r * 0.75, y + r * 0.95); g.closePath();
    g.fillStyle = pot; g.fill(); g.stroke();
    g.fillStyle = dark; g.fillRect(x - r * 0.95, y - r * 0.08, r * 1.9, Math.max(2, r * 0.16));
    if (xray) { g.strokeStyle = '#5AA2FF'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r * 1.35, 0, Math.PI * 2); g.stroke(); }
    label(g, hidden ? '?' : String(a), x, y + r * 0.46, Math.max(10, r * 0.72));
  }
}
