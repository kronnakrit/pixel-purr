// Modal host: one visible modal at a time over a shared dim backdrop. Opening a modal while another is up stacks it
// (the lower one hides until the top closes). Cards pop in with an overshoot; pages (shop, Sticker Book) slide up.
import type { Ctx } from './ctx';
import { h, safeAreas } from './dom';
import { fitScale } from './layout';

export interface ModalSpec<T> {
  label: string;
  kind: 'card' | 'page';
  /** Builds the content; call done(v) to close and resolve. */
  build(done: (v: T) => void): HTMLElement;
  /** Android back: call done(v) to close, or do nothing to swallow the press (e.g. the fail card). */
  back?: (done: (v: T) => void) => void;
  /** Called when the modal leaves (timers etc.). */
  cleanup?: () => void;
}

interface Entry { el: HTMLElement; fit: HTMLElement | null; back: () => boolean; kind: 'card' | 'page'; cleanup?: () => void }

export class Modals {
  private stack: Entry[] = [];
  private backdrop: HTMLElement;
  private hideT: ReturnType<typeof setTimeout> | null = null;

  constructor(private ctx: Ctx) {
    this.backdrop = h('div', 'pp-backdrop');
    ctx.layers.modals.append(this.backdrop);
    addEventListener('resize', () => this.stack.forEach(e => this.fit(e)));
    // text metrics change once the bundled fonts finish loading
    void document.fonts?.ready.then(() => this.stack.forEach(e => this.fit(e)));
  }

  get open(): number { return this.stack.length; }
  get topKind(): 'card' | 'page' | null { return this.stack[this.stack.length - 1]?.kind ?? null; }
  get hasPage(): boolean { return this.stack.some(e => e.kind === 'page'); }

  show<T>(spec: ModalSpec<T>): Promise<T> {
    return new Promise<T>(resolve => {
      let closed = false;
      const done = (v: T) => {
        if (closed) return;
        closed = true;
        resolve(v);
        this.remove(entry);
      };
      const content = spec.build(done);
      const el = h('div', `pp-modal pp-${spec.kind}`);
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', spec.label);
      let fit: HTMLElement | null = null;
      if (spec.kind === 'card') {
        fit = h('div', 'pp-fit', h('div', 'pp-pop', content));
        el.append(fit);
      } else el.append(h('div', 'pp-slide', content));
      const entry: Entry = {
        el, fit, kind: spec.kind, cleanup: spec.cleanup,
        back: () => { spec.back?.(done); return true; },
      };
      // a card over a page leaves the page showing (dimmed); anything else hides what's below
      const below = this.stack[this.stack.length - 1];
      if (below && (below.kind === 'card' || spec.kind === 'page')) below.el.classList.add('pp-under');
      this.stack.push(entry);
      this.ctx.layers.modals.append(el);
      this.fit(entry);
      this.syncBackdrop();
      // move focus into the dialog (screen readers announce its label) without painting a ring on a button
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
    });
  }

  /** Android back: closes (or swallows) the top modal. False when nothing is open. */
  closeTop(): boolean {
    const top = this.stack[this.stack.length - 1];
    return top ? top.back() : false;
  }

  private remove(e: Entry) {
    const i = this.stack.indexOf(e);
    if (i < 0) return;
    this.stack.splice(i, 1);
    e.cleanup?.();
    e.el.classList.add('pp-out');
    e.el.setAttribute('aria-hidden', 'true');
    setTimeout(() => e.el.remove(), this.ctx.rm() ? 160 : 200);
    const top = this.stack[this.stack.length - 1];
    if (top) { top.el.classList.remove('pp-under'); this.fit(top); }
    this.syncBackdrop();
  }

  private syncBackdrop() {
    if (this.hideT) { clearTimeout(this.hideT); this.hideT = null; }
    const card = [...this.stack].reverse().find(e => e.kind === 'card');
    // the dim sits right under the top card, so it also covers a page (shop) the card was opened over
    if (card) { this.ctx.layers.modals.insertBefore(this.backdrop, card.el); this.backdrop.classList.add('pp-on'); }
    // wait a beat before fading out, so card → card hand-offs don't flicker the dim
    else this.hideT = setTimeout(() => this.backdrop.classList.remove('pp-on'), 60);
    this.ctx.layers.modals.classList.toggle('pp-busy', this.stack.length > 0);
  }

  /** Scale a card down to fit short screens (its natural size is measured untransformed). */
  private fit(e: Entry) {
    if (!e.fit) return;
    const s = safeAreas(this.ctx.root), inner = e.fit.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const nat = { w: inner.offsetWidth, h: inner.offsetHeight + 40 }; // + ribbon overhang and lip
    const avail = { w: innerWidth - s.left - s.right - 36, h: innerHeight - s.top - s.bottom - 24 }; // room for the close button overhang
    e.fit.style.setProperty('--fit', String(fitScale(nat, avail)));
  }
}
