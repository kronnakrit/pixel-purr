// The interface: plain DOM + CSS + inline SVG over the 3D canvas. createUi() builds every layer up front; mount()
// attaches them. The root only takes pointer events on its own controls, so taps elsewhere reach the canvas.
import '../fonts';
import './ui.css';
import type { BoosterKey, HomeChoice, Sfx, UiApi } from '../app/contracts';
import { FONT_BODY, FONT_DISPLAY } from '../fonts';
import { boosterUnlockCard, buyBoosterCard, dailyCard, failCard, introCard, livesCard, offerCard, pauseCard, winCard } from './cards';
import { CoinCounter, type Ctx, type Layers } from './ctx';
import { h } from './dom';
import { coinsFly, createToaster, createTutorial, createVeil } from './fx';
import { createHome } from './home';
import { createHud, type Hud } from './hud';
import { Modals } from './modal';
import { shopPage, stickerPage } from './pages';

export { BOOSTER_INFO } from './boosters';
export { formatCoins, formatNumber, formatTimer } from './format';

export interface Ui extends UiApi {
  /** Android back: close the top modal. False when nothing is open (the app then decides: pause, or leave). */
  closeTop(): boolean;
  /** UI sounds and haptics (button taps, coin ticks, toggles); route them to audio. */
  onSfx(cb: (s: Sfx) => void): void;
  readonly hud: Hud;
  /** Optional 4th argument: whether a rewarded video is ready (hides "1 free with video" when false). */
  buyBooster(k: BoosterKey, price: number, canAfford: boolean, videoReady?: boolean): Promise<'buy' | 'video' | 'close'>;
  /** Number of open modals. */
  readonly modalsOpen: number;
  /** True while something opaque covers the whole play field (home screen, shop, Sticker Book): pause rendering. */
  readonly covered: boolean;
}

let active: Ui | null = null;

/** Android back for the most recently created UI. */
export function closeTop(): boolean { return active?.closeTop() ?? false; }

export function createUi(): Ui {
  const root = h('div', 'pp-ui');
  root.style.setProperty('--pp-display', FONT_DISPLAY);
  root.style.setProperty('--pp-body', FONT_BODY);
  const layers: Layers = {
    screen: h('div', 'pp-layer pp-l-screen'), hud: h('div', 'pp-layer pp-l-hud'), tut: h('div', 'pp-layer pp-l-tut'),
    modals: h('div', 'pp-layer pp-l-modals'), fx: h('div', 'pp-layer pp-l-fx'), veil: h('div', 'pp-layer pp-l-veil'),
  };
  root.append(layers.screen, layers.hud, layers.tut, layers.modals, layers.fx, layers.veil);

  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let rm = mq?.matches ?? false, rmSet = false;
  mq?.addEventListener?.('change', e => { if (!rmSet) setRM(e.matches); });
  const setRM = (on: boolean) => { rm = on; root.classList.toggle('pp-rm', on); };
  setRM(rm);

  let sfxCb: (s: Sfx) => void = () => {};
  const ctx: Ctx = { root, layers, coins: new CoinCounter(), rm: () => rm, sfx: s => sfxCb(s), toast: () => {}, chips: [] };
  ctx.toast = createToaster(layers.fx);

  const hud = createHud(ctx);
  const modals = new Modals(ctx);
  const home = createHome(ctx);
  const tutorial = createTutorial(ctx);
  const veil = createVeil(ctx);

  // home screen lives under the HUD; leaving 'home' mode hides it
  const setMode = hud.mode.bind(hud);
  hud.mode = m => { setMode(m); if (m !== 'home') home.hide(); };

  // every real button press gives a click feel (the controller maps 'button' to sound + light haptic)
  root.addEventListener('click', e => {
    const b = (e.target as Element | null)?.closest('button');
    if (b && b.getAttribute('aria-disabled') !== 'true' && !b.matches('.pp-boost, .pp-toggle')) sfxCb('button');
  }, true);

  const ui: Ui = {
    hud,
    mount(host) {
      if (root.parentElement !== host) host.append(root);
    },
    home(s) {
      hud.mode('home');
      hud.setCoins(s.coins);
      hud.setLives(s.lives);
      return new Promise<HomeChoice>(resolve => {
        let open = true;
        const pick = (c: HomeChoice) => { if (!open) return; open = false; hud.onHome(null); resolve(c); };
        hud.onHome(c => pick(c));
        home.show(s, pick);
      });
    },
    intro: (k, card) => introCard(modals, k, card),
    boosterUnlock: (k, free) => boosterUnlockCard(modals, k, free),
    win: w => winCard(modals, ctx, w),
    fail: f => failCard(modals, f),
    pause: (mode, s, onChange) => pauseCard(modals, ctx, mode, s, onChange),
    shop: (s, actions) => { hud.setCoins(s.coins); return shopPage(modals, ctx, s, actions); },
    stickerBook: items => stickerPage(modals, ctx, items),
    dailyGift: g => dailyCard(modals, g),
    outOfLives: (l, cost, canAfford, videoReady) => livesCard(modals, l, cost, canAfford, videoReady),
    offer: o => offerCard(modals, o),
    buyBooster: (k, price, canAfford, videoReady = true) => buyBoosterCard(modals, k, price, canAfford, videoReady),
    toast: t => ctx.toast(t),
    coinsFly: (from, amount) => coinsFly(ctx, hud, from, amount),
    tutorial,
    loading: veil,
    setReducedMotion(on) { rmSet = true; setRM(on); },
    closeTop: () => modals.closeTop(),
    onSfx(cb) { sfxCb = cb; },
    get modalsOpen() { return modals.open; },
    get covered() { return home.visible || modals.hasPage; },
  };
  active = ui;
  return ui;
}
