// The saved profile: one JSON document under one key. Everything read back is validated field by field, so a
// corrupted or hand-edited save repairs itself to sensible values instead of crashing the game.
import { BOOSTER_KEYS, type BoosterKey, type EconomyConfig, type IntroKey, type ProductId, type Settings } from '../app/contracts';
import { isBoosterKey, isObj, isProductId, num, PRODUCTS } from './economy';

export const PROFILE_KEY = 'pp.profile.v1';
export const PROFILE_VERSION = 1;

const INTRO_KEYS: readonly IntroKey[] = ['basics', 'tray', 'spicy', 'mystery', 'linked', 'background'];
const MOTION: readonly Settings['reduceMotion'][] = ['system', 'on', 'off'];

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({ sound: true, music: true, vibration: true, reduceMotion: 'system' });

export interface Profile {
  v: number;
  /** Next level to play. */
  level: number;
  coins: number;
  /** Lives as of `livesAt`; one more arrives every lifeRegenMin after `livesAt` until full. */
  lives: number;
  livesAt: number;
  unlimitedUntil: number | null;
  boosters: Record<BoosterKey, number>;
  /** Unlocked boosters, in the order they unlocked. */
  unlocked: BoosterKey[];
  /** Cleared levels (Sticker Book), ascending. */
  stickers: number[];
  intros: IntroKey[];
  /** Local calendar day (days since 1970-01-01 in local time) of the last daily gift claim, and its streak day. */
  daily: { lastDay: number | null; streak: number };
  owned: ProductId[];
  removeAds: boolean;
  ads: { count: number; lastAt: number | null; removeAdsOffered: boolean };
  starterOffered: boolean;
  settings: Settings;
  /** Level of the attempt in progress, if the app was closed during one (costs a life at the next launch). */
  attempt: number | null;
  /** Purchases that did not complete in the app and may still go through in the store. */
  pending: { id: ProductId; at: number }[];
  /** Store transaction ids already delivered (latest DELIVERED_KEEP), so a transaction never pays twice. */
  delivered: string[];
}

export const DELIVERED_KEEP = 200;
/** How long a pending purchase is still delivered when the store reports it. */
export const PENDING_DAYS = 14;

export function freshProfile(now: number, e: EconomyConfig): Profile {
  return {
    v: PROFILE_VERSION,
    level: 1,
    coins: e.startCoins,
    lives: e.maxLives,
    livesAt: now,
    unlimitedUntil: null,
    boosters: { slot: 0, shuffle: 0, nap: 0, xray: 0 },
    unlocked: [],
    stickers: [],
    intros: [],
    daily: { lastDay: null, streak: 0 },
    owned: [],
    removeAds: false,
    ads: { count: 0, lastAt: null, removeAdsOffered: false },
    starterOffered: false,
    settings: { ...DEFAULT_SETTINGS },
    attempt: null,
    pending: [],
    delivered: [],
  };
}

const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const time = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
/** Unique items that pass the guard, first occurrence wins (keeps unlock order). */
const keys = <T>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? [...new Set(v.filter(ok))] : []);

export function cleanSettings(v: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const s = isObj(v) ? v : {};
  return {
    sound: bool(s.sound, base.sound),
    music: bool(s.music, base.music),
    vibration: bool(s.vibration, base.vibration),
    reduceMotion: MOTION.includes(s.reduceMotion as Settings['reduceMotion']) ? (s.reduceMotion as Settings['reduceMotion']) : base.reduceMotion,
  };
}

/** Rebuilds a valid profile from whatever was stored. Unknown fields are dropped; bad ones fall back to defaults. */
export function repairProfile(raw: unknown, now: number, e: EconomyConfig): Profile {
  const p = freshProfile(now, e);
  if (!isObj(raw)) return p;
  p.level = num(raw.level, 1, 1);
  p.coins = num(raw.coins, e.startCoins);
  p.lives = Math.min(e.maxLives, num(raw.lives, e.maxLives));
  // A regen clock in the future means the phone's clock moved back: restart it from now rather than stall.
  const at = time(raw.livesAt);
  p.livesAt = at === null || at > now ? now : at;
  p.unlimitedUntil = time(raw.unlimitedUntil);
  const b = isObj(raw.boosters) ? raw.boosters : {};
  for (const k of BOOSTER_KEYS) p.boosters[k] = num(b[k], 0);
  p.unlocked = keys(raw.unlocked, isBoosterKey);
  p.stickers = keys(raw.stickers, (x): x is number => Number.isInteger(x) && (x as number) >= 1).sort((a, c) => a - c);
  p.intros = keys(raw.intros, (x): x is IntroKey => INTRO_KEYS.includes(x as IntroKey));
  const d = isObj(raw.daily) ? raw.daily : {};
  const lastDay = typeof d.lastDay === 'number' && Number.isInteger(d.lastDay) ? d.lastDay : null;
  p.daily = { lastDay, streak: lastDay === null ? 0 : num(d.streak, 1, 1) };
  p.owned = keys(raw.owned, (x): x is ProductId => isProductId(x) && PRODUCTS[x].oneTime);
  // Owning a product that removes ads always means no ads, even if the flag itself got lost.
  p.removeAds = bool(raw.removeAds, false) || p.owned.some(id => PRODUCTS[id].reward.removeAds === true);
  const a = isObj(raw.ads) ? raw.ads : {};
  p.ads = { count: num(a.count, 0), lastAt: time(a.lastAt), removeAdsOffered: bool(a.removeAdsOffered, false) };
  p.starterOffered = bool(raw.starterOffered, false);
  p.settings = cleanSettings(raw.settings);
  p.attempt = Number.isInteger(raw.attempt) && (raw.attempt as number) >= 1 ? raw.attempt as number : null;
  p.pending = (Array.isArray(raw.pending) ? raw.pending : [])
    .filter((x): x is { id: ProductId; at: number } => isObj(x) && isProductId(x.id) && time(x.at) !== null)
    .map(x => ({ id: x.id, at: x.at }));
  p.delivered = keys(raw.delivered, (x): x is string => typeof x === 'string' && x.length > 0).slice(-DELIVERED_KEEP);
  // Stickers prove progress: never let the next level fall behind the highest clear.
  const top = p.stickers[p.stickers.length - 1];
  if (top !== undefined) p.level = Math.max(p.level, top + 1);
  return p;
}

/** Local calendar day number, so "today" and "yesterday" follow the player's clock and survive DST changes. */
export function localDay(now: number): number {
  const d = new Date(now);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}
