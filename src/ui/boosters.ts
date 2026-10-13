// Booster copy for the interface. Unlock levels and prices mirror docs/ARCHITECTURE.md; the live price for the
// buy card comes from the controller (remote config can change it), the unlock level here only labels the lock.
// `help` and `when` feed the help page; keep them true to the engine (src/engine/game.ts).
import type { BoosterKey } from '../app/contracts';

export interface BoosterInfo {
  key: BoosterKey; name: string; unlock: number; price: number; does: string; short: string;
  /** Help page: what happens, in a sentence or two. */
  help: string;
  /** Help page: the moment to reach for it, finishing "Use it when…". */
  when: string;
}

export const BOOSTER_INFO: Readonly<Record<BoosterKey, BoosterInfo>> = {
  slot: {
    key: 'slot', name: 'Extra Cushion', unlock: 4, price: 900, does: 'Adds one more tray slot for the rest of the level.', short: 'Adds a tray slot',
    help: 'Adds one more cushion to the tray for the rest of the level, so one more Purrlet can nap. One per try.',
    when: 'your tray is almost full.',
  },
  shuffle: {
    key: 'shuffle', name: 'Yarn Shuffle', unlock: 6, price: 600, does: 'Re-deals the order of every Purrlet still waiting in the queues.', short: 'Re-deals the queues',
    help: 'Mixes up every Purrlet waiting in the queues, so different colours can come to the front. Linked friends stay put.',
    when: 'the colours you need are stuck at the back.',
  },
  nap: {
    key: 'nap', name: 'Cat Nap', unlock: 9, price: 1200, does: 'Sends every napping Purrlet to the end of the queues, emptying the tray.', short: 'Empties the tray',
    help: 'Every napping Purrlet goes back to the end of a queue with its paint, so all your cushions are free again.',
    when: "your tray is full of Purrlets that can't paint yet.",
  },
  xray: {
    key: 'xray', name: 'X-Ray Specs', unlock: 13, price: 1500, does: 'The next Purrlet sees through other colours for one lap.', short: 'Sees through colours',
    help: 'The next Purrlet you tap sees through other colours for one lap, so it can paint its colour behind them. For linked friends, the left one wears the specs.',
    when: 'a colour is hidden behind other colours.',
  },
};
