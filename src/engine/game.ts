// Real-time rules: the clock the renderer runs on. Each step() moves every rider one belt spot.
// Several Purrlets can ride at once (up to RULES.belt); the solver's one-at-a-time play is a special case.
import { beltOf, target } from './belt';
import type { Level, Purrlet } from './level';
import { RULES } from './rules';
import type { TrayPurrlet } from './state';

export interface BeltRider {
  id: number; c: number; a: number;
  /** Belt spot index. Negative = waiting at the entry (the second of a linked pair). */
  s: number;
}

export type GameEvent =
  | { type: 'launch'; ids: number[]; from: 'queue' | 'tray' }
  | { type: 'shot'; id: number; s: number; j: number }
  | { type: 'pop'; id: number }
  | { type: 'park'; id: number; a: number }
  | { type: 'reveal'; id: number }
  | { type: 'won' }
  | { type: 'lost' };

export type GameStatus = 'playing' | 'won' | 'lost';

export class Game {
  readonly level: Level;
  readonly px: Uint8Array;
  readonly qi: number[];
  readonly tray: (TrayPurrlet & { id: number })[] = [];
  readonly riders: BeltRider[] = [];
  left: number;
  status: GameStatus = 'playing';
  tick = 0;
  private readonly spots;

  constructor(level: Level) {
    this.level = level;
    this.px = level.px.slice();
    this.qi = level.queues.map(() => 0);
    this.left = level.total;
    this.spots = beltOf(level.w, level.h);
  }

  get beltLength(): number { return this.spots.length; }

  /** Front Purrlet of queue q, if any. */
  front(q: number): Purrlet | undefined { return this.level.queues[q]?.[this.qi[q]!]; }

  /** Mystery Purrlets show their colour only once they reach the front. */
  isRevealed(p: Purrlet): boolean { return !p.hidden || this.qi[p.q] === p.d; }

  /** The queues a tap on queue q launches: [q], both queues of a linked pair, or null if it can't go now. */
  launchGroup(q: number): number[] | null {
    const s = this.front(q);
    if (!s) return null;
    if (s.link === undefined) return [q];
    const o = this.level.byId[s.link]!;
    return this.qi[o.q] === o.d ? [Math.min(q, o.q), Math.max(q, o.q)] : null;
  }

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
    const qs = this.launchGroup(q)!, ids: number[] = [];
    qs.forEach((qq, k) => {
      const p = this.front(qq)!;
      this.qi[qq]!++;
      this.riders.push({ id: p.id, c: p.c, a: p.a, s: k === 0 ? 0 : -k * RULES.gap });
      ids.push(p.id);
    });
    const ev: GameEvent[] = [{ type: 'launch', ids, from: 'queue' }];
    for (const qq of qs) { const f = this.front(qq); if (f?.hidden) ev.push({ type: 'reveal', id: f.id }); }
    return ev;
  }

  canLaunchTray(i: number): boolean { return this.status === 'playing' && i >= 0 && i < this.tray.length && this.hasRoom(1); }

  launchTray(i: number): GameEvent[] {
    if (!this.canLaunchTray(i)) return [];
    const [t] = this.tray.splice(i, 1);
    this.riders.push({ id: t!.id, c: t!.c, a: t!.a, s: 0 });
    return [{ type: 'launch', ids: [t!.id], from: 'tray' }];
  }

  /** Advance one belt spot: every rider on the belt fires (oldest first), then moves on.
   *  A rider pops when its paint runs out, or parks in the tray after a full lap. */
  step(): GameEvent[] {
    if (this.status !== 'playing' || !this.riders.length) return [];
    const ev: GameEvent[] = [], L = this.spots.length, { w, h } = this.level;
    for (const r of this.riders) {
      if (r.s < 0 || r.s >= L || r.a <= 0) continue;
      const j = target(this.px, w, h, this.spots[r.s]!);
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
    else if (this.tray.length > this.level.tray) { this.status = 'lost'; ev.push({ type: 'lost' }); }
    return ev;
  }

  /** Step until the belt is empty or the game ends. Returns all events. */
  settle(maxSteps = 100_000): GameEvent[] {
    const ev: GameEvent[] = [];
    for (let i = 0; i < maxSteps && this.status === 'playing' && this.riders.length; i++) ev.push(...this.step());
    return ev;
  }
}
