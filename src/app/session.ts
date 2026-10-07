// One level attempt: the engine game on a fixed-step clock, taps, the booster bar, and the lose and win flows.
// Every event batch the engine returns goes to the scene and to audio, in that order, the moment it happens.
import { Game, hash, mulberry32, type GameEvent, type GameStatus, type Level, type Rng } from '../engine';
import { BOOSTER_KEYS, type BoosterButtonState, type BoosterKey, type LevelMeta, type TapTarget } from './contracts';
import { Autopilot } from './autoplay';
import type { SessionHost } from './host';
import { Tutorial } from './tutorial';

/** How an attempt ended. 'abort' = left without a verdict (debug jump), no life spent. */
export type SessionEnd = 'won' | 'giveup' | 'restart' | 'home' | 'abort';

/** Seconds of "tray full" worry before the fail card (the shake is 0.5 s, then a short hold). */
export const LOSE_PAUSE = 0.9;
/** Autoplay waits this long after the belt empties before the next tap, so each move reads clearly. */
export const AUTO_GAP = 0.3;
/** A second tap on the same booster within this many ms is ignored, so a double tap uses one. */
export const BOOSTER_COOLDOWN_MS = 600;

export interface SessionOptions {
  /** Attempt number (0 = first), salts the Yarn Shuffle seed. */
  attempt?: number;
  /** Show the level 1-4 hints. */
  tutorial?: boolean;
}

export class Session {
  readonly game: Game;
  readonly n: number;
  readonly info: LevelMeta;
  readonly tutorial: Tutorial | null;
  /** A continue was used this attempt (only one is offered). */
  continued = false;
  /** Extra Cushion was used this attempt: one per attempt, so a double tap can't spend two. */
  cushioned = false;
  private phase: 'ready' | 'live' | 'ended' = 'ready';
  /** Open modals and running flows; the clock stops while any is held. */
  private holds = 0;
  /** When each booster was last used, so a double tap uses one. */
  private readonly usedAt: Partial<Record<BoosterKey, number>> = {};
  private acc = 0;
  private flow: 'lost' | 'won' | null = null;
  private readonly rng: Rng;
  private pilot: Autopilot | null = null;
  private autoWait = 0;
  private barKey = '';
  private finish: (e: SessionEnd) => void = () => {};
  private readonly done: Promise<SessionEnd>;
  private watchers: ((s: GameStatus | 'ended') => void)[] = [];

  constructor(private readonly host: SessionHost, n: number, level: Level, o: SessionOptions = {}) {
    this.n = n;
    this.info = host.content.levelMeta(n);
    this.game = new Game(level);
    this.rng = mulberry32(hash(n * 7919 + (o.attempt ?? 0)));
    const first = level.solution?.plan?.[0];
    this.tutorial = o.tutorial && Tutorial.has(n) ? new Tutorial(n, host, this.game, first?.kind === 'q' ? first.qs[0] : 0) : null;
    this.done = new Promise(r => { this.finish = r; });
    host.scene.load(this.game);
    this.refreshBoosters(true);
  }

  /** Start the clock (after any intro cards). Resolves when the attempt is over. */
  run(): Promise<SessionEnd> {
    if (this.phase === 'ready') {
      this.phase = 'live';
      this.tutorial?.start();
      this.host.analytics.event('level_start', { level: this.n });
    }
    return this.done;
  }

  /** The clock runs while the attempt is live, the game is playing and nothing holds it. */
  get running(): boolean { return this.phase === 'live' && this.holds === 0 && this.game.status === 'playing'; }
  get ended(): boolean { return this.phase === 'ended'; }
  get busy(): boolean { return this.holds > 0; }
  get autoplaying(): boolean { return !!this.pilot; }
  /** Progress towards the next engine step (0..1), for smooth riding. */
  get frac(): number { return this.game.riders.length ? Math.min(1, this.acc) : 0; }

  /** Advance the fixed-step clock by dt seconds of frame time. */
  advance(dt: number): void {
    if (!this.running) return;
    if (this.pilot) this.drive(dt);
    this.acc += dt * this.host.stepsPerSec;
    while (this.acc >= 1 && this.running) {
      this.acc -= 1;
      const ev = this.game.step();
      if (ev.length) this.emit(ev);
    }
  }

  tap(t: TapTarget): void {
    if (!this.running) return;
    const g = this.game, empty = !g.riders.length;
    const ev = t.kind === 'queue' ? g.launchQueue(t.q) : g.launchTray(t.i);
    if (!ev.length) { this.host.audio.play('blocked'); return; }
    if (empty) this.acc = 0; // a fresh belt starts its first step cleanly
    this.emit(ev);
  }

  // ---------------------------------------------------------------- boosters

  canUse(k: BoosterKey): boolean {
    const g = this.game;
    if (g.status !== 'playing') return false;
    return k === 'slot' ? !this.cushioned : k === 'shuffle' ? g.canShuffle() : k === 'nap' ? g.canNap() : g.canXray();
  }

  /** Booster bar tap: use one from stock, or offer to buy one (coins, or a video for one). */
  async booster(k: BoosterKey): Promise<void> {
    const { meta, ui, ads, audio } = this.host;
    if (!this.running || !meta.isBoosterUnlocked(k)) return;
    if (!this.canUse(k)) { audio.play('blocked'); return; }
    const since = this.host.now() - (this.usedAt[k] ?? -Infinity);
    if (since >= 0 && since < BOOSTER_COOLDOWN_MS) return;
    if (meta.boosterCount(k) > 0) { if (meta.useBooster(k)) this.applyBooster(k, 'stock'); return; }
    this.holds++;
    try {
      const price = meta.economy.boosters[k].price;
      const c = await this.host.ask('buyBooster', () => ui.buyBooster(k, price, meta.coins >= price, ads.rewardedReady()));
      if (this.phase !== 'live' || !this.canUse(k) || c === 'close') return;
      let got = false;
      if (c === 'buy') {
        got = meta.spendCoins(price, `booster:${k}`);
        if (got) this.host.syncHud(); else ui.toast('Not enough coins');
      } else got = await this.host.rewarded('booster');
      if (!got || this.phase !== 'live') return;
      const one: Partial<Record<BoosterKey, number>> = {};
      one[k] = 1;
      meta.grant({ boosters: one }, `booster:${c}`);
      this.host.analytics.event('booster_buy', { booster: k, via: c });
      if (meta.useBooster(k)) this.applyBooster(k, c);
    } finally {
      this.holds--;
      this.refreshBoosters();
    }
  }

  private applyBooster(k: BoosterKey, via: string): void {
    const g = this.game;
    this.usedAt[k] = this.host.now();
    if (k === 'slot') this.cushioned = true;
    const ev = k === 'slot' ? g.addTraySlot() : k === 'shuffle' ? g.shuffleQueues(this.rng) : k === 'nap' ? g.napTray() : g.armXray();
    this.emit(ev);
    this.tutorial?.booster(k);
    this.host.analytics.event('booster_use', { level: this.n, booster: k, via });
  }

  /** Push the booster bar to the HUD when anything on it changed (counts, usable, X-Ray armed). */
  refreshBoosters(force = false): void {
    const { meta } = this.host, g = this.game;
    const list: BoosterButtonState[] = BOOSTER_KEYS.map(k => {
      const unlocked = meta.isBoosterUnlocked(k);
      return { key: k, unlocked, count: meta.boosterCount(k), price: meta.economy.boosters[k].price, enabled: unlocked && this.canUse(k), active: k === 'xray' && g.xrayArmed };
    });
    const key = JSON.stringify(list);
    if (!force && key === this.barKey) return;
    this.barKey = key;
    this.host.ui.hud.setBoosters(list);
  }

  // ---------------------------------------------------------------- pause, shop, end

  /** In-game pause: resume, restart or home (the controller spends the life). */
  async pause(): Promise<void> {
    if (!this.running) return;
    const { ui, meta } = this.host;
    this.holds++;
    let r: 'resume' | 'restart' | 'home';
    try { r = await this.host.ask('pause', () => ui.pause('play', meta.settings, p => this.host.settingsChanged(p), this.host.pauseOptions())); }
    finally { this.holds--; }
    if (this.phase === 'live' && (r === 'restart' || r === 'home')) this.end(r);
  }

  /** Coin chip "+" during play: the shop over the paused board. */
  async shop(): Promise<void> {
    if (!this.running) return;
    this.holds++;
    try { await this.host.shop(); } finally { this.holds--; this.refreshBoosters(); }
  }

  /** Leave without a verdict (debug jump to another level). */
  abort(): void { this.end('abort'); }

  private end(e: SessionEnd): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.tutorial?.stop();
    this.notify('ended');
    this.finish(e);
  }

  // ---------------------------------------------------------------- events, lose, win

  private emit(ev: readonly GameEvent[]): void {
    const { scene, audio } = this.host;
    scene.apply(ev);
    audio.gameEvents(ev, this.game);
    this.tutorial?.events(ev);
    this.refreshBoosters();
    const s = this.game.status;
    if (s === 'playing' || this.flow || this.phase !== 'live') return;
    this.notify(s);
    if (s === 'won') void this.won();
    else void this.lost();
  }

  private async lost(): Promise<void> {
    const { meta, ui, ads, analytics } = this.host, n = this.n;
    this.flow = 'lost';
    this.holds++;
    this.host.lostRecently = true;
    analytics.event('level_fail', { level: n, continued: this.continued });
    try {
      await this.host.wait(LOSE_PAUSE);
      for (;;) {
        if (this.phase !== 'live') return;
        const cost = meta.economy.continueCost;
        const c = await this.host.ask('fail', () => ui.fail({
          level: n, continueCost: cost, canAfford: meta.coins >= cost, videoReady: ads.rewardedReady(), canContinue: !this.continued,
        }));
        if (this.phase !== 'live') return;
        if (c === 'giveup' || this.continued) { this.end('giveup'); return; }
        let ok: boolean;
        if (c === 'coins') {
          ok = meta.spendCoins(cost, 'continue');
          if (ok) this.host.syncHud(); else ui.toast('Not enough coins');
        } else ok = await this.host.rewarded('continue');
        if (!ok) continue; // back to the fail card
        this.continued = true;
        analytics.event('level_continue', { level: n, via: c });
        this.flow = null;
        this.emit(this.game.addTraySlot()); // +1 cushion; the game resumes
        return;
      }
    } finally {
      if (this.flow === 'lost') this.flow = null;
      this.holds--;
    }
  }

  private async won(): Promise<void> {
    const h = this.host, { meta, ui, ads, scene, content, analytics } = h, n = this.n;
    this.flow = 'won';
    this.holds++;
    this.tutorial?.stop();
    try {
      // Keep the win before the dance: the app may be closed or evicted while it plays.
      meta.endAttempt();
      const { coins, firstClear } = meta.completeLevel(n, this.info.spicy, h.now());
      void meta.save();
      analytics.event('level_win', { level: n, continued: this.continued, firstClear });
      await scene.celebrate();
      const choice = await h.ask('win', () => ui.win({ level: n, name: this.info.name, picture: content.levelPicture(n), coins, canDouble: ads.rewardedReady() }));
      let total = coins, watched = false;
      if (choice === 'double' && await h.rewarded('doubleCoins')) { meta.addCoins(coins, 'win:double'); total += coins; watched = true; }
      h.syncHud(); // the chip counts up as the coins land
      await ui.coinsFly(scene.screenPoint('board') ?? h.center(), total);
      if (meta.takeStarterOfferMoment(n)) await h.offer('starter');
      const afterLoss = h.lostRecently;
      h.lostRecently = false;
      // never a second full-screen ad right after the player chose to watch one
      if (!watched && meta.mayShowInterstitial({ level: n, afterLoss, now: h.now() }) && await h.interstitial()) {
        meta.recordInterstitial(h.now());
        if (meta.takeRemoveAdsOfferMoment()) await h.offer('removeAds');
      }
    } finally {
      this.holds--;
      this.end('won');
    }
  }

  // ---------------------------------------------------------------- debug and autoplay

  /** Resolves when the game leaves 'playing' (won / lost) or the attempt ends. */
  settled(): Promise<GameStatus | 'ended'> {
    if (this.phase === 'ended') return Promise.resolve('ended');
    if (this.game.status !== 'playing') return Promise.resolve(this.game.status);
    return new Promise(r => this.watchers.push(r));
  }

  private notify(s: GameStatus | 'ended'): void {
    const w = this.watchers;
    this.watchers = [];
    w.forEach(f => f(s));
  }

  /** Play the stored solution one move at a time through the tap path. */
  autoplay(): Promise<GameStatus | 'ended'> {
    this.pilot ??= new Autopilot(this.game);
    this.autoWait = 0;
    return this.settled();
  }

  private drive(dt: number): void {
    if (this.game.riders.length) { this.autoWait = AUTO_GAP; return; }
    if ((this.autoWait -= dt) > 0) return;
    const t = this.pilot!.next();
    if (t) this.tap(t);
  }

  /** Debug: finish the picture at once and run the real win flow. */
  forceWin(): boolean {
    const g = this.game;
    if (!this.running) return false;
    g.px.fill(0);
    g.left = 0;
    g.riders.length = 0;
    g.tray.length = 0;
    g.queues.forEach(q => { q.length = 0; });
    g.xrayArmed = false;
    g.status = 'won';
    this.host.scene.load(g);
    this.emit([{ type: 'won' }]);
    return true;
  }

  /** Debug: fill the tray past its cushions with waiting Purrlets (paint stays conserved) and run the lose flow. */
  forceLose(): boolean {
    const g = this.game;
    if (!this.running) return false;
    const full = () => g.tray.length > g.trayCap;
    for (const r of g.riders.splice(0)) g.tray.push({ id: r.id, c: r.c, a: r.a });
    for (const q of g.queues) {
      while (!full() && q[0] && q[0].link === undefined) { const p = q.shift()!; g.tray.push({ id: p.id, c: p.c, a: p.a }); }
    }
    g.queues.forEach((q, qi) => q.forEach((p, d) => { p.q = qi; p.d = d; }));
    g.status = 'lost';
    this.host.scene.load(g);
    this.emit([{ type: 'lost' }]);
    return true;
  }
}
