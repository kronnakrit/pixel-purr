// Level generator: split each colour into Purrlets, deal them into queues, prove the level solvable, score it.
import { beltOf, target } from './belt';
import { assemble, INTRO, paramsFor, V1, V1_NEED, type Level, type LevelParams, type Purrlet } from './level';
import { C, COLOR_COUNT, PALETTE } from './palette';
import { countPixels, raster, type Picture } from './picture';
import { PICTURES } from './pictures';
import { hash, mulberry32, shuffle } from './rng';
import { RULES } from './rules';
import { needSlots, solve } from './solver';

/** Peel depth: the round in which each pixel first becomes visible from the belt if everything were cleared greedily. */
export function peelDepth(pic: Picture): { depth: Int16Array; rounds: number } {
  const { w, h } = pic, px = pic.px.slice(), depth = new Int16Array(w * h).fill(-1), B = beltOf(w, h);
  let left = countPixels(px), r = 0;
  while (left > 0) {
    const hit = new Set<number>();
    for (const p of B) { const j = target(px, w, h, p); if (j >= 0) hit.add(j); }
    for (const j of hit) { depth[j] = r; px[j] = 0; left--; }
    r++;
  }
  return { depth, rounds: r };
}

const roundTo = (v: number, m: number): number => Math.max(m, Math.round(v / m) * m);

/** Deal: split each colour into Purrlets (ammo 5..60) and order them into queues. Ammo per colour = its pixel count. */
export function deal(pic: Picture, P: LevelParams, seed: number): Purrlet[][] {
  const r = mulberry32(seed), { depth, rounds } = peelDepth(pic), N = pic.w * pic.h;
  const total = countPixels(pic.px);
  const unit = roundTo(total / P.shooters, total > 240 ? 10 : 5);
  const chunks: { c: number; a: number; key: number; k2: number }[] = [];
  for (let c = 1; c < PALETTE.length; c++) {
    const idx: number[] = [];
    for (let j = 0; j < N; j++) if (pic.px[j] === c) idx.push(j);
    if (!idx.length) continue;
    idx.sort((a, b) => depth[a]! - depth[b]!);
    let i = 0;
    while (i < idx.length) {
      const rem = idx.length - i;
      let s = Math.min(60, roundTo(unit * [0.5, 1, 1, 1.5, 2][Math.floor(r() * 5)]!, 5)); // ammo stays 5..60
      if (rem - s < unit * 0.5 && rem <= 60) s = rem; // fold a small remainder in, never above 60
      const part = idx.slice(i, i + s);
      i += s;
      chunks.push({ c, a: part.length, key: part.reduce((a, j) => a + depth[j]!, 0) / part.length, k2: 0 });
    }
  }
  // Disorder: 0 = ideal peel order, 1 = fully reversed (deepest colours first); plus a little noise.
  const mx = Math.max(...chunks.map(ch => ch.key));
  for (const ch of chunks) ch.k2 = ch.key * (1 - P.disorder) + (mx - ch.key) * P.disorder + (r() * 2 - 1) * rounds * 0.12;
  chunks.sort((a, b) => a.k2 - b.k2);
  const Q: Purrlet[][] = Array.from({ length: P.queues }, () => []);
  chunks.forEach((ch, i) => {
    const q = r() < P.disorder * 0.5 ? Math.floor(r() * P.queues) : i % P.queues;
    Q[q]!.push({ c: ch.c, a: ch.a, id: 0, q: 0, d: 0 });
  });
  // Rebalance so no queue is more than 2 longer than another.
  for (let guard = 0; guard < 50; guard++) {
    const lens = Q.map(q => q.length), hi = lens.indexOf(Math.max(...lens)), lo = lens.indexOf(Math.min(...lens));
    if (lens[hi]! - lens[lo]! <= 2) break;
    Q[lo]!.push(Q[hi]!.pop()!);
  }
  let id = 0;
  Q.forEach((q, qi) => q.forEach((s, d) => { s.id = id++; s.q = qi; s.d = d; }));
  // Mystery Purrlets: never the front of a queue.
  for (const q of Q) for (let d = 1; d < q.length; d++) if (r() < P.hidden) q[d]!.hidden = true;
  // Linked pairs: same depth in neighbouring queues.
  let made = 0;
  for (let tries = 0; tries < 40 && made < P.links; tries++) {
    const q = Math.floor(r() * (P.queues - 1)), d = 1 + Math.floor(r() * 4);
    const a = Q[q]![d], b = Q[q + 1]![d];
    if (a && b && a.link === undefined && b.link === undefined) { a.link = b.id; b.link = a.id; made++; }
  }
  return Q;
}

export function finish(L: Level): Level { L.solution = solve(L); return L; }

/** Build one level: deal → prove solvable → score → adapt disorder and reroll until "slots needed" sits in the band. */
export function build(pic: Picture, P: LevelParams, seed: number, maxTries = 16): Level {
  let best: Level | null = null, dis = P.disorder;
  for (let t = 0; t < maxTries; t++) {
    const s = hash(seed * 131 + t);
    const L = assemble(pic, deal(pic, { ...P, disorder: dis }, s), P);
    const need = needSlots(L);
    if (need > RULES.tray) { dis *= 0.8; continue; }
    const miss = need < P.need[0] ? P.need[0] - need : need > P.need[1] ? need - P.need[1] : 0;
    const cand: Level = { ...L, seed: s, disorder: dis, need, miss, tries: t + 1 };
    if (!best || miss < best.miss!) best = cand;
    if (miss === 0) break;
    dis = need < P.need[0] ? Math.min(1, dis + 0.12) : Math.max(0, dis - 0.12);
  }
  if (!best) throw new Error(`no solvable deal for "${pic.name}" after ${maxTries} tries`);
  return finish(best);
}

/** Level n (1-based). 1-20 replay the tuned table; 21+ are endless, generated from a hash of n. */
export function level(n: number): Level {
  if (!Number.isInteger(n) || n < 1) throw new Error(`bad level number ${n}`);
  const P = paramsFor(n);
  if (n <= V1.length) {
    const pic = raster(PICTURES[n - 1]!, P.size), [seed, dis] = V1[n - 1]!;
    const L = assemble(pic, deal(pic, { ...P, disorder: dis }, seed), P);
    return finish(Object.assign(L, { seed, disorder: dis, need: V1_NEED[n - 1]!, intro: INTRO[n] ?? null }));
  }
  // Endless: picture from a seed (procedural charm or recoloured library picture), then the full build loop.
  const h = hash(n);
  const pic = h % 3 === 0 ? sprite(h, P.size) : recolor(raster(PICTURES[h % PICTURES.length]!, P.size), h);
  return build(pic, P, h);
}

const ALL_COLORS = Array.from({ length: COLOR_COUNT }, (_, i) => i + 1);

/** A mirrored "charm" sprite from a seed: concentric colour bands with a few random holes. */
export function sprite(seed: number, N: number): Picture {
  const r = mulberry32(seed), px = new Uint8Array(N * N), cols = shuffle(ALL_COLORS, r).slice(0, 3 + Math.floor(r() * 3));
  const half = Math.ceil(N / 2), cx = (N - 1) / 2, cy = (N - 1) / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < half; x++) {
    const d = Math.hypot((x - cx) / N, (y - cy) / N);
    if (d > 0.46) continue;
    const band = Math.floor(((d + r() * 0.08) / 0.46) * cols.length);
    const keep = d < 0.18 || r() > 0.12;
    if (keep) { px[y * N + x] = cols[Math.min(cols.length - 1, band)]!; px[y * N + (N - 1 - x)] = px[y * N + x]!; }
  }
  return { w: N, h: N, px, name: 'Charm #' + (seed % 10000) };
}

/** Swap a picture's colours for others (milk and licorice stay, they read as white and outline). */
export function recolor(pic: Picture, seed: number): Picture {
  const r = mulberry32(seed), used = [...new Set(Array.from(pic.px).filter(Boolean))], pool = shuffle(ALL_COLORS, r);
  const map: Record<number, number> = {};
  used.forEach((c, i) => { map[c] = c === C.licorice || c === C.milk ? c : pool[i]!; });
  return { ...pic, px: pic.px.map(c => (c ? map[c]! : 0)), name: pic.name + ' (remix)' };
}

// ---------- pictures from any image (RGBA pixels), for the level editor ----------
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

function nearest(r: number, g: number, b: number): number {
  let best = 1, bd = 1e9;
  for (let c = 1; c < PALETTE.length; c++) {
    const [R, G, B] = rgb(PALETTE[c]!.hex), rm = (r + R) / 2;
    const d = (2 + rm / 256) * (r - R) ** 2 + 4 * (g - G) ** 2 + (2 + (255 - rm) / 256) * (b - B) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** data: RGBA of an image already scaled to N×N. K = max colours kept. */
export function fromRGBA(data: ArrayLike<number>, N: number, K = 6, name = 'Your picture'): Picture {
  const px = new Uint8Array(N * N), freq: Record<number, number> = {};
  for (let j = 0; j < N * N; j++) {
    if (data[j * 4 + 3]! < 128) continue;
    const c = nearest(data[j * 4]!, data[j * 4 + 1]!, data[j * 4 + 2]!);
    px[j] = c; freq[c] = (freq[c] ?? 0) + 1;
  }
  const keep = Object.keys(freq).map(Number).sort((a, b) => freq[b]! - freq[a]!).slice(0, K);
  const remap = (c: number): number => {
    if (keep.includes(c)) return c;
    const [r, g, b] = rgb(PALETTE[c]!.hex);
    let best = keep[0]!, bd = 1e9;
    for (const k of keep) { const [R, G, B] = rgb(PALETTE[k]!.hex), d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (d < bd) { bd = d; best = k; } }
    return best;
  };
  for (let j = 0; j < N * N; j++) if (px[j]) px[j] = remap(px[j]!);
  return { w: N, h: N, px, name };
}
