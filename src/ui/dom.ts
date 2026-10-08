// Tiny DOM helpers shared by the HUD and screens: element builder, SVG-string parsing, glossy buttons, outlined text.
import type { ScreenInsets } from '../app/contracts';

type Kid = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k != null && k !== false) e.append(k);
  return e;
}

/** Parse an SVG (or HTML) string into an element. */
export function svg(markup: string): Element {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild ?? document.createElement('span');
}

/** Element holding an SVG string, sized by CSS. */
export function art(markup: string, cls = ''): HTMLElement {
  const e = h('span', `pp-art ${cls}`);
  e.innerHTML = markup;
  return e;
}

/** Display text: Lilita One, white with a plum outline. */
export function otext(text: string, cls = '', tag: 'div' | 'span' | 'h2' | 'h3' | 'p' = 'div'): HTMLElement {
  const e = h(tag, `pp-o ${cls}`);
  e.textContent = text;
  return e;
}

export type Tone = 'green' | 'blue' | 'pink' | 'gold' | 'red' | 'purple' | 'grey';
export type PillSize = 'xl' | 'l' | 'm' | 's' | 'xs';

export interface PillOpts { size?: PillSize; icon?: string; iconAfter?: string; aria?: string; cls?: string; disabled?: boolean }

/** Glossy pill button (gradient, plum outline, bottom lip, top shine). Disabled ones stay focusable but look flat. */
export function pill(label: string, tone: Tone, onTap: () => void, o: PillOpts = {}): HTMLButtonElement {
  const b = h('button', `pp-pill pp-${tone} pp-${o.size ?? 'l'} ${o.cls ?? ''}`);
  b.type = 'button';
  if (o.icon) b.append(art(o.icon, 'pp-pill-ic'));
  b.append(otext(label, 'pp-pill-t', 'span'));
  if (o.iconAfter) b.append(art(o.iconAfter, 'pp-pill-ic'));
  if (o.aria) b.setAttribute('aria-label', o.aria);
  setDisabled(b, !!o.disabled);
  b.addEventListener('click', () => { if (b.getAttribute('aria-disabled') !== 'true') onTap(); });
  return b;
}

export function setDisabled(b: HTMLElement, off: boolean): void {
  b.setAttribute('aria-disabled', String(off));
  b.classList.toggle('pp-off', off);
}

/** Round (or square) glossy icon button made from an art-kit SVG. */
export function iconBtn(markup: string, aria: string, onTap: () => void, cls = ''): HTMLButtonElement {
  const b = h('button', `pp-ibtn ${cls}`);
  b.type = 'button';
  b.setAttribute('aria-label', aria);
  b.innerHTML = markup;
  b.addEventListener('click', () => { if (b.getAttribute('aria-disabled') !== 'true') onTap(); });
  return b;
}

/** Plain text button (e.g. "Give up", "Restore purchases"). */
export function linkBtn(label: string, onTap: () => void, cls = ''): HTMLButtonElement {
  const b = h('button', `pp-link ${cls}`);
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', () => { if (b.getAttribute('aria-disabled') !== 'true') onTap(); });
  return b;
}

let probe: HTMLElement | null = null;
/** Safe-area insets in CSS px, read through a hidden probe (env() is only readable via computed style). */
export function safeAreas(host: HTMLElement): ScreenInsets {
  if (!probe || !probe.isConnected) {
    probe = h('div', 'pp-probe');
    host.append(probe);
  }
  const cs = getComputedStyle(probe), px = (v: string) => Math.round(parseFloat(v) || 0);
  return { top: px(cs.paddingTop), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft), right: px(cs.paddingRight) };
}

/** True when the element is laid out and on screen. */
export const isShown = (e: Element): boolean => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
