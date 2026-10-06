// Dev harness for the interface (dev/ui.html): ?screen=hud-play|hud-home|home|intro|unlock|win|fail|pause|shop|stickers|
// daily|lives|offer|buybooster|tutorial|loading|coins renders that screen with sample data over a purple stage and a
// static stand-in play field. Options: rm=1 (reduced motion), sat/sab (fake safe areas, px), k (intro key), kind
// (offer), mode=home (settings), empty=1 (sticker book), afford=0, video=0, spicy=1, day=N, bar=1 (screen buttons).
// Choices resolve into a toast and the screen reopens. window.__ui exposes the UI for --eval.
import '../fonts';
import type { BoosterButtonState, HomeState, IntroKey, LivesInfo, Product, ProductId, Reward, Settings } from '../app/contracts';
import { PICTURES, paramsFor, raster, type Picture } from '../engine';
import { pictureCanvas, purrlet, tray } from './art';
import { createUi } from './index';

const qs = new URLSearchParams(location.search);
const screen = qs.get('screen') ?? 'home';
const flag = (k: string, d = true) => (qs.has(k) ? qs.get(k) !== '0' : d);
document.documentElement.style.setProperty('--pp-sat', `${Number(qs.get('sat') ?? 47)}px`);
document.documentElement.style.setProperty('--pp-sab', `${Number(qs.get('sab') ?? 24)}px`);

const ui = createUi();
ui.mount(document.querySelector<HTMLElement>('#app')!);
if (qs.get('rm') === '1') ui.setReducedMotion(true);
(window as unknown as { __ui: typeof ui }).__ui = ui;
ui.onSfx(s => console.debug('sfx', s));

const pic = (n: number): Picture => raster(PICTURES[(n - 1) % PICTURES.length]!, paramsFor(n).size);
const PRODUCTS: Product[] = [
  { id: 'coins_pouch', title: 'Pouch', description: '1,000 coins', price: '$0.99' },
  { id: 'coins_basket', title: 'Basket', description: '5,500 coins', price: '$4.99' },
  { id: 'coins_jar', title: 'Treat Jar', description: '12,000 coins', price: '$9.99' },
  { id: 'coins_treasure', title: 'Treasure', description: '28,000 coins', price: '$19.99' },
  { id: 'cosy_bundle', title: 'Cosy Bundle', description: 'No ads + boosters', price: '$6.99' },
  { id: 'starter_bundle', title: 'Starter Bundle', description: 'Coins + boosters', price: '$1.99' },
  { id: 'remove_ads', title: 'Remove Ads', description: 'No interstitials', price: '$3.99' },
];
const each = (n: number) => ({ slot: n, shuffle: n, nap: n, xray: n });
const REWARDS: Record<ProductId, Reward> = {
  coins_pouch: { coins: 1000 }, coins_basket: { coins: 5500 }, coins_jar: { coins: 12000 }, coins_treasure: { coins: 28000 },
  cosy_bundle: { removeAds: true, boosters: each(3), coins: 2000 }, starter_bundle: { coins: 2500, boosters: each(2) }, remove_ads: { removeAds: true },
};
const DAILY: Reward[] = [{ coins: 50 }, { coins: 75 }, { boosters: { shuffle: 1 } }, { coins: 100 }, { boosters: { slot: 1 } }, { coins: 150 }, { coins: 250, unlimitedLivesMin: 30 }];
const lives = (n: number): LivesInfo => ({ lives: n, max: 5, nextInMs: n >= 5 ? null : 754_000, unlimitedUntil: null });
const boosters = (level: number): BoosterButtonState[] => [
  { key: 'slot', unlocked: level >= 4, count: 3, price: 900, enabled: true, active: false },
  { key: 'shuffle', unlocked: level >= 6, count: 0, price: 600, enabled: true, active: false },
  { key: 'nap', unlocked: level >= 9, count: 1, price: 1200, enabled: false, active: false },
  { key: 'xray', unlocked: level >= 13, count: 2, price: 1500, enabled: true, active: qs.get('armed') === '1' },
];
const say = (v: unknown) => ui.toast(`→ ${String(v)}`);
const again = (f: () => Promise<unknown>) => { void f().then(v => { say(v); setTimeout(() => again(f), 900); }); };

/** Static stand-in for the 3D play field so HUD screenshots read like the game. */
function fakeField(level: number, picture: Picture, trayFill: [number, number][] = [[1, 20], [6, 30]]) {
  const f = document.querySelector<HTMLElement>('#field')!;
  const ins = ui.hud.insets(), W = innerWidth, side = Math.min(W - 44, innerHeight - ins.top - ins.bottom - 230);
  const board = document.createElement('div');
  board.style.cssText = `position:absolute;left:${(W - side) / 2}px;top:${ins.top + 14}px;width:${side}px;height:${side}px;border-radius:${side * 0.12}px;`
    + 'background:linear-gradient(#B4AAF5,#7A6FD0);box-shadow:inset 0 0 0 6px rgba(255,255,255,.18);display:grid;place-items:center';
  const inner = document.createElement('div');
  inner.style.cssText = `width:${side - 44}px;height:${side - 44}px;border-radius:${side * 0.07}px;background:#3A2F72;display:grid;place-items:center;box-shadow:0 0 0 6px #9C92E8`;
  inner.append(pictureCanvas(picture, side - 70));
  board.append(inner);
  const count = document.createElement('div');
  count.textContent = '4/5';
  count.style.cssText = `position:absolute;left:${(W - side) / 2 - 6}px;top:${ins.top + side + 18}px;font:20px 'Lilita One';-webkit-text-stroke:4px #24193F;paint-order:stroke fill`;
  const t = document.createElement('div');
  t.innerHTML = tray(5, trayFill, Math.min(W - 40, 340));
  t.style.cssText = `position:absolute;left:50%;transform:translateX(-50%);top:${ins.top + side + 44}px`;
  const q = document.createElement('div');
  q.style.cssText = `position:absolute;left:0;right:0;top:${ins.top + side + 128}px;display:flex;justify-content:center;gap:${level > 8 ? 10 : 22}px`;
  const cols = level > 8 ? [[6, 10], [3, 20], [1, 15], [9, 30]] : [[4, 10], [6, 15], [10, 28]];
  for (const [c, n] of cols) {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center';
    col.innerHTML = purrlet(c!, { n, w: 58 }) + `<div style="margin-top:-28px;opacity:.72">${purrlet((c! + 3) % 12 + 1, { n: 20, w: 50, acc: false })}</div>`;
    q.append(col);
  }
  f.replaceChildren(board, count, t, q);
}

function play(level = 12, spicy = flag('spicy', false)) {
  ui.hud.mode('play');
  ui.hud.setLevel(level, spicy);
  ui.hud.setCoins(560);
  ui.hud.setBoosters(boosters(level));
  ui.hud.onBooster(k => ui.toast(`booster ${k}`));
  ui.hud.onPause(() => void ui.pause('play', settings, p => Object.assign(settings, p)).then(say));
  ui.hud.onShop(() => ui.toast('shop'));
  requestAnimationFrame(() => fakeField(level, pic(level)));
}

const settings: Settings = { sound: true, music: true, vibration: false, reduceMotion: 'system' };
const homeState = (): HomeState => ({
  level: 7, coins: 1240, lives: lives(Number(qs.get('lives') ?? 5)), dailyAvailable: true, stickers: 6,
  map: Array.from({ length: 9 }, (_, i) => { const n = 3 + i; return { n, spicy: n % 5 === 0, done: n < 7, picture: n < 7 ? pic(n) : null }; }),
});
const shopActions = {
  buy: (id: ProductId) => new Promise<boolean>(r => setTimeout(() => { ui.toast(`bought ${id}`); r(true); }, 1200)),
  video: () => new Promise<boolean>(r => setTimeout(() => r(true), 800)),
  restore: () => new Promise<void>(r => setTimeout(r, 800)),
};

const SCREENS: Record<string, () => void> = {
  'hud-play': () => play(Number(qs.get('level') ?? 12)),
  'hud-home': () => { ui.hud.mode('home'); ui.hud.setCoins(1240); ui.hud.setLives(lives(Number(qs.get('lives') ?? 3))); },
  home: () => again(() => ui.home(homeState())),
  intro: () => {
    play(7);
    const k = (qs.get('k') ?? 'mystery') as IntroKey;
    const cards: Record<IntroKey, { title: string; body: string }> = {
      basics: { title: 'Tap a Purrlet', body: 'It rides the belt and paints every pixel of its colour it can see.' },
      tray: { title: 'Napping Purrlets', body: 'Leftover paint naps on a cushion. Tap it to send it round again.' },
      spicy: { title: 'Spicy level', body: 'Colours are buried under colours. Clear the outside first!' },
      mystery: { title: 'Mystery Purrlet', body: 'Shows its colour when it reaches the front of a queue.' },
      linked: { title: 'Linked Purrlets', body: 'Tied with a ribbon, they hop on the belt together.' },
      background: { title: 'Full pictures', body: 'Now the whole board is a picture. Every pixel counts!' },
    };
    again(() => ui.intro(k, cards[k]));
  },
  unlock: () => { play(4); again(() => ui.boosterUnlock((qs.get('k') ?? 'slot') as 'slot', 3)); },
  win: () => { play(4); again(() => ui.win({ level: 4, name: 'Tabby', picture: pic(4), coins: 20, canDouble: flag('video') })); },
  fail: () => { play(10); again(() => ui.fail({ level: 10, continueCost: 900, canAfford: flag('afford'), videoReady: flag('video'), canContinue: flag('cont') })); },
  pause: () => {
    const mode = qs.get('mode') === 'home' ? 'home' : 'play';
    if (mode === 'home') void ui.home(homeState()); else play(18);
    again(() => ui.pause(mode, settings, p => { Object.assign(settings, p); ui.toast(JSON.stringify(p)); }));
  },
  shop: () => { ui.hud.setCoins(1240); again(() => ui.shop({ coins: 1240, products: PRODUCTS, owned: qs.get('owned') === '1' ? ['cosy_bundle'] : [], videoReady: flag('video'), rewards: REWARDS }, shopActions)); },
  stickers: () => {
    const items = qs.get('empty') === '1' ? [] : Array.from({ length: Number(qs.get('count') ?? 14) }, (_, i) => ({ n: i + 1, name: PICTURES[i % PICTURES.length]!.name, picture: pic(i + 1) }));
    again(() => ui.stickerBook(items));
  },
  daily: () => { void ui.home(homeState()); const day = Number(qs.get('day') ?? 3); again(() => ui.dailyGift({ day, reward: DAILY[Math.min(7, day) - 1]!, videoReady: flag('video') })); },
  lives: () => { void ui.home(homeState()); again(() => ui.outOfLives(lives(0), 900, flag('afford'), flag('video'))); },
  offer: () => {
    void ui.home(homeState());
    const kind = qs.get('kind') === 'removeAds' ? 'removeAds' : 'starter';
    const id: ProductId = kind === 'starter' ? 'starter_bundle' : 'remove_ads';
    again(() => ui.offer({ kind, product: PRODUCTS.find(p => p.id === id) ?? null, reward: REWARDS[id] }));
  },
  buybooster: () => { play(12); again(() => ui.buyBooster((qs.get('k') ?? 'shuffle') as 'shuffle', 600, flag('afford'), flag('video'))); },
  tutorial: () => {
    play(Number(qs.get('level') ?? 1));
    setTimeout(() => {
      const at = qs.get('at') === 'booster' ? (() => { const r = document.querySelector('.pp-boost')!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()
        : qs.get('at') === 'none' ? null : { x: innerWidth / 2 - 80 + 22, y: innerHeight - 180 };
      ui.tutorial({ text: qs.get('text') ?? 'Tap a Purrlet to send it painting!', at });
    }, 100);
  },
  loading: () => { ui.loading(true); },
  coins: () => {
    ui.hud.mode('home'); ui.hud.setCoins(1240); ui.hud.setLives(lives(5));
    // setCoins right before the flight: the chip counts up as the coins land
    const go = () => { ui.hud.setCoins(1280); void ui.coinsFly({ x: innerWidth / 2, y: innerHeight / 2 }, 40).then(() => setTimeout(() => { ui.hud.setCoins(1240); setTimeout(go, 400); }, 600)); };
    setTimeout(go, 300);
  },
};

(SCREENS[screen] ?? SCREENS.home!)();

// optional screen switcher for manual testing on a phone
if (qs.get('bar') === '1') {
  const bar = document.querySelector<HTMLElement>('#devbar')!;
  bar.classList.add('on');
  for (const s of Object.keys(SCREENS)) {
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = () => { qs.set('screen', s); location.search = qs.toString(); };
    bar.append(b);
  }
}
addEventListener('keydown', e => { if (e.key === 'Escape') ui.closeTop(); });
