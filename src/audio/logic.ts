// Pure sound logic: which sounds and haptics a batch of engine events makes, the rising paint-streak pitch and the
// plink throttle. No Web Audio here, so it runs in unit tests with a fake clock. All times are in seconds.
import type { Sfx } from '../app/contracts';
import type { GameEvent } from '../engine';

export type HapticKind = 'light' | 'medium' | 'success' | 'warning';

/** One sound to start `delay` s from now. `semi` shifts its pitch (paint streak, coin run). */
export interface Cue { sfx: Sfx; delay: number; semi?: number }

// ---------------------------------------------------------------- paint streak + throttle

/** Seconds without a shot before the streak pitch starts over. */
export const STREAK_RESET = 0.35;
/** Plinks per second, all riders together. The belt steps 36 times a second and several riders can shoot per step. */
export const PLINK_RATE = 14;
/** Timing tolerance (s): a plink may come this much early, so shots on the 36/s belt grid still average exactly
 *  PLINK_RATE instead of rounding down to every third step. Two plinks are never closer than 1/PLINK_RATE - this. */
export const PLINK_SLACK = 0.03;
/** Streak notes in semitones above the base plink (G5): a major pentatonic run up to C7. */
export const STREAK_SCALE: readonly number[] = [0, 2, 5, 7, 9, 12, 14, 17];

/** Semitone shift of the n-th plink in a streak. Past the top it walks back down and up again (ping-pong),
 *  so long streaks stay musical instead of climbing out of range. */
export function streakSemi(n: number): number {
  const top = STREAK_SCALE.length - 1, i = n % (2 * top);
  return STREAK_SCALE[i <= top ? i : 2 * top - i]!;
}

/** n: plinks played in this streak; last: time of the last shot (played or not); credit/at: token bucket. */
export interface Streak { n: number; last: number; credit: number; at: number }

export const newStreak = (): Streak => ({ n: 0, last: -Infinity, credit: 1, at: -Infinity });

/** A shot at time t. Returns the next state and the plink's semitone shift, or null when throttled.
 *  A token bucket holding one plink plus the slack: no bursts, and exactly PLINK_RATE under a steady stream. */
export function shot(s: Streak, t: number): { s: Streak; semi: number | null } {
  const n = t - s.last > STREAK_RESET ? 0 : s.n;
  const credit = Math.min(1 + PLINK_SLACK * PLINK_RATE, s.credit + (t - s.at) * PLINK_RATE);
  if (credit < 1 - 1e-9) return { s: { n, last: t, credit, at: t }, semi: null };
  return { s: { n: n + 1, last: t, credit: credit - 1, at: t }, semi: streakSemi(n) };
}

// ---------------------------------------------------------------- re-trigger gaps

/** Shortest gap between two starts of the same sound, so bursts (three pops in three steps, a shower of coins)
 *  read as a ripple instead of a loud flam. Paint has its own throttle. */
export const SFX_GAP: Partial<Record<Sfx, number>> = {
  button: 0.05, tap: 0.05, blocked: 0.12, pop: 0.06, park: 0.06, coin: 0.045, cushion: 0.1, reveal: 0.1,
  win: 1, lose: 1, worry: 0.6, booster: 0.15, unlock: 0.3, shuffle: 0.2, nap: 0.3, xray: 0.2, gift: 0.3,
};

/** May sfx start at time t, given when each sound last started? */
export function sfxReady(last: Partial<Record<Sfx, number>>, sfx: Sfx, t: number): boolean {
  const prev = last[sfx];
  return prev === undefined || t - prev >= (SFX_GAP[sfx] ?? 0) - 1e-9;
}

/** Light taps and medium bumps closer than this merge into one (a buzz storm feels like a fault). */
export const HAPTIC_GAP = 0.05;
export const HAPTIC_RANK: Readonly<Record<HapticKind, number>> = { light: 1, medium: 2, success: 3, warning: 4 };

export function hapticReady(last: number, kind: HapticKind, t: number): boolean {
  return HAPTIC_RANK[kind] >= HAPTIC_RANK.success || t - last >= HAPTIC_GAP - 1e-9;
}

/** Coin ticks in a run climb a little (do, re, mi, sol) so a pile of coins sounds like it is filling up. */
export const COIN_RUN: readonly number[] = [0, 2, 4, 7];
/** A gap this long (s) starts a new coin run. */
export const COIN_RUN_RESET = 0.4;
export function coinSemi(i: number): number { return COIN_RUN[i % COIN_RUN.length]!; }

// ---------------------------------------------------------------- engine events

/** Delays line sounds up with the animations: the ta-da on the reveal flip (after the hop), the worried "uh-oh"
 *  after the cushion thud, the fanfare and the "oh no" after the last chime or thud has spoken. */
export const DELAY = { reveal: 0.18, worry: 0.14, win: 0.32, lose: 0.26 } as const;

export interface TrayLike { readonly tray: { readonly length: number }; readonly trayCap: number }

export interface Cues { cues: Cue[]; haptic: { kind: HapticKind; delay: number } | null; streak: Streak }

/** Sounds and the one strongest haptic for a batch of engine events at time t. Each sound plays at most once
 *  per batch: the engine can report several pops or parks in one step and they are one moment on screen. */
export function eventCues(events: readonly GameEvent[], game: TrayLike, streak: Streak, t: number): Cues {
  const cues: Cue[] = [];
  let haptic: Cues['haptic'] = null, parked = false, moved = false;
  const add = (sfx: Sfx, delay = 0, semi?: number) => {
    if (cues.some(c => c.sfx === sfx)) return;
    cues.push(semi === undefined ? { sfx, delay } : { sfx, delay, semi });
  };
  const buzz = (kind: HapticKind, delay = 0) => {
    if (!haptic || HAPTIC_RANK[kind] > HAPTIC_RANK[haptic.kind]) haptic = { kind, delay };
  };
  for (const e of events) {
    switch (e.type) {
      case 'launch': add('tap'); buzz('light'); moved = true; break;
      case 'shot': { const r = shot(streak, t); streak = r.s; if (r.semi !== null) add('paint', 0, r.semi); break; }
      case 'pop': add('pop'); buzz('medium'); break;
      case 'park': add('park'); parked = true; break;
      // a reveal right after a launch or shuffle waits for the hop; its light tap is the launch's
      case 'reveal': add('reveal', moved ? DELAY.reveal : 0); buzz('light', moved ? DELAY.reveal : 0); break;
      case 'won': add('win', DELAY.win); buzz('success', DELAY.win); break;
      case 'lost': add('lose', DELAY.lose); buzz('warning', DELAY.lose); break;
      case 'traySlots': add('cushion'); break;
      case 'shuffle': add('shuffle'); moved = true; break;
      case 'napBack': add('nap'); break;
      case 'xrayArmed': add('xray'); break;
      case 'resumed': break;
    }
  }
  // the tray just filled up (one more park loses): worried, but never on the losing park itself
  if (parked && game.tray.length === game.trayCap) { add('worry', DELAY.worry); buzz('warning', DELAY.worry); }
  return { cues, haptic, streak };
}
