// First-levels hints: a pointer and speech bubble (UI) plus a pulsing ring in the scene.
// L1 points at a queue front until the first launch; L2 at the first napping tray Purrlet until it is sent again;
// L4 at the Extra Cushion button the first time the tray holds 4 or more.
import type { Game, GameEvent } from '../engine';
import type { BoosterKey, GameSceneApi, Point, TapTarget, UiApi } from './contracts';

export const TUTORIAL_TEXT = {
  tap: 'Tap a Purrlet',
  tray: 'Tap a napping Purrlet to send it again',
  cushion: 'Tray filling up? Tap Extra Cushion for one more cushion',
} as const;

/** Tray size that triggers the level 4 hint. */
export const CUSHION_HINT_AT = 4;

export interface TutorialHost {
  readonly ui: Pick<UiApi, 'tutorial'>;
  readonly scene: Pick<GameSceneApi, 'highlight' | 'screenPoint'>;
  boosterPoint(k: BoosterKey): Point | null;
}

type Hint = { kind: 'queue'; q: number } | { kind: 'tray'; id: number } | { kind: 'cushion' };

export class Tutorial {
  private hint: Hint | null = null;
  private done = false;
  private placedAt = '';

  /** `firstQueue`: the queue whose front to point at on level 1 (the stored solution's first move). */
  constructor(readonly n: number, private readonly host: TutorialHost, private readonly game: Game, private readonly firstQueue = 0) {}

  static has(n: number): boolean { return n === 1 || n === 2 || n === 4; }

  /** The hint on screen now, for tests and debugging. */
  get showing(): Hint['kind'] | null { return this.hint?.kind ?? null; }

  start(): void {
    if (this.n !== 1 || this.done) return;
    const g = this.game, q = g.front(this.firstQueue) ? this.firstQueue : g.queues.findIndex(qq => qq.length > 0);
    if (q >= 0) this.show({ kind: 'queue', q });
  }

  /** After every engine event batch. */
  events(ev: readonly GameEvent[]): void {
    const g = this.game, h = this.hint;
    if (g.status !== 'playing') { this.stop(); return; }
    if (this.done && !h) return;
    if (this.n === 1) {
      if (h && ev.some(e => e.type === 'launch')) this.finish();
    } else if (this.n === 2) {
      if (!h && g.tray.length) this.show({ kind: 'tray', id: g.tray[0]!.id });
      else if (h?.kind === 'tray' && !g.tray.some(t => t.id === h.id)) this.finish();
      else this.place();
    } else if (this.n === 4) {
      if (!h && g.tray.length >= CUSHION_HINT_AT) this.show({ kind: 'cushion' });
      else if (h && g.tray.length < CUSHION_HINT_AT) this.finish();
    }
  }

  booster(k: BoosterKey): void {
    if (this.hint?.kind === 'cushion' && k === 'slot') this.finish();
  }

  /** Re-aim the pointer (after a resize, or when the target moved). */
  place(force = false): void {
    const h = this.hint;
    if (!h) return;
    const { ui, scene } = this.host;
    let t: TapTarget | null = null, at: Point | null, text: string;
    if (h.kind === 'cushion') { at = this.host.boosterPoint('slot'); text = TUTORIAL_TEXT.cushion; }
    else {
      t = h.kind === 'queue' ? h : { kind: 'tray', i: this.game.tray.findIndex(x => x.id === h.id) };
      at = scene.screenPoint(t);
      text = h.kind === 'queue' ? TUTORIAL_TEXT.tap : TUTORIAL_TEXT.tray;
    }
    const key = `${JSON.stringify(t)}|${at ? `${Math.round(at.x)},${Math.round(at.y)}` : '-'}`;
    if (!force && key === this.placedAt) return; // nothing moved: leave the DOM alone
    this.placedAt = key;
    scene.highlight(t);
    ui.tutorial({ text, at });
  }

  /** Hide for good (level over, attempt ended). */
  stop(): void {
    if (this.hint) this.hide();
    this.done = true;
  }

  private show(h: Hint): void {
    this.hint = h;
    this.done = true; // each hint shows once per attempt
    this.place(true);
  }

  private finish(): void { this.stop(); }

  private hide(): void {
    this.hint = null;
    this.placedAt = '';
    this.host.scene.highlight(null);
    this.host.ui.tutorial(null);
  }
}
