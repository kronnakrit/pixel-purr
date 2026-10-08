// Dev builds only: window.__pp drives the real app for manual testing and automated reviewers.
//   __pp.state()        what is on screen, the profile and the current attempt
//   __pp.play(n)        jump to level n (lives gate, unlock and intro cards still apply)
//   __pp.autoplay()     play the current level's stored solution through the tap path; resolves 'won' / 'lost'
//   __pp.win() / lose() finish the current attempt at once and run the real win / lose flow
//   __pp.speed(k)       run the belt k times faster (1 = normal, up to 20)
//   __pp.tap(kind, i)   tap queue i or tray slot i, as a finger would ('queue' | 'tray'); false if nothing launched
//   __pp.addCoins(n)    __pp.resetProfile()
import { BOOSTER_KEYS, type BoosterKey } from './contracts';
import type { App } from './controller';

export interface PixelPurrDebug {
  state(): ReturnType<typeof debugState>;
  play(n: number): boolean;
  autoplay(): Promise<string>;
  win(): boolean;
  lose(): boolean;
  speed(k: number): number;
  tap(kind: 'queue' | 'tray', i: number): boolean;
  addCoins(n: number): number;
  resetProfile(): Promise<boolean>;
}

export function debugState(app: App) {
  const s = app.session, g = s?.game;
  let profile = null;
  try {
    const m = app.meta, boosters = {} as Record<BoosterKey, number>;
    for (const k of BOOSTER_KEYS) boosters[k] = m.isBoosterUnlocked(k) ? m.boosterCount(k) : -1;
    profile = { level: m.level, coins: m.coins, lives: m.lives(app.now()), boosters, stickers: m.stickers(), settings: m.settings, removeAds: m.removeAds };
  } catch { /* still booting */ }
  return {
    screen: app.screen,
    modal: app.modal,
    modals: [...app.openModals],
    stepsPerSec: app.stepsPerSec,
    speed: app.timeScale,
    profile,
    session: s && g ? {
      level: s.n, name: s.info.name, spicy: s.info.spicy, status: g.status, running: s.running, busy: s.busy, ended: s.ended,
      autoplay: s.autoplaying, continued: s.continued, hint: s.tutorial?.showing ?? null,
      left: g.left, total: g.level.total, tick: g.tick, riders: g.riders.length, beltFree: g.beltFree,
      tray: g.tray.length, trayCap: g.trayCap, queues: g.queues.map(q => q.length), xrayArmed: g.xrayArmed,
    } : null,
  };
}

export function installDebug(app: App, target: object = globalThis): PixelPurrDebug {
  const api: PixelPurrDebug = {
    state: () => debugState(app),
    play: n => app.debugPlay(n),
    autoplay: () => app.debugAutoplay(),
    win: () => app.session?.forceWin() ?? false,
    lose: () => app.session?.forceLose() ?? false,
    speed: k => app.debugSpeed(k),
    tap: (kind, i) => {
      const s = app.session, g = s?.game;
      if (!s || !g || !s.running) return false;
      const before = g.riders.length;
      s.tap(kind === 'tray' ? { kind: 'tray', i } : { kind: 'queue', q: i });
      return g.riders.length > before;
    },
    addCoins: n => { app.debugAddCoins(n); return app.meta.coins; },
    resetProfile: () => app.debugReset(),
  };
  (target as { __pp?: PixelPurrDebug }).__pp = api;
  return api;
}
