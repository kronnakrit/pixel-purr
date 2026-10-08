// Starting a level: lives gate, booster unlock and intro cards; pause, restart, going home, backgrounding, back button.
import { describe, expect, it } from 'vitest';
import { Harness, make, quickWin, CHERRY, SODA } from './fakes';

/** A level that takes a while: one soda Purrlet rides a long belt around a big board. */
const slowLevel = (n = 3) => make(Array.from({ length: 12 }, () => '6'.repeat(12)), [[[SODA, 72]], [[SODA, 72]]], 5, n);

describe('lives gate', () => {
  it('without lives: close returns home, nothing starts', async () => {
    const h = new Harness();
    h.meta.livesLeft = 0;
    await h.start();
    h.ui.answer('home', 'play');
    await h.until(() => h.ui.isOpen('outOfLives'));
    expect(h.ui.last('outOfLives')).toMatchObject({ refillCost: 900, canAfford: false, videoReady: true });
    h.ui.answer('outOfLives', 'close');
    await h.until(() => h.ui.count('home') === 2);
    expect(h.content.built).toEqual([]);
    expect(h.app.session).toBeNull();
  });

  it('refill for coins, then the level starts', async () => {
    const h = new Harness();
    h.meta.livesLeft = 0;
    h.meta.coins = 1000;
    await h.start();
    h.ui.answer('home', 'play');
    await h.until(() => h.ui.isOpen('outOfLives'));
    h.ui.answer('outOfLives', 'coins');
    await h.until(() => h.running);
    expect(h.meta.coins).toBe(100);
    expect(h.meta.livesLeft).toBe(5);
    h.order('ui.outOfLives', 'meta.spendCoins:900:lives', 'meta.refillLives', 'scene.load');
  });

  it('coins it cannot afford keep the card open; a video gives one life for one attempt', async () => {
    const h = new Harness();
    h.meta.livesLeft = 0;
    h.content.custom.set(1, () => quickWin(1));
    h.meta.seen.add('basics');
    await h.start();
    h.ui.answer('home', 'play');
    await h.until(() => h.ui.isOpen('outOfLives'));
    h.ui.answer('outOfLives', 'coins');
    await h.until(() => h.ui.count('outOfLives') === 2);
    expect(h.ui.toasts).toContain('Not enough coins');
    h.ui.answer('outOfLives', 'video');
    await h.until(() => h.running);
    expect(h.ads.shown).toEqual(['lives']);
    expect(h.log).toContain('meta.addLives:1');
    expect(h.ui.toasts).toContain('+1 life');
    // giving up that attempt uses the life: the next restart asks again
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
    h.ui.answer('pause', 'restart');
    await h.until(() => h.ui.isOpen('outOfLives'));
    h.ui.answer('outOfLives', 'close');
    await h.until(() => h.ui.isOpen('home'));
  });

  it('unlimited lives skip the gate', async () => {
    const h = new Harness();
    h.meta.livesLeft = 0;
    h.meta.unlimitedUntil = h.clock.now() + 60_000;
    h.content.custom.set(1, () => quickWin(1));
    await h.start();
    h.ui.answer('home', 'play');
    await h.until(() => h.running);
    expect(h.ui.count('outOfLives')).toBe(0);
  });
});

describe('before the level', () => {
  it('shows each newly unlocked booster, then the intro card once, over the loaded board', async () => {
    const h = new Harness();
    h.meta.level = 9;
    h.content.custom.set(9, () => slowLevel(9));
    h.content.metas.set(9, { intro: 'mystery' });
    await h.start();
    h.ui.answer('home', 'play');
    await h.until(() => h.running);
    h.order('scene.load', 'meta.unlockBoostersUpTo:9:slot,shuffle,nap', 'ui.boosterUnlock', 'ui.boosterUnlock', 'ui.boosterUnlock', 'ui.intro', 'meta.markIntroSeen:mystery');
    expect(h.ui.calls.filter(c => c.m === 'boosterUnlock').map(c => c.a)).toEqual([['slot', 3], ['shuffle', 3], ['nap', 3]]);
    expect(h.ui.last('intro')).toBe('mystery');
    expect(h.ui.calls.find(c => c.m === 'intro')!.a[1]).toEqual({ title: 'title:mystery', body: 'body:mystery' });
    expect(h.analytics.named('level_start')).toHaveLength(1); // the clock starts after the cards
    expect(h.ui.hud.bar.filter(b => b.unlocked).map(b => [b.key, b.count])).toEqual([['slot', 3], ['shuffle', 3], ['nap', 3]]);
    expect(h.ui.hud.modeNow).toBe('play');
    expect(h.ui.hud.level).toEqual([9, false]);
    expect(h.audio.track).toBe('play');
    expect(h.audio.played.filter(s => s === 'unlock')).toHaveLength(3);

    // the game clock does not run while a card is open
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
    h.ui.answer('pause', 'home');
    await h.until(() => h.ui.count('home') === 2);
    h.ui.answer('home', 'play');
    await h.until(() => h.running);
    expect(h.ui.count('intro')).toBe(1);
    expect(h.ui.count('boosterUnlock')).toBe(3);
  });

  it('builds endless levels behind the loading veil', async () => {
    const h = new Harness();
    h.meta.level = 61;
    h.content.custom.set(61, () => slowLevel(61));
    await h.start();
    h.ui.answer('home', 'play');
    await h.until(() => h.running);
    expect(h.ui.veilCalls.slice(-2)).toEqual([true, false]);
  });
});

describe('pause', () => {
  it('stops the clock; resume carries on', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => slowLevel());
    await h.start();
    await h.playFromHome();
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.run(300);
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
    expect(h.ui.calls.at(-1)!.a[0]).toBe('play');
    const tick = h.game.tick;
    await h.run(1000);
    expect(h.game.tick).toBe(tick);
    h.ui.answer('pause', 'resume');
    await h.run(300);
    expect(h.game.tick).toBeGreaterThan(tick);
    expect(h.meta.livesLeft).toBe(5);
  });

  it('restart spends a life and starts a fresh attempt', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => slowLevel());
    await h.start();
    await h.playFromHome();
    h.scene.tap({ kind: 'queue', q: 0 });
    const first = h.game;
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
    h.ui.answer('pause', 'restart');
    await h.until(() => h.running && h.game !== first);
    expect(h.meta.livesLeft).toBe(4);
    expect(h.game.riders).toHaveLength(0);
    expect(h.scene.loads).toBe(2);
    expect(h.ui.hud.livesInfo!.lives).toBe(4);
  });

  it('home spends a life, clears the field and goes back to the map', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => slowLevel());
    await h.start();
    await h.playFromHome();
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
    h.ui.answer('pause', 'home');
    await h.until(() => h.ui.count('home') === 2);
    expect(h.meta.livesLeft).toBe(4);
    expect(h.scene.game).toBeNull();
    expect(h.app.session).toBeNull();
    expect(h.audio.track).toBe('home');
    expect(h.analytics.named('level_quit')[0]!.params).toMatchObject({ level: 3, reason: 'home' });
  });

  it('settings changed in the pause card apply at once', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => slowLevel());
    await h.start();
    await h.playFromHome();
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
    h.ui.settingsCb!({ music: false, reduceMotion: 'on' });
    expect(h.audio.musicOn).toBe(false);
    expect(h.scene.reduced).toBe(true);
  });
});

describe('app in the background', () => {
  it('stops the clock and the sound, and shows the pause card on return', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => slowLevel());
    await h.start();
    await h.playFromHome();
    h.scene.tap({ kind: 'queue', q: 0 });
    await h.run(300);
    h.platform.setPaused(true);
    expect(h.audio.suspended).toBe(true);
    expect(h.meta.saves).toBe(1);
    const tick = h.game.tick, frames = h.scene.frames;
    await h.run(2000);
    expect(h.game.tick).toBe(tick);
    expect(h.scene.frames).toBe(frames);
    h.platform.setPaused(false);
    expect(h.audio.suspended).toBe(false);
    await h.until(() => h.ui.isOpen('pause'));
    expect(h.game.tick).toBe(tick);
    h.ui.answer('pause', 'resume');
    await h.run(300);
    expect(h.game.tick).toBeGreaterThan(tick);
  });

  it('on home it only pauses sound', async () => {
    const h = await new Harness().start();
    h.platform.setPaused(true);
    h.platform.setPaused(false);
    await h.run(300);
    expect(h.ui.count('pause')).toBe(0);
    expect(h.audio.suspended).toBe(false);
  });
});

describe('Android back during play', () => {
  it('opens the pause card, then closes it', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => slowLevel());
    await h.start();
    await h.playFromHome();
    expect(h.platform.back()).toBe(true);
    await h.until(() => h.ui.isOpen('pause'));
    expect(h.platform.back()).toBe(true);
    await h.until(() => h.running);
    expect(h.ui.isOpen('pause')).toBe(false);
  });
});

describe('the coin chip during play', () => {
  it('opens the shop over the paused board', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => make(['11', '11'], [[[CHERRY, 4]]], 5, 3));
    await h.start();
    await h.playFromHome();
    h.ui.hud.shopCb();
    await h.until(() => h.ui.isOpen('shop'));
    expect(h.running).toBe(false);
    h.ui.answer('shop');
    await h.until(() => h.running);
  });
});

describe('frame loop', () => {
  it('survives a frame that throws, and re-measures the HUD on resize', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => slowLevel());
    await h.start();
    await h.playFromHome();
    expect(h.scene.insets).toEqual({ top: 90, bottom: 110, left: 0, right: 0 });
    const frame = h.scene.frame.bind(h.scene);
    let threw = 0;
    h.scene.frame = (dt, f) => { if (!threw++) throw new Error('lost context'); frame(dt, f); };
    const errors: unknown[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => { errors.push(a); };
    try { await h.run(500); } finally { console.error = orig; }
    expect(threw).toBeGreaterThan(2);
    expect(errors).toHaveLength(1);
    h.scene.insets = null;
    h.events.dispatch('resize');
    expect(h.scene.insets).toEqual({ top: 90, bottom: 110, left: 0, right: 0 });
  });
});
