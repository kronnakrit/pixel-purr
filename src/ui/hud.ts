// HUD: top bar (gear, level pill or lives, coin chip) and the booster bar for play mode.
import type { BoosterButtonState, BoosterKey, HudApi, LivesInfo, Point, ScreenInsets } from '../app/contracts';
import { BOOSTER_KEYS } from '../app/contracts';
import { ICONS, boosterArt, coin, flame, heart, infinity } from './art';
import { BOOSTER_INFO } from './boosters';
import type { Ctx } from './ctx';
import { art, h, iconBtn, isShown, otext, safeAreas } from './dom';
import { formatNumber, formatTimer } from './format';

export type HudMode = 'home' | 'play' | 'hidden';

export interface Hud extends HudApi {
  readonly el: HTMLElement;
  readonly current: HudMode;
  /** Lift the HUD above modals for a moment (coins landing on the chip while a card is open). */
  lift(on: boolean): void;
  /** The chip coins fly to: the topmost visible one (a full-screen page may carry its own). */
  chipEl(): HTMLElement | null;
  /** Home screen hook: in home mode the gear and the chip's "+" become home choices. */
  onHome(cb: ((c: 'settings' | 'shop') => void) | null): void;
  /** Fires once when the local lives countdown runs out (call setLives with fresh numbers). */
  onLivesDue(cb: () => void): void;
}

/** Coin chip: coin icon, number, optional "+" (shop). Registered as a coin-flight target while connected. */
export function coinChip(ctx: Ctx, onPlus: (() => void) | null): HTMLElement {
  const num = h('span', 'pp-o pp-chip-n');
  const chip = h('div', 'pp-chip pp-coins', art(coin(44, ''), 'pp-chip-ic pp-chip-coin'), num);
  chip.setAttribute('role', 'group');
  let seen = false;
  const off = ctx.coins.bind(t => {
    // a page's chip unhooks itself on the first update after its page has gone
    if (chip.isConnected) seen = true;
    else if (seen) { off(); ctx.chips.splice(ctx.chips.indexOf(chip) >>> 0, 1); return; }
    num.textContent = t;
    chip.setAttribute('aria-label', `${t} coins`);
  });
  if (onPlus) chip.append(iconBtn(ICONS.plus(32), 'Get more coins', onPlus, 'pp-chip-plus'));
  else chip.classList.add('pp-noplus');
  ctx.chips.push(chip);
  return chip;
}

export function createHud(ctx: Ctx): Hud {
  let mode: HudMode = 'hidden';
  let pauseCb: () => void = () => {}, shopCb: () => void = () => {}, boosterCb: (k: BoosterKey) => void = () => {};
  let homeCb: ((c: 'settings' | 'shop') => void) | null = null, dueCb: () => void = () => {};

  // ---- top bar
  const gear = iconBtn(ICONS.settings(48), 'Pause', () => (mode === 'home' && homeCb ? homeCb('settings') : pauseCb()), 'pp-gear');
  const levelText = otext('Level 1', 'pp-level-t', 'span');
  const levelFlame = art(flame(22), 'pp-level-flame');
  const level = h('div', 'pp-level', levelText, levelFlame);
  level.setAttribute('role', 'status');
  const livesN = otext('5', 'pp-lives-n', 'span'), livesSub = otext('Full', 'pp-lives-sub', 'span');
  const livesIc = art(heart(44), 'pp-chip-ic');
  const lives = h('div', 'pp-chip pp-lives', livesIc, livesN, livesSub);
  lives.setAttribute('role', 'status');
  const chip = coinChip(ctx, () => (mode === 'home' && homeCb ? homeCb('shop') : shopCb()));
  const left = h('div', 'pp-top-l', gear, lives), mid = h('div', 'pp-top-m', level), right = h('div', 'pp-top-r', chip);
  const top = h('div', 'pp-top', left, mid, right);

  // ---- booster bar
  const tiles = new Map<BoosterKey, { b: HTMLButtonElement; s: BoosterButtonState | null }>();
  const row = h('div', 'pp-bbar-in');
  for (const k of BOOSTER_KEYS) {
    const b = h('button', 'pp-boost pp-locked');
    b.type = 'button';
    b.append(art(boosterArt(k, 60), 'pp-boost-art'));
    b.addEventListener('click', () => tapBooster(k));
    tiles.set(k, { b, s: null });
    row.append(b);
  }
  const bbar = h('div', 'pp-bbar', row);
  bbar.setAttribute('role', 'toolbar');
  bbar.setAttribute('aria-label', 'Boosters');

  const el = h('div', 'pp-hudwrap pp-mode-hidden', top, bbar);
  ctx.layers.hud.append(el);

  function tapBooster(k: BoosterKey) {
    const t = tiles.get(k), s = t?.s;
    if (!t || !s) return;
    if (!s.unlocked) { ctx.toast(`${BOOSTER_INFO[k].name} unlocks at level ${BOOSTER_INFO[k].unlock}`); nudge(t.b); return; }
    if (!s.enabled) { nudge(t.b); return; }
    ctx.sfx('button');
    boosterCb(k);
  }
  function nudge(b: HTMLElement) {
    if (ctx.rm()) return;
    b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }], { duration: 260, easing: 'linear' });
  }

  // ---- lives countdown (ticks locally between setLives calls)
  let livesInfo: LivesInfo | null = null, livesAt = 0, timer: ReturnType<typeof setInterval> | null = null, due = false;
  function renderLives() {
    const l = livesInfo;
    if (!l) return;
    const now = Date.now(), unl = l.unlimitedUntil != null && l.unlimitedUntil > now;
    const left = l.nextInMs == null ? null : l.nextInMs - (now - livesAt);
    // once the countdown runs out, show the life that arrived and ask the controller for fresh numbers
    const arrived = !unl && left != null && left <= 0 && l.lives < l.max;
    if (arrived && !due) { due = true; setTimeout(() => dueCb(), 0); }
    const n = arrived ? l.lives + 1 : l.lives;
    lives.classList.toggle('pp-unl', unl);
    livesN.replaceChildren(unl ? art(infinity(26), 'pp-inf') : formatNumber(n));
    if (unl) livesSub.textContent = formatTimer(l.unlimitedUntil! - now);
    else if (n >= l.max || left == null) livesSub.textContent = 'Full';
    else livesSub.textContent = arrived ? '…' : formatTimer(left);
    lives.setAttribute('aria-label', unl ? 'Unlimited lives' : `${l.lives} of ${l.max} lives${l.lives < l.max && l.nextInMs != null ? `, next in ${livesSub.textContent}` : ''}`);
  }
  function syncTimer() {
    const need = mode === 'home' && !!livesInfo && (livesInfo.unlimitedUntil != null || (livesInfo.lives < livesInfo.max && livesInfo.nextInMs != null));
    if (need && !timer) timer = setInterval(renderLives, 1000);
    if (!need && timer) { clearInterval(timer); timer = null; }
  }

  function renderTile(s: BoosterButtonState) {
    const t = tiles.get(s.key);
    if (!t) return;
    t.s = s;
    const { b } = t, info = BOOSTER_INFO[s.key];
    b.classList.toggle('pp-locked', !s.unlocked);
    b.classList.toggle('pp-disabled', s.unlocked && !s.enabled);
    b.classList.toggle('pp-active', s.active);
    b.querySelectorAll('.pp-badge, .pp-price, .pp-lockic, .pp-lvl').forEach(n => n.remove());
    if (!s.unlocked) b.append(art(ICONS.lock(30), 'pp-lockic'), otext(`Lvl ${info.unlock}`, 'pp-lvl', 'span'));
    else if (s.count > 0) b.append(otext(String(s.count), 'pp-badge', 'span'));
    else b.append(h('span', 'pp-price', art(coin(18, ''), 'pp-price-ic'), otext(formatNumber(s.price), 'pp-price-t', 'span')));
    b.setAttribute('aria-disabled', String(!s.unlocked || !s.enabled));
    b.setAttribute('aria-pressed', String(s.active));
    b.setAttribute('aria-label', !s.unlocked ? `${info.name}, unlocks at level ${info.unlock}`
      : `${info.name}, ${s.count > 0 ? `${s.count} left` : `buy for ${formatNumber(s.price)} coins`}${s.active ? ', armed' : ''}${!s.enabled ? ', not usable right now' : ''}`);
  }

  const hud: Hud = {
    el,
    get current() { return mode; },
    mode(m) {
      mode = m;
      el.className = `pp-hudwrap pp-mode-${m}`;
      gear.setAttribute('aria-label', m === 'play' ? 'Pause' : 'Settings');
      syncTimer();
      if (m === 'home') renderLives();
    },
    setLevel(n, spicy) {
      levelText.textContent = `Level ${n}`;
      level.classList.toggle('pp-spicy', spicy);
      level.setAttribute('aria-label', `Level ${n}${spicy ? ', spicy' : ''}`);
    },
    setCoins(n) { ctx.coins.set(n); },
    setLives(l) { livesInfo = l; livesAt = Date.now(); due = false; renderLives(); syncTimer(); },
    setBoosters(list) { list.forEach(renderTile); },
    onBooster(cb) { boosterCb = cb; },
    onPause(cb) { pauseCb = cb; },
    onShop(cb) { shopCb = cb; },
    onHome(cb) { homeCb = cb; },
    onLivesDue(cb) { dueCb = cb; },
    insets(): ScreenInsets {
      const s = safeAreas(ctx.root);
      if (mode === 'hidden') return s;
      // offsets ignore the bars' entrance transforms, so the numbers are final even mid-animation
      const topI = top.offsetHeight ? Math.ceil(top.offsetTop + top.offsetHeight) : s.top + 64;
      const botI = mode !== 'play' ? s.bottom : bbar.offsetHeight ? Math.ceil(ctx.root.clientHeight - bbar.offsetTop) : s.bottom + 86;
      return { top: topI, bottom: botI, left: s.left, right: s.right };
    },
    chipEl() {
      for (let i = ctx.chips.length - 1; i >= 0; i--) {
        const c = ctx.chips[i]!;
        if (c.isConnected && isShown(c) && !c.closest('.pp-gone, .pp-out, .pp-under')) return c;
      }
      return null;
    },
    coinChip(): Point {
      // aim at the coin icon of the topmost visible chip
      const c = hud.chipEl();
      if (c) { const r = (c.querySelector('.pp-chip-coin') ?? c).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
      const s = safeAreas(ctx.root);
      return { x: innerWidth - s.right - 90, y: s.top + 34 };
    },
    lift(on) { ctx.layers.hud.classList.toggle('pp-lifted', on); },
  };
  return hud;
}
