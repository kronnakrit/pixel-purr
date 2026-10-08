// Boot, the home screen and its routes (shop, Sticker Book, daily gift, settings), HUD upkeep and the back button.
import { describe, expect, it } from 'vitest';
import type { HomeState, ShopState } from '../../src/app/contracts';
import { SHOP_VIDEO_COINS } from '../../src/app/controller';
import { Harness } from './fakes';

describe('boot', () => {
  it('loads remote config, then meta with its economy, starts services, and hides the splash after the first frame', async () => {
    const h = new Harness();
    h.remote.values.economy = { winCoins: 25 };
    await h.start();
    h.order('remoteConfig.init', 'meta.load', 'ads.init', 'purchases.init', 'ui.home', 'platform.ready');
    expect(h.economySeen).toEqual({ winCoins: 25 });
    expect(h.ui.veilCalls).toEqual([true, false]);
    expect(h.audio.track).toBe('home');
    expect(h.ui.hud.coins).toBe(300);
    expect(h.app.stepsPerSec).toBe(120);
    expect(h.analytics.screens).toContain('home');
  });

  it('steps the belt at the default 36 per second unless remote config says otherwise', async () => {
    const h = new Harness();
    delete h.remote.values.beltStepsPerSec;
    await h.start();
    expect(h.app.stepsPerSec).toBe(36);
    const bad = new Harness({ rate: 5000 });
    await bad.start();
    expect(bad.app.stepsPerSec).toBe(36);
  });

  it('applies saved settings to audio and follows the system Reduce Motion setting', async () => {
    const h = new Harness({ systemReduce: true });
    h.meta.s = { sound: false, music: true, vibration: false, reduceMotion: 'system' };
    await h.start();
    expect([h.audio.sound, h.audio.musicOn, h.audio.vibration]).toEqual([false, true, false]);
    expect(h.scene.reduced).toBe(true);
    expect(h.ui.rm).toBe(true);
  });

  it('unlocks audio on the first tap anywhere', async () => {
    const h = await new Harness().start();
    expect(h.audio.unlocks).toBe(0);
    h.events.dispatch('pointerdown');
    expect(h.audio.unlocks).toBe(1);
    h.events.dispatch('pointerup');
    h.events.dispatch('pointerdown');
    expect(h.audio.unlocks).toBe(2); // pointerup also unlocks, then both listeners are gone
  });
});

describe('home', () => {
  it('maps the levels around the current one, with pictures for finished levels and flames for spicy ones', async () => {
    const h = new Harness();
    h.meta.level = 9;
    h.meta.dailyAvailable = true;
    h.meta.stickerList = [1, 2, 3, 4, 5, 6, 7, 8];
    await h.start();
    const s = h.ui.last<HomeState>('home');
    expect(s.level).toBe(9);
    expect(s.map.map(m => m.n)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(s.map.filter(m => m.done).map(m => m.n)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(s.map.every(m => (m.picture !== null) === m.done)).toBe(true);
    expect(s.map.filter(m => m.spicy).map(m => m.n)).toEqual([5, 10, 15]);
    expect(s).toMatchObject({ coins: 300, dailyAvailable: true, stickers: 8, lives: { lives: 5 } });
  });

  it('ticks the lives timer once a second on home', async () => {
    const h = await new Harness().start();
    const before = h.ui.hud.livesCalls;
    await h.run(3500);
    expect(h.ui.hud.livesCalls - before).toBe(3);
  });

  it('shop: lists products, buys and applies them, gives video coins, restores', async () => {
    const h = await new Harness().start();
    h.ui.answer('home', 'shop');
    await h.until(() => h.ui.isOpen('shop'));
    const st = h.ui.last<ShopState>('shop');
    expect(st.products).toHaveLength(7);
    expect(st.rewards.coins_pouch).toEqual({ coins: 1000 });
    expect(st.videoReady).toBe(true);
    const act = h.ui.shopActions!;

    expect(await act.buy('coins_pouch')).toBe(true);
    expect(h.meta.coins).toBe(1300);
    expect(h.ui.hud.coins).toBe(1300);
    expect(h.ui.last<{ amount: number }>('coinsFly').amount).toBe(1000);
    expect(h.ui.toasts.at(-1)).toContain('+1,000 coins');

    h.purchases.result = 'cancelled';
    expect(await act.buy('coins_jar')).toBe(false);
    h.purchases.result = 'failed';
    expect(await act.buy('coins_jar')).toBe(false);
    expect(h.ui.toasts.at(-1)).toMatch(/did not go through/);
    h.purchases.lastFailure = 'alreadyOwned';
    expect(await act.buy('remove_ads')).toBe(false);
    expect(h.ui.toasts.at(-1)).toMatch(/already own this/);
    h.purchases.lastFailure = 'pending';
    expect(await act.buy('coins_jar')).toBe(false);
    expect(h.ui.toasts.at(-1)).toMatch(/waiting for approval/);
    h.purchases.lastFailure = null;

    expect(await act.video()).toBe(true);
    expect(h.ads.shown).toEqual(['shopCoins']);
    expect(h.meta.coins).toBe(1300 + SHOP_VIDEO_COINS);
    h.ads.reward = false;
    expect(await act.video()).toBe(false);
    expect(h.meta.coins).toBe(1300 + SHOP_VIDEO_COINS);

    h.purchases.restored = ['remove_ads'];
    await act.restore();
    expect(h.meta.removeAds).toBe(true);
    expect(h.log).toContain('meta.restorePurchase:remove_ads');
    expect(h.ui.toasts.at(-1)).toBe('Purchases restored');

    h.ui.answer('shop');
    await h.until(() => h.ui.isOpen('home'));
  });

  it('Sticker Book shows every collected picture', async () => {
    const h = new Harness();
    h.meta.stickerList = [1, 2, 5];
    await h.start();
    h.ui.answer('home', 'stickers');
    await h.until(() => h.ui.isOpen('stickerBook'));
    const items = h.ui.last<{ n: number; name: string }[]>('stickerBook');
    expect(items.map(i => i.n)).toEqual([1, 2, 5]);
    expect(items[0]!.name).toBe('Level 1 picture');
  });

  it('daily gift: claim, or double it with a video; nothing when already claimed', async () => {
    const h = await new Harness().start();
    h.ui.answer('home', 'daily');
    await h.until(() => h.ui.isOpen('dailyGift'));
    h.ui.answer('dailyGift', 'double');
    await h.until(() => h.ui.isOpen('home'));
    expect(h.ads.shown).toEqual(['dailyDouble']);
    expect(h.meta.coins).toBe(400);
    expect(h.ui.last<{ amount: number }>('coinsFly').amount).toBe(100);
    expect(h.audio.played).toContain('gift');

    h.ui.answer('home', 'daily');
    await h.until(() => h.ui.isOpen('home') && h.ui.count('home') === 3);
    expect(h.ui.count('dailyGift')).toBe(1);
    expect(h.ui.toasts.at(-1)).toMatch(/tomorrow/);
  });

  it('daily gift doubled video that fails still claims the normal gift', async () => {
    const h = await new Harness().start();
    h.ads.reward = false;
    h.ui.answer('home', 'daily');
    await h.until(() => h.ui.isOpen('dailyGift'));
    h.ui.answer('dailyGift', 'double');
    await h.until(() => h.ui.isOpen('home'));
    expect(h.meta.coins).toBe(350);
  });

  it('settings from home use the pause card in home mode and apply every change at once', async () => {
    const h = await new Harness({ systemReduce: false }).start();
    h.ui.answer('home', 'settings');
    await h.until(() => h.ui.isOpen('pause'));
    expect(h.ui.calls.at(-1)!.a[0]).toBe('home');
    h.ui.settingsCb!({ sound: false });
    h.ui.settingsCb!({ music: false, vibration: false });
    h.ui.settingsCb!({ reduceMotion: 'on' });
    expect([h.audio.sound, h.audio.musicOn, h.audio.vibration]).toEqual([false, false, false]);
    expect(h.scene.reduced).toBe(true);
    expect(h.ui.rm).toBe(true);
    expect(h.meta.s.reduceMotion).toBe('on');
    h.ui.settingsCb!({ reduceMotion: 'system' });
    expect(h.scene.reduced).toBe(false);
    expect(h.ui.pauseOpts?.privacy).toBeUndefined();
    h.ui.answer('pause', 'resume');
    await h.until(() => h.ui.count('home') === 2);
  });

  it('settings offer "Privacy choices" when the ad consent rules require it', async () => {
    const h = await new Harness().start();
    h.ads.privacyOptionsRequired = true;
    h.ui.answer('home', 'settings');
    await h.until(() => h.ui.isOpen('pause'));
    h.ui.pauseOpts!.privacy!();
    await h.until(() => h.log.includes('ads.showPrivacyOptions'));
    h.ui.answer('pause', 'resume');
  });

  it('routes the gear and coin chip on home when the UI reports them through the HUD', async () => {
    const h = await new Harness().start();
    h.ui.hud.shopCb();
    await h.until(() => h.ui.isOpen('shop'));
    h.ui.answer('shop');
    await h.until(() => h.ui.count('home') === 2);
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
  });

  it('routes UI clicks to audio with a light haptic', async () => {
    const h = await new Harness().start();
    h.ui.sfxCb!('button');
    h.ui.sfxCb!('coin');
    expect(h.audio.played).toEqual(['button', 'coin']);
    expect(h.audio.haptics).toEqual(['light']);
  });
});

describe('Android back', () => {
  it('is not handled on home (the platform leaves the app) and closes an open card', async () => {
    const h = await new Harness().start();
    expect(h.platform.back()).toBe(false);
    h.ui.answer('home', 'stickers');
    await h.until(() => h.ui.isOpen('stickerBook'));
    expect(h.platform.back()).toBe(true);
    await h.until(() => h.ui.count('home') === 2);
  });
});
