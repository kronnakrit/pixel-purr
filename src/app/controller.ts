// The game controller: boot, the home loop and its screens (shop, Sticker Book, daily gift, settings), and level
// play (lives gate, booster unlock and intro cards, attempts). It talks to every module only through the
// contracts, and gets time from injected now() / raf(), so tests drive it headlessly with fakes and a manual clock.
import type { Level } from '../engine';
import type {
  AdsApi, AnalyticsApi, AudioApi, BoosterKey, ContentApi, GameSceneApi, HomeChoice, HomeState, LevelMeta, MetaApi, PlatformApi,
  Point, Product, ProductContents, ProductId, PurchaseFailure, PurchasesApi, RemoteConfigApi, Reward, RewardedPlacement, Settings, ShopState,
} from './contracts';
import { BOOSTER_KEYS } from './contracts';
import type { AppUi, SessionHost } from './host';
import { Session } from './session';
import { describeReward, PRODUCT_IDS } from './text';

/** Longest frame step the clock takes; a longer hitch (or a return from the background) is not fast-forwarded. */
export const MAX_DT = 0.1;
export const DEFAULT_STEPS_PER_SEC = 36;
/** Levels drawn on the home map behind and ahead of the current one. */
export const MAP_BEHIND = 6;
export const MAP_AHEAD = 6;
/** Coins for the shop's optional video. */
export const SHOP_VIDEO_COINS = 100;
/** Longest wait for store set-up before showing the shop anyway. */
const STORE_WAIT_SEC = 3;
const FONT_WAIT_MS = 3000;

export type MetaLoader = (economy: Record<string, unknown> | undefined) => Promise<MetaApi>;

interface EventTargetLike {
  addEventListener(type: string, cb: () => void, opts?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, cb: () => void, opts?: boolean | EventListenerOptions): void;
}
interface MediaQueryLike { readonly matches: boolean; addEventListener?(type: 'change', cb: () => void): void }

export interface AppDeps {
  content: ContentApi;
  /** The saved profile, or a loader that gets remote config's `economy` overrides (loaded at boot). */
  meta: MetaApi | MetaLoader;
  ads: AdsApi;
  purchases: PurchasesApi;
  remoteConfig: RemoteConfigApi;
  analytics: AnalyticsApi;
  platform: PlatformApi;
  audio: AudioApi;
  ui: AppUi;
  createScene(o: { reducedMotion: boolean }): GameSceneApi;
  /** Wall clock, ms since epoch (lives, daily gift, ad gaps). */
  now(): number;
  /** requestAnimationFrame; the timestamp drives the game clock. */
  raf(cb: (t: number) => void): unknown;
  /** What each product grants (meta's PRODUCTS), for offers and the shop. */
  products?: Partial<Record<ProductId, ProductContents>>;
  fontsReady?(): Promise<void>;
  /** Where to listen for the first tap (audio unlock) and resizes. Defaults to window. */
  events?: EventTargetLike | null;
  /** Defaults to window.matchMedia; used when Reduce Motion follows the system. */
  matchMedia?: ((q: string) => MediaQueryLike) | null;
  /** Screen position of a booster button (level 4 hint). Falls back to an estimate from the HUD insets. */
  boosterPoint?(k: BoosterKey): Point | null;
  viewport?(): { w: number; h: number };
  /** Dev: wipe the saved profile; the loader then builds a fresh one. */
  resetProfile?(): Promise<void>;
}

type HomeCmd = { kind: 'choice'; c: HomeChoice } | { kind: 'play'; n: number } | { kind: 'refresh' };
export type Screen = 'boot' | 'home' | 'play';

export class App implements SessionHost {
  readonly content: ContentApi;
  readonly ads: AdsApi;
  readonly purchases: PurchasesApi;
  readonly analytics: AnalyticsApi;
  readonly audio: AudioApi;
  readonly ui: AppUi;
  readonly platform: PlatformApi;
  stepsPerSec = DEFAULT_STEPS_PER_SEC;
  /** Debug: how fast the belt runs relative to real time. */
  timeScale = 1;
  lostRecently = false;
  screen: Screen = 'boot';
  session: Session | null = null;

  private m: MetaApi | null = null;
  private sc: GameSceneApi | null = null;
  /** Open modals, innermost last. */
  private readonly modals: string[] = [];
  private readonly queued: HomeCmd[] = [];
  private wake: (() => void) | null = null;
  /** Foreground frame clock (s): stops in the background, drives wait() and the step clock. */
  private time = 0;
  private lastT: number | null = null;
  private timers: { at: number; done: () => void }[] = [];
  private frameWaiters: (() => void)[] = [];
  private bg = false;
  private adsOpen = 0;
  private clearFrames = 0;
  private frameFailed = false;
  private nextLivesTick = 0;
  private autoNext = false;
  private products: Product[] = [];
  private storeReady: Promise<void> = Promise.resolve();
  private mq: MediaQueryLike | null = null;

  constructor(private readonly deps: AppDeps) {
    this.content = deps.content;
    this.ads = deps.ads;
    this.purchases = deps.purchases;
    this.analytics = deps.analytics;
    this.audio = deps.audio;
    this.ui = deps.ui;
    this.platform = deps.platform;
  }

  get meta(): MetaApi { if (!this.m) throw new Error('meta is not loaded yet'); return this.m; }
  get scene(): GameSceneApi { if (!this.sc) throw new Error('the scene is not created yet'); return this.sc; }
  get modal(): string | null { return this.modals.at(-1) ?? null; }
  get openModals(): readonly string[] { return this.modals; }
  now(): number { return this.deps.now(); }

  // ---------------------------------------------------------------- boot

  /** Boot, then run the home loop in the background. Resolves once the first frame is out and the splash is hidden. */
  async start(): Promise<void> {
    const { ui, remoteConfig } = this;
    ui.loading(true);
    await Promise.all([
      // canvas text wants the fonts, but never hold the boot hostage to them
      this.deps.fontsReady ? Promise.race([this.deps.fontsReady().catch(() => {}), sleep(FONT_WAIT_MS)]) : null,
      remoteConfig.init().catch(e => console.warn('app: remote config failed, using defaults', e)),
    ]);
    const meta = this.deps.meta, economy = remoteConfig.get<unknown>('economy', undefined);
    this.m = typeof meta === 'function' ? await meta(isRecord(economy) ? economy : undefined) : meta;
    const rate = remoteConfig.get<unknown>('beltStepsPerSec', DEFAULT_STEPS_PER_SEC);
    this.stepsPerSec = typeof rate === 'number' && rate >= 6 && rate <= 120 ? rate : DEFAULT_STEPS_PER_SEC;
    // Store and ad SDKs start in the background; nothing on the home screen waits for them.
    this.storeReady = Promise.allSettled([this.ads.init(), this.purchases.init()]).then(r => {
      r.forEach(x => { if (x.status === 'rejected') console.warn('app: service init failed', x.reason); });
    });
    const mm = this.deps.matchMedia !== undefined ? this.deps.matchMedia : typeof matchMedia === 'function' ? matchMedia.bind(globalThis) : null;
    this.mq = mm?.('(prefers-reduced-motion: reduce)') ?? null;
    this.mq?.addEventListener?.('change', () => this.applySettings());
    this.sc = this.deps.createScene({ reducedMotion: this.reducedMotion() });
    this.wire();
    this.applySettings();
    this.syncHud();
    this.deps.raf(this.frame);
    void this.homeLoop();
    await this.nextFrame();
    ui.loading(false);
    this.analytics.event('app_start', { level: this.meta.level, coins: this.meta.coins });
    await this.platform.ready().catch(e => console.warn('app: platform ready failed', e));
  }

  private get remoteConfig(): RemoteConfigApi { return this.deps.remoteConfig; }

  private wire(): void {
    const { ui, scene, audio, platform } = this, hud = ui.hud;
    scene.onTap(t => this.session?.tap(t));
    hud.onBooster(k => void this.session?.booster(k));
    // In home mode the real UI routes the gear and the "+" to ui.home(); these cover a UI that doesn't.
    hud.onPause(() => { if (this.session) void this.session.pause(); else if (this.screen === 'home' && !this.modals.length) this.enqueue({ kind: 'choice', c: 'settings' }); });
    hud.onShop(() => { if (this.session) void this.session.shop(); else if (this.screen === 'home' && !this.modals.length) this.enqueue({ kind: 'choice', c: 'shop' }); });
    hud.onLivesDue(() => this.syncHud());
    ui.onSfx(s => { audio.play(s); if (s === 'button') audio.haptic('light'); });

    platform.onPause(paused => this.background(paused));
    platform.onBack(() => this.back());

    const ev = this.deps.events !== undefined ? this.deps.events : typeof window !== 'undefined' ? window : null;
    if (ev) {
      // iOS only lets audio start inside a user gesture: unlock on the first touch anywhere.
      const unlock = () => audio.unlock();
      const done = () => { audio.unlock(); ev.removeEventListener('pointerdown', unlock, true); ev.removeEventListener('pointerup', done, true); };
      ev.addEventListener('pointerdown', unlock, true);
      ev.addEventListener('pointerup', done, true);
      ev.addEventListener('resize', () => this.resized());
      ev.addEventListener('orientationchange', () => this.resized());
    }
  }

  // ---------------------------------------------------------------- frame clock

  private readonly frame = (t: number): void => {
    const dt = this.lastT === null ? 0 : Math.min(MAX_DT, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;
    try {
      if (!this.bg) this.tick(dt);
    } catch (e) {
      if (!this.frameFailed) console.error('app: frame failed', e); // once: a broken frame repeats every 16 ms
      this.frameFailed = true;
    } finally {
      const w = this.frameWaiters;
      this.frameWaiters = [];
      w.forEach(f => f());
      this.deps.raf(this.frame); // the loop must survive anything a frame throws
    }
  };

  private tick(dt: number): void {
    this.time += dt;
    if (this.timers.length) this.runTimers();
    const s = this.session;
    s?.advance(dt * this.timeScale);
    if (this.screen === 'home' && this.time >= this.nextLivesTick) {
      this.nextLivesTick = this.time + 1;
      this.ui.hud.setLives(this.meta.lives(this.now()));
    }
    // Rendering pauses on the home screen (nothing loaded) and while a full-screen page covers the field.
    if ((s || this.clearFrames > 0) && !this.ui.covered) {
      if (!s) this.clearFrames--;
      this.scene.frame(dt, s?.frac ?? 0);
    }
  }

  private runTimers(): void {
    const due = this.timers.filter(x => x.at <= this.time + 1e-9);
    this.timers = this.timers.filter(x => x.at > this.time + 1e-9);
    due.forEach(x => x.done());
  }

  wait(sec: number): Promise<void> {
    return new Promise(done => this.timers.push({ at: this.time + sec, done }));
  }

  nextFrame(): Promise<void> { return new Promise(r => this.frameWaiters.push(r)); }

  // ---------------------------------------------------------------- home

  private enqueue(c: HomeCmd): void {
    this.queued.push(c);
    this.wake?.();
  }

  private async homeLoop(): Promise<never> {
    for (;;) {
      const cmd = this.queued.shift() ?? (await this.waitHome());
      try { await this.run(cmd); } catch (e) {
        console.error('app: flow failed', e);
        this.ui.toast('Oops, something went wrong');
        this.leavePlay();
      }
    }
  }

  /** Show the home screen until the player picks something (or a queued command cuts in). */
  private waitHome(): Promise<HomeCmd> {
    this.screen = 'home';
    this.audio.music('home');
    this.analytics.screen('home');
    this.syncHud();
    this.nextLivesTick = this.time + 1;
    return new Promise<HomeCmd>(resolve => {
      let open = true;
      const pick = (c: HomeCmd) => { if (!open) return; open = false; this.wake = null; resolve(c); };
      this.wake = () => { const q = this.queued.shift(); if (q) pick(q); };
      this.ui.home(this.homeState()).then(c => pick({ kind: 'choice', c }), e => { console.error('app: home failed', e); });
    });
  }

  private async run(cmd: HomeCmd): Promise<void> {
    if (cmd.kind === 'refresh') return;
    if (cmd.kind === 'play') return this.play(cmd.n);
    switch (cmd.c) {
      case 'play': return this.play(this.meta.level);
      case 'shop': return this.shop();
      case 'stickers': return this.stickers();
      case 'daily': return this.daily();
      case 'settings': return this.settings();
    }
  }

  homeState(): HomeState {
    const { meta, content } = this, now = this.now(), cur = meta.level;
    const map: HomeState['map'] = [];
    for (let n = Math.max(1, cur - MAP_BEHIND); n <= cur + MAP_AHEAD; n++) {
      const done = n < cur;
      map.push({ n, spicy: content.levelMeta(n).spicy, done, picture: done ? content.levelPicture(n) : null });
    }
    return { level: cur, coins: meta.coins, lives: meta.lives(now), dailyAvailable: meta.dailyGift(now).available, stickers: meta.stickers().length, map };
  }

  syncHud(): void {
    const hud = this.ui.hud;
    hud.setCoins(this.meta.coins);
    hud.setLives(this.meta.lives(this.now()));
  }

  // ---------------------------------------------------------------- play

  private async play(n: number): Promise<void> {
    if (!(await this.livesGate())) return;
    const info = this.content.levelMeta(n), level = await this.buildLevel(n);
    this.enterPlay(n, info);
    try {
      for (let attempt = 0; ; attempt++) {
        const s = this.newSession(n, level, attempt);
        if (attempt === 0) await this.levelCards(n, info, s);
        const end = await s.run();
        if (this.session === s) this.session = null;
        if (end === 'won' || end === 'abort') return;
        // giving up, restarting and going home all cost a life
        this.meta.spendLife(this.now());
        this.syncHud();
        this.analytics.event('level_quit', { level: n, reason: end });
        if (end !== 'restart' || !(await this.livesGate())) return;
      }
    } finally {
      this.leavePlay();
    }
  }

  /** True when the player may start an attempt: a life, unlimited lives, or one bought / watched for here. */
  private async livesGate(): Promise<boolean> {
    const { meta, ui, ads } = this;
    for (;;) {
      const now = this.now(), l = meta.lives(now);
      if (l.lives > 0 || (l.unlimitedUntil !== null && l.unlimitedUntil > now)) return true;
      const cost = meta.economy.refillLivesCost;
      const c = await this.ask('outOfLives', () => ui.outOfLives(l, cost, meta.coins >= cost, ads.rewardedReady()));
      if (c === 'close') return false;
      if (c === 'coins') {
        if (meta.spendCoins(cost, 'lives')) { meta.refillLives(this.now()); this.syncHud(); this.audio.haptic('success'); }
        else ui.toast('Not enough coins');
      } else if (await this.rewarded('lives')) {
        meta.addLives(1, this.now());
        this.syncHud();
        ui.toast('+1 life');
      }
    }
  }

  private async buildLevel(n: number): Promise<Level> {
    if (n <= this.content.shipped) return this.content.getLevel(n);
    // Endless levels are generated on the phone: show the veil for the moment it takes.
    this.ui.loading(true);
    try { await this.nextFrame(); await this.nextFrame(); return this.content.getLevel(n); }
    finally { this.ui.loading(false); }
  }

  private enterPlay(n: number, info: LevelMeta): void {
    const hud = this.ui.hud;
    this.screen = 'play';
    hud.mode('play');
    hud.setLevel(n, info.spicy);
    this.syncHud();
    this.scene.setInsets(hud.insets());
    // the HUD bars settle after their first layout; measure again a frame later
    void this.nextFrame().then(() => { if (this.screen === 'play') this.scene.setInsets(hud.insets()); });
    this.audio.music('play');
    this.analytics.screen('play');
  }

  private newSession(n: number, level: Level, attempt: number): Session {
    // Hints only while the level is new to the player.
    const s = new Session(this, n, level, { attempt, tutorial: n >= this.meta.level });
    this.session = s;
    if (this.autoNext) { this.autoNext = false; void s.autoplay(); }
    return s;
  }

  /** Booster unlock cards (one per new booster), then the level's intro card once. Shown over the loaded board. */
  private async levelCards(n: number, info: LevelMeta, s: Session): Promise<void> {
    const { meta, ui } = this;
    for (const k of meta.unlockBoostersUpTo(n)) {
      this.audio.play('unlock');
      await this.ask('boosterUnlock', () => ui.boosterUnlock(k, meta.economy.freeBoostersOnUnlock));
      s.refreshBoosters();
    }
    const k = info.intro;
    if (k && !meta.hasSeenIntro(k)) {
      await this.ask('intro', () => ui.intro(k, this.content.introCard(k)));
      meta.markIntroSeen(k);
    }
  }

  private leavePlay(): void {
    if (this.session) { this.session.abort(); this.session = null; }
    if (this.screen !== 'play') return;
    this.screen = 'home';
    this.ui.tutorial(null);
    this.scene.highlight(null);
    this.scene.clear();
    this.clearFrames = 2; // draw the empty field once so no stale board shows through
  }

  // ---------------------------------------------------------------- home screens

  async shop(): Promise<void> {
    const { meta, ui } = this;
    this.analytics.screen('shop');
    const state: ShopState = {
      coins: meta.coins, products: await this.productList(), owned: PRODUCT_IDS.filter(id => meta.owns(id)),
      videoReady: this.ads.rewardedReady(), rewards: this.rewards(),
    };
    await this.ask('shop', () => ui.shop(state, {
      buy: id => this.buy(id),
      video: async () => {
        if (!(await this.rewarded('shopCoins'))) return false;
        meta.addCoins(SHOP_VIDEO_COINS, 'video:shop');
        this.syncHud();
        await ui.coinsFly(this.center(), SHOP_VIDEO_COINS);
        return true;
      },
      restore: () => this.restore(),
    }));
    this.syncHud();
    this.session?.refreshBoosters();
  }

  private async stickers(): Promise<void> {
    this.analytics.screen('stickers');
    const items = this.meta.stickers().map(n => ({ n, name: this.content.levelMeta(n).name, picture: this.content.levelPicture(n) }));
    await this.ask('stickers', () => this.ui.stickerBook(items));
  }

  private async daily(): Promise<void> {
    const { meta, ui } = this, g = meta.dailyGift(this.now());
    if (!g.available) { ui.toast('Your next gift arrives tomorrow'); return; }
    this.analytics.screen('daily');
    const c = await this.ask('daily', () => ui.dailyGift({ day: g.day, reward: g.reward, videoReady: this.ads.rewardedReady() }));
    const doubled = c === 'double' && (await this.rewarded('dailyDouble'));
    const got = meta.claimDailyGift(this.now(), doubled);
    this.audio.play('gift');
    this.audio.haptic('success');
    this.analytics.event('daily_claim', { day: g.day, doubled });
    this.syncHud();
    const rest = describeReward(got, false);
    if (rest) ui.toast(`Daily gift: ${rest}`);
    if (got.coins) await ui.coinsFly(this.center(), got.coins);
  }

  private async settings(): Promise<void> {
    this.analytics.screen('settings');
    await this.ask('settings', () => this.ui.pause('home', this.meta.settings, p => this.settingsChanged(p), this.pauseOptions()));
  }

  /** Settings extras: "Privacy choices" where the ad consent rules require it. */
  pauseOptions(): { privacy?: () => void } {
    if (!this.ads.privacyOptionsRequired) return {};
    return { privacy: () => void this.ads.showPrivacyOptions().catch(e => console.warn('app: privacy options failed', e)) };
  }

  settingsChanged(p: Partial<Settings>): void {
    this.meta.updateSettings(p);
    this.applySettings();
  }

  private reducedMotion(): boolean {
    const r = this.m?.settings.reduceMotion ?? 'system';
    return r === 'on' || (r === 'system' && !!this.mq?.matches);
  }

  /** Every setting takes effect at once: audio, haptics and Reduce Motion (scene and UI). */
  private applySettings(): void {
    const s = this.meta.settings, rm = this.reducedMotion();
    this.audio.setSound(s.sound);
    this.audio.setMusic(s.music);
    this.audio.setVibration(s.vibration);
    this.sc?.setReducedMotion(rm);
    this.ui.setReducedMotion(rm);
  }

  // ---------------------------------------------------------------- store and ads

  private rewards(): Record<ProductId, Reward> {
    const r = {} as Record<ProductId, Reward>;
    for (const id of PRODUCT_IDS) r[id] = this.deps.products?.[id]?.reward ?? {};
    return r;
  }

  private async productList(): Promise<Product[]> {
    if (this.products.length) return this.products;
    await Promise.race([this.storeReady, this.wait(STORE_WAIT_SEC)]);
    try { this.products = await this.purchases.products(); } catch (e) { console.warn('app: no products', e); }
    return this.products;
  }

  /** Buy a product and hand over what it contains. True when it was bought. */
  async buy(id: ProductId): Promise<boolean> {
    const { meta, ui } = this;
    let r: 'purchased' | 'cancelled' | 'failed';
    try { r = await this.purchases.buy(id); } catch { r = 'failed'; }
    this.analytics.event('purchase', { id, result: r });
    if (r === 'failed') ui.toast(purchaseFailText(this.purchases.lastFailure));
    if (r !== 'purchased') return false;
    const got = meta.applyPurchase(id);
    this.audio.haptic('success');
    this.session?.refreshBoosters();
    this.syncHud();
    ui.toast(`Thank you! ${describeReward(got)}`);
    if (got.coins) await ui.coinsFly(this.center(), got.coins);
    return true;
  }

  private async restore(): Promise<void> {
    let ids: ProductId[];
    try { ids = await this.purchases.restore(); } catch { this.ui.toast('Could not reach the store. Try again later.'); return; }
    for (const id of ids) this.meta.restorePurchase(id);
    this.ui.toast(ids.length ? 'Purchases restored' : 'Nothing to restore');
  }

  async offer(kind: 'starter' | 'removeAds'): Promise<void> {
    const id: ProductId = kind === 'starter' ? 'starter_bundle' : 'remove_ads';
    if (this.meta.owns(id)) return;
    const product = (await this.productList()).find(p => p.id === id) ?? null;
    const c = await this.ask('offer', () => this.ui.offer({ kind, product, reward: this.rewards()[id] }));
    this.analytics.event('offer', { kind, choice: c });
    if (c === 'buy') await this.buy(id);
  }

  /** Our sounds and music go quiet while a full-screen ad plays. */
  private async adBreak<T>(show: () => Promise<T>, fallback: T): Promise<T> {
    this.adsOpen++;
    this.audio.suspend(true);
    try { return await show(); } catch (e) { console.warn('app: ad failed', e); return fallback; } finally {
      this.adsOpen--;
      this.audio.suspend(this.bg || this.adsOpen > 0);
    }
  }

  async rewarded(p: RewardedPlacement): Promise<boolean> {
    const ok = await this.adBreak(() => this.ads.showRewarded(p), false);
    this.analytics.event('rewarded', { placement: p, earned: ok });
    if (!ok) this.ui.toast('The video did not finish, so no reward this time');
    return ok;
  }

  async interstitial(): Promise<boolean> {
    const shown = await this.adBreak(() => this.ads.showInterstitial(), false);
    this.analytics.event('interstitial', { shown });
    return shown;
  }

  // ---------------------------------------------------------------- platform

  /** App to the background: stop the clock and the sound. Back during play: the pause card. */
  private background(paused: boolean): void {
    this.bg = paused;
    this.lastT = null;
    this.audio.suspend(paused || this.adsOpen > 0);
    if (paused) { this.m?.save().catch(() => {}); return; }
    if (this.screen === 'play' && this.session?.running) void this.session.pause();
  }

  /** Android back: close the top modal, pause during play; on home it is not ours (the platform leaves the app). */
  private back(): boolean {
    if (this.ui.closeTop()) return true;
    if (this.modals.length || this.screen === 'boot') return true; // a card the UI can't close from here
    if (this.screen === 'play') { if (this.session?.running) void this.session.pause(); return true; }
    return false;
  }

  private resized(): void {
    if (!this.sc) return;
    this.scene.resize();
    if (this.screen === 'play') this.scene.setInsets(this.ui.hud.insets());
    this.session?.tutorial?.place(true);
  }

  // ---------------------------------------------------------------- helpers for the session

  async ask<T>(name: string, open: () => Promise<T>): Promise<T> {
    this.modals.push(name);
    try { return await open(); } finally {
      const i = this.modals.lastIndexOf(name);
      if (i >= 0) this.modals.splice(i, 1);
    }
  }

  boosterPoint(k: BoosterKey): Point | null {
    const p = this.deps.boosterPoint?.(k) ?? this.ui.hud.boosterPoint(k);
    if (p) return p;
    // Estimate: four buttons spread across the bar under the field.
    const { w, h } = this.viewport(), ins = this.ui.hud.insets(), i = BOOSTER_KEYS.indexOf(k);
    const gap = Math.min(92, (w - ins.left - ins.right) / 4.3);
    return { x: w / 2 + (i - 1.5) * gap, y: h - Math.max(48, ins.bottom * 0.55) };
  }

  center(): Point {
    const { w, h } = this.viewport();
    return { x: w / 2, y: h / 2 };
  }

  private viewport(): { w: number; h: number } {
    return this.deps.viewport?.() ?? (typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight } : { w: 390, h: 844 });
  }

  // ---------------------------------------------------------------- debug hooks (src/app/debug.ts)

  /** Jump to level n: from home at once; during play it abandons the attempt (no life spent) when no card is open. */
  debugPlay(n: number): boolean {
    if (!Number.isInteger(n) || n < 1) return false;
    const s = this.session;
    if (s && !s.running) return false;
    this.queued.push({ kind: 'play', n });
    if (s) s.abort(); else this.wake?.();
    return true;
  }

  /** Autoplay the current attempt, or the next one to start. */
  debugAutoplay(): Promise<string> {
    if (this.session && !this.session.ended) return this.session.autoplay();
    this.autoNext = true;
    return Promise.resolve('queued');
  }

  /** Run the belt k times faster (0.25..20), e.g. to autoplay long levels quickly. */
  debugSpeed(k: number): number {
    if (Number.isFinite(k)) this.timeScale = Math.min(20, Math.max(0.25, k));
    return this.timeScale;
  }

  debugAddCoins(n: number): void {
    this.meta.addCoins(n, 'debug');
    this.syncHud();
    this.session?.refreshBoosters();
  }

  /** Wipe the profile and load a fresh one (needs a meta loader and deps.resetProfile). */
  async debugReset(): Promise<boolean> {
    const load = this.deps.meta, reset = this.deps.resetProfile;
    if (typeof load !== 'function' || !reset || this.modals.length || (this.session && !this.session.running)) return false;
    this.session?.abort();
    await this.meta.save();
    await reset();
    const economy = this.remoteConfig.get<unknown>('economy', undefined);
    this.m = await load(isRecord(economy) ? economy : undefined);
    this.lostRecently = false;
    this.applySettings();
    this.syncHud();
    this.enqueue({ kind: 'refresh' });
    return true;
  }
}

/** What to tell the player when the store says no. Cancelling says nothing. */
export function purchaseFailText(f: PurchaseFailure | null): string {
  switch (f) {
    case 'alreadyOwned': return 'You already own this. Tap Restore purchases to get it back.';
    case 'pending': return 'Your purchase is waiting for approval. It arrives as soon as it goes through.';
    case 'notConfigured': case 'unavailable': return "The store isn't available right now. Please try again later.";
    case 'busy': return 'Still finishing your last purchase. One moment!';
    default: return 'The purchase did not go through. You were not charged.';
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
