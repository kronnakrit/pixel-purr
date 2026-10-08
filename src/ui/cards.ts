// Every card modal: intro, booster unlock, win, fail, pause/settings, daily gift, out of lives, offers, buy booster.
import type { BoosterKey, FailInfo, IntroKey, LivesInfo, OfferInfo, PauseOptions, Reward, Settings, WinInfo } from '../app/contracts';
import { PALETTE } from '../engine/palette';
import { ICONS, boosterArt, check, coin, coinPile, flame, hand, heart, infinity, linked, pictureCanvas, purrlet, tray, videoGlyph } from './art';
import { BOOSTER_INFO } from './boosters';
import type { Ctx } from './ctx';
import { art, h, iconBtn, linkBtn, otext, pill, type Tone } from './dom';
import { formatNumber, formatTimer, rewardItems, rewardLabel, rewardSummary } from './format';
import { streakIndex } from './layout';
import type { Modals } from './modal';
import { actions, copy, panel } from './panel';

const coinIc = (w = 28) => coin(w, '');
const glow = (inner: HTMLElement, cls = '') => h('div', `pp-glow ${cls}`, inner);

// ---------------------------------------------------------------- intro cards

const INTRO_LOOK: Record<IntroKey, { ribbon: string; tone: Tone; art: () => HTMLElement }> = {
  basics: { ribbon: 'How to play', tone: 'blue', art: () => h('div', 'pp-ia pp-ia-tap', art(purrlet(1, { n: 30 }), 'pp-ia-cat'), art(hand(54), 'pp-ia-hand')) },
  tray: { ribbon: 'Nap time!', tone: 'purple', art: () => art(tray(3, [[6, 10], [3, 30]], 210), 'pp-ia-tray') },
  spicy: { ribbon: 'Spicy level!', tone: 'red', art: () => h('div', 'pp-ia pp-ia-spicy', art(flame(54), 'pp-ia-flame'), art(purrlet(2, { n: 40, mood: 'fire' }), 'pp-ia-cat'), art(flame(40), 'pp-ia-flame pp-r')) },
  mystery: { ribbon: 'New friend!', tone: 'purple', art: () => h('div', 'pp-ia pp-ia-pair', art(purrlet(0, { hidden: true }), 'pp-ia-cat'), art(`<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><path d="M3 10 h22 l-8 -7 M25 10 l-8 7" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`, 'pp-ia-arrow'), art(purrlet(7, { n: 20 }), 'pp-ia-cat')) },
  linked: { ribbon: 'New friends!', tone: 'purple', art: () => art(linked(6, 20, 1, 20, 200), 'pp-ia-linked') },
  background: { ribbon: 'Big picture!', tone: 'blue', art: () => art(skyArt(), 'pp-ia-sky') },
};

/** A tiny full-background pixel scene (sky, sun, grass) for the background intro card. */
function skyArt(): string {
  const N = 12, cells: string[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sun = (x - 8.5) ** 2 + (y - 3.5) ** 2 < 5, grass = y > 8 + Math.sin(x * 0.9) * 0.8, cloud = y === 6 && x > 1 && x < 5 || y === 5 && x > 2 && x < 4;
    const c = grass ? 4 : sun ? 3 : cloud ? 11 : 6, p = PALETTE[c]!;
    cells.push(`<rect x="${x * 10}" y="${y * 10}" width="10" height="10" fill="${p.dark}"/><rect x="${x * 10}" y="${y * 10}" width="8.4" height="8.4" fill="${p.hex}"/>`);
  }
  return `<svg viewBox="-4 -4 128 128" width="112" height="112" role="img" aria-label="A picture that fills the whole board"><rect x="-4" y="-4" width="128" height="128" rx="12" fill="#2A2058"/>${cells.join('')}</svg>`;
}

export function introCard(m: Modals, k: IntroKey, card: { title: string; body: string }): Promise<void> {
  const look = INTRO_LOOK[k];
  return m.show<void>({
    label: card.title, kind: 'card', back: done => done(),
    build: done => {
      const p = panel(look.ribbon, look.tone, { cls: 'pp-intro' });
      p.body.append(h('div', 'pp-hero', look.art()), copy(card.title, card.body), actions(pill('Got it!', 'green', () => done(), { cls: 'pp-primary' })));
      return p.el;
    },
  });
}

// ---------------------------------------------------------------- booster unlock

export function boosterUnlockCard(m: Modals, k: BoosterKey, free: number): Promise<void> {
  const info = BOOSTER_INFO[k];
  return m.show<void>({
    label: `New booster: ${info.name}`, kind: 'card', back: done => done(),
    build: done => {
      const p = panel('New booster!', 'gold', { cls: 'pp-unlock' });
      const demo = k === 'slot' ? art(tray(6, [[1, 20], [5, 10], [9, 30], [4, 10], [6, 20]], 280, true), 'pp-unlock-tray') : null;
      p.body.append(h('div', 'pp-hero', glow(art(boosterArt(k, 112), 'pp-hero-art pp-bob'))), copy(info.name, info.does));
      if (demo) p.body.append(demo);
      p.body.append(
        actions(pill(free > 0 ? `Claim ${free}` : 'Got it!', 'green', () => done(), { cls: 'pp-primary pp-pulse' })));
      return p.el;
    },
  });
}

// ---------------------------------------------------------------- win

export function winCard(m: Modals, ctx: Ctx, w: WinInfo): Promise<'continue' | 'double'> {
  return m.show<'continue' | 'double'>({
    label: `Level ${w.level} complete`, kind: 'card', back: done => done('continue'),
    build: done => {
      const p = panel('Purrfect!', 'gold', { cls: 'pp-win' });
      // a smaller picture on short phones keeps the card unscaled (and its pixels crisp)
      const short = innerHeight < 720;
      const frame = h('div', `pp-picframe ${short ? 'pp-short' : ''}`, pictureCanvas(w.picture, short ? 164 : 212));
      const coins = h('div', 'pp-wincoins', art(coinIc(44), 'pp-wincoin'), otext(`+${formatNumber(w.coins)}`, 'pp-gold pp-big', 'span'));
      coins.setAttribute('aria-label', `${w.coins} coins`);
      p.body.append(frame, otext(w.name, 'pp-title pp-name', 'p'), h('p', 'pp-sub pp-tight', 'added to your Sticker Book'), coins,
        actions(pill('Continue', 'green', () => done('continue'), { cls: 'pp-primary pp-pulse' }),
          w.canDouble ? pill('Double with video', 'blue', () => done('double'), { size: 'm', icon: videoGlyph(28) }) : null));
      p.el.append(art(purrlet(9, { mood: 'pop', label: 'Cheering Purrlet' }), 'pp-peek pp-peek-l'), art(purrlet(6, { mood: 'pop', label: 'Cheering Purrlet' }), 'pp-peek pp-peek-r'));
      const wrap = h('div', 'pp-winwrap', confetti(ctx.rm()), p.el);
      return wrap;
    },
  });
}

/** Confetti pieces in the paint colours; a single falling burst (static sprinkles with reduced motion). */
export function confetti(rm: boolean, n = 34): HTMLElement {
  const box = h('div', `pp-confetti ${rm ? 'pp-still' : ''}`);
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) {
    const c = PALETTE[1 + (i % 12)]!, piece = h('i');
    const x = ((i * 61) % 100) + ((i * 7) % 5), wide = i % 3 === 0;
    piece.style.cssText = `left:${x}%;--d:${(i % 9) * 0.11}s;--t:${2.2 + (i % 5) * 0.35}s;--r:${(i * 47) % 360}deg;--x:${((i % 7) - 3) * 14}px;`
      + `top:${rm ? 4 + ((i * 37) % 22) : -6}%;background:${c.hex};width:${wide ? 12 : 8}px;height:${wide ? 8 : 13}px`;
    box.append(piece);
  }
  return box;
}

// ---------------------------------------------------------------- fail

export function failCard(m: Modals, f: FailInfo): Promise<'coins' | 'video' | 'giveup'> {
  return m.show<'coins' | 'video' | 'giveup'>({
    label: 'Tray full', kind: 'card',
    build: done => {
      const p = panel('Tray full!', 'red', { cls: 'pp-fail' });
      const cat = art(purrlet(2, { mood: 'worried', label: 'Worried Purrlet' }), 'pp-hero-art pp-worry');
      if (f.canContinue) {
        p.body.append(h('div', 'pp-hero', cat), copy('Keep painting?', 'Add one more cushion slot'),
          actions(
            pill(`+1 slot · ${formatNumber(f.continueCost)}`, 'green', () => done('coins'), { iconAfter: coinIc(30), cls: 'pp-primary', disabled: !f.canAfford, aria: `Add a slot for ${f.continueCost} coins${f.canAfford ? '' : ', not enough coins'}` }),
            f.canAfford ? null : h('p', 'pp-note', 'Not enough coins'),
            f.videoReady ? pill('Free with video', 'blue', () => done('video'), { size: 'm', icon: videoGlyph(28) }) : null,
            linkBtn('Give up (lose a life)', () => done('giveup'))));
      } else {
        p.body.append(h('div', 'pp-hero', cat), copy('Out of room', 'Every cushion is taken. Have another go from the start!'),
          actions(pill('Give up', 'pink', () => done('giveup'), { cls: 'pp-primary', aria: 'Give up, lose a life' }), h('p', 'pp-note', 'This costs a life')));
      }
      return p.el;
    },
  });
}

// ---------------------------------------------------------------- pause / settings

export function pauseCard(m: Modals, ctx: Ctx, mode: 'play' | 'home', s: Settings, onChange: (p: Partial<Settings>) => void, opts: PauseOptions = {}): Promise<'resume' | 'restart' | 'home'> {
  const cur = { ...s };
  const sysRM = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return m.show<'resume' | 'restart' | 'home'>({
    label: mode === 'play' ? 'Paused' : 'Settings', kind: 'card', back: done => done('resume'),
    build: done => {
      const p = panel(mode === 'play' ? 'Paused' : 'Settings', 'blue', { cls: 'pp-pause', close: mode === 'home' ? () => done('resume') : undefined });
      const row = (icon: string, label: string, on: () => boolean, flip: () => void, note?: () => string, small = false) => {
        const t = h('button', 'pp-toggle', h('i'));
        t.type = 'button';
        t.setAttribute('role', 'switch');
        t.setAttribute('aria-label', label);
        const sub = note ? h('span', 'pp-row-note') : null;
        const sync = () => { const v = on(); t.setAttribute('aria-checked', String(v)); t.classList.toggle('pp-on', v); if (sub && note) sub.textContent = note(); };
        t.addEventListener('click', () => { flip(); sync(); ctx.sfx('button'); });
        sync();
        return h('div', 'pp-row', art(icon, 'pp-row-ic'), h('div', 'pp-row-l', otext(label, `pp-row-t ${small ? 'pp-sm' : ''}`, 'span'), sub), t);
      };
      const set = (patch: Partial<Settings>) => { Object.assign(cur, patch); onChange(patch); };
      const rmOn = () => (cur.reduceMotion === 'system' ? sysRM() : cur.reduceMotion === 'on');
      p.body.append(h('div', 'pp-rows',
        row(ICONS.sound(46), 'Sound', () => cur.sound, () => set({ sound: !cur.sound })),
        row(ICONS.music(46), 'Music', () => cur.music, () => set({ music: !cur.music })),
        row(ICONS.vibrate(46), 'Vibration', () => cur.vibration, () => set({ vibration: !cur.vibration })),
        row(ICONS.motion(46), 'Reduce Motion', rmOn, () => set({ reduceMotion: rmOn() ? 'off' : 'on' }), () => (cur.reduceMotion === 'system' ? 'Follows your phone' : 'Only fades, no bouncing'), true)));
      if (mode === 'play') {
        const big = (icon: string, label: string, note: string, v: 'restart' | 'home') => {
          const b = iconBtn(icon, `${label} (${note})`, () => done(v), 'pp-bigic');
          return h('div', 'pp-bigic-w', b, otext(label, 'pp-bigic-t', 'span'));
        };
        p.body.append(h('div', 'pp-bigrow', big(ICONS.restart(64), 'Restart', 'costs a life', 'restart'), big(ICONS.home(64), 'Home', 'costs a life', 'home')), h('p', 'pp-note', 'Restart or Home costs a life'));
      }
      p.body.append(actions(pill(mode === 'play' ? 'Resume' : 'Done', 'green', () => done('resume'), { cls: 'pp-primary' })));
      // ad consent rules: the player must be able to change their choices at any time
      const links = [
        opts.policy ? linkBtn('Privacy policy', () => { ctx.sfx('button'); opts.policy?.(); }, 'pp-privacy') : null,
        opts.privacy ? linkBtn('Privacy choices', () => { ctx.sfx('button'); opts.privacy?.(); }, 'pp-privacy') : null,
      ].filter((x): x is HTMLButtonElement => !!x);
      if (links.length) p.body.append(h('div', 'pp-legal', ...links));
      return p.el;
    },
  });
}

// ---------------------------------------------------------------- daily gift

/** Big art for a reward: coin pile, booster tile, or heart with infinity. */
function rewardArt(r: Reward): HTMLElement {
  const items = rewardItems(r), first = items[0];
  const box = h('div', 'pp-rart');
  if (!first) return box;
  if (first.kind === 'coins') box.append(art(coinPile(first.n >= 200 ? 4 : first.n >= 100 ? 3 : 2, 110), 'pp-rart-coins'));
  else if (first.kind === 'booster') box.append(art(boosterArt(first.key, 96)));
  else if (first.kind === 'lives') box.append(h('div', 'pp-heartinf', art(heart(96)), art(infinity(40), 'pp-heartinf-i')));
  else box.append(art(ICONS.video(90)));
  const extra = items.slice(1);
  if (extra.some(i => i.kind === 'lives')) box.append(h('div', 'pp-heartinf pp-small', art(heart(56)), art(infinity(26), 'pp-heartinf-i')));
  return box;
}

export function dailyCard(m: Modals, g: { day: number; reward: Reward; videoReady: boolean }): Promise<'claim' | 'double'> {
  const today = streakIndex(g.day);
  return m.show<'claim' | 'double'>({
    label: 'Daily gift', kind: 'card', back: done => done('claim'),
    build: done => {
      const p = panel('Daily gift!', 'green', { cls: 'pp-daily' });
      const days = h('div', 'pp-days');
      days.setAttribute('aria-label', `Day ${g.day} of your streak`);
      for (let i = 0; i < 7; i++) {
        const state = i < today ? 'pp-past' : i === today ? 'pp-today' : 'pp-future';
        const ic = i < today ? check(20) : ICONS.gift(i === 6 ? 30 : 26);
        days.append(h('div', `pp-day ${state} ${i === 6 ? 'pp-d7' : ''}`, art(ic, 'pp-day-ic'), h('span', 'pp-day-t', i === today ? 'Today' : `Day ${i + 1}`)));
      }
      const label = rewardItems(g.reward).map(i => i.kind === 'coins' ? `+${formatNumber(i.n)} coins` : `+${rewardLabel(i)}`).join(' & ');
      p.body.append(days, h('div', 'pp-hero', glow(rewardArt(g.reward))), otext(label, 'pp-title pp-gold', 'p'),
        h('p', 'pp-sub', g.day >= 7 ? 'A whole week! Keep the streak going.' : `Come back tomorrow for day ${Math.min(7, g.day + 1)}`),
        actions(pill('Claim', 'green', () => done('claim'), { cls: 'pp-primary pp-pulse' }),
          g.videoReady ? pill('Double with video', 'blue', () => done('double'), { size: 'm', icon: videoGlyph(28) }) : null));
      return p.el;
    },
  });
}

// ---------------------------------------------------------------- out of lives

export function livesCard(m: Modals, l: LivesInfo, refillCost: number, canAfford: boolean, videoReady: boolean): Promise<'coins' | 'video' | 'close'> {
  let tick: ReturnType<typeof setInterval> | null = null;
  return m.show<'coins' | 'video' | 'close'>({
    label: 'Out of lives', kind: 'card', back: done => done('close'),
    cleanup: () => { if (tick) clearInterval(tick); },
    build: done => {
      const p = panel('Out of lives', 'red', { cls: 'pp-lives-card', close: () => done('close') });
      const t = otext('', 'pp-timer', 'span'), at = Date.now();
      const render = () => { t.textContent = l.nextInMs == null ? '--:--' : formatTimer(l.nextInMs - (Date.now() - at)); };
      render();
      tick = setInterval(render, 1000);
      const big = h('div', 'pp-bigheart', art(heart(110)), otext(formatNumber(l.lives), 'pp-bigheart-n', 'span'));
      p.body.append(h('div', 'pp-hero', big), h('div', 'pp-nextlife', h('span', 'pp-sub', 'Next life in'), t),
        actions(
          pill(`Refill · ${formatNumber(refillCost)}`, 'green', () => done('coins'), { iconAfter: coinIc(30), cls: 'pp-primary', disabled: !canAfford, aria: `Refill all lives for ${refillCost} coins${canAfford ? '' : ', not enough coins'}` }),
          videoReady ? pill('+1 life with video', 'blue', () => done('video'), { size: 'm', icon: videoGlyph(28) }) : null,
          canAfford ? null : h('p', 'pp-note', 'Not enough coins to refill')));
      return p.el;
    },
  });
}

// ---------------------------------------------------------------- offers

export function offerCard(m: Modals, o: OfferInfo): Promise<'buy' | 'close'> {
  const starter = o.kind === 'starter';
  return m.show<'buy' | 'close'>({
    label: starter ? 'Starter Bundle offer' : 'Remove Ads offer', kind: 'card', back: done => done('close'),
    build: done => {
      const p = panel(starter ? 'Starter Bundle' : 'No more ads', starter ? 'gold' : 'blue', { cls: 'pp-offer', close: () => done('close') });
      const buy = pill(o.product ? o.product.price : 'Not available', 'green', () => done('buy'), { cls: 'pp-primary pp-pulse', disabled: !o.product, aria: o.product ? `Buy for ${o.product.price}` : 'Not available right now' });
      if (starter) {
        const items = rewardItems(o.reward);
        const coins = items.find(i => i.kind === 'coins');
        const boosters = items.filter(i => i.kind === 'booster');
        const grid = h('div', 'pp-offer-grid');
        if (coins && coins.kind === 'coins') grid.append(h('div', 'pp-offer-coins', art(coinPile(4, 96)), otext(formatNumber(coins.n), 'pp-gold pp-offer-n', 'span'), otext('coins', 'pp-gold pp-offer-u', 'span')));
        const bl = h('div', 'pp-offer-boosters');
        for (const b of boosters) if (b.kind === 'booster') bl.append(h('div', 'pp-offer-b', art(boosterArt(b.key, 52)), otext(`×${b.n}`, 'pp-offer-x', 'span')));
        if (boosters.length) grid.append(bl);
        for (const i of items) if (i.kind === 'lives' || i.kind === 'noAds') grid.append(h('p', 'pp-sub', `+ ${rewardLabel(i)}`));
        p.body.append(h('div', 'pp-tag', 'One-time offer'), grid, h('p', 'pp-sub', rewardSummary(o.reward)), actions(buy));
      } else {
        p.body.append(h('div', 'pp-hero', glow(noAdsArt())), copy('Remove Ads', 'No more ads between levels. Optional videos for rewards stay, if you ever want them.'), actions(buy));
      }
      return p.el;
    },
  });
}

function noAdsArt(): HTMLElement {
  // prohibition sign over an "AD" badge
  return art(`<svg viewBox="0 0 100 100" width="104" height="104" role="img" aria-label="No ads">
<circle cx="50" cy="53" r="44" fill="#24193F"/><circle cx="50" cy="50" r="44" fill="#fff" stroke="#24193F" stroke-width="3"/>
<text x="50" y="62" text-anchor="middle" font-family="'Lilita One', sans-serif" font-size="34" fill="#3D8BFF" stroke="#24193F" stroke-width="5" paint-order="stroke" stroke-linejoin="round">AD</text>
<circle cx="50" cy="50" r="37" fill="none" stroke="#24193F" stroke-width="14"/><circle cx="50" cy="50" r="37" fill="none" stroke="#FF4D6D" stroke-width="9"/>
<path d="M24 24 L76 76" stroke="#24193F" stroke-width="14" stroke-linecap="round"/><path d="M24 24 L76 76" stroke="#FF4D6D" stroke-width="9" stroke-linecap="round"/>
<ellipse cx="34" cy="20" rx="12" ry="5" fill="#fff" opacity=".6" transform="rotate(-25 34 20)"/></svg>`);
}

// ---------------------------------------------------------------- buy a booster

export function buyBoosterCard(m: Modals, k: BoosterKey, price: number, canAfford: boolean, videoReady: boolean): Promise<'buy' | 'video' | 'close'> {
  const info = BOOSTER_INFO[k];
  return m.show<'buy' | 'video' | 'close'>({
    label: `Get ${info.name}`, kind: 'card', back: done => done('close'),
    build: done => {
      const p = panel(info.name, 'purple', { cls: 'pp-buyb', close: () => done('close') });
      p.body.append(h('div', 'pp-hero', glow(art(boosterArt(k, 104), 'pp-hero-art'))), h('p', 'pp-sub pp-does', info.does),
        actions(
          pill(`Buy 1 · ${formatNumber(price)}`, 'green', () => done('buy'), { iconAfter: coinIc(30), cls: 'pp-primary', disabled: !canAfford, aria: `Buy one for ${price} coins${canAfford ? '' : ', not enough coins'}` }),
          !canAfford ? h('p', 'pp-note', 'Not enough coins') : null,
          videoReady ? pill('1 free with video', 'blue', () => done('video'), { size: 'm', icon: videoGlyph(28) }) : null));
      return p.el;
    },
  });
}
