import type { Level } from './level';
import { mulberry32, type Rng } from './rng';
import { RULES } from './rules';
import { apply, keyOf, movesOf, start, type Move, type Next, type State } from './state';

export interface SolveResult { ok: boolean; plan: Move[] | null; nodes: number; exhausted: boolean; peakTray: number }

/** Budgeted DFS, best-first ordering. Any plan found is a proof the level can be cleared. */
export function solve(L: Level, budget = 4000): SolveResult {
  const seen = new Set<string>();
  let nodes = 0, peak = 0;
  function dfs(st: State & { won?: boolean }, path: Move[]): Move[] | null {
    if (st.won) return path;
    if (++nodes > budget) return null;
    const k = keyOf(st);
    if (seen.has(k)) return null;
    seen.add(k);
    const cands: [Move, Next][] = [];
    for (const m of movesOf(L, st)) {
      const nx = apply(L, st, m);
      if (nx.dead) continue;
      if (m.kind === 't' && nx.shots === 0) continue; // pointless
      cands.push([m, nx]);
    }
    cands.sort((a, b) => b[1].shots - a[1].shots || a[1].tray.length - b[1].tray.length);
    for (const [m, nx] of cands) { const r = dfs(nx, path.concat([m])); if (r) return r; }
    return null;
  }
  const plan = dfs(start(L), []);
  if (plan) { let st: State = start(L); for (const m of plan) { st = apply(L, st, m); peak = Math.max(peak, st.tray.length); } }
  return { ok: !!plan, plan, nodes, exhausted: nodes > budget, peakTray: peak };
}

/** Fewest tray slots a perfect player needs (0-5), or 99. 5 - need = how many careless parks the level forgives. */
export function needSlots(L: Level, budget = 3000): number {
  for (let k = 0; k <= RULES.tray; k++) if (solve({ ...L, tray: k }, budget).ok) return k;
  return 99;
}

/** A naive player: mostly taps queue fronts at random, sometimes a tray Purrlet that will paint something. */
export function playout(L: Level, r: Rng): { win: boolean; moves: number } {
  let st: State & { won?: boolean } = start(L), moves = 0;
  while (!st.won) {
    const cur: State = st;
    const ms: [Move, Next][] = movesOf(L, cur).map((m): [Move, Next] => [m, apply(L, cur, m)]).filter(([m, nx]) => !nx.dead && !(m.kind === 't' && nx.shots === 0));
    if (!ms.length) return { win: false, moves };
    const fresh = ms.filter(([m]) => m.kind === 'q'), pool = fresh.length && r() < 0.7 ? fresh : ms;
    st = pool[Math.floor(r() * pool.length)]![1];
    moves++;
  }
  return { win: true, moves };
}

/** Share of naive playouts that fail. */
export function measure(L: Level, seed: number, runs = 40): number {
  const r = mulberry32(seed ^ 0xabcd);
  let fails = 0;
  for (let i = 0; i < runs; i++) if (!playout(L, r).win) fails++;
  return fails / runs;
}
