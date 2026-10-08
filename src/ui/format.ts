// Pure text helpers for the interface (unit-tested in test/ui). No DOM here.
import type { BoosterKey, Reward } from '../app/contracts';
import { BOOSTER_INFO } from './boosters';

/** 1240 → "1,240". Rounds to a whole number; locale-free so it reads the same on every phone. */
export function formatNumber(n: number): string {
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 && s !== '0' ? '-' + s : s;
}

/** Coin chip text: exact up to 99,999, then "250K", "1.2M" (rounded down so it never overstates). */
export function formatCoins(n: number): string {
  const a = Math.abs(n);
  if (a < 100_000) return formatNumber(n);
  if (a < 1_000_000) return `${Math.sign(n) * Math.floor(a / 1000)}K`;
  return `${Math.sign(n) * Math.floor(a / 100_000) / 10}M`;
}

/** Countdown text: "mm:ss", or "h:mm:ss" from an hour. Rounds up so "00:00" only shows when time is up. */
export function formatTimer(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  const p = (x: number) => String(x).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** 30 → "30 min", 60 → "1 h", 90 → "1 h 30 min". */
export function formatMinutes(min: number): string {
  const t = Math.max(0, Math.round(min)), h = Math.floor(t / 60), m = t % 60;
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
}

export type RewardItem =
  | { kind: 'coins'; n: number }
  | { kind: 'booster'; key: BoosterKey; n: number }
  | { kind: 'lives'; min: number }
  | { kind: 'noAds' };

/** A reward as a list of plain things, in a stable order (coins, boosters, lives, no ads). */
export function rewardItems(r: Reward): RewardItem[] {
  const out: RewardItem[] = [];
  if (r.coins) out.push({ kind: 'coins', n: r.coins });
  for (const key of ['slot', 'shuffle', 'nap', 'xray'] as const) {
    const n = r.boosters?.[key];
    if (n) out.push({ kind: 'booster', key, n });
  }
  if (r.unlimitedLivesMin) out.push({ kind: 'lives', min: r.unlimitedLivesMin });
  if (r.removeAds) out.push({ kind: 'noAds' });
  return out;
}

export function rewardLabel(i: RewardItem): string {
  switch (i.kind) {
    case 'coins': return `${formatNumber(i.n)} coins`;
    case 'booster': return `${i.n} ${BOOSTER_INFO[i.key].name}`;
    case 'lives': return `${formatMinutes(i.min)} unlimited lives`;
    case 'noAds': return 'No ads';
  }
}

/** One line for a whole reward: "2,500 coins + 2 of each booster". */
export function rewardSummary(r: Reward): string {
  const items = rewardItems(r), b = items.filter(i => i.kind === 'booster');
  const same = b.length === 4 && b.every(i => i.kind === 'booster' && i.n === (b[0] as { n: number }).n);
  const parts: string[] = [];
  for (const i of items) {
    if (i.kind === 'booster' && same) continue;
    parts.push(rewardLabel(i));
  }
  if (same) parts.splice(items[0]?.kind === 'coins' ? 1 : 0, 0, `${(b[0] as { n: number }).n} of each booster`);
  return parts.join(' + ');
}
