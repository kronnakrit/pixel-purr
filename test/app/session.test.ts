// One attempt: taps, the step clock, boosters (use and buy), the lose flow with its one continue, and the win flow.
import { describe, expect, it } from 'vitest';
import { BOOSTER_KEYS, type FailInfo, type OfferInfo, type WinInfo } from '../../src/app/contracts';
import { LOSE_PAUSE } from '../../src/app/session';
import { CHERRY, Harness, make, quickWin, RING, SODA } from './fakes';

/** Level n with every booster unlocked and `count` of each. */
async function boot(n: number, level: () => ReturnType<typeof make>, count = 1, rate?: number): Promise<Harness> {
  const h = new Harness({ rate });
  h.meta.level = n;
  h.meta.unlocked = [...BOOSTER_KEYS];
  for (const k of BOOSTER_KEYS) h.meta.boosters[k] = count;
  h.content.custom.set(n, level);
  await h.start();
  await h.playFromHome();
  return h;
}

/** Ring with a hidden cherry; cherries first park. Tray `tray` cushions. */
const parkLevel = (tray = 5, n = 20) => make(RING, [[[CHERRY, 1], [CHERRY, 1]], [[SODA, 4], [SODA, 4]], [[SODA, 1]]], tray, n);

describe('taps and the clock', () => {
  it('launches through the scene, steps at the remote rate and forwards every batch to scene and audio', async () => {
    const h = await boot(20, () => make(Array.from({ length: 12 }, () => '6'.repeat(12)), [[[SODA, 144]]], 5, 20), 1, 36);
    h.scene.tap({ kind: 'queue', q: 0 });
    expect(h.game.riders).toHaveLength(1);
    expect(h.scene.events()[0]).toMatchObject({ type: 'launch', from: 'queue' });
    await h.run(1000);
    expect(h.game.tick).toBeGreaterThanOrEqual(34); // 36 steps per second (the first frame after a launch starts clean)
    expect(h.game.tick).toBeLessThanOrEqual(36);
    expect(h.audio.batches).toEqual(h.scene.batches);
  });

  it('a tap that cannot launch plays the blocked sound', async () => {
    const h = await boot(20, () => parkLevel());
    h.scene.tap({ kind: 'queue', q: 1 });
    h.scene.tap({ kind: 'queue', q: 2 }); // entry still occupied
    expect(h.audio.played).toEqual(['blocked']);
    expect(h.game.riders).toHaveLength(1);
  });

  it('passes stepFrac to the scene while cats ride', async () => {
    const h = await boot(20, () => parkLevel(), 1, 36);
    h.scene.tap({ kind: 'queue', q: 1 });
    h.clock.frame(10);
    expect(h.scene.lastFrac).toBeGreaterThan(0);
    expect(h.scene.lastFrac).toBeLessThan(1);
  });
});

describe('boosters', () => {
  it('uses one from stock: Extra Cushion, Cat Nap, X-Ray (active until the next launch), Yarn Shuffle', async () => {
    const h = await boot(20, () => parkLevel());
    expect(h.ui.hud.button('nap')).toMatchObject({ unlocked: true, count: 1, enabled: false });
    h.ui.hud.boosterCb('nap'); // nothing to nap yet
    expect(h.audio.played).toEqual(['blocked']);

    h.ui.hud.boosterCb('slot');
    expect(h.game.trayCap).toBe(6);
    expect(h.scene.events()).toContainEqual({ type: 'traySlots', cap: 6 });
    expect(h.ui.hud.button('slot').count).toBe(0);

    await h.launch(0); // cherry can't see its pixel: parks
    expect(h.game.tray).toHaveLength(1);
    expect(h.ui.hud.button('nap').enabled).toBe(true);
    h.ui.hud.boosterCb('nap');
    expect(h.game.tray).toHaveLength(0);
    expect(h.scene.events().some(e => e.type === 'napBack')).toBe(true);

    h.ui.hud.boosterCb('xray');
    expect(h.ui.hud.button('xray')).toMatchObject({ active: true, enabled: false, count: 0 });
    h.scene.tap({ kind: 'queue', q: 1 });
    expect(h.ui.hud.button('xray').active).toBe(false);
    expect(h.game.riders[0]!.xray).toBe(true);
    await h.until(() => h.game.riders.length === 0);

    h.ui.hud.boosterCb('shuffle');
    expect(h.scene.events().some(e => e.type === 'shuffle')).toBe(true);
    expect(h.analytics.named('booster_use').map(e => e.params!.booster)).toEqual(['slot', 'nap', 'xray', 'shuffle']);
  });

  it('Yarn Shuffle is seeded: the same level and attempt deal the same order', async () => {
    const order = async () => {
      const h = await boot(20, () => make(['1234', '5678'], [[[1, 1], [2, 1], [3, 1]], [[4, 1], [5, 1], [6, 1]], [[7, 1], [8, 1]]]));
      h.ui.hud.boosterCb('shuffle');
      return h.game.queues.map(q => q.map(p => p.id));
    };
    const a = await order(), b = await order();
    expect(a).toEqual(b);
    expect(a).not.toEqual([[0, 1, 2], [3, 4, 5], [6, 7]]);
  });

  it('with none left: buy for coins (then use), video for one, or close; the clock waits meanwhile', async () => {
    const h = await boot(20, () => parkLevel(), 0);
    h.meta.coins = 1000;
    h.scene.tap({ kind: 'queue', q: 1 });
    h.ui.hud.boosterCb('slot');
    await h.until(() => h.ui.isOpen('buyBooster'));
    expect(h.ui.last('buyBooster')).toEqual({ k: 'slot', price: 900, canAfford: true, videoReady: true });
    const tick = h.game.tick;
    await h.run(500);
    expect(h.game.tick).toBe(tick);
    h.ui.answer('buyBooster', 'buy');
    await h.until(() => h.running);
    expect(h.meta.coins).toBe(100);
    expect(h.game.trayCap).toBe(6);
    expect(h.meta.boosters.slot).toBe(0);
    h.order('meta.spendCoins:900:booster:slot', 'meta.grant:booster:buy', 'meta.useBooster:slot');
    expect(h.ui.hud.coins).toBe(100);

    // can't afford: the card says so; buying anyway changes nothing
    h.ui.hud.boosterCb('shuffle');
    await h.until(() => h.ui.isOpen('buyBooster'));
    expect(h.ui.last<{ canAfford: boolean }>('buyBooster').canAfford).toBe(false);
    h.ui.answer('buyBooster', 'buy');
    await h.until(() => h.running);
    expect(h.ui.toasts).toContain('Not enough coins');
    expect(h.meta.coins).toBe(100);

    // a video for one
    h.ui.hud.boosterCb('shuffle');
    await h.until(() => h.ui.isOpen('buyBooster'));
    h.ui.answer('buyBooster', 'video');
    await h.until(() => h.running);
    expect(h.ads.shown).toEqual(['booster']);
    expect(h.scene.events().some(e => e.type === 'shuffle')).toBe(true);

    // the video did not finish: nothing
    h.ads.reward = false;
    h.ui.hud.boosterCb('xray');
    await h.until(() => h.ui.isOpen('buyBooster'));
    h.ui.answer('buyBooster', 'video');
    await h.until(() => h.running);
    expect(h.game.xrayArmed).toBe(false);

    h.ui.hud.boosterCb('xray');
    await h.until(() => h.ui.isOpen('buyBooster'));
    h.ui.answer('buyBooster', 'close');
    await h.until(() => h.running);
    expect(h.game.xrayArmed).toBe(false);
    expect(h.meta.boosters).toEqual({ slot: 0, shuffle: 0, nap: 0, xray: 0 });
  });

  it('locked boosters do nothing', async () => {
    const h = await boot(20, () => parkLevel());
    h.meta.unlocked = ['slot'];
    h.session!.refreshBoosters();
    expect(h.ui.hud.button('xray')).toMatchObject({ unlocked: false, enabled: false });
    h.ui.hud.boosterCb('xray');
    expect(h.game.xrayArmed).toBe(false);
    expect(h.ui.count('buyBooster')).toBe(0);
  });
});

describe('losing', () => {
  /** Tray of 0: the first cherry to park loses. */
  const lose = () => make(RING, [[[CHERRY, 1], [CHERRY, 1]], [[SODA, 8]]], 0, 20);

  async function toFail(h: Harness, q = 0): Promise<FailInfo> {
    h.scene.tap({ kind: 'queue', q });
    await h.until(() => h.ui.isOpen('fail'));
    return h.ui.last<FailInfo>('fail');
  }

  it('waits for the worried moment, then offers one continue for coins', async () => {
    const h = await boot(20, lose);
    h.meta.coins = 1000;
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.until(() => h.game.status === 'lost');
    const t0 = h.clock.t;
    await h.until(() => h.ui.isOpen('fail'));
    expect((h.clock.t - t0) / 1000).toBeGreaterThanOrEqual(LOSE_PAUSE - 0.11);
    expect(h.ui.last('fail')).toEqual({ level: 20, continueCost: 900, canAfford: true, videoReady: true, canContinue: true });
    h.ui.answer('fail', 'coins');
    await h.until(() => h.running);
    expect(h.meta.coins).toBe(100);
    expect(h.game.trayCap).toBe(1);
    expect(h.scene.events()).toContainEqual({ type: 'resumed' });

    // the second loss in the same attempt has no continue left
    const f = await toFail(h);
    expect(f.canContinue).toBe(false);
    h.ui.answer('fail', 'giveup');
    await h.until(() => h.ui.count('home') === 2);
    expect(h.meta.livesLeft).toBe(4);
    expect(h.analytics.named('level_continue')).toHaveLength(1);
  });

  it('continue with a video; a video that does not finish brings the card back', async () => {
    const h = await boot(20, lose);
    await toFail(h);
    h.ads.reward = false;
    h.ui.answer('fail', 'video');
    await h.until(() => h.ui.count('fail') === 2);
    h.ads.reward = true;
    h.ui.answer('fail', 'video');
    await h.until(() => h.running);
    expect(h.ads.shown).toEqual(['continue', 'continue']);
    expect(h.game.trayCap).toBe(1);
    expect(h.meta.livesLeft).toBe(5);
  });

  it('coins it cannot afford bring the card back', async () => {
    const h = await boot(20, lose);
    const f = await toFail(h);
    expect(f.canAfford).toBe(false);
    h.ui.answer('fail', 'coins');
    await h.until(() => h.ui.count('fail') === 2);
    expect(h.meta.coins).toBe(300);
  });

  it('give up spends a life and goes home; a new attempt gets its continue back', async () => {
    const h = await boot(20, lose);
    h.meta.coins = 5000;
    await toFail(h);
    h.ui.answer('fail', 'giveup');
    await h.until(() => h.ui.count('home') === 2);
    expect(h.meta.livesLeft).toBe(4);
    expect(h.analytics.named('level_quit')[0]!.params).toMatchObject({ reason: 'giveup' });
    h.ui.answer('home', 'play');
    await h.until(() => h.running);
    expect((await toFail(h)).canContinue).toBe(true);
  });

  it('restart after a continue starts an attempt with its own continue', async () => {
    const h = await boot(20, lose);
    h.meta.coins = 5000;
    await toFail(h);
    h.ui.answer('fail', 'coins');
    await h.until(() => h.running);
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
    h.ui.answer('pause', 'restart');
    await h.until(() => h.running && h.game.trayCap === 0);
    expect((await toFail(h)).canContinue).toBe(true);
  });
});

describe('winning', () => {
  it('records the win, celebrates, shows the card, doubles with a video, flies the coins, then offers and the ad policy', async () => {
    const h = new Harness();
    h.meta.level = 10;
    h.meta.interstitials = 2;
    h.content.custom.set(10, () => quickWin(10));
    await h.start();
    await h.playFromHome();
    h.scene.holdCelebrate = true;
    h.ui.auto.win = undefined;
    const saves = h.meta.saves;
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.until(() => h.log.includes('scene.celebrate'));
    await h.run(500);
    // the win is saved before the dance, so closing the app during it keeps the level
    expect(h.log).toContain('meta.completeLevel:10');
    expect(h.meta.saves).toBeGreaterThan(saves);
    expect(h.ui.isOpen('win')).toBe(false); // the card waits for the celebration
    h.scene.releaseCelebrate();
    await h.until(() => h.ui.isOpen('win'));
    const w = h.ui.last<WinInfo>('win');
    expect(w).toMatchObject({ level: 10, name: 'Level 10 picture', coins: 40, canDouble: true });
    expect(w.picture.name).toBe('pic10');
    h.ui.answer('win', 'double');
    await h.until(() => h.ui.count('home') === 2);
    h.order(
      'meta.completeLevel:10', 'scene.celebrate', 'ui.win', 'ads.showRewarded:doubleCoins', 'meta.addCoins:40:win:double', 'ui.coinsFly',
      'meta.takeStarterOfferMoment:true', 'ui.offer', 'scene.clear', 'ui.home',
    );
    // the player just watched a video: no interstitial straight after it
    expect(h.log.some(e => e.startsWith('ads.showInterstitial'))).toBe(false);
    expect(h.ui.last<{ from: unknown; amount: number }>('coinsFly')).toEqual({ from: { x: 195, y: 300 }, amount: 80 });
    expect(h.ui.calls.filter(c => c.m === 'offer').map(c => (c.a[0] as OfferInfo).kind)).toEqual(['starter']);
    const starter = h.ui.calls.find(c => c.m === 'offer')!.a[0] as OfferInfo;
    expect(starter.product?.id).toBe('starter_bundle');
    expect(starter.reward.coins).toBe(2500);
    expect(h.meta.coins).toBe(300 + 80);
    expect(h.meta.level).toBe(11);
    expect(h.meta.livesLeft).toBe(5);
    expect(h.audio.suspended).toBe(false);
  });

  it('without the double video, the interstitial policy runs and the Remove Ads offer follows the 3rd ad', async () => {
    const h = new Harness();
    h.meta.level = 10;
    h.meta.interstitials = 2;
    h.meta.starterOffered = true;
    h.content.custom.set(10, () => quickWin(10));
    await h.start();
    await h.playFromHome();
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.until(() => h.ui.count('home') === 2);
    h.order('ui.win', 'ui.coinsFly', 'meta.mayShowInterstitial:10:false:true', 'ads.showInterstitial:true',
      'meta.recordInterstitial', 'meta.takeRemoveAdsOfferMoment:true', 'ui.offer', 'scene.clear', 'ui.home');
  });

  it('buying from the starter offer applies the bundle', async () => {
    const h = new Harness();
    h.meta.level = 5;
    h.content.custom.set(5, () => quickWin(5));
    h.meta.seen.add('spicy');
    await h.start();
    await h.playFromHome();
    h.ui.auto.offer = () => 'buy';
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.until(() => h.ui.count('home') === 2);
    h.order('ui.offer', 'purchases.buy:starter_bundle', 'meta.applyPurchase:starter_bundle');
    expect(h.meta.boosters.slot).toBe(3 + 2); // 3 free on unlock at this level, 2 from the bundle
    expect(h.log.some(e => e.startsWith('ads.showInterstitial'))).toBe(false); // level 5 < 10
  });

  it('no interstitial right after a loss, and no ad bookkeeping when none was loaded', async () => {
    const h = new Harness();
    h.meta.level = 12;
    h.meta.coins = 2000;
    h.content.custom.set(12, () => make(RING, [[[CHERRY, 1]], [[SODA, 8]]], 0, 12));
    h.meta.seen.add('linked');
    await h.start();
    await h.playFromHome();
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.until(() => h.ui.isOpen('fail'));
    h.ui.answer('fail', 'coins');
    await h.until(() => h.running);
    await h.launch(1);
    h.scene.tap({ kind: 'tray', i: 0 });
    await h.until(() => h.ui.count('home') === 2);
    expect(h.log).toContain('meta.mayShowInterstitial:12:true:false');
    expect(h.log.some(e => e.startsWith('ads.showInterstitial'))).toBe(false);

    // the next win is not "after a loss" any more; this time no ad is loaded
    h.ads.interstitialLoaded = false;
    h.content.custom.set(13, () => quickWin(13));
    h.ui.answer('home', 'play');
    await h.until(() => h.running);
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.until(() => h.ui.count('home') === 3);
    expect(h.log).toContain('meta.mayShowInterstitial:13:false:true');
    expect(h.log).toContain('ads.showInterstitial:false');
    expect(h.log).not.toContain('meta.recordInterstitial');
  });

  it('audio is quiet during an ad and comes back after', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => quickWin(3));
    await h.start();
    await h.playFromHome();
    h.ui.auto.win = () => 'double';
    h.ads.hold = true;
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.until(() => h.ads.shown.length === 1);
    expect(h.audio.suspended).toBe(true);
    h.ads.release();
    await h.until(() => h.ui.count('home') === 2);
    expect(h.audio.suspended).toBe(false);
  });
});

describe('debug hooks', () => {
  it('win() and lose() run the real flows', async () => {
    const h = await boot(20, () => parkLevel(2));
    expect(h.session!.forceLose()).toBe(true);
    await h.until(() => h.ui.isOpen('fail'));
    expect(h.game.tray.length).toBeGreaterThan(h.game.trayCap);
    h.meta.coins = 900;
    h.ui.answer('fail', 'coins');
    await h.until(() => h.running);
    expect(h.session!.forceWin()).toBe(true);
    await h.until(() => h.ui.count('home') === 2);
    expect(h.meta.level).toBe(21);
  });

  it.each([1, 2, 3, 4])('autoplay wins level %i through the tap path', async n => {
    const h = new Harness();
    h.meta.level = n;
    for (const k of ['basics', 'tray'] as const) h.meta.seen.add(k);
    await h.start();
    await h.playFromHome();
    const result = h.app.debugAutoplay();
    await h.until(() => h.ui.count('home') === 2, 600_000, 100);
    expect(await result).toBe('won');
    expect(h.meta.level).toBe(n + 1);
    const launches = h.scene.events().filter(e => e.type === 'launch').length;
    expect(launches).toBe(h.content.getLevel(n).solution!.plan!.length);
  });

  it('play(n) jumps from home or abandons a running attempt without spending a life', async () => {
    const h = await boot(20, () => parkLevel());
    h.content.custom.set(21, () => quickWin(21));
    expect(h.app.debugPlay(21)).toBe(true);
    await h.until(() => h.session?.n === 21 && h.running);
    expect(h.meta.livesLeft).toBe(5);
  });
});

