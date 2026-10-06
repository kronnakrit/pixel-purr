import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMeta, memoryStorage, PROFILE_KEY, SAVE_DELAY_MS, type EconomyOverrides, type MetaStorage } from '../../src/meta';

const MIN = 60_000, HOUR = 60 * MIN;
/** Local wall-clock time in October 2026, so calendar-day tests hold in every time zone. */
const at = (day: number, h = 9, m = 0, s = 0) => new Date(2026, 9, day, h, m, s).getTime();
const T0 = at(6);

type Mem = ReturnType<typeof memoryStorage>;
async function setup(now = T0, eco?: EconomyOverrides, s: Mem = memoryStorage()) {
  const m = await loadMeta(now, eco, s);
  return { m, s };
}
const saved = (s: Mem) => JSON.parse(s.data.get(PROFILE_KEY) ?? 'null') as Record<string, unknown>;
/** Write a profile, then load it in a new session (like reopening the app). */
async function reopen(s: Mem, now: number, eco?: EconomyOverrides) {
  return loadMeta(now, eco, s);
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('fresh profile', () => {
  it('starts at level 1 with start coins, full lives and nothing unlocked', async () => {
    const { m } = await setup();
    expect(m.level).toBe(1);
    expect(m.coins).toBe(300);
    expect(m.lives(T0)).toEqual({ lives: 5, max: 5, nextInMs: null, unlimitedUntil: null });
    expect(m.hasLife(T0)).toBe(true);
    for (const k of ['slot', 'shuffle', 'nap', 'xray'] as const) {
      expect(m.isBoosterUnlocked(k)).toBe(false);
      expect(m.boosterCount(k)).toBe(0);
    }
    expect(m.stickers()).toEqual([]);
    expect(m.hasSeenIntro('basics')).toBe(false);
    expect(m.removeAds).toBe(false);
    expect(m.owns('cosy_bundle')).toBe(false);
    expect(m.settings).toEqual({ sound: true, music: true, vibration: true, reduceMotion: 'system' });
    expect(m.dailyGift(T0)).toEqual({ available: true, day: 1, reward: { coins: 50 } });
  });

  it('uses remote-config start numbers', async () => {
    const { m } = await setup(T0, { startCoins: 1000, maxLives: 3 });
    expect(m.coins).toBe(1000);
    expect(m.lives(T0)).toMatchObject({ lives: 3, max: 3 });
    expect(m.economy.startCoins).toBe(1000);
  });

  it('is written to storage after the debounce', async () => {
    const { s } = await setup();
    expect(s.writes).toBe(0);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(s.writes).toBe(1);
    expect(saved(s)).toMatchObject({ v: 1, level: 1, coins: 300, lives: 5 });
  });

  it('round-trips through storage', async () => {
    const { m, s } = await setup();
    m.addCoins(55, 'test');
    m.completeLevel(1, false, T0);
    m.spendLife(T0);
    m.unlockBoostersUpTo(4);
    m.useBooster('slot');
    m.markIntroSeen('basics');
    m.updateSettings({ music: false, reduceMotion: 'on' });
    m.grantUnlimitedLives(15, T0);
    m.applyPurchase('remove_ads');
    m.recordInterstitial(T0);
    await m.save();
    const r = await reopen(s, T0 + MIN);
    expect(r.snapshot()).toEqual(m.snapshot());
    expect(r.coins).toBe(300 + 55 + 20);
    expect(r.level).toBe(2);
    expect(r.lives(T0 + MIN)).toMatchObject({ lives: 4, unlimitedUntil: T0 + 15 * MIN });
    expect(r.boosterCount('slot')).toBe(2);
    expect(r.isBoosterUnlocked('slot')).toBe(true);
    expect(r.hasSeenIntro('basics')).toBe(true);
    expect(r.settings).toMatchObject({ music: false, reduceMotion: 'on' });
    expect(r.owns('remove_ads')).toBe(true);
    expect(r.removeAds).toBe(true);
  });
});

describe('repair on load', () => {
  const seeded = (json: string) => memoryStorage({ [PROFILE_KEY]: json });

  it.each([['not json', '{oops'], ['null', 'null'], ['a number', '42'], ['an array', '[1,2]'], ['a string', '"hi"'], ['empty', '']])(
    'starts fresh when the save is %s', async (_, json) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { m, s } = await setup(T0, undefined, seeded(json));
      expect(m.level).toBe(1);
      expect(m.coins).toBe(300);
      expect(m.lives(T0).lives).toBe(5);
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
      expect(saved(s)).toMatchObject({ v: 1, level: 1 }); // the broken save is replaced by a clean one
    });

  it('keeps a copy of a save that is not JSON', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = seeded('{"level": 40, "coins": 9');
    await setup(T0, undefined, s);
    expect(s.data.get(`${PROFILE_KEY}.corrupt`)).toBe('{"level": 40, "coins": 9');
  });

  it('keeps good fields and defaults wrong-typed ones', async () => {
    const { m } = await setup(T0, undefined, seeded(JSON.stringify({
      level: 'seven', coins: 1234, lives: 'five', livesAt: 'yesterday', unlimitedUntil: 'forever',
      boosters: { slot: 2, shuffle: -4, nap: 'many', xray: 1.9, rocket: 9 },
      unlocked: ['slot', 'rocket', 'slot', 7, 'shuffle'],
      stickers: [3, 1, 'x', 2, 2, 0, -1, 2.5],
      intros: ['basics', 'basics', 'dragons'],
      daily: { lastDay: 'monday', streak: 4 },
      owned: ['cosy_bundle', 'coins_pouch', 'gold_bar'],
      ads: { count: -2, lastAt: 'x', removeAdsOffered: 'yes' },
      starterOffered: 1,
      settings: { sound: false, music: 'loud', reduceMotion: 'sometimes' },
      junk: { deep: true },
    })));
    expect(m.coins).toBe(1234);
    expect(m.level).toBe(4); // bad level, but the stickers prove 1..3 were cleared
    expect(m.stickers()).toEqual([1, 2, 3]);
    expect(m.lives(T0)).toEqual({ lives: 5, max: 5, nextInMs: null, unlimitedUntil: null });
    expect([m.boosterCount('slot'), m.boosterCount('shuffle'), m.boosterCount('nap'), m.boosterCount('xray')]).toEqual([2, 0, 0, 1]);
    expect(m.isBoosterUnlocked('slot')).toBe(true);
    expect(m.isBoosterUnlocked('shuffle')).toBe(true);
    expect(m.snapshot().unlocked).toEqual(['slot', 'shuffle']);
    expect(m.snapshot().intros).toEqual(['basics']);
    expect(m.dailyGift(T0)).toMatchObject({ available: true, day: 1 });
    expect(m.owns('cosy_bundle')).toBe(true);
    expect(m.owns('coins_pouch')).toBe(false); // coin packs are never "owned"
    expect(m.removeAds).toBe(true); // owning the Cosy Bundle means no ads even without the flag
    expect(m.snapshot().ads).toEqual({ count: 0, lastAt: null, removeAdsOffered: false });
    expect(m.snapshot().starterOffered).toBe(false);
    expect(m.settings).toEqual({ sound: false, music: true, vibration: true, reduceMotion: 'system' });
    expect(m.snapshot()).not.toHaveProperty('junk');
  });

  it('clamps lives to the current maximum and restarts a regen clock that is in the future', async () => {
    const s = seeded(JSON.stringify({ level: 3, coins: 10, lives: 9, livesAt: T0 }));
    const { m } = await setup(T0, { maxLives: 4 }, s);
    expect(m.lives(T0)).toMatchObject({ lives: 4, max: 4, nextInMs: null });

    const s2 = seeded(JSON.stringify({ lives: 1, livesAt: T0 + 5 * HOUR }));
    const { m: m2 } = await setup(T0, undefined, s2);
    expect(m2.lives(T0)).toMatchObject({ lives: 1, nextInMs: 30 * MIN });
  });

  it('does not crash when storage cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken: MetaStorage = { get: () => Promise.reject(new Error('io')), set: () => Promise.reject(new Error('io')) };
    const m = await loadMeta(T0, undefined, broken);
    expect(m.level).toBe(1);
    m.addCoins(5, 'x');
    await expect(m.save()).resolves.toBeUndefined();
    expect(m.coins).toBe(305);
    expect(warn).toHaveBeenCalled();
  });

  it('does not overwrite the stored profile with a fresh one after a failed read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = seeded(JSON.stringify({ level: 30, coins: 5000 }));
    const real = s.get.bind(s);
    let fail = true;
    s.get = k => (fail ? Promise.reject(new Error('io')) : real(k));
    await loadMeta(T0, undefined, s);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 3);
    expect(s.writes).toBe(0);
    fail = false;
    expect((await loadMeta(T0, undefined, s)).level).toBe(30);
  });

  it('does not rewrite a save that is already clean', async () => {
    const { m, s } = await setup();
    await m.save();
    const before = s.writes;
    const r = await reopen(s, T0 + HOUR);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2);
    expect(s.writes).toBe(before);
    await r.save();
    expect(s.writes).toBe(before);
  });
});

describe('lives', () => {
  it('regenerate one every 30 minutes from the first one spent', async () => {
    const { m } = await setup();
    m.spendLife(T0);
    m.spendLife(T0 + 10 * MIN); // the clock keeps running from the first missing life
    expect(m.lives(T0 + 10 * MIN)).toMatchObject({ lives: 3, nextInMs: 20 * MIN });
    expect(m.lives(T0 + 29 * MIN)).toMatchObject({ lives: 3, nextInMs: MIN });
    expect(m.lives(T0 + 30 * MIN)).toMatchObject({ lives: 4, nextInMs: 30 * MIN });
    expect(m.lives(T0 + 59 * MIN + 59_000)).toMatchObject({ lives: 4, nextInMs: 1000 });
    expect(m.lives(T0 + 60 * MIN)).toMatchObject({ lives: 5, nextInMs: null });
    expect(m.lives(T0 + 10 * HOUR)).toMatchObject({ lives: 5, nextInMs: null }); // never above max
  });

  it('keep regenerating while the app is closed', async () => {
    const { m, s } = await setup();
    for (let i = 0; i < 5; i++) m.spendLife(T0);
    expect(m.lives(T0)).toMatchObject({ lives: 0, nextInMs: 30 * MIN });
    expect(m.hasLife(T0)).toBe(false);
    await m.save();

    const later = await reopen(s, T0 + 2 * HOUR + 5 * MIN);
    expect(later.lives(T0 + 2 * HOUR + 5 * MIN)).toMatchObject({ lives: 4, nextInMs: 25 * MIN });
    expect(later.hasLife(T0 + 2 * HOUR + 5 * MIN)).toBe(true);

    const muchLater = await reopen(s, T0 + 9 * HOUR);
    expect(muchLater.lives(T0 + 9 * HOUR)).toMatchObject({ lives: 5, nextInMs: null });
  });

  it('spending after partial regen keeps the earned lives and the running clock', async () => {
    const { m } = await setup();
    for (let i = 0; i < 3; i++) m.spendLife(T0); // 2 left
    m.spendLife(T0 + 45 * MIN); // 3 at 45 min, then spend → 2; next still due at 60 min
    expect(m.lives(T0 + 45 * MIN)).toMatchObject({ lives: 2, nextInMs: 15 * MIN });
    expect(m.lives(T0 + 60 * MIN)).toMatchObject({ lives: 3, nextInMs: 30 * MIN });
  });

  it('a spend when full starts a fresh 30-minute wait', async () => {
    const { m } = await setup();
    m.spendLife(T0);
    expect(m.lives(T0 + 3 * HOUR)).toMatchObject({ lives: 5 });
    m.spendLife(T0 + 3 * HOUR);
    expect(m.lives(T0 + 3 * HOUR)).toMatchObject({ lives: 4, nextInMs: 30 * MIN });
  });

  it('never go below zero', async () => {
    const { m } = await setup();
    for (let i = 0; i < 8; i++) m.spendLife(T0);
    expect(m.lives(T0).lives).toBe(0);
    expect(m.lives(T0 + 30 * MIN).lives).toBe(1);
  });

  it('survive the phone clock moving back', async () => {
    const { m } = await setup();
    m.spendLife(T0);
    expect(m.lives(T0 - HOUR)).toMatchObject({ lives: 4, nextInMs: 30 * MIN });
    m.spendLife(T0 - HOUR); // the wait restarts from the earlier time instead of stalling
    expect(m.lives(T0 - HOUR + 30 * MIN)).toMatchObject({ lives: 4 });
  });

  it('refill to the maximum', async () => {
    const { m } = await setup();
    for (let i = 0; i < 4; i++) m.spendLife(T0);
    m.refillLives(T0 + MIN);
    expect(m.lives(T0 + MIN)).toMatchObject({ lives: 5, nextInMs: null });
    m.spendLife(T0 + 2 * MIN);
    expect(m.lives(T0 + 2 * MIN)).toMatchObject({ lives: 4, nextInMs: 30 * MIN });
  });

  it('a rewarded extra life adds one, keeps the regen clock, and never goes above max', async () => {
    const { m } = await setup();
    for (let i = 0; i < 5; i++) m.spendLife(T0);
    m.addLives(1, T0 + 10 * MIN);
    expect(m.lives(T0 + 10 * MIN)).toMatchObject({ lives: 1, nextInMs: 20 * MIN });
    expect(m.lives(T0 + 30 * MIN)).toMatchObject({ lives: 2, nextInMs: 30 * MIN });
    m.addLives(9, T0 + 30 * MIN);
    expect(m.lives(T0 + 30 * MIN)).toMatchObject({ lives: 5, nextInMs: null });
    m.addLives(0, T0 + 30 * MIN);
    m.addLives(-2, T0 + 30 * MIN);
    expect(m.lives(T0 + 30 * MIN).lives).toBe(5);
  });

  it('follow remote-config regen time', async () => {
    const { m } = await setup(T0, { lifeRegenMin: 20 });
    m.spendLife(T0);
    expect(m.lives(T0)).toMatchObject({ nextInMs: 20 * MIN });
    expect(m.lives(T0 + 20 * MIN)).toMatchObject({ lives: 5, nextInMs: null });
  });
});

describe('unlimited lives', () => {
  it('make spending free until they run out', async () => {
    const { m } = await setup();
    for (let i = 0; i < 5; i++) m.spendLife(T0);
    m.grantUnlimitedLives(30, T0);
    expect(m.lives(T0)).toMatchObject({ lives: 0, unlimitedUntil: T0 + 30 * MIN });
    expect(m.hasLife(T0)).toBe(true);
    m.spendLife(T0 + MIN);
    m.refillLives(T0 + MIN);
    m.spendLife(T0 + 2 * MIN);
    expect(m.lives(T0 + 2 * MIN).lives).toBe(5);
    expect(m.lives(T0 + 30 * MIN).unlimitedUntil).toBeNull();
    m.spendLife(T0 + 30 * MIN);
    expect(m.lives(T0 + 30 * MIN).lives).toBe(4);
  });

  it('extend from the current end while active, from now once expired', async () => {
    const { m } = await setup();
    m.grantUnlimitedLives(30, T0);
    m.grantUnlimitedLives(30, T0 + 10 * MIN);
    expect(m.lives(T0 + 10 * MIN).unlimitedUntil).toBe(T0 + 60 * MIN);
    m.grantUnlimitedLives(15, T0 + 2 * HOUR);
    expect(m.lives(T0 + 2 * HOUR).unlimitedUntil).toBe(T0 + 2 * HOUR + 15 * MIN);
  });

  it('ignore nonsense durations', async () => {
    const { m } = await setup();
    m.grantUnlimitedLives(0, T0);
    m.grantUnlimitedLives(-5, T0);
    m.grantUnlimitedLives(Number.NaN, T0);
    expect(m.lives(T0).unlimitedUntil).toBeNull();
  });
});

describe('coins', () => {
  it('add and spend without going negative', async () => {
    const { m } = await setup();
    m.addCoins(200, 'test');
    expect(m.coins).toBe(500);
    expect(m.spendCoins(900, 'refill')).toBe(false);
    expect(m.coins).toBe(500);
    expect(m.spendCoins(500, 'booster')).toBe(true);
    expect(m.coins).toBe(0);
    expect(m.spendCoins(0, 'nothing')).toBe(true);
    expect(m.spendCoins(1, 'x')).toBe(false);
  });

  it('ignore negative, fractional and non-finite amounts', async () => {
    const { m } = await setup();
    m.addCoins(-100, 'x');
    m.addCoins(Number.NaN, 'x');
    m.addCoins(Infinity, 'x');
    expect(m.coins).toBe(300);
    m.addCoins(10.8, 'x');
    expect(m.coins).toBe(310);
    expect(m.spendCoins(-50, 'x')).toBe(false);
    expect(m.spendCoins(Number.NaN, 'x')).toBe(false);
    expect(m.coins).toBe(310);
  });
});

describe('boosters', () => {
  it('unlock in level order with 3 free each, once', async () => {
    const { m } = await setup();
    expect(m.unlockBoostersUpTo(1)).toEqual([]);
    expect(m.unlockBoostersUpTo(3)).toEqual([]);
    expect(m.unlockBoostersUpTo(4)).toEqual(['slot']);
    expect(m.boosterCount('slot')).toBe(3);
    expect(m.unlockBoostersUpTo(5)).toEqual([]);
    expect(m.unlockBoostersUpTo(4)).toEqual([]);
    expect(m.unlockBoostersUpTo(13)).toEqual(['shuffle', 'nap', 'xray']);
    expect(m.boosterCount('slot')).toBe(3);
    expect(m.boosterCount('xray')).toBe(3);
    expect(m.unlockBoostersUpTo(99)).toEqual([]);
  });

  it('catch up all at once in unlock order', async () => {
    const { m } = await setup();
    expect(m.unlockBoostersUpTo(20)).toEqual(['slot', 'shuffle', 'nap', 'xray']);
    expect(m.snapshot().unlocked).toEqual(['slot', 'shuffle', 'nap', 'xray']);
  });

  it('add the free ones on top of boosters already owned', async () => {
    const { m } = await setup();
    m.applyPurchase('starter_bundle');
    expect(m.boosterCount('xray')).toBe(2);
    expect(m.isBoosterUnlocked('xray')).toBe(false);
    m.unlockBoostersUpTo(13);
    expect(m.boosterCount('xray')).toBe(5);
  });

  it('follow remote-config unlock levels and free count', async () => {
    const { m } = await setup(T0, { freeBoostersOnUnlock: 1, boosters: { xray: { unlock: 2 } } });
    expect(m.unlockBoostersUpTo(4)).toEqual(['xray', 'slot']);
    expect(m.boosterCount('xray')).toBe(1);
  });

  it('use one at a time until none are left', async () => {
    const { m } = await setup();
    m.unlockBoostersUpTo(4);
    expect(m.useBooster('slot')).toBe(true);
    expect(m.useBooster('slot')).toBe(true);
    expect(m.useBooster('slot')).toBe(true);
    expect(m.boosterCount('slot')).toBe(0);
    expect(m.useBooster('slot')).toBe(false);
    expect(m.boosterCount('slot')).toBe(0);
    expect(m.useBooster('nap')).toBe(false);
  });
});

describe('levels and stickers', () => {
  it('pays win coins, adds the sticker on the first clear and advances the level', async () => {
    const { m } = await setup();
    expect(m.completeLevel(1, false, T0)).toEqual({ coins: 20, firstClear: true });
    expect(m.coins).toBe(320);
    expect(m.level).toBe(2);
    expect(m.stickers()).toEqual([1]);
  });

  it('pays the spicy bonus', async () => {
    const { m } = await setup();
    expect(m.completeLevel(5, true, T0)).toEqual({ coins: 40, firstClear: true });
    expect(m.coins).toBe(340);
    expect(m.level).toBe(6);
  });

  it('replays pay coins but are not a first clear, and never move the level back', async () => {
    const { m } = await setup();
    for (let n = 1; n <= 3; n++) m.completeLevel(n, false, T0);
    expect(m.completeLevel(2, false, T0)).toEqual({ coins: 20, firstClear: false });
    expect(m.level).toBe(4);
    expect(m.stickers()).toEqual([1, 2, 3]);
    expect(m.coins).toBe(300 + 4 * 20);
  });

  it('keeps the Sticker Book sorted and returns a copy', async () => {
    const { m } = await setup();
    m.completeLevel(3, false, T0);
    m.completeLevel(1, false, T0);
    const list = m.stickers();
    list.push(99);
    expect(m.stickers()).toEqual([1, 3]);
    expect(m.level).toBe(4);
  });

  it('ignores invalid level numbers', async () => {
    const { m } = await setup();
    expect(m.completeLevel(0, false, T0)).toEqual({ coins: 0, firstClear: false });
    expect(m.completeLevel(2.5, false, T0)).toEqual({ coins: 0, firstClear: false });
    expect(m.coins).toBe(300);
    expect(m.level).toBe(1);
  });
});

describe('intro cards', () => {
  it('are remembered once seen', async () => {
    const { m, s } = await setup();
    m.markIntroSeen('tray');
    m.markIntroSeen('tray');
    expect(m.hasSeenIntro('tray')).toBe(true);
    expect(m.hasSeenIntro('spicy')).toBe(false);
    await m.save();
    expect(saved(s).intros).toEqual(['tray']);
  });
});

describe('daily gift', () => {
  it('can be claimed once per local calendar day', async () => {
    const { m } = await setup();
    expect(m.claimDailyGift(at(6, 9), false)).toEqual({ coins: 50 });
    expect(m.coins).toBe(350);
    expect(m.dailyGift(at(6, 23, 59, 59))).toEqual({ available: false, day: 1, reward: { coins: 50 } });
    expect(m.claimDailyGift(at(6, 23, 59), false)).toEqual({});
    expect(m.coins).toBe(350);
    expect(m.dailyGift(at(7, 0, 0, 1))).toEqual({ available: true, day: 2, reward: { coins: 75 } });
  });

  it('walks the 7-day ladder and repeats day 7', async () => {
    const { m } = await setup(at(1));
    const got = [];
    for (let d = 1; d <= 9; d++) {
      const g = m.dailyGift(at(d, 20));
      expect(g.available).toBe(true);
      got.push([g.day, m.claimDailyGift(at(d, 20), false)]);
    }
    expect(got).toEqual([
      [1, { coins: 50 }], [2, { coins: 75 }], [3, { boosters: { shuffle: 1 } }], [4, { coins: 100 }],
      [5, { boosters: { slot: 1 } }], [6, { coins: 150 }], [7, { coins: 250, unlimitedLivesMin: 30 }],
      [7, { coins: 250, unlimitedLivesMin: 30 }], [7, { coins: 250, unlimitedLivesMin: 30 }],
    ]);
    expect(m.coins).toBe(300 + 50 + 75 + 100 + 150 + 250 * 3);
    expect(m.boosterCount('shuffle')).toBe(1);
    expect(m.boosterCount('slot')).toBe(1);
    // Day 9's 30 minutes of unlimited lives started at its claim.
    expect(m.lives(at(9, 20)).unlimitedUntil).toBe(at(9, 20, 30));
  });

  it('continues across midnight but resets after a missed day', async () => {
    const { m } = await setup();
    m.claimDailyGift(at(6, 23, 58), false);
    expect(m.dailyGift(at(7, 0, 2)).day).toBe(2);
    m.claimDailyGift(at(7, 0, 2), false);
    expect(m.dailyGift(at(9, 12)).day).toBe(1); // skipped the 8th
    m.claimDailyGift(at(9, 12), false);
    expect(m.dailyGift(at(10, 12)).day).toBe(2);
  });

  it('continues over the end of summer time', async () => {
    const { m } = await setup(at(24));
    for (const d of [24, 25, 26]) m.claimDailyGift(at(d, 0, 30), false); // DST ends on the 25th in Europe
    expect(m.dailyGift(at(27, 23, 30)).day).toBe(4);
  });

  it('doubles coins only when doubled', async () => {
    const { m } = await setup(at(1));
    expect(m.claimDailyGift(at(1), true)).toEqual({ coins: 100 });
    m.claimDailyGift(at(2), false);
    expect(m.claimDailyGift(at(3), true)).toEqual({ boosters: { shuffle: 1 } });
    expect(m.boosterCount('shuffle')).toBe(1);
    expect(m.coins).toBe(300 + 100 + 75);
  });

  it('does not pay out again when the clock is moved back', async () => {
    const { m } = await setup();
    m.claimDailyGift(at(6), false);
    expect(m.dailyGift(at(5)).available).toBe(false);
    expect(m.claimDailyGift(at(5), false)).toEqual({});
    expect(m.dailyGift(at(7)).available).toBe(true);
  });

  it('remembers the streak across app restarts', async () => {
    const { m, s } = await setup();
    m.claimDailyGift(at(6), false);
    await m.save();
    const r = await reopen(s, at(7));
    expect(r.dailyGift(at(7))).toEqual({ available: true, day: 2, reward: { coins: 75 } });
  });

  it('returns copies that cannot change the economy', async () => {
    const { m } = await setup();
    const g = m.dailyGift(T0);
    g.reward.coins = 9999;
    expect(m.claimDailyGift(T0, false)).toEqual({ coins: 50 });
    expect(m.economy.daily[0]).toEqual({ coins: 50 });
  });
});

describe('grants and purchases', () => {
  it('grant adds coins, boosters, unlimited lives and Remove Ads', async () => {
    const { m } = await setup();
    m.grant({ coins: 100, boosters: { nap: 2, xray: 1 }, unlimitedLivesMin: 60, removeAds: true }, 'test', T0);
    expect(m.coins).toBe(400);
    expect(m.boosterCount('nap')).toBe(2);
    expect(m.boosterCount('xray')).toBe(1);
    expect(m.lives(T0).unlimitedUntil).toBe(T0 + HOUR);
    expect(m.removeAds).toBe(true);
  });

  it('grant defaults to the clock and ignores junk', async () => {
    const { m } = await setup();
    m.grant({ unlimitedLivesMin: 10 }, 'video');
    expect(m.lives(T0).unlimitedUntil).toBe(T0 + 10 * MIN);
    m.grant({ coins: -50, boosters: { slot: -2 } } as never, 'bad');
    m.grant(null as never, 'bad');
    expect(m.coins).toBe(300);
    expect(m.boosterCount('slot')).toBe(0);
  });

  it('coin packs pay every time and are never owned', async () => {
    const { m } = await setup();
    expect(m.applyPurchase('coins_pouch')).toEqual({ coins: 1000 });
    expect(m.applyPurchase('coins_pouch')).toEqual({ coins: 1000 });
    m.applyPurchase('coins_basket');
    m.applyPurchase('coins_jar');
    m.applyPurchase('coins_treasure');
    expect(m.coins).toBe(300 + 2000 + 5500 + 12000 + 28000);
    expect(m.owns('coins_pouch')).toBe(false);
  });

  it('the Cosy Bundle removes ads, adds boosters and coins, once', async () => {
    const { m } = await setup();
    const each = (n: number) => ({ slot: n, shuffle: n, nap: n, xray: n });
    expect(m.applyPurchase('cosy_bundle')).toEqual({ removeAds: true, boosters: each(3), coins: 2000 });
    expect(m.owns('cosy_bundle')).toBe(true);
    expect(m.removeAds).toBe(true);
    expect(m.coins).toBe(2300);
    expect(m.boosterCount('nap')).toBe(3);
    // A second delivery (store retry or restore) only re-confirms the lasting part.
    expect(m.applyPurchase('cosy_bundle')).toEqual({ removeAds: true });
    expect(m.coins).toBe(2300);
    expect(m.boosterCount('nap')).toBe(3);
  });

  it('the Starter Bundle pays once', async () => {
    const { m } = await setup();
    expect(m.applyPurchase('starter_bundle')).toEqual({ coins: 2500, boosters: { slot: 2, shuffle: 2, nap: 2, xray: 2 } });
    expect(m.owns('starter_bundle')).toBe(true);
    expect(m.applyPurchase('starter_bundle')).toEqual({});
    expect(m.coins).toBe(2800);
    expect(m.removeAds).toBe(false);
  });

  it('Remove Ads is owned and persisted', async () => {
    const { m, s } = await setup();
    expect(m.applyPurchase('remove_ads')).toEqual({ removeAds: true });
    expect(m.owns('remove_ads')).toBe(true);
    await m.save();
    expect(saved(s)).toMatchObject({ removeAds: true, owned: ['remove_ads'] });
  });

  it('restorePurchase gives back ownership and no ads without paying coins', async () => {
    const { m } = await setup();
    expect(m.restorePurchase('cosy_bundle')).toEqual({ removeAds: true });
    expect(m.owns('cosy_bundle')).toBe(true);
    expect(m.removeAds).toBe(true);
    expect(m.coins).toBe(300);
    expect(m.restorePurchase('coins_jar')).toEqual({});
    expect(m.coins).toBe(300);
  });

  it('returned rewards are copies', async () => {
    const { m } = await setup();
    const r = m.applyPurchase('starter_bundle');
    r.coins = 1;
    r.boosters!.slot = 99;
    expect(m.applyPurchase('coins_pouch')).toEqual({ coins: 1000 });
    expect(m.economy).toBeDefined();
    const { PRODUCTS } = await import('../../src/meta');
    expect(PRODUCTS.starter_bundle.reward).toEqual({ coins: 2500, boosters: { slot: 2, shuffle: 2, nap: 2, xray: 2 } });
  });
});

describe('interstitial policy', () => {
  const ok = { level: 12, afterLoss: false, now: T0 };

  it('starts at level 10', async () => {
    const { m } = await setup();
    expect(m.mayShowInterstitial({ ...ok, level: 9 })).toBe(false);
    expect(m.mayShowInterstitial({ ...ok, level: 10 })).toBe(true);
  });

  it('never right after a loss', async () => {
    const { m } = await setup();
    expect(m.mayShowInterstitial({ ...ok, afterLoss: true })).toBe(false);
  });

  it('at most one every 3 minutes', async () => {
    const { m } = await setup();
    m.recordInterstitial(T0);
    expect(m.mayShowInterstitial({ ...ok, now: T0 + 179_999 })).toBe(false);
    expect(m.mayShowInterstitial({ ...ok, now: T0 + 180_000 })).toBe(true);
    expect(m.mayShowInterstitial({ ...ok, now: T0 - MIN })).toBe(false); // clock moved back: no ad
  });

  it('never with Remove Ads or the Cosy Bundle', async () => {
    const a = await setup();
    a.m.applyPurchase('remove_ads');
    expect(a.m.mayShowInterstitial(ok)).toBe(false);
    const b = await setup();
    b.m.applyPurchase('cosy_bundle');
    expect(b.m.mayShowInterstitial(ok)).toBe(false);
  });

  it('follows remote config', async () => {
    const { m } = await setup(T0, { interstitial: { fromLevel: 20, minGapSec: 60 } });
    expect(m.mayShowInterstitial({ ...ok, level: 19 })).toBe(false);
    m.recordInterstitial(T0);
    expect(m.mayShowInterstitial({ ...ok, level: 20, now: T0 + MIN })).toBe(true);
  });

  it('remembers the last one across restarts', async () => {
    const { m, s } = await setup();
    m.recordInterstitial(T0);
    await m.save();
    const r = await reopen(s, T0 + MIN);
    expect(r.mayShowInterstitial({ ...ok, now: T0 + MIN })).toBe(false);
    expect(r.snapshot().ads.count).toBe(1);
  });
});

describe('offer moments', () => {
  it('Remove Ads offer fires exactly once, at the 3rd interstitial', async () => {
    const { m, s } = await setup();
    m.recordInterstitial(T0);
    expect(m.takeRemoveAdsOfferMoment()).toBe(false);
    m.recordInterstitial(T0 + 4 * MIN);
    expect(m.takeRemoveAdsOfferMoment()).toBe(false);
    m.recordInterstitial(T0 + 8 * MIN);
    expect(m.takeRemoveAdsOfferMoment()).toBe(true);
    expect(m.takeRemoveAdsOfferMoment()).toBe(false);
    m.recordInterstitial(T0 + 12 * MIN);
    expect(m.takeRemoveAdsOfferMoment()).toBe(false);
    await m.save();
    expect((await reopen(s, T0 + HOUR)).takeRemoveAdsOfferMoment()).toBe(false);
  });

  it('Remove Ads offer still fires once if the count is already past the threshold', async () => {
    const { m } = await setup(T0, { removeAdsAfterInterstitials: 2 });
    for (let i = 0; i < 4; i++) m.recordInterstitial(T0 + i * 4 * MIN);
    expect(m.takeRemoveAdsOfferMoment()).toBe(true);
    expect(m.takeRemoveAdsOfferMoment()).toBe(false);
  });

  it('Remove Ads offer never fires for players who already have no ads', async () => {
    const { m } = await setup();
    m.applyPurchase('cosy_bundle');
    for (let i = 0; i < 3; i++) m.recordInterstitial(T0 + i * 4 * MIN);
    expect(m.takeRemoveAdsOfferMoment()).toBe(false);
  });

  it('Starter Bundle offer fires once, after level 5', async () => {
    const { m, s } = await setup();
    expect(m.takeStarterOfferMoment(4)).toBe(false);
    expect(m.takeStarterOfferMoment(5)).toBe(true);
    expect(m.takeStarterOfferMoment(5)).toBe(false);
    expect(m.takeStarterOfferMoment(6)).toBe(false);
    await m.save();
    expect((await reopen(s, T0)).takeStarterOfferMoment(7)).toBe(false);
  });

  it('Starter Bundle offer fires later for players who skipped past level 5', async () => {
    const { m } = await setup();
    expect(m.takeStarterOfferMoment(8)).toBe(true);
  });

  it('Starter Bundle offer never fires once it is owned', async () => {
    const { m } = await setup();
    m.applyPurchase('starter_bundle');
    expect(m.takeStarterOfferMoment(5)).toBe(false);
  });
});

describe('settings', () => {
  it('merge partial updates and ignore invalid values', async () => {
    const { m, s } = await setup();
    m.updateSettings({ sound: false });
    m.updateSettings({ reduceMotion: 'off' });
    m.updateSettings({ vibration: 'nope' as never, reduceMotion: 'maybe' as never, music: undefined });
    expect(m.settings).toEqual({ sound: false, music: true, vibration: true, reduceMotion: 'off' });
    await m.save();
    expect(saved(s).settings).toEqual({ sound: false, music: true, vibration: true, reduceMotion: 'off' });
  });

  it('returns a copy', async () => {
    const { m } = await setup();
    const st = m.settings as { sound: boolean };
    st.sound = false;
    expect(m.settings.sound).toBe(true);
  });
});

describe('saving', () => {
  it('debounces writes ~300 ms after the last change', async () => {
    const { m, s } = await setup();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    const base = s.writes;
    m.addCoins(1, 'a');
    await vi.advanceTimersByTimeAsync(200);
    m.addCoins(1, 'b'); // resets the wait
    await vi.advanceTimersByTimeAsync(200);
    expect(s.writes).toBe(base);
    await vi.advanceTimersByTimeAsync(100);
    expect(s.writes).toBe(base + 1);
    expect(saved(s).coins).toBe(302);
  });

  it('a burst of changes is one write', async () => {
    const { m, s } = await setup();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    const base = s.writes;
    m.completeLevel(1, false, T0);
    m.unlockBoostersUpTo(4);
    m.spendLife(T0);
    m.markIntroSeen('basics');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 3);
    expect(s.writes).toBe(base + 1);
  });

  it('save() flushes at once and cancels the pending write', async () => {
    const { m, s } = await setup();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    const base = s.writes;
    m.addCoins(7, 'x');
    await m.save();
    expect(s.writes).toBe(base + 1);
    expect(saved(s).coins).toBe(307);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2);
    expect(s.writes).toBe(base + 1);
  });

  it('queries do not write', async () => {
    const { m, s } = await setup();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    const base = s.writes;
    m.lives(T0 + HOUR); m.dailyGift(T0); m.mayShowInterstitial({ level: 20, afterLoss: false, now: T0 });
    m.boosterCount('slot'); m.stickers(); void m.settings;
    m.useBooster('slot'); // nothing to use: no change
    m.updateSettings({ sound: true }); // same value: no change
    expect(m.spendCoins(99999, 'x')).toBe(false);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2);
    expect(s.writes).toBe(base);
  });

  it('writes land in order even when storage is slow', async () => {
    // The first write is slow and the second fast: unless writes queue up, the older one would land last.
    const order: number[] = [];
    let calls = 0;
    const slow: MetaStorage = {
      get: async () => null,
      set: (_k, v) => new Promise(res => setTimeout(() => { order.push((JSON.parse(v) as { coins: number }).coins); res(); }, calls++ === 0 ? 50 : 10)),
    };
    const m = await loadMeta(T0, undefined, slow);
    m.addCoins(1, 'a');
    const a = m.save();
    m.addCoins(1, 'b');
    const b = m.save();
    await vi.advanceTimersByTimeAsync(200);
    await Promise.all([a, b]);
    expect(order).toEqual([301, 302]);
  });

  it('keeps going when a write fails and retries on the next save', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = memoryStorage();
    const set = s.set.bind(s);
    let fail = true;
    s.set = async (k, v) => { if (fail) throw new Error('disk full'); return set(k, v); };
    const m = await loadMeta(T0, undefined, s);
    m.addCoins(5, 'x');
    await expect(m.save()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    fail = false;
    await m.save();
    expect(saved(s).coins).toBe(305);
  });

  it('notifies listeners after each change', async () => {
    const { m } = await setup();
    const seen: string[] = [];
    const off = m.onChange(r => seen.push(r));
    m.addCoins(5, 'shop');
    m.spendLife(T0);
    m.updateSettings({ music: false });
    off();
    m.addCoins(5, 'shop');
    expect(seen).toEqual(['coins:shop', 'life', 'settings']);
  });
});
