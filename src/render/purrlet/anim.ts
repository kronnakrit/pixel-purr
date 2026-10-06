// Spring-and-tween helpers and the Purrlet choreography as pure functions of time (no Three.js), so the
// timings from docs/ARCHITECTURE.md live in one place and are unit-tested. Distances are world units
// (a cat is about 1 wide), angles radians, times seconds.

export type Ease = (t: number) => number;

export const clamp = (x: number, lo = 0, hi = 1): number => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const DEG = Math.PI / 180;

export const linear: Ease = t => clamp(t);
/** Sine ease in-out: the default for loops. */
export const easeInOut: Ease = t => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
export const easeOut: Ease = t => 1 - (1 - clamp(t)) ** 3;
export const easeIn: Ease = t => clamp(t) ** 3;
/** Overshoots past 1 then settles (s = 1.70158 gives about 10% overshoot). */
export const backOut = (s = 1.70158): Ease => t => { const u = clamp(t) - 1; return 1 + u * u * ((s + 1) * u + s); };

/** A keyframe: value v at time t, eased in from the previous key with e (default sine in-out). */
export interface Key { t: number; v: number; e?: Ease }

/** Samples a keyframe track; holds the first/last value outside it. Keys must be sorted by t. */
export function track(keys: readonly Key[], t: number): number {
  const first = keys[0];
  if (!first) return 0;
  if (t <= first.t) return first.v;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (t <= k.t) {
      const p = keys[i - 1]!, span = k.t - p.t;
      return lerp(p.v, k.v, (k.e ?? easeInOut)(span > 0 ? (t - p.t) / span : 1));
    }
  }
  return keys[keys.length - 1]!.v;
}

/** Volume-preserving squash and stretch: vertical scale sy, horizontal scales so that x * y * z = 1. */
export function squash(sy: number): { x: number; y: number; z: number } {
  const s = 1 / Math.sqrt(Math.max(sy, 1e-4));
  return { x: s, y: sy, z: s };
}

export interface Spring { x: number; v: number }

/** One step of a damped spring towards target. freq in Hz; zeta 1 = critically damped, < 1 overshoots.
 *  Substeps keep it stable for long frames (a phone hiccup must not explode a cat). */
export function spring(s: Spring, target: number, dt: number, freq = 3, zeta = 0.6): Spring {
  const w = 2 * Math.PI * freq, n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  let { x, v } = s;
  for (let i = 0; i < n; i++) { v += (-w * w * (x - target) - 2 * zeta * w * v) * h; x += v * h; }
  return { x, v };
}

/** 0..1 position within a loop of the given period. */
export const phase = (t: number, period: number): number => { const p = (t / period) % 1; return p < 0 ? p + 1 : p; };
/** Smooth 0 -> 1 -> 0 over one loop (sine). */
export const wave = (t: number, period: number): number => 0.5 - 0.5 * Math.cos(2 * Math.PI * phase(t, period));
/** Linear triangle wave in -1..1 (for the "linear shake"). */
export const tri = (t: number, period: number): number => { const p = phase(t + period / 4, period); return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; };

/** Seconds until the next random event, uniform in [min, max). */
export const nextIn = (rng: () => number, min: number, max: number): number => min + (max - min) * rng();

// ---------------------------------------------------------------- timings (docs/ARCHITECTURE.md)

export const T = {
  idle: 3.4, peek: 5.2, blinkMin: 4, blinkMax: 6, blink: 0.16, tail: 2.6,
  hop: 0.45, ride: 0.7, earLag: 0.1, shoot: 0.25, pop: 0.7, nap: 4, zz: 3,
  dance: 0.9, danceStagger: 0.15, worry: 0.5, sweat: 2.4, reveal: 0.6, land: 0.35, tapPulse: 0.3,
} as const;

/** A body pose offset produced by a one-shot or a loop. All fields are offsets from rest
 *  (sy and s are multipliers). y is a jump height, back a push away from the aim. */
export interface Pose { y: number; sy: number; s: number; rz: number; ry: number; x: number; back: number }
export const rest = (): Pose => ({ y: 0, sy: 1, s: 1, rz: 0, ry: 0, x: 0, back: 0 });

// ---------------------------------------------------------------- loops

/** Idle: breathe 2.5% over 3.4 s (exhale squashes), and the peek-up offset for the head. */
export function idleBreath(t: number): number { return 1 - 0.028 * wave(t, T.idle); }
/** Head peek: rests, pops up 0.05 near 70% of the loop with a small dip after, like the 2D demo. */
export function peek(t: number, period: number = T.peek): number {
  return track(PEEK, phase(t, period));
}
const PEEK: Key[] = [{ t: 0.6, v: 0 }, { t: 0.7, v: 0.05 }, { t: 0.8, v: -0.012 }, { t: 0.9, v: 0 }];

/** Blink: 0 open .. 1 shut, over T.blink seconds starting at t = 0. */
export function blink(t: number): number { return t < 0 || t > T.blink ? 0 : Math.sin(Math.PI * t / T.blink); }

/** Ear twitch over 0.45 s: a quick outward flick and a small rebound (radians, + = outward). */
export function twitch(t: number): number {
  return track([{ t: 0, v: 0 }, { t: 0.08, v: 11 * DEG, e: easeOut }, { t: 0.22, v: -4 * DEG }, { t: 0.45, v: 0 }], t);
}

/** Ride: two bobs per 0.7 s loop with a 2 degree tilt; ears flap outward a beat (0.1 s) behind. */
export function ride(t: number): { y: number; rz: number; ear: number; tail: number } {
  return {
    y: 0.05 * wave(t, T.ride / 2),
    rz: -2 * DEG * Math.cos(2 * Math.PI * t / T.ride),
    ear: 9 * DEG * wave(t - T.earLag, T.ride),
    tail: 15 * DEG * Math.sin(2 * Math.PI * t / (T.ride / 2)),
  };
}

/** Nap: slow 4 s breathing (exhale squashes 5%). */
export function napBreath(t: number): number { return 1 - 0.05 * wave(t, T.nap); }

/** One floating z over T.zz seconds: drifts up and right, grows, fades in then out. */
export function zz(t: number): { x: number; y: number; s: number; a: number } {
  const p = phase(t, T.zz), e = easeOut(p);
  return { x: 0.1 * e, y: 0.32 * e, s: 0.5 + 0.6 * p, a: p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8 };
}

/** Win dance 0.9 s loop: squash, jump with a tilt left, land tilted right, settle. */
export function dance(t: number): Pose {
  const p = phase(t, T.dance);
  return {
    ...rest(),
    y: track([{ t: 0.2, v: 0 }, { t: 0.45, v: 0.27, e: easeOut }, { t: 0.7, v: 0, e: easeIn }], p),
    rz: track([{ t: 0.2, v: 0 }, { t: 0.45, v: 9 * DEG }, { t: 0.7, v: -7 * DEG }, { t: 0.85, v: 3 * DEG }, { t: 1, v: 0 }], p),
    sy: track([{ t: 0, v: 1 }, { t: 0.2, v: 0.86 }, { t: 0.45, v: 1.1 }, { t: 0.7, v: 0.88 }, { t: 0.85, v: 1.02 }, { t: 1, v: 1 }], p),
  };
}

/** Cheer: a light happy bounce. */
export function cheer(t: number): Pose {
  return { ...rest(), y: 0.035 * wave(t, 0.5), sy: 1 + 0.03 * wave(t + 0.1, 0.5) };
}

/** Worry: linear shake for 0.5 s (4 px, 2 degrees), then hold still. */
export function worryShake(t: number): { x: number; rz: number } {
  if (t < 0 || t >= T.worry) return { x: 0, rz: 0 };
  const k = tri(t, T.worry / 4);
  return { x: 0.05 * k, rz: 2 * DEG * k };
}

/** Sweat drop loop: appears at the temple, slides down and fades. */
export function sweat(t: number): { y: number; s: number; a: number } {
  const p = phase(t, T.sweat);
  return {
    y: -0.2 * track([{ t: 0.14, v: 0 }, { t: 0.6, v: 1, e: easeIn }], p),
    s: track([{ t: 0, v: 0 }, { t: 0.14, v: 1, e: backOut() }, { t: 0.6, v: 0.85 }], p),
    a: track([{ t: 0, v: 0 }, { t: 0.1, v: 1 }, { t: 0.45, v: 1 }, { t: 0.6, v: 0 }], p),
  };
}

// ---------------------------------------------------------------- one-shots (t = seconds since start)

/** Tap and hop, 0.45 s back-out: squash 14%, stretch up, land squash, settle. */
export function hop(t: number, height = 0.42): Pose {
  const p = t / T.hop;
  return {
    ...rest(),
    y: height * track([{ t: 0.1, v: 0 }, { t: 0.3, v: 0.9, e: easeOut }, { t: 0.5, v: 1, e: easeOut }, { t: 0.7, v: 0, e: easeIn }], p),
    sy: track([{ t: 0, v: 1 }, { t: 0.1, v: 0.82 }, { t: 0.3, v: 1.16, e: easeOut }, { t: 0.5, v: 1.04 }, { t: 0.7, v: 0.84, e: easeIn },
      { t: 0.8, v: 1.05 }, { t: 0.9, v: 0.99 }, { t: 1, v: 1 }], p),
  };
}

/** Paint a pixel, 0.25 s ease-out: stretch with a 7% recoil, rebound. back is a push away from the aim. */
export function shoot(t: number): Pose {
  const p = t / T.shoot;
  return {
    ...rest(),
    sy: track([{ t: 0, v: 1 }, { t: 0.2, v: 1.07, e: easeOut }, { t: 0.55, v: 0.95 }, { t: 1, v: 1 }], p),
    back: 0.07 * track([{ t: 0, v: 0 }, { t: 0.15, v: 1, e: easeOut }, { t: 1, v: 0, e: easeOut }], p),
  };
}

/** Landing on a cushion: arrives squashed, overshoots tall, settles. */
export function land(t: number): Pose {
  return { ...rest(), sy: track([{ t: 0, v: 0.8 }, { t: 0.12, v: 1.08, e: easeOut }, { t: 0.24, v: 0.97 }, { t: T.land, v: 1 }], t) };
}

/** Empty and pop, 0.7 s: squash, jump, grow 22% (back-out), then shrink to nothing. */
export function pop(t: number): Pose {
  const p = t / T.pop;
  return {
    ...rest(),
    y: track([{ t: 0.19, v: 0 }, { t: 0.5, v: 0.37, e: easeOut }, { t: 0.8, v: 0.37 }, { t: 1, v: 0.27 }], p),
    sy: track([{ t: 0, v: 1 }, { t: 0.19, v: 0.84 }, { t: 0.5, v: 1.14, e: easeOut }, { t: 0.8, v: 1 }], p),
    s: track([{ t: 0.5, v: 1 }, { t: 0.8, v: 1.22, e: backOut(2.2) }, { t: 1, v: 0, e: easeIn }], p),
  };
}
/** Moment in the pop when the cat is biggest: a good time for the star burst. */
export const POP_BURST = 0.8 * T.pop;

/** Mystery reveal, 0.6 s: wiggle, flip edge-on (look swaps at the half-turn), flip back with 15% overshoot. */
export function reveal(t: number): Pose & { swapped: boolean } {
  const W = 0.22, H = 0.36, B = 0.5; // wiggle end, half-turn, flip end
  return {
    ...rest(),
    swapped: t >= H,
    rz: t < W ? 7 * DEG * Math.sin(3 * 2 * Math.PI * t / W) : 0,
    ry: t < W ? 0 : t < H ? (Math.PI / 2) * easeIn((t - W) / (H - W)) : t < B ? (-Math.PI / 2) * (1 - backOut(2.4)((t - H) / (B - H))) : 0,
    s: track([{ t: H, v: 1 }, { t: B - 0.03, v: 1.15, e: easeOut }, { t: 0.55, v: 0.95 }, { t: T.reveal, v: 1 }], t),
  };
}

/** Reduced motion: a gentle scale pulse in place of hops, lands and flips. */
export function tapPulse(t: number): Pose {
  return { ...rest(), s: track([{ t: 0, v: 1 }, { t: T.tapPulse * 0.4, v: 1.06 }, { t: T.tapPulse, v: 1 }], t) };
}
/** Reduced motion pop: no jump, a gentle swell then shrink to nothing. */
export function popCalm(t: number): Pose {
  return { ...rest(), s: track([{ t: 0, v: 1 }, { t: 0.2, v: 1.06 }, { t: 0.5, v: 0, e: easeIn }], t) };
}
export const POP_CALM = 0.5;
