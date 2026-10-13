// Turn-based model used by the solver: one Purrlet (or linked pair) rides a full lap before the next tap.
// Playing one at a time is a subset of real play, so any plan found here also works in the real-time Game.
import { lap, type Rider, type ShotLog } from './belt';
import type { Level } from './level';

export interface TrayPurrlet { c: number; a: number; id?: number }
export interface State { px: Uint8Array; qi: number[]; tray: TrayPurrlet[]; left: number }
export interface Next extends State { shots: number; dead: boolean; won: boolean }
/** 'q': launch the front of queue(s) qs (two queues for a linked pair). 't': launch tray slot i. */
export type Move = { kind: 'q'; qs: number[] } | { kind: 't'; i: number };

export function start(L: Level): State {
  return { px: L.px.slice(), qi: L.queues.map(() => 0), tray: [], left: L.total };
}

export function movesOf(L: Level, st: State): Move[] {
  const M: Move[] = [];
  st.qi.forEach((d, q) => {
    const s = L.queues[q]![d];
    if (!s) return;
    if (s.link !== undefined) {
      const o = L.byId[s.link]!;
      if (o.q < q) return; // the pair is listed once, from its lower queue
      if (st.qi[o.q] !== o.d) return; // partner must be at the front too
      M.push({ kind: 'q', qs: [q, o.q] });
    } else M.push({ kind: 'q', qs: [q] });
  });
  st.tray.forEach((_, i) => M.push({ kind: 't', i }));
  return M;
}

export function apply(L: Level, st: State, m: Move, log?: ShotLog[]): Next {
  const px = st.px.slice(), qi = st.qi.slice(), tray = st.tray.map(t => ({ ...t }));
  let riders: Rider[];
  if (m.kind === 'q') riders = m.qs.map(q => { const s = L.queues[q]![qi[q]!]!; qi[q]!++; return { c: s.c, a: s.a, id: s.id }; });
  else { riders = [tray[m.i]!]; tray.splice(m.i, 1); }
  const shots = lap(px, L.w, L.h, riders, log);
  for (const rd of riders) if (rd.a > 0) tray.push(rd);
  const left = st.left - shots;
  return { px, qi, tray, left, shots, dead: tray.length > L.tray, won: left === 0 };
}

function fnv(px: Uint8Array): number {
  let h = 2166136261;
  for (let i = 0; i < px.length; i++) { h ^= px[i]!; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const keyOf = (st: State): string =>
  fnv(st.px) + '|' + st.qi.join(',') + '|' + st.tray.map(t => t.c + ':' + t.a).sort().join(',');
