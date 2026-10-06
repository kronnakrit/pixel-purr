// Booster copy for the interface. Unlock levels and prices mirror docs/ARCHITECTURE.md; the live price for the
// buy card comes from the controller (remote config can change it), the unlock level here only labels the lock.
import type { BoosterKey } from '../app/contracts';

export interface BoosterInfo { key: BoosterKey; name: string; unlock: number; price: number; does: string; short: string }

export const BOOSTER_INFO: Readonly<Record<BoosterKey, BoosterInfo>> = {
  slot: { key: 'slot', name: 'Extra Cushion', unlock: 4, price: 900, does: 'Adds a 6th tray slot for the rest of the level.', short: 'Adds a 6th tray slot' },
  shuffle: { key: 'shuffle', name: 'Yarn Shuffle', unlock: 6, price: 600, does: 'Re-deals the order of every Purrlet still waiting in the queues.', short: 'Re-deals the queues' },
  nap: { key: 'nap', name: 'Cat Nap', unlock: 9, price: 1200, does: 'Sends every napping Purrlet to the end of the queues, emptying the tray.', short: 'Empties the tray' },
  xray: { key: 'xray', name: 'X-Ray Specs', unlock: 13, price: 1500, does: 'The next Purrlet sees through other colours for one lap.', short: 'Sees through colours' },
};
