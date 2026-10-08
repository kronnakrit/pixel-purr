// Economy numbers and product contents. Remote config may override any number; overrides are validated and merged
// over the defaults so a bad value from the server falls back to the default instead of breaking the game.
import { BOOSTER_KEYS, type BoosterKey, type BoosterPrice, type EconomyConfig, type ProductContents, type ProductId, type Reward } from '../app/contracts';

export const PRODUCT_IDS: readonly ProductId[] = [
  'coins_pouch', 'coins_basket', 'coins_jar', 'coins_treasure', 'cosy_bundle', 'starter_bundle', 'remove_ads',
];

const each = (n: number): Record<BoosterKey, number> => ({ slot: n, shuffle: n, nap: n, xray: n });

/** Recursively freezes plain data so shared defaults can't be changed by accident. */
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') { for (const x of Object.values(v)) freeze(x); Object.freeze(v); }
  return v;
}

export const DEFAULT_ECONOMY: EconomyConfig = freeze({
  startCoins: 300,
  maxLives: 5,
  lifeRegenMin: 30,
  refillLivesCost: 900,
  continueCost: 900,
  winCoins: 20,
  spicyWinCoins: 40,
  freeBoostersOnUnlock: 3,
  boosters: {
    slot: { key: 'slot', name: 'Extra Cushion', unlock: 4, price: 900, does: 'Adds a 6th tray slot for the rest of the level.' },
    shuffle: { key: 'shuffle', name: 'Yarn Shuffle', unlock: 6, price: 600, does: 'Re-deals the order of every waiting Purrlet. Linked pairs stay put.' },
    nap: { key: 'nap', name: 'Cat Nap', unlock: 9, price: 1200, does: 'Sends every tray Purrlet to the end of the shortest queues, emptying the tray.' },
    xray: { key: 'xray', name: 'X-Ray Specs', unlock: 13, price: 1500, does: 'The next Purrlet you send sees through other colours for one lap.' },
  },
  daily: [
    { coins: 50 },
    { coins: 75 },
    { boosters: { shuffle: 1 } },
    { coins: 100 },
    { boosters: { slot: 1 } },
    { coins: 150 },
    { coins: 250, unlimitedLivesMin: 30 },
  ],
  interstitial: { fromLevel: 10, minGapSec: 180 },
  starterBundleAfterLevel: 5,
  removeAdsAfterInterstitials: 3,
});

const product = (id: ProductId, reward: Reward, oneTime = false): ProductContents => ({ id, reward, oneTime });

export const PRODUCTS: Record<ProductId, ProductContents> = freeze({
  coins_pouch: product('coins_pouch', { coins: 1000 }),
  coins_basket: product('coins_basket', { coins: 5500 }),
  coins_jar: product('coins_jar', { coins: 12000 }),
  coins_treasure: product('coins_treasure', { coins: 28000 }),
  cosy_bundle: product('cosy_bundle', { removeAds: true, boosters: each(3), coins: 2000 }, true),
  starter_bundle: product('starter_bundle', { coins: 2500, boosters: each(2) }, true),
  remove_ads: product('remove_ads', { removeAds: true }, true),
});

// ---------------------------------------------------------------- validation helpers (shared with the profile)

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isBoosterKey = (v: unknown): v is BoosterKey => typeof v === 'string' && (BOOSTER_KEYS as readonly string[]).includes(v);
export const isProductId = (v: unknown): v is ProductId => typeof v === 'string' && (PRODUCT_IDS as readonly string[]).includes(v);

/** A finite number >= min (rounded down when int), else the fallback. */
export function num(v: unknown, fallback: number, min = 0, int = true): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  const n = int ? Math.floor(v) : v;
  return n >= min ? n : fallback;
}

/** Cleans a reward from untrusted data: only known fields, positive whole amounts. */
export function cleanReward(v: unknown): Reward {
  const r: Reward = {};
  if (!isObj(v)) return r;
  const coins = num(v.coins, 0);
  if (coins > 0) r.coins = coins;
  if (isObj(v.boosters)) {
    const b: Partial<Record<BoosterKey, number>> = {};
    for (const k of BOOSTER_KEYS) { const n = num(v.boosters[k], 0); if (n > 0) b[k] = n; }
    if (Object.keys(b).length) r.boosters = b;
  }
  const min = num(v.unlimitedLivesMin, 0, 0, false);
  if (min > 0) r.unlimitedLivesMin = min;
  if (v.removeAds === true) r.removeAds = true;
  return r;
}

// ---------------------------------------------------------------- remote overrides

/** What remote config may send: any subset, nested objects may be partial too. */
export type EconomyOverrides = Partial<Omit<EconomyConfig, 'boosters' | 'interstitial'>> & {
  boosters?: Partial<Record<BoosterKey, Partial<BoosterPrice>>>;
  interstitial?: Partial<EconomyConfig['interstitial']>;
};

/** Merges overrides over the defaults. Missing, wrong-typed or out-of-range values keep the default. */
export function mergeEconomy(over?: EconomyOverrides | null, base: EconomyConfig = DEFAULT_ECONOMY): EconomyConfig {
  const o: Record<string, unknown> = isObj(over) ? over : {};
  const ob = isObj(o.boosters) ? o.boosters : {};
  const oi = isObj(o.interstitial) ? o.interstitial : {};
  const boosters = {} as Record<BoosterKey, BoosterPrice>;
  for (const k of BOOSTER_KEYS) {
    const d = base.boosters[k], b = isObj(ob[k]) ? ob[k] : {};
    boosters[k] = {
      key: k,
      name: typeof b.name === 'string' && b.name ? b.name : d.name,
      unlock: num(b.unlock, d.unlock, 1),
      price: num(b.price, d.price),
      does: typeof b.does === 'string' && b.does ? b.does : d.does,
    };
  }
  const daily = Array.isArray(o.daily) && o.daily.length > 0 ? o.daily.map(cleanReward) : base.daily.map(cleanReward);
  return freeze({
    startCoins: num(o.startCoins, base.startCoins),
    maxLives: num(o.maxLives, base.maxLives, 1),
    lifeRegenMin: num(o.lifeRegenMin, base.lifeRegenMin, 0.01, false),
    refillLivesCost: num(o.refillLivesCost, base.refillLivesCost),
    continueCost: num(o.continueCost, base.continueCost),
    winCoins: num(o.winCoins, base.winCoins),
    spicyWinCoins: num(o.spicyWinCoins, base.spicyWinCoins),
    freeBoostersOnUnlock: num(o.freeBoostersOnUnlock, base.freeBoostersOnUnlock),
    boosters,
    daily,
    interstitial: { fromLevel: num(oi.fromLevel, base.interstitial.fromLevel, 1), minGapSec: num(oi.minGapSec, base.interstitial.minGapSec, 0, false) },
    starterBundleAfterLevel: num(o.starterBundleAfterLevel, base.starterBundleAfterLevel, 1),
    removeAdsAfterInterstitials: num(o.removeAdsAfterInterstitials, base.removeAdsAfterInterstitials, 1),
  });
}

/** Boosters in the order they unlock (ties keep BOOSTER_KEYS order). */
export const unlockOrder = (e: EconomyConfig): BoosterKey[] =>
  [...BOOSTER_KEYS].sort((a, b) => e.boosters[a].unlock - e.boosters[b].unlock);

/** Deep copy so callers can't change stored rewards through what we return. */
export const copyReward = (r: Reward): Reward => cleanReward(r);
