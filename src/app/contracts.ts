// Contracts between the app's modules. Each module (render, audio, ui, meta, services, content) implements
// its part; src/app wires them together. Change a contract only together with every module that uses it.
import type { Game, GameEvent, Level, Picture } from '../engine';

// ---------------------------------------------------------------- shared

export type BoosterKey = 'slot' | 'shuffle' | 'nap' | 'xray';
export const BOOSTER_KEYS: readonly BoosterKey[] = ['slot', 'shuffle', 'nap', 'xray'];

/** One-time cards shown the first time a mechanic appears. */
export type IntroKey = 'basics' | 'tray' | 'spicy' | 'mystery' | 'linked' | 'background';

export interface Point { x: number; y: number }

/** Screen space (CSS px) the 3D scene must keep clear: HTML HUD bars plus the phone's safe areas. */
export interface ScreenInsets { top: number; bottom: number; left: number; right: number }

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  /** 'system' follows the phone's Reduce Motion setting. */
  reduceMotion: 'system' | 'on' | 'off';
}

export interface LivesInfo {
  lives: number;
  max: number;
  /** ms until the next life arrives, or null when full. */
  nextInMs: number | null;
  /** Unlimited lives active until this time (ms since epoch), or null. */
  unlimitedUntil: number | null;
}

/** What the player receives. Used by daily gifts, offers, purchases and rewards. */
export interface Reward {
  coins?: number;
  boosters?: Partial<Record<BoosterKey, number>>;
  /** Minutes of unlimited lives. */
  unlimitedLivesMin?: number;
  removeAds?: boolean;
}

// ---------------------------------------------------------------- content (src/content)

export interface LevelMeta {
  n: number;
  name: string;
  spicy: boolean;
  /** Intro card shown before this level the first time, or null. */
  intro: IntroKey | null;
  /** Booster that unlocks (3 free) when this level is reached, or null. */
  unlocks: BoosterKey | null;
}

export interface ContentApi {
  /** Levels 1..SHIPPED ship with the app; higher levels are generated on the phone (endless). */
  readonly shipped: number;
  /** Full playable level. Synchronous; generated levels are cached after the first build. */
  getLevel(n: number): Level;
  levelMeta(n: number): LevelMeta;
  /** The level's picture only (cheap), for the map and the Sticker Book. */
  levelPicture(n: number): Picture;
  introCard(k: IntroKey): { title: string; body: string };
}

// ---------------------------------------------------------------- meta (src/meta)

export interface BoosterPrice { key: BoosterKey; name: string; unlock: number; price: number; does: string }

export interface EconomyConfig {
  startCoins: number;
  maxLives: number;
  lifeRegenMin: number;
  /** Coins to refill all lives. */
  refillLivesCost: number;
  /** Coins for the "+1 cushion" continue after losing. */
  continueCost: number;
  winCoins: number;
  spicyWinCoins: number;
  /** Boosters granted free when a booster unlocks. */
  freeBoostersOnUnlock: number;
  boosters: Record<BoosterKey, BoosterPrice>;
  /** Daily gift rewards for streak days 1..7 (day 7 repeats). */
  daily: Reward[];
  /** Interstitial ads: first level, minimum gap, and never right after a loss. */
  interstitial: { fromLevel: number; minGapSec: number };
  /** Offer moments. */
  starterBundleAfterLevel: number;
  removeAdsAfterInterstitials: number;
}

export interface ProductContents { id: ProductId; reward: Reward; oneTime: boolean }

export interface MetaApi {
  readonly settings: Settings;
  updateSettings(p: Partial<Settings>): void;
  readonly economy: EconomyConfig;

  /** Next level to play (1-based). */
  readonly level: number;
  readonly coins: number;
  addCoins(n: number, reason: string): void;
  /** False (and no change) when the player can't afford it. */
  spendCoins(n: number, reason: string): boolean;

  lives(now: number): LivesInfo;
  /** Spend a life for a failed or abandoned attempt. Unlimited lives make this free. */
  spendLife(now: number): void;
  refillLives(now: number): void;
  /** Extra lives (the rewarded 'lives' video). Never above max; a no-op with unlimited lives. */
  addLives(n: number, now: number): void;
  /** An attempt at level n is live. If the app dies before endAttempt, the next launch spends the life
   *  (closing the app is not a free way out of a lost level). */
  beginAttempt(n: number): void;
  endAttempt(): void;
  grantUnlimitedLives(minutes: number, now: number): void;

  boosterCount(k: BoosterKey): number;
  isBoosterUnlocked(k: BoosterKey): boolean;
  useBooster(k: BoosterKey): boolean;
  /** Unlock boosters whose unlock level is <= n (granting free ones). Returns the newly unlocked keys. */
  unlockBoostersUpTo(n: number): BoosterKey[];

  /** Record a win. Returns the coins earned (already added) and whether it was the first clear. */
  completeLevel(n: number, spicy: boolean, now: number): { coins: number; firstClear: boolean };
  /** Levels whose picture is in the Sticker Book. */
  stickers(): number[];
  hasSeenIntro(k: IntroKey): boolean;
  markIntroSeen(k: IntroKey): void;

  dailyGift(now: number): { available: boolean; day: number; reward: Reward };
  /** Claims today's gift (all of it doubled when the player watched a video) and returns what was granted. */
  claimDailyGift(now: number, doubled: boolean): Reward;

  grant(r: Reward, reason: string): void;
  readonly removeAds: boolean;
  /** One-time products already bought. */
  owns(id: ProductId): boolean;
  /** Apply a completed purchase's contents. With the store's transaction id, the same transaction never pays twice. */
  applyPurchase(id: ProductId, txn?: string | null): Reward;
  /** A purchase that did not complete in the app may still go through later (Ask to Buy, slow payments, a
   *  network error after paying). settlePurchases delivers it when the store reports the transaction. */
  notePendingPurchase(id: ProductId, now: number): void;
  /** Deliver pending purchases the store now reports. Returns what was delivered. */
  settlePurchases(list: readonly StoreTransaction[], now: number): { id: ProductId; reward: Reward }[];
  /** Restore a one-time product's lasting part (Remove Ads) without granting its coins or boosters again. */
  restorePurchase(id: ProductId): Reward;

  /** Interstitial policy: may an interstitial show now, between levels? */
  mayShowInterstitial(ctx: { level: number; afterLoss: boolean; now: number }): boolean;
  recordInterstitial(now: number): void;
  /** True once, at the moment the Remove Ads offer should be shown (after the Nth interstitial). */
  takeRemoveAdsOfferMoment(): boolean;
  /** True once, when the Starter Bundle offer should be shown (after its level). */
  takeStarterOfferMoment(levelJustWon: number): boolean;

  /** Persist now (also called automatically, debounced, after every change). */
  save(): Promise<void>;
}

// ---------------------------------------------------------------- services (src/services)

export type ProductId =
  | 'coins_pouch' | 'coins_basket' | 'coins_jar' | 'coins_treasure'
  | 'cosy_bundle' | 'starter_bundle' | 'remove_ads';

export interface Product { id: ProductId; title: string; description: string; price: string }

export type RewardedPlacement = 'continue' | 'booster' | 'doubleCoins' | 'lives' | 'shopCoins' | 'dailyDouble';

export interface AdsApi {
  init(): Promise<void>;
  /** Shows a rewarded video. Resolves true only when the reward was earned. */
  showRewarded(p: RewardedPlacement): Promise<boolean>;
  rewardedReady(): boolean;
  /** Shows an interstitial if one is loaded. Resolves when it is closed (true if one showed). */
  showInterstitial(): Promise<boolean>;
  /** The consent rules (GDPR, US states) say the player must be able to change their ad choices: show a button. */
  readonly privacyOptionsRequired: boolean;
  showPrivacyOptions(): Promise<void>;
}

export interface PurchasesApi {
  init(): Promise<void>;
  products(): Promise<Product[]>;
  buy(id: ProductId): Promise<'purchased' | 'cancelled' | 'failed'>;
  /** Restores non-consumables (Remove Ads, Cosy Bundle). Returns what was restored; rejects when the store
   *  can't be reached (so the player isn't told they own nothing). */
  restore(): Promise<ProductId[]>;
  /** Why the last buy() did not complete, for the toast; null after a success. */
  readonly lastFailure: PurchaseFailure | null;
  /** The store's transaction id of the last successful buy(), when it gives one. */
  readonly lastTransaction: string | null;
  /** Every one-off purchase the store knows about: after start-up, on resume and whenever the store reports a
   *  change. The app delivers the ones it was still waiting for (see MetaApi.settlePurchases). */
  onTransactions(cb: (list: StoreTransaction[]) => void): void;
}

/** A store transaction: product, the store's transaction id and when it was bought (ms since epoch). */
export interface StoreTransaction { id: ProductId; txn: string; at: number }

export type PurchaseFailure = 'cancelled' | 'busy' | 'alreadyOwned' | 'pending' | 'notConfigured' | 'unavailable' | 'store';

export interface RemoteConfigApi {
  init(): Promise<void>;
  get<T>(key: string, fallback: T): T;
}

export interface AnalyticsApi {
  event(name: string, params?: Record<string, string | number | boolean>): void;
  screen(name: string): void;
}

export interface PlatformApi {
  readonly native: boolean;
  readonly os: 'ios' | 'android' | 'web';
  /** Hide the native splash screen once the first frame is ready. */
  ready(): Promise<void>;
  /** Called when the app goes to background (true) or comes back (false). */
  onPause(cb: (paused: boolean) => void): void;
  /** Android back button. Return true when handled. */
  onBack(cb: () => boolean): void;
  /** Open a web page in the system browser (the privacy policy). */
  openUrl(url: string): void;
}

// ---------------------------------------------------------------- audio (src/audio)

export type Sfx =
  | 'button' | 'tap' | 'blocked' | 'paint' | 'pop' | 'park' | 'reveal' | 'win' | 'lose' | 'worry'
  | 'coin' | 'booster' | 'unlock' | 'shuffle' | 'nap' | 'xray' | 'cushion' | 'gift';

export interface AudioApi {
  /** Must be called from a user gesture once (iOS audio unlock). Safe to call repeatedly. */
  unlock(): void;
  play(s: Sfx): void;
  /** Sounds and haptics for engine events, in step with the animations (paint streak plinks rise in pitch). */
  gameEvents(events: readonly GameEvent[], game: Game): void;
  music(track: 'home' | 'play' | null): void;
  setSound(on: boolean): void;
  setMusic(on: boolean): void;
  setVibration(on: boolean): void;
  /** Haptic for UI moments. */
  haptic(kind: 'light' | 'medium' | 'success' | 'warning'): void;
  /** Pause/resume all audio (app background). */
  suspend(on: boolean): void;
}

// ---------------------------------------------------------------- render (src/render)

export type TapTarget = { kind: 'queue'; q: number } | { kind: 'tray'; i: number };

export interface GameSceneApi {
  /** Space taken by the HTML HUD; the scene lays out the board, tray and queues inside the rest. */
  setInsets(i: ScreenInsets): void;
  /** Call on window resize / orientation change. */
  resize(): void;
  /** Build all views for a fresh game (also after restart). */
  load(game: Game): void;
  /** React to engine events (move cats, paint pixels, effects). Call with every batch the engine returns. */
  apply(events: readonly GameEvent[]): void;
  /** Render one frame. stepFrac (0..1) is the progress towards the next engine step, for smooth riding. */
  frame(dt: number, stepFrac: number): void;
  /** Taps on queue fronts and tray Purrlets. */
  onTap(cb: (t: TapTarget) => void): void;
  /** Tutorial highlight (pulsing ring) on a target, or null. */
  highlight(t: TapTarget | null): void;
  /** Win moment: picture wave, cats dance, confetti. Resolves when it is done. */
  celebrate(): Promise<void>;
  setReducedMotion(on: boolean): void;
  /** Screen position (CSS px) of a target, for tutorial pointers and coin effects. */
  screenPoint(t: TapTarget | 'board' | 'dock'): Point | null;
  /** Remove the current game's views (home screen). */
  clear(): void;
  dispose(): void;
}

// ---------------------------------------------------------------- ui (src/ui)

export interface BoosterButtonState {
  key: BoosterKey;
  unlocked: boolean;
  count: number;
  price: number;
  /** Can be used right now in this game state. */
  enabled: boolean;
  /** X-Ray armed and waiting for the next launch. */
  active: boolean;
}

export interface HomeState {
  level: number;
  coins: number;
  lives: LivesInfo;
  dailyAvailable: boolean;
  stickers: number;
  /** Levels to draw on the map around the current one. */
  map: { n: number; spicy: boolean; done: boolean; picture: Picture | null }[];
}

export type HomeChoice = 'play' | 'shop' | 'stickers' | 'daily' | 'settings';

export interface WinInfo { level: number; name: string; picture: Picture; coins: number; canDouble: boolean }
export interface FailInfo { level: number; continueCost: number; canAfford: boolean; videoReady: boolean; canContinue: boolean }
/** A product whose price is '' is not available from the store right now. removeAds: the player has no ads already
 *  (Remove Ads or the Cosy Bundle), so Remove Ads is not for sale. videoCoins: what the shop's video gives. */
export interface ShopState {
  coins: number; products: Product[]; owned: ProductId[]; removeAds: boolean; videoReady: boolean; videoCoins: number;
  rewards: Record<ProductId, Reward>;
}
export interface ShopActions {
  buy(id: ProductId): Promise<boolean>;
  video(): Promise<boolean>;
  /** Resolves with the restored products. */
  restore(): Promise<ProductId[]>;
  /** Asked again while the shop is open: a video can stop or start being available. */
  videoReady(): boolean;
}
export interface OfferInfo { kind: 'starter' | 'removeAds'; product: Product | null; reward: Reward }

export interface HudApi {
  mode(m: 'home' | 'play' | 'hidden'): void;
  setLevel(n: number, spicy: boolean): void;
  setCoins(n: number): void;
  setLives(l: LivesInfo): void;
  setBoosters(b: BoosterButtonState[]): void;
  onBooster(cb: (k: BoosterKey) => void): void;
  onPause(cb: () => void): void;
  /** Coin chip "+" button. */
  onShop(cb: () => void): void;
  /** Measured HUD bars + safe areas, for the scene. */
  insets(): ScreenInsets;
  /** Screen position of the coin chip (target for flying coins). */
  coinChip(): Point;
  /** Centre of a booster button, or null when it isn't shown (tutorial pointer). */
  boosterPoint(k: BoosterKey): Point | null;
  /** The lives countdown on the chip reached zero: the app should push fresh lives. */
  onLivesDue(cb: () => void): void;
}

/** Links on the pause / settings card: the privacy policy (always), and ad "Privacy choices" where the consent
 *  rules require them. */
export interface PauseOptions { policy?: () => void; privacy?: () => void }

export interface UiApi {
  mount(root: HTMLElement): void;
  readonly hud: HudApi;
  home(s: HomeState): Promise<HomeChoice>;
  intro(k: IntroKey, card: { title: string; body: string }): Promise<void>;
  boosterUnlock(k: BoosterKey, free: number): Promise<void>;
  win(w: WinInfo): Promise<'continue' | 'double'>;
  fail(f: FailInfo): Promise<'coins' | 'video' | 'giveup'>;
  /** In-game pause (mode 'play': resume/restart/home) or settings from home (mode 'home': close only). */
  pause(mode: 'play' | 'home', s: Settings, onChange: (p: Partial<Settings>) => void, opts?: PauseOptions): Promise<'resume' | 'restart' | 'home'>;
  shop(s: ShopState, actions: ShopActions): Promise<void>;
  stickerBook(items: { n: number; name: string; picture: Picture }[]): Promise<void>;
  dailyGift(g: { day: number; reward: Reward; videoReady: boolean }): Promise<'claim' | 'double'>;
  outOfLives(l: LivesInfo, refillCost: number, canAfford: boolean, videoReady: boolean): Promise<'coins' | 'video' | 'close'>;
  offer(o: OfferInfo): Promise<'buy' | 'close'>;
  /** Confirm spending coins on a booster the player has none of. videoReady shows the "free with a video" choice. */
  buyBooster(k: BoosterKey, price: number, canAfford: boolean, videoReady: boolean): Promise<'buy' | 'video' | 'close'>;
  toast(text: string): void;
  /** Coins fly from a point to the coin chip, then the chip bumps. */
  coinsFly(from: Point, amount: number): Promise<void>;
  /** Tutorial pointer and speech bubble, or null to hide. */
  tutorial(step: { text: string; at: Point | null } | null): void;
  /** Full-screen loading veil (first boot, building an endless level). */
  loading(on: boolean): void;
  setReducedMotion(on: boolean): void;
  /** Android back: close the top modal. False when none is open (the app then decides: pause, or leave). */
  closeTop(): boolean;
  /** UI sounds (button taps, coin ticks, toggles), to route to audio. */
  onSfx(cb: (s: Sfx) => void): void;
  /** Something opaque covers the whole play field (home, shop, Sticker Book): skip rendering. */
  readonly covered: boolean;
}

export type { Level };
