// Fake implementations of every module contract, a manual clock, and a harness that boots the real controller
// with them. Fakes push short entries to a shared log ("ui.win", "meta.completeLevel", ...) so tests can check order.
import { assemble, level as engineLevel, paramsFor, type Game, type GameEvent, type Level, type Picture, type Purrlet } from '../../src/engine';
import {
  BOOSTER_KEYS, type AdsApi, type AnalyticsApi, type AudioApi, type BoosterButtonState, type BoosterKey, type BoosterPrice,
  type ContentApi, type EconomyConfig, type FailInfo, type GameSceneApi, type HomeChoice, type HomeState, type HudApi, type IntroKey,
  type LevelMeta, type LivesInfo, type MetaApi, type OfferInfo, type PlatformApi, type Point, type Product, type ProductContents,
  type PauseOptions, type ProductId, type PurchaseFailure, type PurchasesApi, type ShopActions, type StoreTransaction, type RemoteConfigApi, type Reward, type RewardedPlacement, type ScreenInsets, type Settings,
  type Sfx, type ShopState, type TapTarget, type WinInfo,
} from '../../src/app/contracts';
import { App, type AppDeps } from '../../src/app/controller';
import type { AppUi } from '../../src/app/host';

export type Log = string[];

// ---------------------------------------------------------------- clock

/** Manual time: frame(ms) advances the wall clock and the animation clock together and runs the queued rafs. */
export class Clock {
  wall = Date.UTC(2026, 9, 6, 9, 0, 0);
  t = 1000;
  private cbs: ((t: number) => void)[] = [];
  now = (): number => this.wall;
  raf = (cb: (t: number) => void): number => { this.cbs.push(cb); return this.cbs.length; };
  frame(ms = 33): void {
    this.t += ms;
    this.wall += ms;
    const c = this.cbs;
    this.cbs = [];
    c.forEach(f => f(this.t));
  }
}

// ---------------------------------------------------------------- content

/** A level from rows of colour digits and queues of [colour, ammo] (like test/game.test.ts). */
export function make(rows: string[], queues: [number, number][][], tray = 5, n = 1): Level {
  const h = rows.length, w = rows[0]!.length;
  const px = Uint8Array.from(rows.join(''), ch => parseInt(ch, 36));
  let id = 0;
  const Q: Purrlet[][] = queues.map((q, qi) => q.map(([c, a], d) => ({ id: id++, q: qi, d, c, a })));
  return { ...assemble({ w, h, px, name: 'test' }, Q, paramsFor(n)), tray };
}

const INTROS: Partial<Record<number, IntroKey>> = { 1: 'basics', 2: 'tray', 5: 'spicy', 7: 'mystery', 12: 'linked', 18: 'background' };

export class FakeContent implements ContentApi {
  shipped = 60;
  readonly custom = new Map<number, () => Level>();
  readonly metas = new Map<number, Partial<LevelMeta>>();
  readonly built: number[] = [];
  private cache = new Map<number, Level>();
  getLevel(n: number): Level {
    this.built.push(n);
    const f = this.custom.get(n);
    if (f) return f();
    let L = this.cache.get(n);
    if (!L) { L = engineLevel(n); this.cache.set(n, L); }
    return L;
  }
  levelMeta(n: number): LevelMeta {
    return { n, name: `Level ${n} picture`, spicy: n % 5 === 0, intro: INTROS[n] ?? null, unlocks: null, ...this.metas.get(n) };
  }
  levelPicture(n: number): Picture { return { w: 2, h: 2, px: new Uint8Array([1, 2, 3, 4]), name: `pic${n}` }; }
  introCard(k: IntroKey) { return { title: `title:${k}`, body: `body:${k}` }; }
}

// ---------------------------------------------------------------- meta

const price = (key: BoosterKey, name: string, unlock: number, p: number): BoosterPrice => ({ key, name, unlock, price: p, does: name });
export const TEST_ECONOMY: EconomyConfig = {
  startCoins: 300, maxLives: 5, lifeRegenMin: 30, refillLivesCost: 900, continueCost: 900, winCoins: 20, spicyWinCoins: 40,
  freeBoostersOnUnlock: 3,
  boosters: {
    slot: price('slot', 'Extra Cushion', 4, 900), shuffle: price('shuffle', 'Yarn Shuffle', 6, 600),
    nap: price('nap', 'Cat Nap', 9, 1200), xray: price('xray', 'X-Ray Specs', 13, 1500),
  },
  daily: [{ coins: 50 }],
  interstitial: { fromLevel: 10, minGapSec: 180 },
  starterBundleAfterLevel: 5,
  removeAdsAfterInterstitials: 3,
};

export const TEST_PRODUCTS: Record<ProductId, ProductContents> = {
  coins_pouch: { id: 'coins_pouch', reward: { coins: 1000 }, oneTime: false },
  coins_basket: { id: 'coins_basket', reward: { coins: 5500 }, oneTime: false },
  coins_jar: { id: 'coins_jar', reward: { coins: 12000 }, oneTime: false },
  coins_treasure: { id: 'coins_treasure', reward: { coins: 28000 }, oneTime: false },
  cosy_bundle: { id: 'cosy_bundle', reward: { removeAds: true, coins: 2000, boosters: { slot: 3, shuffle: 3, nap: 3, xray: 3 } }, oneTime: true },
  starter_bundle: { id: 'starter_bundle', reward: { coins: 2500, boosters: { slot: 2, shuffle: 2, nap: 2, xray: 2 } }, oneTime: true },
  remove_ads: { id: 'remove_ads', reward: { removeAds: true }, oneTime: true },
};

/** A small but faithful MetaApi: same rules as the real one, kept in memory, every change logged. */
export class FakeMeta implements MetaApi {
  readonly economy = TEST_ECONOMY;
  s: Settings = { sound: true, music: true, vibration: true, reduceMotion: 'system' };
  level = 1;
  coins = 300;
  livesLeft = 5;
  unlimitedUntil: number | null = null;
  boosters: Record<BoosterKey, number> = { slot: 0, shuffle: 0, nap: 0, xray: 0 };
  unlocked: BoosterKey[] = [];
  stickerList: number[] = [];
  seen = new Set<IntroKey>();
  dailyAvailable = true;
  owned = new Set<ProductId>();
  removeAds = false;
  interstitials = 0;
  lastInterstitial: number | null = null;
  removeAdsOffered = false;
  starterOffered = false;
  saves = 0;
  constructor(private readonly log: Log) {}

  private note(s: string) { this.log.push(`meta.${s}`); }
  get settings(): Settings { return { ...this.s }; }
  updateSettings(p: Partial<Settings>) { this.s = { ...this.s, ...p }; this.note('updateSettings'); }
  addCoins(n: number, reason: string) { this.coins += n; this.note(`addCoins:${n}:${reason}`); }
  spendCoins(n: number, reason: string) {
    if (n > this.coins) { this.note(`spendCoins:refused:${reason}`); return false; }
    this.coins -= n; this.note(`spendCoins:${n}:${reason}`); return true;
  }
  lives(now: number): LivesInfo {
    const unl = this.unlimitedUntil !== null && this.unlimitedUntil > now;
    return { lives: this.livesLeft, max: 5, nextInMs: this.livesLeft < 5 ? 1_800_000 : null, unlimitedUntil: unl ? this.unlimitedUntil : null };
  }
  spendLife(now: number) {
    this.note('spendLife');
    if (this.unlimitedUntil !== null && this.unlimitedUntil > now) return;
    if (this.livesLeft > 0) this.livesLeft--;
  }
  refillLives() { this.livesLeft = 5; this.note('refillLives'); }
  attempt: number | null = null;
  pending: { id: ProductId; at: number }[] = [];
  delivered = new Set<string>();
  beginAttempt(n: number) { this.attempt = n; this.note(`beginAttempt:${n}`); }
  endAttempt() { if (this.attempt !== null) this.note('endAttempt'); this.attempt = null; }
  notePendingPurchase(id: ProductId, now: number) { this.pending.push({ id, at: now }); this.note(`notePendingPurchase:${id}`); }
  settlePurchases(list: readonly StoreTransaction[], _now: number) {
    const out: { id: ProductId; reward: Reward }[] = [];
    for (const w of [...this.pending]) {
      const t = list.find(x => x.id === w.id && !this.delivered.has(x.txn));
      if (t) out.push({ id: w.id, reward: this.applyPurchase(w.id, t.txn) });
    }
    return out;
  }
  addLives(n: number, now: number) {
    this.note(`addLives:${n}`);
    if (this.unlimitedUntil !== null && this.unlimitedUntil > now) return;
    this.livesLeft = Math.min(5, this.livesLeft + n);
  }
  grantUnlimitedLives(min: number, now: number) { this.unlimitedUntil = now + min * 60_000; }
  boosterCount(k: BoosterKey) { return this.boosters[k]; }
  isBoosterUnlocked(k: BoosterKey) { return this.unlocked.includes(k); }
  useBooster(k: BoosterKey) {
    if (this.boosters[k] <= 0) return false;
    this.boosters[k]--; this.note(`useBooster:${k}`); return true;
  }
  unlockBoostersUpTo(n: number) {
    const fresh = BOOSTER_KEYS.filter(k => this.economy.boosters[k].unlock <= n && !this.unlocked.includes(k));
    for (const k of fresh) { this.unlocked.push(k); this.boosters[k] += this.economy.freeBoostersOnUnlock; }
    this.note(`unlockBoostersUpTo:${n}:${fresh.join(',')}`);
    return fresh;
  }
  completeLevel(n: number, spicy: boolean) {
    const coins = spicy ? this.economy.spicyWinCoins : this.economy.winCoins;
    this.coins += coins;
    const firstClear = !this.stickerList.includes(n);
    if (firstClear) this.stickerList.push(n);
    this.level = Math.max(this.level, n + 1);
    this.note(`completeLevel:${n}`);
    return { coins, firstClear };
  }
  stickers() { return [...this.stickerList]; }
  hasSeenIntro(k: IntroKey) { return this.seen.has(k); }
  markIntroSeen(k: IntroKey) { this.seen.add(k); this.note(`markIntroSeen:${k}`); }
  dailyGift() { return { available: this.dailyAvailable, day: 1, reward: { coins: 50 } as Reward }; }
  claimDailyGift(_now: number, doubled: boolean): Reward {
    const coins = doubled ? 100 : 50;
    this.coins += coins; this.dailyAvailable = false; this.note(`claimDailyGift:${doubled}`);
    return { coins };
  }
  grant(r: Reward, reason: string) {
    this.coins += r.coins ?? 0;
    for (const k of BOOSTER_KEYS) this.boosters[k] += r.boosters?.[k] ?? 0;
    if (r.removeAds) this.removeAds = true;
    this.note(`grant:${reason}`);
  }
  owns(id: ProductId) { return this.owned.has(id); }
  applyPurchase(id: ProductId, txn?: string | null): Reward {
    if (txn) { if (this.delivered.has(txn)) return {}; this.delivered.add(txn); }
    this.pending = this.pending.filter(x => x.id !== id);
    const p = TEST_PRODUCTS[id];
    if (p.oneTime) this.owned.add(id);
    this.grant(p.reward, `purchase:${id}`);
    this.note(`applyPurchase:${id}`);
    return p.reward;
  }
  restorePurchase(id: ProductId): Reward {
    const p = TEST_PRODUCTS[id];
    if (!p.oneTime) return {};
    this.owned.add(id);
    const r: Reward = p.reward.removeAds ? { removeAds: true } : {};
    if (r.removeAds) this.removeAds = true;
    this.note(`restorePurchase:${id}`);
    return r;
  }
  mayShowInterstitial(c: { level: number; afterLoss: boolean; now: number }) {
    const ok = !this.removeAds && !c.afterLoss && c.level >= this.economy.interstitial.fromLevel
      && (this.lastInterstitial === null || c.now - this.lastInterstitial >= this.economy.interstitial.minGapSec * 1000);
    this.note(`mayShowInterstitial:${c.level}:${c.afterLoss}:${ok}`);
    return ok;
  }
  recordInterstitial(now: number) { this.interstitials++; this.lastInterstitial = now; this.note('recordInterstitial'); }
  takeRemoveAdsOfferMoment() {
    const ok = !this.removeAdsOffered && !this.removeAds && this.interstitials >= this.economy.removeAdsAfterInterstitials;
    if (ok) this.removeAdsOffered = true;
    this.note(`takeRemoveAdsOfferMoment:${ok}`);
    return ok;
  }
  takeStarterOfferMoment(n: number) {
    const ok = !this.starterOffered && !this.owned.has('starter_bundle') && n >= this.economy.starterBundleAfterLevel;
    if (ok) this.starterOffered = true;
    this.note(`takeStarterOfferMoment:${ok}`);
    return ok;
  }
  save() { this.saves++; return Promise.resolve(); }
}

// ---------------------------------------------------------------- services

export class FakeAds implements AdsApi {
  ready = true;
  /** What the next rewarded videos resolve with. */
  reward = true;
  interstitialLoaded = true;
  shown: string[] = [];
  /** Hold rewarded videos open until release() (to test what happens meanwhile). */
  hold = false;
  private held: (() => void)[] = [];
  constructor(private readonly log: Log) {}
  init() { this.log.push('ads.init'); return Promise.resolve(); }
  rewardedReady() { return this.ready; }
  showRewarded(p: RewardedPlacement) {
    this.shown.push(p);
    this.log.push(`ads.showRewarded:${p}`);
    if (!this.hold) return Promise.resolve(this.reward);
    return new Promise<boolean>(r => this.held.push(() => r(this.reward)));
  }
  release() { this.held.splice(0).forEach(f => f()); }
  showInterstitial() { this.log.push(`ads.showInterstitial:${this.interstitialLoaded}`); return Promise.resolve(this.interstitialLoaded); }
  privacyOptionsRequired = false;
  showPrivacyOptions() { this.log.push('ads.showPrivacyOptions'); return Promise.resolve(); }
}

export class FakePurchases implements PurchasesApi {
  result: 'purchased' | 'cancelled' | 'failed' = 'purchased';
  restored: ProductId[] = [];
  lastFailure: PurchaseFailure | null = null;
  lastTransaction: string | null = null;
  txnCbs: ((l: StoreTransaction[]) => void)[] = [];
  /** Throw from restore() (store unreachable). */
  restoreFails = false;
  onTransactions(cb: (l: StoreTransaction[]) => void) { this.txnCbs.push(cb); }
  report(l: StoreTransaction[]) { this.txnCbs.forEach(f => f(l)); }
  list: Product[] = (Object.keys(TEST_PRODUCTS) as ProductId[]).map(id => ({ id, title: id, description: id, price: '$0.99' }));
  constructor(private readonly log: Log) {}
  init() { this.log.push('purchases.init'); return Promise.resolve(); }
  products() { return Promise.resolve(this.list); }
  buy(id: ProductId) { this.log.push(`purchases.buy:${id}`); return Promise.resolve(this.result); }
  restore() {
    this.log.push('purchases.restore');
    return this.restoreFails ? Promise.reject(new Error('offline')) : Promise.resolve(this.restored);
  }
}

export class FakeRemoteConfig implements RemoteConfigApi {
  values: Record<string, unknown> = {};
  constructor(private readonly log: Log) {}
  init() { this.log.push('remoteConfig.init'); return Promise.resolve(); }
  get<T>(key: string, fallback: T): T { return (key in this.values ? this.values[key] : fallback) as T; }
}

export class FakeAnalytics implements AnalyticsApi {
  events: { name: string; params?: Record<string, string | number | boolean> }[] = [];
  screens: string[] = [];
  event(name: string, params?: Record<string, string | number | boolean>) { this.events.push(params ? { name, params } : { name }); }
  screen(name: string) { this.screens.push(name); }
  named(name: string) { return this.events.filter(e => e.name === name); }
}

export class FakePlatform implements PlatformApi {
  native = false;
  os = 'web' as const;
  pauseCbs: ((p: boolean) => void)[] = [];
  backCbs: (() => boolean)[] = [];
  constructor(private readonly log: Log) {}
  ready() { this.log.push('platform.ready'); return Promise.resolve(); }
  onPause(cb: (paused: boolean) => void) { this.pauseCbs.push(cb); }
  onBack(cb: () => boolean) { this.backCbs.push(cb); }
  setPaused(p: boolean) { this.pauseCbs.forEach(f => f(p)); }
  back(): boolean { return this.backCbs.some(f => f()); }
  opened: string[] = [];
  openUrl(url: string) { this.opened.push(url); }
}

// ---------------------------------------------------------------- audio

export class FakeAudio implements AudioApi {
  played: Sfx[] = [];
  batches: GameEvent[][] = [];
  track: 'home' | 'play' | null = null;
  suspended = false;
  sound = true;
  musicOn = true;
  vibration = true;
  unlocks = 0;
  haptics: string[] = [];
  constructor(private readonly log: Log) {}
  unlock() { this.unlocks++; }
  play(s: Sfx) { this.played.push(s); }
  gameEvents(events: readonly GameEvent[], _game: Game) { this.batches.push([...events]); }
  music(t: 'home' | 'play' | null) { this.track = t; this.log.push(`audio.music:${t}`); }
  setSound(on: boolean) { this.sound = on; }
  setMusic(on: boolean) { this.musicOn = on; }
  setVibration(on: boolean) { this.vibration = on; }
  haptic(k: 'light' | 'medium' | 'success' | 'warning') { this.haptics.push(k); }
  suspend(on: boolean) { this.suspended = on; this.log.push(`audio.suspend:${on}`); }
  events(): GameEvent[] { return this.batches.flat(); }
}

// ---------------------------------------------------------------- scene

export class FakeScene implements GameSceneApi {
  game: Game | null = null;
  loads = 0;
  batches: GameEvent[][] = [];
  frames = 0;
  lastFrac = 0;
  insets: ScreenInsets | null = null;
  highlighted: TapTarget | null = null;
  reduced: boolean;
  /** When set, celebrate() waits for release(). */
  holdCelebrate = false;
  private celebrateDone: (() => void) | null = null;
  private tapCb: ((t: TapTarget) => void) | null = null;
  constructor(private readonly log: Log, reducedMotion: boolean) { this.reduced = reducedMotion; }
  setInsets(i: ScreenInsets) { this.insets = i; }
  resize() {}
  load(g: Game) { this.game = g; this.loads++; this.log.push('scene.load'); }
  apply(ev: readonly GameEvent[]) { this.batches.push([...ev]); }
  frame(_dt: number, f: number) { this.frames++; this.lastFrac = f; }
  onTap(cb: (t: TapTarget) => void) { this.tapCb = cb; }
  tap(t: TapTarget) { this.tapCb?.(t); }
  highlight(t: TapTarget | null) { this.highlighted = t; }
  celebrate() {
    this.log.push('scene.celebrate');
    if (!this.holdCelebrate) return Promise.resolve();
    return new Promise<void>(r => { this.celebrateDone = r; });
  }
  releaseCelebrate() { this.celebrateDone?.(); this.celebrateDone = null; }
  setReducedMotion(on: boolean) { this.reduced = on; }
  screenPoint(t: TapTarget | 'board' | 'dock'): Point | null {
    if (!this.game) return null;
    if (t === 'board') return { x: 195, y: 300 };
    if (t === 'dock') return { x: 40, y: 500 };
    return t.kind === 'queue' ? { x: 100 + t.q * 90, y: 700 } : { x: 60 + t.i * 60, y: 560 };
  }
  clear() { this.game = null; this.log.push('scene.clear'); }
  dispose() {}
  events(): GameEvent[] { return this.batches.flat(); }
}

// ---------------------------------------------------------------- ui

export class FakeHud implements HudApi {
  modeNow: 'home' | 'play' | 'hidden' = 'hidden';
  level: [number, boolean] | null = null;
  coins = -1;
  livesInfo: LivesInfo | null = null;
  livesCalls = 0;
  bar: BoosterButtonState[] = [];
  barCalls = 0;
  boosterCb: (k: BoosterKey) => void = () => {};
  pauseCb: () => void = () => {};
  shopCb: () => void = () => {};
  dueCb: () => void = () => {};
  mode(m: 'home' | 'play' | 'hidden') { this.modeNow = m; }
  setLevel(n: number, spicy: boolean) { this.level = [n, spicy]; }
  setCoins(n: number) { this.coins = n; }
  setLives(l: LivesInfo) { this.livesInfo = l; this.livesCalls++; }
  setBoosters(b: BoosterButtonState[]) { this.bar = b.map(x => ({ ...x })); this.barCalls++; }
  onBooster(cb: (k: BoosterKey) => void) { this.boosterCb = cb; }
  onPause(cb: () => void) { this.pauseCb = cb; }
  onShop(cb: () => void) { this.shopCb = cb; }
  insets(): ScreenInsets { return { top: 90, bottom: 110, left: 0, right: 0 }; }
  coinChip(): Point { return { x: 340, y: 40 }; }
  boosterPoint(_k: BoosterKey): Point | null { return null; }
  onLivesDue(cb: () => void) { this.dueCb = cb; }
  button(k: BoosterKey) { return this.bar.find(b => b.key === k)!; }
}

type Modal = 'home' | 'intro' | 'boosterUnlock' | 'win' | 'fail' | 'pause' | 'shop' | 'stickerBook' | 'dailyGift' | 'outOfLives' | 'offer' | 'buyBooster' | 'coinsFly';
/** What the Android back button resolves an open card with (the real UI's closeTop does the same kind of thing). */
const ON_BACK: Partial<Record<Modal, unknown>> = {
  intro: undefined, boosterUnlock: undefined, win: 'continue', fail: 'giveup', pause: 'resume', shop: undefined, stickerBook: undefined,
  dailyGift: 'claim', outOfLives: 'close', offer: 'close', buyBooster: 'close',
};

/** UI whose cards stay open until the test answers them, unless an auto-answer is set for that card. */
export class FakeUi implements AppUi {
  readonly hud = new FakeHud();
  calls: { m: Modal; a: unknown[] }[] = [];
  pending = new Map<Modal, (v: unknown) => void>();
  auto: Partial<Record<Modal, (...a: never[]) => unknown>> = {
    intro: () => undefined, boosterUnlock: () => undefined, coinsFly: () => undefined, offer: () => 'close', win: () => 'continue',
  };
  toasts: string[] = [];
  tut: { text: string; at: Point | null } | null = null;
  tutCalls = 0;
  veil = false;
  veilCalls: boolean[] = [];
  rm: boolean | null = null;
  settingsCb: ((p: Partial<Settings>) => void) | null = null;
  shopActions: ShopActions | null = null;
  sfxCb: ((s: Sfx) => void) | null = null;
  covered = false;
  pauseOpts: PauseOptions | undefined = undefined;
  constructor(private readonly log: Log) {}

  private ask<T>(m: Modal, a: unknown[]): Promise<T> {
    this.log.push(`ui.${m}`);
    this.calls.push({ m, a });
    const f = this.auto[m] as ((...x: unknown[]) => unknown) | undefined;
    if (f) return Promise.resolve(f(...a) as T);
    if (this.pending.has(m) && m !== 'home') throw new Error(`ui.${m} opened twice`);
    return new Promise<T>(r => this.pending.set(m, r as (v: unknown) => void));
  }
  isOpen(m: Modal) { return this.pending.has(m); }
  answer(m: Modal, v?: unknown) {
    const r = this.pending.get(m);
    if (!r) throw new Error(`ui.${m} is not open (open: ${[...this.pending.keys()].join(', ')})`);
    this.pending.delete(m);
    r(v);
  }
  last<T = unknown>(m: Modal): T { const c = this.calls.filter(x => x.m === m).at(-1); if (!c) throw new Error(`ui.${m} never called`); return c.a[0] as T; }
  count(m: Modal) { return this.calls.filter(x => x.m === m).length; }

  mount() {}
  home(s: HomeState) { return this.ask<HomeChoice>('home', [s]); }
  intro(k: IntroKey, card: { title: string; body: string }) { return this.ask<void>('intro', [k, card]); }
  boosterUnlock(k: BoosterKey, free: number) { return this.ask<void>('boosterUnlock', [k, free]); }
  win(w: WinInfo) { return this.ask<'continue' | 'double'>('win', [w]); }
  fail(f: FailInfo) { return this.ask<'coins' | 'video' | 'giveup'>('fail', [f]); }
  pause(mode: 'play' | 'home', s: Settings, onChange: (p: Partial<Settings>) => void, opts?: PauseOptions) {
    this.settingsCb = onChange;
    this.pauseOpts = opts;
    return this.ask<'resume' | 'restart' | 'home'>('pause', [mode, s]);
  }
  shop(s: ShopState, actions: ShopActions) { this.shopActions = actions; return this.ask<void>('shop', [s]); }
  stickerBook(items: { n: number; name: string; picture: Picture }[]) { return this.ask<void>('stickerBook', [items]); }
  dailyGift(g: { day: number; reward: Reward; videoReady: boolean }) { return this.ask<'claim' | 'double'>('dailyGift', [g]); }
  outOfLives(l: LivesInfo, refillCost: number, canAfford: boolean, videoReady: boolean) {
    return this.ask<'coins' | 'video' | 'close'>('outOfLives', [{ l, refillCost, canAfford, videoReady }]);
  }
  offer(o: OfferInfo) { return this.ask<'buy' | 'close'>('offer', [o]); }
  buyBooster(k: BoosterKey, price: number, canAfford: boolean, videoReady: boolean) {
    return this.ask<'buy' | 'video' | 'close'>('buyBooster', [{ k, price, canAfford, videoReady }]);
  }
  toast(text: string) { this.toasts.push(text); this.log.push(`ui.toast:${text}`); }
  coinsFly(from: Point, amount: number) { return this.ask<void>('coinsFly', [{ from, amount }]); }
  tutorial(step: { text: string; at: Point | null } | null) { this.tut = step; this.tutCalls++; }
  loading(on: boolean) { this.veil = on; this.veilCalls.push(on); }
  setReducedMotion(on: boolean) { this.rm = on; }
  closeTop(): boolean {
    for (const m of [...this.pending.keys()].reverse()) {
      if (m === 'home' || !(m in ON_BACK)) continue;
      this.answer(m, ON_BACK[m]);
      return true;
    }
    return false;
  }
  onSfx(cb: (s: Sfx) => void) { this.sfxCb = cb; }
}

// ---------------------------------------------------------------- harness

class FakeEvents {
  private cbs = new Map<string, Set<() => void>>();
  addEventListener(type: string, cb: () => void) { (this.cbs.get(type) ?? this.cbs.set(type, new Set()).get(type)!).add(cb); }
  removeEventListener(type: string, cb: () => void) { this.cbs.get(type)?.delete(cb); }
  dispatch(type: string) { [...(this.cbs.get(type) ?? [])].forEach(f => f()); }
}

export interface HarnessOptions {
  /** Engine steps per second from remote config (tests default to the fastest allowed, 120). */
  rate?: number;
  /** prefers-reduced-motion */
  systemReduce?: boolean;
  deps?: Partial<AppDeps>;
}

export class Harness {
  readonly log: Log = [];
  readonly clock = new Clock();
  readonly content = new FakeContent();
  readonly meta = new FakeMeta(this.log);
  readonly ads = new FakeAds(this.log);
  readonly purchases = new FakePurchases(this.log);
  readonly remote = new FakeRemoteConfig(this.log);
  readonly analytics = new FakeAnalytics();
  readonly platform = new FakePlatform(this.log);
  readonly audio = new FakeAudio(this.log);
  readonly ui = new FakeUi(this.log);
  readonly events = new FakeEvents();
  scene!: FakeScene;
  readonly app: App;
  economySeen: unknown = 'not loaded';
  started = false;

  constructor(o: HarnessOptions = {}) {
    this.remote.values.beltStepsPerSec = o.rate ?? 120;
    const mq = { matches: o.systemReduce ?? false };
    this.app = new App({
      content: this.content,
      meta: async economy => { this.economySeen = economy; this.log.push('meta.load'); return this.meta; },
      ads: this.ads, purchases: this.purchases, remoteConfig: this.remote, analytics: this.analytics, platform: this.platform,
      audio: this.audio, ui: this.ui,
      createScene: ({ reducedMotion }) => (this.scene = new FakeScene(this.log, reducedMotion)),
      now: this.clock.now, raf: this.clock.raf,
      products: TEST_PRODUCTS,
      events: this.events,
      matchMedia: () => mq,
      boosterPoint: k => ({ x: 40 + BOOSTER_KEYS.indexOf(k) * 90, y: 780 }),
      viewport: () => ({ w: 390, h: 844 }),
      ...o.deps,
    });
  }

  /** Boot and wait for the home screen. */
  async start(): Promise<this> {
    const p = this.app.start().then(() => { this.started = true; });
    await this.until(() => this.started && this.ui.isOpen('home'));
    await p;
    return this;
  }

  async flush(): Promise<void> { for (let i = 0; i < 4; i++) await new Promise<void>(r => setImmediate(r)); }

  /** Run frames (100 ms each, the controller's longest step) until cond() holds. */
  async until(cond: () => boolean, maxMs = 120_000, step = 100): Promise<void> {
    for (let t = 0; ; t += step) {
      await this.flush();
      if (cond()) return;
      if (t > maxMs) throw new Error(`timed out waiting for: ${cond.toString()}\nlog tail: ${this.log.slice(-12).join(' | ')}`);
      this.clock.frame(step);
    }
  }

  /** Let `ms` of frame time pass. */
  async run(ms: number, step = 100): Promise<void> {
    for (let t = 0; t < ms; t += step) { this.clock.frame(step); await this.flush(); }
  }

  get session() { return this.app.session; }
  get game(): Game { const s = this.app.session; if (!s) throw new Error('no session'); return s.game; }
  get running(): boolean { return !!this.app.session?.running; }

  /** Tap Play on the home screen and wait until the level's clock runs. */
  async playFromHome(): Promise<void> {
    this.ui.answer('home', 'play');
    await this.until(() => this.running);
  }

  /** Launch from a queue and let the belt run until it is empty or the game stops playing. */
  async launch(q: number): Promise<void> {
    this.scene.tap({ kind: 'queue', q });
    await this.until(() => !this.running || this.game.riders.length === 0);
  }

  /** Index of the current element in the log after `from` (for ordering checks). */
  at(entry: string | RegExp, from = 0): number {
    const i = this.log.findIndex((e, k) => k >= from && (typeof entry === 'string' ? e === entry : entry.test(e)));
    if (i < 0) throw new Error(`log has no ${String(entry)} after ${from}: ${this.log.slice(from).join(' | ')}`);
    return i;
  }

  /** Assert entries appear in this order in the log. */
  order(...entries: (string | RegExp)[]): void {
    let k = 0;
    for (const e of entries) k = this.at(e, k) + 1;
  }
}

/** One cherry pixel hidden inside a ring of soda: a cherry Purrlet launched first can't see it and parks. */
export const RING = ['666', '616', '666'];
export const CHERRY = 1, SODA = 6;
/** A 2x2 cherry square: one Purrlet with 4 paint wins in one lap. */
export const quickWin = (n = 1): Level => make(['11', '11'], [[[CHERRY, 4]]], 5, n);
