import { describe, expect, it } from 'vitest';
import { BOOSTER_KEYS } from '../../src/app/contracts';
import { DEFAULT_ECONOMY, PRODUCT_IDS, PRODUCTS, mergeEconomy } from '../../src/meta';
import { unlockOrder } from '../../src/meta/economy';

describe('DEFAULT_ECONOMY', () => {
  it('matches the economy table in docs/ARCHITECTURE.md', () => {
    const e = DEFAULT_ECONOMY;
    expect(e.startCoins).toBe(300);
    expect(e.maxLives).toBe(5);
    expect(e.lifeRegenMin).toBe(30);
    expect(e.refillLivesCost).toBe(900);
    expect(e.continueCost).toBe(900);
    expect([e.winCoins, e.spicyWinCoins]).toEqual([20, 40]);
    expect(e.freeBoostersOnUnlock).toBe(3);
    expect(e.interstitial).toEqual({ fromLevel: 10, minGapSec: 180 });
    expect(e.starterBundleAfterLevel).toBe(5);
    expect(e.removeAdsAfterInterstitials).toBe(3);
  });

  it('has the four boosters with their unlock levels and prices', () => {
    const b = DEFAULT_ECONOMY.boosters;
    expect(Object.keys(b)).toEqual([...BOOSTER_KEYS]);
    expect(b.slot).toMatchObject({ key: 'slot', name: 'Extra Cushion', unlock: 4, price: 900 });
    expect(b.shuffle).toMatchObject({ key: 'shuffle', name: 'Yarn Shuffle', unlock: 6, price: 600 });
    expect(b.nap).toMatchObject({ key: 'nap', name: 'Cat Nap', unlock: 9, price: 1200 });
    expect(b.xray).toMatchObject({ key: 'xray', name: 'X-Ray Specs', unlock: 13, price: 1500 });
    for (const k of BOOSTER_KEYS) expect(b[k].does.length).toBeGreaterThan(10);
  });

  it('has the 7-day gift ladder', () => {
    expect(DEFAULT_ECONOMY.daily).toEqual([
      { coins: 50 }, { coins: 75 }, { boosters: { shuffle: 1 } }, { coins: 100 }, { boosters: { slot: 1 } }, { coins: 150 },
      { coins: 250, unlimitedLivesMin: 30 },
    ]);
  });

  it('is frozen so nobody changes the shared defaults by accident', () => {
    expect(Object.isFrozen(DEFAULT_ECONOMY)).toBe(true);
    expect(Object.isFrozen(DEFAULT_ECONOMY.boosters.slot)).toBe(true);
    expect(Object.isFrozen(DEFAULT_ECONOMY.daily[0])).toBe(true);
  });
});

describe('PRODUCTS', () => {
  it('covers every product id with its contents', () => {
    expect(Object.keys(PRODUCTS).sort()).toEqual([...PRODUCT_IDS].sort());
    for (const id of PRODUCT_IDS) expect(PRODUCTS[id].id).toBe(id);
    expect(PRODUCTS.coins_pouch).toEqual({ id: 'coins_pouch', reward: { coins: 1000 }, oneTime: false });
    expect(PRODUCTS.coins_basket.reward).toEqual({ coins: 5500 });
    expect(PRODUCTS.coins_jar.reward).toEqual({ coins: 12000 });
    expect(PRODUCTS.coins_treasure.reward).toEqual({ coins: 28000 });
    const each = (n: number) => ({ slot: n, shuffle: n, nap: n, xray: n });
    expect(PRODUCTS.cosy_bundle).toEqual({ id: 'cosy_bundle', reward: { removeAds: true, boosters: each(3), coins: 2000 }, oneTime: true });
    expect(PRODUCTS.starter_bundle).toEqual({ id: 'starter_bundle', reward: { coins: 2500, boosters: each(2) }, oneTime: true });
    expect(PRODUCTS.remove_ads).toEqual({ id: 'remove_ads', reward: { removeAds: true }, oneTime: true });
  });

  it('coin packs can be bought again; bundles and Remove Ads are one time', () => {
    expect(PRODUCT_IDS.filter(id => PRODUCTS[id].oneTime)).toEqual(['cosy_bundle', 'starter_bundle', 'remove_ads']);
  });
});

describe('mergeEconomy', () => {
  it('returns the defaults for nothing', () => {
    expect(mergeEconomy()).toEqual(DEFAULT_ECONOMY);
    expect(mergeEconomy(null)).toEqual(DEFAULT_ECONOMY);
    expect(mergeEconomy({})).toEqual(DEFAULT_ECONOMY);
  });

  it('merges top-level and nested overrides over the defaults', () => {
    const e = mergeEconomy({
      winCoins: 25, maxLives: 6, lifeRegenMin: 20,
      boosters: { nap: { price: 1000 } },
      interstitial: { minGapSec: 240 },
      daily: [{ coins: 10 }, { coins: 20 }],
    });
    expect(e.winCoins).toBe(25);
    expect(e.spicyWinCoins).toBe(40);
    expect(e.maxLives).toBe(6);
    expect(e.lifeRegenMin).toBe(20);
    expect(e.boosters.nap).toMatchObject({ key: 'nap', name: 'Cat Nap', unlock: 9, price: 1000 });
    expect(e.boosters.slot).toEqual(DEFAULT_ECONOMY.boosters.slot);
    expect(e.interstitial).toEqual({ fromLevel: 10, minGapSec: 240 });
    expect(e.daily).toEqual([{ coins: 10 }, { coins: 20 }]);
  });

  it('ignores wrong-typed and out-of-range values from remote config', () => {
    const bad = {
      winCoins: '30', maxLives: 0, lifeRegenMin: -5, startCoins: Number.NaN, continueCost: Infinity,
      boosters: { slot: { unlock: 0, price: 'cheap', name: 42, key: 'xray' }, wat: { price: 1 } },
      interstitial: 'never', daily: 'lots', removeAdsAfterInterstitials: null,
    } as unknown as Parameters<typeof mergeEconomy>[0];
    const e = mergeEconomy(bad);
    expect(e.winCoins).toBe(20);
    expect(e.maxLives).toBe(5);
    expect(e.lifeRegenMin).toBe(30);
    expect(e.startCoins).toBe(300);
    expect(e.continueCost).toBe(900);
    expect(e.boosters.slot).toEqual(DEFAULT_ECONOMY.boosters.slot);
    expect(Object.keys(e.boosters)).toEqual([...BOOSTER_KEYS]);
    expect(e.interstitial).toEqual(DEFAULT_ECONOMY.interstitial);
    expect(e.daily).toEqual(DEFAULT_ECONOMY.daily);
    expect(e.removeAdsAfterInterstitials).toBe(3);
  });

  it('cleans daily rewards and rounds whole-number fields down', () => {
    const e = mergeEconomy({ winCoins: 25.9, daily: [{ coins: 12.7, boosters: { nap: 1, zap: 3 } as never, removeAds: 'yes' as never }, 'junk' as never] });
    expect(e.winCoins).toBe(25);
    expect(e.daily).toEqual([{ coins: 12, boosters: { nap: 1 } }, {}]);
  });

  it('orders boosters by unlock level, ties in key order', () => {
    expect(unlockOrder(DEFAULT_ECONOMY)).toEqual(['slot', 'shuffle', 'nap', 'xray']);
    expect(unlockOrder(mergeEconomy({ boosters: { xray: { unlock: 2 }, nap: { unlock: 6 } } }))).toEqual(['xray', 'slot', 'shuffle', 'nap']);
  });
});
