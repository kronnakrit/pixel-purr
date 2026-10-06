// One Purrlet on the field: its view, where it belongs (queue, tray, belt…), and the tween that carries it there.
// Positions are CSS px (anchor = bottom centre of the pot) plus a width and a dim amount; the scene turns them into
// world transforms. Targets are refreshed every frame, so a hop onto the belt homes in on a moving lane spot.
import { Group } from 'three';
import type { PurrletMood, PurrletView } from '../purrlet';
import { backOut, clamp01, inOutCubic, lerp, outCubic, type Ease } from './ease';

export type Place =
  | { k: 'queue'; q: number; d: number }
  | { k: 'tray'; i: number }
  | { k: 'belt' }
  /** Flying out of sight (deeper into a queue): shrinks away, then the view is removed. */
  | { k: 'leave'; x: number; y: number; w: number; dim: number }
  /** Out of paint: finishes any hop to where it popped, and stays there while it pops. */
  | { k: 'pop'; x: number; y: number; w: number }
  | { k: 'dance'; i: number };

export interface Style { dur: number; arc: number; ease: Ease; grow?: boolean; shrink?: boolean }

/** Arc heights are in CSS px per 100 px of column width (scaled by the scene). */
export const STYLE = {
  snap: { dur: 0, arc: 0, ease: outCubic },
  slide: { dur: 0.34, arc: 0, ease: outCubic },
  hop: { dur: 0.36, arc: 3, ease: outCubic },
  fly: { dur: 0.5, arc: 12, ease: inOutCubic },
  appear: { dur: 0.34, arc: 0, ease: outCubic, grow: true },
  leave: { dur: 0.4, arc: 6, ease: inOutCubic, shrink: true },
  dance: { dur: 0.45, arc: 0, ease: outCubic, grow: true },
} satisfies Record<string, Style>;

/** Lean back towards the camera so faces and pot numbers read well under the tilted view. */
export const CAT_LEAN = 0;

export class CatSlot {
  readonly holder = new Group();
  /** Shown state; push = how far it was slid along the view ray (for dimming), set by the scene. */
  x = 0; y = 0; w = 0; dim = 0; mul = 1; push = 0;
  /** Target, refreshed every frame from the place. */
  tx = 0; ty = 0; tw = 0; tdim = 0;
  place: Place;
  mood: PurrletMood | null = null;
  /** Seconds into the 'no' wiggle (>= WIGGLE when idle). */
  wig = 9;
  xray = false;
  onArrive: (() => void) | null = null;
  private t = 1;
  private dur = 0;
  private arc = 0;
  private ease: Ease = outCubic;
  private fx = 0; private fy = 0; private fw = 0; private fdim = 0; private fmul = 1; private tmul = 1;
  private placed = false;

  constructor(readonly id: number, readonly view: PurrletView, place: Place) {
    this.place = place;
    this.holder.add(view.object);
    this.holder.rotation.x = -CAT_LEAN;
  }

  get moving(): boolean { return this.t < 1; }

  /** Start the small 'no' wiggle (a tap that can't launch right now). */
  no(): void { this.wig = 0; }

  /** Head for a new place. The first placement (or a zero-length style) snaps. */
  go(place: Place, s: Style, arcScale: number): void {
    this.place = place;
    this.onArrive = null;
    this.fx = this.x; this.fy = this.y; this.fw = this.w; this.fdim = this.dim;
    this.fmul = s.grow ? 0 : this.mul; this.tmul = s.shrink ? 0 : 1;
    this.dur = s.dur; this.arc = s.arc * arcScale; this.ease = s.ease;
    this.t = s.dur > 0 && this.placed ? 0 : 1;
    if (s.grow) { this.t = 0; this.mul = 0; }
  }

  setMood(m: PurrletMood): void { if (m !== this.mood) { this.mood = m; this.view.setMood(m); } }

  /** Advance the tween towards the current target. Returns true when it just arrived. */
  step(dt: number): boolean {
    if (!this.placed) { // first frame: start (and grow) in place
      this.placed = true;
      this.x = this.fx = this.tx; this.y = this.fy = this.ty; this.w = this.fw = this.tw; this.dim = this.fdim = this.tdim;
      if (this.t >= 1) this.mul = this.tmul;
    }
    if (this.wig < CatSlot.WIGGLE) this.wig += dt;
    if (this.t >= 1) {
      this.x = this.tx; this.y = this.ty; this.w = this.tw; this.dim = this.tdim; this.mul = this.tmul;
      return false;
    }
    this.t = clamp01(this.t + dt / Math.max(1e-3, this.dur));
    const e = this.ease(this.t), t = this.t;
    this.x = lerp(this.fx, this.tx, e);
    this.y = lerp(this.fy, this.ty, e) - this.arc * Math.sin(Math.PI * t);
    this.w = lerp(this.fw || this.tw, this.tw, outCubic(t));
    this.dim = lerp(this.fdim, this.tdim, t);
    this.mul = this.tmul > this.fmul ? lerp(this.fmul, this.tmul, Math.max(0, backOut(t))) : lerp(this.fmul, this.tmul, t * t);
    if (t < 1) return false;
    const cb = this.onArrive;
    this.onArrive = null;
    cb?.();
    return true;
  }

  /** Width of the 'no' wiggle window, in seconds. */
  static readonly WIGGLE = 0.42;

  /** Roll (radians) and scale pulse of the 'no' wiggle right now. */
  wiggle(reduced: boolean): { roll: number; pulse: number } {
    const u = this.wig / CatSlot.WIGGLE;
    if (u >= 1) return NO_WIGGLE;
    WIG.roll = reduced ? 0 : 0.2 * Math.sin(u * Math.PI * 6) * (1 - u);
    WIG.pulse = reduced ? 1 + 0.08 * Math.sin(Math.PI * u) : 1;
    return WIG;
  }
}

const NO_WIGGLE = { roll: 0, pulse: 1 } as const;
const WIG = { roll: 0, pulse: 1 };
