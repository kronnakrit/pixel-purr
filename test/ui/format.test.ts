import { describe, expect, it } from 'vitest';
import { formatCoins, formatMinutes, formatNumber, formatTimer, rewardItems, rewardLabel, rewardSummary } from '../../src/ui/format';

describe('formatNumber', () => {
  it('groups thousands without a locale', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1240)).toBe('1,240');
    expect(formatNumber(28000)).toBe('28,000');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
  it('rounds and keeps the sign', () => {
    expect(formatNumber(12.6)).toBe('13');
    expect(formatNumber(-1500)).toBe('-1,500');
    expect(formatNumber(-0.2)).toBe('0');
  });
});

describe('formatCoins', () => {
  it('is exact below 100k', () => {
    expect(formatCoins(560)).toBe('560');
    expect(formatCoins(99_999)).toBe('99,999');
  });
  it('shortens big balances and never rounds up', () => {
    expect(formatCoins(100_000)).toBe('100K');
    expect(formatCoins(250_999)).toBe('250K');
    expect(formatCoins(1_000_000)).toBe('1M');
    expect(formatCoins(1_299_999)).toBe('1.2M');
    expect(formatCoins(12_345_678)).toBe('12.3M');
  });
});

describe('formatTimer', () => {
  it('shows mm:ss and rounds up to whole seconds', () => {
    expect(formatTimer(0)).toBe('00:00');
    expect(formatTimer(1)).toBe('00:01');
    expect(formatTimer(999)).toBe('00:01');
    expect(formatTimer(1000)).toBe('00:01');
    expect(formatTimer(65_000)).toBe('01:05');
    expect(formatTimer(29 * 60_000 + 59_500)).toBe('30:00');
  });
  it('adds hours from 60 minutes and clamps negatives', () => {
    expect(formatTimer(3_600_000)).toBe('1:00:00');
    expect(formatTimer(3_723_000)).toBe('1:02:03');
    expect(formatTimer(-5000)).toBe('00:00');
  });
});

describe('formatMinutes', () => {
  it('reads naturally', () => {
    expect(formatMinutes(30)).toBe('30 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(90)).toBe('1 h 30 min');
    expect(formatMinutes(0)).toBe('0 min');
  });
});

describe('rewards', () => {
  it('lists the parts of a reward in a stable order', () => {
    const r = { removeAds: true, unlimitedLivesMin: 30, boosters: { xray: 1, slot: 2 }, coins: 250 };
    expect(rewardItems(r)).toEqual([
      { kind: 'coins', n: 250 }, { kind: 'booster', key: 'slot', n: 2 }, { kind: 'booster', key: 'xray', n: 1 },
      { kind: 'lives', min: 30 }, { kind: 'noAds' },
    ]);
    expect(rewardItems({})).toEqual([]);
    expect(rewardItems({ coins: 0, boosters: { nap: 0 } })).toEqual([]);
  });
  it('labels each part', () => {
    expect(rewardLabel({ kind: 'coins', n: 2500 })).toBe('2,500 coins');
    expect(rewardLabel({ kind: 'booster', key: 'shuffle', n: 1 })).toBe('1 Yarn Shuffle');
    expect(rewardLabel({ kind: 'lives', min: 30 })).toBe('30 min unlimited lives');
    expect(rewardLabel({ kind: 'noAds' })).toBe('No ads');
  });
  it('summarises bundles, folding "n of each booster"', () => {
    const each = (n: number) => ({ slot: n, shuffle: n, nap: n, xray: n });
    expect(rewardSummary({ coins: 2500, boosters: each(2) })).toBe('2,500 coins + 2 of each booster');
    expect(rewardSummary({ removeAds: true, boosters: each(3), coins: 2000 })).toBe('2,000 coins + 3 of each booster + No ads');
    expect(rewardSummary({ boosters: { slot: 1 } })).toBe('1 Extra Cushion');
    expect(rewardSummary({ coins: 250, unlimitedLivesMin: 30 })).toBe('250 coins + 30 min unlimited lives');
  });
});
