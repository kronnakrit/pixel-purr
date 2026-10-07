// Pure layout maths for the interface (unit-tested in test/ui). No DOM here.
import type { Point } from '../app/contracts';

export interface MapLayout { pts: Point[]; height: number; amp: number }

/**
 * Winding level path. levels[0] sits at the bottom, the last one at the top. Each node's x sways on a sine of its
 * level number, so a level keeps its place on the path as the player advances. On narrow phones the path moves right
 * so no node passes under the Daily gift button (`left` is the smallest node centre x that clears it).
 */
export function mapLayout(levels: readonly number[], width: number, o: { spacing?: number; pad?: number; left?: number } = {}): MapLayout {
  const spacing = o.spacing ?? 92, pad = o.pad ?? 72, left = o.left ?? 108;
  const amp = Math.max(0, Math.min(96, width / 2 - 76));
  const shift = Math.max(0, Math.min(left - (width / 2 - amp), width / 2 - amp - 46));
  const height = pad * 2 + Math.max(0, levels.length - 1) * spacing;
  const pts = levels.map((n, i) => ({ x: Math.round(width / 2 + shift + Math.sin(n * 1.1) * amp), y: height - pad - i * spacing }));
  return { pts, height, amp };
}

/** SVG path through the nodes, bowed into gentle S-curves between neighbours. */
export function mapPath(pts: readonly Point[]): string {
  if (!pts.length) return '';
  let d = `M${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, my = (a.y + b.y) / 2;
    d += ` C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
  }
  return d;
}

/** Scale that fits a box of natural size into the space available (never enlarges, never below min). */
export function fitScale(nat: { w: number; h: number }, avail: { w: number; h: number }, min = 0.55): number {
  if (nat.w <= 0 || nat.h <= 0) return 1;
  return Math.max(min, Math.min(1, avail.w / nat.w, avail.h / nat.h));
}

/** Points along a quadratic arc (for flying coins): from → up and over → to. */
export function arcPoints(from: Point, to: Point, steps: number, lift = 120): Point[] {
  const c = { x: (from.x + to.x) / 2 + (from.x - to.x) * 0.25, y: Math.min(from.y, to.y) - lift };
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push({ x: u * u * from.x + 2 * u * t * c.x + t * t * to.x, y: u * u * from.y + 2 * u * t * c.y + t * t * to.y });
  }
  return out;
}

/** Day tile to highlight in the 7-day streak row (day 7 repeats once the streak passes a week). */
export const streakIndex = (day: number): number => Math.min(7, Math.max(1, Math.floor(day))) - 1;
