// Maps CSS px on the canvas to world space for the tilted orthographic camera, and back.
// The camera looks from +Z and above, TILT below the horizon. A CSS point maps to the ground plane (y = 0);
// `depth` slides it along the view ray (+ away from the camera), which keeps its screen position but changes
// what it is drawn in front of, and how much fog dims it.
import { Vector3 } from 'three';
import type { Pt } from './layout';

export const TILT = (58 * Math.PI) / 180;
/** Camera distance from the origin along the view ray. */
export const CAM_DIST = 60;

export class Projector {
  W = 390; H = 844;
  /** World units per CSS px. */
  k = 1 / 39;
  readonly sin = Math.sin(TILT);
  readonly cos = Math.cos(TILT);

  set(W: number, H: number, k: number): void { this.W = W; this.H = H; this.k = k; }

  /** World point that draws at CSS (cx, cy): on the ground, pushed `depth` units along the view ray. */
  toWorld(cx: number, cy: number, depth: number, out: Vector3): Vector3 {
    const ys = (this.H / 2 - cy) * this.k;
    return out.set((cx - this.W / 2) * this.k, -depth * this.sin, -ys / this.sin - depth * this.cos);
  }

  /** The depth that lifts a ground point to height h without moving it on screen. */
  lift(h: number): number { return -h / this.sin; }

  /** Distance from the camera along the view ray of the ground point under CSS y, plus depth. */
  viewDepth(cy: number, depth = 0): number {
    const z = -((this.H / 2 - cy) * this.k) / this.sin;
    return CAM_DIST - z * this.cos + depth;
  }

  /** CSS position of a world point. */
  toCss(p: Vector3, out: Pt): Pt {
    out.x = p.x / this.k + this.W / 2;
    out.y = this.H / 2 - (p.y * this.cos - p.z * this.sin) / this.k;
    return out;
  }
}

/** Inverse of GLSL smoothstep(0, 1, x): the x that gives fog amount a. */
export const unsmooth = (a: number): number => 0.5 - Math.sin(Math.asin(1 - 2 * Math.min(1, Math.max(0, a))) / 3);
