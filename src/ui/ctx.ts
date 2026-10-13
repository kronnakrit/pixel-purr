// Shared state handed to every part of the interface: layers, the coin counter, motion preference and feedback hooks.
import type { Sfx } from '../app/contracts';
import { formatCoins } from './format';

export interface Layers { screen: HTMLElement; hud: HTMLElement; tut: HTMLElement; modals: HTMLElement; fx: HTMLElement; veil: HTMLElement }

export interface Ctx {
  root: HTMLElement;
  layers: Layers;
  coins: CoinCounter;
  /** Reduced motion is on (only fades). */
  rm(): boolean;
  /** UI sound/haptic hook (button taps, coin ticks); the controller routes it to audio. */
  sfx(s: Sfx): void;
  toast(text: string): void;
  /** Coin chips on screen (HUD chip, shop page chip); the topmost visible one is the target for flying coins. */
  chips: HTMLElement[];
}

/**
 * The coin number shown in every chip. Increases wait a tick before showing so that a coin flight started right
 * after setCoins() can count them up as the coins land; spending shows at once.
 */
export class CoinCounter {
  shown = 0;
  target = 0;
  private flying = 0;
  private pending: ReturnType<typeof setTimeout> | null = null;
  private views = new Set<(text: string) => void>();

  bind(fn: (text: string) => void): () => void {
    this.views.add(fn);
    fn(formatCoins(this.shown));
    return () => { this.views.delete(fn); };
  }
  set(n: number): void {
    this.target = n;
    if (this.flying) return;
    this.cancel();
    if (n <= this.shown) this.show(n);
    else this.pending = setTimeout(() => { this.pending = null; if (!this.flying) this.show(this.target); }, 0);
  }
  /** A coin flight starts: returns the number to count up from. */
  begin(): number { this.flying++; this.cancel(); return this.shown; }
  /** Part of the flight landed (frac 0..1). */
  step(from: number, frac: number): void { if (this.target > from) this.show(Math.round(from + (this.target - from) * frac)); }
  end(): void { this.flying = Math.max(0, this.flying - 1); if (!this.flying) this.show(this.target); }
  private cancel() { if (this.pending) { clearTimeout(this.pending); this.pending = null; } }
  private show(n: number) {
    this.shown = n;
    const t = formatCoins(n);
    this.views.forEach(f => f(t));
  }
}
