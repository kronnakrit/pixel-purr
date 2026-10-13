// Easing curves (t in 0..1). Nothing in the play field moves in a straight line without one.
export type Ease = (t: number) => number;

export const linear: Ease = t => t;
export const outCubic: Ease = t => 1 - (1 - t) ** 3;
export const inCubic: Ease = t => t * t * t;
export const inOutSine: Ease = t => 0.5 - Math.cos(Math.PI * t) / 2;
export const inOutCubic: Ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Overshoots by about s/10 before settling. */
export const outBack = (s = 1.70158): Ease => t => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
export const backOut = outBack();
export const softBack = outBack(1.2);

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
