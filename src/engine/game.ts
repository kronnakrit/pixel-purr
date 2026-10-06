// Real-time rules: the clock the renderer runs on. Each step() moves every rider one belt spot.
// Several Purrlets can ride at once (up to RULES.belt); the solver's one-at-a-time play is a special case.
// Boosters (Extra Cushion, Yarn Shuffle, Cat Nap, X-Ray Specs) never create or destroy paint.
import { beltOf, target, targetOfColor } from './belt';
import type { Level, Purrlet } from './level';
import type { Rng } from './rng';
import { RULES } from './rules';
import type { TrayPurrlet } from './state';

export interface BeltRider {
  id: number; c: number; a: number;
  /** Belt spot index. Negative = waiting at the entry (the second of a linked pair). */
  s: number;
  /** X-Ray Specs: sees through other colours and paints its colour anywhere in line, for this lap. */
  xray?: boolean;
}

export type GameEvent =
  | { type: 'launch'; ids: number[]; from: 'queue' | 'tray'; xray?: boolean }
  | { type: 'shot'; id: number; s: number; j: number }
  | { type: 'pop'; id: number }
  | { type: 'park'; id: number; a: number }
  | { type: 'reveal'; id: number }
  | { type: 'won' }
  | { type: 'lost' }
  /** Extra Cushion booster or the continue offer: the tray now has `cap` slots. */
  | { type: 'traySlots'; cap: number }
  /** Yarn Shuffle: waiting Purrlets were re-dealt. `order` lists each queue's Purrlet ids, front first. */
  | { type: 'shuffle'; order: number[][] }
  /** Cat Nap: tray Purrlets went back to the end of queue q. */
  | { type: 'napBack'; moves: { id: number; q: number }[] }
  /** X-Ray Specs armed: the next launched Purrlet gets x-ray for its lap. */
  | { type: 'xrayArmed' }
  /** The game left the lost state (continue). */
  | { type: 'resumed' };

export type GameStatus = 'playing' | 'won' | 'lost';

export class Game {
  readonly level: Level;
  readonly px: Uint8Array;
  /** Purrlets still waiting, per queue, front first. Boosters can reorder and append. */
  readonly queues: Purrlet[][];
  readonly tray: (TrayPurrlet & { id: number })[] = [];
  readonly riders: BeltRider[] = [];
  /** Tray slots available now (5, or more after Extra Cushion / continue). */
  trayCap: number;
  left: number;
  status: GameStatus = 'playing';
  tick = 0;
  /** X-Ray Specs armed for the next launch. */
  xrayArmed = false;
  private readonly spots;
  private readonly byId = new Map<number, Purrlet>();

  constructor(level: Level) {
    this.level = level;
    this.px = level.px.slice();
    this.queues = level.queues.map(q => q.map(p => ({ ...p })));
    for (const q of this.queues) for (const p of q) this.byId.set(p.id, p);
    this.trayCap = level.tray;
    this.left = level.total;
    this.spots = beltOf(level.w, level.h);
  }

  get beltLength(): number { return this.spots.length; }

  /** Front Purrlet of queue q, if any. */
  front(q: number): Purrlet | undefined { return this.queues[q]?.[0]; }

  /** Purrlet by id (queue Purrlets only; riders and tray entries carry their own colour and paint). */
  purrlet(id: number): Purrlet | undefined { return this.byId.get(id); }

  /** Queue index of a waiting Purrlet, or -1. */
  queueOf(id: number): number { return this.queues.findIndex(q => q.some(p => p.id === id)); }

  /** Mystery Purrlets show their colour only once they reach the front. */
  isRevealed(p: Purrlet): boolean { return !p.hidden || this.queues[p.q]?.[0] === p; }

  /** The queues a tap on queue q launches: [q], both queues of a linked pair, or null if it can't go now. */
  launchGroup(q: number): number[] | null {
    const s = this.front(q);
    if (!s) return null;
    if (s.link === undefined) return [q];
    const o = this.byId.get(s.link);
    if (!o || this.front(o.q) !== o) return null;
    return [Math.min(q, o.q), Math.max(q, o.q)];
  }

  /** Free spots on the belt (for the dock counter). */
  get beltFree(): number { return this.level.belt - this.riders.length; }

  /** The entry is clear when no rider sits within `gap` spots of it, and the belt has room for n more. */
  private hasRoom(n: number): boolean {
    return this.riders.length + n <= this.level.belt && this.riders.every(r => r.s >= RULES.gap);
  }

  canLaunchQueue(q: number): boolean {
    const g = this.status === 'playing' ? this.launchGroup(q) : null;
    return !!g && this.hasRoom(g.length);
  }

  launchQueue(q: number): GameEvent[] {
    if (!this.canLaunchQueue(q)) return [];
    const qs = this.launchGroup(q)!, ids: number[] = [], xray = this.takeXray();
    qs.forEach((qq, k) => {
      const p = this.queues[qq]!.shift()!;
      this.riders.push({ id: p.id, c: p.c, a: p.a, s: k === 0 ? 0 : -k * RULES.gap, ...(xray ? { xray } : {}) });
      ids.push(p.id);
    });
    this.renumber();
    const ev: GameEvent[] = [{ type: 'launch', ids, from: 'queue', ...(xray ? { xray } : {}) }];
    for (const qq of qs) { const f = this.front(qq); if (f?.hidden) ev.push({ type: 'reveal', id: f.id }); }
    return ev;
  }

  canLaunchTray(i: number): boolean { return this.status === 'playing' && i >= 0 && i < this.tray.length && this.hasRoom(1); }

  launchTray(i: number): GameEvent[] {
    if (!this.canLaunchTray(i)) return [];
    const [t] = this.tray.splice(i, 1), xray = this.takeXray();
    this.riders.push({ id: t!.id, c: t!.c, a: t!.a, s: 0, ...(xray ? { xray } : {}) });
    return [{ type: 'launch', ids: [t!.id], from: 'tray', ...(xray ? { xray } : {}) }];
  }

  private takeXray(): boolean { const x = this.xrayArmed; this.xrayArmed = false; return x; }

  /** Advance one belt spot: every rider on the belt fires (oldest first), then moves on.
   *  A rider pops when its paint runs out, or parks in the tray after a full lap. */
  step(): GameEvent[] {
    if (this.status !== 'playing' || !this.riders.length) return [];
    const ev: GameEvent[] = [], L = this.spots.length, { w, h } = this.level;
    for (const r of this.riders) {
      if (r.s < 0 || r.s >= L || r.a <= 0) continue;
      const spot = this.spots[r.s]!;
      const j = r.xray ? targetOfColor(this.px, w, h, spot, r.c) : target(this.px, w, h, spot);
      if (j >= 0 && this.px[j] === r.c) { this.px[j] = 0; r.a--; this.left--; ev.push({ type: 'shot', id: r.id, s: r.s, j }); }
    }
    this.tick++;
    for (let k = 0; k < this.riders.length; k++) {
      const r = this.riders[k]!;
      r.s++;
      if (r.a > 0 && r.s < L) continue;
      this.riders.splice(k--, 1);
      if (r.a === 0) ev.push({ type: 'pop', id: r.id });
      else { this.tray.push({ id: r.id, c: r.c, a: r.a }); ev.push({ type: 'park', id: r.id, a: r.a }); }
    }
    if (this.left === 0) { this.status = 'won'; ev.push({ type: 'won' }); }
    else if (this.tray.length > this.trayCap) { this.status = 'lost'; ev.push({ type: 'lost' }); }
    return ev;
  }

  /** Step until the belt is empty or the game ends. Returns all events. */
  settle(maxSteps = 100_000): GameEvent[] {
    const ev: GameEvent[] = [];
    for (let i = 0; i < maxSteps && this.status === 'playing' && this.riders.length; i++) ev.push(...this.step());
    return ev;
  }

  // ---------- boosters ----------

  /** Extra Cushion booster, or the "+1 cushion" continue after losing: one more tray slot for the rest of the level. */
  addTraySlot(): GameEvent[] {
    if (this.status === 'won') return [];
    this.trayCap++;
    const ev: GameEvent[] = [{ type: 'traySlots', cap: this.trayCap }];
    if (this.status === 'lost' && this.tray.length <= this.trayCap) { this.status = 'playing'; ev.push({ type: 'resumed' }); }
    return ev;
  }

  /** Yarn Shuffle: re-deal every waiting Purrlet into new places. Linked pairs stay where they are. */
  canShuffle(): boolean { return this.status === 'playing' && this.queues.some(q => q.some(p => p.link === undefined)); }

  shuffleQueues(r: Rng): GameEvent[] {
    if (!this.canShuffle()) return [];
    const free: Purrlet[] = [], slots: [number, number][] = [];
    this.queues.forEach((q, qi) => q.forEach((p, d) => { if (p.link === undefined) { free.push(p); slots.push([qi, d]); } }));
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [free[i], free[j]] = [free[j]!, free[i]!]; }
    slots.forEach(([qi, d], k) => { const p = free[k]!; p.q = qi; this.queues[qi]![d] = p; });
    this.renumber();
    const ev: GameEvent[] = [{ type: 'shuffle', order: this.queues.map(q => q.map(p => p.id)) }];
    for (const q of this.queues) if (q[0]?.hidden) ev.push({ type: 'reveal', id: q[0].id });
    return ev;
  }

  /** Cat Nap: every tray Purrlet goes back to the end of the shortest queue, emptying the tray. */
  canNap(): boolean { return this.status === 'playing' && this.tray.length > 0; }

  napTray(): GameEvent[] {
    if (!this.canNap()) return [];
    const moves: { id: number; q: number }[] = [];
    for (const t of this.tray.splice(0)) {
      let q = 0;
      this.queues.forEach((qq, i) => { if (qq.length < this.queues[q]!.length) q = i; });
      const p: Purrlet = { id: t.id, c: t.c, a: t.a, q, d: this.queues[q]!.length };
      this.queues[q]!.push(p);
      this.byId.set(p.id, p);
      moves.push({ id: t.id, q });
    }
    return [{ type: 'napBack', moves }];
  }

  /** X-Ray Specs: the next Purrlet launched sees through other colours for one lap. */
  canXray(): boolean { return this.status === 'playing' && !this.xrayArmed; }

  armXray(): GameEvent[] {
    if (!this.canXray()) return [];
    this.xrayArmed = true;
    return [{ type: 'xrayArmed' }];
  }

  private renumber() { this.queues.forEach((q, qi) => q.forEach((p, d) => { p.q = qi; p.d = d; })); }
}
