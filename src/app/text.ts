// Small copy helpers for toasts. Plain words: every reward says exactly what the player got.
import { BOOSTER_KEYS, type BoosterKey, type ProductId, type Reward } from './contracts';

export const PRODUCT_IDS: readonly ProductId[] = [
  'coins_pouch', 'coins_basket', 'coins_jar', 'coins_treasure', 'cosy_bundle', 'starter_bundle', 'remove_ads',
];

const BOOSTER_NAMES: Record<BoosterKey, string> = { slot: 'Extra Cushion', shuffle: 'Yarn Shuffle', nap: 'Cat Nap', xray: 'X-Ray Specs' };

export const formatInt = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "+1,000 coins, 2 of each booster, no more ads". Empty when the reward is empty. */
export function describeReward(r: Reward, withCoins = true): string {
  const parts: string[] = [];
  if (withCoins && r.coins) parts.push(`+${formatInt(r.coins)} coins`);
  const b = BOOSTER_KEYS.map(k => [k, r.boosters?.[k] ?? 0] as const).filter(([, n]) => n > 0);
  if (b.length === BOOSTER_KEYS.length && b.every(([, n]) => n === b[0]![1])) parts.push(`${b[0]![1]} of each booster`);
  else for (const [k, n] of b) parts.push(`${n} ${BOOSTER_NAMES[k]}`);
  if (r.unlimitedLivesMin) parts.push(`${r.unlimitedLivesMin} min of unlimited lives`);
  if (r.removeAds) parts.push('no more ads');
  return parts.join(', ');
}
