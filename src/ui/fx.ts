// Effects over everything: toasts, flying coins, the tutorial pointer and the loading veil.
import type { Point } from '../app/contracts';
import { appIcon, coin, hand } from './art';
import type { Ctx } from './ctx';
import { art, h, safeAreas } from './dom';
import { arcPoints } from './layout';
import type { Hud } from './hud';

// ---------------------------------------------------------------- toast

export function createToaster(layer: HTMLElement): (text: string) => void {
  let cur: HTMLElement | null = null, t: ReturnType<typeof setTimeout> | null = null;
  return text => {
    if (cur) { const old = cur; old.classList.remove('pp-in'); setTimeout(() => old.remove(), 200); }
    if (t) clearTimeout(t);
    const el = h('div', 'pp-toast', text);
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    layer.append(el);
    cur = el;
    requestAnimationFrame(() => el.classList.add('pp-in'));
    t = setTimeout(() => { el.classList.remove('pp-in'); setTimeout(() => el.remove(), 250); if (cur === el) cur = null; }, 2200);
  };
}

// ---------------------------------------------------------------- flying coins

/** Coins burst out of `from`, arc to the chip (0.8 s, ease-in, staggered) and the chip bumps 18% as each lands. */
export function coinsFly(ctx: Ctx, hud: Hud, from: Point, amount: number): Promise<void> {
  const to = hud.coinChip(), base = ctx.coins.begin(), chip = hud.chipEl();
  const lift = ctx.layers.modals.classList.contains('pp-busy') && !chip?.closest('.pp-modal');
  if (lift) hud.lift(true);
  const finish = () => { ctx.coins.end(); if (lift) hud.lift(false); };

  if (ctx.rm()) { // calm: one coin fades at the source, the chip glows
    const c = art(coin(34, ''), 'pp-fly');
    c.style.transform = `translate(${from.x - 17}px, ${from.y - 17}px)`;
    ctx.layers.fx.append(c);
    const a = c.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease-out' });
    return a.finished.catch(() => {}).then(() => { c.remove(); chip?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }], { duration: 300 }); ctx.sfx('coin'); finish(); });
  }

  const k = Math.max(4, Math.min(12, Math.round(Math.sqrt(Math.max(1, amount))) + 2));
  let landed = 0;
  const flights: Promise<void>[] = [];
  for (let i = 0; i < k; i++) {
    const c = art(coin(30, ''), 'pp-fly');
    ctx.layers.fx.append(c);
    const ang = (i / k) * Math.PI * 2 + 0.4, r = 26 + (i % 3) * 10;
    const burst = { x: from.x + Math.cos(ang) * r, y: from.y + Math.sin(ang) * r * 0.7 };
    const arc = arcPoints(burst, to, 10, 90 + (i % 4) * 18);
    const tf = (p: Point, s: number) => `translate(${(p.x - 15).toFixed(1)}px, ${(p.y - 15).toFixed(1)}px) scale(${s})`;
    // burst pop (0.15 s, back-out) then the 0.8 s ease-in arc
    const pop = c.animate([{ transform: tf(from, 0.2), opacity: 0 }, { transform: tf(burst, 1.1), opacity: 1, offset: 0.7 }, { transform: tf(burst, 1), opacity: 1 }],
      { duration: 160, delay: i * 25, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'both' });
    flights.push(pop.finished.catch(() => {}).then(() => {
      const fly = c.animate(arc.map((p, j) => ({ transform: tf(p, 1 - (j / arc.length) * 0.35) })), { duration: 800, delay: 40 + i * 55, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'both' });
      return fly.finished.catch(() => {}).then(() => {
        c.remove();
        landed++;
        ctx.coins.step(base, landed / k);
        ctx.sfx('coin');
        chip?.getAnimations().forEach(a => a.cancel());
        chip?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
      });
    }));
  }
  return Promise.all(flights).then(finish);
}

// ---------------------------------------------------------------- tutorial pointer

export function createTutorial(ctx: Ctx): (step: { text: string; at: Point | null } | null) => void {
  const ring = h('div', 'pp-tut-ring'), pointer = art(hand(58), 'pp-tut-hand');
  const text = h('p', 'pp-bubble-t'), bubble = h('div', 'pp-bubble', text);
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  const wrap = h('div', 'pp-tutwrap pp-gone', ring, pointer, bubble);
  ctx.layers.tut.append(wrap);
  return step => {
    if (!step) { wrap.classList.add('pp-gone'); return; }
    wrap.classList.remove('pp-gone');
    text.textContent = step.text;
    const s = safeAreas(ctx.root), W = innerWidth, H = innerHeight, at = step.at;
    ring.hidden = pointer.hidden = !at;
    if (!at) { // just the bubble, under the HUD
      bubble.style.left = `${W / 2}px`; bubble.style.top = `${s.top + 84}px`;
      bubble.dataset.tail = 'none';
      return;
    }
    ring.style.left = `${at.x}px`; ring.style.top = `${at.y}px`;
    // fingertip sits at (24, 6) of the 66-unit box, drawn 58 px wide; the hand trails down-right
    const k = 58 / 66;
    pointer.style.left = `${at.x - 24 * k}px`; pointer.style.top = `${at.y - 6 * k}px`;
    const below = at.y < H * 0.42;
    const bw = Math.min(280, W - 32), x = Math.max(16 + bw / 2 + s.left, Math.min(W - 16 - bw / 2 - s.right, at.x));
    bubble.style.left = `${x}px`;
    bubble.style.top = below ? `${at.y + 100}px` : `${at.y - 62}px`;
    bubble.dataset.tail = below ? 'up' : 'down';
    bubble.style.setProperty('--tx', `${Math.max(-bw / 2 + 24, Math.min(bw / 2 - 24, at.x - x))}px`);
  };
}

// ---------------------------------------------------------------- loading veil

export function createVeil(ctx: Ctx): (on: boolean) => void {
  const el = h('div', 'pp-veil-in pp-gone', h('div', 'pp-stagebg'), h('div', 'pp-veil-c', art(appIcon(96), 'pp-veil-icon'), h('p', 'pp-o pp-veil-t', 'Loading', h('span', 'pp-dots', h('i', '', '.'), h('i', '', '.'), h('i', '', '.')))));
  el.setAttribute('role', 'progressbar');
  el.setAttribute('aria-label', 'Loading');
  ctx.layers.veil.append(el);
  let t: ReturnType<typeof setTimeout> | null = null;
  return on => {
    if (t) { clearTimeout(t); t = null; }
    if (on) { el.classList.remove('pp-gone'); requestAnimationFrame(() => el.classList.add('pp-in')); }
    else { el.classList.remove('pp-in'); t = setTimeout(() => el.classList.add('pp-gone'), 260); }
  };
}
