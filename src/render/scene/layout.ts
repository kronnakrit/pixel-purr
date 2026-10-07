// Screen layout of the play field in CSS px, from the canvas size and the HUD insets. Pure: no DOM, no three.
// Top to bottom inside the insets: belt block (board + belt, square) → dock counter → tray row → queue area.
// The scene draws everything at these CSS positions, so hit tests and screenPoint() need no ray casting.
import { beltOf } from '../../engine';
import type { TapTarget } from '../../app/contracts';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Insets { top: number; bottom: number; left: number; right: number }
export interface Pt { x: number; y: number }

/** Belt proportions as fractions of the block side (the design page's track(): a 368 px block around a 300 px board). */
export const BELT = {
  outerR: 0.114,    // outer corner radius
  laneBorder: 0.026, // dark line where the lane starts
  laneFill: 0.033,  // lane surface starts
  rim: 0.076,       // inner lavender rim starts
  panel: 0.092,     // dark board panel starts
  panelR: 0.046,
  lane: 0.055,      // lane centre line (where riders stand), from the outer edge
  laneHalf: 0.02,
  grid: 0.11,       // pixel grid starts (panel + padding)
} as const;

/** Vertical budget, as fractions of the column width. */
const F = { block: 0.91, counter: 0.07, tray: 0.2, queue: 0.48, queueMin: 0.34 } as const;
/** Front cats' ears may reach this far (× column) up into the tray row's bottom padding. */
const EARS = 0.04;

export const MAX_COL = 560;
const SIDE_PAD = 8, END_PAD = 6;
/** The column is this many world units wide, so cats keep their proportions on every screen. */
export const COL_UNITS = 10;
/** Apparent height / width of a Purrlet on screen, ears included (model ~1.1 tall, leaning back to the camera). */
export const CAT_H = 1.3;

export interface Layout {
  W: number; H: number;
  col: Rect;
  /** CSS px per world unit. */
  unit: number;
  block: Rect;
  /** Lane centre lines and their corner radius. */
  lane: { l: number; r: number; t: number; b: number; rc: number };
  /** Square area the pixel grid is fitted into. */
  grid: Rect;
  dock: Rect;
  counter: Pt & { size: number };
  riderW: number;
  /** Tray row band (cushions are laid out by trayLayout). */
  tray: Rect;
  /** Queue area: front cats' tops at queue.y. */
  queue: Rect;
  frontW: number;
  rowGap: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function computeLayout(W: number, H: number, ins: Insets): Layout {
  const ax = ins.left + SIDE_PAD, aw = Math.max(1, W - ins.left - ins.right - 2 * SIDE_PAD);
  const ay = ins.top + END_PAD, ah = Math.max(1, H - ins.top - ins.bottom - 2 * END_PAD);
  const fixed = F.block + F.counter + F.tray;
  const cw = Math.max(100, Math.min(aw, MAX_COL, ah / (fixed + F.queueMin)));
  const qh = clamp(ah - fixed * cw, F.queueMin * cw, F.queue * cw);
  const slack = Math.max(0, ah - fixed * cw - qh);
  const col: Rect = { x: ax + (aw - cw) / 2, y: ay, w: cw, h: ah };
  const cx = col.x + cw / 2;

  let y = ay + slack * 0.4;
  const B = F.block * cw;
  const block: Rect = { x: cx - B / 2, y, w: B, h: B };
  const o = BELT.lane * B, rc = (BELT.outerR - BELT.lane) * B;
  const lane = { l: block.x + o, r: block.x + B - o, t: y + o, b: y + B - o, rc };
  const g = BELT.grid * B, grid: Rect = { x: block.x + g, y: y + g, w: B - 2 * g, h: B - 2 * g };
  const dock: Rect = { x: block.x + 0.018 * B - 0.042 * B, y: y + 0.79 * B, w: 0.084 * B, h: 0.165 * B };
  y += B;
  const counter = { x: dock.x + dock.w / 2, y: y + 0.42 * F.counter * cw, size: 0.058 * B };
  y += F.counter * cw;
  const tray: Rect = { x: col.x, y, w: cw, h: F.tray * cw };
  y += F.tray * cw + slack * 0.25;
  const frontW = 0.162 * cw;
  const queue: Rect = { x: col.x, y: y - EARS * cw, w: cw, h: qh + EARS * cw };
  const rowGap = clamp((queue.h - frontW * CAT_H) / 2, 0.06 * cw, 0.135 * cw);
  return { W, H, col, unit: cw / COL_UNITS, block, lane, grid, dock, counter, riderW: 0.112 * B, tray, queue, frontW, rowGap };
}

// ---------------------------------------------------------------- board grid

export interface Grid { x0: number; y0: number; cell: number; w: number; h: number }

/** The w×h pixel grid centred in the layout's grid square. */
export function gridFor(L: Layout, w: number, h: number): Grid {
  const cell = L.grid.w / Math.max(w, h, 1);
  return { x0: L.grid.x + (L.grid.w - w * cell) / 2, y0: L.grid.y + (L.grid.h - h * cell) / 2, cell, w, h };
}

/** CSS centre of pixel j. */
export function cellCentre(G: Grid, j: number, out: Pt): Pt {
  out.x = G.x0 + ((j % G.w) + 0.5) * G.cell;
  out.y = G.y0 + (Math.floor(j / G.w) + 0.5) * G.cell;
  return out;
}

// ---------------------------------------------------------------- belt lane path

/** The lane centre line: a rounded rectangle walked counter-clockwise on screen (bottom → right → top → left),
 *  starting where the bottom edge leaves the bottom-left corner. Arc length t is in CSS px. */
export class LanePath {
  l = 0; r = 1; t = 0; b = 1; rc = 0;
  private sx = 1; private sy = 1; private arc = 0;
  perimeter = 4;

  set(lane: Layout['lane']): this {
    Object.assign(this, { l: lane.l, r: lane.r, t: lane.t, b: lane.b, rc: lane.rc });
    this.sx = Math.max(0, lane.r - lane.l - 2 * lane.rc);
    this.sy = Math.max(0, lane.b - lane.t - 2 * lane.rc);
    this.arc = (Math.PI / 2) * lane.rc;
    this.perimeter = 2 * this.sx + 2 * this.sy + 4 * this.arc;
    return this;
  }

  /** Start of each side's straight run along the path. */
  sideStart(side: 0 | 1 | 2 | 3): number {
    const { sx, sy, arc } = this;
    return side === 0 ? 0 : side === 1 ? sx + arc : side === 2 ? sx + sy + 2 * arc : 2 * sx + sy + 3 * arc;
  }

  point(t: number, out: Pt): Pt {
    const { l, r, t: tp, b, rc, sx, sy, arc } = this, P = this.perimeter;
    let u = ((t % P) + P) % P;
    if (u < sx) { out.x = l + rc + u; out.y = b; return out; }
    u -= sx;
    if (u < arc) return this.corner(r - rc, b - rc, Math.PI / 2 - u / rc, out);
    u -= arc;
    if (u < sy) { out.x = r; out.y = b - rc - u; return out; }
    u -= sy;
    if (u < arc) return this.corner(r - rc, tp + rc, -u / rc, out);
    u -= arc;
    if (u < sx) { out.x = r - rc - u; out.y = tp; return out; }
    u -= sx;
    if (u < arc) return this.corner(l + rc, tp + rc, -Math.PI / 2 - u / rc, out);
    u -= arc;
    if (u < sy) { out.x = l; out.y = tp + rc + u; return out; }
    u -= sy;
    return this.corner(l + rc, b - rc, Math.PI - u / rc, out);
  }

  private corner(cx: number, cy: number, a: number, out: Pt): Pt {
    out.x = cx + this.rc * Math.cos(a); out.y = cy + this.rc * Math.sin(a);
    return out;
  }
}

/** Arc length of every belt spot (engine order, see beltOf), plus one extra entry: spot L = spot 0 one lap later.
 *  Each spot sits on the lane level with its pixel row or column. */
export function spotArcs(path: LanePath, G: Grid): Float64Array {
  const spots = beltOf(G.w, G.h), L = spots.length, out = new Float64Array(L + 1);
  const { l, r, t, b, rc } = path;
  spots.forEach((s, k) => {
    const x = G.x0 + (s.i + 0.5) * G.cell, y = G.y0 + (s.i + 0.5) * G.cell;
    out[k] = path.sideStart(s.side) + (s.side === 0 ? x - (l + rc) : s.side === 1 ? b - rc - y : s.side === 2 ? r - rc - x : y - (t + rc));
  });
  out[L] = out[0]! + path.perimeter;
  return out;
}

/** Arc length of a rider at belt spot s, frac of the way to s + 1. Negative s waits behind the entry (by the dock). */
export function riderArc(arcs: Float64Array, s: number, frac: number, cell: number): number {
  const L = arcs.length - 1;
  if (s < 0) return arcs[0]! + Math.min(0, s + frac) * cell;
  if (s >= L) return arcs[L]!;
  return arcs[s]! + frac * (arcs[s + 1]! - arcs[s]!);
}

// ---------------------------------------------------------------- tray and queues

export interface TrayLayout { panel: Rect; cs: number; xs: number[]; cy: number; catW: number; catY: number }

/** n cushions (5, or more after Extra Cushion) centred in the tray row. Index n (the overflow when lost) sits past the end. */
export function trayLayout(L: Layout, n: number): TrayLayout {
  const cw = L.col.w, gap = 0.018 * cw, pad = 0.022 * cw;
  const cs = Math.min(0.152 * cw, (0.94 * cw - 2 * pad - (n - 1) * gap) / n);
  const pw = n * cs + (n - 1) * gap + 2 * pad, ph = cs + 2 * pad;
  const cx = L.col.x + cw / 2, cy = L.tray.y + L.tray.h / 2;
  const panel: Rect = { x: cx - pw / 2, y: cy - ph / 2, w: pw, h: ph };
  const xs = Array.from({ length: n + 1 }, (_, i) => Math.min(L.W - cs / 2, panel.x + pad + cs / 2 + i * (cs + gap)));
  return { panel, cs, xs, cy, catW: cs * 0.86, catY: cy + cs * 0.4 };
}

/** Centre x of each queue column. */
export function queueXs(L: Layout, nq: number): number[] {
  const pitch = queuePitch(L, nq), cx = L.col.x + L.col.w / 2;
  return Array.from({ length: nq }, (_, i) => cx + (i - (nq - 1) / 2) * pitch);
}
export const queuePitch = (L: Layout, nq: number): number => Math.min(0.2 * L.col.w, (0.88 * L.col.w) / Math.max(1, nq));

/** Width of the cat at depth d (front biggest; only 0..2 are shown, 3 is the slot new cats grow from). */
export const queueCatW = (L: Layout, d: number): number => L.frontW * (1 - 0.1 * Math.min(d, 3));
/** Bottom (anchor) y of the cat at depth d. */
export const queueCatY = (L: Layout, d: number): number => L.queue.y + L.frontW * CAT_H + d * L.rowGap;
/** How much the cat at depth d fades into the stage (0 = full colour). */
export const queueDim = (d: number): number => Math.min(0.6, 0.22 * d);
export const QUEUE_SHOWN = 3;

// ---------------------------------------------------------------- input

/** What a tap at (x, y) hits: a tray cushion holding a cat, or anywhere on a queue column with cats. */
export function hitTest(L: Layout, x: number, y: number, queueLens: readonly number[], trayN: number, cushions: number): TapTarget | null {
  const T = trayLayout(L, cushions);
  const inTray = trayN > 0 && y >= T.panel.y - 0.2 * T.cs && y <= T.panel.y + T.panel.h + 0.1 * T.cs;
  const tray = (): TapTarget | null => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < Math.min(trayN, T.xs.length); i++) { const d = Math.abs(x - T.xs[i]!); if (d < bd) { bd = d; best = i; } }
    return best >= 0 && bd <= T.cs * 0.6 ? { kind: 'tray', i: best } : null;
  };
  // Below the tray panel, the queue cats' ears come first: on short phones the two areas overlap there.
  if (inTray && y <= T.panel.y + T.panel.h) return tray();
  const qTop = L.queue.y - 0.04 * L.col.w, qBot = Math.max(L.queue.y + L.queue.h, queueCatY(L, 2)) + 0.04 * L.col.w;
  if (y >= qTop && y <= qBot) {
    const xs = queueXs(L, queueLens.length), half = queuePitch(L, queueLens.length) / 2;
    for (let q = 0; q < xs.length; q++) if (Math.abs(x - xs[q]!) <= half && (queueLens[q] ?? 0) > 0) return { kind: 'queue', q };
  }
  return inTray ? tray() : null;
}

// ---------------------------------------------------------------- win

/** The n most common colours of a picture, most common first (repeated when it has fewer), for the dancers. */
export function topColors(px: Uint8Array, n: number): number[] {
  const count = new Map<number, number>();
  for (const c of px) if (c) count.set(c, (count.get(c) ?? 0) + 1);
  const cols = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(e => e[0]);
  return cols.length ? Array.from({ length: n }, (_, i) => cols[i % cols.length]!) : [];
}
