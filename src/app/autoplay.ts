// Autopilot for debugging and automated review: plays one Purrlet (or linked pair) at a time, the way the solver's
// plans assume. It follows the level's stored solution while the game still matches it; when the game has drifted
// (manual taps, boosters, a continue) it re-plans from the current position, with each tray Purrlet as a one-cat
// queue and the tray shrunk by as many slots, which can only make the plan stricter than the real game.
import { apply, assemble, lap, solve, start, type Game, type Level, type Move, type Purrlet, type State } from '../engine';
import type { TapTarget } from './contracts';

const REPLAN_BUDGET = 6000;

export class Autopilot {
  private L: Level;
  private st: State;
  private plan: readonly Move[];
  private k = 0;

  constructor(private readonly game: Game) {
    this.L = game.level;
    this.st = start(this.L);
    this.plan = this.L.solution?.plan ?? [];
  }

  /** The next tap. Call only while the belt is empty. Null when nothing can be launched. */
  next(): TapTarget | null {
    if (!this.matches()) this.replan();
    const m = this.plan[this.k], t = m ? this.target(m) : null;
    if (!m || !t) return greedy(this.game);
    this.st = apply(this.L, this.st, m);
    this.k++;
    return t;
  }

  private target(m: Move): TapTarget | null {
    const g = this.game;
    let id: number | undefined;
    if (m.kind === 'q') {
      const q = m.qs[0]!;
      if (q < g.queues.length) return { kind: 'queue', q };
      id = this.L.queues[q]?.[this.st.qi[q]!]?.id; // a tray Purrlet planned as a one-cat queue
    } else id = this.st.tray[m.i]?.id;
    const i = g.tray.findIndex(t => t.id === id);
    return i >= 0 ? { kind: 'tray', i } : null;
  }

  /** Does the game still look exactly like the plan's model of it? */
  private matches(): boolean {
    const g = this.game, L = this.L, st = this.st;
    if (g.riders.length || g.px.length !== st.px.length || g.px.some((c, j) => c !== st.px[j])) return false;
    for (let q = 0; q < g.queues.length; q++) {
      const want = L.queues[q]?.slice(st.qi[q]) ?? [], have = g.queues[q]!;
      if (want.length !== have.length || want.some((p, d) => p.id !== have[d]!.id)) return false;
    }
    const want = st.tray.map(t => t.id);
    for (let q = g.queues.length; q < L.queues.length; q++) want.push(...L.queues[q]!.slice(st.qi[q]).map(p => p.id));
    const have = g.tray.map(t => t.id);
    return want.length === have.length && want.every(id => id !== undefined && have.includes(id));
  }

  private replan(): void {
    const g = this.game, Q: Purrlet[][] = g.queues.map(q => q.map(p => ({ ...p })));
    for (const t of g.tray) Q.push([{ id: t.id, c: t.c, a: t.a, q: Q.length, d: 0 }]);
    const L = assemble({ w: g.level.w, h: g.level.h, px: g.px.slice(), name: g.level.name }, Q, g.level.P);
    L.tray = Math.max(0, g.trayCap - g.tray.length);
    L.belt = g.level.belt;
    this.L = L;
    this.st = start(L);
    this.plan = solve(L, REPLAN_BUDGET).plan ?? [];
    this.k = 0;
  }
}

/** No plan: the launch that paints the most this lap without overflowing the tray. */
export function greedy(g: Game): TapTarget | null {
  const { w, h } = g.level;
  let best: TapTarget | null = null, score = -Infinity;
  const consider = (t: TapTarget, riders: { c: number; a: number }[], fromTray: number) => {
    const rs = riders.map(r => ({ ...r })), shots = lap(g.px.slice(), w, h, rs);
    const parked = rs.filter(r => r.a > 0).length, tray = g.tray.length - fromTray + parked;
    const s = (tray > g.trayCap ? -1e6 : 0) + shots * 4 - parked * 3;
    if (s > score) { score = s; best = t; }
  };
  g.queues.forEach((_, q) => {
    const grp = g.canLaunchQueue(q) ? g.launchGroup(q) : null;
    if (grp && grp[0] === q) consider({ kind: 'queue', q }, grp.map(qq => g.front(qq)!), 0);
  });
  g.tray.forEach((t, i) => { if (g.canLaunchTray(i)) consider({ kind: 'tray', i }, [t], 1); });
  return best;
}
