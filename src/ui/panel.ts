// Panel chrome shared by every card: purple glossy panel, ribbon title, optional close button; and the page header
// used by full-screen pages (shop, Sticker Book).
import { ICONS } from './art';
import type { Ctx } from './ctx';
import { coinChip } from './hud';
import { h, iconBtn, otext, type Tone } from './dom';

export function panel(title: string, tone: Tone, o: { close?: () => void; cls?: string } = {}): { el: HTMLElement; body: HTMLElement } {
  const body = h('div', 'pp-body');
  // long titles step down a size so the ribbon clears the close button
  const size = title.length > 13 ? 'pp-rb-s' : title.length > 10 ? 'pp-rb-m' : '';
  const el = h('div', `pp-panel ${o.cls ?? ''} ${o.close ? 'pp-hasx' : ''}`, h('div', `pp-ribbon pp-${tone} ${size}`, otext(title, 'pp-ribbon-t', 'h2')), body);
  if (o.close) el.append(iconBtn(ICONS.close(46), 'Close', o.close, 'pp-x'));
  return { el, body };
}

/** Title + body copy block. */
export function copy(title: string, sub: string | null, cls = ''): HTMLElement {
  return h('div', `pp-copy ${cls}`, otext(title, 'pp-title', 'p'), sub ? h('p', 'pp-sub', sub) : null);
}

export function actions(...kids: (HTMLElement | null | false)[]): HTMLElement {
  return h('div', 'pp-actions', ...kids);
}

/** Header for full-screen pages: back button, title pill, coin chip. */
export function pageHead(ctx: Ctx, title: string, back: () => void, right?: HTMLElement): HTMLElement {
  return h('div', 'pp-phead',
    h('div', 'pp-top-l', iconBtn(ICONS.back(48), 'Back', back, 'pp-gear')),
    h('div', 'pp-top-m', h('div', 'pp-level pp-titlepill', otext(title, 'pp-level-t', 'h2'))),
    h('div', 'pp-top-r', right ?? coinChip(ctx, null)));
}
