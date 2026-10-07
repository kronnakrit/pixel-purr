// Fixes from the pre-release review: lives, the shop, late purchases, rewarded videos, privacy links, boosters.
import { describe, expect, it } from 'vitest';
import type { ShopState } from '../../src/app/contracts';
import { Harness, make, quickWin, RING, CHERRY, SODA } from './fakes';

describe('lives', () => {
  it('an attempt is marked live while it runs and cleared on a win', async () => {
    const h = new Harness();
    h.content.custom.set(1, () => quickWin(1));
    h.meta.seen.add('basics');
    await h.start();
    await h.playFromHome();
    expect(h.meta.attempt).toBe(1);
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.until(() => h.ui.count('home') === 2);
    expect(h.meta.attempt).toBeNull();
    expect(h.meta.livesLeft).toBe(5);
  });

  it('giving up spends the life and clears the attempt together', async () => {
    const h = new Harness();
    h.content.custom.set(1, () => make(RING, [[[CHERRY, 1]], [[SODA, 8]]], 0, 1));
    h.meta.seen.add('basics');
    await h.start();
    await h.playFromHome();
    await h.launch(0);
    await h.until(() => h.ui.isOpen('fail'));
    expect(h.meta.attempt).toBe(1);
    h.ui.answer('fail', 'giveup');
    await h.until(() => h.ui.count('home') === 2);
    expect(h.meta.attempt).toBeNull();
    expect(h.meta.livesLeft).toBe(4);
  });

  it('the out-of-lives card closes by itself when a life arrives, and the level starts', async () => {
    const h = new Harness();
    h.meta.livesLeft = 0;
    h.content.custom.set(1, () => quickWin(1));
    h.meta.seen.add('basics');
    await h.start();
    h.ui.answer('home', 'play');
    await h.until(() => h.ui.isOpen('outOfLives'));
    await h.run(2000);
    expect(h.ui.isOpen('outOfLives')).toBe(true);
    h.meta.livesLeft = 1; // the regen timer ticked over
    await h.until(() => h.running);
    expect(h.ui.count('outOfLives')).toBe(1);
  });
});

describe('home', () => {
  it('HUD taps while the shop is loading do not queue more pages', async () => {
    const h = new Harness();
    let release = () => {};
    h.purchases.products = () => new Promise(r => { release = () => r(h.purchases.list); });
    await h.start();
    h.ui.hud.shopCb();
    await h.until(() => h.ui.veil);
    h.ui.hud.shopCb();
    h.ui.hud.pauseCb();
    release();
    await h.until(() => h.ui.isOpen('shop'));
    h.ui.answer('shop');
    await h.until(() => h.ui.count('home') === 2);
    await h.run(500);
    expect(h.ui.count('shop')).toBe(1);
    expect(h.ui.count('pause')).toBe(0);
  });

  it('coming back from the background on home redraws it (the daily gift dot)', async () => {
    const h = new Harness();
    await h.start();
    h.platform.setPaused(true);
    h.platform.setPaused(false);
    await h.until(() => h.ui.count('home') === 2);
  });

  it('the settings card links the privacy policy', async () => {
    const h = new Harness({ deps: { privacyPolicyUrl: 'https://example.com/privacy.html' } });
    await h.start();
    h.ui.answer('home', 'settings');
    await h.until(() => h.ui.isOpen('pause'));
    h.ui.pauseOpts!.policy!();
    expect(h.platform.opened).toEqual(['https://example.com/privacy.html']);
    expect(h.ui.pauseOpts!.privacy).toBeUndefined();
  });
});

describe('shop and purchases', () => {
  it('tells the shop when the player already has no ads, and never sells Remove Ads again', async () => {
    const h = new Harness();
    h.meta.removeAds = true;
    await h.start();
    h.ui.answer('home', 'shop');
    await h.until(() => h.ui.isOpen('shop'));
    const st = h.ui.last<ShopState>('shop');
    expect(st.removeAds).toBe(true);
    expect(st.videoCoins).toBe(100);
    expect(await h.ui.shopActions!.buy('remove_ads')).toBe(false);
    expect(h.log).not.toContain('purchases.buy:remove_ads');
    expect(h.ui.toasts.at(-1)).toBe('You already have no ads');
  });

  it('a pending purchase is delivered once when the store reports it later', async () => {
    const h = new Harness();
    await h.start();
    h.ui.answer('home', 'shop');
    await h.until(() => h.ui.isOpen('shop'));
    h.purchases.result = 'failed';
    h.purchases.lastFailure = 'pending';
    expect(await h.ui.shopActions!.buy('coins_basket')).toBe(false);
    expect(h.ui.toasts.at(-1)).toMatch(/waiting for approval/);
    expect(h.meta.coins).toBe(300);
    const late = [{ id: 'coins_basket' as const, txn: 'T1', at: h.clock.now() + 60_000 }];
    h.purchases.report(late);
    expect(h.meta.coins).toBe(300 + 5500);
    expect(h.ui.toasts.at(-1)).toMatch(/Your purchase arrived/);
    h.purchases.report(late); // reported again: never paid twice
    expect(h.meta.coins).toBe(300 + 5500);
  });

  it('a successful purchase records its transaction, so a later report does not pay again', async () => {
    const h = new Harness();
    await h.start();
    h.ui.answer('home', 'shop');
    await h.until(() => h.ui.isOpen('shop'));
    h.purchases.lastTransaction = 'T7';
    expect(await h.ui.shopActions!.buy('coins_pouch')).toBe(true);
    h.meta.notePendingPurchase('coins_pouch', 0);
    h.purchases.report([{ id: 'coins_pouch', txn: 'T7', at: 1 }]);
    expect(h.meta.coins).toBe(300 + 1000);
  });

  it('a failed restore says the store could not be reached', async () => {
    const h = new Harness();
    await h.start();
    h.ui.answer('home', 'shop');
    await h.until(() => h.ui.isOpen('shop'));
    h.purchases.restoreFails = true;
    expect(await h.ui.shopActions!.restore()).toEqual([]);
    expect(h.ui.toasts.at(-1)).toBe('Could not reach the store. Try again later.');
  });

  it('a video button with no video ready says so instead of "did not finish"', async () => {
    const h = new Harness();
    await h.start();
    h.ui.answer('home', 'shop');
    await h.until(() => h.ui.isOpen('shop'));
    h.ads.ready = false;
    expect(h.ui.shopActions!.videoReady()).toBe(false);
    expect(await h.ui.shopActions!.video()).toBe(false);
    expect(h.ads.shown).toEqual([]);
    expect(h.ui.toasts.at(-1)).toMatch(/No video available right now/);
  });
});

describe('boosters', () => {
  it('Extra Cushion works once per attempt, so a double tap spends one', async () => {
    const h = new Harness();
    h.meta.level = 4;
    h.content.custom.set(4, () => make(RING, [[[CHERRY, 1]], [[SODA, 8]]], 5, 4));
    await h.start();
    await h.playFromHome();
    const before = h.meta.boosterCount('slot');
    expect(before).toBeGreaterThan(0);
    h.ui.hud.boosterCb('slot');
    h.ui.hud.boosterCb('slot');
    await h.run(200);
    expect(h.meta.boosterCount('slot')).toBe(before - 1);
    expect(h.game.trayCap).toBe(6);
    expect(h.ui.hud.button('slot').enabled).toBe(false);
  });
});
