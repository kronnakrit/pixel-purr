// Level save format: what the app ships for levels 1-20, caches for generated levels, and the editor exports.
import { assemble, paramsFor, type Level, type Purrlet } from './level';

export interface LevelFileV1 {
  v: 1;
  n: number;
  name: string;
  w: number;
  h: number;
  /** One base-36 character per pixel (colour index, 0 = empty), row-major. */
  picture: string;
  queues: { c: number; a: number; hidden?: true; link?: number }[][];
  seed: number;
  disorder?: number;
  need?: number;
}

export function toFile(n: number, L: Level): LevelFileV1 {
  return {
    v: 1, n, name: L.name, w: L.w, h: L.h,
    picture: Array.from(L.px, c => c.toString(36)).join(''),
    queues: L.queues.map(q => q.map(s => ({ c: s.c, a: s.a, ...(s.hidden ? { hidden: true as const } : {}), ...(s.link !== undefined ? { link: s.link } : {}) }))),
    seed: L.seed ?? 0,
    ...(L.disorder !== undefined ? { disorder: L.disorder } : {}),
    ...(L.need !== undefined ? { need: L.need } : {}),
  };
}

export function fromFile(f: LevelFileV1): Level {
  if (f.v !== 1) throw new Error(`unknown level file version ${String(f.v)}`);
  if (f.picture.length !== f.w * f.h) throw new Error(`picture is ${f.picture.length} pixels, expected ${f.w * f.h}`);
  const px = Uint8Array.from(f.picture, ch => parseInt(ch, 36));
  let id = 0;
  const Q: Purrlet[][] = f.queues.map((q, qi) => q.map((s, d) => ({ id: id++, q: qi, d, c: s.c, a: s.a, ...(s.hidden ? { hidden: true } : {}), ...(s.link !== undefined ? { link: s.link } : {}) })));
  const L = assemble({ w: f.w, h: f.h, px, name: f.name }, Q, paramsFor(f.n));
  L.seed = f.seed;
  if (f.disorder !== undefined) L.disorder = f.disorder;
  if (f.need !== undefined) L.need = f.need;
  validate(L);
  return L;
}

/** Throws if the level breaks a rule the game depends on. */
export function validate(L: Level): void {
  const ammo = new Map<number, number>(), pixels = new Map<number, number>();
  for (const c of L.px) if (c) pixels.set(c, (pixels.get(c) ?? 0) + 1);
  for (const q of L.queues) for (const s of q) {
    if (!(s.a > 0)) throw new Error(`Purrlet ${s.id} has no paint`);
    ammo.set(s.c, (ammo.get(s.c) ?? 0) + s.a);
    if (s.link !== undefined) {
      const o = L.byId[s.link];
      if (!o || o.link !== s.id || o.d !== s.d || Math.abs(o.q - s.q) !== 1) throw new Error(`Purrlet ${s.id} has a broken link`);
    }
  }
  // Paint conservation: every colour's ammo equals its pixel count exactly.
  for (const c of new Set([...ammo.keys(), ...pixels.keys()])) {
    if ((ammo.get(c) ?? 0) !== (pixels.get(c) ?? 0)) throw new Error(`colour ${c}: ${ammo.get(c) ?? 0} paint for ${pixels.get(c) ?? 0} pixels`);
  }
}
