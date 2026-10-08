import { C, type PaintKey } from './palette';

/** A pixel picture. px holds a colour index per pixel (0 = empty), row-major, y down. */
export interface Picture { w: number; h: number; px: Uint8Array; name: string }

/** Shape test in a 0..1 unit square. */
export type Shape = (u: number, v: number) => boolean;

export const S = {
  circ: (cx: number, cy: number, r: number): Shape => (u, v) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r,
  ell: (cx: number, cy: number, rx: number, ry: number): Shape => (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1,
  rect: (x0: number, y0: number, x1: number, y1: number): Shape => (u, v) => u >= x0 && u <= x1 && v >= y0 && v <= y1,
  rrect: (x0: number, y0: number, x1: number, y1: number, r: number): Shape => (u, v) => {
    if (u < x0 || u > x1 || v < y0 || v > y1) return false;
    const dx = Math.max(x0 + r - u, 0, u - (x1 - r)), dy = Math.max(y0 + r - v, 0, v - (y1 - r));
    return dx * dx + dy * dy <= r * r;
  },
  poly: (pts: readonly (readonly [number, number])[]): Shape => (u, v) => {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
      if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  },
  line: (x0: number, y0: number, x1: number, y1: number, w: number): Shape => (u, v) => {
    const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((u - x0) * dx + (v - y0) * dy) / (dx * dx + dy * dy)));
    return (u - x0 - t * dx) ** 2 + (v - y0 - t * dy) ** 2 <= (w * w) / 4;
  },
  heart: (cx: number, cy: number, s: number): Shape => (u, v) => {
    const x = (u - cx) / s, y = -(v - cy) / s;
    return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0;
  },
  star: (cx: number, cy: number, r: number): Shape => (u, v) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    return S.poly(pts)(u, v);
  },
  and: (...f: Shape[]): Shape => (u, v) => f.every(g => g(u, v)),
  or: (...f: Shape[]): Shape => (u, v) => f.some(g => g(u, v)),
  not: (f: Shape): Shape => (u, v) => !f(u, v),
  all: (): Shape => () => true,
};
export type Shapes = typeof S;

/** A layer paints a shape in one colour; later layers paint over earlier ones. 0 erases. */
export type Layer = readonly [Shape, PaintKey | 0];
export interface PictureDef { name: string; layers: (s: Shapes) => Layer[]; outline?: PaintKey }

export function raster(def: PictureDef, N: number): Picture {
  const px = new Uint8Array(N * N);
  for (const [shape, col] of def.layers(S)) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N, v = (y + 0.5) / N;
      if (shape(u, v)) px[y * N + x] = col === 0 ? 0 : C[col];
    }
  }
  if (def.outline) { // ring of one colour around everything drawn (4-neighbour)
    const o = C[def.outline], src = px.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (src[y * N + x]) continue;
      if ((x > 0 && src[y * N + x - 1]) || (x < N - 1 && src[y * N + x + 1]) || (y > 0 && src[(y - 1) * N + x]) || (y < N - 1 && src[(y + 1) * N + x])) px[y * N + x] = o;
    }
  }
  return { w: N, h: N, px, name: def.name };
}

export const countPixels = (px: Uint8Array): number => px.reduce((a, b) => a + (b ? 1 : 0), 0);
export const colorsOf = (px: Uint8Array): number[] => [...new Set(Array.from(px).filter(Boolean))];
